import { Asset } from '@/types';

export const NETWORK = 'symphony';
export const WALLET_PREFIX = 'symphony';

export const rpcUrl = 'https://symphony-api.kleomedes.network';
export const defaultChainName = 'symphonytestnet';
export const walletPrefix = 'symphony1';
export const IBCPrefix = 'ibc/';
export const lesserExponentDefault = 0;
export const greaterExponentDefault = 6;
export const chainEndpoint = {
  symphonytestnet: {
    rpc: [' https://symphony-rpc.kleomedes.network'],
    rest: ['https://symphony-api.kleomedes.network'],
  },
};

const FIFTEEN_MINUTES = 15 * 60 * 1000; // 15 minutes in milliseconds
export const INACTIVITY_TIMEOUT = FIFTEEN_MINUTES;
export const TOKEN_EXPIRATION_TIME = FIFTEEN_MINUTES;
export const DATA_FRESHNESS_TIMEOUT = 0.5 * 15 * 1000; // Data is considered fresh for 15 seconds

type AssetRegistry = {
  [key: string]: Asset;
};

export const localAssetRegistry: AssetRegistry = {
  uusd: {
    denom: 'uusd',
    amount: '10',
    isIbc: false,
    logo: 'https://raw.githubusercontent.com/cosmos/chain-registry/master/testnets/symphonytestnet/images/husd.png',
    symbol: 'HUSD',
    exponent: 6,
  },
  ukhd: {
    denom: 'ukhd',
    amount: '1.282',
    isIbc: false,
    logo: 'https://raw.githubusercontent.com/cosmos/chain-registry/master/testnets/symphonytestnet/images/hhkd.png',
    symbol: 'HHKD',
    exponent: 6,
  },
  uvnd: {
    denom: 'uvnd',
    amount: '0.000399',
    isIbc: false,
    logo: 'https://raw.githubusercontent.com/cosmos/chain-registry/master/testnets/symphonytestnet/images/hvnd.png',
    symbol: 'HVND',
    exponent: 6,
  },
  note: {
    denom: 'note',
    amount: '1',
    isIbc: false,
    logo: 'https://raw.githubusercontent.com/cosmos/chain-registry/master/testnets/symphonytestnet/images/mld.png',
    symbol: 'MLD',
    exponent: 6,
  },
};
