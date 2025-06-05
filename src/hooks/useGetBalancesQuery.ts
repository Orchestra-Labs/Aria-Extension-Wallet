import { useQuery } from '@tanstack/react-query';

import { CHAIN_ENDPOINTS } from '@/constants';
import { queryRestNode } from '@/helpers';
import { Asset, CustomQueryOptions } from '@/types';

type BalancesResponseDto = {
  balances: Asset[];
};

export type RequestParams = {
  walletAddress: string;
};

const getBalancesRequest = async ({ walletAddress }: RequestParams) => {
  // Use queryNode to try querying balances across nodes
  const response = await queryRestNode<BalancesResponseDto>({
    endpoint: `${CHAIN_ENDPOINTS.getBalance}${walletAddress}`,
  });

  if (!response.balances) {
    // TODO: show error to user
    throw new Error(`Failed to fetch balances for address: ${walletAddress}`);
  }

  return response as unknown as BalancesResponseDto;
};

export function useGetBalancesQuery(params: RequestParams, options?: CustomQueryOptions) {
  return useQuery({
    queryKey: [CHAIN_ENDPOINTS.getBalance, params],
    queryFn: () => getBalancesRequest(params),
    ...options,
  });
}
