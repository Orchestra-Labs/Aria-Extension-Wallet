import { describe, expect, it } from 'vitest';

import { generateUUID, isValidUUID } from '@/helpers/uuid';

describe('generateUUID', () => {
  it('returns a valid UUIDv4', () => {
    const id = generateUUID();
    expect(isValidUUID(id)).toBe(true);
  });

  it('returns a string of correct length', () => {
    const id = generateUUID();
    expect(id.length).toBe(36);
  });

  it('generates unique values each time', () => {
    const id1 = generateUUID();
    const id2 = generateUUID();
    expect(id1).not.toBe(id2);
  });
});

describe('isValidUUID', () => {
  it('returns true for valid UUIDv4', () => {
    const validUUID = '123e4567-e89b-42d3-a456-426614174000'; // ✅ v4 UUID
    expect(isValidUUID(validUUID)).toBe(true);
  });

  it('returns false for invalid UUID format', () => {
    const invalidUUID = 'abc123';
    expect(isValidUUID(invalidUUID)).toBe(false);
  });

  it('returns false for empty string', () => {
    expect(isValidUUID('')).toBe(false);
  });

  it('is case insensitive', () => {
    const uuidUpper = '123E4567-E89B-42D3-A456-426614174000'; // ✅ uppercase
    expect(isValidUUID(uuidUpper)).toBe(true);
  });
});
