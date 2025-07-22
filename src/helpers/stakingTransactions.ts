import {
  COSMOS_CHAIN_ENDPOINTS,
  DEFAULT_MAINNET_ASSET,
  GREATER_EXPONENT_DEFAULT,
} from '@/constants';
import { queryRpcNode } from './queryNodes';
import { DelegationResponse, FeeToken, SimplifiedChainInfo, TransactionResult } from '@/types';
import { fetchRewards } from './fetchStakingInfo';

const MAX_MESSAGES_PER_BATCH = 15;

// TODO: verify multiple messages add fees from queryNodes properly.  shouldn't need magic number below
export const buildStakingMessage = ({
  endpoint,
  delegatorAddress,
  validatorAddress,
  amount,
  denom,
  delegations,
}: {
  endpoint: string;
  delegatorAddress?: string;
  validatorAddress?: string | string[];
  amount?: string;
  denom?: string;
  delegations?: DelegationResponse[];
}): any => {
  if (delegations) {
    // Handle multiple delegations
    return delegations.map(delegation => ({
      typeUrl: endpoint,
      value: {
        delegatorAddress: delegation.delegation.delegator_address,
        validatorAddress: delegation.delegation.validator_address,
        amount: {
          denom: delegation.balance.denom,
          // TODO: remove magic number fees in favor of single source of truth (simulate transactions)
          // Subtracting 5000 for gas fee
          amount: (parseFloat(delegation.balance.amount) - 5000).toFixed(0),
        },
      },
    }));
  }

  // Single validator address or multiple
  const validatorAddressesArray = Array.isArray(validatorAddress)
    ? validatorAddress
    : [validatorAddress];

  // Create messages for each validator in the array
  return validatorAddressesArray.map(validator => ({
    typeUrl: endpoint,
    value: {
      delegatorAddress: delegatorAddress,
      validatorAddress: validator,
      ...(amount && denom ? { amount: { denom, amount } } : {}),
    },
  }));
};

export const claimRewards = async (
  delegatorAddress: string,
  validatorAddress: string | string[],
  chain: SimplifiedChainInfo,
  feeToken?: FeeToken,
  simulateOnly = false,
): Promise<TransactionResult> => {
  const endpoint = COSMOS_CHAIN_ENDPOINTS.claimRewards;
  const validatorAddressesArray = Array.isArray(validatorAddress)
    ? validatorAddress
    : [validatorAddress];
  const messages = buildStakingMessage({
    endpoint,
    delegatorAddress,
    validatorAddress: validatorAddressesArray,
  });

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
    console.error('Error claiming rewards:', error);
    return {
      success: false,
      message: error instanceof Error ? error.message : 'Unknown error occurred',
      data: { code: 1 },
    };
  }
};

// TOOD: this properly handles mass messages.  expand the solution to the others
// TODO: ensure this sends back a sum of all batches when simulating
export const claimAndRestake = async (
  chain: SimplifiedChainInfo,
  delegations: DelegationResponse | DelegationResponse[],
  rewards?: { validator: string; rewards: { denom: string; amount: string }[] }[],
  feeToken?: FeeToken,
  simulateOnly = false,
): Promise<TransactionResult> => {
  const delegateEndpoint = COSMOS_CHAIN_ENDPOINTS.delegateToValidator;
  const delegationsArray = Array.isArray(delegations) ? delegations : [delegations];
  const delegatorAddress = delegationsArray[0].delegation.delegator_address;
  const validatorAddresses = delegationsArray.map(d => d.delegation.validator_address);
  const prefix = chain.bech32_prefix;
  const restUris = chain.rest_uris;
  const rpcUris = chain.rpc_uris;

  try {
    const validatorRewards =
      rewards ||
      (await fetchRewards(
        prefix,
        restUris,
        delegatorAddress,
        validatorAddresses.map(addr => ({ validator_address: addr })),
      ));

    const claimMessages = buildStakingMessage({
      endpoint: COSMOS_CHAIN_ENDPOINTS.claimRewards,
      delegatorAddress,
      validatorAddress: validatorAddresses,
    });

    const delegateMessages = validatorRewards.flatMap(reward => {
      const [firstReward] = reward.rewards || [];
      if (!firstReward || !firstReward.amount || !firstReward.denom) return [];

      return buildStakingMessage({
        endpoint: delegateEndpoint,
        delegatorAddress,
        validatorAddress: reward.validator,
        amount: firstReward.amount.split('.')[0],
        denom: firstReward.denom,
      });
    });

    const batchedMessages = [...claimMessages, ...delegateMessages];

    const messageChunks = [];
    for (let i = 0; i < batchedMessages.length; i += MAX_MESSAGES_PER_BATCH) {
      messageChunks.push(batchedMessages.slice(i, i + MAX_MESSAGES_PER_BATCH));
    }

    if (simulateOnly) {
      const simulation = await queryRpcNode({
        endpoint: delegateEndpoint,
        prefix,
        rpcUris,
        messages: messageChunks[0],
        feeToken,
        simulateOnly: true,
      });

      return {
        success: !!simulation && simulation.code === 0,
        message: simulation?.code === 0 ? 'Simulation successful' : 'Simulation failed',
        data: simulation,
      };
    }

    for (const messages of messageChunks) {
      const simulation = await queryRpcNode({
        endpoint: delegateEndpoint,
        prefix,
        rpcUris,
        messages,
        feeToken,
        simulateOnly: true,
      });

      if (!simulation || simulation.code !== 0) {
        return {
          success: false,
          message: 'Simulation failed or insufficient gas estimation',
          data: simulation,
        };
      }

      const estimatedGas = parseFloat(simulation.gasWanted || '0') * 1.1;
      const feeAmount = Math.ceil(estimatedGas * 0.025);

      const result = await queryRpcNode({
        endpoint: delegateEndpoint,
        prefix,
        rpcUris,
        messages,
        feeToken,
        simulateOnly: false,
        fee: {
          amount: [{ denom: DEFAULT_MAINNET_ASSET.denom, amount: feeAmount.toFixed(0) }],
          gas: estimatedGas.toFixed(0),
        },
      });

      if (!result || result.code !== 0) {
        return {
          success: false,
          message: 'Transaction failed',
          data: result,
        };
      }
    }

    return {
      success: true,
      message: 'Transaction successful',
      data: { code: 0 },
    };
  } catch (error) {
    console.error('Error during claim and restake:', error);
    return {
      success: false,
      message: error instanceof Error ? error.message : 'Unknown error occurred',
      data: { code: 1 },
    };
  }
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
  console.log('[stakeToValidator] Starting stake operation', {
    amount,
    denom,
    walletAddress: walletAddress,
    validatorAddress: validatorAddress,
    simulateOnly,
  });

  const endpoint = COSMOS_CHAIN_ENDPOINTS.delegateToValidator;

  const formattedAmount = (
    parseFloat(amount) * Math.pow(10, chain.assets?.[denom]?.exponent || GREATER_EXPONENT_DEFAULT)
  ).toFixed(0);

  const messages = buildStakingMessage({
    endpoint,
    delegatorAddress: walletAddress,
    validatorAddress,
    amount: formattedAmount,
    denom,
  });

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

// NOTE: Cosmos unstaking automatically claims rewards
export const claimAndUnstake = async ({
  chain,
  delegations,
  amount,
  feeToken,
  simulateOnly = false,
}: {
  chain: SimplifiedChainInfo;
  delegations: DelegationResponse[];
  amount?: string;
  feeToken: FeeToken;
  simulateOnly?: boolean;
}): Promise<TransactionResult> => {
  const endpoint = COSMOS_CHAIN_ENDPOINTS.undelegateFromValidator;
  const delegatorAddress = delegations[0].delegation.delegator_address;
  const validatorAddresses = delegations.map(d => d.delegation.validator_address);
  const prefix = chain.bech32_prefix;
  const rpcUris = chain.rpc_uris;

  // Build undelegate messages
  const messages = amount
    ? buildStakingMessage({
        endpoint,
        delegatorAddress,
        validatorAddress: validatorAddresses[0],
        amount: (
          parseFloat(amount) *
          Math.pow(
            10,
            chain?.assets?.[delegations[0].balance.denom].exponent || GREATER_EXPONENT_DEFAULT,
          )
        ).toFixed(0),
        denom: delegations[0].balance.denom,
      })
    : buildStakingMessage({
        endpoint,
        delegations,
      });

  // Simulate first
  const simulationResult = await queryRpcNode({
    endpoint,
    prefix,
    rpcUris,
    messages,
    feeToken,
    simulateOnly: true,
  });

  if (!simulationResult || simulationResult.code !== 0) {
    return {
      success: false,
      message: 'Simulation failed',
      data: simulationResult,
    };
  }

  const estimatedGas = parseFloat(simulationResult.gasWanted || '0') * 1.1;
  const feeAmount = Math.ceil(estimatedGas * 0.025);

  if (simulateOnly) {
    return {
      success: true,
      message: 'Simulation successful',
      data: simulationResult,
    };
  }

  // Execute transaction
  const executionResult = await queryRpcNode({
    endpoint,
    prefix,
    rpcUris,
    messages,
    feeToken,
    simulateOnly: false,
    fee: {
      amount: [{ denom: DEFAULT_MAINNET_ASSET.denom, amount: feeAmount.toFixed(0) }],
      gas: estimatedGas.toFixed(0),
    },
  });

  if (!executionResult || executionResult.code !== 0) {
    return {
      success: false,
      message: 'Transaction failed',
      data: executionResult,
    };
  }

  return {
    success: true,
    message: 'Transaction successful',
    data: executionResult,
  };
};
