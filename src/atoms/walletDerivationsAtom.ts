import { atom } from 'jotai';
import {
  searchTermAtom,
  assetSortOrderAtom,
  assetSortTypeAtom,
  showAllAssetsAtom,
  dialogSearchTermAtom,
  assetDialogSortOrderAtom,
  assetDialogSortTypeAtom,
  subscribedChainRegistryAtom,
  sessionWalletAtom,
  networkLevelAtom,
  allReceivableAssetsAtom,
  fullChainRegistryAtom,
} from '@/atoms';
import { userAccountAtom } from './accountAtom';
import { filterAndSortAssets } from '@/helpers';
import { Asset } from '@/types';

export const symphonyAssetsAtom = atom<Asset[]>([]);

// Subscribed and merged wallet assets with balances
export const subscribedAssetsAtom = atom(get => {
  const { chainWallets } = get(sessionWalletAtom);
  const userAccount = get(userAccountAtom);
  const subscribedChainRegistry = get(subscribedChainRegistryAtom);
  const fullChainRegistry = get(fullChainRegistryAtom);
  const networkLevel = get(networkLevelAtom);

  if (!userAccount?.settings.chainSubscriptions[networkLevel]) {
    console.log('[subscribedAssetsAtom] No chain subscriptions found');
    return [];
  }

  // Split wallet assets into regular and IBC assets
  const allWalletAssets = Object.values(chainWallets).flatMap(wallet => wallet.assets);
  const regularAssets = allWalletAssets.filter(asset => !asset.isIbc);
  const ibcAssets = allWalletAssets.filter(asset => asset.isIbc);

  console.log('[subscribedAssetsAtom] wallet assets', {
    regular: regularAssets,
    ibc: ibcAssets,
  });

  // Get current chain registries
  const currentSubscribedChains = subscribedChainRegistry[networkLevel];
  const currentFullChains = fullChainRegistry[networkLevel];
  const chainSubscriptions = userAccount.settings.chainSubscriptions[networkLevel];

  // Create a map of all subscribed denoms across all chains for IBC checking
  const allSubscribedDenoms = new Set(
    Object.values(chainSubscriptions).flatMap(sub => sub.subscribedDenoms),
  );

  const subscribedAssets: Asset[] = [];

  // Process regular assets first
  for (const asset of regularAssets) {
    const chainSubscription = chainSubscriptions[asset.chainId];
    if (!chainSubscription) continue;

    const chainInfo = currentSubscribedChains[asset.chainId] || currentFullChains[asset.chainId];
    if (!chainInfo) continue;

    // Check if viewAll is true or if the denom is in the subscription list
    if (
      chainSubscription.viewAll ||
      chainSubscription.subscribedDenoms.includes(asset.originDenom || asset.denom)
    ) {
      subscribedAssets.push(asset);
    }
  }

  // Process IBC assets
  for (const asset of ibcAssets) {
    const chainSubscription = chainSubscriptions[asset.chainId];
    if (!chainSubscription) continue;

    const chainInfo = currentSubscribedChains[asset.chainId] || currentFullChains[asset.chainId];
    if (!chainInfo) continue;

    // Check if viewAll is true for this chain OR
    // if any chain's subscription list has this denom or ibc denom
    const isSubscribed =
      chainSubscription.viewAll ||
      allSubscribedDenoms.has(asset.originDenom || asset.denom) ||
      (asset.isIbc && allSubscribedDenoms.has(asset.originDenom || asset.denom));

    if (isSubscribed) {
      subscribedAssets.push(asset);
    }
  }

  // Process registry assets for zero-balance native assets
  for (const [chainId, denomSubscriptions] of Object.entries(chainSubscriptions)) {
    const viewAll = denomSubscriptions.viewAll;
    const chainInfo = viewAll ? currentFullChains[chainId] : currentSubscribedChains[chainId];
    if (!chainInfo) continue;

    const chainAssets = Object.values(chainInfo.assets || {});
    for (const asset of chainAssets) {
      // Skip if already included from wallet assets processing
      if (
        subscribedAssets.some(
          a =>
            (a.originDenom || a.denom) === (asset.originDenom || asset.denom) &&
            a.chainId === chainId,
        )
      ) {
        continue;
      }

      // Only include if viewAll is true or denom is in subscription list
      if (
        viewAll ||
        denomSubscriptions.subscribedDenoms.includes(asset.originDenom || asset.denom)
      ) {
        subscribedAssets.push({
          ...asset,
          amount: '0',
          chainId: chainInfo.chain_id,
          networkName: chainInfo.chain_name,
          isIbc: false,
        });
      }
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

// NOTE: for the asset select dialog for sendable assets (send page)
export const filteredDialogAssetsAtom = atom(get => {
  const assets = get(subscribedAssetsAtom);
  const searchTerm = get(dialogSearchTermAtom);
  const sortType = get(assetDialogSortTypeAtom);
  const sortOrder = get(assetDialogSortOrderAtom);

  // Filter out assets with zero balance
  const nonZeroAssets = assets.filter(asset => asset.amount !== '0');

  return filterAndSortAssets(nonZeroAssets, searchTerm, sortType, sortOrder);
});

// TODO: ensure these assets have the proper typing for originDenom and originChainID
// NOTE: for the asset select dialog for receivable assets (send page)
export const filteredReceiveAssetsAtom = atom(get => {
  const reachableAssets = get(allReceivableAssetsAtom);
  const searchTerm = get(dialogSearchTermAtom);
  const sortType = get(assetDialogSortTypeAtom);
  const sortOrder = get(assetDialogSortOrderAtom);

  return filterAndSortAssets(reachableAssets, searchTerm, sortType, sortOrder);
});

// Filtered coin list for exchange view (all assets)
export const coinListAssetsAtom = atom(get =>
  filterAndSortAssets(
    get(symphonyAssetsAtom),
    get(dialogSearchTermAtom),
    get(assetDialogSortTypeAtom),
    get(assetDialogSortOrderAtom),
  ),
);
