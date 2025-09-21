import { useQuery } from '@tanstack/react-query';

import { QueryType, SYMPHONY_ENDPOINTS } from '@/constants';
import { getSymphonyChainId, queryRestNode } from '@/helpers';
import { useAtomValue } from 'jotai';
import { networkLevelAtom, subscribedChainRegistryAtom } from '@/atoms';

type TobinTaxRateResponseDto = {
  tax_rate: string;
};

const getTobinTaxRateRequest = async () => {
  const chainRegistry = useAtomValue(subscribedChainRegistryAtom);
  const networkLevel = useAtomValue(networkLevelAtom);

  const symphonyChainId = getSymphonyChainId(networkLevel);

  const chain = chainRegistry[networkLevel][symphonyChainId];
  const prefix = chain.bech32_prefix;
  const restUris = chain.rest_uris;

  const response = await queryRestNode({
    endpoint: SYMPHONY_ENDPOINTS.getTobinTaxRate,
    queryType: QueryType.GET,
    prefix,
    restUris,
    chainId: symphonyChainId,
  });

  return response as unknown as TobinTaxRateResponseDto;
};

export function useGetTobinTaxRateQuery() {
  return useQuery({
    queryKey: [SYMPHONY_ENDPOINTS.getTobinTaxRate],
    queryFn: getTobinTaxRateRequest,
  });
}
