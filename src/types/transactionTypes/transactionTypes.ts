import { InputStatus, TextClass, TransactionStatus, TransactionType } from '@/constants';
import { Asset, FeeToken } from '../localStorageTypes';

// TODO: cut this down?  doubt all these fields are needed
export interface FeeState {
  asset: Asset;
  amount: number; // Always stored in base units
  chainId: string;
  feeToken: FeeToken;
  gasWanted: number;
  gasPrice: number;
}

export interface CalculatedFeeDisplay {
  feeAmount: number; // In base units
  feeUnit: string;
  textClass: TextClass;
  percentage: number;
  calculatedFee: number; // In symbol units
  gasWanted: number;
  gasPrice: number;
}

export interface TransactionStep {
  type: TransactionType;
  via: 'skip' | 'standard';
  fromChain: string;
  toChain: string;
  fromAsset: Asset;
  toAsset: Asset;
  hash: string;
}

export interface TransactionLog {
  description: string;
  status: TransactionStatus;
  txHash?: string;
  error?: string;
  fee: FeeState;
}

export interface TransactionLogs {
  [stepHash: string]: TransactionLog;
}

export interface TransactionRoute {
  steps: TransactionStep[];
  currentStep: number;
  isComplete: boolean;
  isSimulation: boolean;
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
  chainId: string;
}

export interface AddressValidationState {
  status: InputStatus;
  message: string;
}

export interface SendObject {
  recipientAddress: string;
  amount: string;
  denom: string;
  feeToken?: FeeToken;
}
