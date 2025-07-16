import { useAtom, useAtomValue } from 'jotai';
import React from 'react';

import { Sort } from '@/assets/icons';
import {
  assetDialogSortOrderAtom,
  assetDialogSortTypeAtom,
  assetSortOrderAtom,
  assetSortTypeAtom,
  swiperIndexState,
  validatorDialogSortOrderAtom,
  validatorDialogSortTypeAtom,
  validatorSortOrderAtom,
  validatorSortTypeAtom,
  validatorStatusFilterAtom,
} from '@/atoms';
import { userAccountAtom } from '@/atoms/accountAtom';
import { ValidatorSortType, ValidatorStatusFilter } from '@/constants';
import { Button, SlideTray } from '@/ui-kit';

interface SortDialogProps {
  isValidatorSort?: boolean;
  isDialog?: boolean;
}

export const SortDialog: React.FC<SortDialogProps> = ({
  isValidatorSort = false,
  isDialog = false,
}) => {
  const userAccount = useAtomValue(userAccountAtom);
  const [validatorStatusFilter, setValidatorStatusFilter] = useAtom(validatorStatusFilterAtom);
  const activeIndex = useAtomValue(swiperIndexState);

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

  const sortOptions = isValidatorSort ? Object.values(ValidatorSortType) : ['name', 'amount'];

  const setSortOrder = (sortOrder: 'Asc' | 'Desc') => {
    isValidatorSort ? setValidatorSortOrder(sortOrder) : setAssetSortOrder(sortOrder);
  };

  const setSortType = (sortType: string) => {
    isValidatorSort ? setValidatorSortType(sortType as any) : setAssetSortType(sortType as any);
  };

  const resetDefaults = () => {
    isValidatorSort ? setValidatorSortOrder('Desc') : setAssetSortOrder('Desc');
    isValidatorSort ? setValidatorSortType(ValidatorSortType.NAME) : setAssetSortType('name');
    setValidatorStatusFilter(ValidatorStatusFilter.STATUS_ACTIVE);
  };

  const sortOrder = isValidatorSort ? validatorSortOrder : assetSortOrder;
  const sortType = isValidatorSort ? validatorSortType : assetSortType;

  const viewValidatorsByStatus = userAccount?.settings.viewValidatorsByStatus;
  const trayHeight =
    isValidatorSort && viewValidatorsByStatus ? '50%' : activeIndex === 0 ? '45%' : '48%';

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
                variant={sortOrder === 'Asc' ? 'selected' : 'unselected'}
                size="xsmall"
                className="px-1 rounded-md text-xs"
                onClick={() => setSortOrder('Asc')}
              >
                Asc
              </Button>
              <p className="text-sm px-1">/</p>
              <Button
                variant={sortOrder === 'Desc' ? 'selected' : 'unselected'}
                size="xsmall"
                className="px-1 rounded-md text-xs"
                onClick={() => setSortOrder('Desc')}
              >
                Desc
              </Button>
            </div>
          </div>

          {/* Sort Type Selection */}
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

          {/* Status Filter */}
          {isValidatorSort && viewValidatorsByStatus && (
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
