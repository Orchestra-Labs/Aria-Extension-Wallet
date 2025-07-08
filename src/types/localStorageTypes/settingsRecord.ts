import { SettingsOption } from '@/constants';

export interface SubscriptionRecord {
  [chainID: string]: string[];
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
