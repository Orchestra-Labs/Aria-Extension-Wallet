import { IBCConnectionState } from '@/constants';

export interface SessionToken {
  mnemonic: string;
  accountID: string;
  rememberMe: boolean;
  timestamp: string;
}

export interface AccountRecord {
  id: string; // password and account share ID
  settings: {
    activeNetworkID: string;
    visibleNetworks: string[];
    activeWalletID: string;
  };
  wallets: WalletRecord[];
}

export interface WalletRecord {
  id: string;
  name: string;
  mnemonic: string;
  settings: {};
}

export interface PasswordRecord {
  id: string; // password and account share ID
  hash: string;
  salt: string;
}

export interface Asset {
  denom: string;
  amount: string;
  exchangeRate?: string;
  isIbc: boolean;
  logo?: string;
  symbol?: string;
  exponent?: number;
  isFeeToken?: boolean;
}

export interface WalletAssets {
  address: string;
  assets: Asset[];
}

export interface SendObject {
  recipientAddress: string;
  amount: string;
  denom: string;
}
export interface SwapObject {
  sendObject: SendObject;
  resultDenom: string;
}

export interface DelegationResponse {
  delegation: {
    delegator_address: string;
    validator_address: string;
    shares: string;
  };
  balance: {
    denom: string;
    amount: string;
  };
}

export interface Pagination {
  next_key: string | null;
  total: string;
}

export interface ValidatorInfo {
  operator_address: string;
  consensus_pubkey: {
    '@type': string;
    key: string;
  };
  jailed: boolean;
  status: string; // Bonded, Unbonding, Unbonded
  tokens: string;
  delegator_shares: string;
  description: {
    moniker: string;
    website: string;
    details: string;
  };
  commission: {
    commission_rates: {
      rate: string;
      max_rate: string;
      max_change_rate: string;
    };
  };
}

export interface ValidatorReward {
  validator: string;
  rewards: any[];
}

export interface UnbondingDelegationEntry {
  balance: string;
  completion_time: string;
}

export interface UnbondingDelegationResponse {
  delegator_address: string;
  validator_address: string;
  entries: UnbondingDelegationEntry[];
}

export interface CombinedStakingInfo {
  delegation: DelegationResponse['delegation'];
  balance: DelegationResponse['balance'];
  validator: ValidatorInfo;
  rewards: ValidatorReward['rewards'];
  stakingParams?: StakingParams | null;
  estimatedReturn?: string;
  votingPower?: string;
  uptime?: string;
  unbondingBalance?: UnbondingDelegationEntry;
}

//Create base RPC response interface
export interface BaseRPCResponse {
  code: number;
  message?: string;
}

//Extend specifically for tx's
export interface TransactionRPCResponse extends BaseRPCResponse {
  txHash?: string;
  gasUsed?: string;
  gasWanted?: string;
  height?: number;
}

//TX result incl the response
export interface TransactionResult {
  success: boolean;
  message: string;
  data?: TransactionRPCResponse;
}

export interface TransactionSuccess {
  isSuccess: boolean;
  txHash?: string;
}

export interface RPCResponse {
  code: number;
  txhash?: string;
  gasUsed?: string;
  gasWanted?: string;
  message?: string;
  rawLog?: string;
  height?: number;

  // REST responses
  delegation_responses?: Array<{
    delegation: {
      delegator_address: string;
      validator_address: string;
      shares: string;
    };
    balance: {
      denom: string;
      amount: string;
    };
  }>;

  // Validator fields
  validators?: ValidatorInfo[];
  validator?: ValidatorInfo;

  // Pagination fields
  pagination?: {
    next_key: string | null;
    total: string;
  };

  // Rewards fields
  rewards?:
    | Array<{
        validator_address: string;
        reward: any[];
      }>
    | any[]; // Allow both formats of rewards
  reward?: any[]; // For single validator rewards

  params?: StakingParams;

  // Catch-all
  [key: string]: any;
}

export interface StakingParams {
  unbonding_time: string;
  max_validators: number;
  max_entries: number;
  historical_entries: number;
  bond_denom: string;
}

export interface IBCConnection {
  id: string;
  client_id: string;
  counterparty_client_id: string;
  counterparty_connection_id: string;
  state: IBCConnectionState;
}
