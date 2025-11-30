import {
  IBC_PREFIX,
  GAMM_PREFIX,
  GAMM_EXPONENT_DEFAULT,
  GREATER_EXPONENT_DEFAULT,
  COSMOS_CHAIN_ENDPOINTS,
  NetworkLevel,
} from '@/constants';
import { Asset, LocalChainRegistry, Uri, IbcRegistry } from '@/types';
import { queryRestNode } from './queryNodes';
import { safeTrimLowerCase } from './formatString';
import { getIbcRegistry } from './dataHelpers';

/**
 * Resolves an IBC hash to its base denom, path (trace), and origin chain ID.
 * Supports single-hop IBC transfers. Multi-hop transfers are detected but not fully resolved.
 */
export const resolveIbcDenom = async (
  ibcDenom: string,
  prefix: string,
  restUris: Uri[],
  currentChainId: string,
  chainRegistry: LocalChainRegistry,
): Promise<{
  baseDenom: string;
  path: string;
  originChainId: string;
}> => {
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
      for (const [connectionKey, connection] of Object.entries(networkRegistry as IbcRegistry)) {
        const chainIds = connectionKey.split(',');

        if (chainIds.includes(currentChainId)) {
          // Get the IBC info for the current chain's side
          const currentChainIBCInfo = connection[currentChainId];

          // Check if this chain's channel matches what we're looking for
          if (currentChainIBCInfo?.channel_id === channelId) {
            // Find the counterparty chain ID from the connection key
            const counterpartyChainId = chainIds.find(id => id !== currentChainId);

            if (counterpartyChainId) {
              originChainId = counterpartyChainId;
              break;
            }
          }
        }
      }
    }

    return {
      baseDenom,
      path,
      originChainId: originChainId || '', // Empty string indicates unresolved origin
    };
  } catch (error) {
    console.error(`[resolveIbcDenom] Error resolving IBC denom ${ibcDenom}:`, error);
    throw error; // Re-throw to allow caller to handle fallback
  }
};

/**
 * Finds asset metadata across the chain registry with prioritized lookup:
 * 1. Origin chain (if specified and assets exist)
 * 2. Current chain (critical for native assets)
 * 3. Global search across all chains (fallback for IBC assets)
 */
export const findAssetMetadata = (
  denom: string,
  chainRegistry: LocalChainRegistry,
  originChainId?: string,
  currentChainId?: string,
): Asset | undefined => {
  const normalizedDenom = safeTrimLowerCase(denom);

  // 1. Priority: Find in the specific origin chain (if known)
  if (originChainId && chainRegistry[originChainId]?.assets) {
    const found = Object.values(chainRegistry[originChainId].assets || {}).find(
      asset =>
        safeTrimLowerCase(asset.denom) === normalizedDenom ||
        safeTrimLowerCase(asset.originDenom || '') === normalizedDenom,
    );
    if (found) return found;
  }

  // 2. Secondary: Find in the current chain (Critical for native assets)
  if (currentChainId && chainRegistry[currentChainId]?.assets) {
    const found = Object.values(chainRegistry[currentChainId].assets || {}).find(
      asset =>
        safeTrimLowerCase(asset.denom) === normalizedDenom ||
        safeTrimLowerCase(asset.originDenom || '') === normalizedDenom,
    );
    if (found) return found;
  }

  // 3. Fallback: Search globally
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

/**
 * Creates a standardized Asset object with proper origin information.
 * Handles GAMM tokens, IBC tokens, and native assets with appropriate defaults.
 */
export const createAssetWithOriginInfo = (
  denom: string,
  chainId: string,
  chainRegistry: LocalChainRegistry,
  networkName: string,
  amount: string = '0',
  isIbc: boolean = false,
  resolvedOriginDenom?: string,
  resolvedOriginChainId?: string,
  trace?: string,
): Asset => {
  // Determine if this is a GAMM token (LP shares)
  const isGammToken = denom.startsWith(GAMM_PREFIX);

  // Prepare base denom for metadata lookup
  let baseDenomForLookup = resolvedOriginDenom || denom;

  if (isGammToken) {
    baseDenomForLookup = denom.replace(GAMM_PREFIX, '');
  }

  // Use resolved origin chain ID if available, otherwise fallback to current chain
  const originChainIdForLookup = resolvedOriginChainId || chainId;

  // Find asset metadata using prioritized lookup
  const assetMetadata = findAssetMetadata(
    baseDenomForLookup,
    chainRegistry,
    originChainIdForLookup !== chainId ? originChainIdForLookup : undefined,
    chainId,
  );

  // Set appropriate exponent
  let exponent = GREATER_EXPONENT_DEFAULT;
  if (isGammToken) {
    exponent = GAMM_EXPONENT_DEFAULT;
  } else if (assetMetadata?.exponent !== undefined) {
    exponent = assetMetadata.exponent;
  }

  // Calculate display amount
  const displayAmount = (parseFloat(amount) / Math.pow(10, exponent)).toFixed(exponent);

  // Determine final Origin Chain ID
  // Priority: 1. Resolved Chain ID (even if empty) 2. Metadata 3. Current chain
  const finalOriginChainId = resolvedOriginChainId || assetMetadata?.originChainId || chainId;

  // Construct the asset with proper origin information
  return {
    denom,
    amount,
    displayAmount,
    exchangeRate: '-',
    isIbc: isIbc || denom.startsWith(IBC_PREFIX), // Explicit IBC flag or detect from denom
    logo: assetMetadata?.logo || '',
    symbol:
      assetMetadata?.symbol ||
      (isGammToken ? `${denom.replace(GAMM_PREFIX, '')}` : denom.split('/').pop() || denom),
    name: assetMetadata?.name || (isGammToken ? `Pool ${denom.replace(GAMM_PREFIX, '')}` : denom),
    exponent,
    isFeeToken: assetMetadata?.isFeeToken || false,
    networkName,
    chainId,
    coinGeckoId: assetMetadata?.coinGeckoId,
    price: assetMetadata?.price || 0,
    originDenom: resolvedOriginDenom || assetMetadata?.originDenom || denom,
    originChainId: finalOriginChainId,
    trace: trace || assetMetadata?.trace,
  };
};

/**
 * Resolves an IBC denom and creates a standardized Asset object.
 * Handles resolution failures gracefully with fallback asset creation.
 */
export const resolveAndCreateIbcAsset = async (
  ibcDenom: string,
  chainId: string,
  prefix: string,
  restUris: Uri[],
  chainRegistry: LocalChainRegistry,
  networkName: string,
  amount: string = '0',
): Promise<Asset> => {
  try {
    const resolved = await resolveIbcDenom(ibcDenom, prefix, restUris, chainId, chainRegistry);

    return createAssetWithOriginInfo(
      ibcDenom,
      chainId,
      chainRegistry,
      networkName,
      amount,
      true, // isIbc
      resolved.baseDenom,
      resolved.originChainId,
      resolved.path,
    );
  } catch (error) {
    console.warn(
      `[resolveAndCreateIbcAsset] Failed to resolve IBC denom ${ibcDenom}, using fallback:`,
      error,
    );
    // Fallback: create asset without resolution but mark as IBC
    return createAssetWithOriginInfo(
      ibcDenom,
      chainId,
      chainRegistry,
      networkName,
      amount,
      true, // isIbc
    );
  }
};
