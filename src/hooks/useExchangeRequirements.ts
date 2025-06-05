import { useState, useEffect } from 'react';
import { CHAIN_ENDPOINTS } from '@/constants';
import { queryRestNode } from '@/helpers';

interface ExchangeRequirementsResponse {
  total: {
    denom: string;
    amount: string;
  };
}

export const useExchangeRequirements = () => {
  const [totalRequirement, setTotalRequirement] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState<boolean>(true);
  const [error, setError] = useState<string | null>(null);

  const fetchExchangeRequirement = async () => {
    setIsLoading(true);
    setError(null);

    try {
      const response = (await queryRestNode<ExchangeRequirementsResponse>({
        endpoint: `${CHAIN_ENDPOINTS.exchangeRequirements}`,
        queryType: 'GET',
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
