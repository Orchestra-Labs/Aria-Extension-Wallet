import { atom } from 'jotai';

import {
  assetDialogSortOrderAtom,
  assetDialogSortTypeAtom,
  dialogSearchTermAtom,
  subscribedAssetsAtom,
} from '@/atoms';
import { filterAndSortAssets } from '@/helpers';
import { Asset } from '@/types';

export const symphonyAssetsAtom = atom<Asset[]>([]);

// For receive asset list (send page)
export const filteredExchangeAssetsAtom = atom(get => {
  const symphonyAssets = get(subscribedAssetsAtom);
  const searchTerm = get(dialogSearchTermAtom);
  const sortOrder = get(assetDialogSortOrderAtom);
  const sortType = get(assetDialogSortTypeAtom);

  const nonIbcAssets = symphonyAssets.filter(asset => !asset.isIbc);

  return filterAndSortAssets(nonIbcAssets, searchTerm, sortType, sortOrder);
});
