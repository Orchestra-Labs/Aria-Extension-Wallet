import { SettingsOption } from '@/constants';

export interface DenomSubscriptionRecord {
  viewAll: boolean;
  subscribedDenoms: string[];
}

export interface NetworkSubscriptionRecord {
  [chainId: string]: DenomSubscriptionRecord;
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
  activeWalletId: string;

  // feature access settings
  [SettingsOption.STABLECOIN_FEE]: boolean;
  [SettingsOption.VALIDATOR_STATUS]: boolean;
  [SettingsOption.TESTNET_ACCESS]: boolean;

  // initialization settings:
  hasSetCoinList: boolean;
  hasViewedTutorial: boolean;
}
