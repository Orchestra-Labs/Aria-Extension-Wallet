import { useGetStableStakeParamsQuery } from '@/queries/stablecoin-staking/useGetStableStakeParams.query';
import { useAtomValue } from 'jotai';
import { symphonyAssetsAtom, walletStateAtom } from '@/atoms';
import { useGetStableStakeUserTotalStakeQuery, useStablecoinUnstakeMutation } from '@/queries';
import { useStablecoinStakeMutation } from '@/queries/stablecoin-staking/useStablecoinStake.mutation';
import { StablecoinStakeParams } from '@/types/stablecoin-staking';
import { getValidFeeDenom } from '@/helpers/feeDenom';

export const useStablecoinStaking = () => {
  const { address } = useAtomValue(walletStateAtom);
  const symphonyAssets = useAtomValue(symphonyAssetsAtom);

  const { data: stakingParamsData } = useGetStableStakeParamsQuery();
  const data = useGetStableStakeUserTotalStakeQuery(address);

  const { mutateAsync: stakeStablecoin, isPending: isPendingStake } = useStablecoinStakeMutation();
  const { mutateAsync: unstakeStablecoin, isPending: isPendingUnstake } =
    useStablecoinUnstakeMutation();

  console.log('Stable Staking: User Total Stake', data);

  const handleStake = async (body: StablecoinStakeParams) => {
    try {
      const feeDenom = getValidFeeDenom(body.amount.denom, symphonyAssets);
      console.log('Fee Denom:', feeDenom);

      await stakeStablecoin({ body, feeDenom });
      console.log('Stake successful');
    } catch (error) {
      console.error('Stake failed', error);
    }
  };

  const handleUnstake = async (body: StablecoinStakeParams) => {
    try {
      const feeDenom = getValidFeeDenom(body.amount.denom, symphonyAssets);

      await unstakeStablecoin({ body, feeDenom });
      console.log('Unstake successful');
    } catch (error) {
      console.error('Unstake failed', error);
    }
  };

  return {
    params: stakingParamsData?.params ?? null,
    handleStake,
    handleUnstake,
    isLoading: isPendingStake || isPendingUnstake,
  };
};
