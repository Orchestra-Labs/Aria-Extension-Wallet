import React, { useEffect, useState } from 'react';
import { AssetScroller, ChainScroller, Header, Loader, SearchBar, SortDialog } from '@/components';
import {
  isInitialDataLoadAtom,
  selectedCoinListAtom,
  assetDialogSortTypeAtom,
  assetDialogSortOrderAtom,
  dialogSearchTermAtom,
  filteredChainAssetsAtom,
  userAccountAtom,
  filteredChainRegistryAtom,
  loadFullRegistryAtom,
  unloadFullRegistryAtom,
  subscriptionSelectionsAtom,
  selectedChainIdsAtom,
  fullChainRegistryAtom,
  networkLevelAtom,
  subscribedChainRegistryAtom,
} from '@/atoms';
import { useAtom, useAtomValue, useSetAtom } from 'jotai';
import { useNavigate } from 'react-router-dom';
import {
  AssetSortType,
  DEFAULT_SUBSCRIPTION,
  NetworkLevel,
  ROUTES,
  SearchType,
  SettingsOption,
  SortOrder,
} from '@/constants';
import { Button, Separator } from '@/ui-kit';
import { Asset, LocalChainRegistry, SimplifiedChainInfo } from '@/types';
import { saveAccountByID, getPrimaryFeeToken } from '@/helpers';
import { useDataProviderControls } from '@/data';
import { useRefreshData } from '@/hooks';

const PAGE_TITLE = 'Chain & Coin Subscriptions';

enum SubscriptionTab {
  CHAINS_TAB = 'chains',
  COINS_TAB = 'coins',
}

enum NetworkLevelTab {
  MAINNET = 'mainnet',
  TESTNET = 'testnet',
}

interface ChainSubscriptionsProps {}

export const ChainSubscriptions: React.FC<ChainSubscriptionsProps> = ({}) => {
  const navigate = useNavigate();
  const { refreshData } = useRefreshData();
  const { prepAddressDataReload } = useDataProviderControls();

  const isInitialDataLoad = useAtomValue(isInitialDataLoadAtom);
  const [networkLevelTab, setNetworkLevelTab] = useState<NetworkLevelTab>(NetworkLevelTab.MAINNET);
  const networkLevel = useAtomValue(networkLevelAtom);
  const testnetAccessEnabled =
    useAtomValue(userAccountAtom)?.settings[SettingsOption.TESTNET_ACCESS] || false;
  const setNetworkLevel = useSetAtom(networkLevelAtom);
  const chainRegistry = useAtomValue(fullChainRegistryAtom);
  const selectedCoins = useAtomValue(selectedCoinListAtom);
  const setSearchTerm = useSetAtom(dialogSearchTermAtom);
  const setSortOrder = useSetAtom(assetDialogSortOrderAtom);
  const setSortType = useSetAtom(assetDialogSortTypeAtom);
  const [userAccount, setUserAccount] = useAtom(userAccountAtom);
  const allChainsData = useAtomValue(filteredChainRegistryAtom);
  const chainAssets = useAtomValue(filteredChainAssetsAtom);
  const loadFullRegistry = useSetAtom(loadFullRegistryAtom);
  const unloadFullRegistry = useSetAtom(unloadFullRegistryAtom);
  const [subscriptionSelections, setSubscriptionSelections] = useAtom(subscriptionSelectionsAtom);
  const selectedChainIds = useAtomValue(selectedChainIdsAtom);
  const setSubscribedChainRegistryAtom = useSetAtom(subscribedChainRegistryAtom);

  const [activeTab, setActiveTab] = useState<SubscriptionTab>(SubscriptionTab.CHAINS_TAB);
  const [initialChainIds, setInitialChainIds] = useState<string[]>([]);

  const initialSettings = {
    hasSetCoinList: true,
    subscriptions:
      userAccount?.settings.chainSubscriptions &&
      Object.keys(userAccount.settings.chainSubscriptions.mainnet).length +
        Object.keys(userAccount.settings.chainSubscriptions.testnet).length >
        0
        ? userAccount.settings.chainSubscriptions
        : DEFAULT_SUBSCRIPTION,
  };

  const displayChains = React.useMemo(() => {
    const chains =
      activeTab === SubscriptionTab.CHAINS_TAB
        ? allChainsData
        : allChainsData.filter(chain => selectedChainIds.includes(chain.chain_id));

    // Filter by network tab if testnet access is enabled
    if (testnetAccessEnabled) {
      return chains.filter(chain =>
        networkLevelTab === NetworkLevelTab.MAINNET
          ? chainRegistry.mainnet[chain.chain_id]
          : chainRegistry.testnet[chain.chain_id],
      );
    }
    return chains;
  }, [
    allChainsData,
    activeTab,
    selectedChainIds,
    testnetAccessEnabled,
    networkLevelTab,
    chainRegistry,
  ]);

  const allChainsSelected = React.useMemo(() => {
    if (!displayChains.length) return false;
    const displayChainIds = displayChains.map(chain => chain.chain_id);
    return displayChainIds.every(id => selectedChainIds.includes(id));
  }, [selectedChainIds, displayChains]);
  const noChainsSelected = selectedChainIds.length === 0;

  const allCoinsSelected = React.useMemo(() => {
    if (!chainAssets.length) return false;

    // Get all assets from subscribed chains for current network level
    const subscribedChainIds = Object.keys(subscriptionSelections[networkLevel]);
    const allAssetsFromChains: Asset[] = [];

    for (const chainId of subscribedChainIds) {
      const chain = chainRegistry[networkLevel][chainId];
      if (chain?.assets) {
        allAssetsFromChains.push(...Object.values(chain.assets));
      }
    }

    // Get all selected denoms from subscriptionSelections for current network level
    const selectedDenoms = new Set(
      Object.values(subscriptionSelections[networkLevel]).flatMap(denoms => denoms),
    );

    // Check if all assets from subscribed chains are selected
    return allAssetsFromChains.every(asset => selectedDenoms.has(asset.denom));
  }, [chainAssets, subscriptionSelections, chainRegistry, networkLevelTab]);

  const noCoinsSelected = React.useMemo(() => {
    return (
      Object.values(subscriptionSelections[networkLevel]).flatMap(denoms => denoms).length === 0
    );
  }, [subscriptionSelections, networkLevelTab]);

  const resetDefaults = () => {
    setSearchTerm('');
    setSortOrder(SortOrder.ASC);
    setSortType(AssetSortType.NAME);
    console.log('[ChainSubscriptions] Component unmounting - unloading full registry');
    unloadFullRegistry();
  };

  const handleSelectAllCoins = () => {
    const newSelections = { ...subscriptionSelections };

    // Get all assets from subscribed chains for current network level
    const assetsByChain: Record<string, Asset[]> = {};
    for (const chainId of Object.keys(subscriptionSelections[networkLevel])) {
      const chain = chainRegistry[networkLevel][chainId];
      if (chain?.assets) {
        assetsByChain[chainId] = Object.values(chain.assets);
      }
    }

    // Update selections for each chain to include all assets
    newSelections[networkLevel] = {};
    Object.entries(assetsByChain).forEach(([chainId, assets]) => {
      newSelections[networkLevel][chainId] = assets.map(a => a.denom);
    });

    setSubscriptionSelections(newSelections);
  };

  const handleSelectAllChains = () => {
    const newSelections = { ...subscriptionSelections };

    displayChains.forEach(chain => {
      const feeToken = getPrimaryFeeToken(chain);
      newSelections[networkLevel][chain.chain_id] = feeToken ? [feeToken.denom] : [];
    });

    setSubscriptionSelections(newSelections);
  };

  const handleDeselectAllChains = () => {
    const newSelections = { ...subscriptionSelections };
    const current = newSelections[networkLevel];

    const toRemove = new Set(displayChains.map(c => c.chain_id));
    const updated = Object.fromEntries(Object.entries(current).filter(([id]) => !toRemove.has(id)));

    newSelections[networkLevel] =
      Object.keys(updated).length > 0 ? updated : DEFAULT_SUBSCRIPTION[networkLevel];

    setSubscriptionSelections(newSelections);
  };

  const handleDeselectAllCoins = () => {
    const newSelections = { ...subscriptionSelections };
    const current = newSelections[networkLevel];
    const updated = { ...current };

    for (const asset of chainAssets) {
      const chainId = asset.networkID;
      const denoms = updated[chainId] || [];
      const filtered = denoms.filter(d => d !== asset.denom);
      if (filtered.length === 0) {
        delete updated[chainId];
      } else {
        updated[chainId] = filtered;
      }
    }

    newSelections[networkLevel] =
      Object.keys(updated).length > 0 ? updated : DEFAULT_SUBSCRIPTION[networkLevel];

    setSubscriptionSelections(newSelections);
  };

  const closeAndReturn = () => {
    resetDefaults();
    navigate(ROUTES.APP.ROOT);
  };

  const handleSelectCoin = (coin: Asset) => {
    const currentDenoms = subscriptionSelections[networkLevel][coin.networkID] || [];

    if (currentDenoms.includes(coin.denom)) {
      setSubscriptionSelections(prev => {
        const updatedNetworkSelections = { ...prev[networkLevel] };
        const updatedDenoms = updatedNetworkSelections[coin.networkID].filter(
          d => d !== coin.denom,
        );

        if (updatedDenoms.length === 0) {
          // Remove chain if no coins left
          delete updatedNetworkSelections[coin.networkID];
        } else {
          updatedNetworkSelections[coin.networkID] = updatedDenoms;
        }

        return {
          ...prev,
          [networkLevel]: updatedNetworkSelections,
        };
      });
    } else {
      setSubscriptionSelections(prev => ({
        ...prev,
        [networkLevel]: {
          ...prev[networkLevel],
          [coin.networkID]: [...(prev[networkLevel][coin.networkID] || []), coin.denom],
        },
      }));
    }
  };

  const handleSelectChain = (chain: SimplifiedChainInfo, feeToken: Asset | null) => {
    setSubscriptionSelections(prev => {
      const newSelections = { ...prev };
      const chainId = chain.chain_id;

      if (newSelections[networkLevel][chainId]) {
        const { [chainId]: _, ...rest } = newSelections[networkLevel];
        newSelections[networkLevel] = rest;
      } else {
        // TODO: if no assets on the chain, set to "all others, however that will be done.  currently it's an unsupported chain"
        newSelections[networkLevel] = {
          ...newSelections[networkLevel],
          [chainId]: feeToken ? [feeToken.denom] : [],
        };
      }

      return newSelections;
    });
  };

  const saveToLocalStorage = () => {
    if (userAccount) {
      const updatedUserAccount = {
        ...userAccount,
        settings: {
          ...userAccount.settings,
          hasSetCoinList: true,
          chainSubscriptions: subscriptionSelections,
        },
      };

      setUserAccount(updatedUserAccount);
      saveAccountByID(updatedUserAccount);
    }
  };

  const saveToState = () => {
    // Update the subscribedChainRegistryAtom based on the new subscriptions

    const updatedRegistry = {
      mainnet: Object.fromEntries(
        Object.entries(chainRegistry.mainnet).filter(
          ([chainId]) => chainId in subscriptionSelections.mainnet,
        ),
      ) as LocalChainRegistry,
      testnet: Object.fromEntries(
        Object.entries(chainRegistry.testnet).filter(
          ([chainId]) => chainId in subscriptionSelections.testnet,
        ),
      ) as LocalChainRegistry,
    };

    setSubscribedChainRegistryAtom(updatedRegistry);
  };

  const confirmSelection = async () => {
    // Save subscriptions first
    saveToState();

    const chainsChanged =
      selectedChainIds.length !== initialChainIds.length ||
      selectedChainIds.some(id => !initialChainIds.includes(id));

    if (chainsChanged) {
      console.log('[ChainSubscriptions] Chains changed - triggering full reload');
      // Prep data reload sequence
      prepAddressDataReload();
    } else {
      console.log('[ChainSubscriptions] Only coins changed - refreshing wallet data');
      refreshData({ validator: false });
    }

    // Save to storage and account atom
    saveToLocalStorage();

    // Then close and return
    closeAndReturn();
  };

  const cancel = () => {
    if (userAccount) {
      userAccount.settings.hasSetCoinList = initialSettings.hasSetCoinList;
      userAccount.settings.chainSubscriptions = initialSettings.subscriptions;
      saveAccountByID(userAccount);
    }

    closeAndReturn();
  };

  useEffect(() => {
    setNetworkLevel(
      networkLevelTab === NetworkLevelTab.MAINNET ? NetworkLevel.MAINNET : NetworkLevel.TESTNET,
    );
  }, [networkLevelTab, networkLevel]);

  useEffect(() => {
    setInitialChainIds(selectedChainIds);

    console.log('[ChainSubscriptions] Component mounted - loading full registry');
    loadFullRegistry();

    return () => {
      closeAndReturn();
    };
  }, []);

  useEffect(() => {
    if (userAccount) {
      setSubscriptionSelections(userAccount.settings.chainSubscriptions || DEFAULT_SUBSCRIPTION);
    }
  }, [userAccount]);

  return (
    <div className="h-screen flex flex-col overflow-hidden bg-black text-white">
      <Header title={PAGE_TITLE} onClose={cancel} />

      {/* Main tabs (Chains/Coins) */}
      {/* TODO: this section moves between 37 and 61 pixels.  use this information to set animation for height changes */}
      <div className="flex border-b border-neutral-4">
        <div
          className={`flex-1 ${activeTab === SubscriptionTab.CHAINS_TAB ? 'text-blue' : 'text-neutral-2'}`}
        >
          {/* Chains tab with potential subtabs */}
          <button
            className={`w-full py-2 text-center ${activeTab === SubscriptionTab.CHAINS_TAB ? 'border-b-2 border-blue' : ''}`}
            onClick={() => setActiveTab(SubscriptionTab.CHAINS_TAB)}
          >
            Chains
          </button>

          {/* Network subtabs (only shown when Chains is active and testnet access is enabled) */}
          {activeTab === SubscriptionTab.CHAINS_TAB && testnetAccessEnabled && (
            <div className="flex">
              <button
                className={`flex-1 py-1 text-sm ${networkLevelTab === NetworkLevelTab.MAINNET ? 'text-blue border-b-2 border-blue' : 'text-neutral-2'}`}
                onClick={() => setNetworkLevelTab(NetworkLevelTab.MAINNET)}
              >
                Mainnet
              </button>
              <button
                className={`flex-1 py-1 text-sm ${networkLevelTab === NetworkLevelTab.TESTNET ? 'text-blue border-b-2 border-blue' : 'text-neutral-2'}`}
                onClick={() => setNetworkLevelTab(NetworkLevelTab.TESTNET)}
              >
                Testnet
              </button>
            </div>
          )}
        </div>

        <button
          className={`flex-1 py-2 text-center ${activeTab === SubscriptionTab.COINS_TAB ? 'text-blue border-b-2 border-blue' : 'text-neutral-2'} ${selectedChainIds.length === 0 ? 'opacity-50 cursor-not-allowed' : ''}`}
          onClick={() => selectedChainIds.length > 0 && setActiveTab(SubscriptionTab.COINS_TAB)}
          disabled={selectedChainIds.length === 0}
        >
          Coins
        </button>
      </div>

      <div className="flex pt-2 px-4 justify-between items-center px-2">
        <div className="text-sm">Tap to select</div>
        <div className="flex items-center">
          <Button
            variant={
              (activeTab === SubscriptionTab.CHAINS_TAB ? allChainsSelected : allCoinsSelected)
                ? 'selected'
                : 'unselected'
            }
            size="xsmall"
            className="px-1 rounded-md text-xs"
            onClick={
              activeTab === SubscriptionTab.CHAINS_TAB
                ? handleSelectAllChains
                : handleSelectAllCoins
            }
            disabled={isInitialDataLoad}
          >
            All
          </Button>
          <p className="text-sm px-1">/</p>
          <Button
            variant={
              (activeTab === SubscriptionTab.CHAINS_TAB ? noChainsSelected : noCoinsSelected)
                ? 'selected'
                : 'unselected'
            }
            size="xsmall"
            className="px-1 rounded-md text-xs"
            onClick={
              activeTab === SubscriptionTab.CHAINS_TAB
                ? handleDeselectAllChains
                : handleDeselectAllCoins
            }
            disabled={isInitialDataLoad}
          >
            None
          </Button>
        </div>
        <div className="justify-end">
          <SortDialog
            searchType={
              activeTab === SubscriptionTab.CHAINS_TAB ? SearchType.CHAIN : SearchType.ASSET
            }
          />
        </div>
      </div>

      <div className="h-full flex flex-col overflow-hidden px-4">
        {isInitialDataLoad ? (
          <Loader />
        ) : (
          <div className="flex-grow flex flex-col overflow-hidden">
            {activeTab === SubscriptionTab.CHAINS_TAB ? (
              <ChainScroller chains={displayChains} onChainSelect={handleSelectChain} />
            ) : (
              <AssetScroller
                assets={chainAssets}
                onClick={handleSelectCoin}
                isSelectable
                multiSelectEnabled
              />
            )}
          </div>
        )}

        <SearchBar
          searchType={
            activeTab === SubscriptionTab.CHAINS_TAB ? SearchType.CHAIN : SearchType.ASSET
          }
        />
      </div>

      <Separator variant="top" />
      <div className="flex justify-center mb-4">
        <Button
          className="w-[56%] text-center"
          disabled={!userAccount && selectedCoins.length === 0}
          onClick={() => confirmSelection()}
        >
          Confirm
        </Button>
      </div>
    </div>
  );
};
