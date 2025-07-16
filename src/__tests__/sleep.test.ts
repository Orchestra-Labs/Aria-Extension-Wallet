import { describe, expect, it } from 'vitest';

import { sleep } from '@/helpers/sleep';

describe('sleep', () => {
  it('resolves after specified time', async () => {
    const start = Date.now();
    await sleep(50);
    const duration = Date.now() - start;
    expect(duration).toBeGreaterThanOrEqual(45); // allow slight timing variance
  });

  it('does not throw', async () => {
    await expect(sleep(10)).resolves.not.toThrow();
  });

  it('handles zero ms', async () => {
    const start = Date.now();
    await sleep(0);
    const duration = Date.now() - start;
    expect(duration).toBeLessThan(20);
  });

  it('handles negative ms (still resolves)', async () => {
    await expect(sleep(-100)).resolves.not.toThrow();
  });
});
