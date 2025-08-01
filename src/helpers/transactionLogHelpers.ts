import { SetStateAction } from 'jotai';
import { TransactionLog, TransactionLogEntry } from '@/types';
import { TransactionStatus } from '@/constants';

// TODO: remove if unused
export const addTransactionStep = (
  setLog: (update: SetStateAction<TransactionLog>) => void,
  description: string,
  fee?: { amount: number; denom: string },
) => {
  const newEntry: TransactionLogEntry = {
    description,
    fee,
    status: TransactionStatus.IDLE,
  };

  setLog(prev => ({
    ...prev,
    entries: [...prev.entries, newEntry],
  }));
};

export const updateTransactionStep = (
  setLog: (update: SetStateAction<TransactionLog>) => void,
  index: number,
  updates: Partial<TransactionLogEntry>,
) => {
  setLog(prev => {
    const newEntries = [...prev.entries];
    if (index >= 0 && index < newEntries.length) {
      newEntries[index] = { ...newEntries[index], ...updates };
    }
    return { ...prev, entries: newEntries };
  });
};

export const resetTransactionLog = (setLog: (update: SetStateAction<TransactionLog>) => void) => {
  setLog({
    isSimulation: false,
    entries: [],
  });
};
