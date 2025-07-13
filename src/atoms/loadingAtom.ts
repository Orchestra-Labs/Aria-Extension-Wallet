import { atom } from 'jotai';

export const isInitialDataLoadAtom = atom(true);

export const isFetchingRegistryDataAtom = atom(false);
export const isGeneratingAddressesAtom = atom(false);
export const isFetchingWalletDataAtom = atom(false);
export const isFetchingValidatorDataAtom = atom(false);
