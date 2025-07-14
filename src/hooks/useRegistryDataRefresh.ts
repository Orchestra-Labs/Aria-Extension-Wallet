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

    const localChainRegistry = LOCAL_CHAIN_REGISTRY;
    let finalChainRegistry = localChainRegistry;
    console.log('[Registry] Default fallback registry set:', finalChainRegistry);

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

        const subscribedChainRegistry = {
          mainnet: filteredMainnet,
          testnet: filteredTestnet,
        };
        console.log('[Registry] Subscribed chain registry:', subscribedChainRegistry);
        console.groupEnd();

        finalChainRegistry = subscribedChainRegistry;
        setChainRegistry(subscribedChainRegistry);
      } else {
        console.warn('[Registry] No stored registry found, using fallback LOCAL_CHAIN_REGISTRY');
        setChainRegistry(localChainRegistry);
      }

      console.log('[Registry] Checking should update registry');
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

              finalChainRegistry = {
                mainnet: filteredMainnet,
                testnet: filteredTestnet,
              };

              console.log('Setting updated registry:', finalChainRegistry);
              setChainRegistry(finalChainRegistry);
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

      return finalChainRegistry;
    } catch (error) {
      console.error('[Registry] Critical error during refresh:', error);
      setChainRegistry(finalChainRegistry);
    } finally {
      console.log('[Registry] Final registry state:', finalChainRegistry);
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
