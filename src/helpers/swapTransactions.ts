import { SwapObject, TransactionResult, RPCResponse, Asset } from '@/types';
import { CHAIN_ENDPOINTS } from '@/constants';
import { getValidFeeDenom } from './feeDenom';
import { symphony } from '@orchestra-labs/symphonyjs';
import { querySymphony } from './querySymphonyNodes';

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

export const swapTransaction = async (
  fromAddress: string,
  swapObject: SwapObject,
  simulateOnly: boolean = false,
): Promise<TransactionResult> => {
  console.log('Attempting swap with object:', swapObject);
  const endpoint = CHAIN_ENDPOINTS.sendMessage;

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
    const response = await querySymphony({
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
  const endpoint = CHAIN_ENDPOINTS.sendMessage;

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
    const response = await querySymphony({
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
