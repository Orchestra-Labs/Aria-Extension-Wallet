export const COSMOS_CHAIN_ENDPOINTS = {
  // NOTE: Cosmos standard endpoints
  getBalance: '/cosmos/bank/v1beta1/balances/',
  getDelegations: '/cosmos/staking/v1beta1/delegations/',
  getSpecificDelegations: '/cosmos/staking/v1beta1/delegators/',
  getValidators: '/cosmos/staking/v1beta1/validators',
  getRewards: '/cosmos/distribution/v1beta1/delegators',
  claimRewards: '/cosmos.distribution.v1beta1.MsgWithdrawDelegatorReward',
  delegateToValidator: '/cosmos.staking.v1beta1.MsgDelegate',
  undelegateFromValidator: '/cosmos.staking.v1beta1.MsgUndelegate',
  sendMessage: '/cosmos.bank.v1beta1.MsgSend',
  getStakingParams: '/cosmos/staking/v1beta1/params',
  getUptime: '/cosmos/slashing/v1beta1/signing_infos/',
  sendIbcMessage: '/cosmos/tx/v1beta1/txs',
  getModuleAccounts: '/cosmos/auth/v1beta1/module_accounts',
  getStakingPool: '/cosmos/staking/v1beta1/pool',
  getDistributionParams: '/cosmos/distribution/v1beta1/params',
  getSigningInfos: '/cosmos/slashing/v1beta1/signing_infos',
  getSlashingParams: '/cosmos/slashing/v1beta1/params',

  // NOTE: IBC standard endpoints
  getIBCInfo: '/ibc/apps/transfer/v1/denom_traces/',
  getIBCConnections: '/ibc/core/channel/v1/channels',
};

export const SYMPHONY_ENDPOINTS = {
  swap: '/symphony/market/v1beta1/swap?',
  exchangeRequirements: '/symphony/market/v1beta1/exchange_requirements',
  getTobinTaxRate: '/symphony/treasury/v1beta1/tax_rate',
  getMintEpochProvisions: '/symphony/mint/v1beta1/epoch_provisions',
  getMintParams: '/symphony/mint/v1beta1/params',
};
