import { useState, useEffect } from 'react';
import { SYMPHONY_MAINNET_ID, QueryType, SYMPHONY_ENDPOINTS } from '@/constants';
import { queryRestNode } from '@/helpers';
import { useAtomValue } from 'jotai';
import { subscribedChainRegistryAtom } from '@/atoms';

interface ExchangeRequirementsResponse {
  total: {
    denom: string;
    amount: string;
  };
}

// TODO: if not subscribed to Symphony, do not show reserve pool or reserve button
export const useExchangeRequirements = () => {
  const chainRegistry = useAtomValue(subscribedChainRegistryAtom);
  const [totalRequirement, setTotalRequirement] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState<boolean>(true);
  const [error, setError] = useState<string | null>(null);

  const chain = chainRegistry.mainnet[SYMPHONY_MAINNET_ID];
  const prefix = chain.bech32_prefix;
  const restUris = chain.rest_uris;
  console.log('[useExchangeRequirements] querying for exchange rates for:', SYMPHONY_MAINNET_ID);
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
