import { atom } from 'jotai';

import { AccountRecord } from '@/types';

export const userAccountAtom = atom<AccountRecord | null>(null);
