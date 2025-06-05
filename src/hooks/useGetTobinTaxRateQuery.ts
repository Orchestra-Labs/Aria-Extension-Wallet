import { useQuery } from '@tanstack/react-query';

import { CHAIN_ENDPOINTS } from '@/constants';
import { queryRestNode } from '@/helpers';

type TobinTaxRateResponseDto = {
  tax_rate: string;
};

const getTobinTaxRateRequest = async () => {
  const response = await queryRestNode<TobinTaxRateResponseDto>({
    endpoint: CHAIN_ENDPOINTS.getTobinTaxRate,
    queryType: 'GET',
  });

  return response as unknown as TobinTaxRateResponseDto;
};

export function useGetTobinTaxRateQuery() {
  return useQuery({
    queryKey: [CHAIN_ENDPOINTS.getTobinTaxRate],
    queryFn: getTobinTaxRateRequest,
  });
}
