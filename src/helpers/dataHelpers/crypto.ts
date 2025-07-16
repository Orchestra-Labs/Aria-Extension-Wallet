import CryptoJS from 'crypto-js';

import { getLocalStorageItem, setLocalStorageItem } from './localStorage';

const MNEMONIC_KEY = 'encryptedMnemonic';

export const getStoredMnemonic = (): string | null => {
  return getLocalStorageItem(MNEMONIC_KEY);
};

export const storeMnemonic = (encryptedMnemonic: string): void => {
  setLocalStorageItem(MNEMONIC_KEY, encryptedMnemonic);
};

export const encryptMnemonic = (mnemonic: string, password: string): string => {
  return CryptoJS.AES.encrypt(mnemonic, password).toString();
};

export const decryptMnemonic = (encryptedMnemonic: string, password: string): string => {
  const bytes = CryptoJS.AES.decrypt(encryptedMnemonic, password);
  return bytes.toString(CryptoJS.enc.Utf8);
};
