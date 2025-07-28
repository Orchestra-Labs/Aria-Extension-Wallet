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
      // Check if we have valid cached data first
      const storedRegistry = getStoredChainRegistry();
      const shouldUpdate = shouldUpdateChainRegistry();
      const needsUpdate = !storedRegistry || (shouldUpdate && (await checkChainRegistryUpdate()));

      // Return cached data if no update needed
      if (storedRegistry && !needsUpdate) {
        console.log('[Registry] Using cached registry data');
        const filteredData = filterRegistryData(storedRegistry.data, userAccount);
        setFullRegistry(storedRegistry.data);
        setChainRegistry(filteredData);
        return {
          subscribedChainRegistry: filteredData,
          fullChainRegistry: storedRegistry.data,
        };
      }

      // Fetch fresh data if needed
      if (needsUpdate) {
        console.log('[Registry] Fetching fresh registry data');
        await fetchAndStoreChainRegistry();
      }

      // Get the latest data (either freshly fetched or cached)
      const latestRegistry = getStoredChainRegistry() || { data: LOCAL_CHAIN_REGISTRY };
      const filteredData = filterRegistryData(latestRegistry.data, userAccount);

      // Update state in a single batch
      setFullRegistry(latestRegistry.data);
      setChainRegistry(filteredData);

      return {
        subscribedChainRegistry: filteredData,
        fullChainRegistry: latestRegistry.data,
      };
    } catch (error) {
      console.error('[Registry] Error during refresh:', error);
      // Fallback to local registry on error
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
