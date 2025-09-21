import { InputStatus, TextClass, TransactionStatus, TransactionType } from '@/constants';
import { Asset, FeeToken } from '../localStorageTypes';
import { RouteResponse } from '@skip-go/client/cjs';

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

export interface ExchangeStep extends TransactionStep {
  type: TransactionType.EXCHANGE;
  poolId: string;
  routes: string[];
  expectedOutput: string;
  priceImpact?: string;
  swapFee?: string;
  liquidity?: string;
  // Add Osmosis-specific fields
  osmosisPool?: {
    id: string;
    type: 'balancer' | 'concentrated' | 'stable';
    swapFee: string;
    totalLiquidity: string;
  };
}

export interface TransactionStep {
  type: TransactionType;
  via: 'skip' | 'standard';
  fromChain: string;
  toChain: string;
  fromAsset: Asset;
  toAsset: Asset;
  hash: string;
  toAddress?: string;
  fromAddress?: string;
  intendedInputAmount?: string;
  intendedOutputAmount?: string;
}

export interface TransactionLog {
  description: string;
  status: TransactionStatus;
  txHash?: string;
  error?: string;
  fees: FeeState[];
  feeSymbol: string;
  inputAmount: string;
  outputAmount: string;
  skipRoute?: RouteResponse;
  exchangeRate?: number;
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
  displayAmount: number;
  chainId: string;
}

export interface AddressValidationState {
  status: InputStatus;
  message: string;
}

export interface SendObject {
  recipientAddress: string;
  amount: string; // Always in base/denom units
  denom: string;
  feeToken?: FeeToken;
}
