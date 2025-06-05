import { useQuery } from '@tanstack/react-query';
import BigNumber from 'bignumber.js';
import { useAtomValue } from 'jotai';
import { useMemo } from 'react';

import { CHAIN_ENDPOINTS, GREATER_EXPONENT_DEFAULT, LOCAL_ASSET_REGISTRY } from '@/constants';
import { receiveStateAtom, sendStateAtom } from '@/atoms';
import { isValidSwap, queryRestNode } from '@/helpers';
import { RESTResponse } from '@/types';

export function useExchangeRate() {
  const sendState = useAtomValue(sendStateAtom);
  const receiveState = useAtomValue(receiveStateAtom);

  const sendAsset = sendState.asset;
  const receiveAsset = receiveState.asset;

  const sendDenom = sendState.asset?.denom || '';
  const receiveDenom = receiveState.asset?.denom || '';

  // Check if swap is valid
  const validSwap = isValidSwap({ sendAsset, receiveAsset });

  const queryExchangeRate = useQuery<string | null, Error, string | null>({
    queryKey: ['exchangeRate', sendDenom, receiveDenom],
    queryFn: async ({ queryKey }): Promise<string | null> => {
      const [, sendAsset, receiveAsset] = queryKey as [string, string, string];
      if (!sendAsset || !receiveAsset) return null;
      if (sendAsset === receiveAsset) {
        return '1';
      }

      // Format the offer amount to the smallest unit
      const exponent = LOCAL_ASSET_REGISTRY[sendAsset]?.exponent || GREATER_EXPONENT_DEFAULT;
      const formattedOfferAmount = (1 * Math.pow(10, exponent)).toFixed(0);

      // Use queryRestNode to query exchange rates
      const response = await queryRestNode<RESTResponse>({
        endpoint: `${CHAIN_ENDPOINTS.swap}offerCoin=${formattedOfferAmount}${sendAsset}&askDenom=${receiveAsset}`,
        queryType: 'GET',
      });

      const returnExchange = (response.return_coin?.amount / Math.pow(10, exponent)).toFixed(
        GREATER_EXPONENT_DEFAULT,
      );

      return returnExchange;
    },
    enabled: validSwap && !!sendDenom && !!receiveDenom,
    staleTime: 30000, // Consider the data stale after 30 seconds
    refetchInterval: 60000, // Refetch every 60 seconds
  });

  const exchangeRate = useMemo(() => {
    if (!validSwap) {
      return 1;
    }
    if (queryExchangeRate.data) {
      return new BigNumber(queryExchangeRate.data).toNumber();
    }
    return 0;
  }, [queryExchangeRate.data, validSwap]);

  return {
    isLoading: queryExchangeRate.isLoading,
    error: queryExchangeRate.error,
    exchangeRate,
  };
}
