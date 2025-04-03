'use dom';

import { sleep } from '@walletconnect/utils';
import React, { useEffect } from 'react';

import { ScreenLoader } from '@/components';
import { ROUTES } from '@/constants';
import { useToast } from '@/hooks';
import { useInitWCSessionMutation } from '@/queries';

export const WalletConnectInitSession: React.FC = () => {
  const searchParams = new URLSearchParams(window.location.search);

  const uri = searchParams.get('uri');

  const { mutate: initWCSession } = useInitWCSessionMutation();

  const { toast } = useToast();

  const closeScreen = () => {
    window.location.replace(ROUTES.APP.ROOT);
  };

  useEffect(() => {
    if (!uri) return;
    initWCSession(
      {
        uri,
        onPairingExpired: async () => {
          toast({
            title: `Failed to connect wallet`,
            description: 'Session exired. Please try again with different QR code',
          });
          closeScreen();
        },
      },
      {
        onError: async e => {
          toast({
            title: `Failed to connect wallet`,
            description: e.message,
          });
          closeScreen();
        },
        onSuccess: async () => {
          toast({
            title: `Wallet connected successfully`,
          });
          await sleep(5000);
          closeScreen();
        },
      },
    );
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [uri]);

  return <ScreenLoader />;
};
