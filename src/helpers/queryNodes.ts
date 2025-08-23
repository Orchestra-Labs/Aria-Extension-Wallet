import {
  CommType,
  DEFAULT_FEE_TOKEN,
  DEFAULT_REST_TIMEOUT,
  FIVE_MINUTES,
  MAX_RETRIES_PER_QUERY,
  ONE_SECOND,
  QueryType,
  SYMPHONY_ENDPOINTS,
} from '@/constants';
import { SigningStargateClient, GasPrice } from '@cosmjs/stargate';
import { delay } from './timer';
import { FeeToken, RPCResponse, SortedValidator, Uri } from '@/types';
import {
  createOfflineSignerByPrefix,
  getAddressByChainPrefix,
  getSessionToken,
  getSortedValidators,
  recordQueryResult,
} from './dataHelpers';
import { getSigningSymphonyClient } from '@orchestra-labs/symphonyjs';

// Client connection caching
const clientCache = new Map<string, SigningStargateClient>();
const CACHE_TTL = FIVE_MINUTES;
// Sorted URIs caching
const SORT_CACHE_TTL = ONE_SECOND * 5;

interface ValidatorCacheEntry {
  validators: SortedValidator[];
  timestamp: number;
}

let sortedValidatorsCache: { [cacheKey: string]: ValidatorCacheEntry } = {};

const isIndexerError = (error: any): boolean => {
  return (
    error?.message?.includes('transaction indexing is disabled') ||
    error?.message?.includes('indexing is disabled')
  );
};

const shouldRecordFailure = (error: any): boolean => {
  const errorMessage = error?.message || '';

  // Client errors (4xx) - validator/access issues
  const isClientError =
    errorMessage.includes('HTTP 400') ||
    errorMessage.includes('HTTP 401') ||
    errorMessage.includes('HTTP 403') ||
    errorMessage.includes('HTTP 404') ||
    errorMessage.includes('HTTP 405') ||
    errorMessage.includes('HTTP 408') ||
    errorMessage.includes('HTTP 409') ||
    errorMessage.includes('HTTP 410') ||
    errorMessage.includes('HTTP 429');

  // Server errors (5xx) - validator infrastructure problems
  const isServerError =
    errorMessage.includes('HTTP 500') ||
    errorMessage.includes('HTTP 501') ||
    errorMessage.includes('HTTP 502') ||
    errorMessage.includes('HTTP 503') ||
    errorMessage.includes('HTTP 504') ||
    errorMessage.includes('HTTP 507') ||
    errorMessage.includes('HTTP 508') ||
    errorMessage.includes('HTTP 509') ||
    errorMessage.includes('HTTP 522');

  // Also record indexer errors since they're validator-specific
  const isIndexerRelated = isIndexerError(error);

  // Connection errors (not HTTP status but network-level issues)
  const isConnectionError =
    errorMessage.includes('ECONNREFUSED') ||
    errorMessage.includes('ENOTFOUND') ||
    errorMessage.includes('ECONNRESET') ||
    errorMessage.includes('ETIMEDOUT');

  return isClientError || isServerError || isIndexerRelated || isConnectionError;
};

const performRestQuery = async (uri: string, endpoint: string, queryType: 'POST' | 'GET') => {
  const adjustedUri = uri.endsWith('/') && endpoint.startsWith('/') ? uri.slice(0, -1) : uri;
  const uriEndpoint = `${adjustedUri}${endpoint}`;

  const startTime = Date.now();
  const controller = new AbortController();
  const timeoutId = setTimeout(() => controller.abort(), DEFAULT_REST_TIMEOUT);

  try {
    const response = await fetch(`${uriEndpoint}`, {
      method: queryType,
      body: null,
      headers: { 'Content-Type': 'application/json' },
      signal: controller.signal,
    });

    clearTimeout(timeoutId);
    const queryTime = Date.now() - startTime;

    if (!response.ok) {
      console.error('[queryNodes] Node query failed:', response.status, response.statusText);
      throw new Error(`HTTP ${response.status}: ${response.statusText}`);
    }

    const responseBody = await response.json();
    return { data: responseBody, queryTime, statusCode: response.status };
  } catch (error) {
    clearTimeout(timeoutId);

    if (error instanceof Error) {
      if (error.name === 'AbortError') {
        throw new Error(`Request timed out after ${DEFAULT_REST_TIMEOUT}ms`);
      }
      throw error;
    }

    throw new Error(`Unknown error occurred: ${String(error)}`);
  }
};

const performRpcQuery = async (
  client: SigningStargateClient,
  walletAddress: string,
  messages: any[],
  feeToken: FeeToken,
  simulateOnly = false,
  fee?: {
    amount: { denom: string; amount: string }[];
    gas: string;
  },
  memo: string = 'wallet',
): Promise<RPCResponse> => {
  try {
    let calculatedFee = fee;
    let gasPrice = feeToken.gasPriceStep.average;

    if (!calculatedFee) {
      const feeDenom = feeToken.denom;
      const defaultGasPrice = GasPrice.fromString(`${gasPrice}${feeDenom}`);

      // Simulate transaction to get gas estimate
      const gasEstimation = await client.simulate(walletAddress, messages, memo);

      // Add buffer (30% more gas than estimated)
      const bufferedGasEstimation = Math.ceil(gasEstimation * 1.3);

      // Calculate fee amount
      const feeAmount = Math.ceil(
        bufferedGasEstimation * defaultGasPrice.amount.toFloatApproximation(),
      );

      calculatedFee = {
        amount: [
          {
            denom: feeDenom,
            amount: feeAmount.toString(),
          },
        ],
        gas: bufferedGasEstimation.toString(),
      };
    }

    if (simulateOnly) {
      return {
        code: 0,
        message: 'Simulation success',
        fee: calculatedFee,
        gasWanted: calculatedFee.gas,
      };
    }

    const result = await client.signAndBroadcast(walletAddress, messages, calculatedFee, memo);

    if (result.code === 0) {
      return {
        code: 0,
        txHash: result.transactionHash,
        gasUsed: result.gasUsed?.toString(),
        gasWanted: result.gasWanted?.toString(),
        message: 'Transaction success',
      };
    }

    console.error('[queryNodes] Transaction failed with code:', result.code);
    throw new Error(`Transaction failed with code ${result.code}`);
  } catch (error: any) {
    if (isIndexerError(error)) {
      return {
        code: 1,
        message: 'Node indexer disabled',
        txHash: error.txHash || 'unknown',
      };
    }

    console.error('[queryNodes] Final error:', error);
    throw error;
  }
};

const getCachedSigner = async (
  endpoint: string,
  uri: Uri,
  mnemonic: string,
  prefix: string,
): Promise<SigningStargateClient> => {
  const cacheKey = `${uri.address}-${prefix}`;

  // Check cache and validate it's not too old
  const cachedClient = clientCache.get(cacheKey);
  if (cachedClient) {
    return cachedClient;
  }

  const isSymphonyQuery = Object.values(SYMPHONY_ENDPOINTS).some(symphonyEndpoint =>
    endpoint.startsWith(symphonyEndpoint),
  );

  const offlineSigner = await createOfflineSignerByPrefix(mnemonic, prefix);

  const client = isSymphonyQuery
    ? await getSigningSymphonyClient({ rpcEndpoint: uri.address, signer: offlineSigner })
    : await SigningStargateClient.connectWithSigner(uri.address, offlineSigner);

  // Cache the client
  clientCache.set(cacheKey, client);

  // Set timeout to clear cache entry
  setTimeout(() => {
    clientCache.delete(cacheKey);
  }, CACHE_TTL);

  return client;
};

const sortUrisWithCache = (uris: Uri[], sortedValidators: SortedValidator[]): Uri[] => {
  const performanceRank = new Map<string, number>();
  sortedValidators.forEach((validator, index) => {
    performanceRank.set(validator.validatorId, index);
  });

  return [...uris].sort((a, b) => {
    const rankA = performanceRank.get(a.address) ?? Infinity;
    const rankB = performanceRank.get(b.address) ?? Infinity;
    return rankA - rankB;
  });
};

const getSortedUris = (chainId: string, uris: Uri[], commType: CommType): Uri[] => {
  const now = Date.now();
  const cacheKey = `${chainId}-${commType}`;

  // Use cache if available and not expired
  if (
    sortedValidatorsCache[cacheKey] &&
    now - sortedValidatorsCache[cacheKey].timestamp < SORT_CACHE_TTL
  ) {
    return sortUrisWithCache(uris, sortedValidatorsCache[cacheKey].validators);
  }

  const sortedValidators = getSortedValidators(chainId, commType);
  sortedValidatorsCache[cacheKey] = {
    validators: sortedValidators,
    timestamp: now,
  };

  return sortUrisWithCache(uris, sortedValidators);
};

const queryWithRetry = async ({
  endpoint,
  useRPC = false,
  queryType = QueryType.GET,
  messages = [],
  feeToken = DEFAULT_FEE_TOKEN,
  simulateOnly = false,
  fee,
  prefix,
  uris,
  chainId,
}: {
  endpoint: string;
  useRPC?: boolean;
  queryType?: QueryType;
  messages?: any[];
  feeToken?: FeeToken;
  simulateOnly?: boolean;
  fee?: {
    amount: { denom: string; amount: string }[];
    gas: string;
  };
  prefix: string;
  uris: Uri[];
  chainId: string;
}): Promise<RPCResponse> => {
  let attemptCount = 0;
  let lastError: any = null;

  // Determine query type for sorting and recording
  const queryTypeCategory: CommType = useRPC ? CommType.RPC : CommType.REST;

  // Pre-sort all URIs once and create a queue
  const sortedUris = getSortedUris(chainId, uris, queryTypeCategory);
  const uriQueue = [...sortedUris];

  while (attemptCount < MAX_RETRIES_PER_QUERY && uriQueue.length > 0) {
    const uri = uriQueue.shift()!;
    const startTime = Date.now();

    try {
      if (useRPC) {
        const sessionToken = getSessionToken();
        if (!sessionToken) throw new Error("Session token doesn't exist");

        const mnemonic = sessionToken.mnemonic;
        const address = await getAddressByChainPrefix(mnemonic, prefix);

        const transactionSigner = await getCachedSigner(endpoint, uri, mnemonic, prefix);

        const result = await performRpcQuery(
          transactionSigner,
          address,
          messages,
          feeToken,
          simulateOnly,
          fee,
        );

        const queryTime = Date.now() - startTime;
        recordQueryResult(chainId, uri.address, queryTime, true, CommType.RPC);

        return result;
      } else {
        const result = await performRestQuery(uri.address, endpoint, queryType);
        recordQueryResult(chainId, uri.address, result.queryTime, true, CommType.REST);
        return result.data;
      }
    } catch (error) {
      const queryTime = Date.now() - startTime;
      console.error(`[queryNodes] Query failed for ${uri.address}: ${error}`);

      if (shouldRecordFailure(error)) {
        recordQueryResult(chainId, uri.address, queryTime, false, queryTypeCategory);
      } else {
        let errorMessage = 'Unknown error';
        if (error instanceof Error) {
          errorMessage = error.message;
        } else if (typeof error === 'string') {
          errorMessage = error;
        } else {
          errorMessage = String(error);
        }
        console.log(`[queryNodes] Not recording failure for ${uri.address}: ${errorMessage}`);
      }

      attemptCount++;
      lastError = error;

      if (uriQueue.length > 0) {
        const backoff = Math.min(2 ** attemptCount * 500, 5000);
        const nextUri = uriQueue[0];
        console.log(
          `[queryNodes] Next attempt via ${nextUri.address} at ${endpoint}, waiting ${backoff}ms before retry`,
        );
        await delay(backoff);
      }
    }
  }

  if (isIndexerError(lastError)) {
    return {
      code: 0,
      message: 'Transaction likely successful (indexer disabled)',
      txHash: lastError?.txHash || 'unknown',
    };
  }

  throw new Error(
    `All ${Math.min(MAX_RETRIES_PER_QUERY, uris.length)} attempts failed. ${lastError?.message || ''}`,
  );
};

export const queryRestNode = async ({
  endpoint,
  queryType = QueryType.GET,
  prefix,
  restUris,
  chainId,
}: {
  endpoint: string;
  queryType?: QueryType;
  prefix: string;
  restUris: Uri[];
  chainId: string;
}) =>
  queryWithRetry({
    endpoint,
    useRPC: false,
    queryType,
    prefix,
    uris: restUris,
    chainId,
  });

export const queryRpcNode = async ({
  endpoint,
  messages,
  feeToken = DEFAULT_FEE_TOKEN,
  simulateOnly = false,
  fee,
  prefix,
  rpcUris,
  chainId,
}: {
  endpoint: string;
  prefix: string;
  rpcUris: Uri[];
  chainId: string;
  messages?: any[];
  feeToken?: FeeToken;
  simulateOnly?: boolean;
  fee?: {
    amount: { denom: string; amount: string }[];
    gas: string;
  };
}): Promise<RPCResponse> =>
  queryWithRetry({
    endpoint,
    useRPC: true,
    messages,
    feeToken,
    simulateOnly,
    fee,
    prefix,
    uris: rpcUris,
    chainId,
  });

// Clear client cache utility
export const clearClientCache = (): void => {
  clientCache.clear();
};

// Clear sorted URIs cache utility
export const clearSortedUrisCache = (): void => {
  sortedValidatorsCache = {};
};
