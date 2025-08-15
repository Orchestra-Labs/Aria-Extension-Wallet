import { SettingsRecord } from './settingsRecord';
import { WalletRecord } from './walletRecord';

export interface AccountRecord {
  // NOTE: password and account share id
  id: string;
  // prioritize lowest level settings for priority (wallet visibility over account visibility)
  settings: SettingsRecord;
  wallets: WalletRecord[];
}
