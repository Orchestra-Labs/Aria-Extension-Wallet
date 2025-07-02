import React, { useEffect, useRef, useState } from 'react';
import { Button, SlideTray } from '@/ui-kit';
import { TileScroller } from '../TileScroller';
import { SortDialog } from '../SortDialog';
import { useAtom, useAtomValue, useSetAtom } from 'jotai';
import {
  chainRegistryAtom,
  dialogSearchTermAtom,
  filteredDialogValidatorsAtom,
  selectedValidatorsAtom,
  validatorDialogSortOrderAtom,
  validatorDialogSortTypeAtom,
} from '@/atoms';
import { SearchBar } from '../SearchBar';
import {
  claimAndRestake,
  claimRewards,
  formatBalanceDisplay,
  truncateWalletAddress,
  claimAndUnstake,
} from '@/helpers';
import { CombinedStakingInfo, Uri } from '@/types';
import { useRefreshData, useToast } from '@/hooks';
import {
  DEFAULT_ASSET,
  DEFAULT_CHAIN_ID,
  GREATER_EXPONENT_DEFAULT,
  TransactionType,
  ValidatorSortType,
} from '@/constants';
import { TransactionResultsTile } from '../TransactionResultsTile';
import { Loader } from '../Loader';

interface ValidatorSelectDialogProps {
  buttonText: string;
  buttonVariant?: string;
  isClaimDialog?: boolean;
}

export const ValidatorSelectDialog: React.FC<ValidatorSelectDialogProps> = ({
  buttonText,
  buttonVariant,
  isClaimDialog = false,
}) => {
  const { toast } = useToast();
  const slideTrayRef = useRef<{ isOpen: () => void }>(null);
  const { refreshData } = useRefreshData();

  const setSearchTerm = useSetAtom(dialogSearchTermAtom);
  const setSortOrder = useSetAtom(validatorDialogSortOrderAtom);
  const setSortType = useSetAtom(validatorDialogSortTypeAtom);
  const [selectedValidators, setSelectedValidators] = useAtom(selectedValidatorsAtom);
  const filteredValidators = useAtomValue(filteredDialogValidatorsAtom);
  const chainRegistry = useAtomValue(chainRegistryAtom);

  const [isLoading, setIsLoading] = useState<boolean>(false);
  const [error, setError] = useState<string>('');
  const [isClaimToRestake, setIsClaimToRestake] = useState<boolean>(true);
  const [transactionSuccess, setTransactionSuccess] = useState<{
    transactionType?: TransactionType;
    success: boolean;
    txHash?: string;
  }>({
    success: false,
  });
  const [simulatedFee, setSimulatedFee] = useState<{
    fee: string;
    textClass: 'text-error' | 'text-warn' | 'text-blue';
  } | null>({ fee: '0 MLD', textClass: 'text-blue' });

  // TODO: need to be able to change chain to stake to other chains
  const restUris = chainRegistry[DEFAULT_CHAIN_ID].rest_uris;
  const rpcUris = chainRegistry[DEFAULT_CHAIN_ID].rpc_uris;

  const allValidatorsSelected = selectedValidators.length === filteredValidators.length;
  const noValidatorsSelected = selectedValidators.length === 0;

  const unbondingDays = `${filteredValidators[0]?.stakingParams?.unbonding_time || 0} days`;
  const slideTrayIsOpen = slideTrayRef.current && slideTrayRef.current.isOpen();

  const calculateTotalRewards = () => {
    const totalRewards = selectedValidators.reduce((sum, validator) => {
      const totalReward = validator.rewards.reduce(
        (rewardSum, reward) => rewardSum + parseFloat(reward.amount),
        0,
      );
      return sum + totalReward;
    }, 0);

    return totalRewards;
  };

  const calculateTotalDelegations = () => {
    const totalDelegations = selectedValidators.reduce(
      (sum, validator) => sum + parseFloat(validator.delegation.shares || '0'),
      0,
    );

    return totalDelegations;
  };

  const setAsLoading = (transactionType: TransactionType) => {
    setIsLoading(true);
    setTransactionSuccess(prev => ({
      ...prev,
      transactionType: transactionType,
    }));
  };

  const handleTransactionSuccess = (txHash: string) => {
    if (slideTrayIsOpen) {
      setTransactionSuccess(prev => ({
        ...prev,
        success: true,
        txHash,
      }));

      setTimeout(() => {
        setTransactionSuccess(prev => ({
          ...prev,
          success: false,
        }));
      }, 3000);
    } else {
      const displayTransactionHash = truncateWalletAddress('', transactionSuccess.txHash as string);

      toast({
        title: `${transactionSuccess.transactionType} success!`,
        description: `Transaction hash: ${displayTransactionHash}`,
      });
      setTransactionSuccess(prev => ({
        ...prev,
        success: false,
      }));
    }
  };

  const handleTransactionError = (errorMessage: string) => {
    if (slideTrayIsOpen) {
      setError(errorMessage);

      setTimeout(() => {
        setError('');
      }, 3000);
    } else {
      toast({
        title: `${transactionSuccess.transactionType} failed!`,
        description: errorMessage,
      });
      setError('');
    }
  };

  const resetDefaults = () => {
    setSearchTerm('');
    setSortOrder('Desc');
    setSortType(ValidatorSortType.NAME);
    setSelectedValidators([]);
    setIsClaimToRestake(true);
  };

  const handleSelectAll = () => {
    setSelectedValidators(filteredValidators);
  };

  const handleSelectNone = () => {
    setSelectedValidators([]);
  };

  const handleValidatorSelect = (validator: CombinedStakingInfo) => {
    setSelectedValidators(prev =>
      prev.some(v => v.delegation.validator_address === validator.delegation.validator_address)
        ? prev.filter(
            v => v.delegation.validator_address !== validator.delegation.validator_address,
          )
        : [...prev, validator],
    );
  };

  const handleClaimToWallet = async (isSimulation: boolean = false) => {
    if (!isSimulation) setAsLoading(TransactionType.CLAIM_TO_WALLET);

    try {
      const result = await claimRewards(
        filteredValidators[0].delegation.delegator_address,
        selectedValidators.map(v => v.delegation.validator_address),
        rpcUris,
        isSimulation,
      );

      if (isSimulation) return result;

      if (result.success && result.data?.code === 0) {
        handleTransactionSuccess(result.data.txHash as string);
      } else {
        const errorMessage = `Claim failed: ${result.message || 'No error message provided'}`;
        handleTransactionError(errorMessage);
      }
    } catch (error) {
      const errorMessage = `Claim failed: ${error || 'No error message provided'}`;
      handleTransactionError(errorMessage);
    } finally {
      if (!isSimulation) setIsLoading(false);
    }
  };

  const handleClaimAndRestake = async (rpcUris: Uri[], isSimulation: boolean = false) => {
    if (!isSimulation) setAsLoading(TransactionType.CLAIM_TO_RESTAKE);

    try {
      const validatorRewards = selectedValidators.map(v => ({
        validator: v.delegation.validator_address,
        rewards: v.rewards,
      }));

      const claimResult = await claimAndRestake(
        restUris,
        rpcUris,
        selectedValidators.map(v => ({
          delegation: v.delegation,
          balance: v.balance,
        })),
        validatorRewards,
        isSimulation,
      );

      if (isSimulation) return claimResult;

      if (claimResult.success && claimResult.data?.code === 0) {
        handleTransactionSuccess(claimResult.data.txHash as string);
      } else {
        const errorMessage = `Claim to restake failed: ${claimResult.message || 'No error message provided'}`;
        handleTransactionError(errorMessage);
      }
    } catch (error) {
      const errorMessage = `Claim to restake failed: ${error || 'No error message provided'}`;
      handleTransactionError(errorMessage);
    } finally {
      if (!isSimulation) setIsLoading(false);
    }
  };

  const handleUnstake = async (simulateOnly: boolean = false) => {
    if (!simulateOnly) setAsLoading(TransactionType.UNSTAKE);

    const delegations = selectedValidators.map(validator => ({
      delegation: validator.delegation,
      balance: validator.balance,
    }));

    try {
      const result = await claimAndUnstake({
        rpcUris,
        delegations: delegations,
        simulateOnly,
      });

      if (simulateOnly) return result;

      if (result.success && result.data?.code === 0) {
        handleTransactionSuccess(result.data.txHash as string);
      } else {
        const errorMessage = `Unstake failed: ${result.message || 'No error message provided'}`;
        handleTransactionError(errorMessage);
      }
    } catch (error) {
      const errorMessage = `Unstake failed: ${error || 'No error message provided'}`;
      handleTransactionError(errorMessage);
    } finally {
      if (!simulateOnly) setIsLoading(false);
    }
  };

  const formatFee = (amount: number, gasWanted: number) => {
    const defaultGasPrice = 0.025;
    const exponent = GREATER_EXPONENT_DEFAULT;
    const symbol = DEFAULT_ASSET.symbol || 'MLD';
    const feeAmount = gasWanted * defaultGasPrice;
    const feeInGreaterUnit = feeAmount / Math.pow(10, exponent);

    const feePercentage = feeInGreaterUnit ? (feeInGreaterUnit / amount) * 100 : 0;

    setSimulatedFee({
      fee: formatBalanceDisplay(feeInGreaterUnit.toFixed(exponent), symbol),
      textClass:
        feePercentage > 1 ? 'text-error' : feePercentage > 0.75 ? 'text-warn' : 'text-blue',
    });
  };

  const updateFee = async () => {
    if (noValidatorsSelected) {
      return;
    }

    try {
      let totalAmount = isClaimDialog ? calculateTotalRewards() : calculateTotalDelegations();
      let simulationResult = isClaimDialog
        ? isClaimToRestake
          ? await handleClaimAndRestake(rpcUris, true)
          : await handleClaimToWallet(true)
        : await handleUnstake(true);

      if (simulationResult) {
        formatFee(totalAmount, parseFloat(simulationResult.data?.gasWanted || '0'));
      }
    } catch (error) {
      console.error('Simulation error:', error);
    }
  };

  useEffect(() => {
    if (slideTrayIsOpen && !isLoading) updateFee();
  }, [slideTrayIsOpen, selectedValidators, isClaimDialog, isLoading]);

  useEffect(() => {
    if (transactionSuccess.success) {
      refreshData();
    }
  }, [transactionSuccess.success]);

  return (
    <SlideTray
      ref={slideTrayRef}
      triggerComponent={
        <Button variant={buttonVariant} className="w-full">
          {buttonText}
        </Button>
      }
      title={isClaimDialog ? 'Claim' : 'Unstake'}
      onClose={resetDefaults}
      showBottomBorder
      reducedTopMargin={true}
    >
      <div className="flex flex-col h-full">
        {isClaimDialog ? (
          <div className="flex justify-center text-center">
            <div className="flex items-center">
              <p className="text-sm pr-1">Claim:</p>
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
        ) : (
          <div className="text-center">
            <span className="text-grey-dark text-xs text-base">
              Unstaking period <span className="text-warning">{unbondingDays}</span>
            </span>
          </div>
        )}

        <div className="flex justify-between items-center px-2">
          <div className="flex-1 text-sm">Tap to select</div>
          <div className="flex items-center">
            <Button
              variant={allValidatorsSelected ? 'selected' : 'unselected'}
              size="xsmall"
              className="px-1 rounded-md text-xs"
              onClick={handleSelectAll}
              disabled={isLoading}
            >
              All
            </Button>
            <p className="text-sm px-1">/</p>
            <Button
              variant={noValidatorsSelected ? 'selected' : 'unselected'}
              size="xsmall"
              className="px-1 rounded-md text-xs"
              onClick={handleSelectNone}
              disabled={isLoading}
            >
              None
            </Button>
          </div>
          <div className="flex-1 flex justify-end">
            <SortDialog isValidatorSort isDialog />
          </div>
        </div>

        {transactionSuccess.success || isLoading ? (
          <div className="flex flex-col flex-grow w-full border border-neutral-3 rounded-md items-center justify-center px-[1.5rem]">
            {isLoading && (
              <div className="flex flex-grow items-center px-4">
                <Loader showBackground={false} />
              </div>
            )}

            {transactionSuccess.success && (
              <TransactionResultsTile
                isSuccess
                txHash={truncateWalletAddress('', transactionSuccess.txHash as string)}
                size="md"
              />
            )}

            {error && <TransactionResultsTile isSuccess={false} size="md" message={error} />}
          </div>
        ) : (
          <TileScroller
            activeIndex={1}
            onSelectValidator={handleValidatorSelect}
            isSelectable
            isDialog
          />
        )}

        <SearchBar isDialog isValidatorSearch />

        <div className="flex justify-center space-x-4">
          <Button
            variant="secondary"
            size="medium"
            className="mb-1 w-[44%]"
            disabled={selectedValidators.length === 0 || isLoading}
            onClick={() =>
              isClaimDialog
                ? isClaimToRestake
                  ? handleClaimAndRestake(rpcUris, false)
                  : handleClaimToWallet(false)
                : handleUnstake(false)
            }
          >
            {isClaimDialog ? `Claim ${isClaimToRestake ? 'to Restake' : 'to Wallet'}` : 'Unstake'}
          </Button>
        </div>

        <div className="flex justify-between items-center text-blue text-sm font-bold w-full">
          <p>Fee</p>
          <p className={simulatedFee?.textClass}>
            {simulatedFee && selectedValidators.length > 0 ? simulatedFee.fee : '-'}
          </p>
        </div>
      </div>
    </SlideTray>
  );
};
