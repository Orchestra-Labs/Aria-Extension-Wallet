import { beforeAll, describe, expect, it, vi } from 'vitest';

import { queryRpcNode } from '@/helpers/queryNodes';
import * as stakingHelpers from '@/helpers/stakingTransactions';

// Mock queryRpcNode to avoid real RPC calls in tests
vi.mock('@/helpers/queryNodes', () => ({
  queryRpcNode: vi.fn(),
}));

// Mock constants with needed properties
vi.mock('@/constants', async () => {
  const actual: any = await vi.importActual('@/constants');
  return {
    ...actual,
    LOCAL_ASSET_REGISTRY: {
      uatom: { exponent: 6 },
      // Add other denoms your tests will use here
    },
    GREATER_EXPONENT_DEFAULT: 6,
    DEFAULT_ASSET: { denom: 'uatom' },
    CHAIN_ENDPOINTS: actual.CHAIN_ENDPOINTS || {
      claimRewards: 'claim_rewards_endpoint',
      delegateToValidator: 'delegate_endpoint',
      undelegateFromValidator: 'undelegate_endpoint',
    },
  };
});

beforeAll(() => {
  // You can also set up any other global mocks or spies here if needed
});

describe('stakingTransactions helpers', () => {
  it('stakeToValidator handles exponent correctly', async () => {
    (queryRpcNode as any).mockResolvedValue({ code: 0, message: 'success' });

    const result = await stakingHelpers.stakeToValidator(
      '1.23',
      'uatom',
      'walletAddress',
      'validatorAddress',
      false,
    );

    expect(result.success).toBe(true);
    expect(result.message).toBe('Transaction successful');
  });

  // Add other tests...
});
