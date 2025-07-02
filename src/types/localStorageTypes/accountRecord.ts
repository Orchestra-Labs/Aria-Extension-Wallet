import { SettingsRecord } from './settingsRecord';
import { WalletRecord } from './walletRecord';

export interface AccountRecord {
  id: string; // password and account share ID
  // prioritize lowest level settings for priority (wallet visibility over account visibility)
  settings: SettingsRecord;
  wallets: WalletRecord[];
}
