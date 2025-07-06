import { useQuery } from '@tanstack/react-query';
import BigNumber from 'bignumber.js';
import { useAtomValue } from 'jotai';
import { useMemo } from 'react';

import {
  SYMPHONY_ENDPOINTS,
  GREATER_EXPONENT_DEFAULT,
  QueryType,
  SYMPHONY_MAINNET_ID,
  LOCAL_MAINNET_ASSET_REGISTRY,
} from '@/constants';
import { chainRegistryAtom, receiveStateAtom, sendStateAtom } from '@/atoms';
import { isValidSwap, queryRestNode } from '@/helpers';

export function useExchangeRate() {
  const sendState = useAtomValue(sendStateAtom);
  const receiveState = useAtomValue(receiveStateAtom);
  const chainRegistry = useAtomValue(chainRegistryAtom);

  // Safely get chain info with fallback to DEFAULT_CHAIN_ID
  const getChainInfo = (chainId: string) => {
    return (
      chainRegistry.mainnet[chainId] ||
      chainRegistry.testnet[chainId] ||
      chainRegistry.mainnet[SYMPHONY_MAINNET_ID]
    );
  };

  const chainInfo = getChainInfo(sendState.chainID);
  const prefix = chainInfo?.bech32_prefix || '';
  const restUris = chainInfo?.rest_uris || [];

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
      const exponent =
        LOCAL_MAINNET_ASSET_REGISTRY[sendAsset]?.exponent || GREATER_EXPONENT_DEFAULT;
      const formattedOfferAmount = (1 * Math.pow(10, exponent)).toFixed(0);

      if (!restUris.length) {
        throw new Error(`No REST endpoints available for chain ${sendState.chainID}`);
      }

      // Use queryRestNode to query exchange rates
      const response = await queryRestNode({
        endpoint: `${SYMPHONY_ENDPOINTS.swap}offerCoin=${formattedOfferAmount}${sendAsset}&askDenom=${receiveAsset}`,
        queryType: QueryType.GET,
        prefix,
        restUris,
      });

      if (!response?.return_coin?.amount) {
        throw new Error('Invalid response from swap endpoint');
      }

      const returnExchange = (response.return_coin.amount / Math.pow(10, exponent)).toFixed(
        GREATER_EXPONENT_DEFAULT,
      );

      return returnExchange;
    },
    enabled: validSwap && !!sendDenom && !!receiveDenom && !!chainInfo,
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
