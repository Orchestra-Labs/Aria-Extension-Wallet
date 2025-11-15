import { useAtom, useAtomValue } from 'jotai';
import { fullChainRegistryAtom, isFetchingIbcDataAtom } from '@/atoms';
import {
  getIbcRegistry,
  saveIbcRegistry,
  fetchIbcRegistry,
  getLatestCommitHashes,
} from '@/helpers';
import { DATA_FRESHNESS_TIMEOUT, NetworkLevel, ONE_DAY } from '@/constants';

export function useIbcRegistryRefresh() {
  const [isFetching, setIsFetching] = useAtom(isFetchingIbcDataAtom);
  const chainRegistry = useAtomValue(fullChainRegistryAtom);

  const refreshIbcData = async (force = false, specificNetwork?: NetworkLevel) => {
    if (isFetching) {
      console.log('[IBC] Refresh already in progress');
      return;
    }

    setIsFetching(true);
    try {
      const savedRegistry = getIbcRegistry();

      const shouldUpdate = () => {
        if (force) return true;
        if (!savedRegistry) return true;

        // Check if data is stale (24 hours for Orchestra, 15 seconds for GitHub)
        const lastUpdated = new Date(savedRegistry.lastUpdated).getTime();
        const timeSinceLastUpdate = Date.now() - lastUpdated;

        // If data is from Orchestra, update every 24 hours
        if (savedRegistry.commitHashes.mainnetHash === 'orchestra-registry') {
          return timeSinceLastUpdate >= ONE_DAY;
        }

        // If data is from GitHub, use freshness timeout
        const isStale = timeSinceLastUpdate > DATA_FRESHNESS_TIMEOUT;

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

      // For Orchestra source, we don't need commit hashes
      const isOrchestraSource = savedRegistry?.commitHashes?.mainnetHash === 'orchestra-registry';
      const latestCommitHashes = isOrchestraSource
        ? { mainnetHash: 'orchestra-registry', testnetHash: 'orchestra-registry' }
        : await getLatestCommitHashes();

      if (!shouldUpdate() && savedRegistry) {
        console.log('[IBC] Using cached data');
        return savedRegistry.data;
      }

      console.log('[IBC] Fetching fresh registry data');
      const updatedRegistry = await fetchIbcRegistry(chainRegistry, latestCommitHashes);

      saveIbcRegistry(updatedRegistry);
      return updatedRegistry.data;
    } catch (error) {
      console.error('[IBC] Refresh failed:', error);
      const fallbackData = getIbcRegistry()?.data || { mainnet: {}, testnet: {} };
      return fallbackData;
    } finally {
      setIsFetching(false);
    }
  };

  return {
    refreshIbcData,
    isFetchingIbcData: isFetching,
  };
}
