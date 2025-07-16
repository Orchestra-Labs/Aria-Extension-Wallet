import { useAtom, useAtomValue, useSetAtom } from 'jotai';

import { isFetchingWalletDataAtom, walletAddressAtom, walletAssetsAtom } from '@/atoms';
import { userAccountAtom } from '@/atoms/accountAtom';
import { DEFAULT_SUBSCRIPTION } from '@/constants';
import { fetchWalletAssets } from '@/helpers';

export function useWalletAssetsRefresh() {
  const [walletAddress] = useAtom(walletAddressAtom);
  const setWalletAssets = useSetAtom(walletAssetsAtom);
  const setIsFetchingData = useSetAtom(isFetchingWalletDataAtom);
  const userAccount = useAtomValue(userAccountAtom);

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
        const assetsPromises = Object.entries(subscriptions).map(([networkID, subscription]) => {
          return fetchWalletAssets(targetAddress, networkID, subscription);
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
