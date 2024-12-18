import { DEFAULT_CHAIN_ID, DEFAULT_CHAIN_NAME } from '@/constants';

/**
 * Types
 */
export type TCosmosChain = keyof typeof COSMOS_MAINNET_CHAINS;

/**
 * Chains
 */
export const COSMOS_MAINNET_CHAINS = {
  [`cosmos:${DEFAULT_CHAIN_ID}`]: {
    chainId: DEFAULT_CHAIN_ID,
    name: DEFAULT_CHAIN_NAME,
    logo: '/chain-logos/cosmos-cosmoshub-4.png',
    rgb: '107, 111, 147',
    rpc: '',
    namespace: 'cosmos',
  },
};

/**
 * Methods
 */
export const COSMOS_SIGNING_METHODS = {
  COSMOS_SIGN_DIRECT: 'cosmos_signDirect',
  COSMOS_SIGN_AMINO: 'cosmos_signAmino',
};
