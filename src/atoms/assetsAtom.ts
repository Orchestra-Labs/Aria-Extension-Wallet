import { atom } from 'jotai';

import { DEFAULT_ASSET } from '@/constants';
import { Asset } from '@/types';

export const showAllAssetsAtom = atom<boolean>(false);

export const selectedAssetAtom = atom<Asset>(DEFAULT_ASSET);
export const dialogSelectedAssetAtom = atom<Asset>(DEFAULT_ASSET);
export const selectedCoinListAtom = atom<Asset[]>([]);
