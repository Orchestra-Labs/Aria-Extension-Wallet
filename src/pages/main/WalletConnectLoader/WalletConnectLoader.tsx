'use dom';

import React from 'react';

import { ScreenLoader } from '@/components';

export const WalletConnectLoader: React.FC = () => {
  // TODO maybe set timeout for a 1 min, if no connection established, close the window?
  return <ScreenLoader />;
};
