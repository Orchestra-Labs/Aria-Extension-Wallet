import { useAtom, useAtomValue } from 'jotai';
import { ibcRegistryAtom, isFetchingIbcDataAtom, fullChainRegistryAtom } from '@/atoms';
import { getIbcRegistry, saveIbcRegistry } from '@/helpers/dataHelpers/ibcRegistry';
import { fetchIbcRegistry, getLatestCommitHashes } from '@/helpers/fetchIbcRegistryData';
import { DATA_FRESHNESS_TIMEOUT, NetworkLevel } from '@/constants';

export function useIbcRegistryRefresh() {
  const [ibcRegistry, setIbcRegistry] = useAtom(ibcRegistryAtom);
  const [isFetching, setIsFetching] = useAtom(isFetchingIbcDataAtom);
  const chainRegistry = useAtomValue(fullChainRegistryAtom);

  const refreshIbcData = async (force = false, specificNetwork?: NetworkLevel) => {
    if (isFetching) {
      console.log('[IBC] Refresh already in progress');
      return ibcRegistry;
    }

    setIsFetching(true);
    try {
      const savedRegistry = getIbcRegistry();
      const latestCommitHashes = await getLatestCommitHashes();

      const shouldUpdate = () => {
        if (force) return true;
        if (!savedRegistry) return true;

        // Check if data is stale
        const lastUpdated = new Date(savedRegistry.lastUpdated).getTime();
        const isStale = Date.now() - lastUpdated > DATA_FRESHNESS_TIMEOUT;

        // Check if hashes match for the relevant network(s)
        let hashesMatch = true;
        if (specificNetwork) {
          hashesMatch =
            specificNetwork === NetworkLevel.MAINNET
              ? savedRegistry.commitHashes.mainnetHash === latestCommitHashes.mainnetHash
              : savedRegistry.commitHashes.testnetHash === latestCommitHashes.testnetHash;
        } else {
          hashesMatch =
            savedRegistry.commitHashes.mainnetHash === latestCommitHashes.mainnetHash &&
            savedRegistry.commitHashes.testnetHash === latestCommitHashes.testnetHash;
        }

        return isStale || !hashesMatch;
      };

      if (!shouldUpdate() && savedRegistry) {
        console.log('[IBC] Using cached data');
        setIbcRegistry(savedRegistry.data);
        return savedRegistry.data;
      }

      console.log('[IBC] Fetching fresh registry data');
      const updatedRegistry = await fetchIbcRegistry(chainRegistry, latestCommitHashes);

      saveIbcRegistry(updatedRegistry);
      setIbcRegistry(updatedRegistry.data);
      return updatedRegistry.data;
    } catch (error) {
      console.error('[IBC] Refresh failed:', error);
      const fallbackData = getIbcRegistry()?.data || { mainnet: {}, testnet: {} };
      setIbcRegistry(fallbackData);
      return fallbackData;
    } finally {
      setIsFetching(false);
      console.groupEnd();
    }
  };

  return {
    refreshIbcData,
    isFetchingIbcData: isFetching,
    ibcRegistry,
  };
}
