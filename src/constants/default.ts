// constants/defaultValues.ts
import { Asset } from '@/types';

// Network-related constants
export const NETWORK = 'symphony';
export const WALLET_PREFIX = 'symphony';

// RPC and REST URLs for the Symphony network
export const DEFAULT_CHAIN_NAME = 'symphonytestnet';

// IBC-related constants
export const IBC_PREFIX = 'ibc/';
export const LESSER_EXPONENT_DEFAULT = 0;
export const GREATER_EXPONENT_DEFAULT = 6;

export const MAX_NODES_PER_QUERY = 3;
// Endpoints for different network operations

const isDev = import.meta.env.DEV;

const DEV_PROXY = 'http://localhost:5173'; // Your Vite dev server URL

// Define the shape of the local asset registry
type AssetRegistry = {
  [key: string]: Asset;
};

// Asset registry for the Symphony network
export const LOCAL_ASSET_REGISTRY: AssetRegistry = {
  uusd: {
    denom: 'uusd',
    amount: '10',
    isIbc: false,
    logo: 'https://raw.githubusercontent.com/cosmos/chain-registry/master/testnets/symphonytestnet/images/husd.png',
    symbol: 'HUSD',
    exponent: GREATER_EXPONENT_DEFAULT,
    networkName: 'Symphony Testnet',
    networkID: 'symphony-testnet-1',
  },
  ukhd: {
    denom: 'ukhd',
    amount: '1.282',
    isIbc: false,
    logo: 'https://raw.githubusercontent.com/cosmos/chain-registry/master/testnets/symphonytestnet/images/hhkd.png',
    symbol: 'HHKD',
    exponent: GREATER_EXPONENT_DEFAULT,
    networkName: 'Symphony Testnet',
    networkID: 'symphony-testnet-1',
  },
  uvnd: {
    denom: 'uvnd',
    amount: '0.000399',
    isIbc: false,
    logo: 'https://raw.githubusercontent.com/cosmos/chain-registry/master/testnets/symphonytestnet/images/hvnd.png',
    symbol: 'HVND',
    exponent: GREATER_EXPONENT_DEFAULT,
    networkName: 'Symphony Testnet',
    networkID: 'symphony-testnet-1',
  },
  note: {
    denom: 'note',
    amount: '1',
    isIbc: false,
    logo: 'https://raw.githubusercontent.com/cosmos/chain-registry/master/testnets/symphonytestnet/images/mld.png',
    symbol: 'MLD',
    exponent: GREATER_EXPONENT_DEFAULT,
    isFeeToken: true,
    networkName: 'Symphony Testnet',
    networkID: 'symphony-testnet-1',
  },
  ustars: {
    denom: 'stars',
    amount: '1',
    isIbc: true,
    logo: 'https://raw.githubusercontent.com/chainapsis/keplr-chain-registry/main/images/stargaze/ustars.png',
    symbol: 'STARS',
    exponent: GREATER_EXPONENT_DEFAULT,
    networkName: 'Stargaze Testnet',
    networkID: 'stargaze-testnet-1',
  },
  uosmo: {
    denom: 'osmo',
    amount: '1',
    isIbc: true,
    logo: 'https://raw.githubusercontent.com/chainapsis/keplr-chain-registry/main/images/osmosis/uosmo.png',
    symbol: 'OSMO',
    exponent: GREATER_EXPONENT_DEFAULT,
    networkName: 'Osmosis Testnet',
    networkID: 'osmosis-testnet-1',
  },
};

export const DEFAULT_ASSET = LOCAL_ASSET_REGISTRY.note;

export const CHAIN_NODES = {
  symphonytestnet: [
    {
      rpc: isDev ? `${DEV_PROXY}/kleomedes-rpc` : 'https://symphony-rpc.kleomedes.network',
      rest: isDev ? `${DEV_PROXY}/kleomedes-rest` : 'https://symphony-api.kleomedes.network',
      provider: 'Kleomedes',
    },
    /*nodeshub has tx indexing disabled, this is a good way to test errors, but not for production
    {
      rpc: isDev ? `${DEV_PROXY}/nodeshub-rpc` : 'https://symphony.test.rpc.nodeshub.online',
      rest: isDev ? `${DEV_PROXY}/nodeshub-rest` : 'https://symphony.test.api.nodeshub.online',
      provider: 'Nodes Hub',
    },*/
    {
      rpc: isDev ? `${DEV_PROXY}/cogwheel-rpc` : 'https://symphony-testnet-rpc.cogwheel.zone',
      rest: isDev ? `${DEV_PROXY}/cogwheel-rest` : 'https://symphony-testnet-api.cogwheel.zone',
      provider: 'Cogwheel',
    },
  ],
};

export const CHAIN_ENDPOINTS = {
  getBalance: '/cosmos/bank/v1beta1/balances/',
  getDelegations: '/cosmos/staking/v1beta1/delegations/',
  getSpecificDelegations: '/cosmos/staking/v1beta1/delegators/',
  getValidators: '/cosmos/staking/v1beta1/validators',
  getIBCInfo: '/ibc/apps/transfer/v1/denom_traces/',
  getRewards: '/cosmos/distribution/v1beta1/delegators',
  claimRewards: '/cosmos.distribution.v1beta1.MsgWithdrawDelegatorReward',
  delegateToValidator: '/cosmos.staking.v1beta1.MsgDelegate',
  undelegateFromValidator: '/cosmos.staking.v1beta1.MsgUndelegate',
  sendMessage: '/cosmos.bank.v1beta1.MsgSend',
  swap: '/symphony/market/v1beta1/swap?',
  exchangeRequirements: '/symphony/market/v1beta1/exchange_requirements',
  getStakingParams: '/cosmos/staking/v1beta1/params',
  getUptime: '/cosmos/slashing/v1beta1/signing_infos/',
};

type LocalChainRegistryType = {
  [key: string]: {
    chainID: string;
    prefix: string;
    nodes: any;
    assets: AssetRegistry;
    chainName?: string;
  };
};

export const LOCAL_CHAIN_REGISTRY: LocalChainRegistryType = {
  'symphony-testnet-1': {
    chainName: 'Symphony',
    chainID: 'symphony-testnet-1',
    prefix: 'symphony',
    nodes: CHAIN_NODES,
    assets: LOCAL_ASSET_REGISTRY,
  },
};

export const DEFAULT_SUBSCRIPTION = {
  [LOCAL_CHAIN_REGISTRY['symphony-testnet-1'].chainID]: {
    coinDenoms: [] as string[],
  },
};

// Time constants
const ONE_MINUTE = 60 * 1000;
const FIVE_MINUTES = 5 * ONE_MINUTE;
const FIFTEEN_MINUTES = 3 * FIVE_MINUTES; // 15 minutes in milliseconds

export const RECHECK_TIMEOUT = FIVE_MINUTES;
export const INACTIVITY_TIMEOUT = FIFTEEN_MINUTES;
export const TOKEN_EXPIRATION_TIME = FIFTEEN_MINUTES;
export const DATA_FRESHNESS_TIMEOUT = 15 * 1000; // Data is considered fresh for 15 seconds
export const ICON_CHANGEOVER_TIMEOUT = 750; // 0.75 seconds to hold confirmation icon
export const DELAY_BETWEEN_NODE_ATTEMPTS = 1000; //1 second between queries
