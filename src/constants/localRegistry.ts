import {
  AssetRegistry,
  DenomSubscriptionRecord,
  LocalChainRegistry,
  NetworkSubscriptionRecord,
  SubscriptionRecord,
} from '@/types';
import {
  DEFAULT_DENOM,
  GREATER_EXPONENT_DEFAULT,
  SYMPHONY_MAINNET_ID,
  SYMPHONY_TESTNET_ID,
} from './default';
import { NetworkLevel } from './enums';

const isDev = import.meta.env.DEV;
const DEV_PROXY = 'http://localhost:5173';

export const SYMPHONY_MAINNET_ASSET_REGISTRY: AssetRegistry = {
  uusd: {
    denom: 'uusd',
    amount: '0',
    exchangeRate: '10',
    isIbc: false,
    logo: 'https://raw.githubusercontent.com/cosmos/chain-registry/master/testnets/symphonytestnet/images/husd.png',
    symbol: 'HUSD',
    name: 'US Dollar',
    exponent: GREATER_EXPONENT_DEFAULT,
    isFeeToken: false,
    networkName: 'Symphony Testnet',
    chainId: SYMPHONY_MAINNET_ID,
    price: 0,
    originDenom: 'uusd',
    originChainId: SYMPHONY_MAINNET_ID,
  },
  ukhd: {
    denom: 'uhkd',
    amount: '0',
    exchangeRate: '1.282',
    isIbc: false,
    logo: 'https://raw.githubusercontent.com/cosmos/chain-registry/master/testnets/symphonytestnet/images/hhkd.png',
    symbol: 'HHKD',
    name: 'Hong Kong Dollar',
    exponent: GREATER_EXPONENT_DEFAULT,
    isFeeToken: false,
    networkName: 'Symphony Testnet',
    chainId: SYMPHONY_MAINNET_ID,
    price: 0,
    originDenom: 'uhkd',
    originChainId: SYMPHONY_MAINNET_ID,
  },
  uvnd: {
    denom: 'uaux',
    amount: '0',
    exchangeRate: '0.000399',
    isIbc: false,
    logo: 'https://raw.githubusercontent.com/cosmos/chain-registry/master/testnets/symphonytestnet/images/hvnd.png',
    symbol: 'HAUX',
    name: 'Gold',
    exponent: GREATER_EXPONENT_DEFAULT,
    isFeeToken: false,
    networkName: 'Symphony Testnet',
    chainId: SYMPHONY_MAINNET_ID,
    price: 0,
    originDenom: 'uaux',
    originChainId: SYMPHONY_MAINNET_ID,
  },
  [DEFAULT_DENOM]: {
    denom: DEFAULT_DENOM,
    amount: '0',
    exchangeRate: '1',
    isIbc: false,
    logo: 'https://raw.githubusercontent.com/cosmos/chain-registry/master/testnets/symphonytestnet/images/mld.png',
    symbol: 'MLD',
    name: 'Melody',
    exponent: GREATER_EXPONENT_DEFAULT,
    isFeeToken: true,
    networkName: 'Symphony Testnet',
    chainId: SYMPHONY_MAINNET_ID,
    price: 0,
    originDenom: DEFAULT_DENOM,
    originChainId: SYMPHONY_MAINNET_ID,
  },
};

export const SYMPHONY_TESTNET_ASSET_REGISTRY: AssetRegistry = {
  note: {
    denom: 'note',
    amount: '0',
    exchangeRate: '1',
    isIbc: false,
    logo: 'https://raw.githubusercontent.com/cosmos/chain-registry/master/testnets/symphonytestnet/images/mld.png',
    symbol: 'MLD',
    name: 'Melody',
    exponent: GREATER_EXPONENT_DEFAULT,
    isFeeToken: true,
    networkName: 'Symphony Testnet',
    chainId: SYMPHONY_TESTNET_ID,
    price: 0,
    originDenom: DEFAULT_DENOM,
    originChainId: SYMPHONY_TESTNET_ID,
  },
};

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

export const DEFAULT_MAINNET_ASSET = SYMPHONY_MAINNET_ASSET_REGISTRY[DEFAULT_DENOM];
export const DEFAULT_TESTNET_ASSET = SYMPHONY_TESTNET_ASSET_REGISTRY[DEFAULT_DENOM];

export const DEFAULT_DENOM_SUBSCRIPTION_RECORD: DenomSubscriptionRecord = {
  viewAll: true,
  subscribedDenoms: [],
};

export const DEFAULT_MAINNET_SUBSCRIPTION_RECORD: NetworkSubscriptionRecord = {
  [SYMPHONY_MAINNET_ID]: DEFAULT_DENOM_SUBSCRIPTION_RECORD,
};
export const DEFAULT_TESTNET_SUBSCRIPTION_RECORD: NetworkSubscriptionRecord = {
  [SYMPHONY_TESTNET_ID]: DEFAULT_DENOM_SUBSCRIPTION_RECORD,
};

export const DEFAULT_SUBSCRIPTION: SubscriptionRecord = {
  mainnet: DEFAULT_MAINNET_SUBSCRIPTION_RECORD,
  testnet: DEFAULT_TESTNET_SUBSCRIPTION_RECORD,
};

export const DEFAULT_MAINNET_REGISTRY: LocalChainRegistry = {
  [SYMPHONY_MAINNET_ID]: {
    chain_name: 'local symphony',
    status: 'live',
    website: '',
    network_level: NetworkLevel.MAINNET,
    pretty_name: 'Symphony',
    chain_type: 'cosmos',
    chain_id: 'symphony-1',
    bech32_prefix: 'symphony',
    fees: [
      {
        denom: 'note',
        gasPriceStep: {
          low: 0.00025,
          average: 0.0025,
          high: 0.004,
        },
      },
    ],
    staking_denoms: ['note'],
    rpc_uris: [
      {
        address: 'https://symphony.rpc.nodeshub.online/',
        provider: 'Nodes Hub',
      },
      {
        address: 'https://symphony-rpc.cogwheel.zone/',
        provider: 'Cogwheel ⚙️',
      },
    ],
    rest_uris: [
      {
        address: 'https://symphony.api.nodeshub.online/',
        provider: 'Nodes Hub',
      },
      {
        address: 'https://symphony-api.cogwheel.zone/',
        provider: 'Cogwheel ⚙️',
      },
    ],
    logo_uri:
      'https://raw.githubusercontent.com/cosmos/chain-registry/master/symphony/images/symphony_logo.png',
    assets: SYMPHONY_MAINNET_ASSET_REGISTRY,
  },
};

export const DEFAULT_TESTNET_REGISTRY: LocalChainRegistry = {
  [SYMPHONY_TESTNET_ID]: {
    chain_name: 'local symphonytestnet',
    status: 'active',
    website: '',
    network_level: NetworkLevel.TESTNET,
    pretty_name: 'Symphony Testnet',
    chain_type: 'cosmos',
    chain_id: SYMPHONY_TESTNET_ID,
    bech32_prefix: 'symphony',
    fees: [
      {
        denom: 'note',
        gasPriceStep: {
          low: 0.0025,
          average: 0.025,
          high: 0.04,
        },
      },
    ],
    staking_denoms: ['note'],
    rpc_uris: CHAIN_NODES.symphonytestnet.map(n => ({ address: n.rpc, provider: n.provider })),
    rest_uris: CHAIN_NODES.symphonytestnet.map(n => ({ address: n.rest, provider: n.provider })),
    logo_uri:
      'https://raw.githubusercontent.com/cosmos/chain-registry/master/symphony/images/symphony_logo.png',
    assets: SYMPHONY_MAINNET_ASSET_REGISTRY,
  },
};

export const LOCAL_CHAIN_REGISTRY: {
  mainnet: LocalChainRegistry;
  testnet: LocalChainRegistry;
} = {
  mainnet: DEFAULT_MAINNET_REGISTRY,
  testnet: DEFAULT_TESTNET_REGISTRY,
};
