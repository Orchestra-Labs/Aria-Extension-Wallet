import { useMutation, UseMutationOptions } from '@tanstack/react-query';
import { unstakeStablecoin } from '@/helpers/stablecoinStaking';
import { StablecoinStakeParams } from '@/types/stablecoin-staking';

type Params = {
  body: StablecoinStakeParams;
  feeDenom: string;
};

export const useStablecoinUnstakeMutation = (
  options?: UseMutationOptions<void, Error, Params, unknown>,
) => {
  return useMutation({
    mutationFn: unstakeStablecoin,
    ...options,
  });
};
