import {
  isFetchingWalletDataAtom,
  subscribedChainRegistryAtom,
  networkLevelAtom,
  fullChainRegistryAtom,
} from '@/atoms';
import { fetchWalletAssets } from '@/helpers';
import { useAtomValue, useSetAtom } from 'jotai';
import { sessionWalletAtom, updateChainWalletAtom } from '@/atoms/walletAtom';
import { userAccountAtom } from '@/atoms';

export function useWalletDataRefresh() {
  const setIsFetchingData = useSetAtom(isFetchingWalletDataAtom);
  const fullChainRegistry = useAtomValue(fullChainRegistryAtom);
  const chainRegistry = useAtomValue(subscribedChainRegistryAtom);
  const updateChainWallet = useSetAtom(updateChainWalletAtom);
  const networkLevel = useAtomValue(networkLevelAtom);
  const userAccount = useAtomValue(userAccountAtom);
  const sessionWallet = useAtomValue(sessionWalletAtom);

  const refreshWalletAssets = async () => {
    setIsFetchingData(true);

    try {
      if (!userAccount || !sessionWallet || Object.keys(sessionWallet.chainWallets).length === 0) {
        console.warn('[refreshWallet] Cannot refresh - missing user account or session wallet');
        return;
      }

      const hasAddresses = Object.values(sessionWallet.chainWallets).some(w => w.address);
      if (!hasAddresses) {
        console.warn('[refreshWallet] Cannot refresh - no wallet addresses available');
        return;
      }

      // Get all chains for the current network level
      const currentNetworkChains = chainRegistry[networkLevel];
      const chainSubscriptions = userAccount.settings.chainSubscriptions;
      const networkSubscriptions = userAccount.settings.chainSubscriptions[networkLevel];

      console.log(
        `[refreshWallet] Refreshing for ${networkLevel} chains:`,
        Object.keys(currentNetworkChains),
      );

      // Fetch all chain assets concurrently for better performance
      const fetchPromises = Object.entries(currentNetworkChains).map(async ([chainId, chainInfo]) => {
        const wallet = sessionWallet.chainWallets[chainId];

        if (!wallet?.address) {
          // console.log(`[refreshWallet] No wallet address for ${chainId}, skipping`);
          return null;
        }

        // Get subscribed denoms for this chain
        const subscribedDenoms = networkSubscriptions[chainId] || [];
        console.log(`[refreshWallet] Subscribed denoms for ${chainId}:`, subscribedDenoms);

        console.log(`[refreshWallet] Fetching assets for ${chainId}`);
        console.log(`[refreshWallet] Chain details:`, {
          bech32_prefix: chainInfo.bech32_prefix,
          rest_uris: chainInfo.rest_uris,
          assets: Object.keys(chainInfo.assets || {}),
        });

        try {
          const assets = await fetchWalletAssets(
            wallet.address,
            chainId,
            chainSubscriptions,
            currentNetworkChains,
            fullChainRegistry[networkLevel],
          );

          if (assets.length > 0) {
            console.log(`[refreshWallet] Found assets for ${chainId}:`, assets);
            return { chainId, assets };
          } else {
            console.log(`[refreshWallet] No assets found for ${chainId}`);
            return null;
          }
        } catch (error) {
          console.error(`[refreshWallet] Error fetching assets for ${chainId}:`, error);
          return null;
        }
      });

      // Wait for all fetches to complete
      const results = await Promise.all(fetchPromises);

      // Update wallets with fetched assets
      results.forEach(result => {
        if (result && result.assets.length > 0) {
          console.log(`[refreshWallet] Updating wallet for ${result.chainId}`);
          console.log(`[refreshWallet] Current wallet:`, sessionWallet);
          updateChainWallet({ chainId: result.chainId, assets: result.assets });
        }
      });
    } catch (error) {
      console.error('[UseWalletDataRefresh] Error:', error);
    } finally {
      setIsFetchingData(false);
    }
  };

  return { triggerWalletDataRefresh: refreshWalletAssets };
}
