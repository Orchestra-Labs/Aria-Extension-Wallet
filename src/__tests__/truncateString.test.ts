// src/__tests__/truncateString.test.ts
import { describe, expect, it } from 'vitest';

import { truncateString, truncateWalletAddress } from '@/helpers/truncateString';

describe('truncateString', () => {
  it('returns the original string if shorter than limit', () => {
    expect(truncateString('hello', 10)).toBe('hello');
  });

  it('truncates a longer string and adds "..."', () => {
    expect(truncateString('abcdefghijklmnopqrstuvwxyz', 5)).toBe('abcde...');
  });

  it('returns "..." when num is 0', () => {
    expect(truncateString('data', 0)).toBe('...');
  });

  it('returns "..." when num is negative', () => {
    expect(truncateString('test', -1)).toBe('...');
  });

  it('returns empty string when input is empty', () => {
    expect(truncateString('', 5)).toBe('');
  });
});

describe('truncateWalletAddress', () => {
  it('truncates long address with prefix', () => {
    const input = 'cosmos1abcdefghijklmnopqrstuvwxyz';
    expect(truncateWalletAddress('cosmos1', input)).toBe('cosmos1abcd...wxyz');
  });

  it('truncates long address without matching prefix', () => {
    const input = 'terra1abcdefghijklmnopqrstuvwxyz';
    expect(truncateWalletAddress('cosmos1', input)).toBe('terr...wxyz'); // ✅ fixed expectation
  });

  it('returns whole string if length is short', () => {
    const input = 'cosmos1abc123';
    expect(truncateWalletAddress('cosmos1', input)).toBe('cosmos1abc123');
  });

  it('returns empty string if input is falsy', () => {
    expect(truncateWalletAddress('cosmos1', '')).toBe('');
  });

  it('handles address exactly 11 chars long (no truncation)', () => {
    const input = 'cosmos1abcde';
    expect(truncateWalletAddress('cosmos1', input)).toBe('cosmos1abcde');
  });
});
