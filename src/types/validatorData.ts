export interface ValidatorInfo {
  operator_address: string;
  consensus_pubkey: {
    '@type': string;
    key: string;
  };
  jailed: boolean;
  status: string; // Bonded, Unbonding, Unbonded
  tokens: string;
  delegator_shares: string;
  description: {
    moniker: string;
    website: string;
    details: string;
    identity?: string;
  };
  commission: {
    commission_rates: {
      rate: string;
      max_rate: string;
      max_change_rate: string;
    };
  };
}

export interface Coin {
  denom: string;
  amount: string;
}

export interface ValidatorReward {
  validator_address: string;
  reward: Coin[];
}

export interface DelegationResponse {
  delegation: {
    delegator_address: string;
    validator_address: string;
    shares: string;
  };
  balance: {
    denom: string;
    amount: string;
  };
}

export interface UnbondingDelegationEntry {
  balance: string;
  completion_time: string;
}

export interface StakingParams {
  unbonding_time: string;
  max_validators: number;
  max_entries: number;
  historical_entries: number;
  bond_denom: string;
}

export interface FullValidatorInfo {
  delegation: DelegationResponse['delegation'];
  balance: DelegationResponse['balance'];
  validator: ValidatorInfo;
  rewards: Coin[];
  stakingParams?: StakingParams | null;
  commission: string;
  theoreticalApr?: string;
  votingPower?: string;
  uptime?: string;
  unbondingBalance?: UnbondingDelegationEntry;
}

export interface ValidatorLogoInfo {
  url: string | null;
  isFallback: boolean;
  error: boolean;
}
