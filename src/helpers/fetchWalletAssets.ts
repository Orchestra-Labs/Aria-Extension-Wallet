import { IBC_PREFIX, COSMOS_CHAIN_ENDPOINTS, NetworkLevel } from '@/constants';
import { Uri, Asset, SubscriptionRecord, LocalChainRegistry } from '@/types';
import { queryRestNode } from './queryNodes';
import { safeTrimLowerCase } from './formatString';
import { getCachedPrices } from './priceCache';

const adjustAmountByExponent = (amount: string, exponent: number): string => {
  const divisor = Math.pow(10, exponent);
  return (parseFloat(amount) / divisor).toFixed(exponent);
};

const fetchCoinGeckoPrices = async (coinGeckoIds: string[]): Promise<Record<string, number>> => {
  if (!coinGeckoIds.length) return {};

  // First check cache for any valid prices
  const cachedPrices = getCachedPrices(coinGeckoIds);

  // Filter out IDs we already have cached
  const idsToFetch = coinGeckoIds.filter(id => !(id in cachedPrices));

  if (!idsToFetch.length) {
    return cachedPrices;
  }

  try {
    const batchSize = 50;
    const priceData: Record<string, number> = { ...cachedPrices };

    for (let i = 0; i < coinGeckoIds.length; i += batchSize) {
      const batch = coinGeckoIds.slice(i, i + batchSize);

      try {
        const controller = new AbortController();
        const timeout = setTimeout(() => controller.abort(), 2000);

        const response = (await Promise.race([
          fetch(
            `https://api.coingecko.com/api/v3/simple/price?ids=${batch.join(',')}&vs_currencies=usd`,
            { signal: controller.signal },
          ),
          new Promise<never>((_, reject) =>
            setTimeout(() => reject(new Error('Request timeout')), 2000),
          ),
        ])) as Response;

        clearTimeout(timeout);

        if (!response.ok) {
          console.error('Failed to fetch prices from CoinGecko');
          continue;
        }

        const data = (await response.json()) as Record<string, { usd: number }>;
        Object.entries(data).forEach(([id, priceInfo]) => {
          priceData[id] = priceInfo.usd;
        });
      } catch (error) {
        console.error('Error fetching CoinGecko prices batch:', error);
        continue;
      }
    }

    return priceData;
  } catch (error) {
    console.error('Error in fetchCoinGeckoPrices:', error);
    return {};
  }
};

const resolveIbcDenom = async (
  ibcDenom: string,
  prefix: string,
  restUris: Uri[],
): Promise<string> => {
  try {
    const denomHash = ibcDenom.slice(4);
    const getIBCInfoEndpoint = COSMOS_CHAIN_ENDPOINTS.getIBCInfo;

    // TODO: could get transfer channel data.  useful for determining chain ID?
    const response = await queryRestNode({
      prefix,
      endpoint: `${getIBCInfoEndpoint}${denomHash}`,
      restUris,
    });
    const denom = response.denom_trace?.base_denom;

    if (!denom) {
      // TODO: show error to user
      throw new Error(`[FetchWalletAssets] Failed to resolve IBC denom: ${ibcDenom}`);
    }

    return denom;
  } catch (error) {
    console.error(`[FetchWalletAssets] Error resolving IBC denom ${ibcDenom}:`, error);
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
): Promise<Asset[]> {
  if (!walletAddress) {
    console.log('[FetchWalletAssets] No wallet address provided');
    return [];
  }

  const chainInfo = chainRegistry[chainID];
  if (!chainInfo) {
    console.warn(`[FetchWalletAssets] No chain info for ${chainID}`);
    return [];
  }

  const networkLevel = chainInfo.network_level;
  const networkID = chainID;
  const networkSubscriptions = subscriptions[networkLevel] || {};
  const thisChainSubscribedDenoms = networkSubscriptions[chainID] || [];

  // Create zero-balance assets for this chain's specific subscriptions
  const subscribedAssets: Asset[] = thisChainSubscribedDenoms
    .map(denom => {
      const metadata = chainInfo.assets?.[denom];
      if (!metadata) {
        console.warn(`[FetchWalletAssets] No metadata for subscribed denom ${denom}`);
        return null;
      }

      return {
        ...metadata,
        amount: '0',
        isIbc: false,
        networkID,
        networkName: chainInfo.pretty_name || chainInfo.chain_name || networkID,
        price: 0,
      };
    })
    .filter((a): a is Asset => a !== null);

  try {
    const prefix = chainInfo.bech32_prefix;
    const restUris = chainInfo.rest_uris;
    const networkName = chainInfo.pretty_name || chainInfo.chain_name || networkID;

    if (!restUris?.length) {
      console.warn(`[FetchWalletAssets] No REST endpoints for ${networkID}`);
      return subscribedAssets;
    }

    const [rawCoins, coinGeckoPrices] = await Promise.all([
      getBalances(walletAddress, restUris),
      (async () => {
        const coinGeckoIds = new Set<string>();

        subscribedAssets.forEach(asset => {
          if (asset.coinGeckoId) {
            coinGeckoIds.add(asset.coinGeckoId);
          }
        });

        Object.values(chainRegistry).forEach(chain => {
          Object.values(chain.assets || {}).forEach(asset => {
            if (asset.coinGeckoId) {
              coinGeckoIds.add(asset.coinGeckoId);
            }
          });
        });

        if (networkLevel === NetworkLevel.TESTNET) {
          return Array.from(coinGeckoIds).reduce(
            (acc, id) => {
              acc[id] = 0;
              return acc;
            },
            {} as Record<string, number>,
          );
        }

        return fetchCoinGeckoPrices(Array.from(coinGeckoIds));
      })(),
    ]);

    const resolvedAssets = await Promise.all(
      rawCoins.map(async coin => {
        let baseDenom = coin.denom;
        let isIbc = false;

        if (coin.denom.startsWith(IBC_PREFIX)) {
          try {
            baseDenom = await resolveIbcDenom(coin.denom, prefix, restUris);
            baseDenom = safeTrimLowerCase(baseDenom);
            isIbc = true;
          } catch (err) {
            console.warn(`[FetchWalletAssets] Failed to resolve IBC denom: ${coin.denom}`, err);
            return null;
          }
        }

        let metadata: Asset | undefined;
        let coinGeckoId: string | undefined;

        // Search through all chains in the registry for matching denom
        for (const chain of Object.values(chainRegistry)) {
          if (!chain.assets) continue;

          for (const [key, asset] of Object.entries(chain.assets)) {
            const normalizedKey = safeTrimLowerCase(key);
            const normalizedDenom = safeTrimLowerCase(asset.denom);

            if (normalizedDenom === baseDenom || normalizedKey === baseDenom) {
              metadata = asset;
              coinGeckoId = asset.coinGeckoId;
              break;
            }
          }

          if (metadata) break;
        }

        if (!metadata) {
          console.warn(`[FetchWalletAssets] No metadata found for ${baseDenom}`);
          return null;
        }

        const amount = adjustAmountByExponent(coin.amount, metadata.exponent);
        const price = coinGeckoId ? coinGeckoPrices[coinGeckoId] || 0 : 0;

        return {
          ...metadata,
          denom: baseDenom,
          amount,
          price,
          isIbc,
          networkID,
          networkName,
        };
      }),
    );

    const validAssets: Asset[] = resolvedAssets.filter((a): a is Asset => a !== null);

    // Create a set of all subscribed denoms across the entire network
    const allNetworkSubscribedDenoms = new Set<string>();
    Object.values(networkSubscriptions).forEach(denoms => {
      denoms.forEach(denom => allNetworkSubscribedDenoms.add(denom));
    });

    // Filter assets based on network-wide subscriptions
    const networkFilteredAssets =
      allNetworkSubscribedDenoms.size > 0
        ? validAssets.filter(asset => allNetworkSubscribedDenoms.has(asset.denom))
        : validAssets;

    // Add zero balances for this chain's specific subscriptions
    const zeroBalancesToAdd =
      thisChainSubscribedDenoms.length > 0
        ? subscribedAssets
            .filter(
              subAsset => !networkFilteredAssets.some(asset => asset.denom === subAsset.denom),
            )
            .map(asset => ({
              ...asset,
              price: asset.coinGeckoId ? coinGeckoPrices[asset.coinGeckoId] || 0 : 0,
            }))
        : [];

    return [...networkFilteredAssets, ...zeroBalancesToAdd];
  } catch (error) {
    console.error(`[FetchWalletAssets] Error for ${networkID}:`, error);
    return subscribedAssets;
  }
}
