import { useQuery } from '@tanstack/react-query';

import { fetchStablecoinStakingUserStake } from '@/helpers/stablecoinStaking';
import { StablecoinStakingUserStake } from '@/types/stablecoin-staking';

export const useGetStableStakeUserStakeQuery = ({
  address,
  token,
}: {
  address: string;
  token: string;
}) => {
  return useQuery<StablecoinStakingUserStake, Error>({
    queryKey: ['stablecoin-staking-user-stake', address, token],
    queryFn: () => fetchStablecoinStakingUserStake({ address, token }),
    staleTime: 1000 * 60 * 5, // Consider data fresh for 5 minutes
    gcTime: 1000 * 60 * 30, // Keep data in cache for 30 minutes
  });
};
