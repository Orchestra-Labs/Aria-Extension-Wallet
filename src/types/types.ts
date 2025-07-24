import { Asset } from './localStorageTypes';

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
  // TODO: make actions enums
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
