import { useAtom, useAtomValue } from 'jotai';
import { subscribedChainRegistryAtom, isFetchingRegistryDataAtom, userAccountAtom } from '@/atoms';
import {
  checkChainRegistryUpdate,
  shouldUpdateChainRegistry,
  fetchAndStoreChainRegistry,
  getStoredChainRegistry,
  filterChainRegistryToSubscriptions,
} from '@/helpers';
import { LOCAL_CHAIN_REGISTRY, NetworkLevel } from '@/constants';

export function useRegistryDataRefresh() {
  const [chainRegistry, setChainRegistry] = useAtom(subscribedChainRegistryAtom);
  const [isFetchingRegistry, setIsFetchingRegistry] = useAtom(isFetchingRegistryDataAtom);
  const userAccount = useAtomValue(userAccountAtom);

  const refreshRegistry = async () => {
    console.group('[Registry] Starting registry refresh process');
    console.log('[Registry] Initial state - isFetchingRegistry:', isFetchingRegistry);
    console.log('[Registry] Initial chainRegistry:', chainRegistry);
    console.log('[Registry] User account present:', !!userAccount);

    setIsFetchingRegistry(true);

    let fallbackRegistry = LOCAL_CHAIN_REGISTRY;
    console.log('[Registry] Default fallback registry set:', fallbackRegistry);

    try {
      console.log('[Registry] Attempting to get stored registry...');
      const storedRegistry = getStoredChainRegistry();
      console.log('[Registry] Stored registry found:', !!storedRegistry);

      if (storedRegistry) {
        console.group('[Registry] Processing stored registry');
        console.log('[Registry] Raw stored registry data:', storedRegistry.data);

        const filteredMainnet = userAccount
          ? filterChainRegistryToSubscriptions(
              storedRegistry.data.mainnet,
              userAccount,
              NetworkLevel.MAINNET,
            )
          : storedRegistry.data.mainnet;

        const filteredTestnet = userAccount
          ? filterChainRegistryToSubscriptions(
              storedRegistry.data.testnet,
              userAccount,
              NetworkLevel.TESTNET,
            )
          : storedRegistry.data.testnet;

        console.log(
          '[Registry] Mainnet chains after filtering:',
          Object.keys(filteredMainnet).length,
        );
        console.log(
          '[Registry] Testnet chains after filtering:',
          Object.keys(filteredTestnet).length,
        );

        fallbackRegistry = {
          mainnet: filteredMainnet,
          testnet: filteredTestnet,
        };
        console.log('[Registry] New fallback registry:', fallbackRegistry);
        console.groupEnd();
      } else {
        console.warn('[Registry] No stored registry found, using fallback LOCAL_CHAIN_REGISTRY');
      }

      console.log('[Registry] Setting initial registry state');
      setChainRegistry(fallbackRegistry);

      if (shouldUpdateChainRegistry()) {
        console.group('[Registry] Checking for registry updates');
        try {
          const needsUpdate = !storedRegistry || (await checkChainRegistryUpdate());
          console.log('Registry update needed:', needsUpdate);

          if (needsUpdate) {
            console.log('[Registry] Fetching fresh registry...');
            await fetchAndStoreChainRegistry();

            const updatedRegistry = getStoredChainRegistry();
            console.log('[Registry] Updated registry retrieved:', !!updatedRegistry);

            if (updatedRegistry) {
              console.group('[Registry] Processing updated registry');
              const filteredMainnet = userAccount
                ? filterChainRegistryToSubscriptions(
                    updatedRegistry.data.mainnet,
                    userAccount,
                    NetworkLevel.MAINNET,
                  )
                : updatedRegistry.data.mainnet;

              const filteredTestnet = userAccount
                ? filterChainRegistryToSubscriptions(
                    updatedRegistry.data.testnet,
                    userAccount,
                    NetworkLevel.TESTNET,
                  )
                : updatedRegistry.data.testnet;

              console.log('Updated mainnet chains:', Object.keys(filteredMainnet).length);
              console.log('Updated testnet chains:', Object.keys(filteredTestnet).length);

              fallbackRegistry = {
                mainnet: filteredMainnet,
                testnet: filteredTestnet,
              };

              console.log('Setting updated registry:', fallbackRegistry);
              setChainRegistry(fallbackRegistry);
              console.groupEnd();
            }
          }
        } catch (error) {
          console.error('[Registry] Error during update check:', error);
        }
        console.groupEnd();
      } else {
        console.log('[Registry] Skipping update check (shouldUpdateChainRegistry returned false)');
      }

      return fallbackRegistry;
    } catch (error) {
      console.error('[Registry] Critical error during refresh:', error);
      setChainRegistry(LOCAL_CHAIN_REGISTRY);
    } finally {
      console.log('[Registry] Final registry state:', chainRegistry);
      setIsFetchingRegistry(false);
      console.log('isFetchingRegistry set to false');
      console.groupEnd();
    }
  };

  return {
    refreshRegistry,
    isFetchingRegistry,
    subscribedChainRegistry: chainRegistry,
  };
}
