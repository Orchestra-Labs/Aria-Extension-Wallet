import { beforeEach, describe, expect, it, vi } from 'vitest';

import * as accountHelpers from '@/helpers/dataHelpers/account';
import * as auth from '@/helpers/dataHelpers/auth';
import * as crypto from '@/helpers/dataHelpers/crypto';
import * as localStorageHelpers from '@/helpers/dataHelpers/localStorage';
import * as passwordHelpers from '@/helpers/dataHelpers/password';
import * as sessionHelper from '@/helpers/dataHelpers/session';
import * as walletHelper from '@/helpers/dataHelpers/wallet';

describe('auth helpers', () => {
  beforeEach(() => {
    vi.resetAllMocks();

    // Default mocks for getPasswordRecords and getAccounts for userCanLogIn to succeed
    vi.spyOn(passwordHelpers, 'getPasswordRecords').mockReturnValue([{ id: 'acc1' }]);
    vi.spyOn(accountHelpers, 'getAccounts').mockReturnValue([{ id: 'acc1' }]);
  });

  it('userCanLogIn returns true if passwordRecords and matching account exist', () => {
    const result = auth.userCanLogIn();
    expect(result).toBe(true);
  });

  it('userCanLogIn returns false if passwordRecords is not an array', () => {
    vi.spyOn(passwordHelpers, 'getPasswordRecords').mockReturnValue(null);
    const result = auth.userCanLogIn();
    expect(result).toBe(false);
  });

  it('userCanLogIn returns false if accounts is not an array', () => {
    vi.spyOn(accountHelpers, 'getAccounts').mockReturnValue(null);
    const result = auth.userCanLogIn();
    expect(result).toBe(false);
  });

  it('userCanLogIn returns false if no account matches passwordRecord', () => {
    vi.spyOn(passwordHelpers, 'getPasswordRecords').mockReturnValue([{ id: 'acc2' }]);
    vi.spyOn(accountHelpers, 'getAccounts').mockReturnValue([{ id: 'acc1' }]);
    const result = auth.userCanLogIn();
    expect(result).toBe(false);
  });

  it('clearStoredData calls clearLocalStorage', () => {
    const clearSpy = vi.spyOn(localStorageHelpers, 'clearLocalStorage');
    auth.clearStoredData();
    expect(clearSpy).toHaveBeenCalled();
  });

  it('tryAuthorizeAccess returns "no_wallet" if userCanLogIn returns false', async () => {
    vi.spyOn(passwordHelpers, 'getPasswordRecords').mockReturnValue(null);
    vi.spyOn(accountHelpers, 'getAccounts').mockReturnValue(null);
    const result = await auth.tryAuthorizeAccess('password');
    expect(result).toBe('no_wallet');
  });

  it('tryAuthorizeAccess returns "error" if accountID not found for password', async () => {
    vi.spyOn(passwordHelpers, 'getPasswordRecords').mockReturnValue([{ id: 'acc1' }]);
    vi.spyOn(accountHelpers, 'getAccounts').mockReturnValue([{ id: 'acc1' }]);
    vi.spyOn(accountHelpers, 'getAccountIDByPassword').mockReturnValue(null);

    const result = await auth.tryAuthorizeAccess('password');
    expect(result).toBe('error');
  });

  it('tryAuthorizeAccess returns "error" if account is null', async () => {
    vi.spyOn(accountHelpers, 'getAccountIDByPassword').mockReturnValue('acc1');
    vi.spyOn(accountHelpers, 'getAccountByID').mockReturnValue(null);

    const result = await auth.tryAuthorizeAccess('password');
    expect(result).toBe('error');
  });

  it('tryAuthorizeAccess returns "error" if wallet is null', async () => {
    vi.spyOn(accountHelpers, 'getAccountIDByPassword').mockReturnValue('acc1');
    vi.spyOn(accountHelpers, 'getAccountByID').mockReturnValue({
      id: 'acc1',
      settings: { activeWalletID: 'wallet1' },
      wallets: [{ id: 'wallet1', encryptedMnemonic: 'encryptedMnemonic' }],
    });
    vi.spyOn(accountHelpers, 'getWalletByID').mockReturnValue(null);

    const result = await auth.tryAuthorizeAccess('password');
    expect(result).toBe('error');
  });

  it('tryAuthorizeAccess returns "success" on successful authorization', async () => {
    vi.spyOn(accountHelpers, 'getAccountIDByPassword').mockReturnValue('acc1');
    vi.spyOn(accountHelpers, 'getAccountByID').mockReturnValue({
      id: 'acc1',
      settings: { activeWalletID: 'wallet1' },
      wallets: [{ id: 'wallet1', encryptedMnemonic: 'encryptedMnemonic' }],
    });
    vi.spyOn(accountHelpers, 'getWalletByID').mockReturnValue({
      id: 'wallet1',
      encryptedMnemonic: 'encryptedMnemonic',
    });
    vi.spyOn(crypto, 'decryptMnemonic').mockReturnValue('mnemonic');
    vi.spyOn(walletHelper, 'getWallet').mockResolvedValue('walletObject');
    const saveSessionSpy = vi.spyOn(sessionHelper, 'saveSessionData').mockResolvedValue();

    const result = await auth.tryAuthorizeAccess('password');

    expect(result).toBe('success');
    expect(saveSessionSpy).toHaveBeenCalledWith('walletObject', 'acc1', false);
  });

  it('tryAuthorizeAccess returns "error" if an error occurs', async () => {
    vi.spyOn(accountHelpers, 'getAccountIDByPassword').mockReturnValue('acc1');
    vi.spyOn(accountHelpers, 'getAccountByID').mockReturnValue({
      id: 'acc1',
      settings: { activeWalletID: 'wallet1' },
      wallets: [{ id: 'wallet1', encryptedMnemonic: 'encryptedMnemonic' }],
    });
    vi.spyOn(accountHelpers, 'getWalletByID').mockReturnValue({
      id: 'wallet1',
      encryptedMnemonic: 'encryptedMnemonic',
    });
    vi.spyOn(crypto, 'decryptMnemonic').mockImplementation(() => {
      throw new Error('Decryption failed');
    });

    const result = await auth.tryAuthorizeAccess('password');

    expect(result).toBe('error');
  });
});
