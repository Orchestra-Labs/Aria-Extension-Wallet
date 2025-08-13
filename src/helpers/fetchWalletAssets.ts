import {
  IBC_PREFIX,
  COSMOS_CHAIN_ENDPOINTS,
  NetworkLevel,
  GAMM_PREFIX,
  GAMM_EXPONENT_DEFAULT,
} from '@/constants';
import { Uri, Asset, SubscriptionRecord, LocalChainRegistry } from '@/types';
import { queryRestNode } from './queryNodes';
import { safeTrimLowerCase } from './formatString';
import { getCachedPrices } from './priceCache';

const adjustAmountByExponent = (amount: string, exponent: number): string => {
  const divisor = Math.pow(10, exponent);
  return (parseFloat(amount) / divisor).toFixed(exponent);
};

const fetchAssetPrices = async (
  coinGeckoIds: string[],
  isTestnet: boolean,
): Promise<Record<string, number>> => {
  if (!coinGeckoIds.length || isTestnet) {
    return Object.fromEntries(coinGeckoIds.map(id => [id, 0]));
  }

  const cachedPrices = getCachedPrices(coinGeckoIds);
  const idsToFetch = coinGeckoIds.filter(id => !(id in cachedPrices));

  if (!idsToFetch.length) return cachedPrices;

  try {
    const batchSize = 50;
    const priceData = { ...cachedPrices };

    for (let i = 0; i < idsToFetch.length; i += batchSize) {
      const batch = idsToFetch.slice(i, i + batchSize);
      try {
        const response = await fetch(
          `https://api.coingecko.com/api/v3/simple/price?ids=${batch.join(',')}&vs_currencies=usd`,
          { signal: AbortSignal.timeout(2000) },
        );

        if (!response.ok) continue;

        const data = (await response.json()) as Record<string, { usd: number }>;
        Object.entries(data).forEach(([id, { usd }]) => {
          priceData[id] = usd;
        });
      } catch (error) {
        console.error('Error fetching CoinGecko prices batch:', error);
      }
    }

    return priceData;
  } catch (error) {
    console.error('Error in fetchCoinGeckoPrices:', error);
    return {};
  }
};

const resolveIbcAsset = async (ibcDenom: string, prefix: string, restUris: Uri[]) => {
  try {
    const denomHash = ibcDenom.slice(4);
    const response = await queryRestNode({
      prefix,
      endpoint: `${COSMOS_CHAIN_ENDPOINTS.getIBCInfo}${denomHash}`,
      restUris,
    });

    if (!response.denom_trace?.base_denom) {
      throw new Error(`No denom trace found for ${ibcDenom}`);
    }

    return {
      baseDenom: safeTrimLowerCase(response.denom_trace.base_denom),
      path: response.denom_trace.path || '',
    };
  } catch (error) {
    console.error(`Error resolving IBC denom ${ibcDenom}:`, error);
    throw error;
  }
};

const getBalances = async (
  walletAddress: string,
  restUris: Uri[],
): Promise<Array<{ denom: string; amount: string }>> => {
  const getBalanceEndpoint = COSMOS_CHAIN_ENDPOINTS.getBalance;
  const fullEndpoint = `${getBalanceEndpoint}${walletAddress}`;

  for (const uri of restUris) {
    const url = `${uri.address}${fullEndpoint}`;
    try {
      const response = await fetch(url);
      const json = await response.json();

      if (response.ok && json.balances) {
        return json.balances;
      }
    } catch (err) {
      console.error(`[FetchWalletAssets] failed to fetch from ${uri.address}`, err);
    }
  }

  throw new Error(`[FetchWalletAssets] all nodes failed for address ${walletAddress}`);
};

export async function fetchWalletAssets(
  walletAddress: string,
  chainID: string,
  subscriptions: SubscriptionRecord,
  chainRegistry: LocalChainRegistry,
  fullChainRegistry: LocalChainRegistry,
): Promise<Asset[]> {
  console.log(
    `[fetchWalletAssets ${chainID}] Starting fetchWalletAssets for address: ${walletAddress}`,
  );

  if (!walletAddress) {
    console.log(`[fetchWalletAssets ${chainID}] No wallet address provided`);
    return [];
  }

  const chainInfo = chainRegistry[chainID];
  if (!chainInfo) {
    console.warn(`[fetchWalletAssets ${chainID}] No chain info found in registry`);
    return [];
  }

  const {
    network_level,
    rest_uris,
    bech32_prefix,
    pretty_name,
    chain_name,
    assets = {},
  } = chainInfo;
  const networkName = pretty_name || chain_name || chainID;

  console.log(`[fetchWalletAssets ${chainID}] Processing chain: ${networkName} (${network_level})`);
  console.log(
    `[fetchWalletAssets ${chainID}] Found ${Object.keys(assets).length} assets in registry`,
  );

  // 1. First fetch all necessary data
  console.log(`[fetchWalletAssets ${chainID}] Fetching balances and prices...`);
  const [rawBalances, coinGeckoPrices] = await Promise.all([
    getBalances(walletAddress, rest_uris || []).then(balances => {
      console.log(`[fetchWalletAssets ${chainID}] Retrieved ${balances.length} raw balances`);
      return balances;
    }),
    (async () => {
      const coinGeckoIds = new Set<string>();
      Object.values(chainRegistry).forEach(chain => {
        Object.values(chain.assets || {}).forEach(asset => {
          if (asset.coinGeckoId) coinGeckoIds.add(asset.coinGeckoId);
        });
      });
      console.log(
        `[fetchWalletAssets ${chainID}] Fetching prices for ${coinGeckoIds.size} CoinGecko IDs`,
      );
      return fetchAssetPrices(Array.from(coinGeckoIds), network_level === NetworkLevel.TESTNET);
    })(),
  ]);

  // 2. Determine subscription status
  const networkSubscriptions = subscriptions[network_level] || {};
  const shouldFetchAllAssets = networkSubscriptions[chainID]?.viewAll || false;
  const thisChainSubscribedDenoms = shouldFetchAllAssets
    ? Object.keys(assets)
    : networkSubscriptions[chainID]?.subscribedDenoms || [];

  console.log(
    `[fetchWalletAssets ${chainID}] Subscription status - viewAll: ${shouldFetchAllAssets}, subscribedDenoms:`,
    thisChainSubscribedDenoms,
  );

  // 3. Process all balances into assets
  console.log(`[fetchWalletAssets ${chainID}] Processing ${rawBalances.length} raw balances...`);
  const processedAssets = await Promise.all(
    rawBalances.map(async ({ denom, amount }) => {
      console.log(`[fetchWalletAssets ${chainID}] Processing denom: ${denom}`);
      let baseDenom = denom;
      let isIbc = false;
      let ibcDenom: string = denom;

      // Handle IBC assets
      if (denom.startsWith(IBC_PREFIX)) {
        console.log(`[fetchWalletAssets ${chainID}] Detected IBC denom: ${denom}`);
        try {
          const { baseDenom: resolvedDenom } = await resolveIbcAsset(
            denom,
            bech32_prefix,
            rest_uris || [],
          );
          baseDenom = resolvedDenom;
          isIbc = true;
          ibcDenom = denom;
          console.log(
            `[fetchWalletAssets ${chainID}] Resolved IBC denom ${denom} to ${resolvedDenom}`,
          );
        } catch (error) {
          console.warn(
            `[fetchWalletAssets ${chainID}] Failed to resolve IBC denom ${denom}:`,
            error,
          );
          if (!shouldFetchAllAssets) return null;
        }
      }

      if (denom.startsWith(GAMM_PREFIX)) {
        baseDenom = denom.replace(GAMM_PREFIX, '');
        isIbc = true;
        ibcDenom = denom;
      }

      // Find matching asset metadata in full chain registry
      const normalizedBaseDenom = safeTrimLowerCase(baseDenom);
      // TODO: remove.  asset metadata doesn't seem to be getting used
      let assetMetadata: Asset | undefined = undefined;

      // Search through all chains in the full registry
      for (const [_, chain] of Object.entries(fullChainRegistry)) {
        if (!chain.assets) continue;

        const found = Object.entries(chain.assets).find(
          ([key, asset]) =>
            safeTrimLowerCase(key) === normalizedBaseDenom ||
            safeTrimLowerCase(asset.denom) === normalizedBaseDenom,
        )?.[1];

        if (found) {
          assetMetadata = found;
          break;
        }
      }

      if (!assetMetadata && !shouldFetchAllAssets) {
        console.log(
          `[fetchWalletAssets ${chainID}] No metadata found for ${baseDenom} and not fetching all assets`,
        );
        return null;
      }

      const isGammToken = denom.startsWith('gamm/pool/');
      const exponent = isGammToken ? GAMM_EXPONENT_DEFAULT : assetMetadata?.exponent || 0;
      const amountAdjusted = adjustAmountByExponent(amount, exponent);
      const price = assetMetadata?.coinGeckoId
        ? coinGeckoPrices[assetMetadata.coinGeckoId] || 0
        : 0;

      console.log(
        `[fetchWalletAssets ${chainID}] Processed asset: ${baseDenom}, amount: ${amountAdjusted}, price: ${price}, isIbc: ${isIbc}`,
      );

      return {
        ...(assetMetadata || {
          denom: baseDenom,
          symbol: baseDenom,
          name: baseDenom,
          exponent,
          logo: '',
          isFeeToken: false,
          coinGeckoId: undefined,
        }),
        amount: amountAdjusted,
        price,
        isIbc,
        ibcDenom,
        networkID: chainID,
        networkName,
      };
    }),
  );

  // 4. Filter down to subscribed assets
  console.log(`[${chainID}] Filtering to subscribed assets...`);
  const subscribedAssets = processedAssets.filter(asset => {
    // Check if this asset matches any subscribed denom (case-insensitive)
    const isSubscribed = thisChainSubscribedDenoms.some(
      denom =>
        safeTrimLowerCase(asset?.denom) === safeTrimLowerCase(denom) ||
        (asset?.isIbc && safeTrimLowerCase(asset.ibcDenom || '') === safeTrimLowerCase(denom)),
    );

    if (!isSubscribed && shouldFetchAllAssets) {
      // If viewAll is true, include all assets from this chain
      return safeTrimLowerCase(asset?.networkID) === safeTrimLowerCase(chainID);
    }

    return isSubscribed;
  }) as Asset[];

  console.log(
    `[fetchWalletAssets ${chainID}] Total subscribed assets:`,
    subscribedAssets.length,
    subscribedAssets,
  );

  return subscribedAssets;
}
