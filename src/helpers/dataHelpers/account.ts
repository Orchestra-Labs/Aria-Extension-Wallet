import { AccountRecord, WalletRecord } from '@/types';
import { getLocalStorageItem, setLocalStorageItem } from './localStorage';
import { getPasswordRecords, hashPassword, savePasswordHash, updatePassword } from './password';
import { createWallet } from './wallet';
import { saveSessionData } from './session';
import { generateUUID } from '../uuid';
import { DEFAULT_SELECTIONS, DEFAULT_SUBSCRIPTION, SettingsOption } from '@/constants';
import { decryptMnemonic, encryptMnemonic } from './crypto';

const ACCOUNTS_KEY = 'accountsToken';

export const getAccounts = (): AccountRecord[] => {
  console.log('Fetching accounts from local storage');
  const accounts = getLocalStorageItem(ACCOUNTS_KEY);
  const parsedAccounts = accounts ? JSON.parse(accounts) : [];
  console.log('Accounts retrieved:', parsedAccounts);
  return parsedAccounts;
};

const saveAccounts = (accounts: AccountRecord[]): void => {
  console.log('Saving accounts to local storage:', accounts);
  setLocalStorageItem(ACCOUNTS_KEY, JSON.stringify(accounts));
  console.log('Accounts saved successfully.');
};

export const getAccountById = (id: string): AccountRecord | null => {
  const accounts = getAccounts();
  return accounts.find(acc => acc.id === id) || null;
};

export const getAccountIdByPassword = (inputPassword: string): string | null => {
  console.log('Searching for password hash in records');
  const passwords = getPasswordRecords();
  const index = passwords.findIndex(
    record => hashPassword(inputPassword, record.salt) === record.hash,
  );
  console.log('Password hash found at index:', index);
  return index !== -1 ? passwords[index].id : null;
};

export const saveAccountById = (updatedAccount: AccountRecord): boolean => {
  const accounts = getAccounts();
  const accountIndex = accounts.findIndex(acc => acc.id === updatedAccount.id);

  if (accountIndex === -1) {
    console.warn(`Account with id ${updatedAccount.id} not found.`);
    return false;
  }

  accounts[accountIndex] = updatedAccount;
  saveAccounts(accounts);
  return true;
};

export const removeAccountById = (id: string): boolean => {
  console.log(`Removing account by ID: ${id}`);
  const accounts = getAccounts();
  const filteredAccounts = accounts.filter(acc => acc.id === id);

  if (accounts.length === filteredAccounts.length) {
    console.warn(`Account with ID ${id} not found.`);
    return false;
  }

  saveAccounts(filteredAccounts);
  console.log(`Account with ID ${id} removed successfully.`);
  return true;
};

// TODO: check password for ifExists. If exists, return error.  user can create wallet from within app if desired
export const createAccount = async (
  mnemonic: string,
  password: string,
  walletName: string,
  persist: boolean = true,
): Promise<AccountRecord> => {
  console.log('Creating new account with walletName:', walletName);

  const accountId = generateUUID();
  const passwordHash = savePasswordHash(accountId, password);
  console.log('Password hash generated:', passwordHash);

  const walletInfo = await createWallet(mnemonic, password, walletName);
  const secpWallet = walletInfo.wallet;
  const walletRecord = walletInfo.walletRecord;
  console.log('Wallet created and wallet record generated:', walletRecord);

  const newAccount: AccountRecord = {
    id: accountId,
    // TODO: move settings to defaults.  grab from there and add wallet id
    settings: {
      defaultSelections: DEFAULT_SELECTIONS,
      chainSubscriptions: DEFAULT_SUBSCRIPTION,
      activeWalletId: walletRecord.id,

      // feature access settings
      [SettingsOption.STABLECOIN_FEE]: false,
      [SettingsOption.VALIDATOR_STATUS]: false,
      [SettingsOption.TESTNET_ACCESS]: false,

      // initialization settings:
      hasSetCoinList: false,
      hasViewedTutorial: false,
    },
    wallets: [walletRecord],
  };

  console.log('New account structure:', newAccount);

  const accounts = getAccounts();
  accounts.push(newAccount);
  saveAccounts(accounts);
  console.log('New account saved successfully.');

  const sessionCreated = await saveSessionData(secpWallet, passwordHash, persist);
  console.log('Session created:', sessionCreated);

  if (!sessionCreated) {
    throw new Error('Failed to create wallet session');
  }

  return newAccount;
};

export const getWalletById = (account: AccountRecord, walletId: string): WalletRecord | null => {
  const walletRecord = account.wallets.find(wallet => wallet.id === walletId);
  return walletRecord ? walletRecord : null;
};

export const addWalletToAccount = async (
  accountId: string,
  wallet: WalletRecord,
): Promise<boolean> => {
  const account = getAccountById(accountId);
  if (!account) return false;

  const walletExists = account.wallets.some(existingWallet => existingWallet.id === wallet.id);
  if (walletExists) {
    console.warn('Wallet with this ID already exists in the account.');
    return false;
  }

  account.wallets.push(wallet);
  saveAccountById(account);
  console.log('Wallet added to account successfully.');

  return true;
};

export const removeWalletFromAccount = (accountId: string, walletId: string): boolean => {
  console.log(`Removing wallet with ID ${walletId} from account with ID ${accountId}`);

  const account = getAccountById(accountId);
  if (!account) {
    console.warn(`Account with ID ${accountId} not found.`);
    return false;
  }

  const walletIndex = account.wallets.findIndex(wallet => wallet.id === walletId);

  if (walletIndex === -1) {
    console.warn(`Wallet with ID ${walletId} not found in account.`);
    return false;
  }

  if (account.wallets.length <= 1) {
    console.warn(`Cannot remove wallet; account must retain at least one wallet.`);
    return false;
  }

  account.wallets.splice(walletIndex, 1);
  console.log(`Wallet with ID ${walletId} removed. Remaining wallets:`, account.wallets);

  if (account.settings.activeWalletId === walletId) {
    account.settings.activeWalletId = account.wallets[0].id;
    console.log('Active wallet ID updated to:', account.settings.activeWalletId);
  }

  saveAccountById(account);
  console.log('Account updated successfully after wallet removal.');
  return true;
};

export const updateWallet = (
  accountId: string,
  walletId: string,
  updatedFields: Partial<WalletRecord>,
): boolean => {
  const account = getAccountById(accountId);
  if (!account) {
    console.warn(`Account with ID ${accountId} not found.`);
    return false;
  }

  const walletIndex = account.wallets.findIndex(wallet => wallet.id === walletId);
  if (walletIndex === -1) {
    console.warn(`Wallet with ID ${walletId} not found in account.`);
    return false;
  }

  account.wallets[walletIndex] = {
    ...account.wallets[walletIndex],
    ...updatedFields,
  };

  saveAccountById(account);
  return true;
};

export const updateAccountPassword = ({
  accountId,
  newPassword,
  oldPassword,
}: {
  accountId: string;
  newPassword: string;
  oldPassword: string;
}): boolean => {
  const account = getAccountById(accountId);
  if (!account) {
    console.warn(`Account with ID ${accountId} not found.`);
    return false;
  }

  // Validate the old password
  const newHash = updatePassword(accountId, oldPassword, newPassword);
  if (!newHash) {
    console.warn('Old password does not match.');
    return false;
  }

  // Re-encrypt mnemonics for all wallets in the account
  const updatedWallets = account.wallets.map(wallet => {
    const decryptedMnemonic = decryptMnemonic(wallet.encryptedMnemonic, oldPassword);
    const reEncryptedMnemonic = encryptMnemonic(decryptedMnemonic, newPassword);
    return {
      ...wallet,
      encryptedMnemonic: reEncryptedMnemonic,
    };
  });

  // Save updated wallet records to the account
  account.wallets = updatedWallets;
  saveAccountById(account);
  return true;
};
