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

  // mint module
  getMintParams: '/cosmos/mint/v1beta1/params',
  getInflation: '/cosmos/mint/v1beta1/inflation',
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

export const OSMOSIS_ENDPOINTS = {
  pools: '/osmosis/gamm/v1beta1/pools',
  poolDetail: '/osmosis/gamm/v1beta1/pools/',
  quote: '/osmosis/poolmanager/v1beta1/quote',
  spotPrice: '/osmosis/poolmanager/v1beta1/spot_price',
  totalLiquidity: '/osmosis/poolmanager/v1beta1/total_liquidity',
  exchangeTransactions: '/osmosis/poolmanager/v1beta1/all_txs',
  poolTransactions: '/osmosis/poolmanager/v1beta1/pools/{poolId}/txs',
  txDetails: '/cosmos/tx/v1beta1/txs/{txHash}',
  getOsmosisPools: '/osmosis/gamm/v1beta1/pools',
  getOsmosisAssetList: '/osmosis/tokenfactory/v1beta1/denoms_from_creator/',
  singleSwapSimulation: '/osmosis/poolmanager/v1beta1/estimate/single_pool_swap_exact_amount_in',
  multiHopSimulation: '/osmosis/poolmanager/v1beta1/estimate/swap_exact_amount_in',
  simulation: '/osmosis/poolmanager/v1beta1/estimate/swap_exact_amount_in',
  swap: '/osmosis/poolmanager/v1beta1/swap_exact_amount_in',
};
