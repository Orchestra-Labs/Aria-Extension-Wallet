import { DEFAULT_MAINNET_ASSET, DEFAULT_TESTNET_ASSET } from '@/constants';
import { Asset, AssetRegistry } from '@/types';
import { atom, WritableAtom } from 'jotai';
import { userAccountAtom } from './accountAtom';
import { networkLevelAtom } from './networkLevelAtom';
import { fullChainRegistryAtom, subscribedChainRegistryAtom } from './chainRegistryAtom';
import { sendStateAtom } from './transactionStateAtom';
import { getOsmosisChainId, getSkipSupportedAssets } from '@/helpers';
import { sessionWalletAtom } from './walletAtom';

export const showAllAssetsAtom = atom<boolean>(true);

// Helper type for writable atoms
type WriteableAtom<T> = WritableAtom<T, [T], void>;

// Private atoms to store independent values
const _selectedAssetAtom = atom<Asset | null>(null);
const _dialogSelectedAssetAtom = atom<Asset | null>(null);

export const selectedAssetAtom = atom(
  get => {
    const defaultAsset = get(defaultAssetAtom);
    const independentValue = get(_selectedAssetAtom);

    // Deep compare instead of reference check
    if (independentValue && JSON.stringify(independentValue) === JSON.stringify(defaultAsset)) {
      return independentValue;
    }
    return independentValue || defaultAsset;
  },
  (_, set, newAsset) => set(_selectedAssetAtom, newAsset as Asset),
);

export const dialogSelectedAssetAtom: WriteableAtom<Asset> = atom(
  get => {
    const defaultAsset = get(defaultAssetAtom);
    const independentValue = get(_dialogSelectedAssetAtom);
    // Use independent value if it exists, otherwise fall back to default
    return independentValue ? independentValue : defaultAsset;
  },
  (_, set, newAsset: Asset) => {
    // Only update the independent value, not the default
    set(_dialogSelectedAssetAtom, newAsset);
  },
);

export const defaultAssetAtom = atom(get => {
  const userAccount = get(userAccountAtom);
  const networkLevel = get(networkLevelAtom);
  const chainRegistry = get(subscribedChainRegistryAtom);

  // If user has a default coin denom
  if (userAccount?.settings.defaultSelections[networkLevel].defaultCoinDenom) {
    const defaultCoinDenom = userAccount?.settings.defaultSelections[networkLevel].defaultCoinDenom;
    // Try to find in chain registry
    if (userAccount?.settings.defaultSelections[networkLevel].defaultChainId) {
      const defaultChainId = userAccount?.settings.defaultSelections[networkLevel].defaultChainId;
      const chain = chainRegistry[networkLevel][defaultChainId];
      if (chain?.assets) {
        const registryAsset = Object.values(chain.assets).find(a => a.denom === defaultCoinDenom);
        if (registryAsset) {
          return {
            ...registryAsset,
            amount: '0', // Default to zero if not in wallet
            chainId: chain.chain_id,
            networkName: chain.chain_name,
          };
        }
      }
    }
  }

  // Fallback to network default
  return networkLevel === 'mainnet' ? DEFAULT_MAINNET_ASSET : DEFAULT_TESTNET_ASSET;
});

export const skipAssetsAtom = atom<AssetRegistry>({});
export const loadSkipAssetsAtom = atom(null, async (_, set) => {
  try {
    const assetRegistry = await getSkipSupportedAssets();
    set(skipAssetsAtom, assetRegistry);
  } catch (error) {
    console.error('[loadSkipAssetsAtom] Failed to load Skip assets:', error);
  }
});

// TODO: add Symphony's stablecoins
// NOTE: Pure registry assets without wallet balances (for receive context)
export const allReceivableAssetsAtom = atom(get => {
  const networkLevel = get(networkLevelAtom);
  const fullRegistry = get(fullChainRegistryAtom)[networkLevel];
  const sendState = get(sendStateAtom);
  const { chainWallets } = get(sessionWalletAtom);

  const allWalletAssets = Object.values(chainWallets).flatMap(wallet => wallet.assets);

  // Get Osmosis chain ID
  const osmosisChainId = getOsmosisChainId(networkLevel);
  const osmosisChain = fullRegistry[osmosisChainId];

  if (!osmosisChain) {
    console.error('[allReceivableAssetsAtom] Osmosis chain not found in registry');
    return [];
  }

  const finalAssets: Asset[] = [];
  const assetsBySymbol = new Map<string, Asset>();

  // 1. Always include the sending asset
  if (sendState.asset) {
    assetsBySymbol.set(sendState.asset.symbol.toLowerCase(), sendState.asset);
    finalAssets.push(sendState.asset);
  }

  // 2. Add all assets from Osmosis chain registry
  const osmosisAssets = Object.values(osmosisChain.assets || {});

  for (const osmosisAsset of osmosisAssets) {
    const symbolKey = osmosisAsset.symbol.toLowerCase();
    const existingAsset = assetsBySymbol.get(symbolKey);

    if (!existingAsset) {
      // Create asset entry for Osmosis asset
      const newAsset: Asset = {
        denom: osmosisAsset.denom,
        amount: '0', // Default to zero, will be updated if wallet has balance
        displayAmount: '0',
        exchangeRate: osmosisAsset.exchangeRate || '-',
        isIbc: osmosisAsset.isIbc || false,
        logo: osmosisAsset.logo || '',
        symbol: osmosisAsset.symbol,
        name: osmosisAsset.name,
        exponent: osmosisAsset.exponent,
        isFeeToken: osmosisAsset.isFeeToken || false,
        networkName: osmosisChain.pretty_name || osmosisChain.chain_name,
        chainId: osmosisChainId,
        coinGeckoId: osmosisAsset.coinGeckoId,
        price: osmosisAsset.price || 0,
        originDenom: osmosisAsset.originDenom || osmosisAsset.denom,
        originChainId: osmosisAsset.originChainId || osmosisChainId,
        trace: osmosisAsset.trace,
      };

      assetsBySymbol.set(symbolKey, newAsset);
      finalAssets.push(newAsset);
    }
  }

  // 3. Update with wallet balances for assets we've included
  for (const walletAsset of allWalletAssets) {
    const symbolKey = walletAsset.symbol.toLowerCase();
    const existingAsset = assetsBySymbol.get(symbolKey);

    if (existingAsset) {
      // Check if this wallet asset matches the existing asset by origin denom and chain
      const existingOriginDenom = existingAsset.originDenom || existingAsset.denom;
      const walletOriginDenom = walletAsset.originDenom || walletAsset.denom;

      // Only update if it's the same asset (same origin denom and on Osmosis chain)
      if (existingOriginDenom === walletOriginDenom && walletAsset.chainId === osmosisChainId) {
        // Update the existing asset with wallet balance and IBC info
        Object.assign(existingAsset, {
          amount: walletAsset.amount,
          displayAmount: walletAsset.displayAmount,
          isIbc: walletAsset.isIbc,
          originDenom: walletAsset.originDenom,
          originChainId: walletAsset.originChainId,
          trace: walletAsset.trace,
        });
      }
    }
  }

  return finalAssets;
});
