import { IBC_PREFIX, COSMOS_CHAIN_ENDPOINTS } from '@/constants';
import { Uri, Asset, SimplifiedChainInfo } from '@/types';
import { queryRestNode } from './queryNodes';

const adjustAmountByExponent = (amount: string, exponent: number): string => {
  const divisor = Math.pow(10, exponent);
  return (parseFloat(amount) / divisor).toFixed(exponent);
};

const resolveIbcDenom = async (
  ibcDenom: string,
  chainAssets: Record<string, any> | undefined,
  prefix: string,
  restUris: Uri[],
): Promise<{ denom: string; symbol: string; logo?: string; exponent: number }> => {
  try {
    const denomHash = ibcDenom.slice(4); // Remove the "ibc/" prefix
    const getIBCInfoEndpoint = COSMOS_CHAIN_ENDPOINTS.getIBCInfo;

    const response = await queryRestNode({
      prefix,
      endpoint: `${getIBCInfoEndpoint}${denomHash}`,
      restUris,
    });
    const baseDenom = response.denom_trace?.base_denom;

    if (!baseDenom) {
      // TODO: show error to user
      throw new Error(`Failed to resolve IBC denom: ${ibcDenom}`);
    }

    const registryAsset = chainAssets?.[baseDenom];
    if (!registryAsset) return Promise.reject(null);

    return {
      denom: baseDenom,
      symbol: registryAsset.symbol,
      logo: registryAsset.logo,
      exponent: registryAsset.exponent,
    };
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
  coinDenoms: string[],
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

    if (!restUris || restUris.length === 0) {
      console.warn(`[fetchWalletAssets] No REST endpoints for ${networkID}`);
      return [];
    }

    console.log(`[fetchWalletAssets] Fetching balances for ${walletAddress} on ${networkID}`);
    const coins: Asset[] = await getBalances(walletAddress, prefix, restUris);
    console.log(`[fetchWalletAssets] Raw balances for ${networkID}:`, coins);

    const networkName = chainInfo.pretty_name || chainInfo.chain_name || networkID;
    const chainAssets = chainInfo.assets;
    console.log(`[fetchWalletAssets] Available assets for ${networkID}:`, chainAssets);

    // Filter and process assets
    const filteredCoins =
      coinDenoms.length > 0 ? coins.filter(coin => coinDenoms.includes(coin.denom)) : coins;

    const walletAssets = await Promise.all(
      filteredCoins.map(async (coin: Asset) => {
        try {
          const registryAsset = chainAssets?.[coin.denom];
          if (!registryAsset) {
            console.warn(`[fetchWalletAssets] No registry asset for ${coin.denom} on ${networkID}`);
            return null;
          }

          if (coin.denom.startsWith(IBC_PREFIX)) {
            const resolved = await resolveIbcDenom(coin.denom, chainAssets, prefix, restUris);
            return {
              ...coin,
              ...resolved,
              amount: adjustAmountByExponent(coin.amount, resolved.exponent),
              isIbc: true,
              networkID,
              networkName,
            };
          }

          return {
            ...coin,
            symbol: registryAsset.symbol,
            logo: registryAsset.logo,
            exponent: registryAsset.exponent,
            amount: adjustAmountByExponent(coin.amount, registryAsset.exponent),
            isIbc: false,
            networkID,
            networkName,
          };
        } catch (error) {
          console.error(`[fetchWalletAssets] Error processing ${coin.denom}:`, error);
          return null;
        }
      }),
    );

    const validAssets = walletAssets.filter((a): a is Asset => a !== null);
    console.log(`[fetchWalletAssets] Final assets for ${networkID}:`, validAssets);
    return validAssets;
  } catch (error) {
    console.error(`[fetchWalletAssets] Error for ${networkID}:`, error);
    return [];
  }
}
