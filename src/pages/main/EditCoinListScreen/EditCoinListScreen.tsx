import React, { useEffect } from 'react';
import { Loader, SearchBar, SortDialog, TileScroller } from '@/components';
import {
  assetDialogSortOrderAtom,
  assetDialogSortTypeAtom,
  dialogSearchTermAtom,
  filteredAssetsAtom,
  filteredExchangeAssetsAtom,
  isInitialDataLoadAtom,
  selectedCoinListAtom,
} from '@/atoms';
import { useAtom, useAtomValue, useSetAtom } from 'jotai';
import { NavLink, useNavigate } from 'react-router-dom';
import { DEFAULT_ASSET, LOCAL_CHAIN_REGISTRY, ROUTES } from '@/constants';
import { X } from '@/assets/icons';
import { Button, Separator } from '@/ui-kit';
import { Asset } from '@/types';
import { saveAccountByID } from '@/helpers/dataHelpers/account';
import { userAccountAtom } from '@/atoms/accountAtom';

interface EditCoinListScreenProps {}

const PAGE_TITLE = 'Select Visible Coins';

// TODO: make registry, add github action to auto-update entries based on items in pull request. then sort?
// TODO: save registry info into localStorage, set default data expiration to one day
// TODO: pull registry info whenever data is empty or data expires
export const EditCoinListScreen: React.FC<EditCoinListScreenProps> = ({}) => {
  const navigate = useNavigate();

  const isInitialDataLoad = useAtomValue(isInitialDataLoadAtom);
  const [selectedCoins, setSelectedCoins] = useAtom(selectedCoinListAtom);
  const filteredCoins = useAtomValue(filteredAssetsAtom);
  const filteredExchangeCoins = useAtomValue(filteredExchangeAssetsAtom);
  const setSearchTerm = useSetAtom(dialogSearchTermAtom);
  const setSortOrder = useSetAtom(assetDialogSortOrderAtom);
  const setSortType = useSetAtom(assetDialogSortTypeAtom);
  const [userAccount, setUserAccount] = useAtom(userAccountAtom);

  const allCoinsSelected = selectedCoins.length === filteredExchangeCoins.length;
  const noCoinsSelected = selectedCoins.length === 0;

  // Store initial settings to revert to them on cancel
  const initialSettings = {
    visibleCoins: userAccount?.settings.visibleCoins || [DEFAULT_ASSET.denom],
    visibleNetworks: userAccount?.settings.visibleNetworks || [
      LOCAL_CHAIN_REGISTRY.Symphony.chainID,
    ],
  };

  console.log('Page loaded. Initial selected coins:', initialSettings.visibleCoins);

  const resetDefaults = () => {
    console.log('Resetting search and sort defaults.');
    setSearchTerm('');
    setSortOrder('Desc');
    setSortType('name');
  };

  const getChainsByDenom = (denom: string) => {
    const chains = Object.entries(LOCAL_CHAIN_REGISTRY)
      .filter(([_, chain]) => Object.values(chain.assets).some(asset => asset.denom === denom))
      .map(([chainName, _]) => chainName);

    console.log(`Chains for denom ${denom}:`, chains);
    return chains;
  };

  const handleSelectAll = () => {
    console.log('Selecting all coins.');
    setSelectedCoins(filteredExchangeCoins);
  };

  const handleSelectNone = () => {
    console.log('Deselecting all coins.');
    setSelectedCoins([]);
  };

  const closeAndReturn = () => {
    resetDefaults();
    navigate(ROUTES.APP.ROOT);
  };

  const handleSelectCoin = (coin: Asset) => {
    console.log('Toggling selection for coin:', coin);
    setSelectedCoins(prevSelectedCoins => {
      const isAlreadySelected = prevSelectedCoins.some(
        selectedCoin => selectedCoin.denom === coin.denom,
      );

      const updatedCoins = isAlreadySelected
        ? prevSelectedCoins.filter(selectedCoin => selectedCoin.denom !== coin.denom)
        : [...prevSelectedCoins, coin];

      console.log('Updated selected coins:', updatedCoins);
      return updatedCoins;
    });
  };

  const confirmSelection = () => {
    if (userAccount) {
      const visibleNetworks = new Set<string>();
      const visibleCoins = new Set<string>();

      // TODO: with multi-coin support, change to select specific coin and chain by sorted category and selection
      selectedCoins.forEach(coin => {
        const chains = getChainsByDenom(coin.denom);
        chains.forEach(chain => visibleNetworks.add(chain));
        visibleCoins.add(coin.denom);
      });

      const updatedUserAccount = {
        ...userAccount,
        settings: {
          ...userAccount.settings,
          visibleNetworks: Array.from(visibleNetworks),
          visibleCoins: Array.from(visibleCoins),
        },
      };

      // Update state and save to local storage
      setUserAccount(updatedUserAccount);
      saveAccountByID(updatedUserAccount);

      console.log(
        'Confirming selection. Updated user account settings:',
        updatedUserAccount.settings,
      );
    }

    closeAndReturn();
  };

  const cancel = () => {
    if (userAccount) {
      // Restore the initial settings
      userAccount.settings.visibleNetworks = initialSettings.visibleNetworks;
      userAccount.settings.visibleCoins = initialSettings.visibleCoins;
      console.log('Canceling. Restoring original user account settings:', userAccount.settings);
      saveAccountByID(userAccount);
    }

    closeAndReturn();
  };

  useEffect(() => {
    // Set initial selected coins and networks if not already set
    if (userAccount) {
      if (userAccount.settings.visibleCoins.length === 0) {
        setSelectedCoins([DEFAULT_ASSET]);
        userAccount.settings.visibleCoins = [DEFAULT_ASSET.denom];
      } else {
        setSelectedCoins(filteredCoins);
      }

      if (userAccount.settings.visibleNetworks.length === 0) {
        userAccount.settings.visibleNetworks = [LOCAL_CHAIN_REGISTRY.Symphony.chainID];
      }

      setUserAccount(userAccount);
    }
  }, []);

  return (
    <div className="h-screen flex flex-col bg-black text-white">
      {/* Top bar with back button and title */}
      <div className="flex justify-between items-center w-full p-5">
        <NavLink
          to={ROUTES.APP.ROOT}
          className="flex items-center justify-center max-w-5 max-h-5 p-0.5"
          onClick={cancel}
        >
          <X className="w-full h-full text-white" />
        </NavLink>
        <div>
          <h1 className="text-h5 text-white font-bold">{PAGE_TITLE}</h1>
        </div>
        <div className="max-w-5 w-full max-h-5" />
      </div>

      <Separator />

      {/* TODO: extract the below items from here and assetselectdialog to external component */}
      <div className="flex pt-2 px-4 justify-between items-center px-2">
        <div className="text-sm">Tap to select</div>
        <div className="flex items-center">
          <p className="text-sm pr-1">Select:</p>
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
      <Button
        className="w-[56%]"
        disabled={selectedCoins.length === 0}
        onClick={() => confirmSelection()}
      >
        Confirm
      </Button>
    </div>
  );
};
