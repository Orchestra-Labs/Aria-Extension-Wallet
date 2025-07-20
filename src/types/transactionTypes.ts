import { InputStatus, NetworkLevel, TransactionType } from '@/constants';
import { Asset, FeeToken } from './localStorageTypes';

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

export interface FeeState {
  asset: Asset;
  amount: number; // Always stored in base units
  chainID: string;
  feeToken: FeeToken;
  gasWanted: number;
  gasPrice: number;
}

export interface CalculatedFeeDisplay {
  feeAmount: number; // In base units
  feeUnit: string;
  textClass: 'text-error' | 'text-warn' | 'text-blue';
  percentage: number;
  calculatedFee: number; // In symbol units
  gasWanted: number;
  gasPrice: number;
}

export interface TransactionLogEntry {
  sendObject: any;
  isSuccess?: boolean;
}

export interface TransactionLog {
  isSimulation: boolean;
  entries: TransactionLogEntry[];
}

export type TransactionError = {
  message: string;
  status: InputStatus;
};

export interface TransactionState {
  asset: Asset;
  amount: number;
  chainID: string;
}

export interface AddressValidationState {
  status: InputStatus;
  message: string;
}

export interface SendObject {
  recipientAddress: string;
  amount: string;
  denom: string;
  feeToken: FeeToken;
}

export interface SwapObject {
  sendObject: SendObject;
  resultDenom: string;
}

export interface IBCObject {
  fromAddress: string;
  sendObject: SendObject;
  sendChain: string;
  receiveChain: string;
  networkLevel: NetworkLevel;
}
