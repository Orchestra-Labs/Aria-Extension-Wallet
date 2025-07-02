import { performRpcQuery } from './queryNodes';
import { SwapObject, TransactionResult, RPCResponse, Asset } from '@/types';
import {
  COSMOS_CHAIN_ENDPOINTS,
  DEFAULT_CHAIN_ID,
  DELAY_BETWEEN_NODE_ATTEMPTS,
  LOCAL_CHAIN_REGISTRY,
  MAX_RETRIES_PER_QUERY,
} from '@/constants';
import { createOfflineSignerFromMnemonic } from './dataHelpers/wallet';
import { delay } from './timer';
import { getValidFeeDenom } from './feeDenom';
import { getSessionToken } from './dataHelpers';
import { getSigningSymphonyClient, symphony } from '@orchestra-labs/symphonyjs';

const { swapSend } = symphony.market.v1beta1.MessageComposer.withTypeUrl;

export const isValidSwap = ({
  sendAsset,
  receiveAsset,
}: {
  sendAsset: Asset;
  receiveAsset: Asset;
}) => {
  const result = !sendAsset.isIbc && !receiveAsset.isIbc && sendAsset.denom !== receiveAsset.denom;

  return result;
};

// TODO: merge in with queryNodes.  add message object to query and parameter to determine which signer to use
const queryWithRetry = async ({
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
  const providers = LOCAL_CHAIN_REGISTRY[DEFAULT_CHAIN_ID].rpc_uris;
  console.log('Selected node providers:', providers);

  let numberAttempts = 0;

  while (numberAttempts < MAX_RETRIES_PER_QUERY) {
    for (const provider of providers) {
      try {
        const queryMethod = provider.address;
        console.log(`Querying node ${queryMethod} with endpoint: ${endpoint}`);

        const sessionToken = getSessionToken();
        if (!sessionToken) {
          console.error('Error- getSessionTokenFailed');
          return;
        }
        const offlineSigner = await createOfflineSignerFromMnemonic(sessionToken.mnemonic || '');

        // TODO: is this the only part different between here and queryNodes?
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
        // incrementErrorCount(provider.rpc);
        console.error('Error querying node:', error);
      }
      numberAttempts++;

      if (numberAttempts >= MAX_RETRIES_PER_QUERY) {
        break;
      }

      await delay(DELAY_BETWEEN_NODE_ATTEMPTS);
    }
  }

  throw new Error(`All node query attempts failed after ${MAX_RETRIES_PER_QUERY} attempts.`);
};

export const swapTransaction = async (
  fromAddress: string,
  swapObject: SwapObject,
  simulateOnly: boolean = false,
): Promise<TransactionResult> => {
  console.log('Attempting swap with object:', swapObject);
  const endpoint = COSMOS_CHAIN_ENDPOINTS.sendMessage;

  const messages = [
    swapSend({
      fromAddress,
      toAddress: swapObject.sendObject.recipientAddress,
      offerCoin: {
        denom: swapObject.sendObject.denom,
        amount: swapObject.sendObject.amount,
      },
      askDenom: swapObject.resultDenom,
    }),
  ];

  try {
    const feeDenom = getValidFeeDenom(
      swapObject.sendObject.denom,
      swapObject.sendObject.symphonyAssets,
    );
    console.log('Swap fee denom:', feeDenom);
    const response = await queryWithRetry({
      endpoint,
      walletAddress: fromAddress,
      messages,
      feeDenom,
      simulateOnly,
    });

    if (simulateOnly) {
      console.log('Swap simulation result:', response);
      return {
        success: true,
        message: 'Simulation of swap transaction completed successfully!',
        data: response,
      };
    }

    console.log('Successfully sent swap:', response);
    return {
      success: true,
      message: 'Swap transaction completed successfully!',
      data: response,
    };
  } catch (error: any) {
    console.error('Error during swap transaction:', error);

    const errorResponse: RPCResponse = {
      code: error.code || 1,
      message: error.message,
    };

    return {
      success: false,
      message: 'Error performing swap transaction. Please try again.',
      data: errorResponse,
    };
  }
};

// TODO: support swapping multiple tramsactons (fee is currently a blocker)
export const multiSwapTransaction = async (
  fromAddress: string,
  swapObjects: SwapObject[],
  simulateOnly: boolean = false,
): Promise<TransactionResult> => {
  const endpoint = COSMOS_CHAIN_ENDPOINTS.sendMessage;

  const messages = swapObjects.map(swapObject =>
    swapSend({
      fromAddress,
      toAddress: swapObject.sendObject.recipientAddress,
      offerCoin: {
        denom: swapObject.sendObject.denom,
        amount: swapObject.sendObject.amount,
      },
      askDenom: swapObject.resultDenom,
    }),
  );

  try {
    const feeDenom = getValidFeeDenom(
      swapObjects[0].sendObject.denom,
      swapObjects[0].sendObject.symphonyAssets,
    );
    const response = await queryWithRetry({
      endpoint,
      walletAddress: fromAddress,
      messages,
      feeDenom,
      simulateOnly,
    });

    if (simulateOnly) {
      console.log('Multi-swap simulation result:', response);
      return {
        success: true,
        message: 'Simulation of multi-swap transaction completed successfully!',
        data: response,
      };
    }

    console.log('Successfully sent to all recipients:', response);
    return {
      success: true,
      message: 'Multiple swap transactions completed successfully!',
      data: response,
    };
  } catch (error: any) {
    console.error('Error during multiple swap:', error);

    const errorResponse: RPCResponse = {
      code: error.code || 1,
      message: error.message,
    };

    return {
      success: false,
      message: 'Error performing multiple swap transaction. Please try again.',
      data: errorResponse,
    };
  }
};
