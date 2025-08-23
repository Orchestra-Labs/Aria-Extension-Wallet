import {
  IBC_PREFIX,
  COSMOS_CHAIN_ENDPOINTS,
  NetworkLevel,
  GAMM_PREFIX,
  GAMM_EXPONENT_DEFAULT,
} from '@/constants';
import { Uri, Asset, SubscriptionRecord, LocalChainRegistry, IbcRegistry } from '@/types';
import { queryRestNode } from './queryNodes';
import { safeTrimLowerCase } from './formatString';
import { getCachedPrices } from './priceCache';
import { getIbcRegistry } from './dataHelpers';

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

const resolveIbcAsset = async (
  ibcDenom: string,
  prefix: string,
  restUris: Uri[],
  currentChainId: string,
  chainRegistry: LocalChainRegistry,
): Promise<{
  baseDenom: string;
  path: string;
  originChainId: string;
}> => {
  try {
    const denomHash = ibcDenom.slice(4);
    const response = await queryRestNode({
      prefix,
      endpoint: `${COSMOS_CHAIN_ENDPOINTS.getIBCInfo}${denomHash}`,
      restUris,
      chainId: currentChainId,
    });

    if (!response.denom_trace?.base_denom) {
      throw new Error(`No denom trace found for ${ibcDenom}`);
    }

    const baseDenom = safeTrimLowerCase(response.denom_trace.base_denom);
    const path = response.denom_trace.path || '';
    let originChainId = '';

    // Extract channel ID from path (format: "transfer/channel-X")
    const pathParts = path.split('/');
    if (pathParts.length >= 2) {
      const channelId = pathParts[1];
      const ibcRegistry = getIbcRegistry();
      const networkLevel = chainRegistry[currentChainId].network_level;

      // Get the correct network registry (mainnet or testnet)
      const networkRegistry =
        networkLevel === NetworkLevel.TESTNET ? ibcRegistry.data.testnet : ibcRegistry.data.mainnet;

      if (!networkRegistry) {
        throw new Error(`No IBC registry found for network level: ${networkLevel}`);
      }

      // Properly typed iteration through IBC registry entries
      for (const [connectionKey, connection] of Object.entries(networkRegistry as IbcRegistry)) {
        // Check if this connection involves our current chain
        if (connectionKey.includes(currentChainId)) {
          const [chain1, chain2] = connectionKey.split(',');
          const isCurrentChainFirst = chain1 === currentChainId;

          // Get the channel info for current chain specifically
          const currentChainIBCInfo = connection[currentChainId];

          // Only proceed if the channel ID matches current chain's channel
          if (currentChainIBCInfo?.channel_id === channelId) {
            // The counterparty is the other chain in this connection
            originChainId = isCurrentChainFirst ? chain2 : chain1;
            break;
          }
        }
      }
    }

    // TODO: handle multi-hop paths.  add all to list and use that list with tx router
    // Fallback: If not found, check if this is a multihop IBC transfer
    if (!originChainId && path.includes('/transfer/')) {
      // For multihop transfers, the origin chain might be earlier in the path
      // Example: "transfer/channel-1/transfer/channel-2/denom"
      const hops = path.split('/transfer/');
      if (hops.length > 2) {
        // This is a multihop transfer - we'd need more complex logic to trace
        console.warn(`Multihop IBC transfer detected for ${ibcDenom}, path: ${path}`);
      }
    }

    return {
      baseDenom,
      path,
      originChainId,
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
  chainId: string,
  subscriptions: SubscriptionRecord,
  chainRegistry: LocalChainRegistry,
  fullChainRegistry: LocalChainRegistry,
): Promise<Asset[]> {
  console.log(
    `[fetchWalletAssets ${chainId}] Starting fetchWalletAssets for address: ${walletAddress}`,
  );

  if (!walletAddress) {
    console.log(`[fetchWalletAssets ${chainId}] No wallet address provided`);
    return [];
  }

  const chainInfo = chainRegistry[chainId];
  if (!chainInfo) {
    console.warn(`[fetchWalletAssets ${chainId}] No chain info found in registry`);
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
  const networkName = pretty_name || chain_name || chainId;

  console.log(`[fetchWalletAssets ${chainId}] Processing chain: ${networkName} (${network_level})`);
  console.log(
    `[fetchWalletAssets ${chainId}] Found ${Object.keys(assets).length} assets in registry`,
  );

  // 1. First fetch all necessary data
  console.log(`[fetchWalletAssets ${chainId}] Fetching balances and prices...`);
  const [rawBalances, coinGeckoPrices] = await Promise.all([
    getBalances(walletAddress, rest_uris || []).then(balances => {
      console.log(`[fetchWalletAssets ${chainId}] Retrieved ${balances.length} raw balances`);
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
        `[fetchWalletAssets ${chainId}] Fetching prices for ${coinGeckoIds.size} CoinGecko Ids`,
      );
      return fetchAssetPrices(Array.from(coinGeckoIds), network_level === NetworkLevel.TESTNET);
    })(),
  ]);

  // 2. Determine subscription status
  const networkSubscriptions = subscriptions[network_level] || {};
  const shouldFetchAllAssets = networkSubscriptions[chainId]?.viewAll || false;
  const thisChainSubscribedDenoms = shouldFetchAllAssets
    ? Object.keys(assets)
    : networkSubscriptions[chainId]?.subscribedDenoms || [];

  console.log(
    `[fetchWalletAssets ${chainId}] Subscription status - viewAll: ${shouldFetchAllAssets}, subscribedDenoms:`,
    thisChainSubscribedDenoms,
  );

  // 3. Process all balances into assets
  console.log(`[fetchWalletAssets ${chainId}] Processing ${rawBalances.length} raw balances...`);
  const processedAssets = await Promise.all(
    rawBalances.map(async ({ denom, amount }) => {
      console.log(`[fetchWalletAssets ${chainId}] Processing denom: ${denom}`);
      let baseDenom = denom;
      let isIbc = false;
      let originDenom = denom;
      let originChainId = chainId;
      let trace = '';

      // Handle IBC assets
      if (denom.startsWith(IBC_PREFIX)) {
        console.log(`[fetchWalletAssets ${chainId}] Detected IBC denom: ${denom}`);
        try {
          const {
            baseDenom: resolvedDenom,
            path,
            originChainId: resolvedOriginChainId,
          } = await resolveIbcAsset(
            denom,
            bech32_prefix,
            rest_uris || [],
            chainId,
            fullChainRegistry,
          );
          baseDenom = denom;
          isIbc = true;
          originDenom = resolvedDenom;
          originChainId = resolvedOriginChainId || '';
          trace = path;
          console.log(
            `[fetchWalletAssets ${chainId}] Resolved IBC denom ${denom} to ${resolvedDenom} from chain ${originChainId}`,
          );
        } catch (error) {
          console.warn(
            `[fetchWalletAssets ${chainId}] Failed to resolve IBC denom ${denom}:`,
            error,
          );
          if (!shouldFetchAllAssets) return null;
        }
      }

      if (denom.startsWith(GAMM_PREFIX)) {
        baseDenom = denom.replace(GAMM_PREFIX, '');
        isIbc = true;
        originDenom = denom;
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
            safeTrimLowerCase(asset.originDenom || asset.denom) === normalizedBaseDenom,
        )?.[1];

        if (found) {
          assetMetadata = found;
          break;
        }
      }

      if (!assetMetadata && !shouldFetchAllAssets) {
        console.log(
          `[fetchWalletAssets ${chainId}] No metadata found for ${baseDenom} and not fetching all assets`,
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
        `[fetchWalletAssets ${chainId}] Processed asset: ${baseDenom}, amount: ${amountAdjusted}, price: ${price}, isIbc: ${isIbc}`,
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
        chainId: chainId,
        networkName,
        originDenom,
        originChainId,
        trace,
      };
    }),
  );

  // 4. Filter down to subscribed assets
  console.log(`[${chainId}] Filtering to subscribed assets...`);
  const subscribedAssets = processedAssets.filter(asset => {
    // Check if this asset matches any subscribed denom (case-insensitive)
    const isSubscribed = thisChainSubscribedDenoms.some(
      denom => safeTrimLowerCase(asset?.originDenom) === safeTrimLowerCase(denom),
    );

    if (!isSubscribed && shouldFetchAllAssets) {
      // If viewAll is true, include all assets from this chain
      return safeTrimLowerCase(asset?.chainId) === safeTrimLowerCase(chainId);
    }

    return isSubscribed;
  }) as Asset[];

  console.log(
    `[fetchWalletAssets ${chainId}] Total subscribed assets:`,
    subscribedAssets.length,
    subscribedAssets,
  );

  return subscribedAssets;
}
