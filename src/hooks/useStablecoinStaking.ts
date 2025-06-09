import { useQueryClient } from '@tanstack/react-query';

import { LOCAL_ASSET_REGISTRY } from '@/constants';
import { useRefreshData } from '@/hooks/useRefreshData';
import { useStablecoinUnstakeMutation } from '@/queries';
import { useGetStableStakeParamsQuery } from '@/queries/stablecoin-staking/useGetStableStakeParams.query';
import { useStablecoinStakeMutation } from '@/queries/stablecoin-staking/useStablecoinStake.mutation';
import { StablecoinStakeParams } from '@/types/stablecoin-staking';

export const useStablecoinStaking = (denom = '') => {
  const queryClient = useQueryClient();

  const { refreshData } = useRefreshData();

  const { data: stakingParamsData } = useGetStableStakeParamsQuery();

  const handleSuccessTransaction = async () => {
    await queryClient.invalidateQueries({ queryKey: ['stablecoin-staking-stable-pool', denom] });

    await refreshData({ validator: false });
  };

  const { mutateAsync: stakeStablecoin, isPending: isPendingStake } = useStablecoinStakeMutation({
    onSuccess: handleSuccessTransaction,
  });
  const { mutateAsync: unstakeStablecoin, isPending: isPendingUnstake } =
    useStablecoinUnstakeMutation({
      onSuccess: handleSuccessTransaction,
    });

  const handleStake = async (body: StablecoinStakeParams) => {
    try {
      const feeDenom = LOCAL_ASSET_REGISTRY.note.denom;

      await stakeStablecoin({ body, feeDenom });
    } catch (error) {
      console.error('Stake failed', error);
      throw error;
    }
  };

  const handleUnstake = async (body: StablecoinStakeParams) => {
    try {
      const feeDenom = LOCAL_ASSET_REGISTRY.note.denom;

      await unstakeStablecoin({ body, feeDenom });
    } catch (error) {
      console.error('Unstake failed', error);
      throw error;
    }
  };

  return {
    params: stakingParamsData?.params ?? null,
    handleStake,
    handleUnstake,
    isLoading: isPendingStake || isPendingUnstake,
  };
};
