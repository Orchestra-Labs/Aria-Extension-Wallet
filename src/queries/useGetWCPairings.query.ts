import { useQuery, UseQueryOptions } from '@tanstack/react-query';
import { PairingTypes } from '@walletconnect/types';

import { walletkit } from '@/helpers';

type Response = PairingTypes.Struct[];

export type { Response as GetWCPairingsResponse };

const getWCPairings = () => {
  return walletkit.core.pairing.getPairings();
};

export const useGetWCPairingsQuery = (
  options?: UseQueryOptions<Response, Error, Response, readonly ['wc-pairings']>,
) => {
  return useQuery({
    queryKey: ['wc-pairings'],
    queryFn: getWCPairings,
    ...options,
  });
};
