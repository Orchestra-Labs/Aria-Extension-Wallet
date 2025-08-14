const SKIP_GO_API_BASE = 'https://api.skip.build/v2';

type ChainInfo = {
  chain_id: string;
  chain_name: string;
  logo_uri?: string;
};

type TransactionResult = {
  success: boolean;
  message: string;
  data?: {
    code: number;
    txHash: string;
    gasWanted: string;
    msgs?: any[];
    estimatedAmountOut?: string;
    route?: any;
  };
};

/**
 * Fetches supported chains from /info/chains endpoint
 */
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

export const getMessagesDirect = async (
  source_chain_id: string,
  source_asset_denom: string,
  dest_chain_id: string,
  dest_asset_denom: string,
  amount_in: string,
  source_address: string,
  dest_address: string,
  slippage_tolerance_percent: string = '0.25',
  additionalParams?: Record<string, any>,
): Promise<any> => {
  try {
    // Prepare addresses mapping as required by the API
    const chain_ids_to_addresses = {
      [source_chain_id]: source_address,
      [dest_chain_id]: dest_address,
    };

    const requestBody = {
      source_asset_denom,
      source_asset_chain_id: source_chain_id,
      dest_asset_denom,
      dest_asset_chain_id: dest_chain_id,
      amount_in,
      chain_ids_to_addresses,
      slippage_tolerance_percent,
      allow_multi_tx: true,
      allow_swaps: true,
      ...additionalParams,
    };

    console.log('[Skip API] Request:', JSON.stringify(requestBody, null, 2));

    const response = await fetch(`${SKIP_GO_API_BASE}/fungible/msgs_direct`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(requestBody),
    });

    if (!response.ok) {
      const errorData = await response.json().catch(() => ({}));
      console.error('[Skip API] Error:', response.status, errorData);
      throw new Error(`API Error: ${response.status} - ${JSON.stringify(errorData)}`);
    }

    const responseData = await response.json();
    console.log('[Skip API] Success:', JSON.stringify(responseData, null, 2));
    return responseData;
  } catch (error) {
    console.error('Skip API Error:', error);
    throw error;
  }
};

export const executeSkipTransaction = async (
  sendState: {
    amount: number;
    asset: { denom: string; exponent: number };
    chainId: string;
  },
  receiveState: {
    asset: { denom: string };
    chainId: string;
  },
  walletState: { address: string },
  recipientAddress: string | undefined,
  simulateTransaction: boolean,
): Promise<TransactionResult> => {
  console.group('[executeSkip] Starting transaction');
  try {
    const amountIn = (sendState.amount * Math.pow(10, sendState.asset.exponent)).toFixed(0);
    console.log('Amount in base denom:', amountIn);

    const response = await getMessagesDirect(
      sendState.chainID,
      sendState.asset.denom,
      receiveState.chainID,
      receiveState.asset.denom,
      amountIn,
      walletState.address,
      recipientAddress || walletState.address,
      '0.25', // 0.5% slippage
    );

    if (!response.msgs || response.msgs.length === 0) {
      throw new Error('No valid route found');
    }

    return {
      success: true,
      message: 'Transaction prepared',
      data: {
        code: 0,
        txHash: simulateTransaction ? 'simulated' : '',
        gasWanted: response.route?.estimated_gas_used?.toString() || '0',
        msgs: response.msgs,
        estimatedAmountOut: response.route?.estimated_amount_out,
        route: response.route,
      },
    };
  } catch (error) {
    console.error('Transaction failed:', error);
    return {
      success: false,
      message: error instanceof Error ? error.message : 'Transaction failed',
    };
  } finally {
    console.groupEnd();
  }
};
