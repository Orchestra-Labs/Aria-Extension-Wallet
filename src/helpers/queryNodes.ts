import {
  DEFAULT_FEE_TOKEN,
  DEFAULT_REST_TIMEOUT,
  MAX_RETRIES_PER_QUERY,
  QueryType,
} from '@/constants';
import { SigningStargateClient, GasPrice } from '@cosmjs/stargate';
import { delay } from './timer';
import { FeeToken, RPCResponse, Uri } from '@/types';
import {
  createOfflineSignerByPrefix,
  getAddressByChainPrefix,
  getSessionToken,
} from './dataHelpers';
import { getSigningSymphonyClient } from '@orchestra-labs/symphonyjs';

//indexer specific error - i.e tx submitted, but indexer disabled so returned incorrect
const isIndexerError = (error: any): boolean => {
  return (
    error?.message?.includes('transaction indexing is disabled') ||
    error?.message?.includes('indexing is disabled')
  );
};

// Helper: Perform a REST API query to a selected node
// TODO: make queryType an enum
const performRestQuery = async (uri: string, endpoint: string, queryType: 'POST' | 'GET') => {
  const adjustedUri = uri.endsWith('/') && endpoint.startsWith('/') ? uri.slice(0, -1) : uri;
  const uriEndpoint = `${adjustedUri}${endpoint}`;
  // console.log(`[queryNodes] Performing REST query to ${uriEndpoint} and query type ${queryType}`);

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

    if (!response.ok) {
      console.error('[queryNodes] Node query failed:', response);
      throw new Error('Node query failed');
    }

    const responseBody = await response.json();

    // console.log(
    //   `[queryNodes] REST query to ${uriEndpoint} with query type ${queryType} successful, response:`,
    //   responseBody,
    // );
    return responseBody;
  } catch (error) {
    clearTimeout(timeoutId);

    if (error instanceof Error) {
      if (error.name === 'AbortError') {
        throw new Error(`Request timed out after ${DEFAULT_REST_TIMEOUT}ms`);
      }
      throw error;
    }

    // Handle non-Error throwables
    throw new Error(`Unknown error occurred: ${String(error)}`);
  }
};

// Helper: Perform an RPC query using signing, such as for claiming rewards or staking
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
  console.log('[queryNodes] Performing RPC query...');
  console.log('[queryNodes] Fee Token:', feeToken);

  try {
    let calculatedFee = fee;
    let gasPrice = feeToken.gasPriceStep.average; // Start with average
    let attempts = 0;
    const maxAttempts = 2; // Try average first, then high if needed

    while (attempts < maxAttempts) {
      try {
        if (!calculatedFee) {
          console.log('[queryNodes] Calculating fee...');
          const feeDenom = feeToken.denom;
          const defaultGasPrice = GasPrice.fromString(`${gasPrice}${feeDenom}`);

          // Simulate transaction to get gas estimate
          const gasEstimation = await client.simulate(walletAddress, messages, memo);
          console.log('[queryNodes] Raw Gas Estimation:', gasEstimation);

          // Add buffer (30% more gas than estimated)
          const bufferedGasEstimation = Math.ceil(gasEstimation * 1.3);
          console.log('[queryNodes] Buffered Gas Estimation:', bufferedGasEstimation);

          // Calculate fee amount
          const feeAmount = Math.ceil(
            bufferedGasEstimation * defaultGasPrice.amount.toFloatApproximation(),
          );
          console.log('[queryNodes] Calculated Fee Amount:', feeAmount);

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

        console.log('[queryNodes] Final Calculated Fee:', calculatedFee);

        if (simulateOnly) {
          console.log('[queryNodes] Simulation success, returning fee info.');
          return {
            code: 0,
            message: 'Simulation success',
            fee: calculatedFee,
            gasWanted: calculatedFee.gas,
          };
        }

        const result = await client.signAndBroadcast(walletAddress, messages, calculatedFee, memo);
        console.log('[queryNodes] Transaction result:', result);

        if (result.code === 0) {
          return {
            code: 0,
            txHash: result.transactionHash,
            gasUsed: result.gasUsed?.toString(),
            gasWanted: result.gasWanted?.toString(),
            message: 'Transaction success',
          };
        }

        // Handle specific error codes
        if (result.code === 13) {
          // 13 = insufficient fee
          throw new Error('Insufficient fee');
        }

        console.error('[queryNodes] Transaction failed with code:', result.code);
        throw new Error(`Transaction failed with code ${result.code}`);
      } catch (error: any) {
        console.error('[queryNodes] Error during RPC query:', error);

        // Check if we should retry with higher gas price
        if (
          attempts < maxAttempts - 1 &&
          (error.message.includes('insufficient fee') || error.code === 13)
        ) {
          attempts++;
          gasPrice = feeToken.gasPriceStep.high; // Switch to high gas price
          calculatedFee = undefined; // Force recalculation
          console.log(`[queryNodes] Retrying with higher gas price: ${gasPrice}`);
          continue;
        }

        // If we have an indexer error, handle specially
        if (isIndexerError(error)) {
          console.log('Indexer error detected.');
          return {
            code: 1,
            message: 'Node indexer disabled',
            txHash: error.txHash || 'unknown',
          };
        }

        throw error;
      }
    }

    throw new Error('All fee adjustment attempts failed');
  } catch (error: any) {
    console.error('[queryNodes] Final error:', error);
    throw error;
  }
};

const queryWithRetry = async ({
  endpoint,
  useRPC = false,
  queryType = 'GET',
  messages = [],
  feeToken = DEFAULT_FEE_TOKEN,
  simulateOnly = false,
  fee,
  prefix,
  uris,
  isSymphonyQuery = false,
}: {
  endpoint: string;
  useRPC?: boolean;
  queryType?: 'GET' | 'POST';
  messages?: any[];
  feeToken?: FeeToken;
  simulateOnly?: boolean;
  fee?: {
    amount: { denom: string; amount: string }[];
    gas: string;
  };
  prefix: string;
  uris: Uri[];
  isSymphonyQuery?: boolean;
}): Promise<RPCResponse> => {
  let attemptCount = 0;
  let lastError: any = null;

  // TODO: add rest.cosmos.directory/[chain name] (i.e. rest.cosmos.directory/symphony) or rest.testcosmos.directory/[chain name] to start of list before querying.
  const shuffledUris = [...uris].sort(() => Math.random() - 0.5);
  while (attemptCount < MAX_RETRIES_PER_QUERY && attemptCount <= uris.length - 1) {
    const uriIndex = attemptCount % shuffledUris.length;
    const uri = shuffledUris[uriIndex];

    try {
      if (useRPC) {
        const sessionToken = getSessionToken();
        if (!sessionToken) throw new Error("Session token doesn't exist");

        const mnemonic = sessionToken.mnemonic;
        const address = await getAddressByChainPrefix(mnemonic, prefix);
        const signer = await createOfflineSignerByPrefix(mnemonic, prefix);

        console.log(`[queryNodes] Is Symphony query: ${isSymphonyQuery}`);
        const client = isSymphonyQuery
          ? await getSigningSymphonyClient({ rpcEndpoint: uri.address, signer })
          : await SigningStargateClient.connectWithSigner(uri.address, signer);

        const result = await performRpcQuery(
          client,
          address,
          messages,
          feeToken,
          simulateOnly,
          fee,
        );
        return result;
      } else {
        const result = await performRestQuery(uri.address, endpoint, queryType);
        return result;
      }
    } catch (error) {
      console.error(`[queryNodes] ${error}`);

      attemptCount++;
      lastError = error;

      const backoff = Math.min(2 ** attemptCount * 500, 5000);
      console.log(
        `[queryNodes] Attempt ${attemptCount + 1} via ${uri.address} at ${endpoint}, waiting ${backoff}ms before retry`,
      );
      await delay(backoff);
    }
  }

  if (isIndexerError(lastError)) {
    return {
      code: 0,
      message: 'Transaction likely successful (indexer disabled)',
      txHash: lastError?.txHash || 'unknown',
    };
  }

  throw new Error(`All ${MAX_RETRIES_PER_QUERY} attempts failed. ${lastError?.message || ''}`);
};

export const queryRestNode = async ({
  endpoint,
  queryType = QueryType.GET,
  prefix,
  restUris,
}: {
  endpoint: string;
  queryType?: QueryType;
  prefix: string;
  restUris: Uri[];
}) =>
  queryWithRetry({
    endpoint,
    useRPC: false,
    queryType,
    prefix,
    uris: restUris,
  });

export const queryRpcNode = async ({
  endpoint,
  messages,
  feeToken = DEFAULT_FEE_TOKEN,
  simulateOnly = false,
  fee,
  prefix,
  rpcUris,
}: {
  endpoint: string;
  prefix: string;
  rpcUris: Uri[];
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
  });
