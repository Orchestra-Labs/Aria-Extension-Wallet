import {
  CHAIN_ENDPOINTS,
  DEFAULT_ASSET,
  GREATER_EXPONENT_DEFAULT,
  LOCAL_ASSET_REGISTRY,
} from '@/constants';
import { queryRpcNode } from './queryNodes';
import { DelegationResponse, TransactionResult } from '@/types';
import { fetchRewards } from './fetchStakingInfo';

// TODO: verify multiple messages add fees from queryNodes properly.  shouldn't need magic number below
export const buildClaimMessage = ({
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
  simulateOnly = false,
): Promise<TransactionResult> => {
  const endpoint = CHAIN_ENDPOINTS.claimRewards;
  const validatorAddressesArray = Array.isArray(validatorAddress)
    ? validatorAddress
    : [validatorAddress];
  const messages = buildClaimMessage({
    endpoint,
    delegatorAddress,
    validatorAddress: validatorAddressesArray,
  });

  try {
    const response = await queryRpcNode({
      endpoint,
      messages,
      simulateOnly,
    });

    if (!response) {
      return {
        success: false,
        message: 'No response received from transaction',
        data: {
          code: 1,
        },
      };
    }

    if (simulateOnly) {
      return {
        success: true,
        message: 'Simulation successful',
        data: response,
      };
    }

    return {
      success: true,
      message: 'Transaction successful',
      data: response,
    };
  } catch (error) {
    console.error('Error claiming rewards:', error);
    return {
      success: false,
      message: error instanceof Error ? error.message : 'Unknown error occurred',
      data: {
        code: 1,
      },
    };
  }
};

export const claimAndRestake = async (
  delegations: DelegationResponse | DelegationResponse[],
  rewards?: { validator: string; rewards: { denom: string; amount: string }[] }[],
  simulateOnly = false,
): Promise<TransactionResult> => {
  const delegateEndpoint = CHAIN_ENDPOINTS.delegateToValidator;
  const delegationsArray = Array.isArray(delegations) ? delegations : [delegations];
  const delegatorAddress = delegationsArray[0].delegation.delegator_address;
  const validatorAddresses = delegationsArray.map(d => d.delegation.validator_address);

  try {
    // Fetch rewards if not provided
    const validatorRewards =
      rewards ||
      (await fetchRewards(
        delegatorAddress,
        validatorAddresses.map(addr => ({ validator_address: addr })),
      ));

    const hasRewards = validatorRewards.some(
      reward => parseFloat(reward.rewards[0]?.amount || '0') > 0,
    );

    if (!hasRewards) {
      return { success: false, message: 'No rewards to claim', data: { code: 1 } };
    }

    // Use buildClaimMessage to create claim messages
    const claimMessages = buildClaimMessage({
      endpoint: CHAIN_ENDPOINTS.claimRewards,
      delegatorAddress,
      validatorAddress: validatorAddresses,
    });

    // Use buildClaimMessage for delegate messages as well
    const delegateMessages = validatorRewards.flatMap(reward =>
      buildClaimMessage({
        endpoint: delegateEndpoint,
        delegatorAddress,
        validatorAddress: reward.validator,
        amount: reward.rewards[0].amount.split('.')[0],
        denom: reward.rewards[0].denom,
      }),
    );

    // Combine messages for a single transaction
    const batchedMessages = [...claimMessages, ...delegateMessages];

    // First simulate to get the gas estimation
    const simulationResult = await queryRpcNode({
      endpoint: delegateEndpoint,
      messages: batchedMessages,
      simulateOnly: true,
    });

    if (!simulationResult || simulationResult.code !== 0) {
      return {
        success: false,
        message: 'Simulation failed or insufficient gas estimation',
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

    // Execute the transaction with estimated gas and fee from simulation
    const executionResult = await queryRpcNode({
      endpoint: delegateEndpoint,
      messages: batchedMessages,
      simulateOnly: false,
      fee: {
        amount: [{ denom: DEFAULT_ASSET.denom, amount: feeAmount.toFixed(0) }],
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
  simulateOnly = false,
): Promise<TransactionResult> => {
  const endpoint = CHAIN_ENDPOINTS.delegateToValidator;
  const formattedAmount = (
    parseFloat(amount) *
    Math.pow(10, LOCAL_ASSET_REGISTRY[denom].exponent || GREATER_EXPONENT_DEFAULT)
  ).toFixed(0);

  const messages = buildClaimMessage({
    endpoint,
    delegatorAddress: walletAddress,
    validatorAddress,
    amount: formattedAmount,
    denom,
  });

  try {
    const response = await queryRpcNode({
      endpoint,
      messages,
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

export const claimAndUnstake = async ({
  delegations,
  amount,
  simulateOnly = false,
}: {
  delegations: DelegationResponse | DelegationResponse[];
  amount?: string;
  simulateOnly?: boolean;
}): Promise<TransactionResult> => {
  const endpoint = CHAIN_ENDPOINTS.undelegateFromValidator;
  const delegationsArray = Array.isArray(delegations) ? delegations : [delegations];
  const delegatorAddress = delegationsArray[0].delegation.delegator_address;
  const validatorAddresses = delegationsArray.map(d => d.delegation.validator_address);

  // Build claim reward messages
  const claimMessages = buildClaimMessage({
    endpoint: CHAIN_ENDPOINTS.claimRewards,
    delegatorAddress,
    validatorAddress: validatorAddresses,
  });

  // Build undelegate messages
  const unstakeMessages = amount
    ? buildClaimMessage({
        endpoint,
        delegatorAddress,
        validatorAddress: validatorAddresses[0],
        amount: (
          parseFloat(amount) *
          Math.pow(
            10,
            LOCAL_ASSET_REGISTRY[delegationsArray[0].balance.denom].exponent ||
              GREATER_EXPONENT_DEFAULT,
          )
        ).toFixed(0),
        denom: delegationsArray[0].balance.denom,
      })
    : buildClaimMessage({
        endpoint,
        delegations: delegationsArray,
      });

  const messages = [...claimMessages, ...unstakeMessages];

  // Simulate first
  const simulationResult = await queryRpcNode({
    endpoint,
    messages,
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
    messages,
    simulateOnly: false,
    fee: {
      amount: [{ denom: DEFAULT_ASSET.denom, amount: feeAmount.toFixed(0) }],
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
