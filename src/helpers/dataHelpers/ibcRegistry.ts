import { DATA_FRESHNESS_TIMEOUT } from '@/constants';
import { removeLocalStorageItem } from './localStorage';
import { IbcRegistryRecord } from '@/types';

const IBC_STORAGE_KEY = 'localIbcRegistry';

export const initializeIbcRegistry = (): IbcRegistryRecord => ({
  data: {
    testnet: {},
    mainnet: {},
  },
  lastUpdated: new Date().toISOString(),
  commitHashes: {
    mainnetHash: '',
    testnetHash: '',
  },
});

export const getIbcRegistry = (): IbcRegistryRecord => {
  const stored = localStorage.getItem(IBC_STORAGE_KEY);
  return stored ? JSON.parse(stored) : initializeIbcRegistry();
};

export const saveIbcRegistry = (data: IbcRegistryRecord): void => {
  localStorage.setItem(IBC_STORAGE_KEY, JSON.stringify(data));
};

export const shouldCheckForUpdates = (lastUpdated: string): boolean => {
  return Date.now() - new Date(lastUpdated).getTime() > DATA_FRESHNESS_TIMEOUT;
};

export const deleteIBCRegistry = (): void => {
  removeLocalStorageItem(IBC_STORAGE_KEY);
  console.log(`Deleted (${IBC_STORAGE_KEY}) from localStorage.`);
};
