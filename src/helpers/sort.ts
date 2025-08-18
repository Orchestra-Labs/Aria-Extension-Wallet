import { Asset, FullValidatorInfo, SimplifiedChainInfo } from '@/types';
import { safeTrimLowerCase, stripNonAlphanumerics } from './formatString';
import {
  AssetSortType,
  BondStatus,
  SortOrder,
  SYMPHONY_MAINNET_ID,
  SYMPHONY_TESTNET_ID,
  ValidatorSortType,
  ValidatorStatusFilter,
} from '@/constants';

function isPriorityCoin(asset: Asset): boolean {
  // Check if this is a fee token for its chain
  const isPriorityCoin = asset.isFeeToken || false;
  return isPriorityCoin;
}

function getSortValue(asset: Asset, sortType: AssetSortType): string {
  switch (sortType) {
    case AssetSortType.NAME:
      return safeTrimLowerCase(asset.name);
    case AssetSortType.AMOUNT:
      return asset.amount;
    default:
      return safeTrimLowerCase(asset.name);
  }
}

function sortAssets(
  assets: Asset[],
  searchTerm: string,
  sortType: AssetSortType,
  sortOrder: SortOrder,
): Asset[] {
  const lowercasedSearchTerm = safeTrimLowerCase(searchTerm);

  return assets.sort((a, b) => {
    // First, separate exact matches from partial matches
    const aExactMatches = {
      name: safeTrimLowerCase(a.name) === lowercasedSearchTerm,
      symbol: safeTrimLowerCase(a.symbol) === lowercasedSearchTerm,
      denom: safeTrimLowerCase(a.denom) === lowercasedSearchTerm,
      originDenom: a.originDenom
        ? safeTrimLowerCase(a.originDenom) === lowercasedSearchTerm
        : false,
      networkName: safeTrimLowerCase(a.networkName) === lowercasedSearchTerm,
      chainId: safeTrimLowerCase(a.chainId) === lowercasedSearchTerm,
    };

    const bExactMatches = {
      name: safeTrimLowerCase(b.name) === lowercasedSearchTerm,
      symbol: safeTrimLowerCase(b.symbol) === lowercasedSearchTerm,
      denom: safeTrimLowerCase(b.denom) === lowercasedSearchTerm,
      originDenom: b.originDenom
        ? safeTrimLowerCase(b.originDenom) === lowercasedSearchTerm
        : false,
      networkName: safeTrimLowerCase(b.networkName) === lowercasedSearchTerm,
      chainId: safeTrimLowerCase(b.chainId) === lowercasedSearchTerm,
    };

    const aHasExactMatch = Object.values(aExactMatches).some(match => match);
    const bHasExactMatch = Object.values(bExactMatches).some(match => match);

    // If one has exact matches and the other doesn't, prioritize the one with exact matches
    if (aHasExactMatch !== bHasExactMatch) {
      return aHasExactMatch ? -1 : 1;
    }

    // If both have exact matches, prioritize based on the order: name > symbol > denom > originDenom > networkName > chainId
    if (aHasExactMatch && bHasExactMatch) {
      const exactMatchOrder = ['name', 'symbol', 'denom', 'originDenom', 'networkName', 'chainId'];

      for (const field of exactMatchOrder) {
        const aMatch = aExactMatches[field as keyof typeof aExactMatches];
        const bMatch = bExactMatches[field as keyof typeof bExactMatches];

        if (aMatch !== bMatch) {
          return aMatch ? -1 : 1;
        }
      }

      // If all exact matches are equal, prioritize native assets (where denom === originDenom)
      const aIsNative =
        a.originDenom && safeTrimLowerCase(a.denom) === safeTrimLowerCase(a.originDenom);
      const bIsNative =
        b.originDenom && safeTrimLowerCase(b.denom) === safeTrimLowerCase(b.originDenom);

      if (aIsNative !== bIsNative) {
        return aIsNative ? -1 : 1;
      }
    }

    // For non-exact matches or when exact matches are equal, use the original sorting logic
    const valueA = getSortValue(a, sortType);
    const valueB = getSortValue(b, sortType);

    if (sortType === AssetSortType.NAME && lowercasedSearchTerm) {
      const aFields = [
        a.name,
        a.symbol,
        a.denom,
        a.originDenom || '',
        a.networkName,
        a.chainId,
      ].map(f => safeTrimLowerCase(f));

      const bFields = [
        b.name,
        b.symbol,
        b.denom,
        b.originDenom || '',
        b.networkName,
        b.chainId,
      ].map(f => safeTrimLowerCase(f));

      const aMatches = aFields.map(f => (f.includes(lowercasedSearchTerm) ? 1 : 0));
      const bMatches = bFields.map(f => (f.includes(lowercasedSearchTerm) ? 1 : 0));

      const aTotalMatches = aMatches.reduce((sum, m) => sum + m, 0 as number);
      const bTotalMatches = bMatches.reduce((sum, m) => sum + m, 0 as number);

      if (aTotalMatches !== bTotalMatches) {
        return bTotalMatches - aTotalMatches;
      }

      for (let i = 0; i < aMatches.length; i++) {
        if (aMatches[i] !== bMatches[i]) {
          return bMatches[i] - aMatches[i];
        }
      }

      // If still equal, prioritize native assets
      const aIsNative =
        a.originDenom && safeTrimLowerCase(a.denom) === safeTrimLowerCase(a.originDenom);
      const bIsNative =
        b.originDenom && safeTrimLowerCase(b.denom) === safeTrimLowerCase(b.originDenom);

      if (aIsNative !== bIsNative) {
        return aIsNative ? -1 : 1;
      }

      const aIsPriority = isPriorityCoin(a);
      const bIsPriority = isPriorityCoin(b);
      if (aIsPriority !== bIsPriority) {
        return aIsPriority ? -1 : 1;
      }

      const aIsSymphony = a.chainId === SYMPHONY_MAINNET_ID || a.chainId === SYMPHONY_TESTNET_ID;
      const bIsSymphony = b.chainId === SYMPHONY_MAINNET_ID || b.chainId === SYMPHONY_TESTNET_ID;
      if (aIsSymphony !== bIsSymphony) {
        return aIsSymphony ? -1 : 1;
      }
    }

    return sortOrder === SortOrder.ASC
      ? valueA.localeCompare(valueB)
      : valueB.localeCompare(valueA);
  });
}

// TODO: add filter for subscribed assets (a receive tile only selection)
export function filterAndSortAssets(
  assets: Asset[],
  searchTerm: string,
  sortType: AssetSortType,
  sortOrder: SortOrder,
  showAllAssets: boolean = true,
): Asset[] {
  const lowercasedSearchTerm = safeTrimLowerCase(searchTerm);

  console.log('[filterAndSortAssets] assets:', assets);
  // First filter the assets
  const filteredAssets = assets.filter(asset => {
    if (!showAllAssets && parseFloat(asset.amount) <= 0) return false;
    if (lowercasedSearchTerm) {
      return (
        safeTrimLowerCase(asset.name).includes(lowercasedSearchTerm) ||
        safeTrimLowerCase(asset.symbol).includes(lowercasedSearchTerm) ||
        safeTrimLowerCase(asset.denom).includes(lowercasedSearchTerm) ||
        safeTrimLowerCase(asset.originDenom).includes(lowercasedSearchTerm) ||
        safeTrimLowerCase(asset.networkName).includes(lowercasedSearchTerm) ||
        safeTrimLowerCase(asset.chainId).includes(lowercasedSearchTerm)
      );
    }
    return true;
  });

  // Then sort all assets together according to the specified rules
  return sortAssets(filteredAssets, searchTerm, sortType, sortOrder);
}

const statusMatch = (validator: FullValidatorInfo, statusFilter: ValidatorStatusFilter) => {
  if (statusFilter === ValidatorStatusFilter.STATUS_ACTIVE) {
    return validator.validator.status === BondStatus.BONDED;
  } else if (statusFilter === ValidatorStatusFilter.STATUS_NON_JAILED) {
    return !validator.validator.jailed;
  } else {
    return true;
  }
};

const hasUserActivity = (validator: FullValidatorInfo) => {
  const isDelegatedTo = parseFloat(validator.balance.amount) > 0;
  const isUnbondingFrom =
    validator.unbondingBalance && parseFloat(validator.unbondingBalance.balance) > 0;
  const userEngaged = isDelegatedTo || isUnbondingFrom;

  return userEngaged;
};

export function filterAndSortValidators(
  validators: FullValidatorInfo[],
  searchTerm: string,
  sortType: ValidatorSortType,
  sortOrder: SortOrder,
  showCurrentValidators: boolean,
  statusFilter: ValidatorStatusFilter,
): typeof validators {
  const lowercasedSearchTerm = safeTrimLowerCase(searchTerm);

  const filteredByStatus = validators.filter(validator => {
    const match = statusMatch(validator, statusFilter);
    const hasActivity = hasUserActivity(validator);
    return match || hasActivity;
  });

  const filteredValidators = filteredByStatus.filter(validator => {
    const moniker = safeTrimLowerCase(validator.validator.description.moniker);
    return moniker.includes(lowercasedSearchTerm);
  });

  const finalValidators = showCurrentValidators
    ? filteredValidators.filter(validator => hasUserActivity(validator))
    : filteredValidators;

  const sorted = finalValidators.sort((a, b) => {
    switch (sortType) {
      case ValidatorSortType.NAME: {
        const monikerA = stripNonAlphanumerics(safeTrimLowerCase(a.validator.description.moniker));
        const monikerB = stripNonAlphanumerics(safeTrimLowerCase(b.validator.description.moniker));
        return sortOrder === SortOrder.ASC
          ? monikerA.localeCompare(monikerB, undefined, { sensitivity: 'base' })
          : monikerB.localeCompare(monikerA, undefined, { sensitivity: 'base' });
      }

      case ValidatorSortType.DELEGATION: {
        const valueA = parseFloat(a.delegation.shares) || 0;
        const valueB = parseFloat(b.delegation.shares) || 0;

        if (sortOrder === SortOrder.ASC) {
          if (valueA === 0 && valueB !== 0) return -1;
          if (valueB === 0 && valueA !== 0) return 1;
          return valueA - valueB;
        } else {
          if (valueA === 0 && valueB !== 0) return 1;
          if (valueB === 0 && valueA !== 0) return -1;
          return valueB - valueA;
        }
      }

      case ValidatorSortType.REWARDS: {
        const valueA = a.rewards.reduce((sum, reward) => sum + parseFloat(reward.amount), 0);
        const valueB = b.rewards.reduce((sum, reward) => sum + parseFloat(reward.amount), 0);
        return sortOrder === SortOrder.ASC ? valueA - valueB : valueB - valueA;
      }

      case ValidatorSortType.APR: {
        const valueA = parseFloat(a.theoreticalApr ?? '0');
        const valueB = parseFloat(b.theoreticalApr ?? '0');
        return sortOrder === SortOrder.ASC ? valueA - valueB : valueB - valueA;
      }

      case ValidatorSortType.VOTING_POWER: {
        const valueA = parseFloat(a.votingPower ?? '0');
        const valueB = parseFloat(b.votingPower ?? '0');
        return sortOrder === SortOrder.ASC ? valueA - valueB : valueB - valueA;
      }

      case ValidatorSortType.UPTIME: {
        const valueA = parseFloat(a.uptime ?? '0');
        const valueB = parseFloat(b.uptime ?? '0');
        return sortOrder === SortOrder.ASC ? valueA - valueB : valueB - valueA;
      }

      default: {
        // Fallback to name sorting if unknown sort type
        const monikerA = stripNonAlphanumerics(safeTrimLowerCase(a.validator.description.moniker));
        const monikerB = stripNonAlphanumerics(safeTrimLowerCase(b.validator.description.moniker));
        return monikerA.localeCompare(monikerB, undefined, { sensitivity: 'base' });
      }
    }
  });

  return sorted;
}

export function filterAndSortDialogValidators(
  validators: FullValidatorInfo[],
  searchTerm: string,
  sortType: ValidatorSortType,
  sortOrder: SortOrder,
  statusFilter: ValidatorStatusFilter,
  isClaimDialog: boolean,
): FullValidatorInfo[] {
  // First apply the base filtering (status and search)
  const baseFiltered = filterAndSortValidators(
    validators,
    searchTerm,
    sortType,
    sortOrder,
    true, // showCurrentValidators
    statusFilter,
  );

  // Then apply dialog-specific filtering
  return baseFiltered.filter(validator => {
    if (isClaimDialog) {
      // For claim dialog: only show validators with rewards to claim
      return validator.rewards.some(reward => parseFloat(reward.amount) > 0);
    } else {
      // For unstake dialog: only show validators with balance and not unstaking
      const hasBalance = parseFloat(validator.balance.amount) > 0;
      const isUnstaking =
        validator.unbondingBalance && parseFloat(validator.unbondingBalance.balance) > 0;
      return hasBalance && !isUnstaking;
    }
  });
}

export function filterAndSortChains(
  chains: SimplifiedChainInfo[],
  searchTerm: string,
  sortOrder: SortOrder,
): SimplifiedChainInfo[] {
  const lowercasedSearchTerm = safeTrimLowerCase(searchTerm);

  return chains
    .filter(
      chain =>
        safeTrimLowerCase(chain.chain_name).includes(lowercasedSearchTerm) ||
        safeTrimLowerCase(chain.chain_id).includes(lowercasedSearchTerm),
    )
    .sort((a, b) => {
      const valueA = safeTrimLowerCase(a.chain_name);
      const valueB = safeTrimLowerCase(b.chain_name);

      const compareResult =
        sortOrder === SortOrder.ASC ? valueA.localeCompare(valueB) : valueB.localeCompare(valueA);

      // If names are equal, prioritize Symphony chains
      if (compareResult === 0) {
        const aIsSymphony =
          a.chain_id === SYMPHONY_MAINNET_ID || a.chain_id === SYMPHONY_TESTNET_ID;
        const bIsSymphony =
          b.chain_id === SYMPHONY_MAINNET_ID || b.chain_id === SYMPHONY_TESTNET_ID;

        if (aIsSymphony !== bIsSymphony) {
          return aIsSymphony ? -1 : 1;
        }
      }

      return compareResult;
    });
}
