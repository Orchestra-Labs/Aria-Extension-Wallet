export enum ValidatorStatusFilter {
  STATUS_ACTIVE,
  STATUS_NON_JAILED,
  STATUS_ALL,
}

export enum BondStatus {
  UNSPECIFIED = 'BOND_STATUS_UNSPECIFIED',
  UNBONDED = 'BOND_STATUS_UNBONDED',
  UNBONDING = 'BOND_STATUS_UNBONDING',
  BONDED = 'BOND_STATUS_BONDED',
}

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

export enum ValidatorSortType {
  NAME = 'name',
  DELEGATION = 'delegation',
  REWARDS = 'rewards',
  APY = 'apy',
  VOTING_POWER = 'votingPower',
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

export enum Position {
  TOP = 'top',
  BOTTOM = 'bottom',
  LEFT = 'left',
  RIGHT = 'right',
}
