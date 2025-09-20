import {
  COSMOS_CHAIN_ENDPOINTS,
  GAMM_EXPONENT_DEFAULT,
  GAMM_PREFIX,
  IBC_PREFIX,
  NetworkLevel,
  OSMOSIS_ENDPOINTS,
} from '@/constants';
import { Asset, LocalChainRegistry, SimplifiedChainInfo, Uri } from '@/types';
import { queryRestNode } from './queryNodes';
import { safeTrimLowerCase } from './formatString';
import { getIbcRegistry } from './dataHelpers';
import { getOsmosisChainId } from './utils';

export interface OsmosisPoolAsset {
  token: { denom: string; amount: string };
  weight: string;
}

export interface OsmosisPool {
  id: string;
  pool_assets: OsmosisPoolAsset[];
}

export interface OsmosisAssetListResponse {
  assets: Array<{
    denom: string;
    symbol: string;
    name: string;
    logo_URIs?: {
      png?: string;
      svg?: string;
    };
    coingecko_id?: string;
    exponent?: number;
  }>;
}

export interface ResolvedIbcAsset {
  baseDenom: string;
  path: string;
  originChainId: string;
}

export interface OsmosisAssetFetcherOptions {
  networkLevel: NetworkLevel;
  chainRegistry: LocalChainRegistry;
  fullChainRegistry: LocalChainRegistry;
  restUris: Uri[];
}

export const getReachableAssetsFromOsmosis = (
  osmosisAssets: Asset[],
  targetChainId?: string,
): Asset[] => {
  if (targetChainId) {
    // Return assets from a specific chain
    return osmosisAssets.filter(
      asset => asset.originChainId === targetChainId && asset.originChainId !== 'unknown',
    );
  }

  // Return all reachable assets
  return osmosisAssets.filter(asset => asset.originChainId !== 'unknown');
};

export const isAssetReachableOnOsmosis = (
  assetDenom: string,
  originChainId: string,
  osmosisAssets: Asset[],
): boolean => {
  return osmosisAssets.some(
    asset =>
      (asset.denom === assetDenom || asset.originDenom === assetDenom) &&
      asset.originChainId === originChainId,
  );
};

export const getOsmosisConnectedChains = async (networkLevel: NetworkLevel): Promise<string[]> => {
  const osmosisChainId = getOsmosisChainId(networkLevel);
  const ibcRegistry = getIbcRegistry();
  const networkRegistry =
    networkLevel === NetworkLevel.TESTNET ? ibcRegistry.data.testnet : ibcRegistry.data.mainnet;

  const connectedChains: string[] = [];

  if (!networkRegistry) {
    console.warn('No IBC registry found for network level:', networkLevel);
    return connectedChains;
  }

  // Find all connections that involve Osmosis
  for (const [connectionKey, connection] of Object.entries(networkRegistry)) {
    if (connectionKey.includes(osmosisChainId)) {
      const [chain1, chain2] = connectionKey.split(',');
      const isOsmosisFirst = chain1 === osmosisChainId;
      const otherChainId = isOsmosisFirst ? chain2 : chain1;

      const osmosisConnectionInfo = connection[osmosisChainId];
      const otherChainConnectionInfo = connection[otherChainId];

      if (osmosisConnectionInfo && otherChainConnectionInfo) {
        connectedChains.push(otherChainId);
      }
    }
  }

  console.log(
    `[getOsmosisConnectedChains] Found ${connectedChains.length} chains connected to Osmosis`,
  );
  return connectedChains;
};

export const isChainConnectedToOsmosis = (chainId: string, connectedChains: string[]): boolean => {
  return connectedChains.some(chain => chain === chainId);
};

export const getOsmosisConnectionInfo = (
  chainId: string,
  connectedChains: string[],
): string | undefined => {
  return connectedChains.find(chain => chain === chainId);
};

export const fetchOsmosisPools = async (
  restUris: string[],
  chainId: string,
): Promise<OsmosisPool[]> => {
  try {
    const response = await queryRestNode({
      prefix: 'osmo',
      endpoint: OSMOSIS_ENDPOINTS.pools,
      restUris: restUris.map(uri => ({ address: uri, provider: 'osmosis' })),
      chainId,
    });

    return response.pools || [];
  } catch (error) {
    console.error('Failed to fetch Osmosis pools:', error);
    return [];
  }
};

export const fetchOsmosisAssetList = async (
  restUris: string[],
  chainId: string,
): Promise<OsmosisAssetListResponse> => {
  try {
    // For tokenfactory, we need to use the creator address
    // This is a placeholder - you'll need to get the actual creator address
    const creatorAddress = 'osmo1...'; // Replace with actual creator address
    const endpoint = `${OSMOSIS_ENDPOINTS.getOsmosisAssetList}${creatorAddress}`;

    const response = await queryRestNode({
      prefix: 'osmo',
      endpoint,
      restUris: restUris.map(uri => ({ address: uri, provider: 'osmosis' })),
      chainId,
    });

    return { assets: response.denoms?.map((denom: string) => ({ denom })) || [] };
  } catch (error) {
    console.error('Failed to fetch Osmosis asset list:', error);
    return { assets: [] };
  }
};

export const extractAssetsFromOsmosisPools = (
  pools: OsmosisPool[],
  chainRegistry: LocalChainRegistry,
  networkLevel: NetworkLevel,
): Asset[] => {
  const assets: Asset[] = [];
  const seenDenoms = new Set<string>();

  for (const pool of pools) {
    for (const poolAsset of pool.pool_assets) {
      const denom = poolAsset.token.denom;

      if (seenDenoms.has(denom)) continue;
      seenDenoms.add(denom);

      // Try to find existing asset metadata in registry
      let assetMetadata: Partial<Asset> = {};
      for (const chain of Object.values(chainRegistry)) {
        if (chain.assets) {
          const found = Object.values(chain.assets).find(a => a.denom === denom);
          if (found) {
            assetMetadata = found;
            break;
          }
        }
      }

      assets.push({
        denom,
        amount: '0',
        displayAmount: '0',
        exchangeRate: '-',
        isIbc: denom.startsWith('ibc/'),
        logo: assetMetadata.logo || '',
        symbol: assetMetadata.symbol || denom.split('/').pop() || denom,
        name: assetMetadata.name || denom,
        exponent: assetMetadata.exponent || 6,
        isFeeToken: false,
        networkName: 'Osmosis',
        chainId: getOsmosisChainId(networkLevel),
        coinGeckoId: assetMetadata.coinGeckoId,
        price: 0,
        originDenom: denom,
        originChainId: getOsmosisChainId(networkLevel),
      });
    }
  }

  return assets;
};

// IBC and GAMM resolution functions
export const resolveIbcDenom = async (
  ibcDenom: string,
  prefix: string,
  restUris: Uri[],
  currentChainId: string,
  chainRegistry: LocalChainRegistry,
): Promise<ResolvedIbcAsset> => {
  try {
    const denomHash = ibcDenom.slice(4);
    const response = await queryRestNode({
      prefix,
      endpoint: `${COSMOS_CHAIN_ENDPOINTS.getIBCInfo}${denomHash}`,
      restUris,
      chainId: currentChainId,
    });

    if (!response.denom_trace?.base_denom) {
      throw new Error(`No denom trace found for ${ibcDenom}`);
    }

    const baseDenom = safeTrimLowerCase(response.denom_trace.base_denom);
    const path = response.denom_trace.path || '';
    let originChainId = '';

    // Extract channel ID from path (format: "transfer/channel-X")
    const pathParts = path.split('/');
    if (pathParts.length >= 2) {
      const channelId = pathParts[1];
      const ibcRegistry = getIbcRegistry();
      const networkLevel = chainRegistry[currentChainId]?.network_level;

      if (!networkLevel) {
        throw new Error(`Could not determine network level for chain ${currentChainId}`);
      }

      // Get the correct network registry (mainnet or testnet)
      const networkRegistry =
        networkLevel === NetworkLevel.TESTNET ? ibcRegistry.data.testnet : ibcRegistry.data.mainnet;

      if (!networkRegistry) {
        throw new Error(`No IBC registry found for network level: ${networkLevel}`);
      }

      // Find the connection that involves this channel
      for (const [connectionKey, connection] of Object.entries(networkRegistry)) {
        if (connectionKey.includes(currentChainId)) {
          const [chain1, chain2] = connectionKey.split(',');
          const isCurrentChainFirst = chain1 === currentChainId;

          // Get the channel info for current chain
          const currentChainIBCInfo = connection[currentChainId];

          if (currentChainIBCInfo?.channel_id === channelId) {
            // The counterparty is the other chain in this connection
            originChainId = isCurrentChainFirst ? chain2 : chain1;
            break;
          }
        }
      }
    }

    return {
      baseDenom,
      path,
      originChainId: originChainId || 'unknown',
    };
  } catch (error) {
    console.error(`Error resolving IBC denom ${ibcDenom}:`, error);
    throw error;
  }
};

export const resolveGammDenom = (gammDenom: string): string => {
  // GAMM denoms are in format: gamm/pool/{pool_id}
  return gammDenom.replace(GAMM_PREFIX, '');
};

export const findAssetMetadata = (
  denom: string,
  chainRegistry: LocalChainRegistry,
  originChainId?: string,
): Asset | undefined => {
  const normalizedDenom = safeTrimLowerCase(denom);

  // First try to find in the specified origin chain
  if (originChainId && chainRegistry[originChainId]?.assets) {
    const found = Object.values(chainRegistry[originChainId].assets || {}).find(
      asset =>
        safeTrimLowerCase(asset.denom) === normalizedDenom ||
        safeTrimLowerCase(asset.originDenom || '') === normalizedDenom,
    );
    if (found) return found;
  }

  // Search through all chains if origin chain not specified or not found
  for (const chain of Object.values(chainRegistry)) {
    if (!chain.assets) continue;

    const found = Object.values(chain.assets).find(
      asset =>
        safeTrimLowerCase(asset.denom) === normalizedDenom ||
        safeTrimLowerCase(asset.originDenom || '') === normalizedDenom,
    );

    if (found) return found;
  }

  return undefined;
};

// Main asset fetching function
export const fetchAllOsmosisAssets = async (
  options: OsmosisAssetFetcherOptions,
): Promise<Asset[]> => {
  const { networkLevel, chainRegistry, fullChainRegistry, restUris } = options;

  const osmosisChainId = getOsmosisChainId(networkLevel);
  const osmosisChainInfo = chainRegistry[osmosisChainId] as SimplifiedChainInfo;

  if (!osmosisChainInfo) {
    throw new Error(`Osmosis chain info not found for chain ID: ${osmosisChainId}`);
  }

  console.log(`[fetchAllOsmosisAssets] Fetching assets for Osmosis chain: ${osmosisChainId}`);

  // Fetch data from multiple sources concurrently
  const [pools, assetList, chainRegistryAssets] = await Promise.all([
    fetchOsmosisPools(
      restUris.map(uri => uri.address),
      osmosisChainId,
    ),
    fetchOsmosisAssetList(
      restUris.map(uri => uri.address),
      osmosisChainId,
    ),
    Promise.resolve(Object.values(chainRegistry[osmosisChainId]?.assets || {})),
  ]);

  console.log(`[fetchAllOsmosisAssets] Found:
    - ${pools.length} pools
    - ${assetList.assets.length} assets from tokenfactory
    - ${chainRegistryAssets.length} assets from chain registry`);

  // Extract assets from pools
  const poolAssets = extractAssetsFromOsmosisPools(pools, fullChainRegistry, networkLevel);

  // Process tokenfactory assets
  const tokenFactoryAssets = assetList.assets.map(asset => {
    const existingMetadata = findAssetMetadata(asset.denom, fullChainRegistry, osmosisChainId);

    return {
      denom: asset.denom,
      amount: '0',
      displayAmount: '0',
      exchangeRate: '-',
      isIbc: asset.denom.startsWith(IBC_PREFIX),
      logo: asset.logo_URIs?.png || asset.logo_URIs?.svg || existingMetadata?.logo || '',
      symbol:
        asset.symbol || existingMetadata?.symbol || asset.denom.split('/').pop() || asset.denom,
      name: asset.name || existingMetadata?.name || asset.denom,
      exponent: asset.exponent || existingMetadata?.exponent || 6,
      isFeeToken: false,
      networkName: 'Osmosis',
      chainId: osmosisChainId,
      coinGeckoId: asset.coingecko_id || existingMetadata?.coinGeckoId,
      price: 0,
      originDenom: asset.denom,
      originChainId: osmosisChainId,
    };
  });

  // Combine all assets and remove duplicates
  const allAssets = [...chainRegistryAssets, ...poolAssets, ...tokenFactoryAssets];
  const uniqueAssets = new Map<string, Asset>();

  for (const asset of allAssets) {
    if (!uniqueAssets.has(asset.denom)) {
      uniqueAssets.set(asset.denom, asset);
    }
  }

  // Resolve IBC and GAMM denoms
  const resolvedAssets = await Promise.all(
    Array.from(uniqueAssets.values()).map(async (asset): Promise<Asset> => {
      let originDenom = asset.denom;
      let originChainId = asset.originChainId;
      let isIbc = asset.isIbc;

      try {
        if (asset.denom.startsWith(IBC_PREFIX)) {
          const resolved = await resolveIbcDenom(
            asset.denom,
            osmosisChainInfo.bech32_prefix,
            restUris,
            osmosisChainId,
            fullChainRegistry,
          );

          originDenom = resolved.baseDenom;
          originChainId = resolved.originChainId;
          isIbc = true;

          // Try to find metadata for the resolved denom
          const resolvedMetadata = findAssetMetadata(originDenom, fullChainRegistry, originChainId);
          if (resolvedMetadata) {
            return {
              ...asset,
              ...resolvedMetadata,
              originDenom,
              originChainId,
              isIbc,
              chainId: osmosisChainId, // Keep chainId as osmosis since asset is on osmosis
            };
          }
        } else if (asset.denom.startsWith(GAMM_PREFIX)) {
          originDenom = resolveGammDenom(asset.denom);
          // For GAMM tokens, we might want to handle them differently
          // For now, just mark them as GAMM and use default values
          return {
            ...asset,
            symbol: `GAMM ${originDenom}`,
            name: `GAMM Pool ${originDenom}`,
            exponent: GAMM_EXPONENT_DEFAULT,
            originDenom,
            originChainId: osmosisChainId,
            isIbc: false,
          };
        }
      } catch (error) {
        console.warn(`Failed to resolve denom ${asset.denom}:`, error);
        // Keep original asset if resolution fails
      }

      return {
        ...asset,
        originDenom,
        originChainId,
        isIbc,
      };
    }),
  );

  console.log(`[fetchAllOsmosisAssets] Final resolved assets: ${resolvedAssets.length}`);

  return resolvedAssets;
};

export const getOsmosisAssetsWithResolutions = async (
  networkLevel: NetworkLevel,
  chainRegistry: LocalChainRegistry,
  fullChainRegistry: LocalChainRegistry,
): Promise<Asset[]> => {
  const osmosisChainId = getOsmosisChainId(networkLevel);
  const osmosisChainInfo = chainRegistry[osmosisChainId];

  if (!osmosisChainInfo) {
    console.warn(`Osmosis chain info not found for network level: ${networkLevel}`);
    return [];
  }

  const options: OsmosisAssetFetcherOptions = {
    networkLevel,
    chainRegistry,
    fullChainRegistry,
    restUris: osmosisChainInfo.rest_uris || [],
  };

  try {
    return await fetchAllOsmosisAssets(options);
  } catch (error) {
    console.error('Failed to fetch Osmosis assets:', error);
    return [];
  }
};

// Utility functions
export const getOriginChainsFromOsmosisAssets = (assets: Asset[]): string[] => {
  const chainIds = new Set<string>();

  assets.forEach(asset => {
    if (asset.originChainId && asset.originChainId !== 'unknown') {
      chainIds.add(asset.originChainId);
    }
  });

  return Array.from(chainIds);
};

export const enrichOsmosisAssetsWithOriginData = (
  assets: Asset[],
  fullChainRegistry: LocalChainRegistry,
): Asset[] => {
  return assets.map(asset => {
    if (asset.originChainId && asset.originChainId !== 'unknown') {
      const originChain = fullChainRegistry[asset.originChainId];
      const originAsset = findAssetMetadata(
        asset.originDenom,
        fullChainRegistry,
        asset.originChainId,
      );

      if (originAsset) {
        return {
          ...asset,
          logo: asset.logo || originAsset.logo,
          symbol: asset.symbol || originAsset.symbol,
          name: asset.name || originAsset.name,
          exponent: asset.exponent || originAsset.exponent,
          coinGeckoId: asset.coinGeckoId || originAsset.coinGeckoId,
          networkName: originChain?.pretty_name || originChain?.chain_name || asset.networkName,
        };
      }
    }
    return asset;
  });
};
