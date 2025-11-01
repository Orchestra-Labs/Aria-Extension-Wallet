import axios from 'axios';
import { DATA_QUERY_TIMEOUT, NetworkLevel, ORCHESTRA_REGISTRY_BASE } from '@/constants';
import { ChainRegistryData, IbcRegistryRecord } from '@/types';

export const fetchOrchestraChainRegistry = async (): Promise<ChainRegistryData | null> => {
  try {
    console.log('[OrchestraRegistry] Fetching chain registry from Orchestra Labs');
    const response = await axios.get(`${ORCHESTRA_REGISTRY_BASE}/chains`, {
      timeout: DATA_QUERY_TIMEOUT,
    });

    console.log('[OrchestraRegistry] Full response keys:', Object.keys(response.data.data));
    console.log(
      '[OrchestraRegistry] Mainnet keys:',
      response.data.data.mainnet ? Object.keys(response.data.data.mainnet) : 'no mainnet',
    );
    console.log(
      '[OrchestraRegistry] Testnet keys:',
      response.data.data.testnet ? Object.keys(response.data.data.testnet) : 'no testnet',
    );

    if (!response.data?.success || !response.data.data) {
      throw new Error('Invalid response format from Orchestra registry');
    }

    // Transform the Orchestra format to match our internal format
    const transformedData: ChainRegistryData = {
      mainnet: {},
      testnet: {},
    };

    // Process mainnet chains
    if (response.data.data.mainnet) {
      for (const [chainId, chainData] of Object.entries(response.data.data.mainnet)) {
        const chain = chainData as any;
        console.log(`[OrchestraRegistry] Processing mainnet chain ${chainId}:`, chain);

        transformedData.mainnet[chainId] = {
          chain_name: chain.chain_name,
          status: chain.status,
          website: chain.website,
          network_level: NetworkLevel.MAINNET, // Explicitly set
          pretty_name: chain.pretty_name || chain.chain_name,
          chain_type: chain.chain_type || 'cosmos',
          chain_id: chainId,
          bech32_prefix: chain.bech32_prefix || '',
          fees: chain.fees || [],
          staking_denoms: chain.staking_denoms || [],
          rpc_uris: chain.rpc_uris || [],
          rest_uris: chain.rest_uris || [],
          logo_uri: chain.logo_uri,
          assets: chain.assets || {},
        };
      }
    }

    // Process testnet chains
    if (response.data.data.testnet) {
      for (const [chainId, chainData] of Object.entries(response.data.data.testnet)) {
        const chain = chainData as any;
        console.log(`[OrchestraRegistry] Processing testnet chain ${chainId}:`, chain);

        transformedData.testnet[chainId] = {
          chain_name: chain.chain_name,
          status: chain.status,
          website: chain.website,
          network_level: NetworkLevel.TESTNET, // Explicitly set
          pretty_name: chain.pretty_name || chain.chain_name,
          chain_type: chain.chain_type || 'cosmos',
          chain_id: chainId,
          bech32_prefix: chain.bech32_prefix || '',
          fees: chain.fees || [],
          staking_denoms: chain.staking_denoms || [],
          rpc_uris: chain.rpc_uris || [],
          rest_uris: chain.rest_uris || [],
          logo_uri: chain.logo_uri,
          assets: chain.assets || {},
        };
      }
    }

    console.log(
      `[OrchestraRegistry] Successfully fetched ${Object.keys(transformedData.mainnet).length} mainnet chains, ${Object.keys(transformedData.testnet).length} testnet chains`,
    );
    return transformedData;
  } catch (error) {
    if (axios.isAxiosError(error) && error.code === 'ECONNABORTED') {
      console.log('[OrchestraRegistry] Request timeout, falling back to GitHub');
    } else {
      console.error('[OrchestraRegistry] Failed to fetch from Orchestra registry:', error);
    }
    return null;
  }
};

export const fetchOrchestraIbcRegistry = async (): Promise<IbcRegistryRecord | null> => {
  try {
    console.log('[OrchestraRegistry] Fetching IBC registry from Orchestra Labs');
    const response = await axios.get(`${ORCHESTRA_REGISTRY_BASE}/ibc`, {
      timeout: DATA_QUERY_TIMEOUT,
    });

    if (!response.data?.success || !response.data.data) {
      throw new Error('Invalid response format from Orchestra IBC registry');
    }

    const registry: IbcRegistryRecord = {
      data: response.data.data,
      lastUpdated: new Date().toISOString(),
      commitHashes: {
        mainnetHash: 'orchestra-registry',
        testnetHash: 'orchestra-registry',
      },
    };

    console.log(`[OrchestraRegistry] Successfully fetched IBC data`);
    return registry;
  } catch (error) {
    if (axios.isAxiosError(error) && error.code === 'ECONNABORTED') {
      console.log('[OrchestraRegistry] IBC request timeout, falling back to GitHub');
    } else {
      console.error('[OrchestraRegistry] Failed to fetch IBC data from Orchestra registry:', error);
    }
    return null;
  }
};
