import { DEFAULT_MAINNET_ASSET, DEFAULT_TESTNET_ASSET } from '@/constants';
import { Asset, AssetRegistry, SimplifiedChainInfo } from '@/types';
import { atom, WritableAtom } from 'jotai';
import { userAccountAtom } from './accountAtom';
import { networkLevelAtom } from './networkLevelAtom';
import {
  chainInfoAtom,
  fullChainRegistryAtom,
  skipChainsAtom,
  subscribedChainRegistryAtom,
} from './chainRegistryAtom';
import { receiveStateAtom } from './transactionStateAtom';
import { getSkipSupportedAssets } from '@/helpers';
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
  const subscribedRegistry = get(subscribedChainRegistryAtom)[networkLevel];
  const skipChains = get(skipChainsAtom);
  const receiveState = get(receiveStateAtom);
  const getChainInfo = get(chainInfoAtom);
  const { chainWallets } = get(sessionWalletAtom);

  const receiveChainId = receiveState.chainId;
  const receiveChain = getChainInfo(receiveChainId);
  const allWalletAssets = Object.values(chainWallets).flatMap(wallet => wallet.assets);

  // Create a map of wallet assets by denom for quick lookup
  const walletAssetsByDenom = new Map<string, Asset>();
  for (const walletAsset of allWalletAssets) {
    walletAssetsByDenom.set(walletAsset.denom, walletAsset);
    if (walletAsset.originDenom) {
      walletAssetsByDenom.set(walletAsset.originDenom, walletAsset);
    }
  }

  const assetsByDenom = new Map<string, Asset>();
  const assetsBySymbol = new Map<string, Asset>();
  let finalAssets: Asset[] = [];

  const subscribedChainIds = new Set(Object.keys(subscribedRegistry));

  // Process all chains in the full registry
  const createAssetEntry = (asset: any, chainInfo: SimplifiedChainInfo): Asset => {
    // Try to find matching wallet asset to enhance with IBC info
    const walletAsset =
      walletAssetsByDenom.get(asset.denom) || walletAssetsByDenom.get(asset.originDenom || '');

    return {
      denom: asset.denom,
      amount: '0',
      exchangeRate: asset.exchangeRate || '-',
      isIbc: walletAsset?.isIbc || false,
      logo: asset.logo,
      symbol: asset.symbol,
      name: asset.name,
      exponent: asset.exponent,
      isFeeToken: asset.isFeeToken,
      networkName: receiveChain.chain_name,
      chainId: receiveChain.chain_id,
      coinGeckoId: asset.coinGeckoId,
      price: asset.price || 0,
      originDenom: walletAsset?.originDenom || asset.originDenom || asset.denom,
      originChainId: walletAsset?.originChainId || asset.originChainId || chainInfo.chain_id,
      trace: walletAsset?.trace || asset.trace,
    };
  };

  for (const [chainId, chainInfo] of Object.entries(fullRegistry)) {
    const isSkipSupportedChain = skipChains.includes(chainId);
    const isSubscribed = subscribedChainIds.has(chainId);

    if (!isSkipSupportedChain && !isSubscribed) {
      console.log('[allReceivableAssetsAtom] Skipping - neither Skip-supported nor subscribed');
      continue;
    }

    const chainAssets = Object.values(chainInfo.assets || {});
    for (const asset of chainAssets) {
      const assetDenom = asset.originDenom || asset.denom;
      const existingByDenom = assetsByDenom.get(assetDenom);
      const existingBySymbol = assetsBySymbol.get(asset.symbol);
      const isPreferredDenom = assetDenom === `u${asset.symbol.toLowerCase()}`;

      // Case 1: Neither denom nor symbol exists yet
      if (!existingByDenom && !existingBySymbol) {
        const newAsset = createAssetEntry(asset, chainInfo);
        assetsByDenom.set(assetDenom, newAsset);
        assetsBySymbol.set(asset.symbol, newAsset);
        finalAssets.push(newAsset);
      }
      // Case 2: Only denom exists, but symbol is new
      else if (existingByDenom && !existingBySymbol) {
        // Keep the existing denom entry, but add this symbol
        assetsBySymbol.set(asset.symbol, existingByDenom);
      }
      // Case 3: Only symbol exists, but denom is new
      else if (!existingByDenom && existingBySymbol) {
        // Replace if this is a preferred denom format
        if (isPreferredDenom) {
          // Remove old symbol entry
          const oldAsset = existingBySymbol;
          assetsBySymbol.delete(oldAsset.symbol);
          finalAssets = finalAssets.filter(
            a => (a.originDenom || a.denom) !== (oldAsset.originDenom || oldAsset.denom),
          );

          // Add new preferred asset
          const newAsset = createAssetEntry(asset, chainInfo);
          assetsByDenom.set(assetDenom, newAsset);
          assetsBySymbol.set(asset.symbol, newAsset);
          finalAssets.push(newAsset);
        }
      }
      // Case 4: Both denom and symbol exist (conflict)
      else {
        // Prefer the u[symbol] format if this asset has it
        if (isPreferredDenom) {
          // Remove old entries
          const oldDenomAsset = existingByDenom;
          const oldSymbolAsset = existingBySymbol;

          if (!oldDenomAsset || !oldSymbolAsset) continue;

          assetsByDenom.delete(oldDenomAsset.originDenom || oldDenomAsset.denom);
          assetsBySymbol.delete(oldSymbolAsset.symbol);
          finalAssets = finalAssets.filter(
            a =>
              (a.originDenom || a.denom) !== (oldDenomAsset.originDenom || oldDenomAsset.denom) &&
              a.symbol !== oldSymbolAsset.symbol,
          );

          // Add new preferred asset
          const newAsset = createAssetEntry(asset, chainInfo);
          assetsByDenom.set(assetDenom, newAsset);
          assetsBySymbol.set(asset.symbol, newAsset);
          finalAssets.push(newAsset);
        }
      }
    }
  }

  console.log('[allReceivableAssetsAtom] Unique assets returned:', finalAssets);
  return finalAssets;
});
