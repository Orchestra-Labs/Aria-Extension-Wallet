import {
  COSMOS_CHAIN_ENDPOINTS,
  GAMM_EXPONENT_DEFAULT,
  GAMM_PREFIX,
  IBC_PREFIX,
  NetworkLevel,
  OSMOSIS_ENDPOINTS,
  OSMOSIS_REVENUE_CONFIG,
} from '@/constants';
import { Asset, FeeToken, LocalChainRegistry, SimplifiedChainInfo, Uri } from '@/types';
import { queryRestNode } from './queryNodes';
import { safeTrimLowerCase } from './formatString';
import { getIbcRegistry } from './dataHelpers';
import { getOsmosisChainId } from './utils';
import { getCombinedCosmosSigner, getCosmosDirectSigner } from './signers';
import { osmosis, getSigningOsmosisClient } from 'osmojs';
import { coin, coins } from '@cosmjs/amino';
import { getKeplrStyleGasEstimates } from './exchangeTransactions';
import { SigningCosmWasmClient } from '@cosmjs/cosmwasm-stargate';

const { swapExactAmountIn } = osmosis.gamm.v1beta1.MessageComposer.withTypeUrl;

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

interface RouteResponse {
  amount_in: {
    denom: string;
    amount: string;
  };
  amount_out: string;
  route: Array<{
    pools: Array<{
      id: number;
      type: number;
      token_out_denom: string;
      spread_factor: string;
      taker_fee: string;
    }>;
    out_amount: string;
    in_amount: string;
  }>;
  effective_fee: string;
  price_impact: string;
}

// Smart contract message structure
interface SwapMessage {
  swap: {
    routes: Array<{
      pool_id: string;
      token_out_denom: string;
    }>;
    token_out_min_amount: {
      denom: string;
      amount: string;
    };
    fee_percentage?: string;
    fee_collector?: string;
  };
}

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

// TODO: replace this stub with real functionality.
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

export async function getOsmosisDEXRoutes(
  tokenInAmount: string,
  tokenInDenom: string,
  tokenOutDenom: string,
): Promise<{ routes: any[]; amountOut: string; tokenOutMinAmount: string }> {
  try {
    // URL encode parameters
    const encodedTokenIn = encodeURIComponent(`${tokenInAmount}${tokenInDenom}`);
    const encodedTokenOutDenom = encodeURIComponent(tokenOutDenom);

    const url = `https://sqs.osmosis.zone/router/quote?tokenIn=${encodedTokenIn}&tokenOutDenom=${encodedTokenOutDenom}&humanDenoms=false&applyExponents=false`;

    const response = await fetch(url);

    if (!response.ok) {
      throw new Error(`Failed to fetch routes: ${response.statusText}`);
    }

    const data: RouteResponse = await response.json();

    if (!data.route || data.route.length === 0) {
      throw new Error('No routes returned from Osmosis SQS');
    }

    // Use 'out_amount' (not amount_out) for sorting individual routes
    const bestRoute = data.route.sort((a, b) => Number(b.out_amount) - Number(a.out_amount))[0];

    // Map the pools from the single best route
    const routes = bestRoute.pools.map(pool => ({
      poolId: pool.id.toString(),
      tokenOutDenom: pool.token_out_denom,
    }));

    // Use 'out_amount' from the specific best route
    const amountOut = bestRoute.out_amount;
    const minAmount = Math.floor(parseInt(amountOut) * 0.99).toString();

    return {
      routes,
      amountOut,
      tokenOutMinAmount: minAmount,
    };
  } catch (error) {
    console.error('Error fetching routes:', error);
    throw error;
  }
}
// TODO: allow for setting via amount out
// NOTE: documentation at https://docs.osmosis.zone/osmojs/#doing-a-swap
export async function useOsmosisDEX({
  mnemonic,
  rpcEndpoint,
  senderAddress,
  tokenIn,
  tokenOutDenom,
  feeToken,
  routes = [],
  tokenOutMinAmount,
  memo = 'aria wallet',
  gasMultiplier = 1.3,
  useSmartContract = true,
  simulateOnly = false,
}: {
  mnemonic: string;
  rpcEndpoint: string;
  senderAddress: string;
  tokenIn: {
    amount: string;
    denom: string;
  };
  tokenOutDenom: string;
  feeToken: FeeToken;
  routes?: {
    poolId: string;
    tokenOutDenom: string;
  }[];
  tokenOutMinAmount?: string;
  memo?: string;
  gasMultiplier?: number;
  feeLevel?: 'low' | 'medium' | 'high';
  useSmartContract?: boolean;
  simulateOnly?: boolean;
}): Promise<any> {
  try {
    // Get routes from SQS endpoint if not provided
    let dexRoutes: any[] = routes;
    let finalTokenOutMinAmount = tokenOutMinAmount;

    if (dexRoutes.length === 0 || !tokenOutMinAmount) {
      const routeData = await getOsmosisDEXRoutes(tokenIn.amount, tokenIn.denom, tokenOutDenom);
      dexRoutes = routeData.routes;
      finalTokenOutMinAmount = routeData.tokenOutMinAmount;
    }

    if (dexRoutes.length === 0) {
      throw new Error('No exchange route found');
    }

    if (useSmartContract) {
      const signer = await getCosmosDirectSigner(mnemonic, 'osmo');
      const signingClient = await SigningCosmWasmClient.connectWithSigner(rpcEndpoint, signer);

      // Generate fee and message for smart contract
      const simulationResult = await simulateUseSmartContract({
        signingClient,
        senderAddress,
        tokenIn,
        tokenOutDenom,
        feeToken,
        routes: dexRoutes,
        tokenOutMinAmount: finalTokenOutMinAmount!,
        memo,
        gasMultiplier,
      });

      // Return early if simulation only
      if (simulateOnly) {
        console.log('[DEBUG][osmosisApiHelper] Smart contract simulation results:');
        console.log('[DEBUG][osmosisApiHelper] Estimated gas:', simulationResult.gasEstimated);
        console.log('[DEBUG][osmosisApiHelper] Recommended fee:', simulationResult.fee);

        return {
          success: true,
          simulated: true,
          estimatedGas: simulationResult.gasEstimated,
          recommendedFee: simulationResult.fee,
          routes: dexRoutes,
          tokenOutMinAmount: finalTokenOutMinAmount,
        };
      }

      // Execute actual swap with pre-generated fee and message
      return await useAffiliateSmartContract({
        signingClient,
        senderAddress,
        executeMsg: simulationResult.msg,
        fee: simulationResult.fee,
        memo,
        routes: dexRoutes,
        tokenOutMinAmount: finalTokenOutMinAmount!,
      });
    } else {
      const signer = await getCombinedCosmosSigner(mnemonic, 'osmo');
      const signingClient = await getSigningOsmosisClient({
        rpcEndpoint,
        signer,
      });

      // Generate fee and message for direct swap
      const simulationResult = await simulateDirectSwap({
        signingClient,
        senderAddress,
        tokenIn,
        feeToken,
        routes: dexRoutes,
        tokenOutMinAmount: finalTokenOutMinAmount!,
        memo,
        gasMultiplier,
      });

      // Return early if simulation only
      if (simulateOnly) {
        console.log('[DEBUG][osmosisApiHelper] Direct swap simulation results:');
        console.log('[DEBUG][osmosisApiHelper] Estimated gas:', simulationResult.estimatedGas);
        console.log('[DEBUG][osmosisApiHelper] Recommended fee:', simulationResult.fee);

        return {
          success: true,
          simulated: true,
          estimatedGas: simulationResult.estimatedGas,
          recommendedFee: simulationResult.fee,
          routes: dexRoutes,
          tokenOutMinAmount: finalTokenOutMinAmount,
        };
      }

      // Execute actual swap with pre-generated fee and message
      return await useOsmosisDirect({
        signingClient,
        senderAddress,
        msg: simulationResult.msg,
        fee: simulationResult.fee,
        memo,
        routes: dexRoutes,
        tokenOutMinAmount: finalTokenOutMinAmount!,
      });
    }
  } catch (error) {
    console.error('[osmosisApiHelper] Error executing swap:', error);
    throw error;
  }
}

async function simulateDirectSwap({
  signingClient,
  senderAddress,
  tokenIn,
  feeToken,
  routes,
  tokenOutMinAmount,
  memo = 'aria wallet',
  gasMultiplier = 1.3,
}: {
  signingClient: any;
  senderAddress: string;
  tokenIn: {
    amount: string;
    denom: string;
  };
  feeToken: FeeToken;
  routes: any[];
  tokenOutMinAmount: string;
  memo?: string;
  gasMultiplier?: number;
}): Promise<{
  fee: any;
  msg: any;
  estimatedGas: number;
  // Existing returns
  success: boolean;
  simulated: boolean;
  routes: any[];
  tokenOutMinAmount: string;
}> {
  const msg = swapExactAmountIn({
    sender: senderAddress,
    routes: routes,
    tokenIn: coin(tokenIn.amount, tokenIn.denom),
    tokenOutMinAmount: tokenOutMinAmount,
  });

  const selectedFeeTokenDenom = feeToken.denom;
  const gasPrice = feeToken.gasPriceStep['average'];

  console.log(
    '[DEBUG][osmosisApiHelper] Using fee token:',
    selectedFeeTokenDenom,
    'with gas price:',
    gasPrice,
  );

  let estimatedGas = 0;
  let gasWithBuffer = 0;

  try {
    // Try to simulate first for accurate gas estimate
    estimatedGas = await signingClient.simulate(senderAddress, [msg], memo);
    gasWithBuffer = Math.ceil(estimatedGas * gasMultiplier);

    console.log('[DEBUG][osmosisApiHelper] Using simulated gas:', gasWithBuffer);
  } catch (simulationError) {
    console.warn(
      '[DEBUG][osmosisApiHelper] Simulation failed, using Keplr-style gas estimates:',
      simulationError,
    );

    // Convert routes to the format expected by getKeplrStyleGasEstimates
    const swapOperations = routes.map(route => ({
      pool: route.poolId,
      denomIn: tokenIn.denom,
      denomOut: route.tokenOutDenom,
    }));

    // Use Keplr-style gas estimates as fallback
    const { gasWanted } = getKeplrStyleGasEstimates(swapOperations);
    estimatedGas = parseInt(gasWanted);
    gasWithBuffer = Math.ceil(estimatedGas * gasMultiplier);

    console.log('[DEBUG][osmosisApiHelper] Using Keplr-style gas estimate:', gasWithBuffer);
  }

  const feeAmount = Math.ceil(gasWithBuffer * gasPrice);
  const fee = {
    amount: coins(feeAmount, selectedFeeTokenDenom),
    gas: gasWithBuffer.toString(),
  };

  console.log('[DEBUG][osmosisApiHelper] Calculated fee amount:', feeAmount);

  return {
    fee,
    msg,
    estimatedGas,
    success: true,
    simulated: true,
    routes,
    tokenOutMinAmount,
  };
}

// TODO: fix.  currently on 1 usdc to osmo, shows 1.89 in fees at 0.0001% fee of total, so percent and fee are both wrong.
// sending 2 usdc to osmo correctly shows 0.49 usdc fee.
// seems to be fixed after some number of timed refreshes
async function simulateUseSmartContract({
  signingClient,
  senderAddress,
  tokenIn,
  tokenOutDenom,
  feeToken,
  routes,
  tokenOutMinAmount,
  memo = 'aria wallet',
  gasMultiplier = 1.5,
}: {
  signingClient: any;
  senderAddress: string;
  tokenIn: {
    amount: string;
    denom: string;
  };
  tokenOutDenom: string;
  feeToken: FeeToken;
  routes: any[];
  tokenOutMinAmount: string;
  memo?: string;
  gasMultiplier?: number;
}): Promise<{
  fee: any;
  msg: any;
  gasEstimated: number;
}> {
  console.log('[DEBUG][simulateUseSmartContract] Validating routes:', {
    inputDenom: tokenIn.denom,
    outputDenom: tokenOutDenom,
    routeCount: routes.length,
    routes: routes.map((r, i) => ({
      hop: i + 1,
      poolId: r.poolId,
      tokenOutDenom: r.tokenOutDenom,
    })),
  });

  // VALIDATE ROUTES: Check that no hop has same input/output denom
  let currentDenom = tokenIn.denom;
  for (let i = 0; i < routes.length; i++) {
    const route = routes[i];

    if (route.tokenOutDenom === currentDenom) {
      // Fix: Get the correct route structure from SQS response
      throw new Error(`Invalid route: Hop ${i + 1} has same input/output denom (${currentDenom})`);
    }

    currentDenom = route.tokenOutDenom;
  }

  // Final validation: last hop should output to desired tokenOutDenom
  if (currentDenom !== tokenOutDenom) {
    console.warn('[DEBUG][simulateUseSmartContract] Route final output mismatch:', {
      expected: tokenOutDenom,
      actual: currentDenom,
      routes: routes.map(r => r.tokenOutDenom),
    });

    // For smart contract, we need to ensure the final output matches
    // Create a corrected routes array
    const correctedRoutes = [...routes];
    if (correctedRoutes.length > 0) {
      correctedRoutes[correctedRoutes.length - 1].tokenOutDenom = tokenOutDenom;
    }
  }

  // Prepare smart contract message with validated routes
  const swapMsg: SwapMessage = {
    swap: {
      routes: routes.map(route => ({
        pool_id: route.poolId,
        token_out_denom: route.tokenOutDenom,
      })),
      token_out_min_amount: {
        denom: tokenOutDenom,
        amount: tokenOutMinAmount,
      },
      fee_percentage: OSMOSIS_REVENUE_CONFIG.FEE_PERCENT_STRING,
      fee_collector: OSMOSIS_REVENUE_CONFIG.FEE_COLLECTOR_ADDRESS,
    },
  };

  console.log('[DEBUG][simulateUseSmartContract] Final swap message:', {
    routes: swapMsg.swap.routes,
    tokenOutMinAmount: swapMsg.swap.token_out_min_amount,
  });

  const executeMsg = {
    typeUrl: '/cosmwasm.wasm.v1.MsgExecuteContract',
    value: {
      sender: senderAddress,
      contract: OSMOSIS_REVENUE_CONFIG.CONTRACT_ADDRESS,
      msg: Buffer.from(JSON.stringify(swapMsg)),
      funds: [coin(tokenIn.amount, tokenIn.denom)],
    },
  };

  const selectedFeeTokenDenom = feeToken.denom;
  const gasPrice = feeToken.gasPriceStep['average'];

  let gasEstimated = 0;
  let gasWithBuffer = 0;

  try {
    gasEstimated = await signingClient.simulate(senderAddress, [executeMsg], memo);
    gasWithBuffer = Math.ceil(gasEstimated * gasMultiplier);
    console.log('[DEBUG][simulateUseSmartContract] Using simulated gas:', gasWithBuffer);
  } catch (simulationError) {
    console.warn(
      '[DEBUG][simulateUseSmartContract] Simulation failed, using route-based fallback:',
      simulationError,
    );

    // IMPROVED FALLBACK: Calculate gas based on route complexity
    const baseGasPerHop = 200000;
    const gasPerHop = routes.length > 1 ? 300000 : 200000; // Multi-hop needs more gas
    const fallbackGas = baseGasPerHop + routes.length * gasPerHop;

    gasEstimated = fallbackGas;
    gasWithBuffer = Math.ceil(gasEstimated * gasMultiplier);

    console.log('[DEBUG][simulateUseSmartContract] Using route-based fallback gas:', {
      routes: routes.length,
      baseGas: baseGasPerHop,
      gasPerHop,
      fallbackGas,
      gasWithBuffer,
    });
  }

  const feeAmount = Math.ceil(gasWithBuffer * gasPrice);
  const fee = {
    amount: coins(feeAmount, selectedFeeTokenDenom),
    gas: gasWithBuffer.toString(),
  };

  console.log('[DEBUG][simulateUseSmartContract] Calculated fee:', {
    feeAmount,
    gasWithBuffer,
    gasPrice,
    selectedFeeTokenDenom,
  });

  return {
    fee,
    msg: executeMsg,
    gasEstimated,
  };
}

async function useOsmosisDirect({
  senderAddress,
  routes,
  tokenOutMinAmount,
  memo = 'aria wallet',
  signingClient,
  fee,
  msg,
}: {
  senderAddress: string;
  routes: {
    poolId: string;
    tokenOutDenom: string;
  }[];
  tokenOutMinAmount: string;
  memo?: string;
  signingClient: any;
  fee: any;
  msg: any;
  simulateOnly?: boolean;
}): Promise<any> {
  console.log('[DEBUG][osmosisApiHelper] Executing swap with fee:', fee);

  // Execute the swap
  const result = await signingClient.signAndBroadcast(senderAddress, [msg], fee, memo);

  console.log('[DEBUG][osmosisApiHelper] Swap executed successfully:', result);

  return {
    success: true,
    simulated: false,
    transactionHash: result.transactionHash,
    gasUsed: result.gasUsed,
    fee,
    routes,
    tokenOutMinAmount,
  };
}

// NOTE: if switching to polaris, explore using //github.com/polaris-portal/osmosis-affiliate-swap-contract/tree/v1.0.0
// NOTE: using https://github.com/osmosis-labs/affiliate-swap/tree/main
// NOTE: verify use by checking mintscan at https://www.mintscan.io/osmosis/tx/8CF7BA02E16460F9EA76018E1DCE6B3AD9195C565192D5F3DD807F832FB7F6DF?height=44921665
// NOTE: set up via daodao at https://daodao.zone/dao/osmosis
// NOTE: check contract query via celatone at https://celatone.osmosis.zone/osmosis-1/interact-contract?selectedType=query&contract=osmo1xwlfclwa356qjxwdrgccx4r9733d32w9t55knfqt7wvajwtdyq2s2ferqt
// NOTE: current contract number is 149 as per https://celatone.osmosis.zone/osmosis-1/codes/149
async function useAffiliateSmartContract({
  signingClient,
  senderAddress,
  executeMsg,
  fee,
  memo,
  routes,
  tokenOutMinAmount,
}: {
  signingClient: any;
  senderAddress: string;
  executeMsg: any;
  fee: any;
  memo: string;
  routes: any[];
  tokenOutMinAmount: string;
}): Promise<any> {
  console.log('[DEBUG][executeSmartContractSwap] Executing contract swap with fee:', fee);

  // Execute the contract call with the pre-calculated fee and message
  const result = await signingClient.signAndBroadcast(senderAddress, [executeMsg], fee, memo);

  console.log('[DEBUG][executeSmartContractSwap] Contract swap executed successfully:', result);

  return {
    success: true,
    simulated: false,
    transactionHash: result.transactionHash,
    gasUsed: result.gasUsed,
    fee,
    routes,
    tokenOutMinAmount,
  };
}
