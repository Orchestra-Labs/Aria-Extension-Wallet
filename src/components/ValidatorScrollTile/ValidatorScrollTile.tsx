import { useEffect, useRef, useState } from 'react';
import { CombinedStakingInfo, TransactionResult } from '@/types';
import { SlideTray, Button } from '@/ui-kit';
import { LogoIcon } from '@/assets/icons';
import { ScrollTile } from '../ScrollTile';
import {
  calculateRemainingTime,
  claimAndRestake,
  claimRewards,
  convertToGreaterUnit,
  formatBalanceDisplay,
  isValidUrl,
  selectTextColorByStatus,
  stakeToValidator,
  truncateWalletAddress,
  unstakeFromValidator,
} from '@/helpers';
import {
  BondStatus,
  DEFAULT_ASSET,
  GREATER_EXPONENT_DEFAULT,
  LOCAL_ASSET_REGISTRY,
  TextFieldStatus,
  TransactionType,
} from '@/constants';
import { useAtomValue } from 'jotai';
import { filteredValidatorsAtom, showCurrentValidatorsAtom, walletStateAtom } from '@/atoms';
import { AssetInput } from '../AssetInput';
import { Loader } from '../Loader';
import { useRefreshData, useToast } from '@/hooks';
import { TransactionResultsTile } from '../TransactionResultsTile';

// TODO: for the case where the user is unstaking all and the filtered validators would not include this tray, if this causes graphical errors, swipe away the tray and show toast
interface ValidatorScrollTileProps {
  combinedStakingInfo: CombinedStakingInfo;
  isSelectable?: boolean;
  onClick?: (validator: CombinedStakingInfo) => void;
}

export const ValidatorScrollTile = ({
  combinedStakingInfo,
  isSelectable = false,
  onClick,
}: ValidatorScrollTileProps) => {
  const { toast } = useToast();
  const slideTrayRef = useRef<{ isOpen: () => void }>(null);
  const { refreshData } = useRefreshData();

  const selectedValidators = useAtomValue(filteredValidatorsAtom);
  const walletState = useAtomValue(walletStateAtom);
  const showCurrentValidators = useAtomValue(showCurrentValidatorsAtom);

  const [amount, setAmount] = useState(0);
  const [isLoading, setIsLoading] = useState<boolean>(false);
  const [error, setError] = useState<string>('');
  const [isClaimToRestake, setIsClaimToRestake] = useState<boolean>(true);
  const [selectedAction, setSelectedAction] = useState<'stake' | 'unstake' | 'claim' | null>(
    !combinedStakingInfo.delegation ? 'stake' : null,
  );
  const [transactionSuccess, setTransactionSuccess] = useState<{
    success: boolean;
    txHash?: string;
  }>({
    success: false,
  });
  const [simulatedFee, setSimulatedFee] = useState<{
    fee: string;
    textClass: 'text-error' | 'text-warn' | 'text-blue';
  } | null>({ fee: '0 MLD', textClass: 'text-blue' });

  const { validator, delegation, balance, rewards, unbondingBalance } = combinedStakingInfo;
  const delegationResponse = { delegation, balance };

  const symbol = LOCAL_ASSET_REGISTRY.note.symbol || DEFAULT_ASSET.symbol || 'MLD';

  // Aggregating the rewards (sum all reward amounts for this validator)
  const rewardAmount = rewards
    .reduce((sum, reward) => sum + parseFloat(reward.amount), 0)
    .toString();
  const strippedRewardAmount = `${convertToGreaterUnit(
    parseFloat(rewardAmount),
    GREATER_EXPONENT_DEFAULT,
  ).toFixed(GREATER_EXPONENT_DEFAULT)}`;
  const userHasUnbonding = unbondingBalance && parseFloat(unbondingBalance?.balance || '') > 0;
  const formattedRewardAmount = formatBalanceDisplay(strippedRewardAmount, symbol);
  const delegatedAmount = convertToGreaterUnit(
    parseFloat(delegation.shares || '0'),
    GREATER_EXPONENT_DEFAULT,
  );
  const userIsUnbonding = userHasUnbonding && delegatedAmount === 0;

  const title = validator.description.moniker || 'Unknown Validator';
  const commission = `${parseFloat(validator.commission.commission_rates.rate) * 100}%`;
  const isSelected = selectedValidators.some(
    v => v.delegation.validator_address === combinedStakingInfo.delegation.validator_address,
  );

  const slideTrayIsOpen = slideTrayRef.current && slideTrayRef.current.isOpen();

  let subTitle: string;
  if (validator.jailed) {
    subTitle = 'Jailed';
  } else if (validator.status === BondStatus.UNBONDED) {
    subTitle = 'Inactive';
  } else if (userIsUnbonding) {
    subTitle = 'Unstaking';
  } else if (delegatedAmount === 0) {
    subTitle = 'No delegation';
  } else {
    const formattedDelegatedAmount = formatBalanceDisplay(`${delegatedAmount}`, symbol);
    subTitle = `${formattedDelegatedAmount}`;
  }

  const dialogSubTitle = formatBalanceDisplay(
    `${isNaN(delegatedAmount) ? 0 : delegatedAmount}`,
    symbol,
  );

  const unbondingDays = `${combinedStakingInfo.stakingParams?.unbonding_time} days`;
  const unstakingTime = `${calculateRemainingTime(combinedStakingInfo.unbondingBalance?.completion_time || '')}`;

  let statusLabel = '';
  let statusColor = TextFieldStatus.GOOD;
  if (validator.jailed) {
    statusLabel = 'Jailed';
    statusColor = TextFieldStatus.ERROR;
  } else if (validator.status === BondStatus.UNBONDING) {
    statusLabel = 'Unbonding';
    statusColor = TextFieldStatus.WARN;
  } else if (validator.status === BondStatus.UNBONDED) {
    statusLabel = 'Inactive';
    statusColor = TextFieldStatus.WARN;
  } else {
    statusLabel = 'Active';
    statusColor = TextFieldStatus.GOOD;
  }

  const textColor = selectTextColorByStatus(statusColor);

  // Validator website validation
  const website = validator.description.website;
  const isWebsiteValid = isValidUrl(website);

  const handleClick = () => {
    if (onClick) {
      onClick(combinedStakingInfo);
    }
  };

  const handleTransactionSuccess = (transactionType: TransactionType, txHash: string) => {
    const slideTrayIsOpen = slideTrayRef.current && slideTrayRef.current.isOpen();

    if (slideTrayIsOpen) {
      setSelectedAction(null);
      setTransactionSuccess(prev => ({
        ...prev,
        success: true,
        txHash,
      }));

      // Set timeout to reset success state after 3 seconds (3000 ms)
      setTimeout(() => {
        setTransactionSuccess(prev => ({
          ...prev,
          success: false,
        }));
      }, 3000);
    } else {
      const displayTransactionHash = truncateWalletAddress('', txHash as string);

      toast({
        title: `${transactionType} success!`,
        description: `Transaction hash: ${displayTransactionHash}`,
      });

      setTransactionSuccess(prev => ({
        ...prev,
        success: false,
      }));
    }
  };

  const handleTransactionError = (transactionType: TransactionType, errorMessage: string) => {
    const slideTrayIsOpen = slideTrayRef.current && slideTrayRef.current.isOpen();

    if (slideTrayIsOpen) {
      setError(errorMessage);

      setTimeout(() => {
        setError('');
      }, 3000);
    } else {
      toast({
        title: `${transactionType} failed!`,
        description: errorMessage,
      });
      setError('');
    }
  };

  const handleStake = async (amount: string, isSimulation: boolean = false) => {
    if (!isSimulation) setIsLoading(true);

    const txType = TransactionType.STAKE;
    try {
      const result = await stakeToValidator(
        amount,
        LOCAL_ASSET_REGISTRY.note.denom,
        walletState.address,
        validator.operator_address,
        isSimulation,
      );

      if (isSimulation) return result;

      if (result.success && result.data?.code === 0) {
        const txHash = result.data.txHash as string;

        handleTransactionSuccess(txType, txHash);
      } else {
        const errorMessage = `Stake failed: ${result.message || 'No error message provided'}`;
        handleTransactionError(txType, errorMessage);
      }
    } catch (error) {
      const errorMessage = `Stake failed: ${error || 'No error message provided'}`;
      handleTransactionError(txType, errorMessage);
    } finally {
      if (!isSimulation) setIsLoading(false);
    }
  };

  const handleUnstake = async (amount: string, isSimulation: boolean = false) => {
    if (!isSimulation) setIsLoading(true);

    const txType = TransactionType.UNSTAKE;
    try {
      const result = await unstakeFromValidator({
        amount,
        delegations: delegationResponse,
        simulateOnly: isSimulation,
      });

      if (isSimulation) return result;

      if (result.success && result.data?.code === 0) {
        const txHash = result.data.txHash as string;

        handleTransactionSuccess(txType, txHash);
      } else {
        const errorMessage = `Unstake failed: ${result.message || 'No error message provided'}`;
        handleTransactionError(txType, errorMessage);
      }
    } catch (error) {
      const errorMessage = `Unstake failed: ${error || 'No error message provided'}`;
      handleTransactionError(txType, errorMessage);
    } finally {
      if (!isSimulation) setIsLoading(false);
    }
  };

  const handleClaimToWallet = async (isSimulation: boolean = false) => {
    if (!isSimulation) setIsLoading(true);

    const txType = TransactionType.CLAIM_TO_WALLET;
    try {
      const result = await claimRewards(
        walletState.address,
        validator.operator_address,
        isSimulation,
      );

      if (isSimulation) return result;

      if (result.success && result.data?.code === 0) {
        const txHash = result.data.txHash as string;

        handleTransactionSuccess(txType, txHash);
      } else {
        const errorMessage = `Claim failed: ${result.message || 'No error message provided'}`;
        handleTransactionError(txType, errorMessage);
      }
    } catch (error) {
      const errorMessage = `Claim failed: ${error || 'No error message provided'}`;
      handleTransactionError(txType, errorMessage);
    } finally {
      if (!isSimulation) setIsLoading(false);
    }
  };

  const handleClaimAndRestake = async (isSimulation: boolean = true) => {
    if (!isSimulation) setIsLoading(true);

    const txType = TransactionType.CLAIM_TO_RESTAKE;
    try {
      const result = await claimAndRestake(
        delegationResponse,
        [
          {
            validator: validator.operator_address,
            rewards: rewards,
          },
        ],
        isSimulation,
      );

      if (isSimulation) return result;

      if (result.success && result.data?.code === 0) {
        const txHash = result.data.txHash as string;
        handleTransactionSuccess(txType, txHash);
      } else {
        const errorMessage = `Claim failed: ${result.message || 'No error message provided'}`;
        handleTransactionError(txType, errorMessage);
      }
    } catch (error) {
      const errorMessage = `Claim and restake failed: ${error || 'No error message provided'}`;
      handleTransactionError(txType, errorMessage);
    } finally {
      if (!isSimulation) setIsLoading(false);
    }
  };

  // TODO: extract to utils
  const formatFee = (gasWanted: number) => {
    const defaultGasPrice = 0.025;
    const exponent = GREATER_EXPONENT_DEFAULT;
    const symbol = DEFAULT_ASSET.symbol || 'MLD';
    const feeAmount = gasWanted * defaultGasPrice;
    const feeInGreaterUnit = feeAmount / Math.pow(10, exponent);

    // Calculate against stake or unstake input or rewards amount
    let feePercentage = 0;
    if (selectedAction === 'claim') {
      feePercentage = feeInGreaterUnit ? (feeInGreaterUnit / rewardAmount) * 100 : 0;
    } else if (selectedAction === 'stake' || selectedAction === 'unstake') {
      feePercentage = feeInGreaterUnit ? (feeInGreaterUnit / amount) * 100 : 0;
    }

    setSimulatedFee({
      fee: formatBalanceDisplay(feeInGreaterUnit.toFixed(exponent), symbol),
      textClass:
        feePercentage > 1 ? 'text-error' : feePercentage > 0.75 ? 'text-warn' : 'text-blue',
    });
  };

  const updateFee = async () => {
    if (selectedAction !== 'claim' && (amount === 0 || isNaN(amount))) {
      formatFee(0);
    } else {
      let result = { success: false, message: '', data: { gasWanted: '' } } as TransactionResult;

      if (selectedAction === 'claim') {
        result = (
          isClaimToRestake ? await handleClaimAndRestake(true) : await handleClaimToWallet(true)
        ) as TransactionResult;
      } else if (selectedAction === 'stake') {
        result = (await handleStake(amount.toString(), true)) as TransactionResult;
      } else if (selectedAction === 'unstake') {
        result = (await handleUnstake(amount.toString(), true)) as TransactionResult;
      }

      formatFee(parseFloat(result.data?.gasWanted || '0'));
    }
  };

  const resetDefaults = () => {
    setAmount(0);
    setSimulatedFee({ fee: '0 MLD', textClass: 'text-blue' });
    setIsClaimToRestake(false);
    setSelectedAction(null);
  };

  // let showingCurrentValidators = isSelectable && showCurrentValidators;
  let value = formattedRewardAmount;
  let secondarySubtitle = null;
  let subtitleStatus = TextFieldStatus.GOOD;
  let secondarySubtitleStatus = TextFieldStatus.GOOD;

  // TODO: fix tile showing amount unstaking as expected percent rewards on all tile when tray is open
  if (showCurrentValidators) {
    if (userHasUnbonding) {
      value = formatBalanceDisplay(
        convertToGreaterUnit(
          parseFloat(unbondingBalance?.balance || '0'),
          GREATER_EXPONENT_DEFAULT,
        ).toFixed(GREATER_EXPONENT_DEFAULT),
        'MLD',
      );

      if (userIsUnbonding) {
        statusColor = TextFieldStatus.WARN;
        secondarySubtitle = 'Unstaking...';
      }
    }
  } else {
    // TODO: uncomment when uptime is fixed
    // const uptime = parseFloat(combinedStakingInfo.uptime || '0');
    // subTitle = `${uptime}% uptime`;

    value = `${combinedStakingInfo.estimatedReturn || 0}%`;

    const votingPower = parseFloat(combinedStakingInfo.votingPower || '0');
    secondarySubtitle = `${votingPower || 0}%`;

    // if (uptime < 80) {
    //   subtitleStatus = TextFieldStatus.ERROR;
    // } else if (uptime < 90) {
    //   subtitleStatus = TextFieldStatus.WARN;
    // }

    if (votingPower > 1.5) {
      secondarySubtitleStatus = TextFieldStatus.ERROR;
    } else if (votingPower > 1.25) {
      secondarySubtitleStatus = TextFieldStatus.WARN;
    }
  }

  useEffect(() => {
    if (slideTrayIsOpen) updateFee();
  }, [slideTrayIsOpen, selectedAction, amount, isClaimToRestake]);

  useEffect(() => {
    if (transactionSuccess.success) {
      refreshData();
    }
  }, [transactionSuccess.success]);

  return (
    <>
      {isSelectable ? (
        <ScrollTile
          title={title}
          subtitle={subTitle}
          value={formattedRewardAmount}
          icon={<LogoIcon />}
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
                subtitle={subTitle}
                subtitleStatus={subtitleStatus}
                value={value}
                icon={<LogoIcon />}
                secondarySubtitle={secondarySubtitle}
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
              {userHasUnbonding && (
                <>
                  <p className="line-clamp-1">
                    <strong>Amount Unstaking:</strong> <span className="text-warning">{value}</span>
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
              {transactionSuccess.success && (
                <div className="flex-grow">
                  <TransactionResultsTile
                    isSuccess
                    size="sm"
                    txHash={truncateWalletAddress('', transactionSuccess.txHash as string)}
                  />
                </div>
              )}

              {error && <TransactionResultsTile isSuccess={false} size="sm" message={error} />}

              {isLoading && (
                <div className="flex flex-grow items-center px-4">
                  <Loader showBackground={false} />
                </div>
              )}

              {!isLoading && (selectedAction === 'stake' || selectedAction === 'unstake') && (
                <div className="flex flex-col items-center w-full">
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
                    onMax={() => setAmount(delegatedAmount)}
                    endButtonTitle={selectedAction === 'stake' ? 'Stake' : 'Unstake'}
                    onEndButtonClick={() => {
                      selectedAction === 'stake'
                        ? handleStake(amount.toString())
                        : handleUnstake(amount.toString());
                    }}
                  />
                </div>
              )}

              {!isLoading && selectedAction === 'claim' && (
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
                      onClick={() =>
                        isClaimToRestake ? handleClaimAndRestake(false) : handleClaimToWallet(false)
                      }
                    >
                      {`Claim ${isClaimToRestake ? 'to Restake' : 'to Wallet'}`}
                    </Button>
                  </div>
                </>
              )}
            </div>

            {/* Fee Section */}
            <div className="flex justify-between items-center text-blue text-sm font-bold w-full">
              <p>Fee</p>
              <p className={simulatedFee?.textClass}>
                {simulatedFee && selectedAction ? simulatedFee.fee : '-'}
              </p>
            </div>
          </div>
        </SlideTray>
      )}
    </>
  );
};
