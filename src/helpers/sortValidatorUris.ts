import { CommType } from '@/constants';
import { getAllValidatorStats } from './dataHelpers';

export interface UriWithStats {
  uri: string;
  failedQueries: number;
  queryTime: number;
  commType: CommType;
}

/**
 * Extract all RPC and REST URIs with their performance statistics
 */
export const getAllUrisWithStats = (): UriWithStats[] => {
  const stats = getAllValidatorStats();
  const allUris: UriWithStats[] = [];

  // Process all chains and their validator statistics
  Object.entries(stats.data || {}).forEach(([_, chainData]) => {
    // Process RPC URIs
    Object.entries(chainData.rpc || {}).forEach(([validatorId, validatorStats]) => {
      allUris.push({
        uri: validatorId,
        failedQueries: validatorStats.failedQueries,
        queryTime: validatorStats.longestQueryTime,
        commType: CommType.RPC,
      });
    });

    // Process REST URIs
    Object.entries(chainData.rest || {}).forEach(([validatorId, validatorStats]) => {
      allUris.push({
        uri: validatorId,
        failedQueries: validatorStats.failedQueries,
        queryTime: validatorStats.longestQueryTime,
        commType: CommType.REST,
      });
    });
  });

  return allUris;
};

/**
 * Group URIs by type (RPC/REST) and sort according to specified criteria
 */
export const getGroupedAndSortedUris = (): {
  rpc: UriWithStats[];
  rest: UriWithStats[];
} => {
  const allUris = getAllUrisWithStats();

  // Group by communication type
  const grouped = {
    rpc: allUris.filter(uri => uri.commType === CommType.RPC),
    rest: allUris.filter(uri => uri.commType === CommType.REST),
  };

  // Sort each group according to the specified criteria
  const sortUris = (uris: UriWithStats[]): UriWithStats[] => {
    return uris.sort((a, b) => {
      // Primary: lowest to highest fail count
      if (a.failedQueries !== b.failedQueries) {
        return a.failedQueries - b.failedQueries;
      }

      // Secondary: lowest to highest query time
      if (a.queryTime !== b.queryTime) {
        return a.queryTime - b.queryTime;
      }

      // Tertiary: random order for ties
      return Math.random() - 0.5;
    });
  };

  return {
    rpc: sortUris(grouped.rpc),
    rest: sortUris(grouped.rest),
  };
};

/**
 * Get all sorted URIs (both RPC and REST combined and sorted)
 */
export const getAllSortedUris = (): UriWithStats[] => {
  const grouped = getGroupedAndSortedUris();
  return [...grouped.rpc, ...grouped.rest];
};

// Alternative: Get sorted URIs for a specific communication type
export const getSortedUrisByType = (commType: CommType): UriWithStats[] => {
  const grouped = getGroupedAndSortedUris();
  return commType === CommType.RPC ? grouped.rpc : grouped.rest;
};

// Utility function to get just the URI strings (without stats)
export const getSortedUrisStrings = (commType?: CommType): string[] => {
  if (commType !== undefined) {
    return getSortedUrisByType(commType).map(uri => uri.uri);
  }

  return getAllSortedUris().map(uri => uri.uri);
};
