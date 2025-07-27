import { useAtom, useSetAtom } from 'jotai';
import { FullValidatorInfo, TransactionResult } from '@/types';
import {
  validatorFeeStateAtom,
  validatorTransactionStateAtom,
  executeClaimAtom,
  executeStakeAtom,
  executeUnstakeAtom,
  selectedValidatorsAtom,
} from '@/atoms';
import {
  DEFAULT_EXTERNAL_GAS_PRICES,
  TransactionStatus,
  TransactionType,
  ValidatorAction,
} from '@/constants';
import { handleTransactionError, handleTransactionSuccess } from '@/helpers';
import { useRefreshData } from './useRefreshData';

interface HandleTransactionParams {
  action: Exclude<ValidatorAction, ValidatorAction.NONE>;
  isSimulation: boolean;
  amount?: string;
  toRestake?: boolean;
  validatorInfoArray?: FullValidatorInfo[];
}

interface RunParams {
  action: Exclude<ValidatorAction, ValidatorAction.NONE>;
  amount?: string;
  toRestake?: boolean;
  validatorInfoArray?: FullValidatorInfo[];
}

export const useValidatorActions = () => {
  const { refreshData } = useRefreshData();
  const [selectedValidators, setSelectedValidators] = useAtom(selectedValidatorsAtom);

  const setTransactionState = useSetAtom(validatorTransactionStateAtom);
  const [feeState, setFeeState] = useAtom(validatorFeeStateAtom);
  const stake = useSetAtom(executeStakeAtom);
  const unstake = useSetAtom(executeUnstakeAtom);
  const claim = useSetAtom(executeClaimAtom);

  const handleTransaction = async ({
    action,
    isSimulation,
    amount = undefined,
    toRestake = false,
    validatorInfoArray = [],
  }: HandleTransactionParams): Promise<TransactionResult | null> => {
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
          const stakeAmount = amount || '0';
          const validatorAddress =
            validatorInfoArray.length > 0
              ? validatorInfoArray[0].validator.operator_address
              : selectedValidators[0].validator.operator_address;
          result = await stake({
            amount: stakeAmount,
            denom: feeState.feeToken.denom,
            validatorAddress: validatorAddress,
            simulate: isSimulation,
          });
          break;
        case 'unstake':
          result = await unstake({
            amount,
            validatorInfoArray:
              validatorInfoArray.length > 0 ? validatorInfoArray : selectedValidators,
            simulate: isSimulation,
          });
          break;
        case 'claim':
          result = await claim({
            validatorInfoArray:
              validatorInfoArray.length > 0 ? validatorInfoArray : selectedValidators,
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
          setSelectedValidators([]);
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

  const runTransaction = async ({
    action,
    amount,
    toRestake = false,
    validatorInfoArray = [],
  }: RunParams): Promise<TransactionResult | null> => {
    return handleTransaction({
      action,
      isSimulation: false,
      amount,
      toRestake,
      validatorInfoArray,
    });
  };

  const runSimulation = async ({
    action,
    amount,
    toRestake = false,
    validatorInfoArray = [],
  }: RunParams): Promise<TransactionResult | null> => {
    return handleTransaction({
      action,
      isSimulation: true,
      amount,
      toRestake,
      validatorInfoArray,
    });
  };

  return {
    runTransaction,
    runSimulation,
  };
};
