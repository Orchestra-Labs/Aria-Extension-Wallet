import { DEFAULT_MAINNET_ASSET, DEFAULT_TESTNET_ASSET } from '@/constants';
import { Asset } from '@/types';
import { atom, WritableAtom } from 'jotai';
import { userAccountAtom } from './accountAtom';
import { networkLevelAtom } from './networkLevelAtom';
import { allWalletAssetsAtom } from './walletAtom';
import { subscribedChainRegistryAtom } from './chainRegistryAtom';

export const showAllAssetsAtom = atom<boolean>(true);

// Helper type for writable atoms
type WriteableAtom<T> = WritableAtom<T, [T], void>;

// Private atoms to store independent values
const _selectedAssetAtom = atom<Asset | null>(null);
const _dialogSelectedAssetAtom = atom<Asset | null>(null);

export const selectedAssetAtom: WriteableAtom<Asset> = atom(
  get => {
    const defaultAsset = get(defaultAssetAtom);
    const independentValue = get(_selectedAssetAtom);
    // Use independent value if it exists, otherwise fall back to default
    return independentValue ? independentValue : defaultAsset;
  },
  (_, set, newAsset: Asset) => {
    // Directly update our own atom's storage
    set(_selectedAssetAtom, newAsset);
  },
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
  const walletAssets = get(allWalletAssetsAtom);
  const chainRegistry = get(subscribedChainRegistryAtom);

  // If user has a default coin denom
  if (userAccount?.settings.defaultCoinDenom) {
    // First try to find in wallet assets
    const walletAsset = walletAssets.find(
      asset => asset.denom === userAccount.settings.defaultCoinDenom,
    );

    if (walletAsset) {
      // Try to get full asset details from chain registry
      const chain = chainRegistry[networkLevel][walletAsset.networkID];
      if (chain?.assets) {
        const fullAsset = Object.values(chain.assets).find(a => a.denom === walletAsset.denom);
        if (fullAsset) {
          return {
            ...fullAsset,
            amount: walletAsset.amount,
            networkID: walletAsset.networkID,
            networkName: walletAsset.networkName,
          };
        }
      }
      return walletAsset;
    }

    // If not found in wallet, try to find in chain registry
    if (userAccount.settings.defaultChainID) {
      const chain = chainRegistry[networkLevel][userAccount.settings.defaultChainID];
      if (chain?.assets) {
        const registryAsset = Object.values(chain.assets).find(
          a => a.denom === userAccount.settings.defaultCoinDenom,
        );
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
