import { AssetRegistry } from '@/types';

const SKIP_GO_API_BASE = 'https://api.skip.build/v2';

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

    const url = `${SKIP_GO_API_BASE}/fungible/assets?${params.toString()}`;
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

// TODO: remove? may not be necessary, given chain ids in function above
export const getSupportedChains = async (): Promise<ChainInfo[]> => {
  try {
    const response = await fetch(`${SKIP_GO_API_BASE}/info/chains`);
    if (!response.ok) throw new Error('Failed to fetch supported chains');
    const data = await response.json();
    return data.chains;
  } catch (error) {
    console.error('Chains fetch error:', error);
    throw new Error('Failed to fetch supported chains');
  }
};

export const getRoute = async ({
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
}): Promise<any> => {
  try {
    const requestBody = {
      source_asset_denom: fromDenom,
      source_asset_chain_id: fromChainId,
      dest_asset_denom: toDenom,
      dest_asset_chain_id: toChainId,
      amount_in: amount,
      allow_multi_tx: true,
      allow_swaps: true,
      smart_relay: true,
      cumulative_affiliate_fee_bps: '10', // 0.1%, so $1 for every $1000 transferred
      ...additionalParams,
    };

    console.log('[Skip API] Route Request:', JSON.stringify(requestBody, null, 2));

    const response = await fetch(`${SKIP_GO_API_BASE}/fungible/route`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(requestBody),
    });

    if (!response.ok) {
      const errorData = await response.json().catch(() => ({}));
      console.error('[Skip API] Route Error:', response.status, errorData);
      throw new Error(errorData.message);
    }

    const responseData = await response.json();
    console.log('[Skip API] Route Success:', JSON.stringify(responseData, null, 2));
    return responseData;
  } catch (error) {
    console.error('Skip Route API Error:', error);
    throw error;
  }
};

export const getTransactionMessages = async (
  source_chain_id: string,
  source_asset_denom: string,
  dest_chain_id: string,
  dest_asset_denom: string,
  amount_in: string,
  address_list: string[],
  operations: any[],
  estimated_amount_out: string,
  slippage_tolerance_percent: string = '0.25',
  additionalParams?: Record<string, any>,
): Promise<any> => {
  try {
    const requestBody = {
      source_asset_denom,
      source_asset_chain_id: source_chain_id,
      dest_asset_denom,
      dest_asset_chain_id: dest_chain_id,
      amount_in,
      amount_out: estimated_amount_out,
      address_list,
      operations,
      estimated_amount_out,
      slippage_tolerance_percent,
      timeout_seconds: '5',
      enable_gas_warnings: false,
      ...additionalParams,
    };

    console.log('[Skip API] Messages Request:', JSON.stringify(requestBody, null, 2));

    const response = await fetch(`${SKIP_GO_API_BASE}/fungible/msgs`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(requestBody),
    });

    if (!response.ok) {
      const errorData = await response.json().catch(() => ({}));
      console.error('[Skip API] Messages Error:', response.status, errorData);
      throw new Error(`API Error: ${response.status} - ${JSON.stringify(errorData)}`);
    }

    const responseData = await response.json();
    console.log('[Skip API] Messages Success:', JSON.stringify(responseData, null, 2));
    return responseData;
  } catch (error) {
    console.error('Skip Messages API Error:', error);
    throw error;
  }
};

export const submitTransaction = async (
  chain_id: string,
  tx: string, // Base64 encoded signed transaction
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
      tx,
      chain_id,
      ...additionalParams,
    };

    console.log('[Skip API] Submit Request:', JSON.stringify(requestBody, null, 2));

    const response = await fetch(`${SKIP_GO_API_BASE}/tx/submit`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(requestBody),
    });

    if (!response.ok) {
      const errorData = await response.json().catch(() => ({}));
      console.error('[Skip API] Submit Error:', response.status, errorData);
      throw new Error(`API Error: ${response.status} - ${JSON.stringify(errorData)}`);
    }

    const responseData = await response.json();
    console.log('[Skip API] Submit Success:', JSON.stringify(responseData, null, 2));

    return {
      success: true,
      message: 'Transaction submitted successfully',
      data: {
        txHash: responseData.tx_hash,
        explorerLink: responseData.explorer_link,
      },
    };
  } catch (error) {
    console.error('Skip Submit API Error:', error);
    return {
      success: false,
      message: error instanceof Error ? error.message : 'Failed to submit transaction',
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
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
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
      method: 'GET',
      headers: { 'Content-Type': 'application/json' },
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
