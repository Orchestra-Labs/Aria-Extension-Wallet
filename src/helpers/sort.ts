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
  console.groupCollapsed('[filterAndSortAssets] Processing assets');
  console.log('[filterAndSortAssets] Input assets count:', assets.length);

  // Create a new array for filtering
  let filteredAssets = [...assets];

  // Filter by search term if provided
  if (searchTerm) {
    const lowercasedSearchTerm = searchTerm.toLowerCase();
    filteredAssets = filteredAssets.filter(asset => {
      const matches = [
        asset.denom.toLowerCase(),
        asset.symbol?.toLowerCase(),
        asset.name?.toLowerCase(),
        asset.networkName.toLowerCase(),
        asset.networkID.toLowerCase(),
      ].some(field => field?.includes(lowercasedSearchTerm));

      if (!matches) {
        console.log(`[filterAndSortAssets] Filtering out ${asset.denom} - no search match`);
      }
      return matches;
    });
  }

  // Filter by non-zero amounts if required
  if (!showAllAssets) {
    filteredAssets = filteredAssets.filter(asset => {
      const hasBalance = parseFloat(asset.amount) > 0;
      if (!hasBalance) {
        console.log(`[filterAndSortAssets] Filtering out ${asset.denom} - zero balance`);
      }
      return hasBalance;
    });
  }

  // Create a new array for sorting
  const sortedAssets = [...filteredAssets].sort((a, b) => {
    if (sortType === 'name') {
      const aFields = [
        a.symbol?.toLowerCase(),
        a.name?.toLowerCase(),
        a.networkName.toLowerCase(),
        a.denom.toLowerCase(),
        a.networkID.toLowerCase(),
      ].map(f => stripNonAlphanumerics(f || ''));

      const bFields = [
        b.symbol?.toLowerCase(),
        b.name?.toLowerCase(),
        b.networkName.toLowerCase(),
        b.denom.toLowerCase(),
        b.networkID.toLowerCase(),
      ].map(f => stripNonAlphanumerics(f || ''));

      const comparison =
        aFields
          .map((val, idx) => val.localeCompare(bFields[idx], undefined, { sensitivity: 'base' }))
          .find(res => res !== 0) || 0;

      return sortOrder === 'Asc' ? comparison : -comparison;
    } else {
      const valueA = parseFloat(a.amount);
      const valueB = parseFloat(b.amount);
      return sortOrder === 'Asc' ? (valueA > valueB ? 1 : -1) : valueA < valueB ? 1 : -1;
    }
  });

  console.log('[filterAndSortAssets] Final count:', sortedAssets.length);
  console.table(
    sortedAssets.map(a => ({
      denom: a.denom,
      symbol: a.symbol,
      amount: a.amount,
      isIbc: a.isIbc,
      network: a.networkName,
    })),
  );
  console.groupEnd();

  return sortedAssets;
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
