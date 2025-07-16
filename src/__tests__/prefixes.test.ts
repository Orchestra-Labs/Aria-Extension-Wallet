import { beforeEach, describe, expect, it, vi } from 'vitest';

import { STORED_DATA_TIMEOUT } from '@/constants';
import * as localStorageHelpers from '@/helpers/dataHelpers/localStorage';
import * as prefixHelpers from '@/helpers/dataHelpers/prefixes';

const PREFIXES_STORAGE_KEY = 'bech32Prefixes';

describe('prefixes helpers', () => {
  beforeEach(() => {
    vi.restoreAllMocks();
  });

  it('getPrefixes returns parsed data if present in localStorage', () => {
    const mockData = { lastUpdated: new Date().toISOString(), data: [{ chain: 'chain1' }] };
    vi.spyOn(localStorageHelpers, 'getLocalStorageItem').mockReturnValue(JSON.stringify(mockData));

    const result = prefixHelpers.getPrefixes();
    expect(result).toEqual(mockData);
  });

  it('getPrefixes returns null if no data in localStorage', () => {
    vi.spyOn(localStorageHelpers, 'getLocalStorageItem').mockReturnValue(null);

    const result = prefixHelpers.getPrefixes();
    expect(result).toBeNull();
  });

  it('getPrefixes returns null if stored data is invalid JSON', () => {
    vi.spyOn(localStorageHelpers, 'getLocalStorageItem').mockReturnValue('invalid json');
    const consoleErrorSpy = vi.spyOn(console, 'error').mockImplementation(() => {});

    const result = prefixHelpers.getPrefixes();
    expect(result).toBeNull();
    expect(consoleErrorSpy).toHaveBeenCalled();

    consoleErrorSpy.mockRestore();
  });

  it('savePrefixes stores stringified data in localStorage', () => {
    const setSpy = vi
      .spyOn(localStorageHelpers, 'setLocalStorageItem')
      .mockImplementation(() => {});
    const data = [{ chain: 'chain1' }, { chain: 'chain2' }];

    prefixHelpers.savePrefixes(data);

    expect(setSpy).toHaveBeenCalledWith(PREFIXES_STORAGE_KEY, expect.stringContaining('"data"'));
  });

  it('prefixesNeedRefresh returns true if prefixStorage is null', () => {
    expect(prefixHelpers.prefixesNeedRefresh(null)).toBe(true);
  });

  it('prefixesNeedRefresh returns false if lastUpdated is recent', () => {
    const recentDate = new Date(Date.now() - STORED_DATA_TIMEOUT / 2).toISOString();
    const prefixStorage = { lastUpdated: recentDate, data: [] };

    expect(prefixHelpers.prefixesNeedRefresh(prefixStorage)).toBe(false);
  });

  it('prefixesNeedRefresh returns true if lastUpdated is outdated', () => {
    const oldDate = new Date(Date.now() - STORED_DATA_TIMEOUT * 2).toISOString();
    const prefixStorage = { lastUpdated: oldDate, data: [] };

    expect(prefixHelpers.prefixesNeedRefresh(prefixStorage)).toBe(true);
  });
});
