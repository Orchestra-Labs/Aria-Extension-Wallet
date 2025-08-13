import { Atom, atom } from 'jotai';
import { Asset, Wallet } from '@/types';
import { subscribedChainRegistryAtom } from './chainRegistryAtom';
import { networkLevelAtom } from './networkLevelAtom';

// Session-only state (cleared on logout)
export const sessionWalletAtom = atom<{
  name: string;
  encryptedMnemonic: string;
  chainWallets: Record<string, Wallet>;
}>({ name: '', encryptedMnemonic: '', chainWallets: {} });

// Per-chain wallet accessor
const chainWalletCache = new Map<string, Atom<Wallet>>();

export const chainWalletAtom = (chainId: string) => {
  if (!chainWalletCache.has(chainId)) {
    chainWalletCache.set(
      chainId,
      atom(get => get(sessionWalletAtom).chainWallets[chainId] || { address: '', assets: [] }),
    );
  }
  return chainWalletCache.get(chainId)!;
};

// Secure updater for chain wallet data
export const updateChainWalletAtom = atom(
  null,
  (get, set, update: { chainId: string; address?: string; assets?: Asset[] }) => {
    const current = get(sessionWalletAtom);
    const existingWallet = current.chainWallets[update.chainId] || { address: '', assets: [] };

    console.log(`[walletAtom] Updating chain ${update.chainId}`, {
      oldAddress: existingWallet.address,
      newAddress: update.address,
      assetsCount: update.assets?.length,
      assets: update.assets,
    });

    set(sessionWalletAtom, {
      ...current,
      chainWallets: {
        ...current.chainWallets,
        [update.chainId]: {
          address: update.address !== undefined ? update.address : existingWallet.address,
          assets: update.assets !== undefined ? update.assets : existingWallet.assets,
        },
      },
    });
  },
);

export const walletAddressesAtom = atom(get => {
  const wallets = get(sessionWalletAtom).chainWallets;
  return Object.fromEntries(
    Object.entries(wallets).map(([chainId, wallet]) => [chainId, wallet.address]),
  );
});

// Flatten all wallet assets across chains
export const allWalletAssetsAtom = atom(get => {
  const { chainWallets } = get(sessionWalletAtom);
  return Object.values(chainWallets)
    .flatMap(wallet => wallet.assets)
    .map(asset => Object.freeze({ ...asset }));
});

export const hasNonZeroAssetsAtom = atom(get => {
  const allAssets = get(allWalletAssetsAtom);
  const networkLevel = get(networkLevelAtom);
  const chainRegistry = get(subscribedChainRegistryAtom);
  const validChainIDs = Object.keys(chainRegistry[networkLevel] || {});

  return allAssets.some(asset => {
    if (!validChainIDs.includes(asset.networkID)) return false;
    const amountStr = asset.amount?.trim() || '0';
    const amount = Number(amountStr);
    return !isNaN(amount) && amount > 0;
  });
});
