import React, { useEffect } from 'react';
import { Header, Loader, SearchBar, SortDialog, TileScroller } from '@/components';
import {
  filteredExchangeAssetsAtom,
  isInitialDataLoadAtom,
  selectedCoinListAtom,
  symphonyAssetsAtom,
  assetDialogSortTypeAtom,
  assetDialogSortOrderAtom,
  dialogSearchTermAtom,
  subscribedAssetsAtom,
} from '@/atoms';
import { useAtom, useAtomValue, useSetAtom } from 'jotai';
import { useNavigate } from 'react-router-dom';
import { SYMPHONY_MAINNET_ID, DEFAULT_SUBSCRIPTION, ROUTES } from '@/constants';
import { Button, Separator } from '@/ui-kit';
import { Asset, SubscriptionRecord } from '@/types';
import { saveAccountByID } from '@/helpers/dataHelpers/account';
import { userAccountAtom } from '@/atoms/accountAtom';

interface ChainSubscriptionsProps {}

const PAGE_TITLE = 'Select Visible Coins';

export const ChainSubscriptionsScreen: React.FC<ChainSubscriptionsProps> = ({}) => {
  const navigate = useNavigate();

  const isInitialDataLoad = useAtomValue(isInitialDataLoadAtom);
  const [selectedCoins, setSelectedCoins] = useAtom(selectedCoinListAtom);
  const filteredExchangeCoins = useAtomValue(filteredExchangeAssetsAtom);
  const subscribedAssets = useAtomValue(subscribedAssetsAtom);
  const unfilteredAssets = useAtomValue(symphonyAssetsAtom);
  const setSearchTerm = useSetAtom(dialogSearchTermAtom);
  const setSortOrder = useSetAtom(assetDialogSortOrderAtom);
  const setSortType = useSetAtom(assetDialogSortTypeAtom);
  const [userAccount, setUserAccount] = useAtom(userAccountAtom);

  const allCoinsSelected = selectedCoins.length === unfilteredAssets.length;
  const noCoinsSelected = selectedCoins.length === 0;

  // Store initial settings to revert to them on cancel
  const initialSettings = {
    hasSetCoinList: true,
    subscribedTo:
      userAccount?.settings.chainSubscriptions &&
      Object.keys(userAccount.settings.chainSubscriptions).length > 0
        ? userAccount.settings.chainSubscriptions
        : DEFAULT_SUBSCRIPTION,
  };

  const resetDefaults = () => {
    setSearchTerm('');
    setSortOrder('Desc');
    setSortType('name');
  };

  const handleSelectAll = () => {
    setSelectedCoins(filteredExchangeCoins);
  };

  const handleSelectNone = () => {
    setSelectedCoins([]);
  };

  const closeAndReturn = () => {
    resetDefaults();
    navigate(ROUTES.APP.ROOT);
  };

  const handleSelectCoin = (coin: Asset) => {
    setSelectedCoins(prevSelectedCoins => {
      const isAlreadySelected = prevSelectedCoins.some(
        selectedCoin => selectedCoin.denom === coin.denom,
      );

      const updatedCoins = isAlreadySelected
        ? prevSelectedCoins.filter(selectedCoin => selectedCoin.denom !== coin.denom)
        : [...prevSelectedCoins, coin];

      return updatedCoins;
    });
  };

  // TODO: with multi-coin support, change to select specific coin and chain by sorted category and selection
  const confirmSelection = () => {
    if (userAccount) {
      const updatedSubscriptions: SubscriptionRecord = {};

      // TODO: change page's save structure to reflect subscription/registry structure to prevent excess looping here
      const networkID = SYMPHONY_MAINNET_ID;
      const networkCoinDenoms = unfilteredAssets.map(asset => asset.denom);
      const selectedNetworkCoins = selectedCoins.map(coin => coin.denom);

      console.log('[EditCoinListScreen] Saving selected coins', selectedNetworkCoins);
      // TODO: elect Symphony (and Melody) as default if nothing is selected
      if (selectedNetworkCoins.length === networkCoinDenoms.length) {
        updatedSubscriptions[networkID] = [];
      } else if (selectedNetworkCoins.length > 0) {
        updatedSubscriptions[networkID] = selectedNetworkCoins;
      }

      const updatedUserAccount = {
        ...userAccount,
        settings: {
          ...userAccount.settings,
          hasSetCoinList: true,
          subscribedTo: updatedSubscriptions,
        },
      };

      console.log('[EditCoinListScreen] Saving account as:', updatedUserAccount);

      // Update state and save to local storage
      setUserAccount(updatedUserAccount);
      saveAccountByID(updatedUserAccount);
    } else {
      console.warn('[EditCoinListScreen] UserAccount is undefined');
    }

    closeAndReturn();
  };

  const cancel = () => {
    console.log('[EditCoinListScreen] Cancelling with account set to:', userAccount);
    if (userAccount) {
      // Restore the initial settings
      userAccount.settings.hasSetCoinList = initialSettings.hasSetCoinList;
      userAccount.settings.chainSubscriptions = initialSettings.subscribedTo;
      saveAccountByID(userAccount);
    }

    closeAndReturn();
  };

  useEffect(() => {
    if (userAccount) {
      console.log('[EditCoinListScreen] Subscribed assets', subscribedAssets);
      setSelectedCoins(subscribedAssets);
    } else {
      console.warn('[EditCoinListScreen] UserAccount is undefined');
    }
  }, []);

  return (
    <div className="h-screen flex flex-col overflow-hidden bg-black text-white">
      <Header title={PAGE_TITLE} onClose={cancel} />

      {/* TODO: extract the below items from here and assetselectdialog to external component */}
      <div className="flex pt-2 px-4 justify-between items-center px-2">
        <div className="text-sm">Tap to select</div>
        <div className="flex items-center">
          <Button
            variant={allCoinsSelected ? 'selected' : 'unselected'}
            size="xsmall"
            className="px-1 rounded-md text-xs"
            onClick={handleSelectAll}
            disabled={isInitialDataLoad}
          >
            All
          </Button>
          <p className="text-sm px-1">/</p>
          <Button
            variant={noCoinsSelected ? 'selected' : 'unselected'}
            size="xsmall"
            className="px-1 rounded-md text-xs"
            onClick={handleSelectNone}
            disabled={isInitialDataLoad}
          >
            None
          </Button>
        </div>
        <div className="justify-end">
          <SortDialog isDialog />
        </div>
      </div>

      <div className="h-full flex flex-col overflow-hidden px-4">
        {isInitialDataLoad ? (
          <Loader />
        ) : (
          // TODO: create CategoryTiles option or new component that allows for animated tile inclusion
          <div className="flex-grow flex flex-col overflow-hidden">
            <TileScroller
              activeIndex={0}
              onSelectAsset={handleSelectCoin}
              isSelectable
              isEditPage
              multiSelectEnabled
            />
          </div>
        )}

        <SearchBar isDialog />
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
