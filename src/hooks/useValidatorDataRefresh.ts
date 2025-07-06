import { chainRegistryAtom, isFetchingValidatorDataAtom, validatorDataAtom } from '@/atoms';
import { fetchValidatorData } from '@/helpers';
import { useAtomValue, useSetAtom } from 'jotai';
import { sessionWalletAtom } from '@/atoms/walletAtom';

export function useValidatorDataRefresh() {
  const chainRegistry = useAtomValue(chainRegistryAtom);
  const setValidatorState = useSetAtom(validatorDataAtom);
  const setIsFetchingData = useSetAtom(isFetchingValidatorDataAtom);
  const { chainWallets } = useAtomValue(sessionWalletAtom);

  const refreshValidatorData = async () => {
    setIsFetchingData(true);
    const allValidatorData = [];

    try {
      for (const [chainId, wallet] of Object.entries(chainWallets)) {
        if (!wallet.address) continue;

        const chain = chainRegistry.mainnet[chainId] || chainRegistry.testnet[chainId];
        if (!chain) {
          console.warn(`[ValidatorDataRefresh] No chain data for ${chainId}, skipping`);
          continue;
        }

        console.log(`[ValidatorRefresh] Fetching validators for ${chainId}`);
        const data = await fetchValidatorData(
          { ...chainRegistry.mainnet, ...chainRegistry.testnet },
          chainId,
          wallet.address,
        );
        allValidatorData.push(...data);
      }

      setValidatorState(allValidatorData);
    } catch (error) {
      console.error('Error refreshing validator data:', error);
    } finally {
      setIsFetchingData(false);
    }
  };

  return { triggerValidatorDataRefresh: refreshValidatorData };
}
