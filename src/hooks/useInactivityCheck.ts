import { useEffect, useRef } from 'react';

import { INACTIVITY_TIMEOUT, RECHECK_TIMEOUT } from '@/constants';

import { useLogout } from './useLogout';

/**
 * Custom hook to handle user inactivity and automatic logout.
 */
export const useInactivityCheck = () => {
  const lastActivityTimeRef = useRef(Date.now());
  const logout = useLogout();

  useEffect(() => {
    const handleActivity = () => {
      lastActivityTimeRef.current = Date.now();
    };

    const checkInactivity = () => {
      const timeSinceLastActivity = Date.now() - lastActivityTimeRef.current;

      if (timeSinceLastActivity >= INACTIVITY_TIMEOUT) {
        logout();
      }
    };

    // Add event listeners to track user activity
    window.addEventListener('keypress', handleActivity);
    window.addEventListener('click', handleActivity);

    // Set an interval to check for inactivity
    const inactivityInterval = setInterval(() => {
      checkInactivity();
    }, RECHECK_TIMEOUT);

    return () => {
      clearInterval(inactivityInterval);
      window.removeEventListener('keypress', handleActivity);
      window.removeEventListener('click', handleActivity);
    };
  }, [logout]);
};
