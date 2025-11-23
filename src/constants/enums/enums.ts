export enum TransactionType {
  SEND = 'Send',
  EXCHANGE = 'Exchange',
  SWAP = 'Swap',
  IBC_SEND = 'IBC Send',
  IBC_SWAP = 'IBC Swap',
  INVALID = 'Invalid',
  STAKE = 'Stake',
  UNSTAKE = 'Unstake',
  CLAIM_TO_WALLET = 'Claim To Wallet',
  CLAIM_TO_RESTAKE = 'Claim To Restake',
}

export enum TransactionStatus {
  IDLE = 'idle',
  PENDING = 'pending',
  SUCCESS = 'success',
  ERROR = 'error',
}

export enum TextClass {
  ERROR = 'text-error',
  WARNING = 'text-warning',
  GOOD = 'text-blue',
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

export enum TransferMethod {
  SKIP = 'skip',
  STANDARD = 'standard',
}

export enum QueryType {
  GET = 'GET',
  POST = 'POST',
}

export enum CommType {
  RPC = 'rpc',
  REST = 'rest',
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

export enum RevenueEventType {
  ON_RAMPING = 'on_ramping',
  OFF_RAMPING = 'off_ramping',
  CURRENCY_TRADE = 'currency_trade',
  AI_SUBSCRIPTION = 'ai_subscription',
  STAKING_SERVICE_FEE = 'staking_service_fee',
}
