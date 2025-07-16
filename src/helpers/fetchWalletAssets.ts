import {
  CHAIN_ENDPOINTS,
  GREATER_EXPONENT_DEFAULT,
  IBC_PREFIX,
  LOCAL_ASSET_REGISTRY,
  LOCAL_CHAIN_REGISTRY,
} from '@/constants';
import { Asset, SubscriptionRecord } from '@/types';

import { queryRestNode } from './queryNodes';

const adjustAmountByExponent = (amount: string, exponent: number): string => {
  const divisor = Math.pow(10, exponent);
  return (parseFloat(amount) / divisor).toFixed(exponent);
};

const resolveIbcDenom = async (
  ibcDenom: string,
): Promise<{ denom: string; symbol: string; logo?: string; exponent: number }> => {
  try {
    const denomHash = ibcDenom.slice(4); // Remove the "ibc/" prefix
    const getIBCInfoEndpoint = CHAIN_ENDPOINTS.getIBCInfo;

    const response = await queryRestNode({ endpoint: `${getIBCInfoEndpoint}${denomHash}` });
    const baseDenom = response.denom_trace?.base_denom;

    if (!baseDenom) {
      // TODO: show error to user
      throw new Error(`Failed to resolve IBC denom: ${ibcDenom}`);
    }

    // TODO: use exchange assets for base denom information
    const registryAsset = LOCAL_ASSET_REGISTRY[baseDenom] || null;
    let symbol: string;
    let logo: string | undefined;
    let exponent: number;

    if (registryAsset) {
      symbol = registryAsset.symbol ?? baseDenom;
      logo = registryAsset.logo;
      exponent = registryAsset.exponent ?? GREATER_EXPONENT_DEFAULT;
    } else {
      symbol = baseDenom;
      logo = undefined;
      exponent = GREATER_EXPONENT_DEFAULT;
    }

    return { denom: baseDenom, symbol, logo, exponent };
  } catch (error) {
    console.error(`Error resolving IBC denom ${ibcDenom}:`, error);
    throw error;
  }
};

const getBalances = async (walletAddress: string): Promise<Asset[]> => {
  const getBalanceEndpoint = CHAIN_ENDPOINTS.getBalance;

  // Use queryNode to try querying balances across nodes
  const response = await queryRestNode({ endpoint: `${getBalanceEndpoint}${walletAddress}` });

  if (!response.balances) {
    // TODO: show error to user
    throw new Error(`Failed to fetch balances for address: ${walletAddress}`);
  }

  return response.balances;
};

export async function fetchWalletAssets(
  walletAddress: string,
  networkID: string,
  subscription: SubscriptionRecord,
): Promise<Asset[]> {
  if (!walletAddress) {
    console.error('No wallet address available in walletState!');
    return [];
  }

  try {
    const coins: Asset[] = await getBalances(walletAddress);

    const coinDenoms: string[] = subscription.coinDenoms || [];
    const networkName = LOCAL_CHAIN_REGISTRY[networkID]?.chainName || 'Unknown Network';

    // Filter assets if coinDenoms is not empty, otherwise include all
    const filteredCoins =
      coinDenoms.length > 0 ? coins.filter(coin => coinDenoms.includes(coin.denom)) : coins;

    // Map through the balances and resolve their properties
    const walletAssets = await Promise.all(
      filteredCoins.map(async (coin: Asset) => {
        let symbol: string;
        let logo: string | undefined;
        let exponent: number;

        const registryAsset = LOCAL_ASSET_REGISTRY[coin.denom] || null;

        if (!registryAsset) {
          const denom = coin.denom;
          symbol = `H${denom.startsWith('u') ? denom.slice(1) : denom}`.toUpperCase();
          exponent = GREATER_EXPONENT_DEFAULT;
          logo = undefined;
        } else {
          symbol = registryAsset.symbol ?? coin.denom;
          exponent = registryAsset.exponent ?? GREATER_EXPONENT_DEFAULT;
          logo = registryAsset.logo;
        }

        // Adjust the coin amount by the exponent (shift decimal)
        const adjustedAmount = adjustAmountByExponent(coin.amount, exponent);

        if (coin.denom.startsWith(IBC_PREFIX)) {
          // Resolve IBC denom details
          const {
            denom: resolvedDenom,
            symbol: resolvedSymbol,
            logo: resolvedLogo,
            exponent: resolvedExponent,
          } = await resolveIbcDenom(coin.denom);

          // Adjust the amount based on the resolved exponent
          const resolvedAmount = adjustAmountByExponent(coin.amount, resolvedExponent);

          return {
            ...coin,
            denom: resolvedDenom,
            symbol: resolvedSymbol,
            logo: resolvedLogo,
            exponent: resolvedExponent,
            amount: resolvedAmount,
            isIbc: true,
            networkName,
            networkID,
          };
        }

        return {
          ...coin,
          symbol,
          logo,
          exponent,
          amount: adjustedAmount,
          isIbc: false,
          networkName,
          networkID,
        };
      }),
    );

    return walletAssets;
  } catch (error) {
    console.error('Error fetching wallet assets:', error);
    return [];
  }
}
