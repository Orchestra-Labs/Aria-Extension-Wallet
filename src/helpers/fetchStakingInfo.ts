import {
  CombinedStakingInfo,
  DelegationResponse,
  StakingParams,
  UnbondingDelegationResponse,
  ValidatorInfo,
} from '@/types';
import { queryRestNode } from './queryNodes';
import { BondStatus, CHAIN_ENDPOINTS } from '@/constants';
// import { fromBase64, toBech32 } from '@cosmjs/encoding';

export const fetchUnbondingDelegations = async (
  delegatorAddress: string,
  validatorAddress?: string,
  paginationKey?: string,
): Promise<{ delegations: UnbondingDelegationResponse[]; pagination: any }> => {
  try {
    let endpoint = `${CHAIN_ENDPOINTS.getSpecificDelegations}${delegatorAddress}/unbonding_delegations`;
    if (validatorAddress) {
      endpoint += `/${validatorAddress}`;
    }

    if (paginationKey) {
      endpoint += `?pagination.key=${encodeURIComponent(paginationKey)}`;
    }

    const response = await queryRestNode({ endpoint });

    return {
      delegations: (response.unbonding_responses ?? []).map((item: any) => {
        return {
          delegator_address: item.delegator_address,
          validator_address: item.validator_address,
          entries: item.entries.map((entry: any) => ({
            balance: entry.balance,
            completion_time: entry.completion_time,
          })),
        };
      }),
      pagination: response.pagination,
    };
  } catch (error: any) {
    if (error.response && error.response.status === 501) {
      console.error('Node query failed: Unbonding delegation endpoint returned a 501 error.');
    } else {
      console.error(
        `Unexpected error fetching unbonding delegations for ${delegatorAddress}:`,
        error,
      );
    }

    // Return an empty structure on error
    return {
      delegations: [],
      pagination: null,
    };
  }
};

export const fetchDelegations = async (
  delegatorAddress: string,
  validatorAddress?: string,
): Promise<{ delegations: DelegationResponse[]; pagination: any }> => {
  try {
    let endpoint = `${CHAIN_ENDPOINTS.getDelegations}${delegatorAddress}`;

    // If a validatorAddress is provided, modify the endpoint to fetch delegation for that specific validator
    if (validatorAddress) {
      endpoint = `${CHAIN_ENDPOINTS.getSpecificDelegations}${delegatorAddress}/delegations/${validatorAddress}`;
    }

    const response = await queryRestNode({ endpoint });

    return {
      delegations: (response.delegation_responses ?? []).map((item: any) => {
        return {
          delegation: item.delegation,
          balance: item.balance,
        };
      }),
      pagination: response.pagination,
    };
  } catch (error) {
    console.error(`Error fetching delegations for ${delegatorAddress}:`, error);
    throw error;
  }
};

const defaultValidatorInfo: ValidatorInfo = {
  operator_address: '',
  consensus_pubkey: { '@type': '', key: '' },
  jailed: false,
  status: BondStatus.UNBONDED,
  tokens: '0',
  delegator_shares: '0',
  description: {
    moniker: '',
    website: '',
    details: '',
  },
  commission: {
    commission_rates: {
      rate: '0',
      max_rate: '0',
      max_change_rate: '0',
    },
  },
};

export const fetchAllValidators = async (bondStatus?: BondStatus): Promise<ValidatorInfo[]> => {
  let allValidators: ValidatorInfo[] = [];
  let nextKey: string | null = null;

  do {
    try {
      let endpoint = `${CHAIN_ENDPOINTS.getValidators}?pagination.key=${encodeURIComponent(nextKey || '')}`;
      if (bondStatus) {
        endpoint += `&status=${bondStatus}`;
      }

      const response = await queryRestNode({ endpoint });

      allValidators = allValidators.concat(response.validators ?? []);

      nextKey = response.pagination?.next_key ?? null;
    } catch (error) {
      console.error('Error fetching validators:', error);
      throw error;
    }
  } while (nextKey);

  return allValidators;
};

export const fetchValidators = async (
  validatorAddress?: string,
  bondStatus?: BondStatus,
): Promise<{ validators: ValidatorInfo[]; pagination: any }> => {
  try {
    if (validatorAddress) {
      let endpoint = `${CHAIN_ENDPOINTS.getValidators}${validatorAddress}`;
      const response = await queryRestNode({ endpoint });

      // Filter single validator by bond status if provided
      if (bondStatus && response?.validator?.status !== bondStatus) {
        return { validators: [], pagination: null };
      }

      return {
        validators: [response?.validator ?? defaultValidatorInfo],
        pagination: null,
      };
    } else {
      const allValidators = await fetchAllValidators(bondStatus);
      return {
        validators: allValidators,
        pagination: null, // We're returning all matching validators, so pagination is not applicable
      };
    }
  } catch (error) {
    console.error(
      `Error fetching validator info for ${validatorAddress || 'all validators'}:`,
      error,
    );
    throw error;
  }
};

export const fetchRewards = async (
  delegatorAddress: string,
  delegations?: { validator_address: string }[],
): Promise<{ validator: string; rewards: any[] }[]> => {
  try {
    let endpoint = `${CHAIN_ENDPOINTS.getRewards}/${delegatorAddress}/rewards`;

    // If specific delegations (validators) are provided, query rewards for each validator separately
    if (delegations && delegations.length > 0) {
      const rewardsPromises = delegations.map(async delegation => {
        const specificEndpoint = `${CHAIN_ENDPOINTS.getRewards}/${delegatorAddress}/rewards/${delegation.validator_address}`;
        const response = await queryRestNode({ endpoint: specificEndpoint });
        return {
          validator: delegation.validator_address,
          rewards: response.rewards || [],
        };
      });

      const rewardsData = await Promise.all(rewardsPromises);
      return rewardsData;
    }

    // Fetch all rewards for the delegator
    const response = await queryRestNode({ endpoint });

    // Process the response and map rewards for each validator
    return (response.rewards ?? []).map((reward: any) => ({
      validator: reward.validator_address,
      rewards: reward.reward || [],
    }));
  } catch (error) {
    console.error(`Error fetching rewards for ${delegatorAddress}:`, error);
    throw error;
  }
};

export const fetchStakingParams = async (): Promise<StakingParams | null> => {
  try {
    const endpoint = `${CHAIN_ENDPOINTS.getStakingParams}`;
    const response = await queryRestNode({ endpoint });

    if (response && 'params' in response) {
      // Convert unbonding_time to days
      const stakingParams = response.params as StakingParams;
      const unbondingTimeInSeconds = parseInt(stakingParams.unbonding_time || '0', 10);
      const unbondingTimeInDays = unbondingTimeInSeconds / (60 * 60 * 24);

      return {
        ...stakingParams,
        unbonding_time: unbondingTimeInDays.toString(),
      };
    }

    return null;
  } catch (error) {
    console.error('Error fetching staking params:', error);
    throw error;
  }
};

// const fetchUptimeForValidator = async (validatorAddress: string): Promise<number> => {
//   try {
//     const endpoint = `${CHAIN_ENDPOINTS.getUptime}${validatorAddress}`;
//     console.log('querying for uptime from:', endpoint);

//     const response = await queryRestNode({ endpoint });

//     console.log('Uptime Response:', response);

//     const missedBlocks = parseInt(response.val_signing_info.missed_blocks_counter, 10);
//     const totalBlocks = parseInt(response.val_signing_info.index_offset, 10);

//     if (isNaN(missedBlocks) || isNaN(totalBlocks) || totalBlocks === 0) {
//       console.error(`Invalid data for validator ${validatorAddress}. Setting uptime to 0%`);
//       return 0;
//     }

//     const uptime = ((totalBlocks - missedBlocks) / totalBlocks) * 100;
//     return uptime;
//   } catch (error) {
//     console.error(`Error fetching uptime for validator ${validatorAddress}:`, error);
//     return 0;
//   }
// };

// // TODO: move to utils
// const convertPubKeyToValConsAddress = (pubKey: string, prefix: string = 'symphonyvalcons') => {
//   const decodedPubKey = fromBase64(pubKey);
//   const valConsAddress = toBech32(prefix, decodedPubKey);
//   return valConsAddress;
// };

export const fetchValidatorData = async (
  delegatorAddress: string,
): Promise<CombinedStakingInfo[]> => {
  try {
    const [validatorResponse, delegationResponse, rewards, stakingParams, unbondingResponse] =
      await Promise.all([
        fetchValidators(),
        fetchDelegations(delegatorAddress),
        fetchRewards(delegatorAddress),
        fetchStakingParams(),
        fetchUnbondingDelegations(delegatorAddress),
      ]);

    const validators = validatorResponse.validators;
    const delegations = delegationResponse.delegations;
    const unbondingDelegations = unbondingResponse.delegations;
    const totalTokens = validators.reduce((sum, v) => sum + parseFloat(v.tokens), 0);

    // TODO: fix this.  currently not creating correct signer address
    // const uptimePromises = [validators[0]].map(validator => {
    //   const signingAddress = convertPubKeyToValConsAddress(
    //     validator.consensus_pubkey.key,
    //     'symphonyvalcons',
    //   );
    //   console.log(`Validator: ${validator.description.moniker}`);
    //   console.log(`Key: ${validator.consensus_pubkey.key}`);
    //   console.log(`Signing Address: ${signingAddress}`);
    //   return validator.status === BondStatus.BONDED ? fetchUptimeForValidator(signingAddress) : 0;
    // });
    // const uptimeResults = await Promise.all(uptimePromises);
    // const uptimeMap = validators.reduce<Record<string, string>>((acc, validator, index) => {
    //   acc[validator.operator_address] = uptimeResults[index].toFixed(2);
    //   return acc;
    // }, {});

    const combinedData: CombinedStakingInfo[] = validators.map(validator => {
      const delegationInfo = delegations.find(
        delegation => delegation.delegation.validator_address === validator.operator_address,
      );
      const rewardInfo = rewards.find(reward => reward.validator === validator.operator_address);

      const unbondingInfo = unbondingDelegations.find(
        unbonding =>
          unbonding.delegator_address === delegatorAddress &&
          unbonding.validator_address === validator.operator_address,
      );

      const commissionRate = parseFloat(validator.commission.commission_rates.rate);
      const estimatedReturn = (1 - commissionRate) * 100;
      const validatorTokens = parseFloat(validator.tokens);

      const votingPower =
        validator.status === BondStatus.BONDED
          ? ((validatorTokens / totalTokens) * 100).toFixed(2)
          : '0';

      // const uptime = uptimeMap[validator.operator_address] || '0.00';

      const combinedInfo: CombinedStakingInfo = {
        validator,
        delegation: delegationInfo?.delegation || {
          delegator_address: '',
          validator_address: '',
          shares: '',
        },
        balance: delegationInfo?.balance || {
          denom: '',
          amount: '0',
        },
        rewards: rewardInfo?.rewards || [],
        stakingParams,
        commission: (commissionRate * 100).toFixed(2),
        estimatedReturn: estimatedReturn.toFixed(2),
        votingPower: votingPower,
        // uptime: uptime,
        unbondingBalance: unbondingInfo
          ? {
              balance: unbondingInfo.entries
                .reduce((total, entry) => total + parseFloat(entry.balance), 0)
                .toString(),
              completion_time: unbondingInfo.entries
                .map(entry => new Date(entry.completion_time))
                .reduce((latest, current) => (current > latest ? current : latest), new Date(0))
                .toISOString(),
            }
          : {
              balance: '',
              completion_time: '',
            },
      };

      return combinedInfo;
    });

    return combinedData;
  } catch (error) {
    console.error('Error fetching validator data:', error);
    throw error;
  }
};
