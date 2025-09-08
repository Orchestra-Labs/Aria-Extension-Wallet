import { useState, useEffect } from 'react';
import { QueryType, SYMPHONY_ENDPOINTS } from '@/constants';
import { getSymphonyChainId, queryRestNode } from '@/helpers';
import { useAtomValue } from 'jotai';
import { networkLevelAtom, subscribedChainRegistryAtom } from '@/atoms';

interface ExchangeRequirementsResponse {
  total: {
    denom: string;
    amount: string;
  };
}

// TODO: rename. useStablecoinSwapRates?
export const useExchangeRequirements = () => {
  const chainRegistry = useAtomValue(subscribedChainRegistryAtom);
  const networkLevel = useAtomValue(networkLevelAtom);

  const [totalRequirement, setTotalRequirement] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState<boolean>(true);
  const [error, setError] = useState<string | null>(null);

  const symphonyChainId = getSymphonyChainId(networkLevel);

  const chain = chainRegistry[networkLevel][symphonyChainId];
  const prefix = chain.bech32_prefix;
  const restUris = chain.rest_uris;
  console.log('[useExchangeRequirements] querying for exchange rates for:', symphonyChainId);
  console.log('[useExchangeRequirements] using rest uris:', restUris);

  const fetchExchangeRequirement = async () => {
    setIsLoading(true);
    setError(null);

    try {
      const response = (await queryRestNode({
        endpoint: `${SYMPHONY_ENDPOINTS.exchangeRequirements}`,
        queryType: QueryType.GET,
        prefix,
        restUris,
        chainId: symphonyChainId,
      })) as unknown as ExchangeRequirementsResponse;

      if (!response?.total?.amount) {
        throw new Error('Invalid response format');
      }

      setTotalRequirement(response.total.amount);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to fetch exchange requirements');
      console.error('Error fetching exchange requirements:', err);
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    fetchExchangeRequirement();
  }, []);

  return { totalRequirement, isLoading, error, refetch: fetchExchangeRequirement };
};
