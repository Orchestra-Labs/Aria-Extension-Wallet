import { NetworkLevel } from '@/constants';
import { Asset } from '../types';

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
  coinDenom: string;
  coinMinimalDenom: string;
  coinDecimals: number;
  gasPriceStep: GasPriceStep;
  coinImageUrl: string;
}

export interface StakingToken {
  coinDenom: string;
  coinMinimalDenom: string;
  coinDecimals: number;
  coinImageUrl: string;
}

export interface SimplifiedChainInfo {
  chain_name: string;
  status: string;
  network_level: NetworkLevel;
  pretty_name: string;
  chain_type: string;
  chain_id: string;
  bech32_prefix: string;
  fees?: FeeToken[];
  staking?: StakingToken;
  rpc_uris: Uri[];
  rest_uris: Uri[];
  logo_uri?: string;
  assets?: Record<string, Asset>;
}

export interface LocalChainRegistry extends Record<string, SimplifiedChainInfo> {}

export interface ChainRegistryRecord {
  sha: string;
  lastUpdated: string;
  data: {
    mainnet: LocalChainRegistry;
    testnet: LocalChainRegistry;
  };
}
