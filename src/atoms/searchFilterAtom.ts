import { AssetSortType, SortOrder, ValidatorSortType } from '@/constants';
import { atom } from 'jotai';

export const searchTermAtom = atom<string>('');
export const dialogSearchTermAtom = atom<string>('');

// main
export const chainSortOrderAtom = atom<SortOrder>(SortOrder.ASC);
export const assetSortOrderAtom = atom<SortOrder>(SortOrder.ASC);
export const assetSortTypeAtom = atom<AssetSortType>(AssetSortType.NAME);
export const validatorSortOrderAtom = atom<SortOrder>(SortOrder.ASC);
export const validatorSortTypeAtom = atom<ValidatorSortType>(ValidatorSortType.NAME);

// dialogs
export const chainDialogSortOrderAtom = atom<SortOrder>(SortOrder.ASC);
export const assetDialogSortOrderAtom = atom<SortOrder>(SortOrder.ASC);
export const assetDialogSortTypeAtom = atom<AssetSortType>(AssetSortType.NAME);
export const validatorDialogSortOrderAtom = atom<SortOrder>(SortOrder.ASC);
export const validatorDialogSortTypeAtom = atom<ValidatorSortType>(ValidatorSortType.NAME);
