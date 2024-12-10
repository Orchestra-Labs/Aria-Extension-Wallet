import React, { useEffect } from 'react';
import { Loader, PageTitle, SearchBar, SortDialog, TileScroller } from '@/components';
import {
  assetDialogSortOrderAtom,
  assetDialogSortTypeAtom,
  dialogSearchTermAtom,
  filteredExchangeAssetsAtom,
  isInitialDataLoadAtom,
  selectedCoinListAtom,
} from '@/atoms';
import { useAtom, useAtomValue, useSetAtom } from 'jotai';
import { useNavigate } from 'react-router-dom';
import { DEFAULT_SUBSCRIPTION, LOCAL_CHAIN_REGISTRY, ROUTES } from '@/constants';
import { Button, Separator } from '@/ui-kit';
import { Asset, SubscriptionRecord } from '@/types';
import { saveAccountByID } from '@/helpers/dataHelpers/account';
import { userAccountAtom } from '@/atoms/accountAtom';

interface EditCoinListScreenProps {
  useCloseIcon?: boolean;
}

const PAGE_TITLE = 'Select Visible Coins';

// TODO: make registry, add github action to auto-update entries based on items in pull request. then sort?
// TODO: save registry info into localStorage, set default data expiration to one day
// TODO: pull registry info whenever data is empty or data expires
export const EditCoinListScreen: React.FC<EditCoinListScreenProps> = ({ useCloseIcon = false }) => {
  const navigate = useNavigate();

  const isInitialDataLoad = useAtomValue(isInitialDataLoadAtom);
  const [selectedCoins, setSelectedCoins] = useAtom(selectedCoinListAtom);
  const filteredExchangeCoins = useAtomValue(filteredExchangeAssetsAtom);
  const setSearchTerm = useSetAtom(dialogSearchTermAtom);
  const setSortOrder = useSetAtom(assetDialogSortOrderAtom);
  const setSortType = useSetAtom(assetDialogSortTypeAtom);
  const [userAccount, setUserAccount] = useAtom(userAccountAtom);

  const allCoinsSelected = selectedCoins.length === filteredExchangeCoins.length;
  const noCoinsSelected = selectedCoins.length === 0;

  // Store initial settings to revert to them on cancel
  const initialSettings = {
    subscribedTo:
      userAccount?.settings.subscribedTo &&
      Object.keys(userAccount.settings.subscribedTo).length > 0
        ? userAccount.settings.subscribedTo
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
      const updatedSubscriptions: { [networkID: string]: SubscriptionRecord } = {};

      // TODO: change page's save structure to reflect subscription/registry structure to prevent excess looping here
      Object.keys(LOCAL_CHAIN_REGISTRY).forEach(networkID => {
        const networkAssets = LOCAL_CHAIN_REGISTRY[networkID]?.assets || {};
        const networkCoinDenoms = Object.keys(networkAssets);

        const selectedNetworkCoins = selectedCoins
          .filter(coin => coin.networkID === networkID)
          .map(coin => coin.denom);

        if (selectedNetworkCoins.length === networkCoinDenoms.length) {
          // All coins in the network are selected, so save as an empty array
          updatedSubscriptions[networkID] = { coinDenoms: [] };
        } else if (selectedNetworkCoins.length > 0) {
          // Partial selection, save the selected denoms
          updatedSubscriptions[networkID] = { coinDenoms: selectedNetworkCoins };
        }
      });

      const updatedUserAccount = {
        ...userAccount,
        settings: {
          ...userAccount.settings,
          subscribedTo: updatedSubscriptions,
        },
      };

      // Update state and save to local storage
      setUserAccount(updatedUserAccount);
      saveAccountByID(updatedUserAccount);
    }

    closeAndReturn();
  };

  const cancel = () => {
    if (userAccount) {
      // Restore the initial settings
      userAccount.settings.subscribedTo = initialSettings.subscribedTo;
      saveAccountByID(userAccount);
    }

    closeAndReturn();
  };

  useEffect(() => {
    if (userAccount) {
      const initialCoins: Asset[] = [];

      Object.entries(userAccount.settings.subscribedTo).forEach(([networkID, subscription]) => {
        const networkAssets = LOCAL_CHAIN_REGISTRY[networkID]?.assets;

        if (!networkAssets) return;

        if (subscription.coinDenoms.length === 0) {
          initialCoins.push(...Object.values(networkAssets));
        } else {
          subscription.coinDenoms.forEach(denom => {
            const asset = networkAssets[denom];
            if (asset) {
              initialCoins.push(asset);
            }
          });
        }
      });

      setSelectedCoins(initialCoins);
    }
  }, []);

  return (
    <div className="h-screen flex flex-col bg-black text-white">
      <PageTitle title={PAGE_TITLE} useCloseIcon={useCloseIcon} handleBackClick={cancel} />

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
          <SortDialog isValidatorSort isDialog />
        </div>
      </div>

      <div className="flex-grow px-4 flex flex-col overflow-hidden">
        {isInitialDataLoad ? (
          <Loader />
        ) : (
          // TODO: create CategoryTiles option or new component that allows for animated tile inclusion
          <TileScroller
            activeIndex={0}
            onSelectAsset={handleSelectCoin}
            isSelectable
            isDialog
            isReceiveDialog
            multiSelectEnabled
          />
        )}
        <SearchBar />
      </div>

      <Separator variant="top" />
      <div className="flex justify-center mb-4">
        <Button
          className="w-[56%] text-center"
          disabled={selectedCoins.length === 0}
          onClick={() => confirmSelection()}
        >
          Confirm
        </Button>
      </div>
    </div>
  );
};
