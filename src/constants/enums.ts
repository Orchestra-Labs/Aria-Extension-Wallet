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
