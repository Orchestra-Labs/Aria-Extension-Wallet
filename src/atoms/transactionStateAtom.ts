import { atom } from 'jotai';
import { defaultReceiveState, defaultSendState } from '@/constants';
import { TransactionState } from '@/types';

export const sendStateAtom = atom<TransactionState>(defaultSendState);
export const receiveStateAtom = atom<TransactionState>(defaultReceiveState);
