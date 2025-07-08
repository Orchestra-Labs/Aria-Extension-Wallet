import {
  CHAIN_NODES,
  DELAY_BETWEEN_NODE_ATTEMPTS,
  LOCAL_ASSET_REGISTRY,
  MAX_NODES_PER_QUERY,
} from '@/constants';
import { SigningStargateClient, GasPrice } from '@cosmjs/stargate';
import { createOfflineSignerFromMnemonic, getAddress } from './dataHelpers/wallet';
import { delay } from './timer';
import { RPCResponse } from '@/types';
import { getNodeErrorCounts, getSessionToken, storeNodeErrorCounts } from './dataHelpers';

//indexer specific error - i.e tx submitted, but indexer disabled so returned incorrect

const isIndexerError = (error: any): boolean => {
  return (
    error?.message?.includes('transaction indexing is disabled') ||
    error?.message?.includes('indexing is disabled')
  );
};

// Select and prioritize node providers based on their error counts
export const selectNodeProviders = () => {
  const errorCounts = getNodeErrorCounts();
  console.log('Fetching node error counts:', errorCounts);

  const providers = CHAIN_NODES.symphonytestnet.map(provider => ({
    ...provider,
    failCount: errorCounts[provider.rpc] || 0,
  }));

  console.log('Providers with fail counts:', providers);

  return providers.sort((a, b) => a.failCount - b.failCount);
};

// Increment the error count for a specific provider
export const incrementErrorCount = (nodeProvider: string): void => {
  const errorCounts = getNodeErrorCounts();
  console.log(`Incrementing error count for provider: ${nodeProvider}`);

  errorCounts[nodeProvider] = (errorCounts[nodeProvider] || 0) + 1;
  storeNodeErrorCounts(errorCounts);

  console.log(`Updated error counts for ${nodeProvider}:`, errorCounts[nodeProvider]);
};

// Helper: Perform a REST API query to a selected node
const performRestQuery = async (
  endpoint: string,
  queryMethod: string,
  queryType: 'POST' | 'GET',
  params?: BodyInit,
) => {
  console.log(
    `Performing REST query to ${endpoint} with method ${queryMethod} and type ${queryType}`,
  );

  const response = await fetch(`${queryMethod}${endpoint}`, {
    method: queryType,
    body: queryType === 'POST' ? params : null,
    headers: { 'Content-Type': 'application/json' },
  });

  if (!response.ok) {
    console.error('Node query failed:', response);
    throw new Error('Node query failed');
  }

  const responseBody = await response.json();
  console.log('REST query successful, response:', responseBody);

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
  console.log('Performing RPC query...');
  console.log('Client:', client);
  console.log('Wallet Address:', walletAddress);
  console.log('Messages:', messages);
  console.log('Fee Denom:', feeDenom);
  console.log('Simulate Only:', simulateOnly);
  console.log('Fee:', fee);

  try {
    let calculatedFee = fee;

    if (!fee || !calculatedFee) {
      console.log('Calculating fee...');
      const defaultGasPrice = GasPrice.fromString(`0.025${feeDenom}`);
      let gasEstimation = await client.simulate(walletAddress, messages, '');
      console.log('Gas Estimation:', gasEstimation);

      gasEstimation = Math.ceil(gasEstimation * 1.1);
      console.log('Adjusted Gas Estimation:', gasEstimation);

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
      console.log('Simulation success, returning fee info.');
      return {
        code: 0,
        message: 'Simulation success',
        fee: calculatedFee,
        gasWanted: calculatedFee.gas,
      };
    }

    const result = await client.signAndBroadcast(walletAddress, messages, calculatedFee, memo);
    console.log('Transaction result:', result);

    if (result.code === 0) {
      return {
        code: 0,
        txHash: result.transactionHash,
        gasUsed: result.gasUsed?.toString(),
        gasWanted: result.gasWanted?.toString(),
        message: 'Transaction success',
      };
    }

    console.error('Transaction failed with code:', result.code);
    throw new Error(`Transaction failed with ${result.code}`);
  } catch (error: any) {
    console.error('Error during RPC query:', error);

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

const queryWithRetry = async <T>({
  endpoint,
  useRPC = false,
  queryType = 'GET',
  messages = [],
  feeDenom,
  simulateOnly = false,
  fee,
  body,
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
  body?: BodyInit;
}): Promise<T> => {
  console.log('Querying with retry...');
  console.log('Endpoint:', endpoint);
  console.log('Use RPC:', useRPC);
  console.log('Query Type:', queryType);
  console.log('Messages:', messages);
  console.log('Fee Denom:', feeDenom);
  console.log('Simulate Only:', simulateOnly);

  const providers = selectNodeProviders();
  console.log('Providers selected for retry:', providers);

  let numberAttempts = 0;
  let lastError: any = null;

  while (numberAttempts < MAX_NODES_PER_QUERY) {
    for (const provider of providers) {
      try {
        const queryMethod = useRPC ? provider.rpc : provider.rest;
        console.log('Using query method:', queryMethod);

        if (useRPC) {
          const sessionToken = getSessionToken();
          if (!sessionToken) {
            throw new Error("Session token doesn't exist");
          }
          const mnemonic = sessionToken.mnemonic;
          const address = await getAddress(mnemonic);
          const offlineSigner = await createOfflineSignerFromMnemonic(mnemonic);
          const client = await SigningStargateClient.connectWithSigner(queryMethod, offlineSigner);

          const result = await performRpcQuery(
            client,
            address,
            messages,
            feeDenom,
            simulateOnly,
            fee,
          );
          return result as T;
        } else {
          const result = await performRestQuery(endpoint, queryMethod, queryType, body);
          return result;
        }
      } catch (error) {
        lastError = error;
        console.error('Error querying node:', error);

        if (!isIndexerError(error)) {
          incrementErrorCount(provider.rpc);
        }
      }

      numberAttempts++;
      if (numberAttempts >= MAX_NODES_PER_QUERY) break;
      await delay(DELAY_BETWEEN_NODE_ATTEMPTS);
    }
  }

  if (isIndexerError(lastError)) {
    console.log('Indexer error detected during retries.');
    return {
      code: 0,
      message: 'Transaction likely successful (indexer disabled)',
      txHash: lastError?.txHash || 'unknown',
    } as unknown as T;
  }

  console.error(`All node query attempts failed after ${MAX_NODES_PER_QUERY} attempts.`, lastError);
  throw new Error(
    `All node query attempts failed after ${MAX_NODES_PER_QUERY} attempts. ${lastError?.message || ''}`,
  );
};

export const queryRestNode = async <T>({
  endpoint,
  queryType = 'GET',
  feeDenom = LOCAL_ASSET_REGISTRY.note.denom,
  body,
}: {
  endpoint: string;
  queryType?: 'GET' | 'POST';
  feeDenom?: string;
  body?: BodyInit;
}) =>
  queryWithRetry<T>({
    endpoint,
    useRPC: false,
    queryType,
    feeDenom,
    body,
  });

export const queryRpcNode = async <T>({
  endpoint,
  messages,
  feeDenom = LOCAL_ASSET_REGISTRY.note.denom,
  simulateOnly = false,
  fee,
}: {
  endpoint: string;
  messages?: any[];
  feeDenom?: string;
  simulateOnly?: boolean;
  fee?: {
    amount: { denom: string; amount: string }[];
    gas: string;
  };
}) =>
  queryWithRetry<T>({
    endpoint,
    useRPC: true,
    messages,
    feeDenom,
    simulateOnly,
    fee,
  });
