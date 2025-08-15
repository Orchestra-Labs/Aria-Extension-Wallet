import { getAccountById, getAccountIdByPassword, getAccounts, getWalletById } from './account';
import { decryptMnemonic } from './crypto';
import { clearLocalStorage } from './localStorage';
import { getPasswordRecords } from './password';
import { saveSessionData } from './session';
import { getWallet } from './wallet';

export const userCanLogIn = () => {
  console.log('Checking if user can log in...');

  const passwordRecords = getPasswordRecords();
  console.log('Password records retrieved:', passwordRecords);

  const accounts = getAccounts();
  console.log('Stored accounts:', accounts);

  // Check if passwordRecords is an array
  if (!Array.isArray(passwordRecords)) {
    console.log('Password records is not an array');
    return false;
  }

  // Check if accounts is an array
  if (!Array.isArray(accounts)) {
    console.log('Accounts is not an array');
    return false;
  }

  const canLogIn = passwordRecords.some(passwordRecord =>
    accounts.some(account => account.id === passwordRecord.id),
  );

  console.log('Can log in:', canLogIn);
  return canLogIn;
};

export const clearStoredData = (): void => {
  console.log('Clearing all stored data from local storage...');
  clearLocalStorage();
};

export const tryAuthorizeAccess = async (
  password: string,
  persist: boolean = false,
): Promise<'success' | 'no_wallet' | 'error'> => {
  console.log('Attempting to authorize access...');

  const loginEnabled = userCanLogIn();
  if (!loginEnabled) return 'no_wallet';

  const accountId = getAccountIdByPassword(password);
  if (!accountId) {
    console.log('No matching account found in local storage.');
    return 'error';
  }
  console.log('Account found:', accountId);

  try {
    console.log('Retrieving wallet');
    const account = getAccountById(accountId);
    if (!account) return 'error';

    const walletId = account?.settings.activeWalletId;
    const wallet = getWalletById(account, walletId);
    if (!wallet) return 'error';

    const mnemonic = decryptMnemonic(wallet.encryptedMnemonic, password);
    const decryptedWallet = await getWallet(mnemonic);
    console.log('Wallet retrieved:', decryptedWallet);

    console.log('Saving session data...');
    await saveSessionData(decryptedWallet, accountId, persist);

    console.log('Authorization successful');
    return 'success';
  } catch (error) {
    console.error('Authorization failed with error:', error);
    return 'error';
  }
};
