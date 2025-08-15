import { DEFAULT_MAINNET_ASSET, DEFAULT_TESTNET_ASSET } from '@/constants';
import { Asset } from '@/types';
import { atom, WritableAtom } from 'jotai';
import { userAccountAtom } from './accountAtom';
import { networkLevelAtom } from './networkLevelAtom';
import {
  fullChainRegistryAtom,
  skipChainsAtom,
  subscribedChainRegistryAtom,
} from './chainRegistryAtom';

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

// TODO: add Symphony's stablecoins
// NOTE: Pure registry assets without wallet balances (for receive context)
export const allReceivableAssetsAtom = atom(get => {
  const networkLevel = get(networkLevelAtom);
  const fullRegistry = get(fullChainRegistryAtom)[networkLevel];
  const subscribedRegistry = get(subscribedChainRegistryAtom)[networkLevel];
  const skipChains = get(skipChainsAtom);

  // We'll track both by denom and symbol for uniqueness
  const assetsByDenom = new Map<string, Asset>();
  const assetsBySymbol = new Map<string, Asset>();
  let finalAssets: Asset[] = [];

  const subscribedChainIds = new Set(Object.keys(subscribedRegistry));

  // Process all chains in the full registry
  for (const [chainId, chainInfo] of Object.entries(fullRegistry)) {
    const isSkipSupported = skipChains.includes(chainId);
    const isSubscribed = subscribedChainIds.has(chainId);

    if (!isSkipSupported && !isSubscribed) {
      console.log('[allReceivableAssetsAtom] Skipping - neither Skip-supported nor subscribed');
      continue;
    }

    const chainAssets = Object.values(chainInfo.assets || {});

    for (const asset of chainAssets) {
      const existingByDenom = assetsByDenom.get(asset.denom);
      const existingBySymbol = assetsBySymbol.get(asset.symbol);

      // Check if this asset is preferred over existing ones
      const isPreferredDenom = asset.denom === `u${asset.symbol.toLowerCase()}`;

      // Case 1: Neither denom nor symbol exists yet
      if (!existingByDenom && !existingBySymbol) {
        assetsByDenom.set(asset.denom, asset);
        assetsBySymbol.set(asset.symbol, asset);
        finalAssets.push({
          ...asset,
          amount: '0',
          chainId: chainInfo.chain_id,
          networkName: chainInfo.chain_name,
          isIbc: false,
        });
      }
      // Case 2: Only denom exists, but symbol is new
      else if (existingByDenom && !existingBySymbol) {
        // Keep the existing denom entry, but add this symbol
        assetsBySymbol.set(asset.symbol, existingByDenom);
      }
      // Case 3: Only symbol exists, but denom is new
      else if (!existingByDenom && existingBySymbol) {
        // Replace if this is a preferred denom format
        if (isPreferredDenom) {
          // Remove old symbol entry
          const oldAsset = existingBySymbol;
          assetsBySymbol.delete(oldAsset.symbol);
          finalAssets = finalAssets.filter(a => a.denom !== oldAsset.denom);

          // Add new preferred asset
          assetsByDenom.set(asset.denom, asset);
          assetsBySymbol.set(asset.symbol, asset);
          finalAssets.push({
            ...asset,
            amount: '0',
            chainId: chainInfo.chain_id,
            networkName: chainInfo.chain_name,
            isIbc: false,
          });
        }
      }
      // Case 4: Both denom and symbol exist (conflict)
      else {
        // Prefer the u[symbol] format if this asset has it
        if (isPreferredDenom) {
          // Remove old entries
          const oldDenomAsset = existingByDenom;
          const oldSymbolAsset = existingBySymbol;

          if (!oldDenomAsset || !oldSymbolAsset) continue;

          assetsByDenom.delete(oldDenomAsset.denom);
          assetsBySymbol.delete(oldSymbolAsset.symbol);
          finalAssets = finalAssets.filter(
            a => a.denom !== oldDenomAsset.denom && a.symbol !== oldSymbolAsset.symbol,
          );

          // Add new preferred asset
          assetsByDenom.set(asset.denom, asset);
          assetsBySymbol.set(asset.symbol, asset);
          finalAssets.push({
            ...asset,
            amount: '0',
            chainId: chainInfo.chain_id,
            networkName: chainInfo.chain_name,
            isIbc: false,
          });
        }
      }
    }
  }

  console.log('[allReceivableAssetsAtom] Unique assets returned:', finalAssets);
  return finalAssets;
});
