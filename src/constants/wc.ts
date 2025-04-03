export type CosmosChain = keyof typeof COSMOS_CHAINS;

const PROXY_SERVER_URL = 'https://proxy-two-gules.vercel.app'; // ! TODO REMOVE

export const COSMOS_CHAINS = {
  'cosmos:symphony-testnet-4': {
    chainId: 'symphony-testnet-4',
    name: 'Symphony Testnet',
    logo: '/chain-logos/cosmos-symphony-testnet-4.png',
    rgb: '107, 111, 147',
    rpc: `${PROXY_SERVER_URL}/symphony-rpc.kleomedes.network`,
    namespace: 'cosmos',
  },
};

export const COSMOS_SIGNING_METHODS = {
  COSMOS_SIGN_DIRECT: 'cosmos_signDirect',
  COSMOS_SIGN_AMINO: 'cosmos_signAmino',
  COSMOS_GET_ACCOUNTS: 'cosmos_getAccounts',
};
