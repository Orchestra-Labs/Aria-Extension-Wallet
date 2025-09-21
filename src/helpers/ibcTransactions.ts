import {
  IBCChannel,
  IBCObject,
  RPCResponse,
  SimplifiedChainInfo,
  TransactionResult,
  Uri,
} from '@/types';
import { COSMOS_CHAIN_ENDPOINTS, NetworkLevel, ONE_MINUTE } from '@/constants';
import { queryRestNode, queryRpcNode } from './queryNodes';
import { getIbcChannelInfo } from './ibcUtils';

export const checkChannelState = async ({
  channelId,
  portId = 'transfer',
  chainId,
  prefix,
  restUris,
}: {
  channelId: string;
  portId?: string;
  chainId: string;
  prefix: string;
  restUris: Uri[];
}): Promise<{ isOpen: boolean; channel?: any }> => {
  try {
    const response = await queryRestNode({
      endpoint: `${COSMOS_CHAIN_ENDPOINTS.getIBCConnections}/${channelId}/ports/${portId}`,
      prefix,
      restUris,
      chainId,
    });

    console.log('[checkChannelState] Raw response:', response);

    // Check if channel exists and is in OPEN state based on the actual response format
    const isOpen = response.channel?.state === 'STATE_OPEN';

    return {
      isOpen,
      channel: response.channel,
    };
  } catch (error) {
    console.error('Error checking channel state:', error);
    return { isOpen: false };
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

  // Check the specific channel state
  const channelState = await checkChannelState({
    channelId: channelInfo.chain1.channel_id,
    chainId: sendChain.chain_id,
    prefix,
    restUris,
  });

  console.log('[getValidIBCChannel] Channel state check result:', channelState);

  if (channelState.isOpen) {
    return {
      channel_id: channelInfo.chain1.channel_id,
      port_id: 'transfer',
    };
  }

  console.log('[getValidIBCChannel] Channel is not open or not found');
  return null;
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

    // For simulation, re-throw account not found errors so they can be handled upstream
    if (
      simulateOnly &&
      (error.message?.includes('does not exist on chain') ||
        error.message?.includes('account not found'))
    ) {
      throw error; // Re-throw for upstream handling
    }

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
