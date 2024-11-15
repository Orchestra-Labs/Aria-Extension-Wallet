import { DEFAULT_ASSET } from '@/constants';
import { Asset } from '@/types';
import { atom } from 'jotai';

export const showAllAssetsAtom = atom<boolean>(false);

export const selectedAssetAtom = atom<Asset>(DEFAULT_ASSET);
export const dialogSelectedAssetAtom = atom<Asset>(DEFAULT_ASSET);
export const selectedCoinListAtom = atom<Asset[]>([]);
