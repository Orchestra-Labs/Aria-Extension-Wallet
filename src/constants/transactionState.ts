import { DEFAULT_FEE_TOKEN, SYMPHONY_MAINNET_ID } from './default';
import { DEFAULT_MAINNET_ASSET } from './localRegistry';

export const DEFAULT_SEND_STATE = {
  asset: DEFAULT_MAINNET_ASSET,
  amount: 0,
  chainId: SYMPHONY_MAINNET_ID,
};

export const DEFAULT_RECEIVE_STATE = {
  asset: DEFAULT_MAINNET_ASSET,
  amount: 0,
  chainId: SYMPHONY_MAINNET_ID,
};

export const DEFAULT_FEE_STATE = {
  asset: DEFAULT_MAINNET_ASSET,
  amount: 0,
  chainId: DEFAULT_MAINNET_ASSET.networkID,
  feeToken: DEFAULT_FEE_TOKEN,
  gasWanted: 0,
  gasPrice: 0,
};
