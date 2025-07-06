import { Asset, LocalChainRegistry, SubscriptionRecord } from '@/types';
import { NetworkLevel } from './enums';

export const WINDOW_SIZE = {
  width: 420,
  height: 600,
};

export const VALID_PASSWORD_LENGTH = 8;

// Network-related constants
export const NETWORK = 'symphony';
export const SYMPHONY_PREFIX = 'symphony';

// RPC and REST URLs for the Symphony network
export const SYMPHONY_TESTNET_NAME = 'symphonytestnet';
export const SYMPHONY_TESTNET_ID = 'symphony-testnet-4';
export const SYMPHONY_MAINNET_NAME = 'symphony';
export const SYMPHONY_MAINNET_ID = 'symphony-1';

// IBC-related constants
export const IBC_PREFIX = 'ibc/';
export const LESSER_EXPONENT_DEFAULT = 0;
export const GREATER_EXPONENT_DEFAULT = 6;

export const MAX_RETRIES_PER_QUERY = 3;
// Endpoints for different network operations

const isDev = import.meta.env.DEV;

const DEV_PROXY = 'http://localhost:5173';

// Define the shape of the local asset registry
type AssetRegistry = {
  [key: string]: Asset;
};

// Asset registry for the Symphony network
export const LOCAL_MAINNET_ASSET_REGISTRY: AssetRegistry = {
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
  },
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
    networkID: SYMPHONY_MAINNET_ID,
  },
};

export const LOCAL_TESTNET_ASSET_REGISTRY: AssetRegistry = {
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
  },
};

export const DEFAULT_MAINNET_ASSET = LOCAL_MAINNET_ASSET_REGISTRY.note;
export const DEFAULT_TESTNET_ASSET = LOCAL_TESTNET_ASSET_REGISTRY.note;

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

export const LOCAL_MAINNET_REGISTRY: LocalChainRegistry = {
  [SYMPHONY_MAINNET_ID]: {
    chain_name: 'local symphony',
    status: 'live',
    network_level: NetworkLevel.MAINNET,
    pretty_name: 'Symphony',
    chain_type: 'cosmos',
    chain_id: 'symphony-1',
    bech32_prefix: 'symphony',
    fees: [
      {
        coinDenom: 'MLD',
        coinMinimalDenom: 'note',
        coinDecimals: 6,
        coinImageUrl:
          'https://raw.githubusercontent.com/cosmos/chain-registry/master/symphony/images/symphony_logo.png',
        gasPriceStep: {
          low: 0.00025,
          average: 0.0025,
          high: 0.004,
        },
      },
    ],
    staking: {
      coinDenom: 'MLD',
      coinMinimalDenom: 'note',
      coinDecimals: 6,
      coinImageUrl:
        'https://raw.githubusercontent.com/cosmos/chain-registry/master/symphony/images/symphony_logo.png',
    },
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
    assets: LOCAL_MAINNET_ASSET_REGISTRY,
  },
  'stargaze-1': {
    chain_name: 'local stargaze',
    status: 'live',
    network_level: NetworkLevel.MAINNET,
    pretty_name: 'Stargaze',
    chain_type: 'cosmos',
    chain_id: 'stargaze-1',
    bech32_prefix: 'stars',
    fees: [
      {
        coinDenom: 'STARS',
        coinMinimalDenom: 'ustars',
        coinDecimals: 6,
        coinImageUrl:
          'https://raw.githubusercontent.com/cosmos/chain-registry/master/stargaze/images/stars.png',
        gasPriceStep: {
          low: 1,
          average: 1.1,
          high: 1.2,
        },
      },
    ],
    staking: {
      coinDenom: 'STARS',
      coinMinimalDenom: 'ustars',
      coinDecimals: 6,
      coinImageUrl:
        'https://raw.githubusercontent.com/cosmos/chain-registry/master/stargaze/images/stars.png',
    },
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
      },
    },
  },
};

export const LOCAL_TESTNET_REGISTRY: LocalChainRegistry = {
  [SYMPHONY_TESTNET_ID]: {
    chain_name: 'local symphonytestnet',
    status: 'active',
    network_level: NetworkLevel.TESTNET,
    pretty_name: 'Symphony Testnet',
    chain_type: 'cosmos',
    chain_id: SYMPHONY_TESTNET_ID,
    bech32_prefix: 'symphony',
    fees: [
      {
        coinDenom: 'MLD',
        coinMinimalDenom: 'note',
        coinDecimals: 6,
        gasPriceStep: {
          low: 0.0025,
          average: 0.025,
          high: 0.04,
        },
        coinImageUrl:
          'https://raw.githubusercontent.com/chainapsis/keplr-chain-registry/main/images/symphony-testnet/melody.png',
      },
    ],
    staking: {
      coinDenom: 'MLD',
      coinMinimalDenom: 'note',
      coinDecimals: 6,
      coinImageUrl:
        'https://raw.githubusercontent.com/chainapsis/keplr-chain-registry/main/images/symphony-testnet/melody.png',
    },
    rpc_uris: CHAIN_NODES.symphonytestnet.map(n => ({ address: n.rpc, provider: n.provider })),
    rest_uris: CHAIN_NODES.symphonytestnet.map(n => ({ address: n.rest, provider: n.provider })),
    logo_uri:
      'https://raw.githubusercontent.com/cosmos/chain-registry/master/symphony/images/symphony_logo.png',
    assets: LOCAL_TESTNET_ASSET_REGISTRY,
  },
  ['osmo-test-5']: {
    chain_name: 'local osmosistestnet',
    status: 'live',
    network_level: NetworkLevel.TESTNET,
    pretty_name: 'Osmosis Testnet',
    chain_type: 'cosmos',
    chain_id: 'osmo-test-5',
    bech32_prefix: 'osmo',
    fees: [
      {
        coinDenom: 'OSMO',
        coinMinimalDenom: 'uosmo',
        coinDecimals: 6,
        gasPriceStep: {
          low: 0.0025,
          average: 0.025,
          high: 0.04,
        },
        coinImageUrl:
          'https://raw.githubusercontent.com/cosmos/chain-registry/master/osmosis/images/osmo.png',
      },
    ],
    staking: {
      coinDenom: 'OSMO',
      coinMinimalDenom: 'uosmo',
      coinDecimals: 6,
      coinImageUrl:
        'https://raw.githubusercontent.com/cosmos/chain-registry/master/osmosis/images/osmo.png',
    },
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
      },
    },
  },
  ['elgafar-1']: {
    chain_name: 'local stargazetestnet',
    status: 'live',
    network_level: NetworkLevel.TESTNET,
    pretty_name: 'Stargaze Testnet',
    chain_type: 'cosmos',
    chain_id: 'elgafar-1',
    bech32_prefix: 'stars',
    fees: [
      {
        coinDenom: 'STARS',
        coinMinimalDenom: 'ustars',
        coinDecimals: 6,
        gasPriceStep: {
          low: 0.03,
          average: 0.04,
          high: 0.05,
        },
        coinImageUrl:
          'https://raw.githubusercontent.com/cosmos/chain-registry/master/stargaze/images/stars.png',
      },
    ],
    staking: {
      coinDenom: 'STARS',
      coinMinimalDenom: 'ustars',
      coinDecimals: 6,
      coinImageUrl:
        'https://raw.githubusercontent.com/cosmos/chain-registry/master/stargaze/images/stars.png',
    },
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
      },
    },
  },
};

export const LOCAL_CHAIN_REGISTRY: {
  mainnet: LocalChainRegistry;
  testnet: LocalChainRegistry;
} = {
  mainnet: LOCAL_MAINNET_REGISTRY,
  testnet: LOCAL_TESTNET_REGISTRY,
};

export const DEFAULT_SUBSCRIPTION: SubscriptionRecord = {
  // NOTE: 2 mainnet
  [SYMPHONY_MAINNET_ID]: ['note'],
  ['stargaze-1']: ['ustars'],

  // NOTE: 3 testnet
  [SYMPHONY_TESTNET_ID]: ['note'],
  ['osmo-test-5']: ['uosmo'],
  ['elgafar-1']: ['ustars'],
};
