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

export enum ValidatorAction {
  STAKE = 'stake',
  UNSTAKE = 'unstake',
  CLAIM = 'claim',
  NONE = 'none',
}
