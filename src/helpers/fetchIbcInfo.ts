import { IBCConnection } from '@/types';
import { queryRestNode } from './queryNodes';
import { CHAIN_ENDPOINTS, IBCConnectionState } from '@/constants';
import { queryRpcNode } from './queryNodes';
import { SendObject, TransactionResult, RPCResponse } from '@/types';
import { getValidFeeDenom } from './feeDenom';

export const fetchIbcConnections = async (): Promise<IBCConnection[]> => {
  try {
    const endpoint = `${CHAIN_ENDPOINTS.getIBCConnections}`;
    const response = await queryRestNode({ endpoint });

    // Return the IBC connections from the response
    return (response.connections ?? []).map((connection: any) => ({
      id: connection.id,
      client_id: connection.client_id,
      counterparty_client_id: connection.counterparty_client_id,
      counterparty_connection_id: connection.counterparty_connection_id,
      state: connection.state as IBCConnectionState,
    }));
  } catch (error) {
    console.error('Error fetching IBC connections:', error);
    throw error;
  }
};

/**
 * Send assets across IBC channels.
 * @param fromAddress - The sender's address
 * @param sendObject - The sendObject containing recipient address, denom, and amount
 * @param connection - The IBC connection details
 * @param simulateOnly - Whether to simulate the transaction
 * @returns A result object indicating success or failure
 */
export const sendIbcTransaction = async (
  fromAddress: string,
  sendObject: SendObject,
  connection: IBCConnection,
  simulateOnly: boolean = false,
): Promise<TransactionResult> => {
  const endpoint = CHAIN_ENDPOINTS.sendIbcMessage;

  const messages = [
    {
      typeUrl: endpoint,
      value: {
        fromAddress,
        toAddress: sendObject.recipientAddress,
        amount: [{ denom: sendObject.denom, amount: sendObject.amount }],
        connection_id: connection.id,
        counterparty_connection_id: connection.counterparty_connection_id,
      },
    },
  ];

  try {
    const feeDenom = getValidFeeDenom(sendObject.denom);
    const response = await queryRpcNode({
      endpoint,
      messages,
      feeDenom,
      simulateOnly,
    });

    if (simulateOnly) {
      return {
        success: true,
        message: 'Simulation completed successfully!',
        data: response,
      };
    }

    return {
      success: true,
      message: 'IBC Transaction sent successfully!',
      data: response,
    };
  } catch (error: any) {
    console.error('Error during IBC send:', error);

    const errorResponse: RPCResponse = {
      code: error.code || 1,
      message: error.message,
    };

    return {
      success: false,
      message: 'Error sending IBC transaction. Please try again.',
      data: errorResponse,
    };
  }
};

export const sendIbcAsset = async (fromAddress: string, sendObject: SendObject) => {
  try {
    const connections = await fetchIbcConnections();

    if (connections.length > 0) {
      // Select a connection (you can refine this by picking the correct one)
      const connection = connections[0];

      // Send transaction using the first available IBC connection
      const result = await sendIbcTransaction(fromAddress, sendObject, connection);
      console.log('IBC Transaction Result:', result);
    } else {
      console.error('No IBC connections available');
    }
  } catch (error) {
    console.error('Error sending IBC asset:', error);
  }
};
