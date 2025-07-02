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
  restUris: Uri[],
): Promise<{ denom: string; symbol: string; logo?: string; exponent: number }> => {
  try {
    const denomHash = ibcDenom.slice(4); // Remove the "ibc/" prefix
    const getIBCInfoEndpoint = COSMOS_CHAIN_ENDPOINTS.getIBCInfo;

    const response = await queryRestNode({
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

const getBalances = async (walletAddress: string, restUris: Uri[]): Promise<Asset[]> => {
  const getBalanceEndpoint = COSMOS_CHAIN_ENDPOINTS.getBalance;

  // Use queryNode to try querying balances across nodes
  const response = await queryRestNode({
    endpoint: `${getBalanceEndpoint}${walletAddress}`,
    restUris,
  });

  if (!response.balances) {
    // TODO: show error to user
    throw new Error(`Failed to fetch balances for address: ${walletAddress}`);
  }

  return response.balances;
};

export async function fetchWalletAssets(
  walletAddress: string,
  networkID: string,
  coinDenoms: string[],
  chainRegistry: Record<string, SimplifiedChainInfo>,
): Promise<Asset[]> {
  if (!walletAddress) return [];

  try {
    const chainInfo = chainRegistry[networkID];
    if (!chainInfo) return [];

    const restUris = chainInfo.rest_uris;
    console.log(
      `[fetchWalletAssets] rest uris for ${networkID} from chain registry are: ${JSON.stringify(restUris)}`,
    );
    if (!restUris) {
      console.warn(`No REST endpoint found for ${networkID}`);
      return [];
    }

    const coins: Asset[] = await getBalances(walletAddress, restUris);

    const networkName = chainInfo.pretty_name || chainInfo.chain_name || networkID;
    const chainAssets = chainInfo.assets;

    // Filter assets if coinDenoms is not empty, otherwise include all
    const filteredCoins =
      coinDenoms.length > 0 ? coins.filter(coin => coinDenoms.includes(coin.denom)) : coins;

    // Map through the balances and resolve their properties
    const walletAssets = await Promise.all(
      filteredCoins.map(async (coin: Asset) => {
        const registryAsset = chainAssets?.[coin.denom];
        if (!registryAsset) return null;

        if (coin.denom.startsWith(IBC_PREFIX)) {
          try {
            const {
              denom: resolvedDenom,
              symbol: resolvedSymbol,
              logo: resolvedLogo,
              exponent: resolvedExponent,
            } = await resolveIbcDenom(coin.denom, chainAssets, restUris);

            return {
              ...coin,
              denom: resolvedDenom,
              symbol: resolvedSymbol,
              logo: resolvedLogo,
              exponent: resolvedExponent,
              amount: adjustAmountByExponent(coin.amount, resolvedExponent),
              isIbc: true,
              networkID,
              networkName,
            };
          } catch {
            return null;
          }
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
      }),
    );

    return walletAssets.filter((a): a is Asset => a !== null);
  } catch (error) {
    console.error('Error fetching wallet assets:', error);
    return [];
  }
}
