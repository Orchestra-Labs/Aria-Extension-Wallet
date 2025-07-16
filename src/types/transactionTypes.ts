import { TransactionType } from '@/constants';

export interface TransactionDetails {
  type: TransactionType;
  isValid: boolean;
  isIBC: boolean;
  isSwap: boolean;
}

export const getTransactionDetails = (
  isIBC: boolean,
  isSwap: boolean,
  isValid: boolean,
): TransactionDetails => {
  if (!isValid) {
    return {
      type: TransactionType.INVALID,
      isValid: false,
      isIBC: false,
      isSwap: false,
    };
  }

  if (isIBC && isSwap) {
    return {
      type: TransactionType.IBC_SWAP,
      isValid: true,
      isIBC: true,
      isSwap: true,
    };
  }

  if (isIBC) {
    return {
      type: TransactionType.IBC_SEND,
      isValid: true,
      isIBC: true,
      isSwap: false,
    };
  }

  if (isSwap) {
    return {
      type: TransactionType.SWAP,
      isValid: true,
      isIBC: false,
      isSwap: true,
    };
  }

  return {
    type: TransactionType.SEND,
    isValid: true,
    isIBC: false,
    isSwap: false,
  };
};

export interface SimulatedFee {
  feeAmount: number;
  feeUnit: string;
  textClass: 'text-error' | 'text-warn' | 'text-blue';
}

export interface TransactionLogEntry {
  sendObject: any;
  isSuccess?: boolean;
}

export interface TransactionLog {
  isSimulation: boolean;
  entries: TransactionLogEntry[];
}
