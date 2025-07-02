import { useQuery } from '@tanstack/react-query';

import { COSMOS_CHAIN_ENDPOINTS } from '@/constants';
import { queryRestNode } from '@/helpers';
import { Asset, CustomQueryOptions } from '@/types';
import { useAtomValue } from 'jotai';
import { chainRegistryAtom } from '@/atoms';

type BalancesResponseDto = {
  balances: Asset[];
};

export type RequestParams = {
  walletAddress: string;
  chainID: string;
};

const getBalancesRequest = async ({ walletAddress, chainID }: RequestParams) => {
  const chainRegistry = useAtomValue(chainRegistryAtom);
  const restUris = chainRegistry[chainID].rest_uris;

  // Use queryNode to try querying balances across nodes
  const response = await queryRestNode({
    endpoint: `${COSMOS_CHAIN_ENDPOINTS.getBalance}${walletAddress}`,
    restUris,
  });

  if (!response.balances) {
    // TODO: show error to user
    throw new Error(`Failed to fetch balances for address: ${walletAddress}`);
  }

  return response as unknown as BalancesResponseDto;
};

export function useGetBalancesQuery(params: RequestParams, options?: CustomQueryOptions) {
  return useQuery({
    queryKey: [COSMOS_CHAIN_ENDPOINTS.getBalance, params],
    queryFn: () => getBalancesRequest(params),
    ...options,
  });
}
