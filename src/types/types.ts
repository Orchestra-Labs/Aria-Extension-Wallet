import { Asset } from './localStorageTypes';

export interface SessionToken {
  mnemonic: string;
  accountId: string;
  rememberMe: boolean;
  timestamp: string;
}

export interface WalletAssets {
  address: string;
  assets: Asset[];
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
  sha: string;
}

export interface GitHubFileResponse {
  content: string;
  encoding: string;
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
