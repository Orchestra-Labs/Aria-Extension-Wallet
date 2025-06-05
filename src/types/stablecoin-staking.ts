export type StablecoinStakingParams = {
  params: {
    reward_rate: string;
    unbonding_duration: string;
    supported_tokens: string[];
    epoch_identifier: string;
    max_staking_amount: string;
  };
};

export interface IStablePool {
  token: string;
  total_staked: string;
  total_shares: string;
}

export type StablecoinStakingStablePool = {
  pool: IStablePool;
};

export type StablecoinStakingStablePools = {
  pools: IStablePool[];
};

export type StablecoinStakingUserStake = {
  stakes: {
    address: string;
    shares: string;
    epoch: string;
  };
};

export type StablecoinStakingUserTotalStake = {
  stakes: [
    {
      denom: string;
      amount: string;
    },
  ];
};

export interface IStablecoinUserUnbonding {
  address: string;
  amount: string;
  denom: string;
  unbond_epoch: string;
}

export type StablecoinStakingUserUnbonding = {
  info: IStablecoinUserUnbonding;
};

export type StablecoinStakingUserTotalUnbondings = {
  info: IStablecoinUserUnbonding[];
};

export type StablecoinStakeParams = {
  staker: string;
  amount: {
    denom: string;
    amount: string;
  };
};
