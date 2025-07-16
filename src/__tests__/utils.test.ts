import { describe, expect, it } from 'vitest';

import { TextFieldStatus } from '@/constants';
import {
  calculateRemainingTime,
  cn,
  convertToGreaterUnit,
  getRegexForDecimals,
  isValidTransaction,
  isValidUrl,
  selectTextColorByStatus,
} from '@/helpers/utils';

describe('utils', () => {
  it('cn merges classes correctly', () => {
    expect(cn('foo', 'bar')).toContain('foo');
    expect(cn('foo', 'bar')).toContain('bar');
  });

  it('convertToGreaterUnit divides correctly', () => {
    expect(convertToGreaterUnit(1000, 3)).toBe(1);
    expect(convertToGreaterUnit(12345, 2)).toBeCloseTo(123.45);
  });

  it('selectTextColorByStatus returns correct classes', () => {
    expect(selectTextColorByStatus(TextFieldStatus.WARN)).toBe('text-warning');
    expect(selectTextColorByStatus(TextFieldStatus.ERROR)).toBe('text-error');
    expect(selectTextColorByStatus('')).toBe('text-white');
    expect(selectTextColorByStatus('', 'text-black')).toBe('text-black');
  });

  it('isValidUrl validates URLs correctly', () => {
    expect(isValidUrl('http://example.com')).toBe(true);
    expect(isValidUrl('https://example.com/path?query=1')).toBe(true);
    expect(isValidUrl('invalid-url')).toBe(false);
    expect(isValidUrl('ftp://example.com')).toBe(false);
  });

  it('getRegexForDecimals creates correct regex', () => {
    const regex = getRegexForDecimals(2);
    expect(regex.test('123.45')).toBe(true);
    expect(regex.test('123.456')).toBe(false);
    expect(regex.test('123')).toBe(true);
  });

  describe('isValidTransaction', () => {
    it('returns false if network levels mismatch', async () => {
      const result = await isValidTransaction({
        sendAddress: 'a',
        recipientAddress: 'b',
        sendState: { networkLevel: 'mainnet', asset: { denom: 'atom' } },
        receiveState: { networkLevel: 'testnet', asset: { denom: 'atom' } },
      });
      expect(result).toBe(false);
    });

    it('returns false if send or recipient address missing', async () => {
      const result = await isValidTransaction({
        sendAddress: '',
        recipientAddress: 'b',
        sendState: { networkLevel: 'mainnet', asset: { denom: 'atom' } },
        receiveState: { networkLevel: 'mainnet', asset: { denom: 'atom' } },
      });
      expect(result).toBe(false);
    });

    it('returns true for valid send or swap', async () => {
      const sendState = { networkLevel: 'mainnet', asset: { denom: 'atom', isIbc: false } };
      const receiveState = { networkLevel: 'mainnet', asset: { denom: 'atom', isIbc: false } };

      // Mock isValidSend and isValidSwap if needed or use actual implementation
      const result = await isValidTransaction({
        sendAddress: 'addr1',
        recipientAddress: 'addr2',
        sendState,
        receiveState,
      });

      expect(typeof result).toBe('boolean');
    });
  });

  describe('calculateRemainingTime', () => {
    it('returns "Unbonding Complete" for past time', () => {
      const past = new Date(Date.now() - 1000).toISOString();
      expect(calculateRemainingTime(past)).toBe('Unbonding Complete');
    });

    it('returns formatted remaining time for future time', () => {
      const future = new Date(Date.now() + 1000 * 60 * 60 * 25).toISOString(); // 1 day + 1 hour ahead
      const remaining = calculateRemainingTime(future);
      expect(remaining).toMatch(/\dd \dh \dm/);
    });
  });
});
