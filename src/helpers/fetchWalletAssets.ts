import { IBC_PREFIX, COSMOS_CHAIN_ENDPOINTS } from '@/constants';
import { Uri, Asset, SimplifiedChainInfo } from '@/types';
import { queryRestNode } from './queryNodes';

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

    const response = await queryRestNode({
      prefix,
      endpoint: `${getIBCInfoEndpoint}${denomHash}`,
      restUris,
    });
    const denom = response.denom_trace?.base_denom;

    if (!denom) {
      // TODO: show error to user
      throw new Error(`Failed to resolve IBC denom: ${ibcDenom}`);
    }

    return denom;
  } catch (error) {
    console.error(`Error resolving IBC denom ${ibcDenom}:`, error);
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

  console.log(`[fetchWalletAssets] wallet: ${walletAddress}`);
  console.log(`[fetchWalletAssets] full endpoint: ${fullEndpoint}`);
  console.log(`[fetchWalletAssets] prefix: ${prefix}`);
  console.log(`[fetchWalletAssets] nodes to try:`, restUris);

  for (const uri of restUris) {
    const url = `${uri.address}${fullEndpoint}`;
    try {
      console.log(`[fetchWalletAssets] trying: ${url}`);
      const response = await fetch(url);
      const json = await response.json();

      console.log(`[fetchWalletAssets] response status: ${response.status}`);
      console.log(`[fetchWalletAssets] response body:`, json);

      if (response.ok && json.balances) {
        return json.balances;
      }

      console.warn(`[fetchWalletAssets] no balances from: ${uri.address}`);
    } catch (err) {
      console.error(`[fetchWalletAssets] failed to fetch from ${uri.address}`, err);
    }
  }

  throw new Error(`[fetchWalletAssets] all nodes failed for address ${walletAddress}`);
};

export async function fetchWalletAssets(
  walletAddress: string,
  networkID: string,
  subscribedDenoms: string[],
  chainRegistry: Record<string, SimplifiedChainInfo>,
): Promise<Asset[]> {
  if (!walletAddress) {
    console.log('[fetchWalletAssets] No wallet address provided');
    return [];
  }

  try {
    const chainInfo = chainRegistry[networkID];
    if (!chainInfo) {
      console.warn(`[fetchWalletAssets] No chain info for ${networkID}`);
      return [];
    }

    console.log(`[fetchWalletAssets] Processing ${networkID} (${chainInfo.network_level})`);
    console.log(`[fetchWalletAssets] Chain info:`, chainInfo);

    const prefix = chainInfo.bech32_prefix;
    const restUris = chainInfo.rest_uris;
    const networkName = chainInfo.pretty_name || chainInfo.chain_name || networkID;

    if (!restUris?.length) {
      console.warn(`[fetchWalletAssets] No REST endpoints for ${networkID}`);
      return [];
    }

    console.log(`[fetchWalletAssets] Fetching balances for ${walletAddress} on ${networkID}`);
    const rawCoins: Asset[] = await getBalances(walletAddress, prefix, restUris);
    console.log(`[fetchWalletAssets] Raw balances for ${networkID}:`, rawCoins);

    const resolvedAssets = await Promise.all(
      rawCoins.map(async coin => {
        let baseDenom = coin.denom;
        let isIbc = false;

        if (coin.denom.startsWith(IBC_PREFIX)) {
          try {
            baseDenom = await resolveIbcDenom(coin.denom, prefix, restUris);
            isIbc = true;
          } catch (err) {
            console.warn(`Could not resolve IBC denom ${coin.denom}, skipping`);
            return null;
          }
        }

        // Search all chain registries for the native asset metadata
        let metadata: Asset | undefined;
        for (const chain of Object.values(chainRegistry)) {
          metadata = chain.assets?.[baseDenom];
          if (metadata) break;
        }

        if (!metadata) {
          console.warn(`[fetchWalletAssets] No metadata for base denom ${baseDenom}`);
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
    console.log(`[fetchWalletAssets] Resolved assets for ${networkID}:`, validAssets);

    const filteredAssets = subscribedDenoms.length
      ? validAssets.filter(asset => subscribedDenoms.includes(asset.denom))
      : validAssets;
    console.log(`[fetchWalletAssets] Filtered assets for ${networkID}:`, filteredAssets);

    return filteredAssets;
  } catch (error) {
    console.error(`[fetchWalletAssets] Error for ${networkID}:`, error);
    return [];
  }
}
