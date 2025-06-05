import { useMutation, UseMutationOptions } from '@tanstack/react-query';
import { stakeStablecoin } from '@/helpers/stablecoinStaking';
import { StablecoinStakeParams } from '@/types/stablecoin-staking';

type Params = {
  body: StablecoinStakeParams;
  feeDenom: string;
};

export const useStablecoinStakeMutation = (
  options?: UseMutationOptions<void, Error, Params, unknown>,
) => {
  return useMutation({
    mutationFn: stakeStablecoin,
    ...options,
  });
};
