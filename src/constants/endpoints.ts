export const COSMOS_CHAIN_ENDPOINTS = {
  // auth module
  getModuleAccounts: '/cosmos/auth/v1beta1/module_accounts',

  // bank module
  getBalance: '/cosmos/bank/v1beta1/balances/',
  sendMessage: '/cosmos.bank.v1beta1.MsgSend',

  // distribution module
  claimRewards: '/cosmos.distribution.v1beta1.MsgWithdrawDelegatorReward',
  getDistributionParams: '/cosmos/distribution/v1beta1/params',
  getRewards: '/cosmos/distribution/v1beta1/delegators',

  // ibc module
  getIBCConnections: '/ibc/core/channel/v1/channels',
  getIBCInfo: '/ibc/apps/transfer/v1/denom_traces/',

  // slashing module
  getSigningInfos: '/cosmos/slashing/v1beta1/signing_infos',
  getSlashingParams: '/cosmos/slashing/v1beta1/params',
  getUptime: '/cosmos/slashing/v1beta1/signing_infos/',

  // staking module
  delegateToValidator: '/cosmos.staking.v1beta1.MsgDelegate',
  getDelegations: '/cosmos/staking/v1beta1/delegations/',
  getSpecificDelegations: '/cosmos/staking/v1beta1/delegators/',
  getStakingParams: '/cosmos/staking/v1beta1/params',
  getStakingPool: '/cosmos/staking/v1beta1/pool',
  getValidators: '/cosmos/staking/v1beta1/validators',
  undelegateFromValidator: '/cosmos.staking.v1beta1.MsgUndelegate',

  // tx module
  sendIbcMessage: '/cosmos/tx/v1beta1/txs',
};

export const SYMPHONY_ENDPOINTS = {
  // market module
  exchangeRequirements: '/symphony/market/v1beta1/exchange_requirements',
  swap: '/symphony/market/v1beta1/swap?',

  // mint module
  getMintEpochProvisions: '/symphony/mint/v1beta1/epoch_provisions',
  getMintParams: '/symphony/mint/v1beta1/params',

  // treasury module
  getTobinTaxRate: '/symphony/treasury/v1beta1/tax_rate',
};
