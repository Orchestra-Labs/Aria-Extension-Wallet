import { useQuery } from '@tanstack/react-query';

import { SYMPHONY_MAINNET_ID, QueryType, SYMPHONY_ENDPOINTS } from '@/constants';
import { queryRestNode } from '@/helpers';
import { useAtomValue } from 'jotai';
import { chainRegistryAtom } from '@/atoms';

type TobinTaxRateResponseDto = {
  tax_rate: string;
};

const getTobinTaxRateRequest = async () => {
  const chainRegistry = useAtomValue(chainRegistryAtom);
  const chain = chainRegistry.mainnet[SYMPHONY_MAINNET_ID];
  const prefix = chain.bech32_prefix;
  const restUris = chain.rest_uris;

  const response = await queryRestNode({
    endpoint: SYMPHONY_ENDPOINTS.getTobinTaxRate,
    queryType: QueryType.GET,
    prefix,
    restUris,
  });

  return response as unknown as TobinTaxRateResponseDto;
};

export function useGetTobinTaxRateQuery() {
  return useQuery({
    queryKey: [SYMPHONY_ENDPOINTS.getTobinTaxRate],
    queryFn: getTobinTaxRateRequest,
  });
}
