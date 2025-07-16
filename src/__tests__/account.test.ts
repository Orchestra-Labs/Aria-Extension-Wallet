import { beforeEach, describe, expect, it, vi } from 'vitest';

import * as accountHelpers from '@/helpers/dataHelpers/account';
import * as localStorageHelpers from '@/helpers/dataHelpers/localStorage';
import * as passwordHelpers from '@/helpers/dataHelpers/password';
import { AccountRecord, WalletRecord } from '@/types';

// Mock dependencies
vi.mock('@/helpers/dataHelpers/localStorage', () => ({
  getLocalStorageItem: vi.fn(),
  setLocalStorageItem: vi.fn(),
}));

vi.mock('@/helpers/dataHelpers/password', () => ({
  getPasswordRecords: vi.fn(),
  hashPassword: vi.fn(),
  savePasswordHash: vi.fn().mockReturnValue('mocked-hash'),
  updatePassword: vi.fn(),
}));

vi.mock('@/helpers/dataHelpers/wallet', () => ({
  createWallet: vi.fn().mockResolvedValue({
    wallet: { mnemonic: 'test mnemonic' },
    walletRecord: { id: 'wallet1', encryptedMnemonic: 'abc' },
  }),
}));

vi.mock('@/helpers/dataHelpers/session', () => ({
  saveSessionData: vi.fn().mockResolvedValue(true),
}));

vi.mock('@/helpers/dataHelpers/crypto', () => ({
  encryptMnemonic: vi.fn().mockReturnValue('re-encrypted'),
  decryptMnemonic: vi.fn().mockReturnValue('decrypted'),
}));

vi.mock('@/helpers/uuid', () => ({
  generateUUID: vi.fn().mockReturnValue('mocked-uuid'),
}));

describe('account helpers', () => {
  const mockAccounts: AccountRecord[] = [
    {
      id: 'acc1',
      wallets: [{ id: 'wallet1', encryptedMnemonic: 'abc' }] as WalletRecord[],
      settings: {
        defaultNetworkID: '',
        defaultCoinDenom: '',
        subscribedTo: {},
        activeWalletID: 'wallet1',
      },
    },
  ];

  beforeEach(() => {
    vi.clearAllMocks();
    (localStorageHelpers.getLocalStorageItem as any).mockReturnValue(JSON.stringify(mockAccounts));
  });

  it('gets accounts from localStorage', () => {
    const accounts = accountHelpers.getAccounts();
    expect(accounts).toEqual(mockAccounts);
  });

  it('gets account by ID', () => {
    const account = accountHelpers.getAccountByID('acc1');
    expect(account?.id).toBe('acc1');
  });

  it('returns null for non-existing account ID', () => {
    const account = accountHelpers.getAccountByID('nonexistent');
    expect(account).toBeNull();
  });

  it('saves updated account by ID', () => {
    const result = accountHelpers.saveAccountByID({ ...mockAccounts[0], id: 'acc1' });
    expect(result).toBe(true);
    expect(localStorageHelpers.setLocalStorageItem).toHaveBeenCalled();
  });

  it('fails to save non-existing account', () => {
    const result = accountHelpers.saveAccountByID({ ...mockAccounts[0], id: 'notfound' });
    expect(result).toBe(false);
  });

  it('removes an account by ID', () => {
    const result = accountHelpers.removeAccountByID('acc1');
    expect(result).toBe(true);
    expect(localStorageHelpers.setLocalStorageItem).toHaveBeenCalled();
  });

  it('does not remove account if not found', () => {
    const result = accountHelpers.removeAccountByID('missing');
    expect(result).toBe(false);
  });

  it('gets account ID by password match', () => {
    (passwordHelpers.getPasswordRecords as any).mockReturnValue([
      { id: 'acc1', hash: 'h', salt: 's' },
    ]);
    (passwordHelpers.hashPassword as any).mockReturnValue('h');

    const result = accountHelpers.getAccountIDByPassword('password');
    expect(result).toBe('acc1');
  });

  it('adds a wallet to an account', async () => {
    const result = await accountHelpers.addWalletToAccount('acc1', {
      id: 'wallet2',
      encryptedMnemonic: 'xyz',
    } as WalletRecord);

    expect(result).toBe(true);
  });

  it('prevents adding duplicate wallet to account', async () => {
    const result = await accountHelpers.addWalletToAccount('acc1', {
      id: 'wallet1',
      encryptedMnemonic: 'abc',
    } as WalletRecord);

    expect(result).toBe(false);
  });

  it('removes a wallet from an account', () => {
    const modifiedAccount = {
      ...mockAccounts[0],
      wallets: [
        { id: 'wallet1', encryptedMnemonic: 'abc' },
        { id: 'wallet2', encryptedMnemonic: 'def' },
      ],
      settings: { ...mockAccounts[0].settings, activeWalletID: 'wallet1' },
    };

    (localStorageHelpers.getLocalStorageItem as any).mockReturnValue(
      JSON.stringify([modifiedAccount]),
    );

    const result = accountHelpers.removeWalletFromAccount('acc1', 'wallet1');
    expect(result).toBe(true);
  });

  it('updates wallet data', () => {
    const result = accountHelpers.updateWallet('acc1', 'wallet1', {
      encryptedMnemonic: 'newValue',
    });
    expect(result).toBe(true);
  });

  it('updates account password', () => {
    (passwordHelpers.updatePassword as any).mockReturnValue('newhash');
    const result = accountHelpers.updateAccountPassword({
      accountID: 'acc1',
      oldPassword: 'old',
      newPassword: 'new',
    });
    expect(result).toBe(true);
  });

  it('fails to update account password with wrong old password', () => {
    (passwordHelpers.updatePassword as any).mockReturnValue(null);
    const result = accountHelpers.updateAccountPassword({
      accountID: 'acc1',
      oldPassword: 'wrong',
      newPassword: 'new',
    });
    expect(result).toBe(false);
  });

  it('creates a new account', async () => {
    const result = await accountHelpers.createAccount(
      'mnemonic',
      'password',
      'MyWallet',
      {
        net1: { coinDenoms: ['denom1'] },
      },
      true,
    );

    expect(result.id).toBe('mocked-uuid');
    expect(result.wallets[0].id).toBe('wallet1');
    expect(result.settings.subscribedTo.net1.coinDenoms[0]).toBe('denom1');
  });
});
