import { FeeToken } from '../localStorageTypes';

export interface PreppedSkipTx {
  chainId: string;
  signedTx: string; // Base64 encoded signed transaction
  txData: SkipTransaction;
  minAmountOut: string;
  timestamp: number;
  status: 'signed' | 'submitted' | 'confirmed' | 'failed';
  txHash?: string;
  explorerLink?: string;
}

export interface SkipMultiChainMsg {
  chain_id: string;
  path: string[];
  msg: string;
  msg_type_url: string;
}

export interface SkipCosmosTx {
  chain_id: string;
  path: string[];
  signer_address: string;
  msgs: {
    msg: string;
    msg_type_url: string;
  }[];
}

export interface SkipTransaction {
  cosmos_tx: SkipCosmosTx;
  operations_indices: number[];
}

export interface SkipMessagesResponse {
  msgs: {
    multi_chain_msg: SkipMultiChainMsg;
  }[];
  txs: SkipTransaction[];
  min_amount_out: string;
  estimated_fees: any[];
}

export interface SignedTransactionData {
  chainId: string;
  signedTx: string; // Base64 encoded signed transaction
}

export interface SkipTxResponse {
  txHash?: string;
  explorerLink?: string;
}

export interface SkipOperationSimulation {
  chainId: string;
  denom: string;
  operationType: string;
  success: boolean;
  estimatedGas: string;
  feeAmount: number;
  feeToken: FeeToken;
  error?: string;
}

export interface SkipOperationFee {
  amount: string;
  denom: string;
  chainId: string;
  operationType: string;
}

export interface SkipSimulationResult {
  operations: SkipOperationSimulation[];
  totalEstimatedFees: number;
  hasSufficientBalances: boolean;
  operationFees: SkipOperationFee[];
}
