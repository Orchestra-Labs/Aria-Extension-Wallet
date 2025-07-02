import { useState, useEffect } from 'react';
import { DEFAULT_CHAIN_ID, QueryType, SYMPHONY_ENDPOINTS } from '@/constants';
import { queryRestNode } from '@/helpers';
import { useAtomValue } from 'jotai';
import { chainRegistryAtom } from '@/atoms';

interface ExchangeRequirementsResponse {
  total: {
    denom: string;
    amount: string;
  };
}

export const useExchangeRequirements = () => {
  const chainRegistry = useAtomValue(chainRegistryAtom);
  const [totalRequirement, setTotalRequirement] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState<boolean>(true);
  const [error, setError] = useState<string | null>(null);

  const restUris = chainRegistry[DEFAULT_CHAIN_ID].rest_uris;
  console.log('[useExchangeRequirements] querying for exchange rates for:', DEFAULT_CHAIN_ID);
  console.log('[useExchangeRequirements] using rest uris:', restUris);

  const fetchExchangeRequirement = async () => {
    setIsLoading(true);
    setError(null);

    try {
      const response = (await queryRestNode({
        endpoint: `${SYMPHONY_ENDPOINTS.exchangeRequirements}`,
        queryType: QueryType.GET,
        restUris,
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
