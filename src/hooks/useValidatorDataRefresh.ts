import {
  isFetchingValidatorDataAtom,
  validatorDataAtom,
  selectedValidatorChainAtom,
  chainInfoAtom,
  sessionWalletAtom,
} from '@/atoms';
import { fetchValidatorData } from '@/helpers';
import { useAtomValue, useSetAtom } from 'jotai';

export function useValidatorDataRefresh() {
  const setValidatorState = useSetAtom(validatorDataAtom);
  const setIsFetchingData = useSetAtom(isFetchingValidatorDataAtom);
  const { chainWallets } = useAtomValue(sessionWalletAtom);
  const getChainInfo = useAtomValue(chainInfoAtom);
  const chainId = useAtomValue(selectedValidatorChainAtom);

  const refreshValidatorData = async () => {
    setIsFetchingData(true);

    try {
      const wallet = chainWallets[chainId];
      if (!wallet?.address) {
        console.warn(`[ValidatorRefresh] No wallet found for chain ${chainId}`);
        setValidatorState([]);
        return;
      }

      const chain = getChainInfo(chainId);
      if (!chain) {
        setValidatorState([]);
        return;
      }

      console.log(`[ValidatorRefresh] Using wallet address: ${wallet.address}`);

      const startTime = Date.now();
      const data = await fetchValidatorData({ chain, delegatorAddress: wallet.address });

      console.log(
        `[ValidatorRefresh] Completed fetch for ${chainId} in ${Date.now() - startTime}ms`,
      );
      console.log(`[ValidatorRefresh] Received ${data.length} validators`);

      // Add chain ID to each validator record
      const dataWithChainId = data.map(validator => ({
        ...validator,
        chainId,
      }));

      setValidatorState(dataWithChainId);
      console.log(`[ValidatorRefresh] Updated validator state for chain ${chainId}`);
    } catch (error) {
      console.error(
        `[ValidatorRefresh] Error refreshing validator data for chain ${chainId}:`,
        error,
      );
      setValidatorState([]);
    } finally {
      setIsFetchingData(false);
      console.log(`[ValidatorRefresh] Finished refresh for chain ${chainId}`);
    }
  };

  return { triggerValidatorDataRefresh: refreshValidatorData };
}
