import { PropsWithChildren } from 'react';

import { ScreenLoader } from '@/components';
import { useInitializeWalletConnect } from '@/hooks';
import { useWalletConnectEventsManager } from '@/hooks/useWalletConnectEventsManager';

type Props = PropsWithChildren;

export const InitWalletConnectManager = ({ children }: Props) => {
  const { loading } = useInitializeWalletConnect();

  useWalletConnectEventsManager({ initialized: !loading });

  if (loading) return <ScreenLoader />;

  return children;
};
