import { DEFAULT_MAINNET_ASSET, DEFAULT_TESTNET_ASSET } from '@/constants';
import { Asset } from '@/types';
import { atom, WritableAtom } from 'jotai';
import { userAccountAtom } from './accountAtom';
import { networkLevelAtom } from './networkLevelAtom';
import { fullChainRegistryAtom, subscribedChainRegistryAtom } from './chainRegistryAtom';

export const showAllAssetsAtom = atom<boolean>(true);

// Helper type for writable atoms
type WriteableAtom<T> = WritableAtom<T, [T], void>;

// Private atoms to store independent values
const _selectedAssetAtom = atom<Asset | null>(null);
const _dialogSelectedAssetAtom = atom<Asset | null>(null);

export const selectedAssetAtom = atom(
  get => {
    const defaultAsset = get(defaultAssetAtom);
    const independentValue = get(_selectedAssetAtom);

    // Deep compare instead of reference check
    if (independentValue && JSON.stringify(independentValue) === JSON.stringify(defaultAsset)) {
      return independentValue;
    }
    return independentValue || defaultAsset;
  },
  (_, set, newAsset) => set(_selectedAssetAtom, newAsset as Asset),
);

export const dialogSelectedAssetAtom: WriteableAtom<Asset> = atom(
  get => {
    const defaultAsset = get(defaultAssetAtom);
    const independentValue = get(_dialogSelectedAssetAtom);
    // Use independent value if it exists, otherwise fall back to default
    return independentValue ? independentValue : defaultAsset;
  },
  (_, set, newAsset: Asset) => {
    // Only update the independent value, not the default
    set(_dialogSelectedAssetAtom, newAsset);
  },
);

export const defaultAssetAtom = atom(get => {
  const userAccount = get(userAccountAtom);
  const networkLevel = get(networkLevelAtom);
  const chainRegistry = get(subscribedChainRegistryAtom);

  // If user has a default coin denom
  if (userAccount?.settings.defaultSelections[networkLevel].defaultCoinDenom) {
    const defaultCoinDenom = userAccount?.settings.defaultSelections[networkLevel].defaultCoinDenom;
    // Try to find in chain registry
    if (userAccount?.settings.defaultSelections[networkLevel].defaultChainId) {
      const defaultChainId = userAccount?.settings.defaultSelections[networkLevel].defaultChainId;
      const chain = chainRegistry[networkLevel][defaultChainId];
      if (chain?.assets) {
        const registryAsset = Object.values(chain.assets).find(a => a.denom === defaultCoinDenom);
        if (registryAsset) {
          return {
            ...registryAsset,
            amount: '0', // Default to zero if not in wallet
            networkID: chain.chain_id,
            networkName: chain.chain_name,
          };
        }
      }
    }
  }

  // Fallback to network default
  return networkLevel === 'mainnet' ? DEFAULT_MAINNET_ASSET : DEFAULT_TESTNET_ASSET;
});

// TODO: add Symphony's stablecoins
// NOTE: Pure registry assets without wallet balances (for receive context)
export const allRegistryAssetsAtom = atom(get => {
  const networkLevel = get(networkLevelAtom);
  const fullRegistry = get(fullChainRegistryAtom)[networkLevel];

  const allAssets: Asset[] = [];

  // Process all chains in the full registry
  for (const chainInfo of Object.values(fullRegistry)) {
    const chainAssets = Object.values(chainInfo.assets || {});

    for (const asset of chainAssets) {
      allAssets.push({
        ...asset,
        amount: '0', // Default to 0 since we don't need balances
        networkID: chainInfo.chain_id,
        networkName: chainInfo.chain_name,
        isIbc: false, // Default false unless we have IBC info from registry
      });
    }
  }

  return allAssets;
});
