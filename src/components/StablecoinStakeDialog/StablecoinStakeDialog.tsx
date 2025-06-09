import { useAtomValue } from 'jotai';
import React, { useMemo, useState } from 'react';

import { walletStateAtom } from '@/atoms';
import { AssetInput } from '@/components';
import { DEFAULT_ASSET, GREATER_EXPONENT_DEFAULT, LOCAL_ASSET_REGISTRY } from '@/constants';
import { convertToGreaterUnit, formatBalanceDisplay, formatDuration } from '@/helpers';
import { useStablecoinStaking } from '@/hooks/useStablecoinStaking';
import { useGetStableStakeStablePoolQuery } from '@/queries';
import { Asset } from '@/types';
import { Button, SlideTray } from '@/ui-kit';
import { useToast } from '@/hooks';

interface StablecoinStakeDialog {
  asset: Asset;
}

const DEFAULT_AMOUNT = 0;

export const StablecoinStakeDialog: React.FC<StablecoinStakeDialog> = ({ asset }) => {
  const { address, assets } = useAtomValue(walletStateAtom);

  const { toast } = useToast();

  const [selectedAction, setSelectedAction] = useState<'stake' | 'unstake'>('stake');
  const [amount, setAmount] = useState<number>(DEFAULT_AMOUNT);

  const { params, handleStake, handleUnstake, isLoading } = useStablecoinStaking(asset.denom);
  const { data: stablePoolInfo } = useGetStableStakeStablePoolQuery(asset.denom);

  const handleStablecoinStake = async () => {
    const adjustedAmount = (
      amount * Math.pow(10, asset.exponent || GREATER_EXPONENT_DEFAULT)
    ).toFixed(0);

    await handleStake({
      staker: address,
      amount: {
        amount: adjustedAmount,
        denom: asset.denom,
      },
    }).then(() => {
      toast({
        title: `Stablecoin stake success!`,
        description: `You staked ${amount} ${asset.symbol}`,
        duration: 5000,
      });
    });

    setAmount(DEFAULT_AMOUNT);
  };

  console.log('selectedAction', selectedAction);

  const handleStablecoinUnstake = async () => {
    const adjustedAmount = (
      amount * Math.pow(10, LOCAL_ASSET_REGISTRY[asset.denom].exponent || GREATER_EXPONENT_DEFAULT)
    ).toFixed(0);

    await handleUnstake({
      staker: address,
      amount: {
        amount: adjustedAmount,
        denom: asset.denom,
      },
    }).then(() => {
      toast({
        title: `Stablecoin unstake success!`,
        description: `You unstaked ${amount} ${asset.symbol}`,
        duration: 5000,
      });
    });

    setAmount(DEFAULT_AMOUNT);
  };

  const onMaxAmountClick = () => {
    if (selectedAction === 'stake') {
      setAmount(
        Number(params?.max_staking_amount) > 0
          ? Number(params?.max_staking_amount)
          : Number(assets.find(a => a.denom === asset.denom)?.amount) || 0,
      );
    } else {
      setAmount(0);
    }
  };

  const unstakingPeriod = useMemo(() => {
    return formatDuration(params?.unbonding_duration || '');
  }, [params]);

  const totalStaked = useMemo(() => {
    if (!stablePoolInfo?.pool?.total_staked) {
      return `0 ${asset.symbol}`;
    }
    return formatBalanceDisplay(
      convertToGreaterUnit(parseFloat(stablePoolInfo?.pool?.total_staked), 6).toFixed(6),
      asset.symbol!,
    );
  }, [asset.symbol, stablePoolInfo?.pool?.total_staked]);

  return (
    <SlideTray
      triggerComponent={
        <Button size="medium" className="w-full">
          Stake
        </Button>
      }
      title="Stake"
      showBottomBorder
      reducedTopMargin
      height="85%"
    >
      <div className="flex flex-col items-center">
        <p className="text-base text-neutral-1 my-1">Staked Balance</p>
        <h2 className="text-h3 text-blue font-bold line-clamp-1">{totalStaked}</h2>
        <span className="mt-1 text-grey-dark text-xs text-base">
          Unstaking period <span className="text-warning">{unstakingPeriod}</span>
        </span>
        <div className="mt-4 gap-2 flex justify-between w-full px-2 mb-2">
          <Button
            size="medium"
            variant={selectedAction === 'stake' ? 'default' : 'secondary'}
            className="w-full hover:bg-blue-pressed hover:text-black"
            onClick={() => setSelectedAction('stake')}
            disabled={isLoading}
          >
            Stake
          </Button>
          <Button
            size="medium"
            variant={selectedAction === 'unstake' ? 'default' : 'secondary'}
            className="w-full hover:bg-blue-pressed hover:text-black"
            onClick={() => setSelectedAction('unstake')}
            disabled={isLoading}
          >
            Unstake
          </Button>
        </div>
        <div className="mt-4 flex flex-col items-center w-full">
          <AssetInput
            placeholder={`Enter ${selectedAction} amount`}
            variant="stake"
            assetState={DEFAULT_ASSET}
            amountState={amount}
            updateAmount={newAmount => setAmount(newAmount)}
            reducedHeight
            showClearAndMax
            showEndButton
            disableButtons={isLoading}
            onClear={() => setAmount(0)}
            onMax={onMaxAmountClick}
            endButtonTitle={selectedAction === 'stake' ? 'Stake' : 'Unstake'}
            onEndButtonClick={() => {
              selectedAction === 'stake' ? handleStablecoinStake() : handleStablecoinUnstake();
            }}
            endButtonClassName="min-h-8"
          />
        </div>
      </div>
    </SlideTray>
  );
};
