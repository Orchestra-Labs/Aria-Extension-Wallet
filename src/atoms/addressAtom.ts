import { InputStatus } from '@/constants';
import { AddressValidationState } from '@/types';
import { atom } from 'jotai';

export const recipientAddressAtom = atom<string>('');

export const addressValidationAtom = atom<AddressValidationState>({
  status: InputStatus.NEUTRAL,
  message: '',
});

export const addressVerifiedAtom = atom(
  get => get(addressValidationAtom).status === InputStatus.SUCCESS,
);
