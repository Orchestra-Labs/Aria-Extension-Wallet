import { COSMOS_CHAIN_ENDPOINTS, GREATER_EXPONENT_DEFAULT } from '@/constants';
import { queryRpcNode } from './queryNodes';
import {
  FeeToken,
  FullValidatorInfo,
  RPCResponse,
  SimplifiedChainInfo,
  TransactionResult,
} from '@/types';
import { delay } from './timer';

const MAX_MESSAGES_PER_BATCH = 15;

export const buildMessageBundle = ({
  endpoint,
  validatorInfoArray,
  amount = undefined,
  denom,
}: {
  endpoint: string;
  delegatorAddress?: string;
  validatorInfoArray?: FullValidatorInfo[];
  amount?: string;
  denom?: string;
}): any[] => {
  const messages = [];

  if (validatorInfoArray) {
    for (const validatorInfo of validatorInfoArray) {
      const messageValue: any = {
        delegatorAddress: validatorInfo.delegation.delegator_address,
        validatorAddress: validatorInfo.delegation.validator_address,
      };

      if (endpoint === COSMOS_CHAIN_ENDPOINTS.undelegateFromValidator) {
        // NOTE: If no amount is provided, Cosmos will unstake all
        messageValue.amount = {
          denom: validatorInfo.balance.denom,
          amount: amount || validatorInfo.balance.amount,
        };
      } else if (amount && denom) {
        messageValue.amount = { denom, amount };
      }

      messages.push({
        typeUrl: endpoint,
        value: messageValue,
      });
    }
  }

  return messages;
};

export const stakeToValidator = async (
  amount: string,
  denom: string,
  walletAddress: string,
  validatorAddress: string,
  chain: SimplifiedChainInfo,
  feeToken: FeeToken,
  simulateOnly = false,
): Promise<TransactionResult> => {
  const endpoint = COSMOS_CHAIN_ENDPOINTS.delegateToValidator;

  const formattedAmount = (
    parseFloat(amount) * Math.pow(10, chain.assets?.[denom]?.exponent || GREATER_EXPONENT_DEFAULT)
  ).toFixed(0);

  const messages = [
    {
      typeUrl: endpoint,
      value: {
        delegatorAddress: walletAddress,
        validatorAddress,
        amount: {
          denom,
          amount: formattedAmount,
        },
      },
    },
  ];

  try {
    const response = await queryRpcNode({
      endpoint,
      prefix: chain.bech32_prefix,
      rpcUris: chain.rpc_uris,
      messages,
      feeToken,
      simulateOnly,
    });

    if (!response) {
      return {
        success: false,
        message: 'No response received from transaction',
        data: { code: 1 },
      };
    }

    if (simulateOnly) {
      return { success: true, message: 'Simulation successful', data: response };
    }

    return { success: true, message: 'Transaction successful', data: response };
  } catch (error) {
    return {
      success: false,
      message: error instanceof Error ? error.message : 'Unknown error occurred',
      data: { code: 1 },
    };
  }
};

// TODO: get feeToken from chain information?
export const claimRewards = async (
  chain: SimplifiedChainInfo,
  validatorInfoArray: FullValidatorInfo[],
  feeToken: FeeToken,
  simulateOnly = false,
): Promise<TransactionResult> => {
  const endpoint = COSMOS_CHAIN_ENDPOINTS.claimRewards;
  const prefix = chain.bech32_prefix;
  const rpcUris = chain.rpc_uris;

  // Build messages from validator info array
  const messages = buildMessageBundle({
    endpoint,
    validatorInfoArray,
  });

  // Split into batches
  const messageChunks = [];
  for (let i = 0; i < messages.length; i += MAX_MESSAGES_PER_BATCH) {
    messageChunks.push(messages.slice(i, i + MAX_MESSAGES_PER_BATCH));
  }

  try {
    let totalGasWanted = 0;
    let lastSuccessfulResult: RPCResponse | undefined = undefined;
    let allSimulationsSuccessful = true;
    let firstFailedSimulation: RPCResponse | undefined = undefined;

    // Single loop for both simulation and execution
    for (const [index, messages] of messageChunks.entries()) {
      // Always simulate first
      const simulation = await queryRpcNode({
        endpoint,
        prefix,
        rpcUris,
        messages,
        feeToken,
        simulateOnly: true,
      });

      if (!simulation || simulation.code !== 0) {
        allSimulationsSuccessful = false;
        firstFailedSimulation = simulation;
        if (simulateOnly) continue;

        return {
          success: false,
          message: `Batch ${index + 1} simulation failed`,
          data: simulation,
        };
      }

      totalGasWanted += parseFloat(simulation.gasWanted || '0');

      if (simulateOnly) {
        continue; // Just accumulate gas in simulation mode
      }

      // Execution mode
      console.log(`Processing claim rewards batch ${index + 1}/${messageChunks.length}`);

      const estimatedGas = Math.ceil(parseFloat(simulation.gasWanted || '0') * 1.1);
      const feeAmount = Math.ceil(estimatedGas * (feeToken.gasPriceStep?.average || 0.025));

      const result = await queryRpcNode({
        endpoint,
        prefix,
        rpcUris,
        messages,
        feeToken,
        simulateOnly: false,
        fee: {
          amount: [{ denom: feeToken.denom, amount: feeAmount.toString() }],
          gas: estimatedGas.toString(),
        },
      });

      if (!result || result.code !== 0) {
        return {
          success: false,
          message: `Batch ${index + 1} transaction failed`,
          data: result,
        };
      }

      lastSuccessfulResult = result;

      if (index < messageChunks.length - 1) {
        await delay(500);
      }
    }

    if (simulateOnly) {
      if (!allSimulationsSuccessful && firstFailedSimulation) {
        return {
          success: false,
          message: 'Some batches failed simulation',
          data: firstFailedSimulation,
        };
      }

      const estimatedGas = Math.ceil(totalGasWanted * 1.1);
      return {
        success: true,
        message: 'Simulation successful',
        data: {
          code: 0,
          gasWanted: estimatedGas.toString(),
        },
      };
    }

    if (!lastSuccessfulResult) {
      return {
        success: false,
        message: 'No batches were processed',
      };
    }

    return {
      success: true,
      message: `All ${messageChunks.length} batches processed successfully`,
      data: lastSuccessfulResult,
    };
  } catch (error) {
    console.error('[claimRewards] Error:', error);
    return {
      success: false,
      message: error instanceof Error ? error.message : 'Unknown error',
    };
  }
};

// TODO: get feeToken from chain information?
export const claimAndRestake = async (
  chain: SimplifiedChainInfo,
  validatorInfoArray: FullValidatorInfo[],
  feeToken?: FeeToken,
  simulateOnly = false,
): Promise<TransactionResult> => {
  const delegateEndpoint = COSMOS_CHAIN_ENDPOINTS.delegateToValidator;
  const claimEndpoint = COSMOS_CHAIN_ENDPOINTS.claimRewards;
  const prefix = chain.bech32_prefix;
  const rpcUris = chain.rpc_uris;

  // Build claim messages from validator info array
  const claimMessages = buildMessageBundle({
    endpoint: claimEndpoint,
    validatorInfoArray,
  });

  // TODO: pass this to buildMessageBundle
  // Build delegate messages from rewards
  const delegateMessages = validatorInfoArray.flatMap(validatorInfo => {
    return (validatorInfo.rewards || [])
      .map(rewardItem => {
        if (!rewardItem.denom || !rewardItem.amount) return null;

        // Remove decimal portion if present
        const amount = rewardItem.amount.includes('.')
          ? rewardItem.amount.split('.')[0]
          : rewardItem.amount;

        if (parseInt(amount) === 0) return null;

        return {
          typeUrl: delegateEndpoint,
          value: {
            delegatorAddress: validatorInfo.delegation.delegator_address,
            validatorAddress: validatorInfo.delegation.validator_address,
            amount: {
              denom: rewardItem.denom,
              amount,
            },
          },
        };
      })
      .filter(Boolean);
  });

  const batchedMessages = [...claimMessages, ...delegateMessages];
  const messageChunks = [];
  for (let i = 0; i < batchedMessages.length; i += MAX_MESSAGES_PER_BATCH) {
    messageChunks.push(batchedMessages.slice(i, i + MAX_MESSAGES_PER_BATCH));
  }

  let totalGasWanted = 0;
  let lastSuccessfulResult: RPCResponse | undefined = undefined;
  let allSimulationsSuccessful = true;
  let firstFailedSimulation: RPCResponse | undefined = undefined;

  // Process batches
  for (const [index, messages] of messageChunks.entries()) {
    // Always simulate first
    const simulation = await queryRpcNode({
      endpoint: delegateEndpoint,
      prefix,
      rpcUris,
      messages,
      feeToken,
      simulateOnly: true,
    });

    if (!simulation || simulation.code !== 0) {
      allSimulationsSuccessful = false;
      firstFailedSimulation = simulation;
      if (simulateOnly) continue;

      return {
        success: false,
        message: `Batch ${index + 1} simulation failed`,
        data: simulation,
      };
    }

    totalGasWanted += parseFloat(simulation.gasWanted || '0');

    if (simulateOnly) {
      continue;
    }

    // Execution mode
    console.log(`Processing claim+restake batch ${index + 1}/${messageChunks.length}`);

    const estimatedGas = Math.ceil(parseFloat(simulation.gasWanted || '0') * 1.1);
    const feeAmount = Math.ceil(estimatedGas * (feeToken?.gasPriceStep?.average || 0.025));

    const result = await queryRpcNode({
      endpoint: delegateEndpoint,
      prefix,
      rpcUris,
      messages,
      feeToken,
      simulateOnly: false,
      fee: {
        amount: [{ denom: feeToken?.denom || 'uatom', amount: feeAmount.toString() }],
        gas: estimatedGas.toString(),
      },
    });

    if (!result || result.code !== 0) {
      return {
        success: false,
        message: `Batch ${index + 1} transaction failed`,
        data: result,
      };
    }

    lastSuccessfulResult = result;

    if (index < messageChunks.length - 1) {
      await delay(500);
    }
  }

  if (simulateOnly) {
    if (!allSimulationsSuccessful && firstFailedSimulation) {
      return {
        success: false,
        message: 'Some batches failed simulation',
        data: firstFailedSimulation,
      };
    }

    const estimatedGas = Math.ceil(totalGasWanted * 1.1);
    return {
      success: true,
      message: 'Simulation successful',
      data: {
        code: 0,
        gasWanted: estimatedGas.toString(),
      },
    };
  }

  if (!lastSuccessfulResult) {
    return {
      success: false,
      message: 'No batches were processed',
    };
  }

  return {
    success: true,
    message: `All ${messageChunks.length} batches processed successfully`,
    data: lastSuccessfulResult,
  };
};

// NOTE: Cosmos unstaking automatically claims rewards
export const claimAndUnstake = async ({
  chain,
  amount = undefined,
  validatorInfoArray,
  feeToken,
  simulateOnly = false,
}: {
  chain: SimplifiedChainInfo;
  amount?: string;
  validatorInfoArray: FullValidatorInfo[];
  feeToken: FeeToken;
  simulateOnly?: boolean;
}): Promise<TransactionResult> => {
  const endpoint = COSMOS_CHAIN_ENDPOINTS.undelegateFromValidator;
  const prefix = chain.bech32_prefix;
  const rpcUris = chain.rpc_uris;
  const denom = validatorInfoArray[0].balance.denom;

  // For partial unstaking, format the amount
  let formattedAmount: string | undefined = undefined;
  if (amount) {
    if (parseFloat(amount) === 0) {
      return {
        success: false,
        message: 'Cannot unstake amount of zero',
        data: { code: 6 },
      };
    }

    const exponent = chain.assets?.[denom]?.exponent || GREATER_EXPONENT_DEFAULT;
    formattedAmount = (parseFloat(amount) * Math.pow(10, exponent)).toFixed(0);
  }

  // Build messages from validator info array
  const messages = buildMessageBundle({
    endpoint,
    validatorInfoArray,
    amount: amount ? formattedAmount : undefined,
    denom: amount ? denom : undefined,
  });

  // Split into batches
  const messageChunks = [];
  for (let i = 0; i < messages.length; i += MAX_MESSAGES_PER_BATCH) {
    messageChunks.push(messages.slice(i, i + MAX_MESSAGES_PER_BATCH));
  }

  try {
    let totalGasWanted = 0;
    let lastSuccessfulResult: RPCResponse | undefined = undefined;
    let allSimulationsSuccessful = true;

    // Single loop that handles both simulation and execution
    for (const [index, messages] of messageChunks.entries()) {
      // Always simulate first to get gas estimate
      const simulation = await queryRpcNode({
        endpoint,
        prefix,
        rpcUris,
        messages,
        feeToken,
        simulateOnly: true,
      });

      if (!simulation || simulation.code !== 0) {
        allSimulationsSuccessful = false;
        lastSuccessfulResult = simulation;
        if (simulateOnly) break; // In simulation mode, we can exit early on failure

        return {
          success: false,
          message: `Batch ${index + 1} simulation failed`,
          data: simulation,
        };
      }

      totalGasWanted += parseFloat(simulation.gasWanted || '0');

      // NOTE: For simulations continue to next batch to accumulate totals
      if (simulateOnly) {
        continue;
      }

      // NOTE: For executions proceed with actual transaction
      console.log(`Processing unstake batch ${index + 1}/${messageChunks.length}`);

      // Add buffer to gas estimate
      const estimatedGas = Math.ceil(parseFloat(simulation.gasWanted || '0') * 1.1);
      const feeAmount = Math.ceil(estimatedGas * (feeToken.gasPriceStep?.average || 0.025));

      const result = await queryRpcNode({
        endpoint,
        prefix,
        rpcUris,
        messages,
        feeToken,
        simulateOnly: false,
        fee: {
          amount: [{ denom: feeToken.denom, amount: feeAmount.toString() }],
          gas: estimatedGas.toString(),
        },
      });

      if (!result || result.code !== 0) {
        return {
          success: false,
          message: `Batch ${index + 1} transaction failed`,
          data: result,
        };
      }

      lastSuccessfulResult = result;

      // Add small delay between batches to prevent sequence mismatch
      if (index < messageChunks.length - 1) {
        await delay(500);
      }
    }

    if (simulateOnly) {
      if (!allSimulationsSuccessful) {
        return {
          success: false,
          message: 'Some batches failed simulation',
          data: lastSuccessfulResult,
        };
      }

      // Calculate total fee with buffer
      const estimatedGas = Math.ceil(totalGasWanted * 1.1);
      return {
        success: true,
        message: 'Simulation successful',
        data: {
          code: 0,
          gasWanted: estimatedGas.toString(),
        },
      };
    }

    return {
      success: true,
      message: `All ${messageChunks.length} batches processed successfully`,
      data: lastSuccessfulResult,
    };
  } catch (error) {
    console.error('[claimAndUnstake] Error:', error);
    return {
      success: false,
      message: error instanceof Error ? error.message : 'Unknown error',
      data: { code: 1 },
    };
  }
};
