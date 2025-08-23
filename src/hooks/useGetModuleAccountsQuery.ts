import { useQuery } from '@tanstack/react-query';

import { COSMOS_CHAIN_ENDPOINTS, QueryType } from '@/constants';
import { queryRestNode } from '@/helpers';
import { ModuleAccount, Uri } from '@/types';

type ModuleAccountsResponseDto = {
  accounts: ModuleAccount[];
};

type RequestParams = {
  prefix: string;
  restUris: Uri[];
  chainId: string;
};

const getModuleAccountsRequest = async ({ prefix, restUris, chainId }: RequestParams) => {
  const response = await queryRestNode({
    endpoint: COSMOS_CHAIN_ENDPOINTS.getModuleAccounts,
    queryType: QueryType.GET,
    prefix,
    restUris,
    chainId,
  });

  return response as unknown as ModuleAccountsResponseDto;
};

export function useGetModuleAccountsQuery(params: RequestParams) {
  return useQuery({
    queryKey: [COSMOS_CHAIN_ENDPOINTS.getModuleAccounts],
    queryFn: () => getModuleAccountsRequest(params),
  });
}
