const SKIP_GO_API_BASE = 'https://api.skip.build/v2';

type ChainInfo = {
  chain_id: string;
  chain_name: string;
  logo_uri?: string;
};

type BridgeInfo = {
  id: string;
  name: string;
  logo_uri?: string;
};

type VenueInfo = {
  id: string;
  name: string;
  logo_uri?: string;
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

/**
 * Fetches supported bridges from /info/bridges endpoint
 */
export const getSupportedBridges = async (): Promise<BridgeInfo[]> => {
  try {
    const response = await fetch(`${SKIP_GO_API_BASE}/info/bridges`);
    if (!response.ok) throw new Error('Failed to fetch supported bridges');
    const data = await response.json();
    return data.bridges;
  } catch (error) {
    console.error('Bridges fetch error:', error);
    throw new Error('Failed to fetch supported bridges');
  }
};

/**
 * Gets route options from /fungible/route endpoint
 */
export const getRoute = async (
  source_chain_id: string,
  dest_chain_id: string,
  source_asset_denom: string,
  dest_asset_denom: string,
  amount_in: string,
  cumulative_slippage_tolerance?: string,
  client_id?: string,
  additionalParams?: Record<string, any>,
): Promise<any> => {
  try {
    const url = new URL(`${SKIP_GO_API_BASE}/fungible/route`);

    const params = {
      source_chain_id,
      dest_chain_id,
      source_asset_denom,
      dest_asset_denom,
      amount_in,
      ...(cumulative_slippage_tolerance && { cumulative_slippage_tolerance }),
      ...(client_id && { client_id }),
      ...additionalParams,
    };

    Object.entries(params).forEach(([key, value]) => {
      if (value !== undefined) url.searchParams.append(key, String(value));
    });

    const response = await fetch(url.toString());
    if (!response.ok) throw new Error('Failed to fetch route');
    return await response.json();
  } catch (error) {
    console.error('Route fetch error:', error);
    throw new Error('Failed to fetch route');
  }
};

/**
 * Gets transaction messages from /fungible/msgs endpoint
 */
export const getMessages = async (
  route_id: string,
  user_addresses: Record<string, string>,
  client_id?: string,
  additionalParams?: Record<string, any>,
): Promise<any> => {
  try {
    const response = await fetch(`${SKIP_GO_API_BASE}/fungible/msgs`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        route_id,
        user_addresses,
        ...(client_id && { client_id }),
        ...additionalParams,
      }),
    });

    if (!response.ok) throw new Error('Failed to fetch transaction messages');
    return await response.json();
  } catch (error) {
    console.error('Messages fetch error:', error);
    throw new Error('Failed to fetch transaction messages');
  }
};

/**
 * Gets direct route and messages from /fungible/msgs_direct endpoint
 */
export const getMessagesDirect = async (
  source_chain_id: string,
  source_asset_denom: string,
  dest_chain_id: string,
  dest_asset_denom: string,
  amount_in: string,
  source_address: string,
  dest_address: string,
  cumulative_slippage_tolerance?: string,
  client_id?: string,
  additionalParams?: Record<string, any>,
): Promise<any> => {
  try {
    const response = await fetch(`${SKIP_GO_API_BASE}/fungible/msgs_direct`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        source_chain_id,
        source_asset_denom,
        dest_chain_id,
        dest_asset_denom,
        amount_in,
        source_address,
        dest_address,
        ...(cumulative_slippage_tolerance && { cumulative_slippage_tolerance }),
        ...(client_id && { client_id }),
        ...additionalParams,
      }),
    });

    if (!response.ok) throw new Error('Failed to fetch direct messages');
    return await response.json();
  } catch (error) {
    console.error('Direct messages fetch error:', error);
    throw new Error('Failed to fetch direct messages');
  }
};

/**
 * Gets supported venues from /fungible/venues endpoint
 */
export const getSupportedVenues = async (): Promise<VenueInfo[]> => {
  try {
    const response = await fetch(`${SKIP_GO_API_BASE}/fungible/venues`);
    if (!response.ok) throw new Error('Failed to fetch supported venues');
    const data = await response.json();
    return data.venues;
  } catch (error) {
    console.error('Venues fetch error:', error);
    throw new Error('Failed to fetch supported venues');
  }
};

type TransactionResult = {
  success: boolean;
  message: string;
  data?: {
    code: number;
    txHash: string;
    gasWanted: string;
  };
};

/**
 * Executes a Skip API transaction
 */
export const executeSkipTransaction = async (
  sendState: {
    amount: number;
    asset: { denom: string; exponent: number };
    chainID: string;
  },
  receiveState: {
    asset: { denom: string };
    chainID: string;
  },
  walletState: { address: string },
  recipientAddress: string | undefined,
  simulateTransaction: boolean,
): Promise<TransactionResult> => {
  console.group('[executeSkip] Starting Skip API transaction');
  try {
    const amountIn = (sendState.amount * Math.pow(10, sendState.asset.exponent)).toFixed(0);

    // First try the direct messages endpoint
    try {
      const directResponse = await getMessagesDirect(
        sendState.chainID,
        sendState.asset.denom,
        receiveState.chainID,
        receiveState.asset.denom,
        amountIn,
        walletState.address,
        recipientAddress || walletState.address,
      );

      if (directResponse.msgs?.length > 0) {
        return {
          success: true,
          message: 'Skip transaction prepared',
          data: {
            code: 0,
            txHash: simulateTransaction ? 'simulated' : '',
            gasWanted: directResponse.estimated_gas_used?.toString() || '0',
          },
        };
      }
    } catch (directError) {
      console.log('Skip direct messages failed, trying full route:', directError);
    }

    // Fall back to full route if direct fails
    const routeResponse = await getRoute(
      sendState.chainID,
      receiveState.chainID,
      sendState.asset.denom,
      receiveState.asset.denom,
      amountIn,
    );

    if (!routeResponse.route) throw new Error('No valid route found via Skip API');

    return {
      success: true,
      message: 'Skip transaction prepared',
      data: {
        code: 0,
        txHash: simulateTransaction ? 'simulated' : '',
        gasWanted: routeResponse.route.estimated_gas_used?.toString() || '0',
      },
    };
  } catch (error) {
    console.error('Skip transaction failed:', error);
    return {
      success: false,
      message: error instanceof Error ? error.message : 'Skip API transaction failed',
    };
  } finally {
    console.groupEnd();
  }
};
