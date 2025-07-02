import {
  CombinedStakingInfo,
  DelegationResponse,
  LocalChainRegistry,
  MintModuleParams,
  SigningInfo,
  SlashingParams,
  StakingParams,
  UnbondingDelegationResponse,
  Uri,
  ValidatorInfo,
} from '@/types';
import { queryRestNode } from './queryNodes';
import {
  BondStatus,
  COSMOS_CHAIN_ENDPOINTS,
  DEFAULT_CHAIN_ID,
  SYMPHONY_ENDPOINTS,
} from '@/constants';
import { fromBase64, toBech32 } from '@cosmjs/encoding';
import { sha256 } from '@cosmjs/crypto';

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

const defaultDelegation = {
  delegator_address: '',
  validator_address: '',
  shares: '',
};

const defaultBalance = {
  denom: '',
  amount: '0',
};

const defaultUnbonding = {
  balance: '',
  completion_time: '',
};

export const fetchUnbondingDelegations = async (
  restUris: Uri[],
  delegatorAddress: string,
  validatorAddress?: string,
  paginationKey?: string,
): Promise<{ delegations: UnbondingDelegationResponse[]; pagination: any }> => {
  try {
    let endpoint = `${COSMOS_CHAIN_ENDPOINTS.getSpecificDelegations}${delegatorAddress}/unbonding_delegations`;
    if (validatorAddress) {
      endpoint += `/${validatorAddress}`;
    }

    if (paginationKey) {
      endpoint += `?pagination.key=${encodeURIComponent(paginationKey)}`;
    }

    const response = await queryRestNode({ endpoint, restUris });

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
  restUris: Uri[],
  delegatorAddress: string,
  validatorAddress?: string,
): Promise<{ delegations: DelegationResponse[]; pagination: any }> => {
  try {
    let endpoint = `${COSMOS_CHAIN_ENDPOINTS.getDelegations}${delegatorAddress}`;

    // If a validatorAddress is provided, modify the endpoint to fetch delegation for that specific validator
    if (validatorAddress) {
      endpoint = `${COSMOS_CHAIN_ENDPOINTS.getSpecificDelegations}${delegatorAddress}/delegations/${validatorAddress}`;
    }

    const response = await queryRestNode({ endpoint, restUris });

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

export const fetchAllValidators = async (
  restUris: Uri[],
  bondStatus?: BondStatus,
): Promise<ValidatorInfo[]> => {
  let allValidators: ValidatorInfo[] = [];
  let nextKey: string | null = null;

  do {
    try {
      let endpoint = `${COSMOS_CHAIN_ENDPOINTS.getValidators}?pagination.key=${encodeURIComponent(nextKey || '')}`;
      if (bondStatus) {
        endpoint += `&status=${bondStatus}`;
      }

      const response = await queryRestNode({ endpoint, restUris });

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
  restUris: Uri[],
  validatorAddress?: string,
  bondStatus?: BondStatus,
): Promise<{ validators: ValidatorInfo[]; pagination: any }> => {
  try {
    if (validatorAddress) {
      let endpoint = `${COSMOS_CHAIN_ENDPOINTS.getValidators}${validatorAddress}`;
      const response = await queryRestNode({ endpoint, restUris });

      // Filter single validator by bond status if provided
      if (bondStatus && response?.validator?.status !== bondStatus) {
        return { validators: [], pagination: null };
      }

      return {
        validators: [response?.validator ?? defaultValidatorInfo],
        pagination: null,
      };
    } else {
      const allValidators = await fetchAllValidators(restUris, bondStatus);
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
  restUris: Uri[],
  delegatorAddress: string,
  delegations?: { validator_address: string }[],
): Promise<{ validator: string; rewards: any[] }[]> => {
  try {
    let endpoint = `${COSMOS_CHAIN_ENDPOINTS.getRewards}/${delegatorAddress}/rewards`;

    // If specific delegations (validators) are provided, query rewards for each validator separately
    if (delegations && delegations.length > 0) {
      const rewardsPromises = delegations.map(async delegation => {
        const specificEndpoint = `${COSMOS_CHAIN_ENDPOINTS.getRewards}/${delegatorAddress}/rewards/${delegation.validator_address}`;
        const response = await queryRestNode({ endpoint: specificEndpoint, restUris });
        return {
          validator: delegation.validator_address,
          rewards: response.rewards || [],
        };
      });

      const rewardsData = await Promise.all(rewardsPromises);
      return rewardsData;
    }

    // Fetch all rewards for the delegator
    const response = await queryRestNode({ endpoint, restUris });

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

export const fetchStakingParams = async (restUris: Uri[]): Promise<StakingParams | null> => {
  try {
    const endpoint = `${COSMOS_CHAIN_ENDPOINTS.getStakingParams}`;
    const response = await queryRestNode({ endpoint, restUris });

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

const fetchAllSigningInfos = async (restUris: Uri[]): Promise<SigningInfo[]> => {
  let allInfos: SigningInfo[] = [];
  let nextKey: string | null = null;

  do {
    const endpoint = `${COSMOS_CHAIN_ENDPOINTS.getSigningInfos}${nextKey ? `?pagination.key=${encodeURIComponent(nextKey)}` : ''}`;
    const response = await queryRestNode({ endpoint, restUris });

    const infos = response?.info ?? [];
    allInfos = allInfos.concat(infos);
    console.log('Fetched signing infos:', infos.length, 'Total accumulated:', allInfos.length);

    nextKey = response.pagination?.next_key ?? null;
  } while (nextKey !== null && nextKey !== '0');

  return allInfos;
};

const fetchSymphonyInflation = async (restUris: Uri[]): Promise<number> => {
  try {
    const [epochRes, paramsRes, poolRes] = await Promise.all([
      queryRestNode({ restUris, endpoint: SYMPHONY_ENDPOINTS.getMintEpochProvisions }),
      queryRestNode({ restUris, endpoint: SYMPHONY_ENDPOINTS.getMintParams }),
      queryRestNode({ restUris, endpoint: COSMOS_CHAIN_ENDPOINTS.getStakingPool }),
    ]);

    const mintParams = paramsRes.params as unknown as MintModuleParams;

    const epochProvisions = parseFloat(epochRes.epoch_provisions || '0');
    const stakingProportion = parseFloat(mintParams.distribution_proportions.staking || '0');
    const bondedTokens = parseFloat(poolRes.pool?.bonded_tokens || '1');

    const yearlyStakingProvisions = epochProvisions * 52 * stakingProportion;
    const inflation = yearlyStakingProvisions / bondedTokens;

    return inflation;
  } catch (error) {
    console.error('Error calculating inflation from Symphony mint module:', error);
    return 0;
  }
};

const fetchCommunityTax = async (restUris: Uri[]): Promise<number> => {
  const res: any = await queryRestNode({
    endpoint: COSMOS_CHAIN_ENDPOINTS.getDistributionParams,
    restUris,
  });
  const tax = parseFloat(res.params?.community_tax || '0');
  return tax;
};

const fetchBondedRatio = async (restUris: Uri[]): Promise<number> => {
  const res = await queryRestNode({ endpoint: COSMOS_CHAIN_ENDPOINTS.getStakingPool, restUris });

  const bonded = parseFloat(res.pool?.bonded_tokens || '0');
  const notBonded = parseFloat(res.pool?.not_bonded_tokens || '0');
  const ratio = bonded / (bonded + notBonded);

  return ratio;
};

const fetchSignedBlocksWindow = async (restUris: Uri[]): Promise<number> => {
  try {
    const slashingData: any = await queryRestNode({
      restUris,
      endpoint: COSMOS_CHAIN_ENDPOINTS.getSlashingParams,
    });
    const signedBlocksWindow = parseInt(
      (slashingData.params as unknown as SlashingParams).signed_blocks_window || '10000',
    );

    return signedBlocksWindow;
  } catch (error) {
    console.error('Error calculating inflation from Symphony mint module:', error);
    return 0;
  }
};

const convertPubKeyToValConsAddress = (pubKey: string, prefix = 'symphonyvalcons') => {
  const decoded = fromBase64(pubKey);
  const hashed = sha256(decoded).slice(0, 20);
  return toBech32(prefix, hashed);
};

const calculateAPR = (inflation: number, tax: number, ratio: number, commission: number) =>
  ((inflation * (1 - tax)) / ratio) * (1 - commission) * 100;

const buildUptimeMap = (
  validators: ValidatorInfo[],
  signingInfos: SigningInfo[],
  signedBlocksWindow: number,
): Record<string, string> => {
  const signingInfoMap = signingInfos.reduce<Record<string, number>>((acc, info) => {
    acc[info.address] = parseInt(info.missed_blocks_counter || '0');
    return acc;
  }, {});

  return validators.reduce<Record<string, string>>((acc, validator) => {
    const pubKey = validator.consensus_pubkey?.key;
    if (!pubKey || validator.jailed) {
      acc[validator.operator_address] = '0.00';
      return acc;
    }

    const valcons = convertPubKeyToValConsAddress(pubKey);
    const missed = signingInfoMap[valcons] ?? signedBlocksWindow;
    const uptime = ((signedBlocksWindow - missed) / signedBlocksWindow) * 100;

    acc[validator.operator_address] = uptime.toFixed(2);
    return acc;
  }, {});
};

export const fetchValidatorData = async (
  chainRegistry: LocalChainRegistry,
  chainID: string,
  delegatorAddress: string,
): Promise<CombinedStakingInfo[]> => {
  try {
    const restUris = chainRegistry[chainID].rest_uris;
    const symphonyRestUris = chainRegistry[DEFAULT_CHAIN_ID].rest_uris;

    if (!restUris || restUris.length === 0) {
      console.error('[fetchStakingInfo] Missing rest_uris for chain ID:', chainID);
    }

    const [
      { validators },
      { delegations },
      rewards,
      stakingParams,
      { delegations: unbondingDelegations },
      inflation,
      communityTax,
      bondedRatio,
      signingInfos,
      signedBlocksWindow,
    ] = await Promise.all([
      fetchValidators(restUris),
      fetchDelegations(restUris, delegatorAddress),
      fetchRewards(restUris, delegatorAddress),
      fetchStakingParams(restUris),
      fetchUnbondingDelegations(restUris, delegatorAddress),
      // TODO: check inflation vs symphony inflation depending on which chain
      fetchSymphonyInflation(symphonyRestUris),
      fetchCommunityTax(restUris),
      fetchBondedRatio(restUris),
      fetchAllSigningInfos(restUris),
      fetchSignedBlocksWindow(restUris),
    ]);

    const totalTokens = validators.reduce((sum, v) => sum + parseFloat(v.tokens), 0);
    const uptimeMap = buildUptimeMap(validators, signingInfos, signedBlocksWindow);

    return validators.map(validator => {
      const validatorAddress = validator.operator_address;

      const delegation = delegations.find(d => d.delegation.validator_address === validatorAddress);
      const rewardInfo = rewards.find(r => r.validator === validatorAddress);
      const unbonding = unbondingDelegations.find(
        u => u.validator_address === validatorAddress && u.delegator_address === delegatorAddress,
      );

      const commissionRate = parseFloat(validator.commission.commission_rates.rate);
      const theoreticalApr = calculateAPR(inflation, communityTax, bondedRatio, commissionRate);

      const tokens = parseFloat(validator.tokens);
      const votingPower =
        validator.status === BondStatus.BONDED ? ((tokens / totalTokens) * 100).toFixed(2) : '0';

      const unbondingBalance = unbonding
        ? {
            balance: unbonding.entries
              .reduce((sum, e) => sum + parseFloat(e.balance), 0)
              .toString(),
            completion_time: new Date(
              Math.max(...unbonding.entries.map(e => +new Date(e.completion_time))),
            ).toISOString(),
          }
        : defaultUnbonding;

      return {
        validator,
        delegation: delegation?.delegation || defaultDelegation,
        balance: delegation?.balance || defaultBalance,
        rewards: rewardInfo?.rewards || [],
        stakingParams,
        commission: (commissionRate * 100).toFixed(2),
        theoreticalApr: theoreticalApr.toFixed(2),
        votingPower,
        uptime: uptimeMap[validatorAddress] || '0.00',
        unbondingBalance,
      };
    });
  } catch (error) {
    console.error('Error fetching validator data:', error);
    throw error;
  }
};
