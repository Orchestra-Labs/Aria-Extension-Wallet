import {
  formatNumberWithCommas,
  removeTrailingZeroes,
  stripNonAlphanumerics,
  stripNonNumerics,
} from '../helpers/formatString';

describe('Formatting helpers', () => {
  describe('removeTrailingZeroes', () => {
    it('removes trailing zeroes from numbers represented as strings', () => {
      expect(removeTrailingZeroes('123.45000')).toBe('123.45');
      expect(removeTrailingZeroes('100.000')).toBe('100');
      expect(removeTrailingZeroes('0.00')).toBe('0');
      expect(removeTrailingZeroes(123.45)).toBe('123.45');
    });
  });

  describe('stripNonAlphanumerics', () => {
    it('removes all non-alphanumeric characters', () => {
      expect(stripNonAlphanumerics('abc123!@#')).toBe('abc123');
      expect(stripNonAlphanumerics('Hello, World!')).toBe('HelloWorld');
      expect(stripNonAlphanumerics('')).toBe('');
    });
  });

  describe('stripNonNumerics', () => {
    it('removes all characters except digits and decimal points', () => {
      expect(stripNonNumerics('123.45abc')).toBe('123.45');
      expect(stripNonNumerics('abc')).toBe('');
      expect(stripNonNumerics('100%')).toBe('100');
    });
  });

  describe('formatNumberWithCommas', () => {
    it('formats numbers with commas', () => {
      expect(formatNumberWithCommas('1000')).toBe('1,000');
      expect(formatNumberWithCommas('1234567.89')).toBe('1,234,567.89');
      expect(formatNumberWithCommas(1234567)).toBe('1,234,567');
    });
  });
});
