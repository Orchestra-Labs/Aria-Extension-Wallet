import { InputStatus, NetworkLevel, TransactionStatus, TransactionType } from '@/constants';
import { Asset, FeeToken } from './localStorageTypes';

export interface TransactionDetails {
  type: TransactionType;
  isValid: boolean;
  isIBC: boolean;
  isSwap: boolean;
}

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
  description: string;
  fee?: {
    amount: number;
    denom: string;
  };
  status: TransactionStatus;
  error?: string;
}

export interface TransactionLog {
  isSimulation: boolean;
  entries: TransactionLogEntry[];
}

export type TransactionError = {
  message: string;
  status: InputStatus;
};

export interface TransactionStatusState {
  status: TransactionStatus;
  error?: string;
  txHash?: string;
}

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
