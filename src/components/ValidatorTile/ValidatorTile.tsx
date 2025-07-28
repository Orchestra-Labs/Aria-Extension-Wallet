import { memo, useEffect, useRef, useState } from 'react';
import { FullValidatorInfo, ValidatorLogoInfo } from '@/types';
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
  TransactionStatus,
  ValidatorAction,
} from '@/constants';
import { useAtomValue, useSetAtom } from 'jotai';
import {
  subscribedChainRegistryAtom,
  filteredValidatorsAtom,
  networkLevelAtom,
  showCurrentValidatorsAtom,
  selectedValidatorChainAtom,
  resetValidatorTransactionAtom,
  validatorErrorAtom,
  maxAvailableAtom,
  validatorTxHash,
  validatorCalculatedFeeAtom,
  chainInfoAtom,
  selectedValidatorsAtom,
  validatorTransactionStateAtom,
} from '@/atoms';
import { AssetInput } from '../AssetInput';
import { Loader } from '../Loader';
import { TransactionResultsTile } from '../TransactionResultsTile';
import { AlertCircleIcon } from 'lucide-react';
import { useValidatorActions } from '@/hooks';
import { InfoPanel, InfoPanelRow } from '../InfoPanel';

interface ValidatorTileProps {
  fullValidatorInfo: FullValidatorInfo;
  isSelectable?: boolean;
  onClick?: (validator: FullValidatorInfo) => void;
  forceCurrentViewStyle?: boolean;
}

// TODO: if no staking denom, disable staking features
const ValidatorTileComponent = ({
  fullValidatorInfo,
  isSelectable = false,
  onClick,
  forceCurrentViewStyle = false,
}: ValidatorTileProps) => {
  // Refs and state
  const slideTrayRef = useRef<{ isOpen: () => void }>(null);
  const { runTransaction, runSimulation } = useValidatorActions();

  // Atoms
  const networkLevel = useAtomValue(networkLevelAtom);
  const selectedValidators = useAtomValue(
    isSelectable ? selectedValidatorsAtom : filteredValidatorsAtom,
  );
  const chainId = useAtomValue(selectedValidatorChainAtom);
  const chainRegistry = useAtomValue(subscribedChainRegistryAtom);
  const txStatus = useAtomValue(validatorTransactionStateAtom);
  const transactionError = useAtomValue(validatorErrorAtom);
  const calculatedFee = useAtomValue(validatorCalculatedFeeAtom);
  const maxAvailable = useAtomValue(maxAvailableAtom);
  const transactionHash = useAtomValue(validatorTxHash);
  const chainInfo = useAtomValue(chainInfoAtom);
  const resetTransactionStates = useSetAtom(resetValidatorTransactionAtom);
  const showCurrentValidators = useAtomValue(showCurrentValidatorsAtom);

  // Derived data
  const chain = chainInfo(chainId);

  const [amount, setAmount] = useState(0);
  const [isClaimToRestake, setIsClaimToRestake] = useState(true);
  const [selectedAction, setSelectedAction] = useState<ValidatorAction>(ValidatorAction.NONE);
  const [validatorLogoInfo, setValidatorLogoInfo] = useState<ValidatorLogoInfo>({
    url: null,
    isFallback: false,
    error: false,
  });

  const { validator, delegation, rewards, unbondingBalance, theoreticalApr, uptime, votingPower } =
    fullValidatorInfo;
  // Asset info
  const stakingDenom = chain.staking_denoms[0];
  const asset = chain.assets?.[stakingDenom] || DEFAULT_MAINNET_ASSET;
  const symbol = asset.symbol;
  const exponent = asset.exponent || GREATER_EXPONENT_DEFAULT;

  const txIsForCurrentValidator =
    txStatus.validatorAddress === validator.operator_address &&
    txStatus.status !== TransactionStatus.IDLE;
  const isLoading = txIsForCurrentValidator && txStatus.status === TransactionStatus.LOADING;
  const isSuccess = txIsForCurrentValidator && txStatus.status === TransactionStatus.SUCCESS;
  const transactionFailed = txIsForCurrentValidator && txStatus.status === TransactionStatus.ERROR;

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

  const unbondingDays = `${fullValidatorInfo.stakingParams?.unbonding_time} days`;
  const unstakingTime = `${calculateRemainingTime(fullValidatorInfo.unbondingBalance?.completion_time || '')}`;
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
    const estimatedApr = parseFloat(theoreticalApr || '0');
    const uptimeValue = parseFloat(uptime || '0');
    const votingPowerValue = parseFloat(votingPower || '0');
    const numValidators = selectedValidators.length || 1;
    const evenSplit = 100 / numValidators;

    return {
      value: `${estimatedApr == 0 ? '-' : `${estimatedApr.toFixed(2)}%`} p.a.`,
      subtitle: `${uptimeValue == 0 ? '-' : `${uptimeValue.toFixed(2)}%`} uptime`,
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
      onClick(fullValidatorInfo);
    }
  };

  const handleAction = async ({ isSimulation = false }: { isSimulation?: boolean } = {}) => {
    if (!selectedAction) return;

    const actionFn = isSimulation ? runSimulation : runTransaction;

    try {
      switch (selectedAction) {
        case ValidatorAction.STAKE:
          await actionFn({
            action: ValidatorAction.STAKE,
            amount: amount.toString(),
            validatorInfoArray: [fullValidatorInfo],
          });
          break;
        case ValidatorAction.UNSTAKE:
          await actionFn({
            action: ValidatorAction.UNSTAKE,
            amount: amount.toString(),
            validatorInfoArray: [fullValidatorInfo],
          });
          break;
        case ValidatorAction.CLAIM:
          await actionFn({
            action: ValidatorAction.CLAIM,
            validatorInfoArray: [fullValidatorInfo],
            toRestake: isClaimToRestake,
          });
          break;
      }
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
    setSelectedAction(ValidatorAction.NONE);
  };

  const canRunSimulation = () => {
    if (selectedAction === ValidatorAction.CLAIM) return true;
    return amount > 0 && !isLoading && selectedAction;
  };

  useEffect(() => {
    // Use a ref to track the timeout
    const timeoutRef = { current: null as NodeJS.Timeout | null };

    const runSimulation = () => {
      if (canRunSimulation()) {
        handleAction({ isSimulation: true });
        // Schedule next run
        timeoutRef.current = setTimeout(runSimulation, 5000);
      }
    };

    // Run immediately if conditions are met and it's been more than 5 seconds
    if (canRunSimulation()) {
      // Clear any existing timeout
      if (timeoutRef.current) {
        clearTimeout(timeoutRef.current);
      }

      handleAction({ isSimulation: true });
    }

    // Setup the recurring simulation
    if (canRunSimulation()) {
      timeoutRef.current = setTimeout(runSimulation, 5000);
    }

    return () => {
      // Cleanup on unmount or dependency change
      if (timeoutRef.current) {
        clearTimeout(timeoutRef.current);
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

            {/* Validator Information */}
            <InfoPanel>
              <InfoPanelRow
                label="Status"
                value={<span className={textColor}>{statusLabel}</span>}
              />
              <InfoPanelRow
                label="Amount Staked"
                value={<span className="text-blue">{dialogSubTitle}</span>}
              />
              <InfoPanelRow
                label="APR"
                value={
                  <span className="text-blue">
                    {theoreticalApr
                      ? parseFloat(theoreticalApr) == 0
                        ? 'Not found'
                        : parseFloat(theoreticalApr)
                      : 'Not Found'}
                  </span>
                }
              />
              <InfoPanelRow
                label="Uptime"
                value={
                  <span className="text-blue">
                    {uptime
                      ? parseFloat(uptime) == 0
                        ? 'Not Found'
                        : parseFloat(uptime)
                      : 'Not Found'}
                  </span>
                }
              />
              <InfoPanelRow
                label="Voting Power"
                value={<span className="text-blue">{votingPower ? `${votingPower}%` : '-'}</span>}
              />

              {hasUnbonding && (
                <>
                  <InfoPanelRow
                    label="Amount Unstaking"
                    value={<span className="text-warning">{amountUnstaking}</span>}
                  />
                  <InfoPanelRow
                    label="Remaining Time to Unstake"
                    value={<span className="text-warning">{unstakingTime}</span>}
                  />
                  <InfoPanelRow label="Validator Commission" value={commission} />
                </>
              )}

              <InfoPanelRow
                label="Website"
                value={
                  isWebsiteValid ? (
                    <a
                      href={website.startsWith('http') ? website : `https://${website}`}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="truncate"
                    >
                      {website}
                    </a>
                  ) : (
                    <span>{website}</span>
                  )
                }
              />

              <InfoPanelRow
                label="Details"
                value={validator.description.details}
                className="line-clamp-2"
              />
            </InfoPanel>

            {/* Action Selection */}
            {delegation && (
              <div className="flex justify-between w-full px-2 mb-2">
                <Button
                  size="medium"
                  className="w-full"
                  onClick={() => setSelectedAction(ValidatorAction.STAKE)}
                  disabled={isLoading || selectedAction === ValidatorAction.STAKE}
                >
                  Stake
                </Button>
                <Button
                  size="medium"
                  variant="secondary"
                  className="w-full mx-2"
                  onClick={() => setSelectedAction(ValidatorAction.UNSTAKE)}
                  disabled={isLoading || selectedAction === ValidatorAction.UNSTAKE}
                >
                  Unstake
                </Button>
                <Button
                  size="medium"
                  className="w-full"
                  onClick={() => setSelectedAction(ValidatorAction.CLAIM)}
                  disabled={isLoading || selectedAction === ValidatorAction.CLAIM}
                >
                  Claim
                </Button>
              </div>
            )}

            <div
              className={`flex flex-grow flex-col items-center justify-center ${selectedAction === ValidatorAction.CLAIM ? '' : 'px-[1.5rem]'}`}
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
                (selectedAction === ValidatorAction.STAKE ||
                  selectedAction === ValidatorAction.UNSTAKE) && (
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
                        if (selectedAction === ValidatorAction.STAKE) {
                          setAmount(maxAvailable);
                        } else {
                          setAmount(delegatedAmount);
                        }
                      }}
                      endButtonTitle={
                        selectedAction === ValidatorAction.STAKE ? 'Stake' : 'Unstake'
                      }
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
