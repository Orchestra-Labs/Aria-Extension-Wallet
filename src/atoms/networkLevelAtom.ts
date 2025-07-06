import { NetworkLevel } from '@/constants';
import { atom } from 'jotai';

export const networkLevelAtom = atom<NetworkLevel>(NetworkLevel.MAINNET);
