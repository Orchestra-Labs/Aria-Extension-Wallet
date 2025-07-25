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
};

const getModuleAccountsRequest = async ({ prefix, restUris }: RequestParams) => {
  const response = await queryRestNode({
    endpoint: COSMOS_CHAIN_ENDPOINTS.getModuleAccounts,
    queryType: QueryType.GET,
    prefix,
    restUris,
  });

  return response as unknown as ModuleAccountsResponseDto;
};

export function useGetModuleAccountsQuery(params: RequestParams) {
  return useQuery({
    queryKey: [COSMOS_CHAIN_ENDPOINTS.getModuleAccounts],
    queryFn: () => getModuleAccountsRequest(params),
  });
}
