import { atom } from 'jotai';

import { Pagination } from '@/types';

export const paginationAtom = atom<Pagination | null>(null);
