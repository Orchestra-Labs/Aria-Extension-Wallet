import { STORED_DATA_TIMEOUT } from '@/constants';
import { getLocalStorageItem, setLocalStorageItem, removeLocalStorageItem } from './localstorage';

interface LoginAttempt {
  count: number;
  lastAttemptTime: number;
}

const LOGIN_ATTEMPTS_KEY = 'loginAttempts';

export const getLoginAttempts = (): LoginAttempt | null => {
  const attempts = getLocalStorageItem(LOGIN_ATTEMPTS_KEY);
  return attempts ? JSON.parse(attempts) : null;
};

export const recordFailedLoginAttempt = (): LoginAttempt => {
  const now = Date.now();
  const existingAttempts = getLoginAttempts();

  let newAttempts: LoginAttempt;
  if (!existingAttempts) {
    newAttempts = { count: 0, lastAttemptTime: now };
  } else {
    // If last attempt was 24 or more hours ago, reset the counter
    const timeSinceLastAttempt = now - existingAttempts.lastAttemptTime;
    const shouldReset = timeSinceLastAttempt >= STORED_DATA_TIMEOUT;

    newAttempts = {
      count: shouldReset ? 0 : existingAttempts.count + 1,
      lastAttemptTime: now,
    };
  }

  setLocalStorageItem(LOGIN_ATTEMPTS_KEY, JSON.stringify(newAttempts));
  return newAttempts;
};

export const clearLoginAttempts = (): void => {
  removeLocalStorageItem(LOGIN_ATTEMPTS_KEY);
};

export const getRemainingWaitTime = (): number => {
  const attempts = getLoginAttempts();
  if (!attempts) return 0;

  // Calculate wait time as 10^(n-1) seconds where n is the attempt count
  // count=0: 1s (10^0)
  // count=1: 10s (10^1)
  // count=2: 100s (10^2)
  // count=3: 1000s (10^3)
  // and so on...
  const waitTimeSeconds = Math.pow(10, attempts.count);
  const waitTimeMs = waitTimeSeconds * 1000;

  const timeSinceLastAttempt = Date.now() - attempts.lastAttemptTime;
  const remainingWaitTime = Math.max(0, waitTimeMs - timeSinceLastAttempt);

  return remainingWaitTime;
};

export const isLoginAllowed = (): boolean => {
  const remainingWaitTime = getRemainingWaitTime();
  return remainingWaitTime <= 0;
};
