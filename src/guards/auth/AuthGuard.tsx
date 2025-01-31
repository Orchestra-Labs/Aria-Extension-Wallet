import { useAtom } from 'jotai';
import React from 'react';
import { Navigate } from 'react-router-dom';

import { walletAddressAtom } from '@/atoms';
import { ROUTES } from '@/constants';

import { useAuth } from '../AuthProvider';

interface AuthGuardProps {
  children?: React.ReactNode;
}

export const AuthGuard = ({ children }: AuthGuardProps) => {
  const { canLogIn, isLoggedIn } = useAuth();
  const [walletAddress] = useAtom(walletAddressAtom);

  if (!canLogIn) return <Navigate to={ROUTES.AUTH.NEW_WALLET.ROOT} />;
  if (!isLoggedIn) return <Navigate to={ROUTES.AUTH.ROOT} />;

  if (!walletAddress) {
    return <Navigate to={ROUTES.AUTH.ROOT} />;
  }

  return children;
};
