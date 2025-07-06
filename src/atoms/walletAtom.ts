import { atom } from 'jotai';
import { Asset, Wallet } from '@/types';

// Session-only state (cleared on logout)
export const sessionWalletAtom = atom<{
  name: string;
  encryptedMnemonic: string;
  chainWallets: Record<string, Wallet>;
}>({ name: '', encryptedMnemonic: '', chainWallets: {} });

// Per-chain wallet accessor
export const chainWalletAtom = (chainId: string) =>
  atom(get => get(sessionWalletAtom).chainWallets[chainId] || { address: '', assets: [] });

// Secure updater for chain wallet data
export const updateChainWalletAtom = atom(
  null,
  (get, set, update: { chainId: string; address?: string; assets?: Asset[] }) => {
    const current = get(sessionWalletAtom);
    const existingWallet = current.chainWallets[update.chainId] || { address: '', assets: [] };

    const updatedWallet = {
      address: update.address ?? existingWallet.address,
      assets: update.assets ?? existingWallet.assets,
    };

    set(sessionWalletAtom, {
      ...current,
      chainWallets: {
        ...current.chainWallets,
        [update.chainId]: updatedWallet,
      },
    });

    console.log(`[walletAtom] Updated chain ${update.chainId}`, updatedWallet);
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
  return Object.values(chainWallets).flatMap(wallet => wallet.assets);
});
