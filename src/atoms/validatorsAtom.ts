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

export const showCurrentValsOverrideAtom = atom<boolean | null>(null);
export const showCurrentValidatorsAtom = atom(
  get => {
    const validatorData = get(validatorDataAtom);
    const hasStakedValidators = validatorData.some(
      validator => parseFloat(validator.balance.amount) > 0,
    );
    return hasStakedValidators;
  },
  (_, set, newValue: boolean) => {
    // Allow manual override
    set(showCurrentValsOverrideAtom, newValue);
  },
);

// Add this new atom to track manual overrides
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

  // Get both the automatic and manual states
  const autoShowCurrent = get(showCurrentValidatorsAtom);
  const manualOverride = get(showCurrentValsOverrideAtom);

  // Determine which value to use (manual override takes precedence)
  const showCurrentValidators = manualOverride !== null ? manualOverride : autoShowCurrent;

  console.group('[filteredValidatorsAtom]');
  console.log('validatorData length:', validatorData.length);
  console.log('hasStakedValidators:', autoShowCurrent);
  console.log('manualOverride:', manualOverride);
  console.log('effective showCurrentValidators:', showCurrentValidators);
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
