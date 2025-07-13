import {
  subscribedChainRegistryAtom,
  isFetchingValidatorDataAtom,
  networkLevelAtom,
  validatorDataAtom,
} from '@/atoms';
import { fetchValidatorData } from '@/helpers';
import { useAtomValue, useSetAtom } from 'jotai';
import { sessionWalletAtom } from '@/atoms/walletAtom';
import { NetworkLevel, SYMPHONY_MAINNET_ID, SYMPHONY_TESTNET_ID } from '@/constants';

export function useValidatorDataRefresh() {
  const chainRegistry = useAtomValue(subscribedChainRegistryAtom);
  const setValidatorState = useSetAtom(validatorDataAtom);
  const setIsFetchingData = useSetAtom(isFetchingValidatorDataAtom);
  const { chainWallets } = useAtomValue(sessionWalletAtom);
  const networkLevel = useAtomValue(networkLevelAtom);
  // TODO: on page load set current chain id for validators to user default, then change via button
  const chainId = networkLevel === NetworkLevel.MAINNET ? SYMPHONY_MAINNET_ID : SYMPHONY_TESTNET_ID;

  const refreshValidatorData = async () => {
    console.log(
      `[ValidatorRefresh] Starting refresh for chain: ${chainId} on network level: ${networkLevel}`,
    );
    setIsFetchingData(true);

    try {
      const wallet = chainWallets[chainId];
      if (!wallet?.address) {
        console.warn(`[ValidatorRefresh] No wallet found for chain ${chainId}`);
        setValidatorState([]);
        return;
      }

      // Get chain info based on current network level
      const chain = chainRegistry[networkLevel][chainId];
      if (!chain) {
        console.warn(`[ValidatorRefresh] No chain data for ${chainId} on ${networkLevel} network`);
        setValidatorState([]);
        return;
      }

      console.log(
        `[ValidatorRefresh] Fetching validators for ${chainId} on ${networkLevel} network`,
      );
      console.log(`[ValidatorRefresh] Using wallet address: ${wallet.address}`);

      const startTime = Date.now();
      const data = await fetchValidatorData(chainRegistry[networkLevel], chainId, wallet.address);

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
