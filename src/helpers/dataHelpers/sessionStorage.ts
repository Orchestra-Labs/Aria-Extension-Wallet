// TODO: remove file if not used
export const setSessionStorageItem = (key: string, value: string): void => {
  sessionStorage.setItem(key, value);
};

export const getSessionStorageItem = (key: string): string | null => {
  return sessionStorage.getItem(key);
};

export const removeSessionStorageItem = (key: string): void => {
  sessionStorage.removeItem(key);
};

export const clearSessionStorage = (): void => {
  sessionStorage.clear();
};
