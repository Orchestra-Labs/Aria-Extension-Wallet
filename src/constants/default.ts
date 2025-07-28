export const WINDOW_SIZE = {
  width: 420,
  height: 600,
};

export const VALID_PASSWORD_LENGTH = 8;

// Network-related constants
export const DEFAULT_DENOM = 'note';
export const NETWORK = 'symphony';
export const SYMPHONY_PREFIX = 'symphony';

// RPC and REST URLs for the Symphony network
export const SYMPHONY_TESTNET_NAME = 'symphonytestnet';
export const SYMPHONY_TESTNET_ID = 'symphony-testnet-4';
export const SYMPHONY_MAINNET_NAME = 'symphony';
export const SYMPHONY_MAINNET_ID = 'symphony-1';
export const SYMPHONY_CHAIN_ID_LIST = [SYMPHONY_MAINNET_ID, SYMPHONY_TESTNET_ID];

// IBC-related constants
export const IBC_PREFIX = 'ibc/';
export const LESSER_EXPONENT_DEFAULT = 0;
export const GREATER_EXPONENT_DEFAULT = 6;
export const DEFAULT_EXTERNAL_GAS_PRICES = { low: 0.01, average: 0.025, high: 0.04 };
export const DEFAULT_GAS_PRICES = { low: 0.00025, average: 0.0025, high: 0.004 };
export const DEFAULT_FEE_TOKEN = {
  denom: DEFAULT_DENOM,
  gasPriceStep: DEFAULT_GAS_PRICES,
};

export const DEFAULT_SELECTIONS = {
  mainnet: {
    defaultChainId: SYMPHONY_MAINNET_ID,
    defaultCoinDenom: DEFAULT_DENOM,
  },
  testnet: {
    defaultChainId: SYMPHONY_TESTNET_ID,
    defaultCoinDenom: DEFAULT_DENOM,
  },
};

export const MAX_RETRIES_PER_QUERY = 3;

export const KNOWN_EPOCH_BASED_CHAINS = [
  'symphony-1',
  'stargaze-1',
  'juno-1',
  'osmosis-1',
  'comdex-1',
  'injective-1',
  'chihuahua-1',
  'secret-4',
  'umee-1',
  'evmos_9001-2',
  'gravity-bridge-3',
];
