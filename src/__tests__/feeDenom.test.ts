import { describe, expect, it, vi } from 'vitest';

import { getValidFeeDenom } from '@/helpers/feeDenom';
import { Asset } from '@/types';

// 🔧 Mock the registry
vi.mock('@/constants', () => ({
  LOCAL_ASSET_REGISTRY: {
    note: {
      denom: 'unote',
    },
  },
}));

describe('getValidFeeDenom', () => {
  const mockAssets: Asset[] = [{ denom: 'usdc' } as Asset, { denom: 'dai' } as Asset];

  it('returns sendDenom if it matches LOCAL_ASSET_REGISTRY.note.denom', () => {
    const result = getValidFeeDenom('unote', mockAssets);
    expect(result).toBe('unote');
  });

  it('returns sendDenom if it is found in exchangeAssets', () => {
    const result = getValidFeeDenom('usdc', mockAssets);
    expect(result).toBe('usdc');
  });

  it('returns default (unote) if sendDenom is not in registry or exchangeAssets', () => {
    const result = getValidFeeDenom('invalidToken', mockAssets);
    expect(result).toBe('unote');
  });

  it('returns default (unote) if sendDenom is undefined', () => {
    const result = getValidFeeDenom(undefined, mockAssets);
    expect(result).toBe('unote');
  });

  it('returns default (unote) if exchangeAssets is empty', () => {
    const result = getValidFeeDenom('usdc', []);
    expect(result).toBe('unote');
  });
});
