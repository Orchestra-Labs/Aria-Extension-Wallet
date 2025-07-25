import { StakingParams, UnbondingDelegationEntry, ValidatorInfo } from './validatorData';

export interface Pagination {
  next_key: string | null;
  total: string;
}

export interface UnbondingDelegationResponse {
  delegator_address: string;
  validator_address: string;
  entries: UnbondingDelegationEntry[];
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

export interface UptimeResult {
  address: string;
  uptime: string;
}

export interface SlashingParams {
  signed_blocks_window: string;
  min_signed_per_window: string;
  downtime_jail_duration: string;
  slash_fraction_double_sign: string;
  slash_fraction_downtime: string;
}

export interface SigningInfo {
  address: string;
  missed_blocks_counter: string;
  index_offset: string;
}

export interface MintParams {
  mint_denom: string;
  // Standard Cosmos params
  inflation_rate_change?: string;
  inflation_max?: string;
  inflation_min?: string;
  goal_bonded?: string;
  blocks_per_year?: string;
  annual_provisions?: string;

  // Epoch-based params (Symphony/Stargaze/Juno)
  epoch_identifier?: string;
  reduction_period_in_epochs?: string;
  reduction_factor?: string;
  distribution_proportions?: {
    staking?: string;
    pool_incentives?: string;
    developer_rewards?: string;
    community_pool?: string;
  };
  genesis_epoch_provisions?: string;
}
