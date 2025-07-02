import {
  symphonyAssetsAtom,
  isFetchingWalletDataAtom,
  isInitialDataLoadAtom,
  sendStateAtom,
  userAccountAtom,
  userWalletAtom,
  validatorDataAtom,
  walletAssetsAtom,
  chainRegistryAtom,
} from '@/atoms';
import { LOCAL_CHAIN_REGISTRY } from '@/constants';
import {
  getWalletByID,
  checkChainRegistryUpdate,
  shouldUpdateChainRegistry,
  fetchAndStoreChainRegistry,
  ensureChainRegistryExists,
  getStoredChainRegistry,
  filterChainRegistryToSubscriptions,
} from '@/helpers';
import { useExchangeAssets } from '@/hooks';
import { useAtom, useAtomValue, useSetAtom } from 'jotai';
import { useEffect } from 'react';

export const DataProvider: React.FC = () => {
  const [walletAssets] = useAtom(walletAssetsAtom);
  const [isInitialDataLoad, setIsInitialDataLoad] = useAtom(isInitialDataLoadAtom);
  const isFetchingWalletData = useAtomValue(isFetchingWalletDataAtom);
  const validatorData = useAtomValue(validatorDataAtom);
  const isFetchingValidatorData = useAtomValue(isFetchingWalletDataAtom);
  const userAccount = useAtomValue(userAccountAtom);
  const setUserWallet = useSetAtom(userWalletAtom);
  const setChainRegistry = useSetAtom(chainRegistryAtom);

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
    console.log('[DataProvider] available assets / symphony assets set to:', availableAssets);
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
          console.log('[DataProvider] Update detected, fetching new registry...');
          await fetchAndStoreChainRegistry();
        } else {
          await ensureChainRegistryExists();
        }
      }

      // TODO: check through both mainnet and testnet chains
      const stored = getStoredChainRegistry();
      const registry =
        userAccount && stored?.data
          ? (() => {
              const filteredChains = filterChainRegistryToSubscriptions(stored.data, userAccount);
              return Object.keys(filteredChains).length > 0 ? filteredChains : LOCAL_CHAIN_REGISTRY;
            })()
          : LOCAL_CHAIN_REGISTRY;

      console.log('[DataProvider] stored data set to:', stored?.data);
      console.log(`[DataProvider] local registry data set to: ${JSON.stringify(registry)}`);
      console.log(
        '[DataProvider] Setting saved chains to:',
        Object.keys(registry).length,
        'chains',
      );

      setChainRegistry(registry);
    };

    maybeUpdateChainRegistry();
  }, []);

  return null;
};
