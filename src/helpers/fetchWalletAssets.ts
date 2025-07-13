import { IBC_PREFIX, COSMOS_CHAIN_ENDPOINTS } from '@/constants';
import { Uri, Asset, SubscriptionRecord, LocalChainRegistry } from '@/types';
import { queryRestNode } from './queryNodes';
import { safeTrimLowerCase } from './formatString';

const adjustAmountByExponent = (amount: string, exponent: number): string => {
  const divisor = Math.pow(10, exponent);
  return (parseFloat(amount) / divisor).toFixed(exponent);
};

const resolveIbcDenom = async (
  ibcDenom: string,
  prefix: string,
  restUris: Uri[],
): Promise<string> => {
  try {
    const denomHash = ibcDenom.slice(4); // Remove the "ibc/" prefix
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
  prefix: string,
  restUris: Uri[],
): Promise<Asset[]> => {
  const getBalanceEndpoint = COSMOS_CHAIN_ENDPOINTS.getBalance;
  const fullEndpoint = `${getBalanceEndpoint}${walletAddress}`;

  console.log(`[FetchWalletAssets] wallet: ${walletAddress}`);
  console.log(`[FetchWalletAssets] full endpoint: ${fullEndpoint}`);
  console.log(`[FetchWalletAssets] prefix: ${prefix}`);
  console.log(`[FetchWalletAssets] nodes to try:`, restUris);

  for (const uri of restUris) {
    const url = `${uri.address}${fullEndpoint}`;
    try {
      console.log(`[FetchWalletAssets] trying: ${url}`);
      const response = await fetch(url);
      const json = await response.json();

      console.log(`[FetchWalletAssets] response status: ${response.status}`);
      console.log(`[FetchWalletAssets] response body:`, json);

      if (response.ok && json.balances) {
        return json.balances;
      }

      console.warn(`[FetchWalletAssets] no balances from: ${uri.address}`);
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

  console.log(`[FetchWalletAssets] Processing ${networkID} (${networkLevel})`);
  console.log(`[FetchWalletAssets] Chain info:`, chainInfo);

  console.log(`[FetchWalletAssets] Network Subscriptions:`, networkSubscriptions);
  console.log(`[FetchWalletAssets] Subscribed denoms for ${chainID}:`, thisChainSubscribedDenoms);
  // Create zero-balance assets for this chain's specific subscriptions
  const subscribedAssets = thisChainSubscribedDenoms
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

    console.log(`[FetchWalletAssets] Fetching balances for ${walletAddress} on ${networkID}`);
    const rawCoins: Asset[] = await getBalances(walletAddress, prefix, restUris);
    console.log(`[FetchWalletAssets] Raw balances for ${networkID}:`, rawCoins);

    const resolvedAssets = await Promise.all(
      rawCoins.map(async coin => {
        let baseDenom = coin.denom;
        let isIbc = false;

        console.log(`[FetchWalletAssets] Raw coin:`, coin);

        if (coin.denom.startsWith(IBC_PREFIX)) {
          console.log(`[FetchWalletAssets] Resolving IBC denom ${coin.denom}`);
          try {
            baseDenom = await resolveIbcDenom(coin.denom, prefix, restUris);
            baseDenom = safeTrimLowerCase(baseDenom);
            isIbc = true;
            console.log(`[FetchWalletAssets] Resolved IBC denom to base denom: ${baseDenom}`);
          } catch (err) {
            console.warn(`[FetchWalletAssets] Failed to resolve IBC denom: ${coin.denom}`, err);
            return null;
          }
        }

        console.log(`[FetchWalletAssets] Searching for metadata for ${baseDenom}`);
        let metadata: Asset | undefined;

        // Search through all chains in the registry for matching denom
        for (const [chainId, chain] of Object.entries(chainRegistry)) {
          if (!chain.assets) continue;

          for (const [key, asset] of Object.entries(chain.assets)) {
            const normalizedKey = safeTrimLowerCase(key);
            const normalizedDenom = safeTrimLowerCase(asset.denom);

            if (normalizedDenom === baseDenom || normalizedKey === baseDenom) {
              metadata = asset;
              console.log(
                `[FetchWalletAssets] Found match in ${chainId} (matched ${
                  normalizedDenom === baseDenom ? 'denom' : 'key'
                }: ${key})`,
              );
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
        return {
          denom: baseDenom,
          symbol: metadata.symbol,
          logo: metadata.logo,
          exponent: metadata.exponent,
          amount,
          isIbc,
          networkID,
          networkName,
        };
      }),
    );

    const validAssets = resolvedAssets.filter((a): a is Asset => a !== null);
    console.log(`[FetchWalletAssets] Valid assets before filtering:`, validAssets);

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
        ? subscribedAssets.filter(
            subAsset => !networkFilteredAssets.some(asset => asset.denom === subAsset.denom),
          )
        : [];

    const finalAssets = [...networkFilteredAssets, ...zeroBalancesToAdd];
    console.log(`[FetchWalletAssets] Final assets for ${networkID}:`, finalAssets);
    return finalAssets;
  } catch (error) {
    console.error(`[FetchWalletAssets] Error for ${networkID}:`, error);
    return subscribedAssets;
  }
}
