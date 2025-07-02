import {
  chainRegistryAtom,
  isFetchingValidatorDataAtom,
  validatorDataAtom,
  walletAddressAtom,
} from '@/atoms';
import { DEFAULT_CHAIN_ID } from '@/constants';
import { fetchValidatorData } from '@/helpers';
import { useAtom, useAtomValue, useSetAtom } from 'jotai';

export function useValidatorDataRefresh() {
  const [walletAddress] = useAtom(walletAddressAtom);
  const setValidatorState = useSetAtom(validatorDataAtom);
  const setIsFetchingData = useSetAtom(isFetchingValidatorDataAtom);
  const chainRegistry = useAtomValue(chainRegistryAtom);

  const refreshValidatorData = async (address?: string) => {
    const targetAddress = address || walletAddress;

    if (targetAddress) {
      setIsFetchingData(true);

      try {
        const newValidatorData = await fetchValidatorData(
          chainRegistry,
          DEFAULT_CHAIN_ID,
          targetAddress,
        );
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
