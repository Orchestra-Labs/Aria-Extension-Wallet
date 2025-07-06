import { isFetchingWalletDataAtom, chainRegistryAtom, networkLevelAtom } from '@/atoms';
import { fetchWalletAssets } from '@/helpers';
import { useAtomValue, useSetAtom } from 'jotai';
import { Wallet } from '@/types';
import { sessionWalletAtom, updateChainWalletAtom } from '@/atoms/walletAtom';

export function useWalletDataRefresh() {
  const setIsFetchingData = useSetAtom(isFetchingWalletDataAtom);
  const chainRegistry = useAtomValue(chainRegistryAtom);
  const updateChainWallet = useSetAtom(updateChainWalletAtom);
  const networkLevel = useAtomValue(networkLevelAtom);

  const sessionWallet = useAtomValue(sessionWalletAtom) as {
    name: string;
    encryptedMnemonic: string;
    chainWallets: Record<string, Wallet>;
  };

  const refreshWalletAssets = async () => {
    setIsFetchingData(true);

    try {
      console.log(
        `[refreshWallet] Refreshing for ${networkLevel} chains:`,
        Object.keys(chainRegistry[networkLevel]),
      );

      for (const [chainId, wallet] of Object.entries(sessionWallet.chainWallets)) {
        console.log(`[refreshWallet] Checking wallet for ${chainId}`);
        if (!wallet?.address) {
          console.log(`[refreshWallet] No address for ${chainId}, skipping`);
          continue;
        }

        const chainInfo = chainRegistry[networkLevel][chainId];
        if (!chainInfo) {
          console.warn(`[refreshWallet] No chain info for ${chainId}`);
          continue;
        }

        console.log(`[refreshWallet] Fetching assets for ${chainId}`);
        console.log(`[refreshWallet] Chain details:`, {
          bech32_prefix: chainInfo.bech32_prefix,
          rest_uris: chainInfo.rest_uris,
          assets: Object.keys(chainInfo.assets || {}),
        });

        const assets = await fetchWalletAssets(
          wallet.address,
          chainId,
          [],
          chainRegistry[networkLevel],
        );

        if (assets.length > 0) {
          console.log(`[refreshWallet] Found assets for ${chainId}:`, assets);
          updateChainWallet({ chainId, assets });
        } else {
          console.warn(`[refreshWallet] No assets found for ${chainId}`);
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
