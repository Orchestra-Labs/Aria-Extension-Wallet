import { COSMOS_CHAIN_ENDPOINTS } from '@/constants';
import { queryRpcNode } from './queryNodes';
import { SendObject, TransactionResult, RPCResponse, Asset, Uri } from '@/types';

export const isValidSend = ({
  sendAsset,
  receiveAsset,
}: {
  sendAsset: Asset;
  receiveAsset: Asset;
}) => {
  const result =
    (sendAsset.originDenom || sendAsset.denom) === (receiveAsset.originDenom || receiveAsset.denom);
  return result;
};

export const sendTransaction = async (
  fromAddress: string,
  sendObject: SendObject,
  simulateOnly: boolean = false,
  prefix: string,
  rpcUris: Uri[],
): Promise<TransactionResult> => {
  const endpoint = COSMOS_CHAIN_ENDPOINTS.sendMessage;

  const messages = [
    {
      typeUrl: endpoint,
      value: {
        fromAddress,
        toAddress: sendObject.recipientAddress,
        amount: [{ denom: sendObject.denom, amount: sendObject.amount }],
      },
    },
  ];

  console.log('Sending transaction...');
  console.log('From Address:', fromAddress);
  console.log('To Address:', sendObject.recipientAddress);
  console.log('Amount:', sendObject.amount);
  console.log('Denom:', sendObject.denom);

  try {
    const feeToken = sendObject.feeToken;
    console.log('Fee Token:', feeToken);

    const response = await queryRpcNode({
      endpoint,
      prefix,
      rpcUris,
      messages,
      feeToken,
      simulateOnly,
    });

    if (simulateOnly) {
      console.log('Simulation completed successfully!');
      return {
        success: true,
        message: 'Simulation completed successfully!',
        data: response,
      };
    }

    console.log('Transaction sent successfully!');
    return {
      success: true,
      message: 'Transaction sent successfully!',
      data: response,
    };
  } catch (error: any) {
    console.error('Error during send:', error);

    // Construct error response in RPCResponse type
    const errorResponse: RPCResponse = {
      code: error.code || 1,
      message: error.message,
    };

    return {
      success: false,
      message: 'Error sending transaction. Please try again.',
      data: errorResponse,
    };
  }
};
