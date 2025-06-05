import { useQuery } from '@tanstack/react-query';

import { fetchStablecoinStakingUserUnbounding } from '@/helpers/stablecoinStaking';
import { StablecoinStakingUserUnbonding } from '@/types/stablecoin-staking';

export const useGetStableStakeUnboundingQuery = ({
  address,
  denom,
}: {
  address: string;
  denom: string;
}) => {
  return useQuery<StablecoinStakingUserUnbonding, Error>({
    queryKey: ['stablecoin-staking-total-unbounding', address, denom],
    queryFn: () => fetchStablecoinStakingUserUnbounding({ address, denom }),
    staleTime: 1000 * 60 * 5, // Consider data fresh for 5 minutes
    gcTime: 1000 * 60 * 30, // Keep data in cache for 30 minutes
  });
};
