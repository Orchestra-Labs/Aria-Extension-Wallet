import React from 'react';
import { Button, SlideTray } from '@/ui-kit';
import { Sort } from '@/assets/icons';
import { useAtom, useAtomValue } from 'jotai';
import {
  assetSortOrderAtom,
  assetSortTypeAtom,
  validatorSortOrderAtom,
  validatorSortTypeAtom,
  assetDialogSortOrderAtom,
  assetDialogSortTypeAtom,
  validatorDialogSortOrderAtom,
  validatorDialogSortTypeAtom,
  validatorStatusFilterAtom,
  swiperIndexState,
  userAccountAtom,
  chainSortOrderAtom,
  chainDialogSortOrderAtom,
} from '@/atoms';
import {
  AssetSortType,
  SearchType,
  SortOrder,
  ValidatorSortType,
  ValidatorStatusFilter,
} from '@/constants';

interface SortDialogProps {
  searchType: SearchType;
  isDialog?: boolean;
}

export const SortDialog: React.FC<SortDialogProps> = ({ searchType, isDialog = false }) => {
  const userAccount = useAtomValue(userAccountAtom);
  const [validatorStatusFilter, setValidatorStatusFilter] = useAtom(validatorStatusFilterAtom);
  // TODO: move away from active index
  const activeIndex = useAtomValue(swiperIndexState);
  const [chainSortOrder, setChainSortOrder] = useAtom(
    isDialog ? chainDialogSortOrderAtom : chainSortOrderAtom,
  );
  const [assetSortOrder, setAssetSortOrder] = useAtom(
    isDialog ? assetDialogSortOrderAtom : assetSortOrderAtom,
  );
  const [validatorSortOrder, setValidatorSortOrder] = useAtom(
    isDialog ? validatorDialogSortOrderAtom : validatorSortOrderAtom,
  );
  const [assetSortType, setAssetSortType] = useAtom(
    isDialog ? assetDialogSortTypeAtom : assetSortTypeAtom,
  );
  const [validatorSortType, setValidatorSortType] = useAtom(
    isDialog ? validatorDialogSortTypeAtom : validatorSortTypeAtom,
  );

  const sortOptions =
    searchType === SearchType.VALIDATOR
      ? Object.values(ValidatorSortType)
      : searchType === SearchType.ASSET
        ? ['name', 'amount']
        : [];

  const setSortOrder = (sortOrder: SortOrder) => {
    switch (searchType) {
      case SearchType.VALIDATOR:
        setValidatorSortOrder(sortOrder);
        break;
      case SearchType.ASSET:
        setAssetSortOrder(sortOrder);
        break;
      case SearchType.CHAIN:
        setChainSortOrder(sortOrder);
        break;
    }
  };

  const setSortType = (sortType: string) => {
    searchType === SearchType.VALIDATOR
      ? setValidatorSortType(sortType as any)
      : setAssetSortType(sortType as any);
  };

  const resetDefaults = () => {
    setSortOrder(SortOrder.DESC);
    if (searchType !== SearchType.CHAIN) {
      setSortType(searchType === SearchType.ASSET ? AssetSortType.NAME : ValidatorSortType.NAME);
    }
    if (searchType === SearchType.VALIDATOR) {
      setValidatorStatusFilter(ValidatorStatusFilter.STATUS_ACTIVE);
    }
  };

  const sortOrder =
    searchType === SearchType.VALIDATOR
      ? validatorSortOrder
      : searchType === SearchType.ASSET
        ? assetSortOrder
        : chainSortOrder;
  const sortType = searchType === SearchType.VALIDATOR ? validatorSortType : assetSortType;

  const viewValidatorsByStatus = userAccount?.settings.viewValidatorsByStatus;
  const trayHeight =
    searchType === SearchType.VALIDATOR && viewValidatorsByStatus
      ? '50%'
      : searchType === SearchType.CHAIN
        ? '39%'
        : activeIndex === 0
          ? '45%'
          : '48%';

  return (
    <SlideTray
      triggerComponent={
        <Button
          className="rounded-full bg-transparent text-neutral-1 p-[7px] hover:bg-blue-hover-secondary hover:text-blue-dark active:bg-blue-pressed-secondary active:text-black"
          size="rounded-default"
        >
          <Sort width={20} className="text-white" />
        </Button>
      }
      title={'Sort Options'}
      showBottomBorder
      height={trayHeight}
    >
      <div className="flex flex-col items-center space-y-2">
        <div className="relative w-full">
          {/* Sort Order Selection */}
          <div className="flex justify-between items-center p-2">
            <div className="flex-1 text-sm">Order:</div>
            <div className="flex items-center">
              <Button
                variant={sortOrder === SortOrder.ASC ? 'selected' : 'unselected'}
                size="xsmall"
                className="px-1 rounded-md text-xs"
                onClick={() => setSortOrder(SortOrder.ASC)}
              >
                Asc
              </Button>
              <p className="text-sm px-1">/</p>
              <Button
                variant={sortOrder === SortOrder.DESC ? 'selected' : 'unselected'}
                size="xsmall"
                className="px-1 rounded-md text-xs"
                onClick={() => setSortOrder(SortOrder.DESC)}
              >
                Desc
              </Button>
            </div>
          </div>

          {/* Sort Type Selection */}
          {searchType !== SearchType.CHAIN && (
            <div className="flex justify-between items-start p-2">
              <div className="text-sm pt-[2px] flex-none">Sort by:</div>
              <div className="flex flex-wrap justify-center gap-y-1">
                {sortOptions.map((option, index) => (
                  <div key={option} className="flex items-center">
                    {index > 0 && <span className="text-sm px-0.5">/</span>}
                    <Button
                      variant={sortType === option ? 'selected' : 'unselected'}
                      size="xsmall"
                      className="px-1 rounded-md text-xs"
                      onClick={() => setSortType(option)}
                    >
                      {option.charAt(0).toUpperCase() + option.slice(1)}
                    </Button>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* Status Filter */}
          {searchType === SearchType.VALIDATOR && viewValidatorsByStatus && (
            <div className="flex justify-between items-center p-2">
              <div className="flex-1 text-sm">Filter by Status:</div>
              <div className="flex items-center">
                {[
                  ValidatorStatusFilter.STATUS_ACTIVE,
                  ValidatorStatusFilter.STATUS_NON_JAILED,
                  ValidatorStatusFilter.STATUS_ALL,
                ].map(status => (
                  <React.Fragment key={status}>
                    <Button
                      variant={validatorStatusFilter === status ? 'selected' : 'unselected'}
                      size="xsmall"
                      className="px-1 rounded-md text-xs"
                      onClick={() => setValidatorStatusFilter(status)}
                    >
                      {status === ValidatorStatusFilter.STATUS_ACTIVE
                        ? 'Active'
                        : status === ValidatorStatusFilter.STATUS_NON_JAILED
                          ? 'Non-Jailed'
                          : 'All'}
                    </Button>
                    {status !== ValidatorStatusFilter.STATUS_ALL && (
                      <p className="text-sm px-1">/</p>
                    )}
                  </React.Fragment>
                ))}
              </div>
            </div>
          )}

          <div className="flex justify-center items-center p-2">
            <Button
              variant="unselected"
              size="small"
              className="px-1 rounded-md text-xs"
              onClick={resetDefaults}
            >
              Reset Defaults
            </Button>
          </div>
        </div>
      </div>
    </SlideTray>
  );
};
