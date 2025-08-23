import {
  IBCChannel,
  IBCChannelData,
  IBCObject,
  RPCResponse,
  SimplifiedChainInfo,
  TransactionResult,
  Uri,
} from '@/types';
import { COSMOS_CHAIN_ENDPOINTS, NetworkLevel, ONE_MINUTE } from '@/constants';
import { queryRestNode, queryRpcNode } from './queryNodes';
import { getIbcChannelInfo } from './ibcUtils';

export const fetchActiveIBCChannels = async ({
  chainId,
  prefix,
  restUris,
}: {
  chainId: string;
  prefix: string;
  restUris: Uri[];
}): Promise<IBCChannelData[]> => {
  try {
    const response = await queryRestNode({
      endpoint: COSMOS_CHAIN_ENDPOINTS.getIBCConnections,
      prefix,
      restUris,
      chainId,
    });
    return (
      response.channels?.filter((channel: IBCChannelData) => channel.state === 'STATE_OPEN') || []
    );
  } catch (error) {
    console.error('Error fetching active IBC channels:', error);
    return [];
  }
};

export const getValidIBCChannel = async ({
  sendChain,
  receiveChainId,
  networkLevel,
  prefix,
  restUris,
}: {
  sendChain: SimplifiedChainInfo;
  receiveChainId: string;
  networkLevel: NetworkLevel;
  prefix: string;
  restUris: Uri[];
}): Promise<IBCChannel | null> => {
  console.log('[TransactionType] Checking for valid channel:', { sendChain, receiveChainId });
  if (sendChain.chain_id === receiveChainId || !sendChain || !receiveChainId) return null;

  const fromChainId = sendChain.chain_id;

  // Get IBC channel info from registry
  const channelInfo = getIbcChannelInfo(fromChainId, receiveChainId, networkLevel);
  if (!channelInfo) return null;
  console.log('[TransactionType] Channel Info?:', channelInfo);

  // Query active IBC channels
  const activeChannels = await fetchActiveIBCChannels({ chainId: fromChainId, prefix, restUris });
  if (!activeChannels.length) return null;
  console.log('[TransactionType] Active Channels?:', activeChannels);

  // Find matching active channel
  const validChannel = activeChannels.find(
    channel => channel.channel_id === channelInfo.chain1.channel_id,
  );
  console.log('[TransactionType] Valid Channel?:', validChannel);

  return validChannel || null;
};

interface SendIBCTransactionParams {
  ibcObject: IBCObject;
  prefix: string;
  rpcUris: Uri[];
  chainId: string;
  simulateOnly?: boolean;
}

export const sendIBCTransaction = async ({
  ibcObject,
  prefix,
  rpcUris,
  chainId,
  simulateOnly = false,
}: SendIBCTransactionParams): Promise<TransactionResult> => {
  const endpoint = COSMOS_CHAIN_ENDPOINTS.sendIbcMessage;
  const fromAddress = ibcObject.fromAddress;
  const sendObject = ibcObject.sendObject;
  const ibcChannel = ibcObject.ibcChannel;
  console.log('Preparing to send IBC transaction:', {
    fromAddress,
    ibcObject,
    simulateOnly,
    prefix,
    rpcUris,
  });

  const ibcMessageValue = {
    sourcePort: ibcChannel.port_id, // Usually "transfer" for IBC token transfers
    sourceChannel: ibcChannel.channel_id, // Channel ID for the IBC connection
    token: { denom: sendObject.denom, amount: sendObject.amount }, // use the ibc denom, not the original
    sender: fromAddress,
    receiver: sendObject.recipientAddress,
    timeoutTimestamp: `${Date.now() + ONE_MINUTE}000000`, // Nanoseconds
  };

  const messages = [
    {
      typeUrl: '/ibc.applications.transfer.v1.MsgTransfer',
      value: ibcMessageValue,
    },
  ];
  console.log('Prepared transaction messages:', messages);

  try {
    const feeToken = sendObject.feeToken;
    console.log('Determined fee token:', feeToken);

    const response = await queryRpcNode({
      endpoint,
      prefix,
      rpcUris,
      messages,
      feeToken,
      chainId: chainId,
      simulateOnly,
    });

    console.log('IBC transaction response:', response);

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
