import { useAtom, useSetAtom } from 'jotai';
import { CombinedStakingInfo, DelegationResponse, TransactionResult } from '@/types';
import { validatorFeeStateAtom, validatorTransactionStateAtom } from '@/atoms/validatorStateAtom';
import {
  executeClaimAtom,
  executeStakeAtom,
  executeUnstakeAtom,
} from '@/atoms/validatorActionsAtom';
import { DEFAULT_EXTERNAL_GAS_PRICES, TransactionStatus, TransactionType } from '@/constants';
import { handleTransactionError, handleTransactionSuccess } from '@/helpers/transactionHandlers';
import { useRefreshData } from './useRefreshData';
import { selectedValidatorsAtom } from '@/atoms';

interface HandleTransactionParams {
  action: 'stake' | 'unstake' | 'claim';
  isSimulation: boolean;
  amount?: string;
  toRestake?: boolean;
  delegations?: DelegationResponse[];
  rewards?: { validator: string; rewards: { denom: string; amount: string }[] }[];
}

export const useValidatorActions = (validator?: CombinedStakingInfo) => {
  const { refreshData } = useRefreshData();
  const [selectedValidators] = useAtom(selectedValidatorsAtom);

  const setTransactionState = useSetAtom(validatorTransactionStateAtom);
  const [feeState, setFeeState] = useAtom(validatorFeeStateAtom);
  const stake = useSetAtom(executeStakeAtom);
  const unstake = useSetAtom(executeUnstakeAtom);
  const claim = useSetAtom(executeClaimAtom);

  const getActiveValidator = () => {
    // If validator is explicitly passed, use that
    if (validator) return validator;

    // If we have selected validators, use the first one (for stake/claim actions that need a validator)
    if (selectedValidators.length > 0) return selectedValidators[0];

    // Otherwise return undefined (will throw error for stake actions)
    return undefined;
  };

  const handleTransaction = async ({
    action,
    isSimulation,
    amount = '0',
    toRestake = false,
    delegations = [],
    rewards = [],
  }: HandleTransactionParams): Promise<TransactionResult | null> => {
    const activeValidator = getActiveValidator();

    try {
      let result: TransactionResult;
      const startTime = performance.now();

      if (!isSimulation) {
        setTransactionState(prev => ({
          ...prev,
          status: TransactionStatus.LOADING,
        }));
      }

      switch (action) {
        case 'stake':
          result = await stake({
            amount,
            denom: feeState.feeToken.denom,
            validatorAddress: activeValidator?.validator.operator_address as string,
            simulate: isSimulation,
          });
          break;
        case 'unstake':
          result = await unstake({
            amount,
            delegations,
            simulate: isSimulation,
          });
          break;
        case 'claim':
          result = toRestake
            ? await claim({
                validatorAddress: activeValidator?.validator.operator_address as string,
                delegations,
                rewards,
                isToRestake: toRestake,
                simulate: isSimulation,
              })
            : await claim({
                validatorAddress: activeValidator?.validator.operator_address as string,
                isToRestake: toRestake,
                simulate: isSimulation,
              });
          break;
        default:
          throw new Error('Invalid validator action');
      }

      const duration = performance.now() - startTime;
      console.log(`[useValidatorActions] ${action} completed in ${duration.toFixed(2)}ms`, {
        success: result?.success,
        code: result?.data?.code,
      });

      if (result?.success && result.data?.code === 0) {
        if (isSimulation) {
          const gasWanted = parseFloat(result.data.gasWanted || '0');
          const gasPrice = feeState.feeToken.gasPriceStep.average;
          const feeInBaseUnits = gasWanted * gasPrice;

          setFeeState(prev => ({
            ...prev,
            amount: feeInBaseUnits,
            gasWanted,
            gasPrice: feeState.gasPrice || DEFAULT_EXTERNAL_GAS_PRICES.average,
          }));
        } else {
          handleTransactionSuccess(
            result.data.txHash || '',
            setTransactionState,
            action === 'stake'
              ? TransactionType.STAKE
              : action === 'unstake'
                ? TransactionType.UNSTAKE
                : toRestake
                  ? TransactionType.CLAIM_TO_RESTAKE
                  : TransactionType.CLAIM_TO_WALLET,
          );
          refreshData();
        }
        return result;
      } else {
        const errorMessage = result?.message || `${action} failed`;
        handleTransactionError(errorMessage, setTransactionState);
        return null;
      }
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : 'Transaction failed';
      console.error('[useValidatorActions] Action failed:', errorMessage);
      handleTransactionError(errorMessage, setTransactionState);
      throw error;
    }
  };

  const runTransaction = async (
    action: 'stake' | 'unstake' | 'claim',
    amount: string = '0',
    toRestake: boolean = false,
    delegations?: any,
    rewards: any[] = [],
  ): Promise<TransactionResult | null> => {
    return handleTransaction({
      action,
      isSimulation: false,
      amount,
      toRestake,
      delegations,
      rewards,
    });
  };

  const runSimulation = async (
    action: 'stake' | 'unstake' | 'claim',
    amount: string = '0',
    toRestake: boolean = false,
    delegations?: any,
    rewards: any[] = [],
  ): Promise<TransactionResult | null> => {
    return handleTransaction({
      action,
      isSimulation: true,
      amount,
      toRestake,
      delegations,
      rewards,
    });
  };

  return {
    runTransaction,
    runSimulation,
  };
};
