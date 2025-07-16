import { atom } from 'jotai';

import {
  dialogSearchTermAtom,
  searchTermAtom,
  validatorDialogSortOrderAtom,
  validatorDialogSortTypeAtom,
  validatorSortOrderAtom,
  validatorSortTypeAtom,
} from '@/atoms';
import { ValidatorStatusFilter } from '@/constants';
import { filterAndSortValidators } from '@/helpers';
import { CombinedStakingInfo } from '@/types';

export const showCurrentValidatorsAtom = atom<boolean>(true);
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
  const showCurrentValidators = get(showCurrentValidatorsAtom);
  const statusFilter = get(validatorStatusFilterAtom);

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
