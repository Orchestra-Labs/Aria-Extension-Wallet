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

export const filteredAssetsAtom = atom(get => {
  const walletState = get(walletStateAtom);
  const searchTerm = get(searchTermAtom);
  const sortOrder = get(assetSortOrderAtom);
  const sortType = get(assetSortTypeAtom);
  const showAllAssets = get(showAllAssetsAtom);
  const userAccount = get(userAccountAtom);
  const exchangeAssets = get(symphonyAssetsAtom);

  const visibleAssets: Asset[] = [];
  if (userAccount && userAccount.settings.subscribedTo) {
    Object.entries(userAccount.settings.subscribedTo).forEach(([networkID, subscription]) => {
      const networkAssets = exchangeAssets.reduce((map: { [key: string]: Asset }, asset) => {
        map[asset.denom] = asset;
        return map;
      }, {});
      const hasCoinSubscriptions = subscription.coinDenoms.length === 0;
      if (hasCoinSubscriptions) {
        Object.values(exchangeAssets).forEach(asset => {
          const walletAsset = walletState.assets.find(wAsset => wAsset.denom === asset.denom);
          visibleAssets.push(walletAsset ? walletAsset : { ...asset, amount: '0' });
        });
      } else {
        subscription.coinDenoms.forEach(denom => {
          const asset = networkAssets[denom];
          if (asset) {
            const walletAsset = walletState.assets.find(wAsset => wAsset.denom === denom);
            visibleAssets.push(walletAsset ? walletAsset : { ...asset, amount: '0' });
          } else {
            console.warn(`Asset with denom ${denom} not found in network assets for ${networkID}`);
          }
        });
      }
    });
  } else {
    console.warn('No user account found.');
  }

  const filteredAndSortedAssets = filterAndSortAssets(
    visibleAssets,
    searchTerm,
    sortType,
    sortOrder,
    showAllAssets,
  );
  return filteredAndSortedAssets;
});

export const filteredDialogAssetsAtom = atom(get => {
  const walletState = get(walletStateAtom);
  const searchTerm = get(dialogSearchTermAtom);
  const sortOrder = get(assetDialogSortOrderAtom);
  const sortType = get(assetDialogSortTypeAtom);
  const userAccount = get(userAccountAtom);
  const exchangeAssets = get(symphonyAssetsAtom);

  const visibleAssets: Asset[] = [];
  if (userAccount) {
    Object.entries(userAccount.settings.subscribedTo || {}).forEach(([networkID, subscription]) => {
      const networkAssets = exchangeAssets.reduce((map: { [key: string]: Asset }, asset) => {
        map[asset.denom] = asset;
        return map;
      }, {});
      const hasCoinSubscriptions = subscription.coinDenoms.length === 0;
      if (hasCoinSubscriptions) {
        Object.values(exchangeAssets).forEach(asset => {
          const walletAsset = walletState.assets.find(wAsset => wAsset.denom === asset.denom);
          if (walletAsset && parseFloat(walletAsset.amount) > 0) {
            visibleAssets.push(walletAsset);
          }
        });
      } else {
        subscription.coinDenoms.forEach(denom => {
          const asset = networkAssets[denom];
          if (asset) {
            const walletAsset = walletState.assets.find(wAsset => wAsset.denom === denom);
            if (walletAsset && parseFloat(walletAsset.amount) > 0) {
              visibleAssets.push(walletAsset);
            }
          } else {
            console.warn(
              `Dialog - Asset with denom ${denom} not found in network assets for ${networkID}`,
            );
          }
        });
      }
    });
  } else {
    console.warn('Dialog - No user account found.');
  }

  const filteredAndSortedDialogAssets = filterAndSortAssets(
    visibleAssets,
    searchTerm,
    sortType,
    sortOrder,
  );
  return filteredAndSortedDialogAssets;
});
