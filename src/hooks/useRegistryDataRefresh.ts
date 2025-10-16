import { useAtom, useAtomValue } from 'jotai';
import {
  subscribedChainRegistryAtom,
  isFetchingRegistryDataAtom,
  userAccountAtom,
  fullChainRegistryAtom,
} from '@/atoms';
import {
  checkChainRegistryUpdate,
  shouldUpdateChainRegistry,
  fetchAndStoreChainRegistry,
  getStoredChainRegistry,
  filterChainRegistryToSubscriptions,
} from '@/helpers';
import { LOCAL_CHAIN_REGISTRY, NetworkLevel } from '@/constants';
import { ChainRegistryData } from '@/types';

export function useRegistryDataRefresh() {
  const [chainRegistry, setChainRegistry] = useAtom(subscribedChainRegistryAtom);
  const [fullRegistry, setFullRegistry] = useAtom(fullChainRegistryAtom);
  const [isFetchingRegistry, setIsFetchingRegistry] = useAtom(isFetchingRegistryDataAtom);
  const userAccount = useAtomValue(userAccountAtom);

  const refreshRegistry = async () => {
    if (isFetchingRegistry) {
      console.log('[Registry] Refresh already in progress, skipping');
      return { subscribedChainRegistry: chainRegistry, fullChainRegistry: fullRegistry };
    }

    console.group('[Registry] Starting registry refresh process');
    setIsFetchingRegistry(true);

    try {
      // Check if stored data exists
      const storedRegistry = getStoredChainRegistry();

      // If data exists in local storage, use it immediately
      if (storedRegistry && Object.keys(storedRegistry.data.mainnet).length > 0) {
        console.log('[Registry] Using registry data from local storage');
        const filteredData = filterRegistryData(storedRegistry.data, userAccount);
        console.log('[fetchWalletAssets] setting registry to:', filteredData);
        setFullRegistry(storedRegistry.data);
        setChainRegistry(filteredData);

        // Check for updates in the background without blocking the UI
        const shouldUpdate = shouldUpdateChainRegistry();
        if (shouldUpdate) {
          console.log('[Registry] Checking for registry updates in background...');
          checkChainRegistryUpdate().then(needsUpdate => {
            if (needsUpdate) {
              console.log('[Registry] Update available, fetching fresh data...');
              fetchAndStoreChainRegistry()
                .then(() => {
                  // Update with fresh data when available
                  const freshRegistry = getStoredChainRegistry();
                  if (freshRegistry) {
                    const freshFilteredData = filterRegistryData(freshRegistry.data, userAccount);
                    setFullRegistry(freshRegistry.data);
                    setChainRegistry(freshFilteredData);
                  }
                })
                .catch(error => {
                  console.error('[Registry] Background update failed:', error);
                });
            }
          });
        }

        return {
          subscribedChainRegistry: filteredData,
          fullChainRegistry: storedRegistry.data,
        };
      }

      // Only use local registry if local storage is completely empty
      console.log('[Registry] No data in local storage, checking for updates...');
      const shouldUpdate = shouldUpdateChainRegistry();
      const needsUpdate = !storedRegistry || (shouldUpdate && (await checkChainRegistryUpdate()));

      if (needsUpdate) {
        console.log('[Registry] Fetching fresh registry data');
        await fetchAndStoreChainRegistry();
      }

      // Get the latest data (either freshly fetched or from storage if it now exists)
      const latestStoredRegistry = getStoredChainRegistry();

      if (latestStoredRegistry && Object.keys(latestStoredRegistry.data.mainnet).length > 0) {
        console.log('[Registry] Using updated registry data from local storage');
        const filteredData = filterRegistryData(latestStoredRegistry.data, userAccount);
        setFullRegistry(latestStoredRegistry.data);
        setChainRegistry(filteredData);

        return {
          subscribedChainRegistry: filteredData,
          fullChainRegistry: latestStoredRegistry.data,
        };
      }

      // Final fallback: only use local registry if everything else fails
      console.warn('[Registry] No registry data available, falling back to local registry');
      const filteredData = filterRegistryData(LOCAL_CHAIN_REGISTRY, userAccount);
      setFullRegistry(LOCAL_CHAIN_REGISTRY);
      setChainRegistry(filteredData);
      return {
        subscribedChainRegistry: filteredData,
        fullChainRegistry: LOCAL_CHAIN_REGISTRY,
      };
    } catch (error) {
      console.error('[Registry] Error during refresh:', error);

      // Only fallback to local registry if we have no stored data
      const storedRegistry = getStoredChainRegistry();
      if (storedRegistry && Object.keys(storedRegistry.data.mainnet).length > 0) {
        console.log('[Registry] Using stored registry data after error');
        const filteredData = filterRegistryData(storedRegistry.data, userAccount);
        setFullRegistry(storedRegistry.data);
        setChainRegistry(filteredData);
        return {
          subscribedChainRegistry: filteredData,
          fullChainRegistry: storedRegistry.data,
        };
      }

      // Last resort: use local registry
      console.warn('[Registry] Falling back to local registry after error');
      const filteredData = filterRegistryData(LOCAL_CHAIN_REGISTRY, userAccount);
      setFullRegistry(LOCAL_CHAIN_REGISTRY);
      setChainRegistry(filteredData);
      return {
        subscribedChainRegistry: filteredData,
        fullChainRegistry: LOCAL_CHAIN_REGISTRY,
      };
    } finally {
      setIsFetchingRegistry(false);
      console.groupEnd();
    }
  };

  // Helper function to filter registry data
  const filterRegistryData = (registryData: ChainRegistryData, userAccount: any) => {
    return {
      mainnet: userAccount
        ? filterChainRegistryToSubscriptions(
            registryData.mainnet,
            userAccount,
            NetworkLevel.MAINNET,
          )
        : registryData.mainnet,
      testnet: userAccount
        ? filterChainRegistryToSubscriptions(
            registryData.testnet,
            userAccount,
            NetworkLevel.TESTNET,
          )
        : registryData.testnet,
    };
  };

  return {
    refreshRegistry,
    isFetchingRegistry,
    subscribedChainRegistry: chainRegistry,
    fullChainRegistry: fullRegistry,
  };
}
