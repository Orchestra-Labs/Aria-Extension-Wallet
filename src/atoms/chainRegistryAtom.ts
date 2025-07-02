import { LOCAL_CHAIN_REGISTRY } from '@/constants';
import { LocalChainRegistry } from '@/types';
import { atom } from 'jotai';

export const chainRegistryAtom = atom<LocalChainRegistry>(LOCAL_CHAIN_REGISTRY);
