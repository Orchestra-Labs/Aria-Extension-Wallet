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
} from '@/atoms';
import { filterAndSortAssets } from '@/helpers';
import { userAccountAtom } from './accountAtom';
import { DEFAULT_ASSET } from '@/constants';

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

  const visibleCoins = new Set(userAccount?.settings.visibleCoins || [DEFAULT_ASSET.denom]);
  const visibleAssets = walletState.assets.filter(asset => visibleCoins.has(asset.denom));

  return filterAndSortAssets(visibleAssets, searchTerm, sortType, sortOrder, showAllAssets);
});

export const filteredDialogAssetsAtom = atom(get => {
  const walletState = get(walletStateAtom);
  const searchTerm = get(dialogSearchTermAtom);
  const sortOrder = get(assetDialogSortOrderAtom);
  const sortType = get(assetDialogSortTypeAtom);
  const userAccount = get(userAccountAtom);

  const visibleCoins = new Set(userAccount?.settings.visibleCoins || [DEFAULT_ASSET.denom]);
  const visibleAssets = walletState.assets.filter(asset => visibleCoins.has(asset.denom));

  return filterAndSortAssets(visibleAssets, searchTerm, sortType, sortOrder);
});
