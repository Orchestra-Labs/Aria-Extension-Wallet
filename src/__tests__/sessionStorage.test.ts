import { beforeEach, describe, expect, it } from 'vitest';

import {
  clearSessionStorage,
  getSessionStorageItem,
  removeSessionStorageItem,
  setSessionStorageItem,
} from '@/helpers/dataHelpers/sessionStorage';

describe('sessionStorage helpers', () => {
  beforeEach(() => {
    sessionStorage.clear();
  });

  it('sets and gets an item', () => {
    setSessionStorageItem('foo', 'bar');
    expect(getSessionStorageItem('foo')).toBe('bar');
  });

  it('returns null for non-existing key', () => {
    expect(getSessionStorageItem('missing')).toBeNull();
  });

  it('removes an item', () => {
    setSessionStorageItem('key', 'value');
    removeSessionStorageItem('key');
    expect(getSessionStorageItem('key')).toBeNull();
  });

  it('clears all items', () => {
    setSessionStorageItem('a', '1');
    setSessionStorageItem('b', '2');
    clearSessionStorage();
    expect(sessionStorage.length).toBe(0);
  });
});
