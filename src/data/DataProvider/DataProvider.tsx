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
  sessionWalletAtom,
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
  const chainWallets = useAtomValue(sessionWalletAtom);
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

    const hasAllAddresses = Object.keys(userAccount?.settings.subscribedTo || {}).every(
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
      // 1. First try to get the stored registry
      let storedRegistry = getStoredChainRegistry();
      let registryToUse = LOCAL_CHAIN_REGISTRY; // Default to local

      // 2. If we have a stored registry, use it (filtered by subscriptions)
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

      // Set the initial registry (either stored or local)
      setChainRegistry(registryToUse);

      // 3. Check if we need to update (either no stored registry or it's stale)
      if (shouldUpdateChainRegistry()) {
        try {
          console.log('[DataProvider] Checking for registry updates...');
          const needsUpdate = !storedRegistry || (await checkChainRegistryUpdate());

          if (needsUpdate) {
            console.log('[DataProvider] Update needed, fetching fresh data...');
            await fetchAndStoreChainRegistry();

            // After successful update, get the new registry
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
          // Continue with whatever registry we already have
        }
      }

      return registryToUse;
    };

    const setWalletAddresses = async () => {
      const sessionToken = getSessionToken();
      if (!sessionToken?.mnemonic || !userAccount) return;

      const mnemonic = sessionToken.mnemonic;
      const chainPrefixes: Record<string, string> = {};
      for (const chainId of Object.keys(userAccount.settings.subscribedTo)) {
        const chainInfo = chainRegistry.mainnet[chainId] || chainRegistry.testnet[chainId];
        if (chainInfo?.bech32_prefix) {
          chainPrefixes[chainId] = chainInfo.bech32_prefix;
        }
      }

      const addressMap = await getAddressesByChainPrefix(
        mnemonic,
        userAccount.settings.subscribedTo,
        chainPrefixes,
      );
      console.log('[DataProvider] Received addresses:', addressMap);

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
    console.log('[DataProvider] User subscriptions:', userAccount.settings.subscribedTo);

    const subscribedAssets: Asset[] = [];
    const currentChains = chainRegistry[networkLevel];
    const existingAssets = new Map(walletAssets.map(asset => [asset.denom, asset]));
    console.log('[DataProvider] Current wallet assets shown to be:', existingAssets);

    for (const [networkID, denoms] of Object.entries(userAccount.settings.subscribedTo)) {
      const chainRecord = currentChains[networkID];
      if (!chainRecord) {
        console.log(`[DataProvider] ${networkID} not found in ${networkLevel}, skipping`);
        continue;
      }

      const chainAssets = Object.values(chainRecord.assets || {});
      const walletAssetsForChain = chainWallets.chainWallets[networkID]?.assets || [];

      console.log(
        `[DataProvider] Processing ${networkID} with ${walletAssetsForChain.length} wallet assets`,
      );

      chainAssets.forEach(asset => {
        if (denoms.includes(asset.denom)) {
          const matched = walletAssetsForChain.find(a => a.denom === asset.denom);
          subscribedAssets.push({
            ...asset,
            amount: matched?.amount || '0', // Use wallet balance if available
            networkID: chainRecord.chain_id,
            networkName: chainRecord.chain_name,
          });
        }
      });
    }

    console.log('[DataProvider] Final subscribed assets:', subscribedAssets);
    setExchangeAssets(subscribedAssets);
  }, [chainRegistry, networkLevel]);

  return null;
};
