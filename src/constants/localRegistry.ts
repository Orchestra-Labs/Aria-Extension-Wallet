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
    networkName: 'Symphony Testnet',
    networkID: SYMPHONY_MAINNET_ID,
    price: 0,
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
    networkName: 'Symphony Testnet',
    networkID: SYMPHONY_MAINNET_ID,
    price: 0,
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
    networkName: 'Symphony Testnet',
    networkID: SYMPHONY_MAINNET_ID,
    price: 0,
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
    networkID: SYMPHONY_MAINNET_ID,
    price: 0,
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
    networkID: SYMPHONY_TESTNET_ID,
    price: 0,
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
  'stargaze-1': {
    chain_name: 'local stargaze',
    status: 'live',
    website: '',
    network_level: NetworkLevel.MAINNET,
    pretty_name: 'Stargaze',
    chain_type: 'cosmos',
    chain_id: 'stargaze-1',
    bech32_prefix: 'stars',
    fees: [
      {
        denom: 'ustars',
        gasPriceStep: {
          low: 1,
          average: 1.1,
          high: 1.2,
        },
      },
    ],
    staking_denoms: ['ustars'],
    rpc_uris: [
      {
        address: 'https://rpc-stargaze.keplr.app/',
        provider: 'Keplr',
      },
    ],
    rest_uris: [
      {
        address: 'https://lcd-stargaze.keplr.app/',
        provider: 'Keplr',
      },
    ],
    logo_uri:
      'https://raw.githubusercontent.com/cosmos/chain-registry/master/stargaze/images/stars.png',
    assets: {
      ustars: {
        denom: 'ustars',
        amount: '0',
        exchangeRate: '-',
        isIbc: false,
        logo: 'https://raw.githubusercontent.com/cosmos/chain-registry/master/stargaze/images/stars.png',
        symbol: 'STARS',
        name: 'Stargaze',
        exponent: 6,
        isFeeToken: true,
        networkName: 'Stargaze',
        networkID: 'stargaze-1',
        price: 0,
      },
    },
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
  ['osmo-test-5']: {
    chain_name: 'local osmosistestnet',
    status: 'live',
    website: '',
    network_level: NetworkLevel.TESTNET,
    pretty_name: 'Osmosis Testnet',
    chain_type: 'cosmos',
    chain_id: 'osmo-test-5',
    bech32_prefix: 'osmo',
    fees: [
      {
        denom: 'uosmo',
        gasPriceStep: {
          low: 0.0025,
          average: 0.025,
          high: 0.04,
        },
      },
    ],
    staking_denoms: ['uosmo'],
    rpc_uris: [{ address: 'https://rpc.testnet.osmosis.zone/', provider: 'Osmosis' }],
    rest_uris: [{ address: 'https://lcd.testnet.osmosis.zone/', provider: 'Osmosis' }],
    logo_uri:
      'https://raw.githubusercontent.com/cosmos/chain-registry/master/osmosis/images/osmosis-chain-logo.png',
    assets: {
      uosmo: {
        denom: 'uosmo',
        amount: '0',
        isIbc: false,
        symbol: 'OSMO',
        name: 'Osmosis',
        exponent: 6,
        logo: 'https://raw.githubusercontent.com/cosmos/chain-registry/master/osmosis/images/osmo.png',
        networkName: 'Osmosis Testnet',
        networkID: 'osmo-test-5',
        price: 0,
      },
    },
  },
  ['elgafar-1']: {
    chain_name: 'local stargazetestnet',
    status: 'live',
    website: '',
    network_level: NetworkLevel.TESTNET,
    pretty_name: 'Stargaze Testnet',
    chain_type: 'cosmos',
    chain_id: 'elgafar-1',
    bech32_prefix: 'stars',
    fees: [
      {
        denom: 'ustars',
        gasPriceStep: {
          low: 0.03,
          average: 0.04,
          high: 0.05,
        },
      },
    ],
    staking_denoms: ['ustars'],
    rpc_uris: [
      { address: 'https://rpc.elgafar-1.stargaze-apis.com', provider: 'Stargaze Foundation' },
    ],
    rest_uris: [
      { address: 'https://rest.elgafar-1.stargaze-apis.com', provider: 'Stargaze Foundation' },
    ],
    logo_uri:
      'https://raw.githubusercontent.com/cosmos/chain-registry/master/stargaze/images/stars.png',
    assets: {
      ustars: {
        denom: 'ustars',
        amount: '0',
        exchangeRate: '-',
        isIbc: false,
        logo: 'https://raw.githubusercontent.com/cosmos/chain-registry/master/stargaze/images/stars.png',
        symbol: 'STARS',
        name: 'Stargaze Testnet',
        exponent: 6,
        isFeeToken: true,
        networkName: 'Stargaze Testnet',
        networkID: 'elgafar-1',
        price: 0,
      },
    },
  },
};

export const LOCAL_CHAIN_REGISTRY: {
  mainnet: LocalChainRegistry;
  testnet: LocalChainRegistry;
} = {
  mainnet: DEFAULT_MAINNET_REGISTRY,
  testnet: DEFAULT_TESTNET_REGISTRY,
};
