import { beforeEach, describe, expect, it, vi } from 'vitest';

import * as walletModule from '@/helpers/walletConnect';

// Mock the external dependencies you don't want to actually invoke
vi.mock('@reown/walletkit', () => {
  return {
    WalletKit: {
      init: vi.fn().mockResolvedValue({
        engine: {
          signClient: {
            core: {
              crypto: {
                getClientId: vi.fn().mockResolvedValue('mock-client-id'),
              },
            },
          },
        },
      }),
    },
  };
});

vi.mock('@walletconnect/core', () => {
  return {
    Core: vi.fn().mockImplementation(() => ({})),
  };
});

describe('createWalletKit', () => {
  beforeEach(() => {
    // Reset singleton before each test using the new reset function
    walletModule.resetWalletKit();
  });

  it('initializes WalletKit and returns instance', async () => {
    const walletkit = await walletModule.createWalletKit();
    expect(walletkit).toBeDefined();
    expect(walletkit.engine.signClient.core.crypto.getClientId).toBeDefined();
  });

  it('returns the same instance on multiple calls', async () => {
    const instance1 = await walletModule.createWalletKit();
    const instance2 = await walletModule.createWalletKit();
    expect(instance1).toBe(instance2);
  });
});
