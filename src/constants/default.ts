import { Asset, LocalChainRegistry, SubscriptionRecord } from '@/types';
import { NetworkLevel } from './enums';

export const WINDOW_SIZE = {
  width: 420,
  height: 600,
};

export const VALID_PASSWORD_LENGTH = 8;

// Network-related constants
export const NETWORK = 'symphony';
export const WALLET_PREFIX = 'symphony';

// RPC and REST URLs for the Symphony network
const DEFAULT_TO_TESTNET = true;
export const DEFAULT_TESTNET_NAME = 'symphonytestnet';
export const DEFAULT_TESTNET_ID = 'symphony-testnet-4';
export const DEFAULT_MAINNET_NAME = 'symphony';
export const DEFAULT_MAINNET_ID = 'symphony-1';
export const DEFAULT_CHAIN_NAME = DEFAULT_TO_TESTNET ? DEFAULT_TESTNET_NAME : DEFAULT_MAINNET_NAME;
export const DEFAULT_CHAIN_ID = DEFAULT_TO_TESTNET ? DEFAULT_TESTNET_ID : DEFAULT_MAINNET_ID;

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
export const LOCAL_ASSET_REGISTRY: AssetRegistry = {
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
    networkID: DEFAULT_CHAIN_ID,
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
    networkID: DEFAULT_CHAIN_ID,
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
    networkID: DEFAULT_CHAIN_ID,
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
    networkID: DEFAULT_CHAIN_ID,
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

export const LOCAL_CHAIN_REGISTRY: LocalChainRegistry = {
  [DEFAULT_TESTNET_ID]: {
    chain_name: 'symphonytestnet',
    status: 'active',
    network_level: NetworkLevel.TESTNET,
    pretty_name: 'Symphony Testnet',
    chain_type: 'cosmos',
    chain_id: DEFAULT_TESTNET_ID,
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
    logo_uri: LOCAL_ASSET_REGISTRY.note.logo,
    assets: LOCAL_ASSET_REGISTRY,
  },
  [DEFAULT_MAINNET_ID]: {
    chain_name: 'symphony',
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
  },
  ['osmo-test-5']: {
    chain_name: 'osmosistestnet',
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
    rpc_uris: [
      { address: 'https://rpc.osmotest5.osmosis.zone/', provider: 'Osmosis' },
      {
        address: 'https://osmosis-testnet-tendermint.reliableninjas.com',
        provider: 'Reliable Ninjas',
      },
    ],
    rest_uris: [
      { address: 'https://lcd.osmotest5.osmosis.zone/', provider: 'Osmosis' },
      {
        address: 'https://osmosis-testnet-cosmos.reliableninjas.com',
        provider: 'Reliable Ninjas',
      },
    ],
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
};

export const DEFAULT_SUBSCRIPTION: SubscriptionRecord = {
  [DEFAULT_CHAIN_ID]: ['note'],
  ['osmo-test-5']: ['uosmo'],
};
