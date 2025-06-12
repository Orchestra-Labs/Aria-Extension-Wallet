import { incrementErrorCount, performRpcQuery, selectNodeProviders } from './queryNodes';
import { DELAY_BETWEEN_NODE_ATTEMPTS, MAX_NODES_PER_QUERY } from '@/constants';
import { createOfflineSignerFromMnemonic } from './dataHelpers/wallet';
import { delay } from './timer';
import { getSessionToken } from './dataHelpers';
import { getSigningSymphonyClient } from '@orchestra-labs/symphonyjs';

export const querySymphony = async ({
  endpoint,
  walletAddress,
  messages = [],
  feeDenom,
  simulateOnly = false,
}: {
  endpoint: string;
  walletAddress: string;
  messages?: any[];
  feeDenom: string;
  simulateOnly?: boolean;
}): Promise<any> => {
  const providers = selectNodeProviders();
  console.log('Selected node providers:', providers);

  let numberAttempts = 0;

  while (numberAttempts < MAX_NODES_PER_QUERY) {
    for (const provider of providers) {
      try {
        const queryMethod = provider.rpc;
        console.log(`Querying node ${queryMethod} with endpoint: ${endpoint}`);

        const sessionToken = getSessionToken();
        if (!sessionToken) {
          console.error('Error- getSessionTokenFailed');
          return;
        }
        const offlineSigner = await createOfflineSignerFromMnemonic(sessionToken.mnemonic || '');

        const client = await getSigningSymphonyClient({
          rpcEndpoint: queryMethod,
          signer: offlineSigner,
        });

        const result = await performRpcQuery(
          client,
          walletAddress,
          messages,
          feeDenom,
          simulateOnly,
        );
        return result;
      } catch (error) {
        incrementErrorCount(provider.rpc);
        console.error('Error querying node:', error);
      }
      numberAttempts++;

      if (numberAttempts >= MAX_NODES_PER_QUERY) {
        break;
      }

      await delay(DELAY_BETWEEN_NODE_ATTEMPTS);
    }
  }

  throw new Error(`All node query attempts failed after ${MAX_NODES_PER_QUERY} attempts.`);
};
