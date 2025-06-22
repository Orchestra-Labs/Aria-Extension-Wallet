import { useMutation, UseMutationOptions } from '@tanstack/react-query';
import { unstakeStablecoin } from '@/helpers/stablecoinStaking';
import { StablecoinStakeParams } from '@/types/stablecoin-staking';

type Params = {
  body: StablecoinStakeParams;
  feeDenom: string;
};

const wrappedUnstakeStablecoin = async (params: Params): Promise<void> => {
  await unstakeStablecoin(params);
};

export const useStablecoinUnstakeMutation = (
  options?: UseMutationOptions<void, Error, Params, unknown>,
) => {
  return useMutation({
    mutationFn: wrappedUnstakeStablecoin,
    ...options,
  });
};
