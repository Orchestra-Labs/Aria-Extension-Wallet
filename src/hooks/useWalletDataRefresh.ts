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

      // Iterate through all chains in the current network level
      for (const [chainId, chainInfo] of Object.entries(currentNetworkChains)) {
        const wallet = sessionWallet.chainWallets[chainId];

        if (!wallet?.address) {
          // console.log(`[refreshWallet] No wallet address for ${chainId}, skipping`);
          continue;
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
            console.log(`[refreshWallet] Current wallet:`, sessionWallet);
            updateChainWallet({ chainId, assets });
          } else {
            console.log(`[refreshWallet] No assets found for ${chainId}`);
          }
        } catch (error) {
          console.error(`[refreshWallet] Error fetching assets for ${chainId}:`, error);
        }
      }
    } catch (error) {
      console.error('[UseWalletDataRefresh] Error:', error);
    } finally {
      setIsFetchingData(false);
    }
  };

  return { triggerWalletDataRefresh: refreshWalletAssets };
}
