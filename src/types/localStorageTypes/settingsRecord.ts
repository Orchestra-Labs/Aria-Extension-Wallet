import { SettingsOption } from '@/constants';

export interface SubscriptionRecord {
  [chainID: string]: string[];
}

export interface SettingsRecord {
  defaultNetworkID: string;
  defaultCoinDenom: string;
  subscribedTo: SubscriptionRecord;
  activeWalletID: string;
  [SettingsOption.STABLECOIN_FEE]: boolean;
  [SettingsOption.VALIDATOR_STATUS]: boolean;

  // initialization settings:
  hasSetCoinList: boolean;
  hasViewedTutorial: boolean;
}
