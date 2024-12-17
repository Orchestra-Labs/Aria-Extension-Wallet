import { Asset, CombinedStakingInfo } from '@/types';
import { stripNonAlphanumerics } from './formatString';
import { BondStatus, ValidatorSortType, ValidatorStatusFilter } from '@/constants';

export function filterAndSortAssets(
  assets: Asset[],
  searchTerm: string,
  sortType: 'name' | 'amount',
  sortOrder: 'Asc' | 'Desc',
  showAllAssets: boolean = true,
): typeof assets {
  const lowercasedSearchTerm = searchTerm.toLowerCase();

  // Filter assets based on search term
  const filteredAssets = assets.filter(
    asset =>
      asset.denom.toLowerCase().includes(lowercasedSearchTerm) ||
      asset.symbol?.toLowerCase().includes(lowercasedSearchTerm),
  );

  // Filter for non-zero values if required
  const finalAssets = showAllAssets
    ? filteredAssets
    : filteredAssets.filter(asset => parseFloat(asset.amount) > 0);

  // Sort the assets based on type and order
  return finalAssets.sort((a, b) => {
    let valueA: string | number;
    let valueB: string | number;

    if (sortType === 'name') {
      valueA = stripNonAlphanumerics(a.symbol?.toLowerCase() || a.denom.toLowerCase());
      valueB = stripNonAlphanumerics(b.symbol?.toLowerCase() || b.denom.toLowerCase());

      return sortOrder === 'Asc'
        ? valueA.localeCompare(valueB, undefined, { sensitivity: 'base' })
        : valueB.localeCompare(valueA, undefined, { sensitivity: 'base' });
    } else {
      valueA = parseFloat(a.amount);
      valueB = parseFloat(b.amount);
    }

    if (sortOrder === 'Asc') {
      return valueA > valueB ? 1 : -1;
    } else {
      return valueA < valueB ? 1 : -1;
    }
  });
}

const statusMatch = (validator: CombinedStakingInfo, statusFilter: ValidatorStatusFilter) => {
  // TODO: make this a maleable parameter to return non-bonded validators too
  if (statusFilter === ValidatorStatusFilter.STATUS_ACTIVE) {
    return validator.validator.status === BondStatus.BONDED;
  } else if (statusFilter === ValidatorStatusFilter.STATUS_NON_JAILED) {
    return !validator.validator.jailed;
  } else {
    return true;
  }
};

const hasUserActivity = (validator: CombinedStakingInfo) => {
  const isDelegatedTo = parseFloat(validator.balance.amount) > 0;
  const isUnbondingFrom =
    validator.unbondingBalance && parseFloat(validator.unbondingBalance.balance) > 0;
  const userEngaged = isDelegatedTo || isUnbondingFrom;

  return userEngaged;
};

export function filterAndSortValidators(
  validators: CombinedStakingInfo[],
  searchTerm: string,
  sortType: ValidatorSortType,
  sortOrder: 'Asc' | 'Desc',
  showCurrentValidators: boolean,
  statusFilter: ValidatorStatusFilter,
): typeof validators {
  const lowercasedSearchTerm = searchTerm.toLowerCase();

  const filteredByStatus = validators.filter(validator => {
    const shouldIncludeValidator =
      statusMatch(validator, statusFilter) || hasUserActivity(validator);

    return shouldIncludeValidator;
  });

  const filteredValidators = filteredByStatus.filter(validator => {
    const matchesSearch = validator.validator.description.moniker
      .toLowerCase()
      .includes(lowercasedSearchTerm);
    return matchesSearch;
  });

  const finalValidators = showCurrentValidators
    ? filteredValidators.filter(validator => hasUserActivity(validator))
    : filteredValidators;

  return finalValidators.sort((a, b) => {
    let valueA, valueB;

    switch (sortType) {
      case ValidatorSortType.NAME:
        valueA = stripNonAlphanumerics(a.validator.description.moniker.toLowerCase());
        valueB = stripNonAlphanumerics(b.validator.description.moniker.toLowerCase());
        return sortOrder === 'Asc'
          ? valueA.localeCompare(valueB, undefined, { sensitivity: 'base' })
          : valueB.localeCompare(valueA, undefined, { sensitivity: 'base' });

      case ValidatorSortType.DELEGATION:
        valueA = parseFloat(a.delegation.shares);
        valueB = parseFloat(b.delegation.shares);
        break;

      case ValidatorSortType.REWARDS:
        valueA = a.rewards.reduce((sum, reward) => sum + parseFloat(reward.amount), 0);
        valueB = b.rewards.reduce((sum, reward) => sum + parseFloat(reward.amount), 0);
        break;

      case ValidatorSortType.APY:
        valueA = parseFloat(a.estimatedReturn ?? '0');
        valueB = parseFloat(b.estimatedReturn ?? '0');
        break;

      case ValidatorSortType.VOTING_POWER:
        valueA = parseFloat(a.votingPower ?? '0');
        valueB = parseFloat(b.votingPower ?? '0');
        break;
    }

    return sortOrder === 'Asc' ? (valueA > valueB ? 1 : -1) : valueA < valueB ? 1 : -1;
  });
}
