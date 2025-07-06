import { atom } from 'jotai';
import { Asset } from '@/types';
import {
  searchTermAtom,
  assetSortOrderAtom,
  assetSortTypeAtom,
  showAllAssetsAtom,
  dialogSearchTermAtom,
  assetDialogSortOrderAtom,
  assetDialogSortTypeAtom,
  symphonyAssetsAtom,
  chainRegistryAtom,
  sessionWalletAtom,
  networkLevelAtom,
} from '@/atoms';
import { userAccountAtom } from './accountAtom';
import { filterAndSortAssets } from '@/helpers';

// Subscribed and merged wallet assets with balances
export const subscribedAssetsAtom = atom(get => {
  const { chainWallets } = get(sessionWalletAtom);
  const userAccount = get(userAccountAtom);
  const chainRegistry = get(chainRegistryAtom);
  const networkLevel = get(networkLevelAtom);

  console.log(`[subscribedAssetsAtom] Building for ${networkLevel}`);

  if (!userAccount?.settings.subscribedTo) return [];

  const visibleAssets: Asset[] = [];

  for (const [networkID, denoms] of Object.entries(userAccount.settings.subscribedTo)) {
    const registryEntry = chainRegistry[networkLevel][networkID];
    console.log(`[subscribedAssetsAtom] Checking ${networkLevel} entry for ${networkID}`);
    if (!registryEntry) {
      console.warn(`[subscribedAssetsAtom] No ${networkLevel} entry for ${networkID}`);
      continue;
    } else {
      console.log(`[subscribedAssetsAtom] Found ${networkLevel} entry for ${networkID}`);
    }

    const chainAssets = Object.values(registryEntry?.assets || []);
    const walletAssets = chainWallets[networkID]?.assets || [];

    const assetsToShow =
      denoms.length > 0 ? chainAssets.filter(asset => denoms.includes(asset.denom)) : chainAssets;

    assetsToShow.forEach(asset => {
      const matched = walletAssets.find(
        wAsset => wAsset.denom === asset.denom && wAsset.networkID === networkID,
      );
      visibleAssets.push({
        ...asset,
        networkID,
        amount: matched?.amount || '0',
      });
    });
  }

  console.log(`[subscribedAssetsAtom] Final assets for ${networkLevel}:`, visibleAssets);
  return visibleAssets;
});

// Filtered assets for main UI list
export const filteredAssetsAtom = atom(get => {
  const assets = get(subscribedAssetsAtom);

  const filtered = filterAndSortAssets(
    assets,
    get(searchTermAtom),
    get(assetSortTypeAtom),
    get(assetSortOrderAtom),
    get(showAllAssetsAtom),
  );

  console.log('[filteredAssetsAtom] Result:', filtered);
  return filtered;
});

// Filtered assets for dialogs/search
export const filteredDialogAssetsAtom = atom(get =>
  filterAndSortAssets(
    get(subscribedAssetsAtom),
    get(dialogSearchTermAtom),
    get(assetDialogSortTypeAtom),
    get(assetDialogSortOrderAtom),
  ),
);

// Filtered coin list for exchange view (all assets)
export const coinListAssetsAtom = atom(get =>
  filterAndSortAssets(
    get(symphonyAssetsAtom),
    get(dialogSearchTermAtom),
    get(assetDialogSortTypeAtom),
    get(assetDialogSortOrderAtom),
  ),
);
