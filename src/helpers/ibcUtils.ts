import { NetworkLevel } from '@/constants';
import { IbcConnection, IbcRegistry, LocalChainRegistry } from '@/types';
import { getIbcRegistry } from './dataHelpers';

export const getIbcChannelInfo = (
  chainId1: string,
  chainId2: string,
  network: NetworkLevel,
): { chain1: IbcConnection; chain2: IbcConnection } | null => {
  console.log('[TransactionType] Getting registry');
  const registry = getIbcRegistry();
  const key1 = `${chainId1},${chainId2}`;
  const key2 = `${chainId2},${chainId1}`;

  const connection = registry.data[network][key1] || registry.data[network][key2];
  console.log('[TransactionType] Connection:', connection);

  if (!connection) return null;

  return {
    chain1: connection[chainId1],
    chain2: connection[chainId2],
  };
};

export const resolveChainId = (chainName: string, registry: LocalChainRegistry): string | null => {
  const exactMatch = Object.entries(registry).find(
    ([_, info]) => info.chain_name.toLowerCase() === chainName.toLowerCase(),
  );
  return exactMatch?.[0] || null;
};

// TODO: avoid reading this in so much
export const processIbcData = (
  ibcFiles: any[], // Always an array of IBC connection objects
  chainRegistry: LocalChainRegistry,
): IbcRegistry => {
  console.log('[IBC] IBC data:', ibcFiles);
  const result: IbcRegistry = {};

  for (const fileData of ibcFiles) {
    try {
      // Skip if invalid structure
      if (!fileData?.chain_1 || !fileData?.chain_2 || !fileData?.channels?.[0]) {
        // console.warn('Skipping invalid IBC file structure:', fileData);
        continue;
      }

      const chain1Id = resolveChainId(fileData.chain_1.chain_name, chainRegistry);
      const chain2Id = resolveChainId(fileData.chain_2.chain_name, chainRegistry);

      // Skip if chain ds not found
      if (!chain1Id || !chain2Id) {
        // console.warn(
        //   `Skipping - Could not resolve chain Ids for: ${fileData.chain_1.chain_name} or ${fileData.chain_2.chain_name}`,
        // );
        continue;
      }

      const activeChannel =
        fileData.channels.find(
          (ch: any) => ch.tags?.status === 'live' || ch.state === 'STATE_OPEN',
        ) || fileData.channels[0];

      const key = `${chain1Id},${chain2Id}`;

      result[key] = {
        [chain1Id]: {
          client_id: fileData.chain_1.client_id,
          connection_id: fileData.chain_1.connection_id,
          channel_id: activeChannel.chain_1.channel_id,
        },
        [chain2Id]: {
          client_id: fileData.chain_2.client_id,
          connection_id: fileData.chain_2.connection_id,
          channel_id: activeChannel.chain_2.channel_id,
        },
      };
    } catch (error) {
      console.error('Error processing IBC file:', fileData, error);
    }
  }

  return result;
};
