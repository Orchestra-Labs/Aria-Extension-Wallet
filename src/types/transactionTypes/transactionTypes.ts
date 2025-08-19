import { InputStatus, TransactionStatus, TransactionType } from '@/constants';
import { Asset, FeeToken } from '../localStorageTypes';

// TODO: remove
export interface TransactionDetails {
  type: TransactionType;
  isValid: boolean;
  isIBC: boolean;
  isSwap: boolean;
  isExchange: boolean;
}

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
  textClass: 'text-error' | 'text-warn' | 'text-blue';
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
  log: {
    description: string;
    status: TransactionStatus;
    txHash?: string;
    error?: string;
    fee?: {
      amount: number;
      denom: string;
    };
  };
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
  feeToken: FeeToken;
}
