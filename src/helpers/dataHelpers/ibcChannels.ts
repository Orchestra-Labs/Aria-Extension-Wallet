import { NetworkLevel, STORED_DATA_TIMEOUT } from '@/constants';
import { getLocalStorageItem, setLocalStorageItem } from './localStorage';

const IBC_STORAGE_KEYS = {
  testnet: 'testnetIbcConnectionPaths',
  mainnet: 'mainnetIbcConnectionPaths',
};

export const getIBCConnections = (
  network: NetworkLevel,
): { lastUpdated: string; data: any[] } | null => {
  const storedData = getLocalStorageItem(IBC_STORAGE_KEYS[network]);

  if (storedData) {
    try {
      return JSON.parse(storedData);
    } catch (error) {
      console.error('Failed to parse IBC connections from localStorage:', error);
    }
  }
  return null;
};

export const saveIBCConnections = (network: NetworkLevel, data: any[]): void => {
  const storageData = {
    lastUpdated: new Date().toISOString(),
    data,
  };

  setLocalStorageItem(IBC_STORAGE_KEYS[network], JSON.stringify(storageData));
};

export const ibcConnectionsNeedRefresh = (storedData: { lastUpdated: string } | null): boolean => {
  if (!storedData) return true;

  const lastUpdatedTime = new Date(storedData.lastUpdated).getTime();
  const currentTime = new Date().getTime();
  return currentTime - lastUpdatedTime >= STORED_DATA_TIMEOUT;
};
