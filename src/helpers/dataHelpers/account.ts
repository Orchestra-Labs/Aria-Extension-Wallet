import { AccountRecord, SubscriptionRecord, WalletRecord } from '@/types';
import { getLocalStorageItem, setLocalStorageItem } from './localStorage';
import { getPasswordRecords, hashPassword, savePasswordHash, updatePassword } from './password';
import { createWallet } from './wallet';
import { saveSessionData } from './session';
import { generateUUID } from '../uuid';
import { DEFAULT_SUBSCRIPTION, SettingsOption } from '@/constants';
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

export const getAccountByID = (id: string): AccountRecord | null => {
  const accounts = getAccounts();
  return accounts.find(acc => acc.id === id) || null;
};

export const getAccountIDByPassword = (inputPassword: string): string | null => {
  console.log('Searching for password hash in records');
  const passwords = getPasswordRecords();
  const index = passwords.findIndex(
    record => hashPassword(inputPassword, record.salt) === record.hash,
  );
  console.log('Password hash found at index:', index);
  return index !== -1 ? passwords[index].id : null;
};

export const saveAccountByID = (updatedAccount: AccountRecord): boolean => {
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

export const removeAccountByID = (id: string): boolean => {
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
  subscriptions: SubscriptionRecord = {},
  persist: boolean = true,
): Promise<AccountRecord> => {
  console.log('Creating new account with walletName:', walletName);

  const accountID = generateUUID();
  const passwordHash = savePasswordHash(accountID, password);
  console.log('Password hash generated:', passwordHash);

  const walletInfo = await createWallet(mnemonic, password, walletName);
  const secpWallet = walletInfo.wallet;
  const walletRecord = walletInfo.walletRecord;
  console.log('Wallet created and wallet record generated:', walletRecord);

  // Set default network and coin denom based on the first entry in subscriptions, if available
  const defaultChainID = Object.keys(subscriptions)[0] || '';
  const defaultCoinDenom = subscriptions[defaultChainID]?.[0] || '';

  const newAccount: AccountRecord = {
    id: accountID,
    settings: {
      defaultChainID,
      defaultCoinDenom,
      chainSubscriptions: DEFAULT_SUBSCRIPTION,
      activeWalletID: walletRecord.id,
      [SettingsOption.STABLECOIN_FEE]: false,
      [SettingsOption.VALIDATOR_STATUS]: false,
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

export const getWalletByID = (account: AccountRecord, walletID: string): WalletRecord | null => {
  const walletRecord = account.wallets.find(wallet => wallet.id === walletID);
  return walletRecord ? walletRecord : null;
};

export const addWalletToAccount = async (
  accountID: string,
  wallet: WalletRecord,
): Promise<boolean> => {
  const account = getAccountByID(accountID);
  if (!account) return false;

  const walletExists = account.wallets.some(existingWallet => existingWallet.id === wallet.id);
  if (walletExists) {
    console.warn('Wallet with this ID already exists in the account.');
    return false;
  }

  account.wallets.push(wallet);
  saveAccountByID(account);
  console.log('Wallet added to account successfully.');

  return true;
};

export const removeWalletFromAccount = (accountID: string, walletID: string): boolean => {
  console.log(`Removing wallet with ID ${walletID} from account with ID ${accountID}`);

  const account = getAccountByID(accountID);
  if (!account) {
    console.warn(`Account with ID ${accountID} not found.`);
    return false;
  }

  const walletIndex = account.wallets.findIndex(wallet => wallet.id === walletID);

  if (walletIndex === -1) {
    console.warn(`Wallet with ID ${walletID} not found in account.`);
    return false;
  }

  if (account.wallets.length <= 1) {
    console.warn(`Cannot remove wallet; account must retain at least one wallet.`);
    return false;
  }

  account.wallets.splice(walletIndex, 1);
  console.log(`Wallet with ID ${walletID} removed. Remaining wallets:`, account.wallets);

  if (account.settings.activeWalletID === walletID) {
    account.settings.activeWalletID = account.wallets[0].id;
    console.log('Active wallet ID updated to:', account.settings.activeWalletID);
  }

  saveAccountByID(account);
  console.log('Account updated successfully after wallet removal.');
  return true;
};

export const updateWallet = (
  accountID: string,
  walletID: string,
  updatedFields: Partial<WalletRecord>,
): boolean => {
  const account = getAccountByID(accountID);
  if (!account) {
    console.warn(`Account with ID ${accountID} not found.`);
    return false;
  }

  const walletIndex = account.wallets.findIndex(wallet => wallet.id === walletID);
  if (walletIndex === -1) {
    console.warn(`Wallet with ID ${walletID} not found in account.`);
    return false;
  }

  account.wallets[walletIndex] = {
    ...account.wallets[walletIndex],
    ...updatedFields,
  };

  saveAccountByID(account);
  return true;
};

export const updateAccountPassword = ({
  accountID,
  newPassword,
  oldPassword,
}: {
  accountID: string;
  newPassword: string;
  oldPassword: string;
}): boolean => {
  const account = getAccountByID(accountID);
  if (!account) {
    console.warn(`Account with ID ${accountID} not found.`);
    return false;
  }

  // Validate the old password
  const newHash = updatePassword(accountID, oldPassword, newPassword);
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
  saveAccountByID(account);
  return true;
};
