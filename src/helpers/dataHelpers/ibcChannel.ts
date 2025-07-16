import { NetworkLevel, STORED_DATA_TIMEOUT } from '@/constants';
import { IBCConnectionFile } from '@/types';

import { getLocalStorageItem, removeLocalStorageItem, setLocalStorageItem } from './localStorage';

const IBC_FILE_KEY_PREFIX = {
  testnet: 'testnet_ibcFileCache_',
  mainnet: 'mainnet_ibcFileCache_',
};

const getFileCacheKey = (network: NetworkLevel, fileName: string): string => {
  return `${IBC_FILE_KEY_PREFIX[network]}_${fileName}`;
};

export const getIBCFile = (network: NetworkLevel, fileName: string): IBCConnectionFile | null => {
  const cacheKey = getFileCacheKey(network, fileName);
  const storedData = getLocalStorageItem(cacheKey);

  if (storedData) {
    try {
      const parsedData = JSON.parse(storedData) as IBCConnectionFile;
      console.log(`Parsed IBC file (${fileName}) from localStorage:`, parsedData);
      return parsedData;
    } catch (error) {
      console.error(`Failed to parse IBC file (${fileName}) from localStorage:`, error);
    }
  }
  return null;
};

export const saveIBCFile = (network: NetworkLevel, fileName: string, data: any): void => {
  const cacheKey = getFileCacheKey(network, fileName);
  const storageData = {
    lastUpdated: new Date().toISOString(),
    data,
  };

  setLocalStorageItem(cacheKey, JSON.stringify(storageData));
  console.log(`Saved IBC file (${fileName}) to localStorage.`);
};

export const ibcFileNeedsRefresh = (file: IBCConnectionFile | null): boolean => {
  if (!file) return true;

  const lastUpdatedTime = new Date(file.lastUpdated).getTime();
  const currentTime = new Date().getTime();
  return currentTime - lastUpdatedTime >= STORED_DATA_TIMEOUT;
};

export const deleteIBCFile = (network: NetworkLevel, fileName: string): void => {
  const cacheKey = getFileCacheKey(network, fileName);
  removeLocalStorageItem(cacheKey);
  console.log(`Deleted IBC file (${fileName}) from localStorage.`);
};

export const clearIBCFilesForNetwork = (): void => {
  Object.keys(localStorage).forEach(key => {
    if (key.startsWith(`${IBC_FILE_KEY_PREFIX}`)) {
      removeLocalStorageItem(key);
      console.log(`Cleared IBC file (${key}) from localStorage.`);
    }
  });
};
