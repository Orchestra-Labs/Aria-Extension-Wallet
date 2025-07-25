import { useAtomValue, useSetAtom } from 'jotai';
import React, { createContext, ReactNode, useContext, useEffect, useState } from 'react';

import { userAccountAtom } from '@/atoms/accountAtom';
import { isLoggedInAtom } from '@/atoms/isLoggedInAtom';
import { ScreenLoader } from '@/components';
import { getSessionToken, userCanLogIn } from '@/helpers';
import { getAccountByID } from '@/helpers/dataHelpers/account';

interface AuthContextType {
  canLogIn: boolean;
  isLoggedIn: boolean;
}

interface AuthProviderProps {
  children: ReactNode;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

// TODO: check if token is expired
// TODO: expire after given timeframe inactivity
// TODO: expire after given timeframe away from wallet (unless remember me is enabled)
export const AuthProvider: React.FC<AuthProviderProps> = ({ children }) => {
  const canLogIn = userCanLogIn();

  const isLoggedIn = useAtomValue(isLoggedInAtom);
  const setUserAccount = useSetAtom(userAccountAtom);

  const [loading, setLoading] = useState(true);

  const initializeWallet = async () => {
    if (!isLoggedIn) return;

    const sessionToken = getSessionToken();
    if (!sessionToken?.mnemonic) return;

    try {
      const accountData = getAccountByID(sessionToken.accountID);
      setUserAccount(accountData);
    } catch (error) {
      console.error('Error initializing wallet address:', error);
    }
  };

  useEffect(() => {
    initializeWallet().finally(() => {
      setLoading(false);
    });
  }, [isLoggedIn]);

  if (loading) return <ScreenLoader />;

  return <AuthContext.Provider value={{ canLogIn, isLoggedIn }}>{children}</AuthContext.Provider>;
};

export const useAuth = (): AuthContextType => {
  const context = useContext(AuthContext);
  if (!context) throw new Error('useAuth must be used within an AuthProvider');
  return context;
};
