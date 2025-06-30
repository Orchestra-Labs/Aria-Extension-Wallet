import {
  symphonyAssetsAtom,
  isFetchingWalletDataAtom,
  isInitialDataLoadAtom,
  sendStateAtom,
  userAccountAtom,
  userWalletAtom,
  validatorDataAtom,
  walletAssetsAtom,
} from '@/atoms';
import {
  getWalletByID,
  checkChainRegistryUpdate,
  shouldUpdateChainRegistry,
  fetchAndStoreChainRegistry,
  ensureChainRegistryExists,
} from '@/helpers';
import { useExchangeAssets } from '@/hooks';
import { useAtom, useAtomValue, useSetAtom } from 'jotai';
import { useEffect } from 'react';

export const DataProvider: React.FC<{}> = ({}) => {
  const [walletAssets] = useAtom(walletAssetsAtom);
  const [isInitialDataLoad, setIsInitialDataLoad] = useAtom(isInitialDataLoadAtom);
  const isFetchingWalletData = useAtomValue(isFetchingWalletDataAtom);
  const validatorData = useAtomValue(validatorDataAtom);
  const isFetchingValidatorData = useAtomValue(isFetchingWalletDataAtom);
  const userAccount = useAtomValue(userAccountAtom);
  const setUserWallet = useSetAtom(userWalletAtom);

  const { availableAssets, refetch } = useExchangeAssets();
  const setExchangeAssets = useSetAtom(symphonyAssetsAtom);

  const sendState = useAtomValue(sendStateAtom);

  useEffect(() => {
    if (isInitialDataLoad) {
      const initialLoadHasCompleted =
        !isFetchingWalletData &&
        !isFetchingValidatorData &&
        (walletAssets.length > 0 || validatorData.length > 0);

      if (initialLoadHasCompleted) {
        setIsInitialDataLoad(false);
      }
    }
  }, [
    isInitialDataLoad,
    isFetchingWalletData,
    isFetchingValidatorData,
    walletAssets,
    validatorData,
  ]);

  useEffect(() => {
    if (userAccount) {
      const wallet = getWalletByID(userAccount, userAccount.settings.activeWalletID);
      if (wallet) setUserWallet(wallet);
    }
  }, [userAccount]);

  useEffect(() => {
    console.log('available assets / symphony assets set to:', availableAssets);
    setExchangeAssets(availableAssets);
  }, [availableAssets]);

  useEffect(() => {
    const fetchExchangeAssets = async () => {
      try {
        await refetch();
      } catch (error) {
        console.error('Error fetching exchange assets:', error);
      }
    };

    fetchExchangeAssets();
  }, [userAccount, sendState, walletAssets]);

  useEffect(() => {
    const maybeUpdateChainRegistry = async () => {
      if (shouldUpdateChainRegistry()) {
        const updated = await checkChainRegistryUpdate();

        if (updated) {
          console.log('[ChainRegistry] Update detected, fetching new registry...');
          await fetchAndStoreChainRegistry();
        } else {
          await ensureChainRegistryExists();
        }
      }
    };

    maybeUpdateChainRegistry();
  }, []);

  return null;
};
