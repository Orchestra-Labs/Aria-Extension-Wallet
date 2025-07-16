import { describe, expect, it } from 'vitest';

import * as cryptoHelper from '@/helpers/dataHelpers/crypto';
import { getLocalStorageItem, setLocalStorageItem } from '@/helpers/dataHelpers/localStorage';

vi.mock('@/helpers/dataHelpers/localStorage', () => ({
  getLocalStorageItem: vi.fn(),
  setLocalStorageItem: vi.fn(),
}));

describe('crypto helpers', () => {
  const testMnemonic = 'correct horse battery staple';
  const testPassword = 'password123';
  let encryptedMnemonic: string;

  it('storeMnemonic calls setLocalStorageItem with correct key and value', () => {
    cryptoHelper.storeMnemonic('encrypted-value');
    expect(setLocalStorageItem).toHaveBeenCalledWith('encryptedMnemonic', 'encrypted-value');
  });

  it('getStoredMnemonic calls getLocalStorageItem with correct key and returns value', () => {
    (getLocalStorageItem as jest.Mock).mockReturnValue('stored-value');
    const result = cryptoHelper.getStoredMnemonic();
    expect(getLocalStorageItem).toHaveBeenCalledWith('encryptedMnemonic');
    expect(result).toBe('stored-value');
  });

  it('encryptMnemonic encrypts mnemonic string', () => {
    encryptedMnemonic = cryptoHelper.encryptMnemonic(testMnemonic, testPassword);
    expect(typeof encryptedMnemonic).toBe('string');
    expect(encryptedMnemonic.length).toBeGreaterThan(0);
  });

  it('decryptMnemonic decrypts previously encrypted mnemonic correctly', () => {
    encryptedMnemonic = cryptoHelper.encryptMnemonic(testMnemonic, testPassword);
    const decrypted = cryptoHelper.decryptMnemonic(encryptedMnemonic, testPassword);
    expect(decrypted).toBe(testMnemonic);
  });

  it('decryptMnemonic returns invalid string when password is incorrect', () => {
    encryptedMnemonic = cryptoHelper.encryptMnemonic(testMnemonic, testPassword);
    const decrypted = cryptoHelper.decryptMnemonic(encryptedMnemonic, 'wrongpassword');
    expect(decrypted).not.toBe(testMnemonic);
  });
});
