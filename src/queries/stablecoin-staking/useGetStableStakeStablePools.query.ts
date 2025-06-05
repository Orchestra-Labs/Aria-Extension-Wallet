import { useQuery } from '@tanstack/react-query';

import { fetchStablecoinStakingStablePools } from '@/helpers/stablecoinStaking';
import { StablecoinStakingStablePools } from '@/types/stablecoin-staking';

export const useGetStableStakeStablePoolsQuery = () => {
  return useQuery<StablecoinStakingStablePools, Error>({
    queryKey: ['stablecoin-staking-stable-pools'],
    queryFn: () => fetchStablecoinStakingStablePools(),
    staleTime: 1000 * 60 * 5, // Consider data fresh for 5 minutes
    gcTime: 1000 * 60 * 30, // Keep data in cache for 30 minutes
  });
};
