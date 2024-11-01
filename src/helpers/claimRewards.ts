import { CHAIN_ENDPOINTS, GREATER_EXPONENT_DEFAULT, LOCAL_ASSET_REGISTRY } from '@/constants';
import { queryRpcNode } from './queryNodes';
import { DelegationResponse, TransactionResult } from '@/types';
import { fetchRewards } from './fetchStakingInfo';

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
  console.log('Building claim message:', {
    endpoint,
    delegatorAddress,
    validatorAddress,
    amount,
    denom,
    delegations,
  });

  if (delegations) {
    console.log("delegations activated")
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

  console.log('Claiming rewards from validator(s):', {
    delegatorAddress,
    validatorAddressesArray,
    messages,
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
      console.log('Simulation result for claim rewards:', response);
      return {
        success: true,
        message: 'Simulation successful',
        data: response,
      };
    }

    console.log('Rewards claimed successfully:', response);
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

// TODO: fails occasionally on restake.  find out why and fix.  needs timeout?
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
    console.log("MADE IT TO CLAIM AND RESTAKE")
    simulateOnly = false
    const validatorRewards =
      rewards ||
      (await fetchRewards(
        delegatorAddress,
        validatorAddresses.map(addr => ({ validator_address: addr })),
      ));

    const hasRewards = validatorRewards.some(
      reward => parseFloat(reward.rewards[0]?.amount || '0') > 0,
    );
  
    if (!hasRewards) return { success: false, message: 'No rewards to claim', data: { code: 1 } };

    // Create claim messages using same structure as claimRewards
    const claimMessages = buildClaimMessage({
      endpoint: CHAIN_ENDPOINTS.claimRewards,
      delegatorAddress,
      validatorAddress: validatorAddresses,
    });

    // Create delegate messages
    const delegateMessages = validatorRewards.flatMap(reward =>
      buildClaimMessage({
        endpoint: delegateEndpoint,
        delegatorAddress,
        validatorAddress: reward.validator,
        amount: reward.rewards[0].amount.split('.')[0],
        denom: reward.rewards[0].denom,
      }),
    );

    // Combine messages in correct order
    const batchedMessages = [...claimMessages, ...delegateMessages];

    if (simulateOnly) {
      const simulateResponse = await queryRpcNode({
        endpoint: delegateEndpoint,
        messages: batchedMessages,
        simulateOnly: true
      });
      
      return {
        success: true,
        message: 'Simulation successful',
        data: simulateResponse
      };
    }
    console.log("made it to batched tx submission")
    // Execute batched transaction
    if (batchedMessages.length > 0) {
      const response = await queryRpcNode({
        endpoint: delegateEndpoint,
        messages: batchedMessages,
      });
      return { success: true, message: 'Batch transaction successful', data: response };
    }

    return { success: false, message: 'No messages to process', data: { code: 1 } };
  } catch (error) {
    console.error('Error during batch claim and restake process:', error);
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
      console.log('Simulation result for staking:', response);
      return { success: true, message: 'Simulation successful', data: response };
    }

    return { success: true, message: 'Transaction successful', data: response };
  } catch (error) {
    console.error('Error during staking:', error);
    return {
      success: false,
      message: error instanceof Error ? error.message : 'Unknown error occurred',
      data: { code: 1 },
    };
  }
};

// TODO: merge functions for unstake and unstake all
export const unstakeFromValidator = async (
  amount: string,
  delegation: DelegationResponse,
  simulateOnly = false,
): Promise<TransactionResult> => {
  const endpoint = CHAIN_ENDPOINTS.undelegateFromValidator;
  const formattedAmount = (
    parseFloat(amount) *
    Math.pow(
      10,
      LOCAL_ASSET_REGISTRY[delegation.balance.denom].exponent || GREATER_EXPONENT_DEFAULT,
    )
  ).toFixed(0);

  const messages = buildClaimMessage({
    endpoint,
    delegatorAddress: delegation.delegation.delegator_address,
    validatorAddress: delegation.delegation.validator_address,
    amount: formattedAmount,
    denom: delegation.balance.denom,
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
      console.log('Simulation result for unstaking:', response);
      return { success: true, message: 'Simulation successful', data: response };
    }

    return { success: true, message: 'Transaction successful', data: response };
  } catch (error) {
    console.error('Error during unstaking:', error);
    return {
      success: false,
      message: error instanceof Error ? error.message : 'Unknown error occurred',
      data: { code: 1 },
    };
  }
};

export const unstakeFromAllValidators = async (
  delegations: DelegationResponse[],
  simulateOnly = false,
): Promise<TransactionResult> => {
  const endpoint = CHAIN_ENDPOINTS.undelegateFromValidator;

  const messages = buildClaimMessage({
    endpoint,
    delegations,
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
      console.log('Simulation result for unstaking:', response);
      return { success: true, message: 'Simulation successful', data: response };
    }

    console.log('Successfully unstaked:', response);
    return {
      success: true,
      message: 'Transaction successful',
      data: {
        code: response.code || 0,
        txHash: response.txHash,
        gasUsed: response.gasUsed,
        gasWanted: response.gasWanted,
        height: response.height,
      },
    };
  } catch (error) {
    console.error('Error during unstaking:', error);
    return {
      success: false,
      message: error instanceof Error ? error.message : 'Unknown error occurred',
      data: {
        code: 1,
      },
    };
  }
};
