import { AssetRegistry } from '@/types';
import { OfflineDirectSigner } from '@cosmjs/proto-signing';
import { QueryType } from '@/constants';
import {
  executeRoute,
  RouteResponse,
  setClientOptions,
  route as skipRoute,
  UserAddress,
} from '@skip-go/client';
import { OfflineAminoSigner } from '@cosmjs/amino';
import { WalletClient } from 'viem';
import { Adapter } from '@solana/wallet-adapter-base';

// TODO: move this call to server, keep auth at top level there
const SKIP_GO_API_BASE = 'https://api.skip.build';
const SKIP_API_KEY = import.meta.env.VITE_SKIP_API_KEY;

const SKIP_HEADERS = {
  'Content-Type': 'application/json',
  accept: 'application/json',
  Authorization: `${SKIP_API_KEY}`,
};

type ChainInfo = {
  chain_id: string;
  chain_name: string;
  logo_uri?: string;
};

type TransferEvent = {
  from_chain_id: string;
  to_chain_id: string;
  type?: string;
  state: string;
  packet_txs?: {
    send_tx?: {
      chain_id: string;
      tx_hash: string;
      explorer_link: string;
      on_chain_at?: string;
    };
    receive_tx?: {
      chain_id: string;
      tx_hash: string;
      explorer_link: string;
      on_chain_at?: string;
    };
    acknowledge_tx?: {
      chain_id: string;
      tx_hash: string;
      explorer_link: string;
      on_chain_at?: string;
    };
    timeout_tx?: any;
    error?: any;
  };
  txs?: {
    send_token_txs?: {
      send_tx?: {
        chain_id: string;
        tx_hash: string;
        explorer_link: string;
      };
      confirm_tx?: any;
      execute_tx?: {
        chain_id: string;
        tx_hash: string;
        explorer_link: string;
      };
      error?: any;
    };
  };
  axelar_scan_link?: string;
};

type TransferStatus = {
  state: string;
  transfer_sequence: Array<{
    [key: string]: TransferEvent;
  }>;
  next_blocking_transfer: any | null;
  transfer_asset_release?: {
    chain_id: string;
    denom: string;
    released: boolean;
  };
  error?: any;
};

type TransactionStatusResponse = {
  state: string;
  transfers: TransferStatus[];
  error?: any;
};

export interface SkipAsset {
  denom: string;
  chain_id: string;
  origin_denom: string;
  origin_chain_id: string;
  trace: string;
  symbol: string;
  name: string;
  logo_uri?: string;
  decimals: number;
  coingecko_id?: string;
  description?: string;
  recommended_symbol?: string;
}

export interface SkipAssetsResponse {
  chain_to_assets_map: Record<string, { assets: SkipAsset[] }>;
}

// In skipapihelper.ts - update initializeSkipClient
export const initializeSkipClient = () => {
  try {
    const dynamicApiUrl = `${window.location.origin}/api/skip`;
    console.log('[initializeSkipClient] Setting API URL:', dynamicApiUrl);
    console.log('[initializeSkipClient] API Key available:', !!SKIP_API_KEY);

    setClientOptions({
      apiUrl: SKIP_GO_API_BASE,
      apiKey: SKIP_API_KEY,
      // endpointOptions: { /* ... */ },
      // cacheDurationMs: 300000,
    });

    console.log('[initializeSkipClient] Skip client initialized successfully');
  } catch (error) {
    console.error('[initializeSkipClient] Failed to initialize Skip client:', error);
    throw error;
  }
};

// TODO: standardize.  there must be a skip library variant for this
export const getSkipSupportedAssets = async (
  chainIds?: string[],
  nativeOnly = false,
): Promise<AssetRegistry> => {
  try {
    const params = new URLSearchParams();

    if (chainIds?.length) {
      params.append('chain_ids', chainIds.join(','));
    }

    if (nativeOnly) {
      params.append('native_only', 'true');
    }

    const url = `${SKIP_GO_API_BASE}/v2/fungible/assets?${params.toString()}`;
    console.log('[Skip API] Fetching supported assets from:', url);

    const response = await fetch(url);
    if (!response.ok) {
      const errorData = await response.json().catch(() => ({}));
      console.error('[Skip API] Assets Error:', response.status, errorData);
      throw new Error(`API Error: ${response.status} - ${JSON.stringify(errorData)}`);
    }

    const responseData = (await response.json()) as SkipAssetsResponse;

    // Convert Skip assets to our Asset type
    const convertedAssets: AssetRegistry = {};
    for (const [chainId, chainData] of Object.entries(responseData.chain_to_assets_map)) {
      for (const skipAsset of chainData.assets) {
        convertedAssets[skipAsset.denom] = {
          denom: skipAsset.denom,
          amount: '0',
          displayAmount: '0',
          exchangeRate: undefined,
          isIbc: skipAsset.origin_chain_id !== chainId || !!skipAsset.trace,
          logo: skipAsset.logo_uri || '',
          symbol: skipAsset.symbol,
          name: skipAsset.name,
          exponent: skipAsset.decimals,
          isFeeToken: false,
          networkName: '', // Will need to be populated from chain registry
          chainId: chainId,
          coinGeckoId: skipAsset.coingecko_id,
          price: 0,
          originDenom: skipAsset.origin_denom,
          originChainId: skipAsset.origin_chain_id,
          trace: skipAsset.trace,
        };
      }
    }

    return convertedAssets;
  } catch (error) {
    console.error('Skip Assets API Error:', error);
    throw error;
  }
};

// TODO: standardize.  there must be a skip library variant for this
// TODO: remove? may not be necessary, given chain ids in function above
export const getSupportedChains = async (): Promise<ChainInfo[]> => {
  try {
    const response = await fetch(`${SKIP_GO_API_BASE}/v2/info/chains`);
    if (!response.ok) throw new Error('Failed to fetch supported chains');
    const data = await response.json();
    return data.chains;
  } catch (error) {
    console.error('Chains fetch error:', error);
    throw new Error('Failed to fetch supported chains');
  }
};

export const getSkipRoute = async ({
  fromChainId,
  fromDenom,
  toChainId,
  toDenom,
  amount,
  additionalParams,
}: {
  fromChainId: string;
  fromDenom: string;
  toChainId: string;
  toDenom: string;
  amount: string;
  additionalParams?: Record<string, any>;
}): Promise<RouteResponse> => {
  try {
    console.log('[getSkipRoute] Starting route request with params:', {
      fromChainId,
      fromDenom,
      toChainId,
      toDenom,
      amount,
      additionalParams,
    });

    const routeParams = {
      amountIn: amount,
      sourceAssetDenom: fromDenom,
      sourceAssetChainId: fromChainId,
      destAssetDenom: toDenom,
      destAssetChainId: toChainId,
      smartRelay: true,
      allowMultiTx: true,
      allowSwaps: true,
      cumulativeAffiliateFeeBps: '10', // 0.1%
      ...additionalParams,
    };

    console.log('[getSkipRoute] Calling skipRoute with:', JSON.stringify(routeParams, null, 2));

    const response = await skipRoute(routeParams);

    if (!response) {
      throw new Error('No route found - response was empty');
    }

    console.log('[getSkipRoute] Route Success:', JSON.stringify(response, null, 2));
    return response;
  } catch (error) {
    console.error('Skip Route API Error:', error);
    throw error;
  }
};

// TODO: enable amount out as an option (to handle billing)
export const executeSkipRoute = async (
  route: any,
  userAddresses: UserAddress[],
  getCosmosSigner?: (
    chainId: string,
  ) => Promise<
    (OfflineAminoSigner & OfflineDirectSigner) | OfflineAminoSigner | OfflineDirectSigner
  >,
  getEvmSigner?: (chainId: string) => Promise<WalletClient>,
  getSvmSigner?: () => Promise<Adapter>,
) => {
  try {
    console.log('🔍 [executeSkipRoute] Starting route execution');
    console.log(
      '📋 Route details:',
      JSON.stringify(
        {
          source_chain: route.source_asset_chain_id,
          dest_chain: route.dest_asset_chain_id,
          amount_in: route.amount_in,
          estimated_amount_out: route.estimated_amount_out,
          operations_count: route.operations?.length || 0,
          required_chains: route.required_chain_addresses || [],
        },
        null,
        2,
      ),
    );

    console.log('👤 User addresses being passed:');
    userAddresses.forEach((addr, index) => {
      console.log(`  ${index + 1}. Chain: ${addr.chainId}, Address: ${addr.address}`);
    });

    let transactionError: Error | null = null;
    let skipResult: { success: boolean; message?: string; data?: any } | null = null;
    await executeRoute({
      route,
      userAddresses,
      getCosmosSigner,
      getEvmSigner,
      getSvmSigner,
      onTransactionCompleted: async (txInfo: {
        chainId: string;
        txHash: string;
        status?: any;
        response?: any;
      }) => {
        console.log(
          '🔄 [executeSkipRoute] Transaction completed callback:',
          txInfo.chainId,
          txInfo.txHash,
          'Full txInfo:',
          txInfo,
        );

        console.log('[executeSkipRoute] Transaction completed callback:', txInfo);

        if (txInfo.status?.error) {
          // Extract error code and message for known errors
          const errorCode = txInfo.status.error.code;
          const errorMessage = txInfo.status.error.message;

          console.error(
            `❌ [executeSkipRoute] ERROR CODE: ${errorCode}, ERROR MESSAGE: ${errorMessage}`,
          );

          // Handle specific error codes with cleaner messages
          if (errorCode === 5) {
            skipResult = { success: false, message: 'Insufficient funds' };
          }

          throw new Error(errorMessage);
        }

        // Success case
        skipResult = { success: true, data: txInfo };
      },
      onTransactionBroadcast: async ({
        chainId: broadcastChainId,
        txHash,
        response,
      }: {
        chainId: string;
        txHash: string;
        response?: any;
      }) => {
        console.log('Transaction broadcasted', broadcastChainId, txHash, response);
      },
      onTransactionTracked: async ({
        chainId: trackedChainId,
        txHash,
        status,
      }: {
        chainId: string;
        txHash: string;
        status?: any;
      }) => {
        console.log('Transaction tracked', trackedChainId, txHash, status);

        if (status?.error) {
          // Extract error code and message for known errors
          const errorCode = status.error.code;
          const errorMessage = status.error.message;

          console.error(
            `❌ [executeSkipRoute] ERROR CODE: ${errorCode}, ERROR MESSAGE: ${errorMessage}`,
          );

          throw new Error(errorMessage);
        }
      },
    });

    // Check for errors
    if (transactionError) throw transactionError;
    if (skipResult != null) return skipResult;

    return { success: true, message: 'Route executed successfully' };
  } catch (error) {
    console.error('Error executing Skip route:', error);
    return {
      success: false,
      message: error instanceof Error ? error.message : 'Failed to execute route',
    };
  }
};

export const trackTransaction = async (
  chain_id: string,
  tx_hash: string, // Hex encoded transaction hash
  additionalParams?: Record<string, any>,
): Promise<{
  success: boolean;
  message: string;
  data?: {
    txHash: string;
    explorerLink: string;
  };
}> => {
  try {
    const requestBody = {
      tx_hash,
      chain_id,
      ...additionalParams,
    };

    console.log('[Skip API] Track Request:', JSON.stringify(requestBody, null, 2));

    const response = await fetch(`${SKIP_GO_API_BASE}/tx/track`, {
      method: QueryType.POST,
      headers: SKIP_HEADERS,
      body: JSON.stringify(requestBody),
    });

    if (!response.ok) {
      const errorData = await response.json().catch(() => ({}));
      console.error('[Skip API] Track Error:', response.status, errorData);
      throw new Error(`API Error: ${response.status} - ${JSON.stringify(errorData)}`);
    }

    const responseData = await response.json();
    console.log('[Skip API] Track Success:', JSON.stringify(responseData, null, 2));

    return {
      success: true,
      message: 'Transaction tracking initiated successfully',
      data: {
        txHash: responseData.tx_hash,
        explorerLink: responseData.explorer_link,
      },
    };
  } catch (error) {
    console.error('Skip Track API Error:', error);
    return {
      success: false,
      message: error instanceof Error ? error.message : 'Failed to track transaction',
    };
  }
};

export const getTransactionStatus = async (
  chain_id: string,
  tx_hash: string,
): Promise<{
  success: boolean;
  message: string;
  data?: TransactionStatusResponse;
}> => {
  try {
    const params = new URLSearchParams({
      tx_hash,
      chain_id,
    });

    const url = `${SKIP_GO_API_BASE}/tx/status?${params.toString()}`;
    console.log('[Skip API] Status Request:', url);

    const response = await fetch(url, {
      method: QueryType.GET,
      headers: SKIP_HEADERS,
    });

    if (!response.ok) {
      const errorData = await response.json().catch(() => ({}));
      console.error('[Skip API] Status Error:', response.status, errorData);
      throw new Error(`API Error: ${response.status} - ${JSON.stringify(errorData)}`);
    }

    const responseData = await response.json();
    console.log('[Skip API] Status Success:', JSON.stringify(responseData, null, 2));

    // Normalize the response structure
    const normalizedData: TransactionStatusResponse = {
      state: responseData.state || responseData.status,
      transfers: Array.isArray(responseData.transfers) ? responseData.transfers : [responseData],
      error: responseData.error,
    };

    return {
      success: true,
      message: 'Transaction status retrieved',
      data: normalizedData,
    };
  } catch (error) {
    console.error('Skip Status API Error:', error);
    return {
      success: false,
      message: error instanceof Error ? error.message : 'Failed to get transaction status',
    };
  }
};
