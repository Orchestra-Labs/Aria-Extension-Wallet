import { SettingsOption } from '@/constants';

export interface NetworkSubscriptionRecord {
  [chainID: string]: string[];
}

export interface SubscriptionRecord {
  mainnet: NetworkSubscriptionRecord;
  testnet: NetworkSubscriptionRecord;
}

export interface SettingsRecord {
  defaultChainID: string;
  defaultCoinDenom: string;
  chainSubscriptions: SubscriptionRecord;
  activeWalletID: string;

  // feature access settings
  [SettingsOption.STABLECOIN_FEE]: boolean;
  [SettingsOption.VALIDATOR_STATUS]: boolean;
  [SettingsOption.TESTNET_ACCESS]: boolean;

  // initialization settings:
  hasSetCoinList: boolean;
  hasViewedTutorial: boolean;
}
