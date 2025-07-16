import { atom } from 'jotai';

import { userIsLoggedIn } from '@/helpers';

export const isLoggedInAtom = atom<boolean>(userIsLoggedIn());
