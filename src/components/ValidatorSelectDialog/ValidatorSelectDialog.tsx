import React, { useEffect, useRef, useState } from 'react';
import { Button, SlideTray } from '@/ui-kit';
import { SortDialog } from '../SortDialog';
import { useAtom, useAtomValue, useSetAtom } from 'jotai';
import {
  dialogSearchTermAtom,
  selectedValidatorsAtom,
  validatorDialogSortOrderAtom,
  validatorDialogSortTypeAtom,
  resetValidatorTransactionAtom,
  isValidatorTxLoadingAtom,
  isValidatorTxSuccessAtom,
  validatorErrorAtom,
  validatorTxFailedAtom,
  validatorTxHash,
  validatorCalculatedFeeAtom,
  dialogValidatorsAtom,
} from '@/atoms';
import { SearchBar } from '../SearchBar';
import { formatBalanceDisplay, truncateWalletAddress } from '@/helpers';
import { FullValidatorInfo } from '@/types';
import { useRefreshData, useValidatorActions } from '@/hooks';
import { ValidatorSortType, SortOrder, SearchType, ValidatorAction } from '@/constants';
import { TransactionResultsTile } from '../TransactionResultsTile';
import { Loader } from '../Loader';
import { ValidatorScroller } from '../ValidatorScroller';

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
  const slideTrayRef = useRef<{ isOpen: () => void }>(null);

  const { refreshData } = useRefreshData();
  const { runTransaction, runSimulation } = useValidatorActions();

  const setSearchTerm = useSetAtom(dialogSearchTermAtom);
  const setSortOrder = useSetAtom(validatorDialogSortOrderAtom);
  const setSortType = useSetAtom(validatorDialogSortTypeAtom);
  const [selectedValidators, setSelectedValidators] = useAtom(selectedValidatorsAtom);
  const getDialogValidators = useAtomValue(dialogValidatorsAtom);
  const isLoading = useAtomValue(isValidatorTxLoadingAtom);
  const isSuccess = useAtomValue(isValidatorTxSuccessAtom);
  const transactionError = useAtomValue(validatorErrorAtom);
  const transactionFailed = useAtomValue(validatorTxFailedAtom);
  const transactionHash = useAtomValue(validatorTxHash);
  const calculatedFee = useAtomValue(validatorCalculatedFeeAtom);
  const resetTransactionStates = useSetAtom(resetValidatorTransactionAtom);
  const filteredValidators = getDialogValidators(isClaimDialog);

  const [isClaimToRestake, setIsClaimToRestake] = useState<boolean>(true);
  const [isTransactionInProgress, setIsTransactionInProgress] = useState(false);

  const searchType = SearchType.VALIDATOR;

  const allValidatorsSelected = selectedValidators.length === filteredValidators.length;
  const noValidatorsSelected = selectedValidators.length === 0;

  const unbondingDays = `${filteredValidators[0]?.stakingParams?.unbonding_time || 0} days`;

  const resetDefaults = () => {
    // NOTE: reset atom states
    resetTransactionStates();
    setSearchTerm('');
    setSortOrder(SortOrder.DESC);
    setSortType(ValidatorSortType.NAME);
    setSelectedValidators([]);

    // NOTE: reset local states
    setIsClaimToRestake(false);
  };

  const handleSelectAll = () => {
    setSelectedValidators(filteredValidators);
  };

  const handleSelectNone = () => {
    setSelectedValidators([]);
  };

  const handleValidatorSelect = (validator: FullValidatorInfo) => {
    setSelectedValidators(prev =>
      prev.some(v => v.delegation.validator_address === validator.delegation.validator_address)
        ? prev.filter(
            v => v.delegation.validator_address !== validator.delegation.validator_address,
          )
        : [...prev, validator],
    );
  };

  const handleAction = async ({ isSimulation = false }: { isSimulation?: boolean } = {}) => {
    if (noValidatorsSelected) return;

    const actionFn = isSimulation ? runSimulation : runTransaction;

    try {
      setIsTransactionInProgress(true);

      if (isClaimDialog) {
        if (isClaimToRestake) {
          // Claim to restake
          await actionFn({
            action: ValidatorAction.CLAIM,
            validatorInfoArray: selectedValidators,
            toRestake: true,
          });
        } else {
          // Claim to wallet
          await actionFn({
            action: ValidatorAction.CLAIM,
            validatorInfoArray: selectedValidators,
          });
        }
      } else {
        // Unstake
        await actionFn({
          action: ValidatorAction.UNSTAKE,
          validatorInfoArray: selectedValidators,
        });
      }
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : 'Transaction failed';
      console.error(`Error during ${isSimulation ? 'simulation' : 'transaction'}:`, errorMessage);
      throw error;
    } finally {
      setIsTransactionInProgress(false);
    }
  };

  const canRunSimulation = () =>
    slideTrayRef.current?.isOpen() && !noValidatorsSelected && !isTransactionInProgress;

  useEffect(() => {
    // Use a ref to track the timeout ID
    const timeoutRef = { current: null as NodeJS.Timeout | null };

    const runSimulation = () => {
      if (canRunSimulation()) {
        handleAction({ isSimulation: true });
        // Schedule next run
        timeoutRef.current = setTimeout(runSimulation, 5000);
      }
    };

    // Run immediately if conditions are met
    if (canRunSimulation()) {
      // Clear any existing timeout
      if (timeoutRef.current) {
        clearTimeout(timeoutRef.current);
      }
      runSimulation();
    }

    return () => {
      // Cleanup on unmount or dependency change
      if (timeoutRef.current) {
        clearTimeout(timeoutRef.current);
      }
    };
  }, [selectedValidators]);

  useEffect(() => {
    if (isSuccess) {
      refreshData();
    }
  }, [isSuccess]);

  useEffect(() => {
    return () => {
      resetDefaults();
    };
  }, []);

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
            <SortDialog searchType={searchType} isDialog />
          </div>
        </div>

        {isSuccess || isLoading || transactionFailed ? (
          <div className="flex flex-col flex-grow w-full border border-neutral-3 rounded-md items-center justify-center px-[1.5rem]">
            {isLoading && (
              <div className="flex flex-grow items-center px-4">
                <Loader showBackground={false} />
              </div>
            )}

            {isSuccess && (
              <TransactionResultsTile
                isSuccess
                txHash={truncateWalletAddress('', transactionHash)}
                size="md"
              />
            )}

            {transactionFailed && (
              <TransactionResultsTile isSuccess={false} size="md" message={transactionError} />
            )}
          </div>
        ) : (
          <ValidatorScroller
            validators={filteredValidators}
            onClick={handleValidatorSelect}
            isSelectable
            forceCurrentViewStyle
          />
        )}

        <SearchBar searchType={searchType} isDialog />

        <div className="flex justify-center space-x-4">
          <Button
            variant="secondary"
            size="medium"
            className="mb-1 w-[44%]"
            disabled={selectedValidators.length === 0 || isLoading}
            onClick={() => handleAction()}
          >
            {isClaimDialog ? `Claim ${isClaimToRestake ? 'to Restake' : 'to Wallet'}` : 'Unstake'}
          </Button>
        </div>

        <div className="flex justify-between items-center text-blue text-sm font-bold w-full">
          <p>Fee</p>
          <p className={calculatedFee.textClass}>
            {calculatedFee && calculatedFee.feeAmount > 0
              ? formatBalanceDisplay(`${calculatedFee.calculatedFee}`, calculatedFee.feeUnit)
              : '-'}
          </p>
        </div>
      </div>
    </SlideTray>
  );
};
