import { useQuery } from '@tanstack/react-query';

import { fetchStablecoinStakingUserTotalStake } from '@/helpers/stablecoinStaking';
import { StablecoinStakingUserTotalStake } from '@/types/stablecoin-staking';

export const useGetStableStakeUserTotalStakeQuery = (address: string) => {
  return useQuery<StablecoinStakingUserTotalStake, Error>({
    queryKey: ['stablecoin-staking-total-stake', address],
    queryFn: () => fetchStablecoinStakingUserTotalStake(address),
    staleTime: 1000 * 60 * 5, // Consider data fresh for 5 minutes
    gcTime: 1000 * 60 * 30, // Keep data in cache for 30 minutes
  });
};
