import { Asset } from './localStorageTypes';
import { StakingParams, UnbondingDelegationEntry, ValidatorInfo } from './validatorData';

export interface SessionToken {
  mnemonic: string;
  accountID: string;
  rememberMe: boolean;
  timestamp: string;
}

export interface WalletAssets {
  address: string;
  assets: Asset[];
}

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

export interface SlashingParams {
  signed_blocks_window: string;
  min_signed_per_window: string;
  downtime_jail_duration: string;
  slash_fraction_double_sign: string;
  slash_fraction_downtime: string;
}

export interface MintModuleParams {
  mint_denom: string;
  genesis_epoch_provisions: string;
  epoch_identifier: string;
  reduction_period_in_epochs: string;
  reduction_factor: string;
  distribution_proportions: {
    staking: string;
    pool_incentives: string;
    developer_rewards: string;
    community_pool: string;
  };
  weighted_developer_rewards_receivers: {
    address: string;
    weight: string;
  }[];
  minting_rewards_distribution_start_epoch: string;
}

export interface SigningInfo {
  address: string;
  missed_blocks_counter: string;
  index_offset: string;
}

export interface IBCChannel {
  channel_id: string;
  port_id: string;
  state: string;
  counterparty: {
    channel_id: string;
    port_id: string;
  };
}

export interface ChainData {
  coin: string;
  mainnet: string;
  testnet: string;
}

export interface PrefixStorage {
  lastUpdated: string;
  data: ChainData[];
}

export interface GitHubFile {
  name: string;
  path: string;
  download_url: string;
}

export interface GitHubFileResponse {
  content: string;
  encoding: string;
}

export interface IBCConnectionFileChain {
  chain_name: string;
  client_id: string;
  connection_id: string;
}

export interface IBCConnectionFileChannel {
  channel_id: string;
  port_id: string;
}

export interface IBCConnectionFile {
  lastUpdated: string;
  data: {
    chain_1: any;
    chain_2: any;
    channels: Array<{
      chain_1: IBCConnectionFileChannel;
      chain_2: IBCConnectionFileChannel;
    }>;
  };
}

export interface BaseAccount {
  address: string;
  pub_key: null;
  account_number: string;
  sequence: string;
}

export interface ModuleAccount {
  '@type': '/cosmos.auth.v1beta1.ModuleAccount';
  base_account: BaseAccount;
  name: string;
  permissions: string[];
}

export interface CustomQueryOptions {
  enabled?: boolean;
}

export interface Intent {
  action: 'send' | 'receive' | 'stake' | 'unstake' | 'claim' | 'claimAndRestake' | 'swap';
  amount: number | 'all';
  coin: { name?: string; symbol?: string; denom?: string };
  resultAmount?: number;
  resultCoin?: string;
  target?:
    | string
    | {
        operator_address: string;
        moniker: string;
        commission: string;
      };
  unitReference?: 'coin' | 'denom';
}
