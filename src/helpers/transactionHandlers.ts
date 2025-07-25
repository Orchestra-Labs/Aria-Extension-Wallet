import { TransactionStatus } from '@/constants';
import { SetStateAction } from 'jotai';
import { TransactionStatusState } from '@/types';

type SetAtomFn<T> = (update: SetStateAction<T>) => void | Promise<void>;

export const handleTransactionSuccess = (
  txHash: string,
  setTransactionState: SetAtomFn<TransactionStatusState>,
  actionType?: string,
) => {
  console.log(`[TransactionHandler] ${actionType || 'Transaction'} successful with hash:`, txHash);
  setTransactionState(prev => ({
    ...prev,
    status: TransactionStatus.SUCCESS,
    txHash,
    ...(actionType ? { type: actionType } : {}),
  }));
  delayedClearTransactionStatus(setTransactionState);
};

export const handleTransactionError = (
  errorMessage: string,
  setTransactionState: SetAtomFn<TransactionStatusState>,
  actionType?: string,
) => {
  console.error(`[TransactionHandler] ${actionType || 'Transaction'} error:`, errorMessage);
  setTransactionState(prev => ({
    ...prev,
    status: TransactionStatus.ERROR,
    error: errorMessage,
  }));
  delayedClearTransactionStatus(setTransactionState);
};

export const delayedClearTransactionStatus = (
  setTransactionState: SetAtomFn<TransactionStatusState>,
  delay = 5000,
) => {
  setTimeout(() => {
    setTransactionState(prev => ({
      ...prev,
      status: TransactionStatus.IDLE,
      error: undefined,
    }));
  }, delay);
};
