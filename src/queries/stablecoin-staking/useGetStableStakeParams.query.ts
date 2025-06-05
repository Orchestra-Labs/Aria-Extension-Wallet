import { useQuery } from '@tanstack/react-query';

import { fetchStablecoinStakingParams } from '@/helpers/stablecoinStaking';
import { StablecoinStakingParams } from '@/types/stablecoin-staking';

export const useGetStableStakeParamsQuery = () => {
  return useQuery<StablecoinStakingParams, Error>({
    queryKey: ['stablecoin-staking-params'],
    queryFn: () => fetchStablecoinStakingParams(),
    staleTime: 1000 * 60 * 5, // Consider data fresh for 5 minutes
    gcTime: 1000 * 60 * 30, // Keep data in cache for 30 minutes
  });
};
