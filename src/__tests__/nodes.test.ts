import { beforeEach, describe, expect, it, vi } from 'vitest';

import {
  getNodeErrorCounts,
  resetNodeErrorCounts,
  storeNodeErrorCounts,
} from '@/helpers/dataHelpers/nodes';

const ERROR_COUNTS_KEY = 'nodeErrorCounts';

describe('node error counts helpers', () => {
  beforeEach(() => {
    localStorage.clear();
    vi.restoreAllMocks();
  });

  it('getNodeErrorCounts returns empty object if no data stored', () => {
    const result = getNodeErrorCounts();
    expect(result).toEqual({});
  });

  it('getNodeErrorCounts returns parsed data if data exists in localStorage', () => {
    const mockData = { node1: 3, node2: 5 };
    localStorage.setItem(ERROR_COUNTS_KEY, JSON.stringify(mockData));
    const result = getNodeErrorCounts();
    expect(result).toEqual(mockData);
  });

  it('storeNodeErrorCounts stores stringified data in localStorage', () => {
    const spy = vi.spyOn(Storage.prototype, 'setItem');
    const data = { node1: 2, node3: 4 };
    storeNodeErrorCounts(data);
    expect(spy).toHaveBeenCalledWith(ERROR_COUNTS_KEY, JSON.stringify(data));
  });

  it('resetNodeErrorCounts removes the error counts key from localStorage', () => {
    const spy = vi.spyOn(Storage.prototype, 'removeItem');
    resetNodeErrorCounts();
    expect(spy).toHaveBeenCalledWith(ERROR_COUNTS_KEY);
  });
});
