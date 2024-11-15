import { AccountRecord } from '@/types';
import { atom } from 'jotai';

export const userAccountAtom = atom<AccountRecord | null>(null);
