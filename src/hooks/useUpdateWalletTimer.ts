import { useEffect, useRef } from 'react';
import { useAtomValue } from 'jotai';
import { DATA_FRESHNESS_TIMEOUT } from '@/constants';
import { useRefreshData } from './useRefreshData';
import { sessionWalletAtom } from '@/atoms';

export const useUpdateWalletTimer = () => {
  const timerRef = useRef<NodeJS.Timeout | null>(null);
  const { refreshData } = useRefreshData();
  const sessionWallet = useAtomValue(sessionWalletAtom);

  const hasAnyWallets = Object.values(sessionWallet.chainWallets).some(wallet => !!wallet.address);

  const updateWalletAssets = () => {
    if (hasAnyWallets) {
      console.log('Refreshing wallet assets on interval');
      refreshData({ wallet: true, validator: true });
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

    if (hasAnyWallets) {
      console.log('Setting new timer to refresh wallet assets every', DATA_FRESHNESS_TIMEOUT, 'ms');
      timerRef.current = setInterval(updateWalletAssets, DATA_FRESHNESS_TIMEOUT);
    }
  };

  useEffect(() => {
    if (hasAnyWallets) {
      startTimer();
    }

    return () => {
      clearExistingTimer();
    };
  }, [sessionWallet]);
};
