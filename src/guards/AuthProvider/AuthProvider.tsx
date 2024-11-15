import React, { createContext, useContext, ReactNode, useEffect } from 'react';
import { getAddress, getSessionToken, userCanLogIn } from '@/helpers';
import { useAtomValue, useSetAtom } from 'jotai';
import { walletAddressAtom } from '@/atoms';
import { useRefreshData } from '@/hooks';
import { isLoggedInAtom } from '@/atoms/isLoggedInAtom';
import { getAccountByID } from '@/helpers/dataHelpers/account';
import { userAccountAtom } from '@/atoms/accountAtom';

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
  const { refreshData } = useRefreshData();

  const isLoggedIn = useAtomValue(isLoggedInAtom);
  const setWalletAddress = useSetAtom(walletAddressAtom);
  const setUserAccount = useSetAtom(userAccountAtom);

  const initializeWallet = async () => {
    const sessionToken = getSessionToken();
    if (!sessionToken?.mnemonic) {
      return;
    }

    try {
      const address = await getAddress(sessionToken.mnemonic);
      setWalletAddress(address);
      refreshData({ address });

      const accountData = getAccountByID(sessionToken.accountID);
      setUserAccount(accountData);
    } catch (error) {
      console.error('Error initializing wallet address:', error);
    }
  };

  useEffect(() => {
    if (isLoggedIn) {
      initializeWallet();
    }
  }, [isLoggedIn]);

  return <AuthContext.Provider value={{ canLogIn, isLoggedIn }}>{children}</AuthContext.Provider>;
};

export const useAuth = (): AuthContextType => {
  const context = useContext(AuthContext);
  if (!context) throw new Error('useAuth must be used within an AuthProvider');
  return context;
};
