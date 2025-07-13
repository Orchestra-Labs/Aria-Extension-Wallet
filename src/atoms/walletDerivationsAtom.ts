import { atom } from 'jotai';
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
import { Asset } from '@/types';

// Subscribed and merged wallet assets with balances
export const subscribedAssetsAtom = atom(get => {
  const { chainWallets } = get(sessionWalletAtom);
  const userAccount = get(userAccountAtom);
  const chainRegistry = get(chainRegistryAtom);
  const networkLevel = get(networkLevelAtom);

  console.log(`[subscribedAssetsAtom] Building for ${networkLevel}`);

  if (!userAccount?.settings.chainSubscriptions[networkLevel]) {
    console.log('[subscribedAssetsAtom] No chain subscriptions found');
    return [];
  }

  // Create wallet assets map for quick lookup (includes IBC assets)
  const walletAssets = Object.values(chainWallets)
    .flatMap(wallet => wallet.assets)
    .filter(asset => {
      const chainInfo = chainRegistry[networkLevel][asset.networkID];
      return chainInfo !== undefined;
    });

  const walletAssetsMap = walletAssets.reduce(
    (map, asset) => {
      if (!map[asset.networkID]) map[asset.networkID] = {};
      map[asset.networkID][asset.denom] = asset;
      return map;
    },
    {} as Record<string, Record<string, Asset>>,
  );

  // Create Set of subscribed denoms for IBC checking
  const subscribedDenoms = new Set(
    Object.values(userAccount.settings.chainSubscriptions[networkLevel]).flatMap(denoms => denoms),
  );

  const subscribedAssets: Asset[] = [];
  const currentChains = chainRegistry[networkLevel];

  // Process 1: Registry assets (for zero-balance native assets)
  for (const [networkID, denoms] of Object.entries(
    userAccount.settings.chainSubscriptions[networkLevel],
  )) {
    const chainInfo = currentChains[networkID];
    if (!chainInfo) continue;

    const chainAssets = Object.values(chainInfo.assets || {});

    for (const denom of denoms) {
      const assetFromRegistry = chainAssets.find(a => a.denom === denom);
      if (!assetFromRegistry) continue;

      const walletAsset = walletAssetsMap[networkID]?.[denom];

      subscribedAssets.push({
        ...assetFromRegistry,
        amount: walletAsset?.amount || '0',
        networkID: chainInfo.chain_id,
        networkName: chainInfo.chain_name,
        isIbc: walletAsset?.isIbc || false,
      });
    }
  }

  // Process 2: Wallet assets (for IBC assets and any additional balances)
  for (const asset of walletAssets) {
    // Skip if already included from registry processing
    if (subscribedAssets.some(a => a.denom === asset.denom && a.networkID === asset.networkID))
      continue;

    // Check if IBC asset with subscribed base denom
    const isSubscribedIbc = asset.isIbc && asset.denom && subscribedDenoms.has(asset.denom);

    if (subscribedDenoms.has(asset.denom) || isSubscribedIbc) {
      subscribedAssets.push(asset);
    }
  }

  console.log(`[subscribedAssetsAtom] Final assets for ${networkLevel}:`, subscribedAssets);
  return subscribedAssets;
});

// Filtered assets for main UI list
export const filteredAssetsAtom = atom(get => {
  const assets = get(subscribedAssetsAtom);
  const searchTerm = get(searchTermAtom);
  const sortType = get(assetSortTypeAtom);
  const sortOrder = get(assetSortOrderAtom);
  const showAllAssets = get(showAllAssetsAtom);

  console.groupCollapsed('[filteredAssetsAtom] Filtering assets');
  console.log('[filteredAssetsAtom] Input assets:', assets);
  console.log('[filteredAssetsAtom] Filter parameters:', {
    searchTerm,
    sortType,
    sortOrder,
    showAllAssets,
  });

  const filtered = filterAndSortAssets(assets, searchTerm, sortType, sortOrder, showAllAssets);

  console.log('[filteredAssetsAtom] Result count:', filtered.length);
  console.groupEnd();
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
