import { DEFAULT_MAINNET_ASSET, MAX_RETRIES_PER_QUERY, QueryType } from '@/constants';
import { SigningStargateClient, GasPrice } from '@cosmjs/stargate';
import { delay } from './timer';
import { RPCResponse, Uri } from '@/types';
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
const performRestQuery = async (uri: string, endpoint: string, queryType: 'POST' | 'GET') => {
  const adjustedUri = uri.endsWith('/') && endpoint.startsWith('/') ? uri.slice(0, -1) : uri;
  const uriEndpoint = `${adjustedUri}${endpoint}`;
  // console.log(`[queryNodes] Performing REST query to ${uriEndpoint} and query type ${queryType}`);

  const response = await fetch(`${uriEndpoint}`, {
    method: queryType,
    body: null,
    headers: { 'Content-Type': 'application/json' },
  });

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
};

// TODO: modify to support multi-send
// Helper: Perform an RPC query using signing, such as for claiming rewards or staking
export const performRpcQuery = async (
  client: SigningStargateClient,
  walletAddress: string,
  messages: any[],
  feeDenom: string,
  simulateOnly = false,
  fee?: {
    amount: { denom: string; amount: string }[];
    gas: string;
  },
  memo: string = 'wallet',
): Promise<RPCResponse> => {
  // console.log('[queryNodes] Performing RPC query...');
  // console.log('[queryNodes] Client:', client);
  // console.log('[queryNodes] Wallet Address:', walletAddress);
  // console.log('[queryNodes] Messages:', messages);
  // console.log('[queryNodes] Fee Denom:', feeDenom);
  // console.log('[queryNodes] Simulate Only:', simulateOnly);
  // console.log('[queryNodes] Fee:', fee);

  try {
    let calculatedFee = fee;

    if (!fee || !calculatedFee) {
      console.log('[queryNodes] Calculating fee...');
      // TODO: change hardcoded value to default from registry
      const defaultGasPrice = GasPrice.fromString(`0.025${feeDenom}`);
      let gasEstimation = await client.simulate(walletAddress, messages, '');
      console.log('[queryNodes] Gas Estimation:', gasEstimation);

      gasEstimation = Math.ceil(gasEstimation * 1.1);
      console.log('[queryNodes] Adjusted Gas Estimation:', gasEstimation);

      calculatedFee = {
        amount: [
          {
            denom: feeDenom,
            amount: (gasEstimation * defaultGasPrice.amount.toFloatApproximation()).toFixed(0),
          },
        ],
        gas: gasEstimation.toString(),
      };
    }

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

    console.error('[queryNodes] Transaction failed with code:', result.code);
    throw new Error(`Transaction failed with ${result.code}`);
  } catch (error: any) {
    console.error('[queryNodes] Error during RPC query:', error);

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
};

const queryWithRetry = async ({
  endpoint,
  useRPC = false,
  queryType = 'GET',
  messages = [],
  feeDenom,
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
  feeDenom: string;
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

  const shuffledUris = [...uris].sort(() => Math.random() - 0.5);

  while (attemptCount < MAX_RETRIES_PER_QUERY && attemptCount <= shuffledUris.length - 1) {
    const uriIndex = attemptCount;
    const uri = shuffledUris[uriIndex];

    // console.log(`[queryNodes] URIs in list: ${JSON.stringify(uris)}`);
    // console.log(
    //   `[queryNodes] Attempt ${attemptCount + 1} via ${uri.address} at ${endpoint}, start of loop`,
    // );
    // console.log(
    //   `[queryNodes] Attempt count ${attemptCount}, shuffled Uris length ${shuffledUris.length - 1}, max retries ${MAX_RETRIES_PER_QUERY}`,
    // );

    try {
      if (useRPC) {
        const sessionToken = getSessionToken();
        if (!sessionToken) throw new Error("Session token doesn't exist");

        const mnemonic = sessionToken.mnemonic;
        const address = await getAddressByChainPrefix(mnemonic, prefix);
        const signer = await createOfflineSignerByPrefix(mnemonic, prefix);

        // console.log(`[queryNodes] Is Symphony query: ${isSymphonyQuery}`);
        const client = isSymphonyQuery
          ? await getSigningSymphonyClient({ rpcEndpoint: uri.address, signer })
          : await SigningStargateClient.connectWithSigner(uri.address, signer);

        const result = await performRpcQuery(
          client,
          address,
          messages,
          feeDenom,
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
  feeDenom = DEFAULT_MAINNET_ASSET.denom,
  prefix,
  restUris,
}: {
  endpoint: string;
  queryType?: QueryType;
  feeDenom?: string;
  prefix: string;
  restUris: Uri[];
}) =>
  queryWithRetry({
    endpoint,
    useRPC: false,
    queryType,
    feeDenom,
    prefix,
    uris: restUris,
  });

export const queryRpcNode = async ({
  endpoint,
  messages,
  feeDenom = DEFAULT_MAINNET_ASSET.denom,
  simulateOnly = false,
  fee,
  prefix,
  rpcUris,
}: {
  endpoint: string;
  prefix: string;
  rpcUris: Uri[];
  messages?: any[];
  feeDenom?: string;
  simulateOnly?: boolean;
  fee?: {
    amount: { denom: string; amount: string }[];
    gas: string;
  };
}) =>
  queryWithRetry({
    endpoint,
    useRPC: true,
    messages,
    feeDenom,
    simulateOnly,
    fee,
    prefix,
    uris: rpcUris,
  });
