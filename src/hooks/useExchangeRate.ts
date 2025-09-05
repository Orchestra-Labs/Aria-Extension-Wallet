import { useQuery } from '@tanstack/react-query';
import BigNumber from 'bignumber.js';
import { useAtomValue } from 'jotai';
import { useMemo } from 'react';

import {
  SYMPHONY_ENDPOINTS,
  GREATER_EXPONENT_DEFAULT,
  QueryType,
  SYMPHONY_MAINNET_ASSET_REGISTRY,
} from '@/constants';
import {
  receiveStateAtom,
  sendStateAtom,
  networkLevelAtom,
  chainInfoAtom,
  isValidStablecoinSwapAtom,
} from '@/atoms';
import { getSymphonyChainId, queryRestNode } from '@/helpers';

export function useExchangeRate() {
  const sendState = useAtomValue(sendStateAtom);
  const receiveState = useAtomValue(receiveStateAtom);
  const networkLevel = useAtomValue(networkLevelAtom);
  const isValidStablecoinSwap = useAtomValue(isValidStablecoinSwapAtom);
  const getChainInfo = useAtomValue(chainInfoAtom);

  // Safely get chain info with fallback to DEFAULT_CHAIN_ID
  const symphonyChainId = getSymphonyChainId(networkLevel);

  const chainInfo = getChainInfo(symphonyChainId);
  const prefix = chainInfo?.bech32_prefix || '';
  const restUris = chainInfo?.rest_uris || [];

  const sendAsset = sendState.asset;
  const receiveAsset = receiveState.asset;
  const sendDenom = sendAsset.originDenom || sendAsset.denom;
  const receiveDenom = receiveAsset.originDenom || receiveAsset.denom;

  const queryExchangeRate = useQuery<string | null, Error, string | null>({
    queryKey: ['exchangeRate', sendDenom, receiveDenom],
    queryFn: async ({ queryKey }): Promise<string | null> => {
      const [, sendAsset, receiveAsset] = queryKey as [string, string, string];
      if (!sendAsset || !receiveAsset) return null;
      if (sendAsset === receiveAsset) {
        return '1';
      }

      // TODO: get exponent from the asset itself
      // Format the offer amount to the smallest unit
      const exponent = SYMPHONY_MAINNET_ASSET_REGISTRY[sendAsset].exponent;
      const formattedOfferAmount = (1 * Math.pow(10, exponent)).toFixed(0);

      if (!restUris.length) {
        throw new Error(`No REST endpoints available for chain ${sendState.chainId}`);
      }

      // Use queryRestNode to query exchange rates
      const response = await queryRestNode({
        endpoint: `${SYMPHONY_ENDPOINTS.swap}offerCoin=${formattedOfferAmount}${sendAsset}&askDenom=${receiveAsset}`,
        queryType: QueryType.GET,
        prefix,
        restUris,
        chainId: symphonyChainId,
      });

      if (!response?.return_coin?.amount) {
        throw new Error('Invalid response from swap endpoint');
      }

      const returnExchange = (response.return_coin.amount / Math.pow(10, exponent)).toFixed(
        GREATER_EXPONENT_DEFAULT,
      );

      return returnExchange;
    },
    enabled: isValidStablecoinSwap && !!sendDenom && !!receiveDenom && !!chainInfo,
    staleTime: 30000, // Consider the data stale after 30 seconds
    refetchInterval: 60000, // Refetch every 60 seconds
  });

  const exchangeRate = useMemo(() => {
    if (!isValidStablecoinSwap) {
      return 1;
    }
    if (queryExchangeRate.data) {
      return new BigNumber(queryExchangeRate.data).toNumber();
    }
    return 0;
  }, [queryExchangeRate.data, isValidStablecoinSwap]);

  return {
    isLoading: queryExchangeRate.isLoading,
    error: queryExchangeRate.error,
    exchangeRate,
  };
}
