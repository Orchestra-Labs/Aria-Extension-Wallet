import { atom } from 'jotai';
import { Asset, WalletRecord } from '@/types';
import {
  searchTermAtom,
  assetSortOrderAtom,
  assetSortTypeAtom,
  showAllAssetsAtom,
  dialogSearchTermAtom,
  assetDialogSortOrderAtom,
  assetDialogSortTypeAtom,
  symphonyAssetsAtom,
} from '@/atoms';
import { filterAndSortAssets } from '@/helpers';
import { userAccountAtom } from './accountAtom';

export const userWalletAtom = atom<WalletRecord | null>(null);

export const walletAddressAtom = atom<string>('');
export const walletAssetsAtom = atom<Array<Asset>>([]);
// Read only
export const walletStateAtom = atom(get => ({
  address: get(walletAddressAtom),
  assets: get(walletAssetsAtom),
}));

export const subscribedAssetsAtom = atom(get => {
  const walletState = get(walletStateAtom);
  const userAccount = get(userAccountAtom);
  const symphonyAssets = get(symphonyAssetsAtom);

  console.log('symphony assets:', symphonyAssets);

  const visibleAssets: Asset[] = [];
  if (userAccount && userAccount.settings.subscribedTo) {
    Object.entries(userAccount.settings.subscribedTo).forEach(([networkID, subscription]) => {
      const networkAssets = symphonyAssets.reduce((map: { [key: string]: Asset }, asset) => {
        map[asset.denom] = asset;
        return map;
      }, {});

      const hasCoinSubscriptions = subscription.coinDenoms.length > 0;

      const addVisibleAsset = (denom: string) => {
        const baseAsset = networkAssets[denom];
        const walletAsset = walletState.assets.find(wAsset => wAsset.denom === denom);

        if (baseAsset) {
          visibleAssets.push({
            ...baseAsset, // includes exchangeRate, symbol, etc.
            ...(walletAsset ? { amount: walletAsset.amount } : { amount: '0' }),
          });
        } else {
          console.warn(`Asset with denom ${denom} not found in network assets for ${networkID}`);
        }
      };

      if (hasCoinSubscriptions) {
        subscription.coinDenoms.forEach(addVisibleAsset);
      } else {
        symphonyAssets.forEach(asset => addVisibleAsset(asset.denom));
      }
    });
  } else {
    console.warn('No user account found.');
  }

  return visibleAssets;
});

export const filteredAssetsAtom = atom(get => {
  const searchTerm = get(searchTermAtom);
  const sortOrder = get(assetSortOrderAtom);
  const sortType = get(assetSortTypeAtom);
  const showAllAssets = get(showAllAssetsAtom);
  const subscribedAssets = get(subscribedAssetsAtom);

  const filteredAndSortedAssets = filterAndSortAssets(
    subscribedAssets,
    searchTerm,
    sortType,
    sortOrder,
    showAllAssets,
  );
  return filteredAndSortedAssets;
});

export const filteredDialogAssetsAtom = atom(get => {
  const searchTerm = get(dialogSearchTermAtom);
  const sortOrder = get(assetDialogSortOrderAtom);
  const sortType = get(assetDialogSortTypeAtom);
  const subscribedAssets = get(subscribedAssetsAtom);
  console.log('subscribed assets, filtered:', subscribedAssets);

  const filteredAndSortedDialogAssets = filterAndSortAssets(
    subscribedAssets,
    searchTerm,
    sortType,
    sortOrder,
  );
  console.log('results, filtered:', filteredAndSortedDialogAssets);

  return filteredAndSortedDialogAssets;
});

// For exchange page, show all possible assets
export const coinListAssetsAtom = atom(get => {
  const searchTerm = get(dialogSearchTermAtom);
  const sortOrder = get(assetDialogSortOrderAtom);
  const sortType = get(assetDialogSortTypeAtom);
  const subscribedAssets = get(symphonyAssetsAtom);

  console.log('subscribed assets:', subscribedAssets);
  console.log('searching for:', searchTerm);
  const filteredAndSortedDialogAssets = filterAndSortAssets(
    subscribedAssets,
    searchTerm,
    sortType,
    sortOrder,
  );
  console.log('result of search: ', filteredAndSortedDialogAssets);
  return filteredAndSortedDialogAssets;
});
