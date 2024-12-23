import { atom } from 'jotai';
import { SignClientTypes } from '@walletconnect/types';

interface ModalState {
  open: boolean;
  view?: string;
  data?: {
    proposal?: SignClientTypes.EventArguments['session_proposal'];
  };
}

export const modalAtom = atom<ModalState>({
  open: false,
  view: undefined,
  data: undefined,
});
