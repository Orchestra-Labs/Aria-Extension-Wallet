import { DEFAULT_SUBSCRIPTION, LOCAL_CHAIN_REGISTRY, SettingsOption } from '@/constants';
import { Asset, LocalChainRegistry, SimplifiedChainInfo, SubscriptionRecord } from '@/types';
import { atom } from 'jotai';
import {
  assetSortOrderAtom,
  assetSortTypeAtom,
  chainSortOrderAtom,
  searchTermAtom,
} from './searchFilterAtom';
import { networkLevelAtom } from './networkLevelAtom';
import {
  filterAndSortAssets,
  filterAndSortChains,
  getStoredChainRegistry,
  getSupportedChains,
  getSymphonyChainId,
} from '@/helpers';
import { userAccountAtom } from './accountAtom';

const EMPTY_CHAIN_REGISTRY = { mainnet: {}, testnet: {} };

export const subscribedChainRegistryAtom = atom<{
  mainnet: LocalChainRegistry;
  testnet: LocalChainRegistry;
}>(LOCAL_CHAIN_REGISTRY);

export const fullChainRegistryAtom = atom<{
  mainnet: LocalChainRegistry;
  testnet: LocalChainRegistry;
}>(LOCAL_CHAIN_REGISTRY);

export const loadFullRegistryAtom = atom(null, (_, set) => {
  const storedRegistry = getStoredChainRegistry();
  if (storedRegistry) {
    set(fullChainRegistryAtom, storedRegistry.data);
  }
});

export const unloadFullRegistryAtom = atom(null, (_, set) => {
  console.log('[ChainRegistryAtom] Unloading full registry - resetting to EMPTY_CHAIN_REGISTRY');
  set(fullChainRegistryAtom, EMPTY_CHAIN_REGISTRY);
});

export const chainDenomsAtom = atom(get => {
  const registry = get(fullChainRegistryAtom);
  const networkLevel = get(networkLevelAtom);

  return (chainId: string) => {
    const chain = registry[networkLevel][chainId];
    if (!chain?.assets) return [];
    return Object.values(chain.assets).map(asset => asset.originDenom || asset.denom);
  };
});

export const subscriptionSelectionsAtom = atom<SubscriptionRecord>(DEFAULT_SUBSCRIPTION);

export const chainInfoAtom = atom(get => {
  const networkLevel = get(networkLevelAtom);
  const chainRegistry = get(subscribedChainRegistryAtom);

  return (chainId: string) => chainRegistry[networkLevel][chainId];
});

export const fullRegistryChainInfoAtom = atom(get => {
  const networkLevel = get(networkLevelAtom);
  const chainRegistry = get(fullChainRegistryAtom);

  return (chainId: string) => chainRegistry[networkLevel][chainId];
});

// Helper atoms for derived states
export const selectedChainIdsAtom = atom(get => {
  const networkLevel = get(networkLevelAtom);
  const subscriptionSelections = get(subscriptionSelectionsAtom);
  return Object.keys(subscriptionSelections[networkLevel]);
});

export const allAssetsFromSubscribedChainsAtom = atom<Asset[]>(get => {
  const networkLevel = get(networkLevelAtom);
  const subscriptionSelections = get(subscriptionSelectionsAtom)[networkLevel];
  const chainRegistry = get(fullChainRegistryAtom)[networkLevel];

  const allAssets: Asset[] = [];

  for (const chainId of Object.keys(subscriptionSelections)) {
    const chain = chainRegistry[chainId];
    if (chain?.assets) {
      allAssets.push(...Object.values(chain.assets));
    }
  }

  return allAssets;
});

export const selectedCoinListAtom = atom<Asset[]>(get => {
  const networkLevel = get(networkLevelAtom);
  const subscriptionSelections = get(subscriptionSelectionsAtom)[networkLevel];
  const allAssets = get(allAssetsFromSubscribedChainsAtom);

  return allAssets.filter(asset => {
    const chainSelection = subscriptionSelections[asset.chainId];
    // Include asset if either:
    // 1. viewAll is true for the chain, OR
    // 2. the asset's denom is in the subscribedDenoms list
    return (
      chainSelection.viewAll ||
      (chainSelection.subscribedDenoms || []).includes(asset.originDenom || asset.denom)
    );
  });
});

export const filteredChainAssetsAtom = atom(get => {
  const allAssets = get(allAssetsFromSubscribedChainsAtom);
  const searchTerm = get(searchTermAtom);
  const sortType = get(assetSortTypeAtom);
  const sortOrder = get(assetSortOrderAtom);
  const userAccount = get(userAccountAtom);
  const testnetAccessEnabled = userAccount?.settings[SettingsOption.TESTNET_ACCESS] || false;

  // Filter out testnet assets if testnet access is disabled
  const filteredAssets = testnetAccessEnabled
    ? allAssets
    : allAssets.filter(asset => {
        const chain = get(fullChainRegistryAtom).mainnet[asset.chainId];
        return chain !== undefined; // Only include assets from mainnet chains
      });

  return filterAndSortAssets(filteredAssets, searchTerm, sortType, sortOrder);
});

export const filteredChainRegistryAtom = atom(get => {
  const chainRegistry = get(fullChainRegistryAtom);
  const searchTerm = get(searchTermAtom);
  const sortOrder = get(chainSortOrderAtom);
  const networkLevel = get(networkLevelAtom);
  const subscriptionSelections = get(subscriptionSelectionsAtom);

  console.log('[filteredChainRegistryAtom] chainRegistry:', chainRegistry);
  console.log('[filteredChainRegistryAtom] networkLevel:', networkLevel);
  console.log('[filteredChainRegistryAtom] subscriptionSelections:', subscriptionSelections);

  // Get subscribed chainIds for the current network level
  const subscribedChainIds = Object.keys(subscriptionSelections[networkLevel]);
  console.log('[filteredChainRegistryAtom] subscribedChainIds:', subscribedChainIds);

  const chains = Object.values(chainRegistry[networkLevel]).map(chain => ({
    ...chain,
    isSubscribed: subscribedChainIds.includes(chain.chain_id),
  }));

  console.log('[filteredChainRegistryAtom] all chains before filtering:', chains);

  const filteredChains = filterAndSortChains(chains, searchTerm, sortOrder);
  console.log('[filteredChainRegistryAtom] filteredChains:', filteredChains);

  return filteredChains;
});

const _selectedValidatorChainAtom = atom<string | null>(null);
export const selectedValidatorChainAtom = atom<string, [string], void>(
  get => {
    const independentValue = get(_selectedValidatorChainAtom);
    if (independentValue !== null) {
      return independentValue;
    }

    const userAccount = get(userAccountAtom);
    const subscribedChains = get(subscribedChainsAtom);
    const networkLevel = get(networkLevelAtom);

    const subscribedChainIds = subscribedChains.map(chain => chain.chain_id);

    // Priority 1: User's default chain id (if subscribed)
    const userDefaultChain = userAccount?.settings.defaultSelections[networkLevel].defaultChainId;
    if (userDefaultChain && subscribedChainIds.includes(userDefaultChain)) {
      return userDefaultChain;
    }

    const symphonyChainId = getSymphonyChainId(networkLevel);

    // Priority 2: symphony id (if subscribed)
    if (subscribedChainIds.includes(symphonyChainId)) {
      return symphonyChainId;
    }

    // Priority 3: First available subscribed chain
    return subscribedChains[0]?.chain_id || symphonyChainId;
  },
  (_, set, newChainId: string) => {
    // Store the value in the private atom
    set(_selectedValidatorChainAtom, newChainId);
  },
);

export const resetSelectedValidatorChainAtom = atom(null, (_, set) => {
  set(_selectedValidatorChainAtom, null);
});

export const selectedValidatorChainInfoAtom = atom(get => {
  const chainId = get(selectedValidatorChainAtom);
  const networkLevel = get(networkLevelAtom);
  const getChainInfo = get(chainInfoAtom);

  const chain = getChainInfo(chainId);
  console.log('[selectedValidatorChainInfoAtom]', {
    chainId,
    networkLevel,
    chain,
  });

  return chain;
});

export const subscribedChainsAtom = atom<SimplifiedChainInfo[]>(get => {
  const networkLevel = get(networkLevelAtom);
  const subscribedRegistry = get(subscribedChainRegistryAtom)[networkLevel];

  return Object.values(subscribedRegistry).filter((chain): chain is SimplifiedChainInfo => !!chain);
});

export const skipChainsAtom = atom<string[]>([]);
export const loadSkipChainsAtom = atom(null, async (_, set) => {
  try {
    const chains = await getSupportedChains();
    const parsedChains = chains.map(chain => chain.chain_id);
    set(skipChainsAtom, parsedChains);
  } catch (error) {
    console.error('[loadSkipChainsAtom] Failed to load Skip chains:', error);
  }
});
