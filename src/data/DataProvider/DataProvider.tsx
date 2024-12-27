import {
  symphonyAssetsAtom,
  isFetchingWalletDataAtom,
  isInitialDataLoadAtom,
  sendStateAtom,
  userWalletAtom,
  validatorDataAtom,
  walletAssetsAtom,
} from '@/atoms';
import { userAccountAtom } from '@/atoms/accountAtom';
import { getWalletByID } from '@/helpers/dataHelpers/account';
import { useExchangeAssets } from '@/hooks';
import { useAtom, useAtomValue, useSetAtom } from 'jotai';
import { useEffect } from 'react';

export const DataProvider: React.FC<{}> = ({}) => {
  const [walletAssets] = useAtom(walletAssetsAtom);
  const [isInitialDataLoad, setIsInitialDataLoad] = useAtom(isInitialDataLoadAtom);
  const isFetchingWalletData = useAtomValue(isFetchingWalletDataAtom);
  const validatorState = useAtomValue(validatorDataAtom);
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
        (walletAssets.length > 0 || validatorState.length > 0);

      if (initialLoadHasCompleted) {
        setIsInitialDataLoad(false);
      }
    }
  }, [
    isInitialDataLoad,
    isFetchingWalletData,
    isFetchingValidatorData,
    walletAssets,
    validatorState,
  ]);

  useEffect(() => {
    if (userAccount) {
      const wallet = getWalletByID(userAccount, userAccount.settings.activeWalletID);
      if (wallet) setUserWallet(wallet);
    }
  }, [userAccount]);

  useEffect(() => {
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

  return null;
};
