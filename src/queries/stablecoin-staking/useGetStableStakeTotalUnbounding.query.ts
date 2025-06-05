import { useQuery } from '@tanstack/react-query';

import { fetchStablecoinStakingUserTotalUnbounding } from '@/helpers/stablecoinStaking';
import { StablecoinStakingUserTotalUnbondings } from '@/types/stablecoin-staking';

export const useGetStableStakeTotalUnboundingQuery = (address: string) => {
  return useQuery<StablecoinStakingUserTotalUnbondings, Error>({
    queryKey: ['stablecoin-staking-total-unbounding', address],
    queryFn: () => fetchStablecoinStakingUserTotalUnbounding(address),
    staleTime: 1000 * 60 * 5, // Consider data fresh for 5 minutes
    gcTime: 1000 * 60 * 30, // Keep data in cache for 30 minutes
  });
};
