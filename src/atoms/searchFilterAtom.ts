import { atom } from 'jotai';

import { ValidatorSortType } from '@/constants';

export const searchTermAtom = atom<string>('');
export const dialogSearchTermAtom = atom<string>('');

// main
export const assetSortOrderAtom = atom<'Asc' | 'Desc'>('Desc');
export const assetSortTypeAtom = atom<'name' | 'amount'>('name');
export const validatorSortOrderAtom = atom<'Asc' | 'Desc'>('Desc');
export const validatorSortTypeAtom = atom<ValidatorSortType>(ValidatorSortType.NAME);

// dialogs
export const assetDialogSortOrderAtom = atom<'Asc' | 'Desc'>('Desc');
export const assetDialogSortTypeAtom = atom<'name' | 'amount'>('name');
export const validatorDialogSortOrderAtom = atom<'Asc' | 'Desc'>('Desc');
export const validatorDialogSortTypeAtom = atom<ValidatorSortType>(ValidatorSortType.NAME);
