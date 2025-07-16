import { beforeEach, describe, expect, it, vi } from 'vitest';

import {
  getPasswordIndexByID,
  getPasswordRecords,
  hashPassword,
  removePassword,
  savePasswordHash,
  updatePassword,
} from '@/helpers/dataHelpers/password';

vi.mock('crypto-js', async () => {
  const actual = await vi.importActual<any>('crypto-js');
  return {
    ...actual,
    lib: {
      WordArray: {
        random: () => ({ toString: () => 'fixedsalt' }),
      },
    },
    SHA512: actual.SHA512, // ✅ Add this line to include SHA512
  };
});

beforeEach(() => {
  localStorage.clear();
});

describe('password helpers', () => {
  const testID = 'user1';
  const testPassword = 'secure123';
  const newPassword = 'newSecure456';

  it('initially returns empty records', () => {
    expect(getPasswordRecords()).toEqual([]);
  });

  it('saves a password hash and returns it', () => {
    const hash = savePasswordHash(testID, testPassword);
    expect(typeof hash).toBe('string');
    expect(getPasswordRecords().length).toBe(1);
  });

  it('prevents duplicate password hashes from being stored', () => {
    const first = savePasswordHash(testID, testPassword);
    const second = savePasswordHash(testID, testPassword);
    expect(first).toBe(second);
    expect(getPasswordRecords().length).toBe(1);
  });

  it('returns index of stored password by ID', () => {
    savePasswordHash(testID, testPassword);
    const index = getPasswordIndexByID(testID);
    expect(index).toBe(0);
  });

  it('updates a password hash successfully with correct old password', () => {
    savePasswordHash(testID, testPassword);
    const updatedHash = updatePassword(testID, testPassword, newPassword);
    expect(typeof updatedHash).toBe('string');
    expect(updatedHash).not.toBeNull();
    expect(getPasswordRecords()[0].hash).toBe(updatedHash);
  });

  it('fails to update password if old password is incorrect', () => {
    savePasswordHash(testID, testPassword);
    const result = updatePassword(testID, 'wrongPassword', newPassword);
    expect(result).toBeNull();
  });

  it('removes a password successfully', () => {
    savePasswordHash(testID, testPassword);
    const result = removePassword(testID);
    expect(result).toBe(true);
    expect(getPasswordRecords()).toHaveLength(0);
  });

  it('returns false if password to remove doesn’t exist', () => {
    const result = removePassword('nonexistent');
    expect(result).toBe(false);
  });

  it('hashPassword produces consistent output', () => {
    const hash1 = hashPassword('abc', 'salt');
    const hash2 = hashPassword('abc', 'salt');
    expect(hash1).toBe(hash2);
  });
});
