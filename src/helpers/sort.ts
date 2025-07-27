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
    const valueA = getSortValue(a, sortType);
    const valueB = getSortValue(b, sortType);

    if (sortType === AssetSortType.NAME && lowercasedSearchTerm) {
      const aFields = [a.name, a.networkName, a.networkID].map(f => safeTrimLowerCase(f));
      const bFields = [b.name, b.networkName, b.networkID].map(f => safeTrimLowerCase(f));

      const aMatches = aFields.map(f => (f.includes(lowercasedSearchTerm) ? 1 : 0));
      const bMatches = bFields.map(f => (f.includes(lowercasedSearchTerm) ? 1 : 0));

      const aTotalMatches = aMatches.reduce((sum, m) => sum + m, 0 as number);
      const bTotalMatches = bMatches.reduce((sum, m) => sum + m, 0 as number);

      // First sort by total number of matches (descending)
      if (aTotalMatches !== bTotalMatches) {
        return bTotalMatches - aTotalMatches;
      }

      // Then sort by individual field matches in order: name, networkName, networkID
      for (let i = 0; i < aMatches.length; i++) {
        if (aMatches[i] !== bMatches[i]) {
          return bMatches[i] - aMatches[i];
        }
      }

      // If still tied, prioritize priority assets
      const aIsPriority = isPriorityCoin(a);
      const bIsPriority = isPriorityCoin(b);
      if (aIsPriority !== bIsPriority) {
        return aIsPriority ? -1 : 1;
      }

      // If still tied, prioritize Symphony assets
      const aIsSymphony =
        a.networkID === SYMPHONY_MAINNET_ID || a.networkID === SYMPHONY_TESTNET_ID;
      const bIsSymphony =
        b.networkID === SYMPHONY_MAINNET_ID || b.networkID === SYMPHONY_TESTNET_ID;
      if (aIsSymphony !== bIsSymphony) {
        return aIsSymphony ? -1 : 1;
      }
    }

    return sortOrder === SortOrder.ASC
      ? valueA.localeCompare(valueB)
      : valueB.localeCompare(valueA);
  });
}

export function filterAndSortAssets(
  assets: Asset[],
  searchTerm: string,
  sortType: AssetSortType,
  sortOrder: SortOrder,
  showAllAssets: boolean = true,
): Asset[] {
  const lowercasedSearchTerm = safeTrimLowerCase(searchTerm);

  // First filter the assets
  const filteredAssets = assets.filter(asset => {
    if (!showAllAssets && parseFloat(asset.amount) <= 0) return false;
    if (lowercasedSearchTerm) {
      return (
        safeTrimLowerCase(asset.name).includes(lowercasedSearchTerm) ||
        safeTrimLowerCase(asset.symbol).includes(lowercasedSearchTerm) ||
        safeTrimLowerCase(asset.denom).includes(lowercasedSearchTerm) ||
        safeTrimLowerCase(asset.networkName).includes(lowercasedSearchTerm) ||
        safeTrimLowerCase(asset.networkID).includes(lowercasedSearchTerm)
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
    let valueA: any;
    let valueB: any;

    switch (sortType) {
      case ValidatorSortType.NAME:
        const monikerA = safeTrimLowerCase(a.validator.description.moniker);
        const monikerB = safeTrimLowerCase(b.validator.description.moniker);
        valueA = stripNonAlphanumerics(monikerA);
        valueB = stripNonAlphanumerics(monikerB);
        const result =
          sortOrder === SortOrder.ASC
            ? valueA.localeCompare(valueB, undefined, { sensitivity: 'base' })
            : valueB.localeCompare(valueA, undefined, { sensitivity: 'base' });
        return result;

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

    const result =
      sortOrder === SortOrder.ASC ? (valueA > valueB ? 1 : -1) : valueA < valueB ? 1 : -1;
    return result;
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
