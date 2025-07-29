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

export const subscriptionSelectionsAtom = atom<SubscriptionRecord>(DEFAULT_SUBSCRIPTION);

export const chainInfoAtom = atom(get => {
  const networkLevel = get(networkLevelAtom);
  const chainRegistry = get(subscribedChainRegistryAtom);

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
    const selectedDenoms = subscriptionSelections[asset.networkID] || [];
    return selectedDenoms.includes(asset.denom);
  });
});

export const addCoinToChainAtom = atom(null, (get, set, { chainId, denom }) => {
  const networkLevel = get(networkLevelAtom);
  const current = get(subscriptionSelectionsAtom);
  const updated = {
    ...current,
    [networkLevel]: {
      ...current[networkLevel],
      [chainId]: [...(current[networkLevel][chainId] || []), denom],
    },
  };
  set(subscriptionSelectionsAtom, updated);
});

export const removeCoinFromChainAtom = atom(null, (get, set, { chainId, denom }) => {
  const networkLevel = get(networkLevelAtom);
  const current = get(subscriptionSelectionsAtom);
  const currentDenoms = current[networkLevel][chainId] || [];
  const updatedDenoms = currentDenoms.filter(d => d !== denom);

  const updatedChains =
    updatedDenoms.length === 0
      ? Object.fromEntries(Object.entries(current[networkLevel]).filter(([id]) => id !== chainId))
      : {
          ...current[networkLevel],
          [chainId]: updatedDenoms,
        };

  set(subscriptionSelectionsAtom, {
    ...current,
    [networkLevel]: updatedChains,
  });
});

export const setChainCoinsAtom = atom(null, (get, set, { chainId, denoms }) => {
  const networkLevel = get(networkLevelAtom);
  const current = get(subscriptionSelectionsAtom);
  set(subscriptionSelectionsAtom, {
    ...current,
    [networkLevel]: {
      ...current[networkLevel],
      [chainId]: denoms,
    },
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
        const chain = get(fullChainRegistryAtom).mainnet[asset.networkID];
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

  // Get subscribed chain IDs for the current network level
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

    // Priority 1: User's default chain ID (if subscribed)
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
