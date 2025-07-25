import { CombinedStakingInfo } from '@/types';
import { atom } from 'jotai';
import {
  validatorSortOrderAtom,
  validatorSortTypeAtom,
  searchTermAtom,
  dialogSearchTermAtom,
  validatorDialogSortOrderAtom,
  validatorDialogSortTypeAtom,
} from '@/atoms';
import { filterAndSortValidators } from '@/helpers';
import { ValidatorStatusFilter } from '@/constants';

const _showCurrentValidatorsOverrideAtom = atom<boolean | null>(null);
const _autoShowCurrentValidatorsAtom = atom(get => {
  const validatorData = get(validatorDataAtom);
  return validatorData.some(validator => parseFloat(validator.balance.amount) > 0);
});

// Public combined atom (similar to selectedAssetAtom)
export const showCurrentValidatorsAtom = atom(
  get => {
    const override = get(_showCurrentValidatorsOverrideAtom);
    const autoValue = get(_autoShowCurrentValidatorsAtom);
    return override !== null ? override : autoValue;
  },
  (_, set, newValue: boolean) => {
    set(_showCurrentValidatorsOverrideAtom, newValue);
  },
);

export const validatorDataAtom = atom<CombinedStakingInfo[]>([]);
export const selectedValidatorsAtom = atom<CombinedStakingInfo[]>([]);
export const validatorStatusFilterAtom = atom<ValidatorStatusFilter>(
  ValidatorStatusFilter.STATUS_ACTIVE,
);

export const filteredValidatorsAtom = atom(get => {
  const validatorData = get(validatorDataAtom);
  const searchTerm = get(searchTermAtom);
  const sortOrder = get(validatorSortOrderAtom);
  const sortType = get(validatorSortTypeAtom);
  const statusFilter = get(validatorStatusFilterAtom);
  const showCurrentValidators = get(showCurrentValidatorsAtom);

  console.group('[filteredValidatorsAtom]');
  console.log('validatorData length:', validatorData.length);
  console.log('showCurrentValidators:', showCurrentValidators);
  console.groupEnd();

  return filterAndSortValidators(
    validatorData,
    searchTerm,
    sortType,
    sortOrder,
    showCurrentValidators,
    statusFilter,
  );
});

export const filteredDialogValidatorsAtom = atom(get => {
  const validatorData = get(validatorDataAtom);
  const searchTerm = get(dialogSearchTermAtom);
  const sortOrder = get(validatorDialogSortOrderAtom);
  const sortType = get(validatorDialogSortTypeAtom);
  const statusFilter = get(validatorStatusFilterAtom);

  return filterAndSortValidators(
    validatorData,
    searchTerm,
    sortType,
    sortOrder,
    true,
    statusFilter,
  );
});
