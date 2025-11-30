import { IBC_PREFIX, COSMOS_CHAIN_ENDPOINTS, NetworkLevel } from '@/constants';
import { Uri, Asset, SubscriptionRecord, LocalChainRegistry } from '@/types';
import { safeTrimLowerCase } from './formatString';
import { getCachedPrices } from './priceCache';
import { createAssetWithOriginInfo, resolveAndCreateIbcAsset } from './assetResolution';

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

export const getBalances = async (
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

  // 1. First fetch balance and price data
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

  // 3. Process all balances into assets using Standardized Asset Resolution
  console.log(`[fetchWalletAssets ${chainId}] Processing ${rawBalances.length} raw balances...`);

  const processedAssets = await Promise.all(
    rawBalances.map(async ({ denom, amount }) => {
      try {
        // Handle IBC assets
        if (denom.startsWith(IBC_PREFIX)) {
          console.log(`[fetchWalletAssets ${chainId}] Detected IBC denom: ${denom}`);
          const asset = await resolveAndCreateIbcAsset(
            denom,
            chainId,
            bech32_prefix,
            rest_uris || [],
            fullChainRegistry,
            networkName,
            amount,
          );

          // Update price if we have CoinGecko data
          if (asset.coinGeckoId && coinGeckoPrices[asset.coinGeckoId]) {
            asset.price = coinGeckoPrices[asset.coinGeckoId];
          }

          // Check subscription (respect shouldFetchAllAssets)
          const isSubscribed =
            shouldFetchAllAssets ||
            thisChainSubscribedDenoms.some(
              subDenom => safeTrimLowerCase(asset.originDenom) === safeTrimLowerCase(subDenom),
            );

          return isSubscribed ? asset : null;
        }

        // Handle non-IBC assets (Native, GAMM, Factory)
        const asset = createAssetWithOriginInfo(
          denom,
          chainId,
          fullChainRegistry,
          networkName,
          amount,
          false, // isIbc
        );

        // Update price if we have CoinGecko data
        if (asset.coinGeckoId && coinGeckoPrices[asset.coinGeckoId]) {
          asset.price = coinGeckoPrices[asset.coinGeckoId];
        }

        // Check subscription
        const isSubscribed =
          shouldFetchAllAssets ||
          thisChainSubscribedDenoms.some(
            subDenom => safeTrimLowerCase(asset.originDenom) === safeTrimLowerCase(subDenom),
          );

        return isSubscribed ? asset : null;
      } catch (error) {
        console.warn(`[fetchWalletAssets ${chainId}] Failed to process asset ${denom}:`, error);
        // Only include failed assets if viewAll is enabled
        return shouldFetchAllAssets || null;
      }
    }),
  );

  // 4. Filter out nulls and return subscribed assets
  const subscribedAssets = processedAssets.filter((asset): asset is Asset => asset !== null);

  console.log(
    `[fetchWalletAssets ${chainId}] Total subscribed assets: ${subscribedAssets.length}`,
    subscribedAssets,
  );

  return subscribedAssets;
}
