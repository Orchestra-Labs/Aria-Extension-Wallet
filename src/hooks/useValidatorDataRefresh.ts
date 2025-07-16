import { useAtom, useSetAtom } from 'jotai';

import { isFetchingValidatorDataAtom, validatorDataAtom, walletAddressAtom } from '@/atoms';
import { fetchValidatorData } from '@/helpers';

export function useValidatorDataRefresh() {
  const [walletAddress] = useAtom(walletAddressAtom);
  const setValidatorState = useSetAtom(validatorDataAtom);
  const setIsFetchingData = useSetAtom(isFetchingValidatorDataAtom);

  const refreshValidatorData = async (address?: string) => {
    const targetAddress = address || walletAddress;

    if (targetAddress) {
      setIsFetchingData(true);

      try {
        const newValidatorData = await fetchValidatorData(targetAddress);
        setValidatorState(newValidatorData);
      } catch (error) {
        console.error('Error refreshing validator data:', error);
      } finally {
        setIsFetchingData(false);
      }
    }
  };

  const triggerValidatorDataRefresh = (address?: string) => {
    refreshValidatorData(address);
  };

  return { triggerValidatorDataRefresh };
}
