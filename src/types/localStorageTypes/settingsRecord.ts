import { SettingsOption } from '@/constants';

export interface NetworkSubscriptionRecord {
  [chainID: string]: string[];
}

export interface SubscriptionRecord {
  mainnet: NetworkSubscriptionRecord;
  testnet: NetworkSubscriptionRecord;
}

interface SelectionSettings {
  mainnet: {
    defaultChainId: string;
    defaultCoinDenom: string;
  };
  testnet: {
    defaultChainId: string;
    defaultCoinDenom: string;
  };
}

export interface SettingsRecord {
  defaultSelections: SelectionSettings;
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
