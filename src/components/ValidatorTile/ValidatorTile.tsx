import { memo, useEffect, useRef, useState } from 'react';
import { CombinedStakingInfo, ValidatorLogoInfo } from '@/types';
import { SlideTray, Button } from '@/ui-kit';
import { IconContainer, NotFoundIcon } from '@/assets/icons';
import { ScrollTile } from '../ScrollTile';
import {
  calculateRemainingTime,
  convertToGreaterUnit,
  formatBalanceDisplay,
  isValidUrl,
  selectTextColorByStatus,
  getValidatorLogoInfo,
  formatLowBalanceDisplay,
  getVotingPowerStatus,
  getUptimeStatus,
  getValidatorStatus,
  truncateWalletAddress,
} from '@/helpers';
import {
  BondStatus,
  DEFAULT_MAINNET_ASSET,
  GREATER_EXPONENT_DEFAULT,
  TextFieldStatus,
} from '@/constants';
import { useAtom, useAtomValue, useSetAtom } from 'jotai';
import {
  subscribedChainRegistryAtom,
  filteredValidatorsAtom,
  networkLevelAtom,
  showCurrentValidatorsAtom,
  selectedValidatorChainAtom,
  isValidatorLoadingAtom,
  isValidatorSuccessAtom,
  resetValidatorTransactionAtom,
  validatorErrorAtom,
  validatorTxFailedAtom,
  maxAvailableAtom,
  validatorTxHash,
  lastSimulationUpdateAtom,
  validatorCalculatedFeeAtom,
  chainInfoAtom,
  selectedValidatorsAtom,
} from '@/atoms';
import { AssetInput } from '../AssetInput';
import { Loader } from '../Loader';
import { TransactionResultsTile } from '../TransactionResultsTile';
import { AlertCircleIcon } from 'lucide-react';
import { useValidatorActions } from '@/hooks';

interface ValidatorTileProps {
  combinedStakingInfo: CombinedStakingInfo;
  isSelectable?: boolean;
  onClick?: (validator: CombinedStakingInfo) => void;
  forceCurrentViewStyle?: boolean;
}

// TODO: for the case where the user is unstaking all and the filtered validators would not include this tray, if this causes graphical errors, swipe away the tray and show toast
// TODO: if no staking denom, disable staking features
const ValidatorTileComponent = ({
  combinedStakingInfo,
  isSelectable = false,
  onClick,
  forceCurrentViewStyle = false,
}: ValidatorTileProps) => {
  // Refs and state
  const slideTrayRef = useRef<{ isOpen: () => void }>(null);
  const { runTransaction, runSimulation } = useValidatorActions(combinedStakingInfo);

  // Atoms
  const networkLevel = useAtomValue(networkLevelAtom);
  const selectedValidators = useAtomValue(
    isSelectable ? selectedValidatorsAtom : filteredValidatorsAtom,
  );
  const chainId = useAtomValue(selectedValidatorChainAtom);
  const chainRegistry = useAtomValue(subscribedChainRegistryAtom);
  const isLoading = useAtomValue(isValidatorLoadingAtom);
  const transactionError = useAtomValue(validatorErrorAtom);
  const transactionFailed = useAtomValue(validatorTxFailedAtom);
  const isSuccess = useAtomValue(isValidatorSuccessAtom);
  const calculatedFee = useAtomValue(validatorCalculatedFeeAtom);
  const maxAvailable = useAtomValue(maxAvailableAtom);
  const transactionHash = useAtomValue(validatorTxHash);
  const chainInfo = useAtomValue(chainInfoAtom);
  const [lastUpdateTime, setLastUpdateTime] = useAtom(lastSimulationUpdateAtom);
  const resetTransactionStates = useSetAtom(resetValidatorTransactionAtom);
  const showCurrentValidators = useAtomValue(showCurrentValidatorsAtom);

  // Derived data
  const chain = chainInfo(chainId);

  const [amount, setAmount] = useState(0);
  const [isClaimToRestake, setIsClaimToRestake] = useState(true);
  const [selectedAction, setSelectedAction] = useState<'stake' | 'unstake' | 'claim' | null>(null);
  const [validatorLogoInfo, setValidatorLogoInfo] = useState<ValidatorLogoInfo>({
    url: null,
    isFallback: false,
    error: false,
  });

  const {
    validator,
    delegation,
    balance,
    rewards,
    unbondingBalance,
    theoreticalApr,
    uptime,
    votingPower,
  } = combinedStakingInfo;
  const delegationResponse = { delegation, balance };

  // Asset info
  const stakingDenom = chain.staking_denoms[0];
  const asset = chain.assets?.[stakingDenom] || DEFAULT_MAINNET_ASSET;
  const symbol = asset.symbol;
  const exponent = asset.exponent || GREATER_EXPONENT_DEFAULT;

  // Calculations
  const rewardAmount = rewards.reduce((sum, reward) => sum + parseFloat(reward.amount), 0);
  const formattedRewardAmount = formatBalanceDisplay(
    convertToGreaterUnit(rewardAmount, exponent).toFixed(exponent),
    symbol,
  );
  const delegatedAmount = convertToGreaterUnit(parseFloat(delegation.shares || '0'), exponent);
  const hasUnbonding = unbondingBalance && parseFloat(unbondingBalance.balance) > 0;

  // Display values
  const title = validator.description.moniker || 'Unknown Validator';
  const commission = `${parseFloat(validator.commission.commission_rates.rate) * 100}%`;
  const website = validator.description.website;
  const isWebsiteValid = isValidUrl(website);

  const dialogSubTitle = formatBalanceDisplay(
    `${isNaN(delegatedAmount) ? 0 : delegatedAmount}`,
    symbol,
  );

  const isSelected = selectedValidators.some(
    v => v.delegation.validator_address === delegation.validator_address,
  );

  const unbondingDays = `${combinedStakingInfo.stakingParams?.unbonding_time} days`;
  const unstakingTime = `${calculateRemainingTime(combinedStakingInfo.unbondingBalance?.completion_time || '')}`;
  let amountUnstaking = formatBalanceDisplay(
    convertToGreaterUnit(parseFloat(unbondingBalance?.balance || '0'), exponent).toFixed(exponent),
    symbol,
  );

  // Status determination
  const { label: statusLabel, color: statusColor } = getValidatorStatus(validator);
  const textColor = selectTextColorByStatus(statusColor);

  // Tile display configuration
  const getTileConfig = () => {
    if (showCurrentValidators || forceCurrentViewStyle) {
      return {
        value: formattedRewardAmount,
        subtitle:
          delegatedAmount > 0
            ? `${formatBalanceDisplay(`${delegatedAmount}`, symbol)} Staked`
            : hasUnbonding
              ? 'Unstaking'
              : 'No delegation',
        secondarySubtitle: null,
        secondaryStatus: TextFieldStatus.GOOD,
      };
    }

    // For "All" view
    const uptimeValue = parseFloat(uptime || '0');
    const votingPowerValue = parseFloat(votingPower || '0');
    const numValidators = selectedValidators.length || 1;
    const evenSplit = 100 / numValidators;

    return {
      value: `${theoreticalApr || '-'}% p.a.`,
      subtitle: `${uptimeValue === 0 ? '-' : `${uptimeValue.toFixed(2)}%`} uptime`,
      subtitleStatus:
        uptimeValue === 0 ? TextFieldStatus.GOOD : getUptimeStatus(validator, uptimeValue),
      secondarySubtitle: `${votingPowerValue.toFixed(2)}%`,
      secondaryStatus: getVotingPowerStatus(votingPowerValue, evenSplit),
    };
  };

  const {
    value: scrollTileValue,
    subtitle: scrollTileSubtitle,
    subtitleStatus,
    secondarySubtitle: scrollTileSecondarySubtitle,
    secondaryStatus: secondarySubtitleStatus,
  } = getTileConfig();

  // Validator icon
  const validatorIcon = (
    <IconContainer
      alt={title}
      src={validatorLogoInfo.url || undefined}
      isFallback={validatorLogoInfo.isFallback}
      icon={
        validator.jailed || validator.status === BondStatus.UNBONDED ? (
          <AlertCircleIcon className="text-error h-8 w-8" />
        ) : validatorLogoInfo.error ? (
          <NotFoundIcon className="w-full h-full" />
        ) : undefined
      }
    />
  );

  const handleClick = () => {
    if (onClick) {
      onClick(combinedStakingInfo);
    }
  };

  const handleAction = async ({ isSimulation = false }: { isSimulation?: boolean } = {}) => {
    if (!selectedAction) return;

    const actionFn = isSimulation ? runSimulation : runTransaction;

    try {
      switch (selectedAction) {
        case 'stake':
          await actionFn('stake', amount.toString());
          break;
        case 'unstake':
          await actionFn('unstake', amount.toString(), false, [delegationResponse]);
          break;
        case 'claim':
          await actionFn(
            'claim',
            '0',
            isClaimToRestake,
            [delegationResponse],
            [{ validator: validator.operator_address, rewards }],
          );
          break;
      }

      setLastUpdateTime(Date.now());
    } catch (error) {
      console.error(`Error during ${isSimulation ? 'simulation' : 'transaction'}:`, error);
    }
  };

  const resetDefaults = () => {
    // NOTE: reset atom states
    resetTransactionStates();

    // NOTE: reset local states
    setAmount(0);
    setIsClaimToRestake(false);
    setSelectedAction(null);
  };

  const canRunSimulation = () => {
    if (selectedAction === 'claim') return true;
    return amount > 0 && !isLoading && selectedAction;
  };

  useEffect(() => {
    let intervalId: NodeJS.Timeout;

    const setupInterval = () => {
      intervalId = setInterval(() => {
        if (canRunSimulation()) {
          handleAction({ isSimulation: true });
          setLastUpdateTime(Date.now());
        } else {
          clearInterval(intervalId);
        }
      }, 5000);
    };

    if (selectedAction === 'claim') {
      handleAction({ isSimulation: true });
      setLastUpdateTime(Date.now());
      setupInterval();
    } else if (canRunSimulation()) {
      if (Date.now() - lastUpdateTime > 5000) {
        handleAction({ isSimulation: true });
        setLastUpdateTime(Date.now());
      }

      setupInterval();
    }

    return () => {
      if (intervalId) {
        clearInterval(intervalId);
      }
    };
  }, [amount, isLoading, selectedAction]);

  useEffect(() => {
    const fetchValidatorLogo = async () => {
      const logoInfo = await getValidatorLogoInfo(
        validator.description,
        chainId,
        chainRegistry[networkLevel],
      );
      setValidatorLogoInfo(logoInfo);
    };

    fetchValidatorLogo();

    return () => {
      resetDefaults();
    };
  }, []);

  return (
    <>
      {isSelectable ? (
        <ScrollTile
          title={title}
          subtitle={scrollTileSubtitle}
          value={scrollTileValue}
          icon={validatorIcon}
          status={statusColor}
          selected={isSelected}
          onClick={handleClick}
        />
      ) : (
        // TODO: separate slidetray from component to reduce required build
        <SlideTray
          ref={slideTrayRef}
          triggerComponent={
            <div>
              <ScrollTile
                title={title}
                status={statusColor}
                subtitle={scrollTileSubtitle}
                subtitleStatus={subtitleStatus}
                value={scrollTileValue}
                icon={validatorIcon}
                secondarySubtitle={scrollTileSecondarySubtitle}
                secondarySubtitleStatus={secondarySubtitleStatus}
              />
            </div>
          }
          title={title}
          onClose={resetDefaults}
          showBottomBorder
          status={statusColor}
        >
          <div className="flex flex-col h-full">
            {rewards && (
              <div className="text-center mb-2">
                <div className="truncate text-base font-medium text-neutral-1">
                  Reward: <span className="text-blue">{formattedRewardAmount}</span>
                </div>
                <span className="text-grey-dark text-xs text-base">
                  Unstaking period <span className="text-warning">{unbondingDays}</span>
                </span>
              </div>
            )}

            {/* TODO: make scrollable, make into a component, and pass an array of text and color maps */}
            {/* Validator Information */}
            <div className="mb-4 min-h-[7.5rem] max-h-[7.5rem] overflow-hidden shadow-md bg-black p-2">
              <p>
                <strong>Status:</strong> <span className={textColor}>{statusLabel}</span>
              </p>
              <p className="line-clamp-1">
                {' '}
                <strong>Amount Staked:</strong> <span className="text-blue">{dialogSubTitle}</span>
              </p>
              {hasUnbonding && (
                <>
                  <p className="line-clamp-1">
                    <strong>Amount Unstaking:</strong>{' '}
                    <span className="text-warning">{amountUnstaking}</span>
                  </p>
                  <p className="line-clamp-1">
                    <strong>Remaining Time to Unstake:</strong>{' '}
                    <span className="text-warning">{unstakingTime}</span>
                  </p>
                  <p>
                    <strong>Validator Commission:</strong> <span>{commission}</span>
                  </p>
                </>
              )}
              <p className="truncate">
                <strong>Website:</strong>{' '}
                {isWebsiteValid ? (
                  <a
                    href={website.startsWith('http') ? website : `https://${website}`}
                    target="_blank"
                    rel="noopener noreferrer"
                  >
                    {website}
                  </a>
                ) : (
                  <span>{website}</span>
                )}
              </p>
              <p className="line-clamp-2 max-h-[3.5rem] overflow-hidden">
                <strong>Details:</strong> {validator.description.details}
              </p>
            </div>

            {/* Action Selection */}
            {delegation && (
              <div className="flex justify-between w-full px-2 mb-2">
                <Button
                  size="medium"
                  className="w-full"
                  onClick={() => setSelectedAction('stake')}
                  disabled={isLoading}
                >
                  Stake
                </Button>
                <Button
                  size="medium"
                  variant="secondary"
                  className="w-full mx-2"
                  onClick={() => setSelectedAction('unstake')}
                  disabled={isLoading}
                >
                  Unstake
                </Button>
                <Button
                  size="medium"
                  className="w-full"
                  onClick={() => setSelectedAction('claim')}
                  disabled={isLoading}
                >
                  Claim
                </Button>
              </div>
            )}

            <div
              className={`flex flex-grow flex-col items-center justify-center ${selectedAction === 'claim' ? '' : 'px-[1.5rem]'}`}
            >
              {isSuccess && (
                <div className="flex-grow">
                  <TransactionResultsTile
                    isSuccess
                    size="sm"
                    txHash={truncateWalletAddress('', transactionHash)}
                  />
                </div>
              )}

              {transactionFailed && (
                <TransactionResultsTile isSuccess={false} size="sm" message={transactionError} />
              )}

              {isLoading && (
                <div className="flex flex-grow items-center px-4">
                  <Loader showBackground={false} />
                </div>
              )}

              {!isLoading &&
                !isSuccess &&
                (selectedAction === 'stake' || selectedAction === 'unstake') && (
                  <div className="flex flex-col items-center w-full">
                    <AssetInput
                      placeholder={`Enter ${selectedAction} amount`}
                      variant="stake"
                      assetState={asset || DEFAULT_MAINNET_ASSET}
                      amountState={amount}
                      updateAmount={newAmount => setAmount(newAmount)}
                      reducedHeight
                      showClearAndMax
                      showEndButton
                      disableButtons={isLoading}
                      onClear={() => setAmount(0)}
                      onMax={() => {
                        if (selectedAction === 'stake') {
                          setAmount(maxAvailable);
                        } else {
                          setAmount(delegatedAmount);
                        }
                      }}
                      endButtonTitle={selectedAction === 'stake' ? 'Stake' : 'Unstake'}
                      onEndButtonClick={handleAction}
                    />
                  </div>
                )}

              {!isLoading && !isSuccess && selectedAction === 'claim' && (
                <>
                  <div className="flex justify-between items-center text-sm font-bold w-full">
                    <p className="text-sm pr-1">Claim:</p>
                    <div className="flex items-center">
                      <Button
                        variant={!isClaimToRestake ? 'selected' : 'unselected'}
                        size="xsmall"
                        className="px-1 rounded-md text-xs"
                        onClick={() => setIsClaimToRestake(false)}
                        disabled={isLoading}
                      >
                        To Wallet
                      </Button>
                      <p className="text-sm px-1">/</p>
                      <Button
                        variant={isClaimToRestake ? 'selected' : 'unselected'}
                        size="xsmall"
                        className="px-1 rounded-md text-xs"
                        onClick={() => setIsClaimToRestake(true)}
                        disabled={isLoading}
                      >
                        To Restake
                      </Button>
                    </div>
                  </div>

                  <div className="flex items-center flex-grow justify-center w-[50%] px-4">
                    <Button
                      size="small"
                      variant="secondary"
                      className="w-full"
                      disabled={isLoading}
                      onClick={() => handleAction()}
                    >
                      {`Claim ${isClaimToRestake ? 'to Restake' : 'to Wallet'}`}
                    </Button>
                  </div>
                </>
              )}
            </div>

            {/* Fee Section */}
            <div className="flex justify-between items-center text-blue text-sm font-bold w-full">
              <p>Estimated Fee</p>
              <p className={calculatedFee.textClass}>
                {calculatedFee && calculatedFee.feeAmount > 0
                  ? formatLowBalanceDisplay(`${calculatedFee.calculatedFee}`, calculatedFee.feeUnit)
                  : '-'}
              </p>
            </div>
          </div>
        </SlideTray>
      )}
    </>
  );
};

export const ValidatorTile = memo(ValidatorTileComponent);
