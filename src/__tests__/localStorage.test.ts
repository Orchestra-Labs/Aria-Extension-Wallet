import { beforeEach, describe, expect, it, vi } from 'vitest';

import {
  clearLocalStorage,
  getLocalStorageItem,
  removeLocalStorageItem,
  setLocalStorageItem,
} from '@/helpers/dataHelpers/localStorage';

beforeEach(() => {
  localStorage.clear();
  vi.restoreAllMocks();
});

describe('localStorage helpers', () => {
  it('sets and gets a value', () => {
    setLocalStorageItem('key', 'value');
    expect(getLocalStorageItem('key')).toBe('value');
  });

  it('returns null for missing key', () => {
    expect(getLocalStorageItem('missing')).toBeNull();
  });

  it('removes a key', () => {
    setLocalStorageItem('key', 'value');
    removeLocalStorageItem('key');
    expect(getLocalStorageItem('key')).toBeNull();
  });

  it('clears all keys', () => {
    setLocalStorageItem('one', '1');
    setLocalStorageItem('two', '2');
    clearLocalStorage();
    expect(getLocalStorageItem('one')).toBeNull();
    expect(getLocalStorageItem('two')).toBeNull();
  });
});
