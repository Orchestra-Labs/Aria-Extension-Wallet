import { SortedValidator, Uri, ValidatorRecord } from '@/types';
import { getLocalStorageItem, setLocalStorageItem, removeLocalStorageItem } from './localstorage';
import { CommType, DEFAULT_REST_TIMEOUT, ONE_DAY, ONE_SECOND } from '@/constants';

const VALIDATOR_STATS_KEY = 'validatorStats';

// Batch processing for query results
let pendingRecords: Array<{
  chainId: string;
  validatorId: string;
  queryTime: number;
  success: boolean;
  commType: CommType;
}> = [];
let recordTimeout: NodeJS.Timeout | null = null;
const BATCH_PROCESSING_DELAY = ONE_SECOND;

const getTimestampFromDateString = (dateString: string): number => {
  return new Date(dateString).getTime();
};

const getCurrentDateString = (): string => {
  return new Date().toISOString();
};

const getDefaultStats = (): ValidatorRecord => ({
  lastUpdated: getCurrentDateString(),
  data: {},
});

export const getValidatorStats = (): ValidatorRecord => {
  const stats = getLocalStorageItem(VALIDATOR_STATS_KEY);

  if (stats) {
    try {
      const parsedStats = JSON.parse(stats) as ValidatorRecord;
      if (parsedStats && typeof parsedStats.lastUpdated === 'string') {
        return parsedStats;
      }
    } catch (error) {
      console.warn('Invalid validator stats in localStorage, resetting...');
    }
  }

  return getDefaultStats();
};

export const saveValidatorStats = (stats: ValidatorRecord): void => {
  setLocalStorageItem(VALIDATOR_STATS_KEY, JSON.stringify(stats));
};

// Optimized reset check
export const resetDailyFailuresIfNeeded = (): ValidatorRecord => {
  const rawStats = localStorage.getItem(VALIDATOR_STATS_KEY);
  if (!rawStats) return getDefaultStats();

  // Quick check without full parsing
  const lastUpdatedMatch = rawStats.match(/"lastUpdated":"([^"]+)"/);
  if (!lastUpdatedMatch) return getDefaultStats();

  const lastUpdated = getTimestampFromDateString(lastUpdatedMatch[1]);
  const now = Date.now();

  if (now - lastUpdated < ONE_DAY) {
    try {
      return JSON.parse(rawStats) as ValidatorRecord;
    } catch {
      return getDefaultStats();
    }
  }

  // Full reset logic
  const stats = getValidatorStats();
  const resetStats: ValidatorRecord = {
    lastUpdated: getCurrentDateString(),
    data: {},
  };

  if (stats.data) {
    Object.keys(stats.data).forEach(chainId => {
      const chainData = stats.data[chainId];
      resetStats.data[chainId] = { rpc: {}, rest: {} };

      Object.keys(chainData.rpc || {}).forEach(validatorId => {
        const validatorStats = chainData.rpc[validatorId];
        resetStats.data[chainId].rpc[validatorId] = {
          failedQueries: 0,
          longestQueryTime: validatorStats.longestQueryTime,
        };
      });

      Object.keys(chainData.rest || {}).forEach(validatorId => {
        const validatorStats = chainData.rest[validatorId];
        resetStats.data[chainId].rest[validatorId] = {
          failedQueries: 0,
          longestQueryTime: validatorStats.longestQueryTime,
        };
      });
    });
  }

  saveValidatorStats(resetStats);
  return resetStats;
};

// Batch processing function
const processPendingRecords = () => {
  if (pendingRecords.length === 0) return;

  const stats = resetDailyFailuresIfNeeded();

  pendingRecords.forEach(record => {
    const { chainId, validatorId, queryTime, success, commType } = record;

    if (!stats.data[chainId]) stats.data[chainId] = { rpc: {}, rest: {} };
    if (!stats.data[chainId][commType][validatorId]) {
      stats.data[chainId][commType][validatorId] = { failedQueries: 0, longestQueryTime: 0 };
    }

    const validatorStats = stats.data[chainId][commType][validatorId];

    if (!success) {
      validatorStats.failedQueries += 1;
    }

    if (queryTime > validatorStats.longestQueryTime) {
      validatorStats.longestQueryTime = queryTime;
    }
  });

  stats.lastUpdated = getCurrentDateString();
  saveValidatorStats(stats);
  pendingRecords = [];
};

export const recordQueryResult = (
  chainId: string,
  validatorId: string,
  queryTime: number,
  success: boolean,
  commType: CommType,
): void => {
  pendingRecords.push({ chainId, validatorId, queryTime, success, commType });

  if (!recordTimeout) {
    recordTimeout = setTimeout(() => {
      processPendingRecords();
      recordTimeout = null;
    }, BATCH_PROCESSING_DELAY);
  }
};

// Force immediate processing (useful for tests or cleanup)
export const flushPendingRecords = (): void => {
  if (recordTimeout) {
    clearTimeout(recordTimeout);
    recordTimeout = null;
  }
  processPendingRecords();
};

export const getSortedValidators = (
  chainId: string,
  commType: CommType,
  availableUris: Uri[],
): SortedValidator[] => {
  const stats = resetDailyFailuresIfNeeded();
  const validatorMap = new Map<string, SortedValidator>();

  if (!stats.data || !stats.data[chainId] || !stats.data[chainId][commType]) {
    return [];
  }

  const chainStats = stats.data[chainId][commType];
  Object.entries(chainStats).forEach(([validatorId, validatorStats]) => {
    validatorMap.set(validatorId, {
      validatorId,
      failedQueries: validatorStats.failedQueries,
      longestQueryTime: validatorStats.longestQueryTime,
    });
  });

  availableUris.forEach(uri => {
    if (!validatorMap.has(uri.address)) {
      validatorMap.set(uri.address, {
        validatorId: uri.address,
        failedQueries: 0, // Default to 0 errors
        longestQueryTime: DEFAULT_REST_TIMEOUT / 2, // Default to half permitted time
      });
    }
  });

  const validators = Array.from(validatorMap.values());

  return validators.sort((a, b) => {
    if (a.failedQueries !== b.failedQueries) {
      return a.failedQueries - b.failedQueries;
    }
    return a.longestQueryTime - b.longestQueryTime;
  });
};

export const getNextValidator = (
  chainId: string,
  commType: CommType,
  availableUris: Uri[],
): string | null => {
  const sortedValidators = getSortedValidators(chainId, commType, availableUris);
  return sortedValidators.length > 0 ? sortedValidators[0].validatorId : null;
};

export const clearValidatorStats = (): void => {
  removeLocalStorageItem(VALIDATOR_STATS_KEY);
  pendingRecords = [];
  if (recordTimeout) {
    clearTimeout(recordTimeout);
    recordTimeout = null;
  }
};

export const getAllValidatorStats = (): ValidatorRecord => {
  flushPendingRecords(); // Ensure all pending records are processed
  return resetDailyFailuresIfNeeded();
};
