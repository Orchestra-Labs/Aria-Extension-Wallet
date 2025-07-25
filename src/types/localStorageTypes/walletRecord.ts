import { Asset } from './chainRegistryRecord';

export interface Wallet {
  address: string;
  assets: Asset[];
}

export interface WalletByChain {
  [chainId: string]: Wallet;
}

export interface WalletRecord {
  id: string;
  name: string;
  encryptedMnemonic: string;
  settings: {};
}
