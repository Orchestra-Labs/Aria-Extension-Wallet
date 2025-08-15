import { useQuery } from '@tanstack/react-query';

import { COSMOS_CHAIN_ENDPOINTS } from '@/constants';
import { queryRestNode } from '@/helpers';
import { Asset, CustomQueryOptions } from '@/types';
import { useAtomValue } from 'jotai';
import { subscribedChainRegistryAtom } from '@/atoms';

type BalancesResponseDto = {
  balances: Asset[];
};

export type RequestParams = {
  walletAddress: string;
  chainId: string;
};

const getBalancesRequest = async ({ walletAddress, chainId }: RequestParams) => {
  console.log('[getBalancesRequest] walletAddress:', walletAddress);
  console.log('[getBalancesRequest] chainId:', chainId);

  const chainRegistry = useAtomValue(subscribedChainRegistryAtom);
  const chain = chainRegistry.mainnet[chainId];
  const prefix = chain.bech32_prefix;
  const restUris = chain.rest_uris;

  console.log('[getBalancesRequest] prefix:', prefix);
  console.log('[getBalancesRequest] restUris:', restUris);
  console.log(
    '[getBalancesRequest] endpoint:',
    `${COSMOS_CHAIN_ENDPOINTS.getBalance}${walletAddress}`,
  );

  // Use queryNode to try querying balances across nodes
  const response = await queryRestNode({
    endpoint: `${COSMOS_CHAIN_ENDPOINTS.getBalance}${walletAddress}`,
    prefix,
    restUris,
  });

  console.log('[getBalancesRequest] response:', response);

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
