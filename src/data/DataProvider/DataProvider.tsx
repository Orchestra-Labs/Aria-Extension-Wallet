import {
  symphonyAssetsAtom,
  isFetchingWalletDataAtom,
  isInitialDataLoadAtom,
  sendStateAtom,
  userAccountAtom,
  validatorDataAtom,
  chainRegistryAtom,
  allWalletAssetsAtom,
  isFetchingValidatorDataAtom,
  updateChainWalletAtom,
  walletAddressesAtom,
  networkLevelAtom,
} from '@/atoms';

import { LOCAL_CHAIN_REGISTRY } from '@/constants';
import {
  checkChainRegistryUpdate,
  shouldUpdateChainRegistry,
  fetchAndStoreChainRegistry,
  getStoredChainRegistry,
  filterChainRegistryToSubscriptions,
  getSessionToken,
  getAddressesByChainPrefix,
} from '@/helpers';

import { useExchangeAssets, useRefreshData } from '@/hooks';
import { Asset } from '@/types';
import { useAtom, useAtomValue, useSetAtom } from 'jotai';
import { useEffect } from 'react';

export const DataProvider: React.FC = () => {
  const { refreshData } = useRefreshData();
  const { refetch } = useExchangeAssets();

  const [isInitialDataLoad, setIsInitialDataLoad] = useAtom(isInitialDataLoadAtom);
  const [chainRegistry, setChainRegistry] = useAtom(chainRegistryAtom);
  const updateChainWallet = useSetAtom(updateChainWalletAtom);
  const setExchangeAssets = useSetAtom(symphonyAssetsAtom);
  const isFetchingWalletData = useAtomValue(isFetchingWalletDataAtom);
  const isFetchingValidatorData = useAtomValue(isFetchingValidatorDataAtom);
  const validatorData = useAtomValue(validatorDataAtom);
  const userAccount = useAtomValue(userAccountAtom);
  const sendState = useAtomValue(sendStateAtom);
  const networkLevel = useAtomValue(networkLevelAtom);
  const walletAssets = useAtomValue(allWalletAssetsAtom);
  const walletAddresses = useAtomValue(walletAddressesAtom);

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
    const initData = async () => {
      console.log('[DataProvider] Triggering data refresh after address update');
      refreshData();
    };

    const hasAllAddresses = Object.keys(userAccount?.settings.chainSubscriptions || {}).every(
      chainId => walletAddresses[chainId],
    );
    console.log('[DataProvider] Wallet has addresses?', hasAllAddresses);
    const hasRegistryData = Object.keys(chainRegistry.mainnet).length > 0;
    console.log('[DataProvider] Wallet has registryData?', hasRegistryData);

    if (hasAllAddresses && hasRegistryData && isInitialDataLoad) {
      initData();
    }
  }, [walletAddresses]);

  useEffect(() => {
    // TODO: save IBC data for testnet and mainnet chains
    const updateChainRegistry = async () => {
      let storedRegistry = getStoredChainRegistry();
      let registryToUse = LOCAL_CHAIN_REGISTRY;

      if (storedRegistry) {
        console.log('[DataProvider] Using stored registry data');

        const filteredMainnet = userAccount
          ? filterChainRegistryToSubscriptions(storedRegistry.data.mainnet, userAccount)
          : storedRegistry.data.mainnet;

        const filteredTestnet = userAccount
          ? filterChainRegistryToSubscriptions(storedRegistry.data.testnet, userAccount)
          : storedRegistry.data.testnet;

        registryToUse = {
          mainnet: filteredMainnet,
          testnet: filteredTestnet,
        };
      } else {
        console.log('[DataProvider] No stored registry found, using LOCAL_CHAIN_REGISTRY');
      }

      setChainRegistry(registryToUse);

      if (shouldUpdateChainRegistry()) {
        try {
          console.log('[DataProvider] Checking for registry updates...');
          const needsUpdate = !storedRegistry || (await checkChainRegistryUpdate());

          if (needsUpdate) {
            console.log('[DataProvider] Update needed, fetching fresh data...');
            await fetchAndStoreChainRegistry();

            const updatedRegistry = getStoredChainRegistry();
            if (updatedRegistry) {
              console.log('[DataProvider] Using updated registry data');

              const filteredMainnet = userAccount
                ? filterChainRegistryToSubscriptions(updatedRegistry.data.mainnet, userAccount)
                : updatedRegistry.data.mainnet;

              const filteredTestnet = userAccount
                ? filterChainRegistryToSubscriptions(updatedRegistry.data.testnet, userAccount)
                : updatedRegistry.data.testnet;

              registryToUse = {
                mainnet: filteredMainnet,
                testnet: filteredTestnet,
              };

              setChainRegistry(registryToUse);
            }
          }
        } catch (error) {
          console.error('[DataProvider] Error updating registry:', error);
        }
      }

      return registryToUse;
    };

    const setWalletAddresses = async () => {
      const sessionToken = getSessionToken();
      if (!sessionToken?.mnemonic || !userAccount) return;

      const mnemonic = sessionToken.mnemonic;
      const chainPrefixes: Record<string, string> = {};
      for (const chainId of Object.keys(userAccount.settings.chainSubscriptions)) {
        const chainInfo = chainRegistry.mainnet[chainId] || chainRegistry.testnet[chainId];
        if (chainInfo?.bech32_prefix) {
          chainPrefixes[chainId] = chainInfo.bech32_prefix;
        }
      }

      const addressMap = await getAddressesByChainPrefix(
        mnemonic,
        userAccount.settings.chainSubscriptions,
        chainPrefixes,
      );
      console.log('[DataProvider] Received addresses:', JSON.stringify(addressMap));

      const updates = Object.entries(addressMap).map(([chainId, address]) => {
        return updateChainWallet({ chainId, address });
      });
      await Promise.all(updates);
    };

    const sync = async () => {
      await updateChainRegistry();
      await setWalletAddresses();
    };

    if (userAccount) {
      sync();
    }
  }, [userAccount]);

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
    if (!userAccount) return;

    console.log('[DataProvider] Building assets for network level:', networkLevel);
    console.log('[DataProvider] Wallet assets shown to be:', walletAssets);
    console.log('[DataProvider] Full chain registry:', chainRegistry);
    console.log('[DataProvider] User subscriptions:', userAccount.settings.chainSubscriptions);

    const subscribedAssets: Asset[] = [];

    for (const asset of walletAssets) {
      const chainSubscriptions = userAccount.settings.chainSubscriptions[asset.networkID] || [];
      console.log('[DataProvider] Checking subscriptions for:', asset.denom);
      if (chainSubscriptions.includes(asset.denom)) {
        subscribedAssets.push(asset);
      }
    }

    console.log('[DataProvider] Final subscribed assets:', subscribedAssets);
    setExchangeAssets(subscribedAssets);
  }, [chainRegistry, networkLevel]);

  useEffect(() => {
    if (!userAccount) return;

    refreshData();
  }, [networkLevel]);

  return null;
};
