import { Secp256k1HdWallet } from '@cosmjs/amino';
import { beforeEach, describe, expect, it, vi } from 'vitest';

import { TOKEN_EXPIRATION_TIME } from '@/constants';
import { removeLocalStorageItem, setLocalStorageItem } from '@/helpers/dataHelpers/localStorage';
import {
  getSessionToken,
  isTokenValid,
  removeSessionData,
  saveSessionData,
  userIsLoggedIn,
} from '@/helpers/dataHelpers/session';

vi.mock('@/helpers/dataHelpers/localStorage', () => ({
  setLocalStorageItem: vi.fn(),
  removeLocalStorageItem: vi.fn(),
  getLocalStorageItem: vi.fn(),
}));

const MOCK_SESSION_KEY = 'sessionToken';

const mockToken = {
  mnemonic: 'test mnemonic',
  accountID: 'account123',
  rememberMe: true,
  timestamp: new Date().toISOString(),
};

beforeEach(() => {
  localStorage.clear();
  vi.restoreAllMocks();
});

describe('session helpers', () => {
  it('userIsLoggedIn returns false if no token', () => {
    localStorage.removeItem(MOCK_SESSION_KEY);
    expect(userIsLoggedIn()).toBe(false);
  });

  it('userIsLoggedIn returns true if token exists', () => {
    localStorage.setItem(MOCK_SESSION_KEY, JSON.stringify(mockToken));
    expect(userIsLoggedIn()).toBe(true);
  });

  it('getSessionToken returns parsed token if valid', () => {
    localStorage.setItem(MOCK_SESSION_KEY, JSON.stringify(mockToken));
    const token = getSessionToken();
    expect(token?.accountID).toBe('account123');
  });

  it('getSessionToken returns null if malformed JSON', () => {
    localStorage.setItem(MOCK_SESSION_KEY, 'bad json');
    const token = getSessionToken();
    expect(token).toBeNull();
  });

  it('removeSessionData removes session from localStorage', () => {
    removeSessionData();
    expect(removeLocalStorageItem).toHaveBeenCalledWith(MOCK_SESSION_KEY);
  });

  it('isTokenValid returns true for non-expired token', () => {
    localStorage.setItem(MOCK_SESSION_KEY, JSON.stringify(mockToken));
    expect(isTokenValid()).toBe(true);
  });

  it('isTokenValid returns false for expired token', () => {
    const oldTimestamp = new Date(Date.now() - TOKEN_EXPIRATION_TIME - 1000).toISOString();
    const expiredToken = { ...mockToken, timestamp: oldTimestamp };
    localStorage.setItem(MOCK_SESSION_KEY, JSON.stringify(expiredToken));
    expect(isTokenValid()).toBe(false);
  });

  it('saveSessionData saves and returns token', async () => {
    const mockWallet = {
      mnemonic: 'mock mnemonic',
    } as Secp256k1HdWallet;

    const token = await saveSessionData(mockWallet, 'acc-456', true);

    expect(token.accountID).toBe('acc-456');
    expect(setLocalStorageItem).toHaveBeenCalledWith(
      MOCK_SESSION_KEY,
      expect.stringContaining('mock mnemonic'),
    );
  });
});
