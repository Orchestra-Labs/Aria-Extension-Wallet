import { NavLink } from 'react-router-dom';
import { Loader, ReceiveDialog, ValidatorSelectDialog } from '@/components';
import { ROUTES } from '@/constants';
import { Button } from '@/ui-kit';
import { useAtomValue } from 'jotai';
import { isInitialDataLoadAtom, walletAssetsAtom, validatorDataAtom } from '@/atoms';
import { convertToGreaterUnit, formatBalanceDisplay } from '@/helpers';
import { DEFAULT_ASSET, GREATER_EXPONENT_DEFAULT, LOCAL_ASSET_REGISTRY } from '@/constants';

interface BalanceCardProps {
  currentStep: number;
  totalSteps: number;
}

export const BalanceCard = ({ currentStep, totalSteps }: BalanceCardProps) => {
  const isInitialDataLoad = useAtomValue(isInitialDataLoadAtom);
  const walletAssets = useAtomValue(walletAssetsAtom);
  const validatorData = useAtomValue(validatorDataAtom);

  const symbol = LOCAL_ASSET_REGISTRY.note.symbol || DEFAULT_ASSET.symbol || 'MLD';
  const currentExponent = LOCAL_ASSET_REGISTRY.note.exponent || GREATER_EXPONENT_DEFAULT;

  let title = '';
  let primaryText = '';
  let secondaryText;

  if (currentStep === 0) {
    title = 'Available balance';

    const totalAvailableMLD = walletAssets
      .filter(asset => asset.denom === LOCAL_ASSET_REGISTRY.note.denom)
      .reduce((sum, asset) => sum + parseFloat(asset.amount), 0)
      .toFixed(currentExponent);

    primaryText = formatBalanceDisplay(totalAvailableMLD, symbol);
  } else if (currentStep === 1) {
    title = 'Staked balance';

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

  return (
    <div className="p-4 h-44 border rounded-xl border-neutral-4 flex flex-col items-center relative">
      <div className={`text-center flex ${isInitialDataLoad ? 'flex-grow' : 'mb-4'} flex-col`}>
        <p className="text-base text-neutral-1">{title}</p>
        {isInitialDataLoad ? (
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
      <div className="absolute bottom-2 flex space-x-2">
        {[...Array(totalSteps)].map((_, index) => (
          <span
            key={index}
            className={`w-2 h-2 rounded-full ${index === currentStep ? 'bg-blue' : 'bg-neutral-4'}`}
          />
        ))}
      </div>
    </div>
  );
};
