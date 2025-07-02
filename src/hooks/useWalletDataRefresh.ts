import {
  walletAssetsAtom,
  walletAddressAtom,
  isFetchingWalletDataAtom,
  chainRegistryAtom,
} from '@/atoms';
import { userAccountAtom } from '@/atoms/accountAtom';
import { DEFAULT_SUBSCRIPTION } from '@/constants';
import { fetchWalletAssets } from '@/helpers';
import { useAtomValue, useSetAtom } from 'jotai';

export function useWalletAssetsRefresh() {
  const setWalletAssets = useSetAtom(walletAssetsAtom);
  const setIsFetchingData = useSetAtom(isFetchingWalletDataAtom);
  const walletAddress = useAtomValue(walletAddressAtom);
  const userAccount = useAtomValue(userAccountAtom);
  const chainRegistry = useAtomValue(chainRegistryAtom);

  const refreshWalletAssets = async (address?: string) => {
    const targetAddress = address || walletAddress;
    const subscriptions =
      userAccount?.settings.subscribedTo &&
      Object.keys(userAccount.settings.subscribedTo).length > 0
        ? userAccount.settings.subscribedTo
        : DEFAULT_SUBSCRIPTION;

    // this should query for all chains with chain ID
    if (targetAddress) {
      setIsFetchingData(true);

      try {
        const allDenoms: string[] = Object.values(subscriptions).flat();
        const assetsPromises = Object.entries(subscriptions).map(([networkID]) => {
          console.log('[useWalletDataRefresh] network ID:', networkID);
          console.log('[useWalletDataRefresh] denoms:', allDenoms);
          return fetchWalletAssets(targetAddress, networkID, allDenoms, chainRegistry);
        });

        const allAssets = (await Promise.all(assetsPromises)).flat();

        setWalletAssets(allAssets);
      } catch (error) {
        console.error('Error refreshing wallet assets:', error);
      } finally {
        setIsFetchingData(false);
      }
    } else {
      console.warn('No wallet address provided for refreshing wallet assets');
    }
  };

  const triggerWalletDataRefresh = (address?: string) => {
    refreshWalletAssets(address);
  };

  return { triggerWalletDataRefresh };
}
