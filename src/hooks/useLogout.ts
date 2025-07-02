import { useNavigate } from 'react-router-dom';
import { removeSessionData } from '@/helpers';
import { ROUTES } from '@/constants';
import { useSetAtom } from 'jotai';
import { isLoggedInAtom } from '@/atoms';

export const useLogout = () => {
  const navigate = useNavigate();
  const setIsLoggedIn = useSetAtom(isLoggedInAtom);

  const logout = () => {
    // Clear necessary data
    removeSessionData();

    // Update login status to trigger re-renders
    setIsLoggedIn(false);

    // Redirect to the login page
    navigate(ROUTES.AUTH.ROOT);
  };

  return logout;
};
