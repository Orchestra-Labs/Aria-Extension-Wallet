import { useSetAtom } from 'jotai';
import { useNavigate } from 'react-router-dom';

import { isLoggedInAtom } from '@/atoms';
import { ROUTES } from '@/constants';
import { removeSessionData, resetNodeErrorCounts } from '@/helpers';

export const useLogout = () => {
  const navigate = useNavigate();
  const setIsLoggedIn = useSetAtom(isLoggedInAtom);

  const logout = () => {
    // Clear necessary data
    resetNodeErrorCounts();
    removeSessionData();

    // Update login status to trigger re-renders
    setIsLoggedIn(false);

    // Redirect to the login page
    navigate(ROUTES.AUTH.ROOT);
  };

  return logout;
};
