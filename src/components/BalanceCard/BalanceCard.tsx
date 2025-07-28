import { useMemo, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAtomValue } from 'jotai';
import { Triangle } from 'lucide-react';
import BigNumber from 'bignumber.js';

import {
  allWalletAssetsAtom,
  isInitialDataLoadAtom,
  networkLevelAtom,
  validatorDataAtom,
  subscribedChainRegistryAtom,
  hasNonZeroAssetsAtom,
  selectedValidatorChainAtom,
  userAccountAtom,
  isFetchingWalletDataAtom,
  chainInfoAtom,
} from '@/atoms';
import { Button } from '@/ui-kit';
import {
  ChainSelectDialog,
  Loader,
  PoolStatusBlock,
  ReceiveDialog,
  ValidatorSelectDialog,
} from '@/components';
import {
  formatUSD,
  formatValueWithFallback,
  getPrimaryFeeToken,
  getSymphonyChainId,
  getSymphonyDefaultAsset,
} from '@/helpers';
import { ROUTES } from '@/constants';

interface BalanceCardProps {
  currentStep: number;
  totalSteps: number;
  swipeTo: (index: number) => void;
}

export const BalanceCard = ({ currentStep, totalSteps, swipeTo }: BalanceCardProps) => {
  const navigate = useNavigate();

  const isInitialDataLoad = useAtomValue(isInitialDataLoadAtom);
  const walletAssets = useAtomValue(allWalletAssetsAtom);
  const validatorData = useAtomValue(validatorDataAtom);
  const networkLevel = useAtomValue(networkLevelAtom);
  const chainRegistry = useAtomValue(subscribedChainRegistryAtom);
  const hasNonZeroAssets = useAtomValue(hasNonZeroAssetsAtom);
  const userAccount = useAtomValue(userAccountAtom);
  const getChainInfo = useAtomValue(chainInfoAtom);
  const chainId = useAtomValue(selectedValidatorChainAtom);
  const selectedChainId = useAtomValue(selectedValidatorChainAtom);
  const isFetchingWallet = useAtomValue(isFetchingWalletDataAtom);

  const defaultChainId = userAccount?.settings.defaultSelections[networkLevel].defaultChainId;
  const accountViewChainId = defaultChainId || getSymphonyChainId(networkLevel);
  const validatorViewChainId = chainId;
  const viewDefinedChainId = currentStep === 0 ? accountViewChainId : validatorViewChainId;
  const chain = getChainInfo(viewDefinedChainId);

  console.log('[BalanceCard] Non-zero assets check:', {
    hasNonZeroAssets,
    walletAssets: useAtomValue(allWalletAssetsAtom),
    networkLevel: useAtomValue(networkLevelAtom),
  });

  const [showReserveStatus, setShowReserveStatus] = useState(false);

  const balanceDisplayUnit = getPrimaryFeeToken(chain) || getSymphonyDefaultAsset(networkLevel);
  const symbol = balanceDisplayUnit.symbol;
  const currentExponent = balanceDisplayUnit.exponent;

  const validChainIDs = Object.keys(chainRegistry[networkLevel] || {});
  const networkWalletAssets = walletAssets.filter(asset => validChainIDs.includes(asset.networkID));

  // Check if Symphony chain is subscribed
  const isSymphonySubscribed = useMemo(() => {
    const symphonyChainId = getSymphonyChainId(networkLevel);
    return Object.keys(chainRegistry[networkLevel] || {}).includes(symphonyChainId);
  }, [networkLevel, chainRegistry]);

  let title = '';
  let primaryText = '';
  let secondaryText;

  const totalValue = useMemo(() => {
    return networkWalletAssets.reduce((sum, asset) => {
      const amount = new BigNumber(asset.amount || '0');
      const price = asset.price || 0;
      return sum.plus(amount.multipliedBy(price));
    }, new BigNumber(0));
  }, [networkWalletAssets]);

  const totalTokenAmount = useMemo(() => {
    return networkWalletAssets.reduce((sum, asset) => {
      return sum.plus(new BigNumber(asset.amount || '0'));
    }, new BigNumber(0));
  }, [networkWalletAssets]);

  if (currentStep === 0) {
    title = 'Total Available Balance';
    primaryText = formatValueWithFallback(totalValue, totalTokenAmount, symbol);
    // Update the staking rewards calculation in BalanceCard.tsx
  } else if (currentStep === 1) {
    title = 'Total Staking Rewards';

    // Calculate both token amount and USD value for rewards
    const { totalRewardsTokenAmount, totalRewardsValue } = validatorData.reduce(
      (acc, validator) => {
        validator.rewards?.forEach(reward => {
          const rewardAmount = new BigNumber(reward.amount || '0');
          if (rewardAmount.isZero()) return;

          // Find the asset to get price and decimals
          const asset = networkWalletAssets.find(a => a.denom === reward.denom);
          const decimals = asset?.exponent || 6;
          const price = asset?.price || 0;

          // Convert reward amount to human-readable format
          const humanReadableAmount = rewardAmount.dividedBy(10 ** decimals);

          acc.totalRewardsTokenAmount = acc.totalRewardsTokenAmount.plus(humanReadableAmount);
          acc.totalRewardsValue = acc.totalRewardsValue.plus(
            humanReadableAmount.multipliedBy(price),
          );
        });
        return acc;
      },
      { totalRewardsTokenAmount: new BigNumber(0), totalRewardsValue: new BigNumber(0) },
    );

    primaryText = formatValueWithFallback(totalRewardsValue, totalRewardsTokenAmount, symbol, val =>
      formatUSD(val),
    );

    // Calculate staked balance (secondary text)
    const totalStakedMLD = validatorData
      .filter(item => item.balance?.denom === balanceDisplayUnit?.denom)
      .reduce((sum, item) => {
        const amount = new BigNumber(item.balance?.amount || '0');
        // Convert from base units to human-readable units using the exponent
        const humanReadableAmount = amount.dividedBy(10 ** currentExponent);
        return sum.plus(humanReadableAmount);
      }, new BigNumber(0));

    // Find the primary asset to get its price
    const primaryAsset = networkWalletAssets.find(a => a.denom === balanceDisplayUnit?.denom);
    const stakedValue = totalStakedMLD.multipliedBy(primaryAsset?.price || 0);

    secondaryText = formatValueWithFallback(
      stakedValue,
      totalStakedMLD,
      symbol,
      val => `Staked Balance: ${formatUSD(val)}`,
    );
  }

  const leftPanelEnabled = currentStep > 0;
  const rightPanelEnabled = currentStep < totalSteps - 1;

  const panelButtonClasses = `border-none text-neutral-1 rounded-none text-blue w-6
    hover:bg-neutral-4 hover:text-blue hover:border-blue
    active:bg-neutral-2 active:text-blue active:border-blue
    disabled:border-none disabled:text-neutral-3 disabled:bg-transparent disabled:cursor-default`;

  const handleSendClick = () => {
    navigate(ROUTES.APP.SEND);
  };

  return (
    <div className="h-44 border rounded-xl border-neutral-4 flex relative overflow-hidden">
      <Button
        variant="blank"
        size="blank"
        className={`border-r disabled:border-r ${panelButtonClasses}`}
        disabled={!leftPanelEnabled}
        onClick={() => swipeTo(currentStep - 1)}
      >
        <div className="flex items-center justify-center h-full w-12">
          <Triangle className="w-4 h-4 -rotate-90" />
        </div>
      </Button>

      {showReserveStatus && currentStep === 0 && (
        <PoolStatusBlock onBack={() => setShowReserveStatus(false)} />
      )}

      {!showReserveStatus && (
        <div className="py-4 flex flex-grow flex-col items-center relative">
          <div className="flex flex-grow flex-col items-center text-center w-full">
            <div className="flex justify-between items-center w-full px-4">
              {/* Left side - invisible button for balance */}
              <div className="flex flex-1 justify-start">
                {currentStep === 0 ? (
                  isSymphonySubscribed ? (
                    <Button
                      variant="selectedEnabled"
                      size="xsmall"
                      className="px-1 rounded text-xs opacity-0 pointer-events-none"
                      disabled
                    >
                      Reserve
                    </Button>
                  ) : (
                    <div className="w-12" />
                  )
                ) : (
                  <ChainSelectDialog
                    buttonClassName="opacity-0 pointer-events-none"
                    buttonText={selectedChainId}
                    disabled
                  />
                )}
              </div>

              {/* Center title */}
              <div className="flex">
                <p className="text-base text-neutral-1">{title}</p>
              </div>

              {/* Right side - actual button */}
              <div className="flex flex-1 justify-end">
                {currentStep === 0 ? (
                  isSymphonySubscribed ? (
                    <Button
                      variant="selectedEnabled"
                      size="xsmall"
                      className="px-1 rounded text-xs"
                      onClick={() => setShowReserveStatus(!showReserveStatus)}
                    >
                      Reserve
                    </Button>
                  ) : null
                ) : (
                  <ChainSelectDialog />
                )}
              </div>
            </div>

            {isInitialDataLoad || (currentStep === 0 && isFetchingWallet) ? (
              <Loader scaledHeight />
            ) : (
              <>
                <h1 className="text-h2 text-white font-bold line-clamp-1">{primaryText}</h1>
                <p className="text-sm text-neutral-1 line-clamp-1">
                  {secondaryText ? `Balance: ${secondaryText}` : <span>&nbsp;</span>}
                </p>
              </>
            )}
          </div>

          <div className="flex flex-grow grid grid-cols-2 w-full gap-x-4 px-2">
            {currentStep === 0 ? (
              <>
                <Button className="w-full" disabled={!hasNonZeroAssets} onClick={handleSendClick}>
                  Send
                </Button>
                <ReceiveDialog
                  asset={balanceDisplayUnit}
                  chainId={getSymphonyChainId(networkLevel)}
                />
              </>
            ) : (
              <>
                <ValidatorSelectDialog buttonText="Unstake" buttonVariant="secondary" />
                <ValidatorSelectDialog buttonText="Claim" isClaimDialog />
              </>
            )}
          </div>

          <div className="flex justify-center space-x-2 mt-2">
            {[...Array(totalSteps)].map((_, index) =>
              index === currentStep ? (
                <span key={index} className="w-2 h-2 rounded-full bg-blue" />
              ) : (
                <Button
                  key={index}
                  variant="unselected"
                  size="blank"
                  onClick={() => swipeTo(index)}
                  className="w-2 h-2 rounded-full bg-neutral-4"
                />
              ),
            )}
          </div>
        </div>
      )}

      <Button
        variant="selected"
        size="blank"
        className={`border-l disabled:border-l ${panelButtonClasses}`}
        disabled={!rightPanelEnabled}
        onClick={() => swipeTo(currentStep + 1)}
      >
        <div className="flex items-center justify-center h-full w-12">
          <Triangle className="w-4 h-4 rotate-90" />
        </div>
      </Button>
    </div>
  );
};
