import { NetworkLevel } from '@/constants';

export interface Uri {
  address: string;
  provider: string;
}

export interface GasPriceStep {
  low: number;
  average: number;
  high: number;
}

export interface FeeToken {
  denom: string;
  gasPriceStep: GasPriceStep;
}

export interface Asset {
  denom: string;
  amount: string;
  exchangeRate?: string;
  isIbc: boolean;
  ibcDenom?: string;
  logo: string;
  symbol: string;
  name: string;
  exponent: number;
  isFeeToken?: boolean;
  networkName: string;
  networkID: string;
  coinGeckoId?: string;
  price: number;
}

export interface AssetRegistry {
  [key: string]: Asset;
}

export interface SimplifiedChainInfo {
  chain_name: string;
  status: string;
  website: string;
  network_level: NetworkLevel;
  pretty_name: string;
  chain_type: string;
  chain_id: string;
  bech32_prefix: string;
  fees?: FeeToken[];
  staking_denoms: string[];
  rpc_uris: Uri[];
  rest_uris: Uri[];
  logo_uri?: string;
  assets?: AssetRegistry;
}

export interface LocalChainRegistry extends Record<string, SimplifiedChainInfo> {}

export interface ChainRegistryData {
  mainnet: LocalChainRegistry;
  testnet: LocalChainRegistry;
}

export interface ChainRegistryRecord {
  sha: string;
  lastUpdated: string;
  data: ChainRegistryData;
}
