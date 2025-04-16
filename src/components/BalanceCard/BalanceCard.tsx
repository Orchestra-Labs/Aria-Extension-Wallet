import { useMemo, useState } from 'react';
import { NavLink } from 'react-router-dom';
import { Loader, PoolStatusBlock, ReceiveDialog, ValidatorSelectDialog } from '@/components';
import { Button } from '@/ui-kit';
import { useAtomValue } from 'jotai';
import { isInitialDataLoadAtom, walletAssetsAtom, validatorDataAtom } from '@/atoms';
import { convertToGreaterUnit, formatBalanceDisplay } from '@/helpers';
import { ROUTES, DEFAULT_ASSET, GREATER_EXPONENT_DEFAULT, LOCAL_ASSET_REGISTRY } from '@/constants';
import { Triangle } from 'lucide-react';
import BigNumber from 'bignumber.js';
import { useExchangeRate } from '@/hooks';

interface BalanceCardProps {
  currentStep: number;
  totalSteps: number;
  swipeTo: (index: number) => void;
}

export const BalanceCard = ({ currentStep, totalSteps, swipeTo }: BalanceCardProps) => {
  const isInitialDataLoad = useAtomValue(isInitialDataLoadAtom);
  const walletAssets = useAtomValue(walletAssetsAtom);
  const validatorData = useAtomValue(validatorDataAtom);

  const [showReserveStatus, setShowReserveStatus] = useState(false);
  const { exchangeRate, isLoading: isExchangeRateLoading } = useExchangeRate();

  const symbol = LOCAL_ASSET_REGISTRY.note.symbol || DEFAULT_ASSET.symbol || 'MLD';
  const currentExponent = LOCAL_ASSET_REGISTRY.note.exponent || GREATER_EXPONENT_DEFAULT;

  let title = '';
  let primaryText = '';
  let secondaryText;

  const totalMLD = useMemo(() => {
    return walletAssets.reduce((sum, asset) => {
      const denom = asset.denom;
      const amount = new BigNumber(asset.amount || 0);

      // Use exchangeRate from hook if available, otherwise assume 1 for same denom
      const rate = denom === LOCAL_ASSET_REGISTRY.note.denom ? 1 : exchangeRate;

      return sum.plus(amount.multipliedBy(rate || 0));
    }, new BigNumber(0));
  }, [walletAssets, exchangeRate]);

  if (currentStep === 0) {
    title = 'Total Available Balance';

    primaryText = formatBalanceDisplay(totalMLD.toFixed(GREATER_EXPONENT_DEFAULT), symbol);
  } else if (currentStep === 1) {
    title = 'Staked Balance';

    const totalStakedRewards = validatorData.reduce((sum, item) => {
      const rewardSum = item.rewards?.reduce(
        (accum, reward) => accum + parseFloat(reward.amount || '0'),
        0,
      );
      return sum + (rewardSum || 0);
    }, 0);

    primaryText = formatBalanceDisplay(
      convertToGreaterUnit(totalStakedRewards, 6).toFixed(6),
      symbol,
    );

    const totalStakedMLD = validatorData
      .filter(item => item.balance?.denom === LOCAL_ASSET_REGISTRY.note.denom)
      .reduce((sum, item) => sum + parseFloat(item.balance?.amount || '0'), 0);

    secondaryText = formatBalanceDisplay(
      convertToGreaterUnit(totalStakedMLD, currentExponent).toFixed(currentExponent),
      symbol,
    );
  }

  const leftPanelEnabled = currentStep > 0;
  const rightPanelEnabled = currentStep < totalSteps - 1;

  const panelButtonClasses = `border-none text-neutral-1 rounded-none text-blue w-6
    hover:bg-neutral-4 hover:text-blue hover:border-blue
    active:bg-neutral-2 active:text-blue active:border-blue
    disabled:border-none disabled:text-neutral-3 disabled:bg-transparent disabled:cursor-default`;

  return (
    <div className="h-44 border rounded-xl border-neutral-4 flex relative overflow-hidden">
      {/* Left-Side Panel Button */}
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

      {/* Data Block */}
      {!showReserveStatus && (
        <>
          <div className="py-4 flex flex-grow flex-col items-center relative">
            {/* Data Section */}
            <div className="flex flex-grow flex-col items-center text-center w-full">
              <div className="flex justify-between items-center w-full px-4">
                <div className="flex flex-1">
                  <span>&nbsp;</span>
                </div>
                <div className="flex flex-1">
                  <span>&nbsp;</span>
                </div>
                <div className="flex">
                  <p className="text-base text-neutral-1">{title}</p>
                </div>
                <div className="flex flex-1">
                  <span>&nbsp;</span>
                </div>
                {currentStep === 0 ? (
                  <div className="flex flex-1 justify-center">
                    <Button
                      variant="selected"
                      size="xsmall"
                      className="px-1 rounded text-xs"
                      onClick={() => setShowReserveStatus(!showReserveStatus)}
                    >
                      Reserve
                    </Button>
                  </div>
                ) : (
                  <div className="flex flex-1">
                    <span>&nbsp;</span>
                  </div>
                )}
              </div>

              {isInitialDataLoad || (currentStep === 0 && isExchangeRateLoading) ? (
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

            {/* Buttons Section */}
            <div className="flex flex-grow grid grid-cols-2 w-full gap-x-4 px-2">
              {currentStep === 0 ? (
                <>
                  <Button className="w-full" asChild>
                    <NavLink to={ROUTES.APP.SEND}>Send</NavLink>
                  </Button>
                  <ReceiveDialog asset={DEFAULT_ASSET} />
                </>
              ) : (
                <>
                  <ValidatorSelectDialog buttonText="Unstake" buttonVariant="secondary" />
                  <ValidatorSelectDialog buttonText="Claim" isClaimDialog />
                </>
              )}
            </div>

            {/* Pagination Dots */}
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
        </>
      )}

      {/* Right-Side Panel Button */}
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
