import { Asset, Coin, FeeToken, Uri } from '@/types';
import { OSMOSIS_ENDPOINTS, QueryType } from '@/constants';
import { queryRestNode } from './queryNodes';

export interface SwapRoute {
  poolId: string;
  tokenInDenom: string;
  tokenOutDenom: string;
  swapFee: string;
}

export interface SwapQuote {
  input: {
    denom: string;
    amount: string;
  };
  output: {
    denom: string;
    amount: string;
  };
  priceImpact: string;
  routes: SwapRoute[];
  effectivePrice: string;
  fee: string;
  slippage: string;
}

export interface ExchangeTransaction {
  txHash: string;
  height: number;
  timestamp: string;
  poolId?: string;
  tokenIn: {
    denom: string;
    amount: string;
  };
  tokenOut: {
    denom: string;
    amount: string;
  };
  sender: string;
  fee: string;
  routes?: SwapRoute[];
  type: 'swap' | 'add_liquidity' | 'remove_liquidity';
  status: 'pending' | 'success' | 'failed';
}

export interface PoolLiquidity {
  poolId: string;
  totalLiquidity: string;
  volume24h: string;
  apr: string;
  tokens: Array<{
    denom: string;
    amount: string;
    weight: string;
  }>;
}

export interface OsmosisSwapResponse {
  token_in: Coin;
  token_out: Coin;
  price_impact: string;
  route: Array<{
    pool_id: string;
    token_in_denom: string;
    token_out_denom: string;
    swap_fee: string;
  }>;
  effective_price: string;
  swap_fee: Coin[];
  success?: boolean;
  error?: {
    code: number;
    message: string;
    details?: any[];
  };
  amount?: string;
  liquidity?: string;
  depth?: string;
}

export interface SwapExecutionParams {
  sender: string;
  inputAsset: Asset;
  outputAsset: Asset;
  inputAmount: string;
  slippagePercentage?: number;
  restUris: Uri[];
  chainId: string;
}

export interface SwapResult {
  success: boolean;
  txHash?: string;
  error?: string;
  actualOutput?: string;
  fees?: Coin[];
  gasUsed?: string;
}

const isOsmosisSwapResponse = (obj: any): obj is OsmosisSwapResponse => {
  return obj && obj.token_in && obj.token_out && typeof obj.price_impact === 'string';
};

export const getOsmosisSwapQuote = async (
  inputDenom: string,
  outputDenom: string,
  amount: string,
  restUris: string[],
  chainId: string = 'osmosis-1',
): Promise<OsmosisSwapResponse | null> => {
  try {
    console.log('[getOsmosisSwapQuote] Request:', {
      inputDenom,
      outputDenom,
      amount,
      restUris,
      chainId,
    });

    const response = await queryRestNode({
      endpoint: `${OSMOSIS_ENDPOINTS.quote}?tokenIn=${amount}${inputDenom}&tokenOutDenom=${outputDenom}`,
      restUris: restUris.map(uri => ({ address: uri, provider: 'osmosis' })),
      prefix: 'osmo',
      chainId,
      queryType: QueryType.GET,
    });

    console.log('[getOsmosisSwapQuote] Response:', response);

    if (isOsmosisSwapResponse(response)) {
      return response;
    }

    if (response?.error) {
      console.error('Osmosis API error:', response.error);
      return null;
    }

    return null;
  } catch (error: any) {
    console.error('Error getting swap quote:', error);
    // Log the actual HTTP error details
    if (error.response) {
      console.error('HTTP error details:', {
        status: error.response.status,
        data: error.response.data,
        headers: error.response.headers,
      });
    }
    return null;
  }
};

export const getOsmosisGasEstimates = async (
  sender: string,
  swapOperations: Array<{
    pool: string;
    denomIn: string;
    denomOut: string;
  }>,
  tokenInAmount: string,
  restUris: Uri[],
  chainId: string = 'osmosis-1',
): Promise<{ gasWanted: string; gasUsed: string }> => {
  try {
    // Try the Osmosis frontend approach first - use the standard Cosmos simulation endpoint
    const msg = {
      type: '/osmosis.poolmanager.v1beta1.MsgSwapExactAmountIn',
      value: {
        sender,
        routes: swapOperations.map(op => ({
          poolId: op.pool,
          tokenOutDenom: op.denomOut,
        })),
        tokenIn: {
          denom: swapOperations[0].denomIn,
          amount: tokenInAmount,
        },
        tokenOutMinAmount: '1', // Minimum amount out
      },
    };

    const simulateData = {
      tx: {
        body: {
          messages: [msg],
          memo: '',
          timeout_height: '0',
          extension_options: [],
          non_critical_extension_options: [],
        },
        auth_info: {
          signer_infos: [],
          fee: {
            amount: [],
            gas_limit: '0',
            payer: '',
            granter: '',
          },
        },
        signatures: [],
      },
    };

    const response = await queryRestNode({
      endpoint: '/cosmos/tx/v1beta1/simulate',
      queryType: QueryType.POST,
      prefix: 'osmo',
      restUris,
      chainId,
      data: simulateData,
    });

    // Extract gas information
    let gasUsed = '0';
    let gasWanted = '0';

    if (response.gas_info) {
      gasUsed = response.gas_info.gas_used?.toString() || '0';
      gasWanted = response.gas_info.gas_wanted?.toString() || '0';
    }

    if (gasUsed !== '0' && gasWanted !== '0') {
      return { gasWanted, gasUsed };
    }

    throw new Error('No gas info in simulation response');
  } catch (error) {
    // Fall back to Keplr's approach with static estimates
    return getKeplrStyleGasEstimates(swapOperations);
  }
};

export const getKeplrStyleGasEstimates = (
  swapOperations: Array<{
    pool: string;
    denomIn: string;
    denomOut: string;
  }>,
): { gasWanted: string; gasUsed: string } => {
  // Keplr uses static estimates based on transaction complexity
  const numHops = swapOperations.length;

  // These are typical gas estimates used by Keplr
  if (numHops === 1) {
    // Single hop swap
    return { gasWanted: '250000', gasUsed: '200000' };
  } else if (numHops === 2) {
    // Two hop swap
    return { gasWanted: '400000', gasUsed: '350000' };
  } else {
    // Multi-hop (3+ pools) - more complex, higher gas
    return {
      gasWanted: (300000 + numHops * 100000).toString(),
      gasUsed: (250000 + numHops * 80000).toString(),
    };
  }
};

export const simulateOsmosisSwap = async ({
  sender,
  swapOperations,
  tokenInAmount,
  chainId,
  restUris,
  feeToken,
}: {
  sender: string;
  swapOperations: Array<{
    pool: string;
    denomIn: string;
    denomOut: string;
  }>;
  tokenInAmount: string;
  chainId: string;
  restUris: Uri[];
  feeToken: FeeToken;
}): Promise<any> => {
  try {
    // Try Osmosis frontend approach first, fall back to Keplr approach if it fails
    const { gasWanted, gasUsed } = await getOsmosisGasEstimates(
      sender,
      swapOperations,
      tokenInAmount,
      restUris,
      chainId,
    );

    const gasPrice = feeToken.gasPriceStep.average;
    const feeAmount = Math.ceil(parseInt(gasWanted) * gasPrice);

    return {
      success: true,
      message: `Osmosis ${swapOperations.length > 1 ? 'multi-hop' : 'single-hop'} swap simulation successful`,
      data: {
        code: 0,
        gasWanted,
        gasUsed,
        fees: {
          amount: [
            {
              denom: feeToken.denom,
              amount: feeAmount.toString(),
            },
          ],
          gas: gasWanted,
        },
      },
    };
  } catch (error) {
    // Final fallback - use Keplr-style estimates directly
    const { gasWanted, gasUsed } = getKeplrStyleGasEstimates(swapOperations);
    const gasPrice = feeToken.gasPriceStep.average;
    const feeAmount = Math.ceil(parseInt(gasWanted) * gasPrice);

    return {
      success: false,
      message: `Swap simulation failed: ${error instanceof Error ? error.message : 'Unknown error'}`,
      data: {
        code: 0,
        gasWanted,
        gasUsed,
        fees: {
          amount: [
            {
              denom: feeToken.denom,
              amount: feeAmount.toString(),
            },
          ],
          gas: gasWanted,
        },
      },
    };
  }
};
