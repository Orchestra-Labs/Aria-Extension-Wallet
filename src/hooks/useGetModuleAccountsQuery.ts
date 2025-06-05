import { useQuery } from '@tanstack/react-query';

import { CHAIN_ENDPOINTS } from '@/constants';
import { queryRestNode } from '@/helpers';
import { ModuleAccount } from '@/types';

type ModuleAccountsResponseDto = {
  accounts: ModuleAccount[];
};

const getModuleAccountsRequest = async () => {
  const response = await queryRestNode<ModuleAccountsResponseDto>({
    endpoint: CHAIN_ENDPOINTS.getModuleAccounts,
    queryType: 'GET',
  });

  return response as unknown as ModuleAccountsResponseDto;
};

export function useGetModuleAccountsQuery() {
  return useQuery({
    queryKey: [CHAIN_ENDPOINTS.getModuleAccounts],
    queryFn: getModuleAccountsRequest,
  });
}
