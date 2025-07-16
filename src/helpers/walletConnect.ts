import { IWalletKit, WalletKit } from '@reown/walletkit';
import { Core } from '@walletconnect/core';

export let walletkit: IWalletKit | undefined;

export async function createWalletKit() {
  if (walletkit) return walletkit;

  const core = new Core({
    projectId: import.meta.env.VITE_WALLETCONNECT_PROJECT_ID,
  });

  walletkit = await WalletKit.init({
    core,
    metadata: {
      name: 'Aria Wallet',
      description: 'Symphony chain Wallet',
      url: 'chrome-extension://jmcdoggondondkjlmbbommdgcncgaclp',
      icons: ['https://orchestralabs.org/favicon.ico'],
    },
    signConfig: {
      disableRequestQueue: true,
    },
  });

  const clientId = await walletkit.engine.signClient.core.crypto.getClientId();
  console.log(`WalletKit initialized with Client ID: ${clientId}`);

  return walletkit;
}

// --- Add this reset function ONLY for tests ---
export function resetWalletKit() {
  walletkit = undefined;
}
