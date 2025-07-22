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

interface HandleTransactionParams {
  action: 'stake' | 'unstake' | 'claim';
  isSimulation: boolean;
  amount?: string;
  toRestake?: boolean;
  delegations?: DelegationResponse[];
  rewards?: { validator: string; rewards: { denom: string; amount: string }[] }[];
}

export const useValidatorActions = (validator: CombinedStakingInfo) => {
  const setTransactionState = useSetAtom(validatorTransactionStateAtom);
  const [feeState, setFeeState] = useAtom(validatorFeeStateAtom);
  const { refreshData } = useRefreshData();

  const stake = useSetAtom(executeStakeAtom);
  const unstake = useSetAtom(executeUnstakeAtom);
  const claim = useSetAtom(executeClaimAtom);

  const handleTransaction = async ({
    action,
    isSimulation,
    amount = '0',
    toRestake = false,
    delegations = [],
    rewards = [],
  }: HandleTransactionParams): Promise<TransactionResult | null> => {
    console.log(
      `[useValidatorActions] Starting ${isSimulation ? 'simulation' : 'transaction'} for ${action}`,
    );
    console.log('[useValidatorActions] Parameters:', {
      amount,
      toRestake,
      delegations: Array.isArray(delegations) ? delegations.length : 1,
      rewards: rewards.length,
    });

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
          console.log('[useValidatorActions] Executing stake action');
          result = await stake({
            amount,
            denom: feeState.feeToken.denom,
            validatorAddress: validator.validator.operator_address,
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
                validatorAddress: validator.validator.operator_address,
                delegations,
                rewards,
                isToRestake: toRestake,
                simulate: isSimulation,
              })
            : await claim({
                validatorAddress: validator.validator.operator_address,
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
          // Update fee state with simulation results
          const gasWanted = parseFloat(result.data.gasWanted || '0');
          const gasPrice = feeState.feeToken.gasPriceStep.average;
          const feeInBaseUnits = gasWanted * gasPrice;

          console.log('[useValidatorActions] Simulation results:', {
            gasWanted,
            gasPrice,
            feeInBaseUnits,
            currentFeeState: feeState,
          });

          setFeeState(prev => {
            const newState = {
              ...prev,
              amount: feeInBaseUnits,
              gasWanted,
              gasPrice: feeState.gasPrice || DEFAULT_EXTERNAL_GAS_PRICES.average,
            };
            console.log('[useValidatorActions] Setting new fee state:', newState);
            return newState;
          });
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
