import { useAtom } from 'jotai';
import { useEffect, useRef } from 'react';

import { walletStateAtom } from '@/atoms';
import { DATA_FRESHNESS_TIMEOUT } from '@/constants';

import { useRefreshData } from './useRefreshData';

export const useUpdateWalletTimer = () => {
  const timerRef = useRef<NodeJS.Timeout | null>(null);
  const { refreshData } = useRefreshData();

  const [walletState] = useAtom(walletStateAtom);

  const updateWalletAssets = () => {
    if (walletState.address) {
      console.log('Refreshing wallet assets on interval for', walletState);
      refreshData();
    }
  };

  const clearExistingTimer = () => {
    if (timerRef.current) {
      console.log('Clearing existing timer.');
      clearInterval(timerRef.current);
      timerRef.current = null;
    }
  };

  const startTimer = () => {
    clearExistingTimer();

    if (walletState.address) {
      console.log('Setting new timer to refresh wallet assets every', DATA_FRESHNESS_TIMEOUT, 'ms');
      timerRef.current = setInterval(updateWalletAssets, DATA_FRESHNESS_TIMEOUT);
    }
  };

  useEffect(() => {
    if (walletState.address !== '') {
      startTimer();
    }

    return () => {
      clearExistingTimer();
    };
  }, [walletState.address]);
};
