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
  chainDenomsAtom,
  chainInfoAtom,
} from '@/atoms';
import { useAtom, useAtomValue, useSetAtom } from 'jotai';
import { useNavigate } from 'react-router-dom';
import {
  AssetSortType,
  DEFAULT_DENOM_SUBSCRIPTION_RECORD,
  DEFAULT_SELECTIONS,
  DEFAULT_SUBSCRIPTION,
  NetworkLevel,
  ROUTES,
  SearchType,
  SettingsOption,
  SortOrder,
} from '@/constants';
import { Button, Separator } from '@/ui-kit';
import { Asset, DenomSubscriptionRecord, LocalChainRegistry, SimplifiedChainInfo } from '@/types';
import { saveAccountById, getPrimaryFeeToken, getSymphonyChainId } from '@/helpers';
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
  const denomsForChain = useAtomValue(chainDenomsAtom);
  const getChainInfo = useAtomValue(chainInfoAtom);

  const [activeTab, setActiveTab] = useState<SubscriptionTab>(SubscriptionTab.CHAINS_TAB);
  const [initialChainIds, setInitialChainIds] = useState<string[]>([]);

  const initialSettings = {
    defaultSelections: userAccount && userAccount.settings.defaultSelections,
    hasSetCoinList: true,
    chainSubscriptions:
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
      const chain = getChainInfo(chainId);
      if (chain?.assets) {
        allAssetsFromChains.push(...Object.values(chain.assets));
      }
    }

    // Get all selected denoms from subscriptionSelections for current network level
    const selectedDenoms = new Set(
      Object.values(subscriptionSelections[networkLevel]).flatMap(
        denomSubscription => denomSubscription.subscribedDenoms,
      ),
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
    Object.keys(assetsByChain).forEach(([chainId]) => {
      newSelections[networkLevel][chainId] = DEFAULT_DENOM_SUBSCRIPTION_RECORD;
    });

    setSubscriptionSelections(newSelections);
  };

  const handleSelectAllChains = () => {
    const newSelections = { ...subscriptionSelections };

    displayChains.forEach(chain => {
      newSelections[networkLevel][chain.chain_id] = DEFAULT_DENOM_SUBSCRIPTION_RECORD;
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
      const chainId = asset.chainId;
      const denoms = updated[chainId].subscribedDenoms || [];
      const filtered = denoms.filter(d => d !== asset.denom);
      if (filtered.length === 0) {
        delete updated[chainId];
      } else {
        updated[chainId] = {
          viewAll: false,
          subscribedDenoms: filtered,
        };
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

  const allDenomsAreSubscribed = (chainId: string, subscribedDenoms: string[]): boolean => {
    const allDenomsForChain = denomsForChain(chainId);

    return (
      subscribedDenoms.length === allDenomsForChain.length &&
      allDenomsForChain.every(denom => subscribedDenoms.includes(denom))
    );
  };

  const subscribeOrSetViewAll = (
    chainId: string,
    denoms: string[],
    feeToken: string,
  ): DenomSubscriptionRecord => {
    const allAreSubscribed = allDenomsAreSubscribed(chainId, [...denoms, feeToken]);
    const feeTokenSelection = [feeToken];

    return {
      viewAll: allAreSubscribed,
      subscribedDenoms: allAreSubscribed ? [] : feeTokenSelection,
    };
  };

  const handleSelectCoin = (coin: Asset) => {
    const currentSelection = subscriptionSelections[networkLevel][coin.chainId] || {
      ...DEFAULT_DENOM_SUBSCRIPTION_RECORD,
    };
    const chainId = coin.chainId;

    if (currentSelection.subscribedDenoms.includes(coin.denom)) {
      // Coin is currently selected - deselect it
      setSubscriptionSelections(prev => {
        const updatedNetworkSelections = { ...prev[networkLevel] };
        const updatedDenoms = currentSelection.subscribedDenoms.filter(d => d !== coin.denom);

        console.log('[ChainSubscriptions handleSelection] checking value of viewAll');
        console.log('[ChainSubscriptions handleSelection]', currentSelection.viewAll);
        // If we're deselecting the last coin, remove the chain entry
        if (updatedDenoms.length === 0 && !currentSelection.viewAll) {
          const { [chainId]: _, ...rest } = updatedNetworkSelections;
          return {
            ...prev,
            [networkLevel]: rest,
          };
        }

        // Otherwise update the denom list and ensure viewAll is false
        return {
          ...prev,
          [networkLevel]: {
            ...updatedNetworkSelections,
            [chainId]: {
              viewAll: false,
              subscribedDenoms: updatedDenoms,
            },
          },
        };
      });
    } else {
      // Coin is not selected - select it
      setSubscriptionSelections(prev => {
        const updatedNetworkSelections = { ...prev[networkLevel] };
        const denomSubscription = subscribeOrSetViewAll(
          chainId,
          currentSelection.subscribedDenoms,
          coin.denom,
        );

        return {
          ...prev,
          [networkLevel]: {
            ...updatedNetworkSelections,
            [chainId]: denomSubscription,
          },
        };
      });
    }
  };

  const handleSelectChain = (
    chain: SimplifiedChainInfo,
    viewAll: boolean,
    feeToken: Asset | null,
  ) => {
    setSubscriptionSelections(prev => {
      const newSelections = { ...prev };
      const chainId = chain.chain_id;

      if (!newSelections[networkLevel]) {
        newSelections[networkLevel] = {};
      }

      const networkLevelSelections = newSelections[networkLevel];
      const currentNetwork = networkLevelSelections[chainId];

      if (currentNetwork) {
        // If chain is already selected, remove it
        const { [chainId]: _, ...rest } = networkLevelSelections;
        newSelections[networkLevel] = rest;
      } else {
        // If chain is not selected, set initial coin selection by viewAll choice

        const denomSubscription =
          viewAll || !feeToken
            ? DEFAULT_DENOM_SUBSCRIPTION_RECORD
            : subscribeOrSetViewAll(chainId, [], feeToken?.denom);
        newSelections[networkLevel] = {
          ...networkLevelSelections,
          [chainId]: denomSubscription,
        };
      }

      return newSelections;
    });
  };

  const handleChainToggle = (
    chain: SimplifiedChainInfo,
    viewAll: boolean,
    feeToken: Asset | null,
  ) => {
    setSubscriptionSelections(prev => {
      const newSelections = { ...prev };
      const chainId = chain.chain_id;

      if (!newSelections[networkLevel]?.[chainId]) {
        return prev;
      }

      if (viewAll) {
        console.log('[ChainSubscriptions handleChainToggle] toggle on');
        // Toggling ON - set to viewAll true
        newSelections[networkLevel][chainId] = {
          viewAll: true,
          subscribedDenoms: [],
        };
      } else {
        console.log('[ChainSubscriptions handleChainToggle] toggle off');
        // Toggling OFF - set to just primary fee token
        newSelections[networkLevel][chainId] = {
          viewAll: false,
          subscribedDenoms: feeToken ? [feeToken.denom] : [],
        };
      }

      return newSelections;
    });
  };

  const saveToLocalStorage = () => {
    if (userAccount) {
      // Helper function to get the best chain ID for a network level
      const getBestChainId = (networkLevel: NetworkLevel): string => {
        const subscribedChainIds = Object.keys(subscriptionSelections[networkLevel]);

        // Priority 1: Symphony ID (if subscribed)
        const symphonyChainId = getSymphonyChainId(networkLevel);
        if (subscribedChainIds.includes(symphonyChainId)) {
          return symphonyChainId;
        }

        // Priority 2: First available subscribed chain (fallback to Symphony)
        return subscribedChainIds[0] || symphonyChainId;
      };

      // Helper function to get the best coin denom for a chain
      const getBestCoinDenom = (networkLevel: NetworkLevel, chainId: string): string => {
        const subscribedCoins =
          subscriptionSelections[networkLevel][chainId].subscribedDenoms || [];
        const chain = chainRegistry[networkLevel][chainId];

        // Priority 1: Primary fee token (if subscribed)
        if (chain) {
          const feeToken = getPrimaryFeeToken(chain);
          if (feeToken && subscribedCoins.includes(feeToken.denom)) {
            return feeToken.denom;
          }
        }

        // Priority 2: First subscribed coin
        if (subscribedCoins.length > 0) {
          return subscribedCoins[0];
        }

        // Fallback to network default
        return DEFAULT_SELECTIONS[networkLevel].defaultCoinDenom;
      };

      // Helper function to update default selections for a network level
      const updateDefaultSelections = (networkLevel: NetworkLevel) => {
        const bestChainId = getBestChainId(networkLevel);
        const bestCoinDenom = getBestCoinDenom(networkLevel, bestChainId);

        return {
          defaultChainId: bestChainId,
          defaultCoinDenom: bestCoinDenom,
        };
      };

      // Update default selections for both network levels
      const updatedDefaultSelections = {
        mainnet: updateDefaultSelections(NetworkLevel.MAINNET),
        testnet: updateDefaultSelections(NetworkLevel.TESTNET),
      };

      const updatedUserAccount = {
        ...userAccount,
        settings: {
          ...userAccount.settings,
          hasSetCoinList: true,
          chainSubscriptions: subscriptionSelections,
          defaultSelections: updatedDefaultSelections,
        },
      };

      setUserAccount(updatedUserAccount);
      saveAccountById(updatedUserAccount);
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
      refreshData({ wallet: true });
    }

    // Save to storage and account atom
    saveToLocalStorage();

    // Then close and return
    closeAndReturn();
  };

  const cancel = () => {
    if (userAccount) {
      userAccount.settings.hasSetCoinList = initialSettings.hasSetCoinList;
      userAccount.settings.chainSubscriptions = initialSettings.chainSubscriptions;
      saveAccountById(userAccount);
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
              <ChainScroller
                chains={displayChains}
                onChainSelect={handleSelectChain}
                onToggle={handleChainToggle}
              />
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
