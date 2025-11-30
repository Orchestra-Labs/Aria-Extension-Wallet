import { DEFAULT_MAINNET_ASSET, DEFAULT_TESTNET_ASSET } from '@/constants';
import { Asset, AssetRegistry } from '@/types';
import { atom, WritableAtom } from 'jotai';
import { userAccountAtom } from './accountAtom';
import { networkLevelAtom } from './networkLevelAtom';
import {
  fullChainRegistryAtom,
  osmosisAssetsAtom,
  subscribedChainRegistryAtom,
} from './chainRegistryAtom';
import { sendStateAtom } from './transactionStateAtom';
import { getOsmosisChainId, getSkipSupportedAssets } from '@/helpers';
import { sessionWalletAtom } from './walletAtom';

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
            chainId: chain.chain_id,
            networkName: chain.chain_name,
          };
        }
      }
    }
  }

  // Fallback to network default
  return networkLevel === 'mainnet' ? DEFAULT_MAINNET_ASSET : DEFAULT_TESTNET_ASSET;
});

export const skipAssetsAtom = atom<AssetRegistry>({});
export const loadSkipAssetsAtom = atom(null, async (_, set) => {
  try {
    const assetRegistry = await getSkipSupportedAssets();
    set(skipAssetsAtom, assetRegistry);
  } catch (error) {
    console.error('[loadSkipAssetsAtom] Failed to load Skip assets:', error);
  }
});

// TODO: add Symphony's stablecoins
// NOTE: Pure registry assets without wallet balances (for receive context)
export const allReceivableAssetsAtom = atom(get => {
  const networkLevel = get(networkLevelAtom);
  const fullRegistry = get(fullChainRegistryAtom)[networkLevel];
  const sendState = get(sendStateAtom);
  const { chainWallets } = get(sessionWalletAtom);
  const osmosisAssets = get(osmosisAssetsAtom);

  const allWalletAssets = Object.values(chainWallets).flatMap(wallet => wallet.assets);
  const osmosisChainId = getOsmosisChainId(networkLevel);
  const osmosisChain = fullRegistry[osmosisChainId];

  const finalAssets: Asset[] = [];
  // ✅ Use DENOM as key (the actual IBC hash on Osmosis), not symbol
  const assetsByDenom = new Map<string, Asset>();

  // 1. Always include the sending asset
  if (sendState.asset) {
    assetsByDenom.set(sendState.asset.denom, sendState.asset);
    finalAssets.push(sendState.asset);
  }

  // 2. Add all assets from Osmosis
  for (const osmosisAsset of osmosisAssets) {
    const denomKey = osmosisAsset.denom; // ✅ Use actual denom (IBC hash)

    if (!assetsByDenom.has(denomKey)) {
      const newAsset: Asset = {
        denom: osmosisAsset.denom,
        amount: '0',
        displayAmount: '0',
        exchangeRate: osmosisAsset.exchangeRate || '-',
        isIbc: osmosisAsset.isIbc || false,
        logo: osmosisAsset.logo || '',
        symbol: osmosisAsset.symbol,
        name: osmosisAsset.name,
        exponent: osmosisAsset.exponent,
        isFeeToken: osmosisAsset.isFeeToken || false,
        networkName: osmosisChain.pretty_name || osmosisChain.chain_name,
        chainId: osmosisAsset.chainId,
        coinGeckoId: osmosisAsset.coinGeckoId,
        price: osmosisAsset.price || 0,
        originDenom: osmosisAsset.originDenom || osmosisAsset.denom,
        originChainId: osmosisAsset.originChainId || osmosisChainId,
        trace: osmosisAsset.trace,
      };

      assetsByDenom.set(denomKey, newAsset);
      finalAssets.push(newAsset);
    }
  }

  // 3. Update with wallet balances
  for (const walletAsset of allWalletAssets) {
    const denomKey = walletAsset.denom; // ✅ Match by actual denom
    const existingAsset = assetsByDenom.get(denomKey);

    if (existingAsset && walletAsset.chainId === osmosisChainId) {
      // Update with wallet balance
      Object.assign(existingAsset, {
        amount: walletAsset.amount,
        displayAmount: walletAsset.displayAmount,
        isIbc: walletAsset.isIbc,
        originDenom: walletAsset.originDenom,
        originChainId: walletAsset.originChainId,
        trace: walletAsset.trace,
      });
    }
  }

  return finalAssets;
});
