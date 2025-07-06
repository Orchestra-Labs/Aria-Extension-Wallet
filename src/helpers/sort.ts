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
  console.log('[sort] input assets:', assets);
  console.log('[sort] searchTerm:', searchTerm);

  const lowercasedSearchTerm = searchTerm.toLowerCase();

  const filteredAssets = assets.filter(asset => {
    const searchFields = [
      asset.denom.toLowerCase(),
      asset.symbol?.toLowerCase(),
      asset.name?.toLowerCase(),
      asset.networkName.toLowerCase(),
      asset.networkID.toLowerCase(),
    ].filter(Boolean);
    return searchFields.some(field => field.includes(lowercasedSearchTerm));
  });

  // Filter for non-zero values if required
  console.log('[sort] filtered assets:', filteredAssets);

  const finalAssets = showAllAssets
    ? filteredAssets
    : filteredAssets.filter(asset => parseFloat(asset.amount) > 0);

  // Sort the assets based on type and order
  console.log('[sort] final assets to sort:', finalAssets);

  return finalAssets.sort((a, b) => {
    if (sortType === 'name') {
      // NOTE: if putting name before symbol, change it here
      const getPriorityFields = (asset: Asset) =>
        [
          asset.symbol.toLowerCase(),
          asset.name.toLowerCase(),
          asset.networkName.toLowerCase(),
          asset.denom.toLowerCase(),
          asset.networkID.toLowerCase(),
        ].map(val => stripNonAlphanumerics(val || ''));

      const [a1, a2, a3, a4, a5] = getPriorityFields(a);
      const [b1, b2, b3, b4, b5] = getPriorityFields(b);

      console.log('[sort] comparing A:', [a1, a2, a3, a4, a5]);
      console.log('[sort] comparing B:', [b1, b2, b3, b4, b5]);

      const compareChain = [a1, a2, a3, a4, a5].map((val, idx) => {
        return val.localeCompare([b1, b2, b3, b4, b5][idx], undefined, { sensitivity: 'base' });
      });

      const result = compareChain.find(res => res !== 0) ?? 0;
      console.log('[sort] name sort result:', result);
      return sortOrder === 'Asc' ? result : -result;
    } else {
      const valueA = parseFloat(a.amount);
      const valueB = parseFloat(b.amount);
      console.log('[sort] amount sort values:', valueA, valueB);

      if (sortOrder === 'Asc') {
        return valueA > valueB ? 1 : -1;
      } else {
        return valueA < valueB ? 1 : -1;
      }
    }
  });
}

const statusMatch = (validator: CombinedStakingInfo, statusFilter: ValidatorStatusFilter) => {
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

      case ValidatorSortType.APR:
        valueA = parseFloat(a.theoreticalApr ?? '0');
        valueB = parseFloat(b.theoreticalApr ?? '0');
        break;

      case ValidatorSortType.VOTING_POWER:
        valueA = parseFloat(a.votingPower ?? '0');
        valueB = parseFloat(b.votingPower ?? '0');
        break;

      case ValidatorSortType.UPTIME:
        valueA = parseFloat(a.uptime ?? '0');
        valueB = parseFloat(b.uptime ?? '0');
        break;
    }

    return sortOrder === 'Asc' ? (valueA > valueB ? 1 : -1) : valueA < valueB ? 1 : -1;
  });
}
