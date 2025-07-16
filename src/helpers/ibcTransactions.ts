import axios from 'axios';
import {
  GitHubFile,
  GitHubFileResponse,
  IBCChannel,
  IBCConnectionFile,
  IBCObject,
  RPCResponse,
  SendObject,
  TransactionResult,
  Uri,
} from '@/types';
import { COSMOS_CHAIN_ENDPOINTS, NetworkLevel, ONE_MINUTE } from '@/constants';
import { getIBCConnections, ibcConnectionsNeedRefresh, saveIBCConnections } from './dataHelpers';
import { queryRestNode, queryRpcNode } from './queryNodes';
import { getValidFeeDenom } from './feeDenom';
import { getIBCFile, ibcFileNeedsRefresh, saveIBCFile } from './dataHelpers/ibcChannel';
import { bech32 } from 'bech32';
import { fetchBech32Prefixes } from './fetchBech32Prefixes';

// TODO: pull on initial query for registry
const GITHUB_API_BASE_URL = 'https://api.github.com/repos/cosmos/chain-registry/contents';
const IBC_URLS = {
  testnet: `${GITHUB_API_BASE_URL}/testnets/_IBC`,
  mainnet: `${GITHUB_API_BASE_URL}/_IBC`,
};

const getValidIBCChannel = async (
  sendAddress: string,
  recipientAddress: string,
  network: NetworkLevel,
  prefix: string,
  restUris: Uri[],
): Promise<IBCChannel | null> => {
  if (!recipientAddress || !sendAddress) return null;
  console.log(
    `Fetching valid IBC channel for ${sendAddress} and recipient address: ${recipientAddress}`,
  );

  // Decode the Bech32 address
  let sendChain: string | null = null;
  let receiveChain: string | null = null;
  try {
    const decodedSenderAddress = bech32.decode(sendAddress);
    const decodedRecipientAddress = bech32.decode(recipientAddress);
    console.log(
      'Decoded Bech32 prefixes:',
      decodedSenderAddress.prefix,
      decodedRecipientAddress.prefix,
    );

    if (decodedSenderAddress.prefix === decodedRecipientAddress.prefix) return null;

    // TODO: go by network level
    const prefixes = await fetchBech32Prefixes();
    const testnetPrefixes = prefixes.filter(chain => chain.testnet !== null);
    const matchedSendChain = testnetPrefixes.find(
      chain => chain.testnet.toLowerCase() === decodedSenderAddress.prefix,
    );
    const matchedRecipientChain = testnetPrefixes.find(
      chain => chain.testnet.toLowerCase() === decodedRecipientAddress.prefix,
    );

    if (!matchedSendChain) {
      console.error(`Prefix ${decodedRecipientAddress.prefix} does not match any known chain.`);
      return null;
    }
    if (!matchedRecipientChain) {
      console.error(`Prefix ${decodedRecipientAddress.prefix} does not match any known chain.`);
      return null;
    }

    sendChain = matchedSendChain.coin;
    receiveChain = matchedRecipientChain.coin;
    console.log('Resolved receiveChain:', matchedRecipientChain);
  } catch (error) {
    console.error('Failed to decode Bech32 address or resolve chain:', error);
    return null;
  }

  if (!sendChain || !receiveChain) {
    console.error('Address could not be resolved to chain.');
    return null;
  }

  const ibcPaths = await fetchIbcPaths(network);
  const matchingFile = ibcPaths.find(file => {
    if (!sendChain || !receiveChain) return false;
    return (
      file.name.toLowerCase().includes(sendChain.toLowerCase()) &&
      file.name.toLowerCase().includes(receiveChain.toLowerCase())
    );
  });

  if (!matchingFile) {
    console.error('No matching IBC file found for the given chains.');
    return null;
  }

  // Fetch IBC file details
  const ibcFile = await fetchIBCFile(matchingFile, network);
  const ibcFileData = ibcFile?.data;

  if (!ibcFileData) {
    console.error('Failed to fetch IBC file details.');
    return null;
  }
  if (!ibcFileData.channels || !Array.isArray(ibcFileData.channels)) {
    console.error(
      'Failed to format IBC file channels.',
      !ibcFileData.channels,
      !Array.isArray(ibcFileData.channels),
    );
    return null;
  }

  // Query active IBC channels
  const activeChannels = await fetchActiveIBCChannels(prefix, restUris);

  if (!activeChannels.length) {
    console.error('No active IBC channels found on the sending chain.');
    return null;
  }

  // Validate channels
  const validChannel = activeChannels.find(channel =>
    ibcFileData.channels.some(fileChannel => {
      const matchOne =
        fileChannel.chain_1.channel_id === channel.channel_id &&
        fileChannel.chain_2.channel_id === channel.counterparty.channel_id;

      const matchTwo =
        fileChannel.chain_2.channel_id === channel.channel_id &&
        fileChannel.chain_1.channel_id === channel.counterparty.channel_id;

      return (matchOne || matchTwo) && channel.state === 'STATE_OPEN';
    }),
  );

  if (!validChannel) {
    console.error('No valid IBC channel found.');
    return null;
  }

  return validChannel;
};

export const isIBC = async ({
  sendAddress,
  recipientAddress,
  network,
  prefix,
  restUris,
}: {
  sendAddress: string;
  recipientAddress: string;
  network: NetworkLevel;
  prefix: string;
  restUris: Uri[];
}): Promise<boolean> => {
  console.log('checking is ibc.  send address', sendAddress, 'receive address', recipientAddress);
  if (sendAddress === recipientAddress) {
    return false;
  }

  const validChannel = await getValidIBCChannel(
    sendAddress,
    recipientAddress,
    network,
    prefix,
    restUris,
  );
  console.log('checking is ibc.  valid channel', validChannel);

  return validChannel !== null;
};

export const fetchActiveIBCChannels = async (
  prefix: string,
  restUris: Uri[],
): Promise<IBCChannel[]> => {
  console.log('Fetching active IBC channels...');
  try {
    const response = await queryRestNode({
      endpoint: COSMOS_CHAIN_ENDPOINTS.getIBCConnections,
      prefix,
      restUris,
    });
    console.log('Fetched IBC channels response:', response);
    return response.channels?.filter((channel: IBCChannel) => channel.state === 'STATE_OPEN') || [];
  } catch (error) {
    console.error('Error fetching active IBC channels:', error);
    return [];
  }
};

export const fetchIbcPaths = async (network: NetworkLevel): Promise<any[]> => {
  const ibcUrl = IBC_URLS[network];
  console.log(`Fetching IBC paths from URL: ${ibcUrl}`);

  const storedData = getIBCConnections(network);
  if (storedData && !ibcConnectionsNeedRefresh(storedData)) {
    console.log('Using cached IBC connections:', storedData.data);
    return storedData.data;
  }

  try {
    const response = await axios.get<GitHubFile[]>(ibcUrl);
    console.log('Fetched IBC paths from GitHub:', response.data);
    saveIBCConnections(network, response.data);
    return response.data;
  } catch (error) {
    console.error(`Error fetching ${network} IBC connections:`, error);
    return storedData ? storedData.data : [];
  }
};

export const fetchIBCFile = async (
  file: GitHubFile,
  network: NetworkLevel,
): Promise<IBCConnectionFile | null> => {
  const storedFile = getIBCFile(network, file.name);
  console.log('stored file', storedFile);

  if (storedFile && !ibcFileNeedsRefresh(storedFile)) {
    console.log(`Using cached IBC file content for: ${file.name}`);
    return storedFile;
  }

  try {
    console.log('Fetching IBC file from GitHub:', file.download_url);
    const response = await axios.get<GitHubFileResponse>(file.download_url);
    console.log('github file response', response);

    if (response.data.encoding === 'base64' && response.data.content) {
      const decodedContent = atob(response.data.content);
      console.log('Decoded file content:', decodedContent);

      const parsedContent = JSON.parse(decodedContent);
      console.log('Parsed IBC file content:', parsedContent);

      saveIBCFile(network, file.name, parsedContent);

      return parsedContent;
    }
    const directResponse = await axios.get(file.download_url);
    console.log('Fetched IBC file content directly:', directResponse.data);
    saveIBCFile(network, file.name, directResponse.data);

    return directResponse.data;
  } catch (error) {
    console.error('Error fetching IBC file:', error);

    return null;
  }
};

const sendIBCTransaction = async (
  fromAddress: string,
  sendObject: SendObject,
  connection: IBCChannel,
  simulateOnly: boolean = false,
  prefix: string,
  rpcUris: Uri[],
): Promise<TransactionResult> => {
  console.log('Preparing to send IBC transaction:', {
    fromAddress,
    sendObject,
    connection,
    simulateOnly,
    prefix,
    rpcUris,
  });
  const endpoint = COSMOS_CHAIN_ENDPOINTS.sendIbcMessage;

  const ibcMessageValue = {
    sourcePort: connection.port_id, // Usually "transfer" for IBC token transfers
    sourceChannel: connection.channel_id, // Channel ID for the IBC connection
    token: { denom: sendObject.denom, amount: sendObject.amount },
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
    const feeDenom = getValidFeeDenom(sendObject.denom, sendObject.assets);
    console.log('Determined fee denom:', feeDenom);

    const response = await queryRpcNode({
      endpoint,
      prefix,
      rpcUris,
      messages,
      feeDenom,
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

export const sendIBC = async ({
  ibcObject,
  prefix,
  restUris,
  rpcUris,
  simulateTransaction = false,
}: {
  ibcObject: IBCObject;
  prefix: string;
  restUris: Uri[];
  rpcUris: Uri[];
  simulateTransaction?: boolean;
}): Promise<TransactionResult> => {
  console.log('🚀 ~ sendIBC:', sendIBC);
  try {
    const validChannel = await getValidIBCChannel(
      ibcObject.fromAddress,
      ibcObject.sendObject.recipientAddress,
      ibcObject.networkLevel,
      prefix,
      restUris,
    );

    if (!validChannel) {
      console.error('No valid IBC channel available for this connection.');
      return {
        success: false,
        message: 'No valid IBC channel available for this connection.',
      };
    }

    console.log('Valid channel found:', validChannel);

    // Send the transaction using the validated channel
    const transactionResult = await sendIBCTransaction(
      ibcObject.fromAddress,
      ibcObject.sendObject,
      validChannel,
      simulateTransaction,
      prefix,
      rpcUris,
    );

    console.log('IBC Transaction result:', transactionResult);
    return transactionResult;
  } catch (error) {
    console.error('Error sending IBC transaction:', error);
    return {
      success: false,
      message: 'An error occurred while processing the IBC transaction.',
    };
  }
};
