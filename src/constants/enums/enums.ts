// TODO: add send and swap?  or keep as validator actions?
export enum TransactionType {
  STAKE = 'Stake',
  UNSTAKE = 'Unstake',
  CLAIM_TO_WALLET = 'Claim to wallet',
  CLAIM_TO_RESTAKE = 'Claim to restake',
}

export enum TextFieldStatus {
  ERROR = 'error',
  WARN = 'warn',
  GOOD = 'good',
}

export enum IBCConnectionState {
  OPEN = 'STATE_OPEN',
  CLOSED = 'STATE_CLOSED',
}

export enum InputStatus {
  ERROR = 'error',
  SUCCESS = 'success',
  WARNING = 'warning',
  INFO = 'info',
  NEUTRAL = '',
}

export enum NetworkLevel {
  TESTNET = 'testnet',
  MAINNET = 'mainnet',
}

export enum QueryType {
  GET = 'GET',
  POST = 'POST',
}

export enum Position {
  TOP = 'top',
  BOTTOM = 'bottom',
  LEFT = 'left',
  RIGHT = 'right',
}

export enum SettingsOption {
  STABLECOIN_FEE = 'stablecoinFeeElection',
  VALIDATOR_STATUS = 'viewValidatorsByStatus',
  TESTNET_ACCESS = 'enableTestnetAccess',
}
