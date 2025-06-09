import { useQuery } from '@tanstack/react-query';

import { fetchStablecoinStakingStablePool } from '@/helpers/stablecoinStaking';
import { StablecoinStakingStablePool } from '@/types/stablecoin-staking';

export const useGetStableStakeStablePoolQuery = (denom: string) => {
  return useQuery<StablecoinStakingStablePool, Error>({
    queryKey: ['stablecoin-staking-stable-pool', denom],
    queryFn: () => fetchStablecoinStakingStablePool(denom),
    staleTime: 1000 * 60 * 5, // Consider data fresh for 5 minutes
    gcTime: 1000 * 60 * 30, // Keep data in cache for 30 minutes
    retry: false,
  });
};
