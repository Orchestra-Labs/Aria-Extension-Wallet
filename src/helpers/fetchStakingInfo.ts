import {
  CombinedStakingInfo,
  DelegationResponse,
  LocalChainRegistry,
  MintParams,
  SigningInfo,
  SimplifiedChainInfo,
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
  KNOWN_EPOCH_BASED_CHAINS,
  SYMPHONY_CHAIN_ID_LIST,
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
  prefix: string,
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

    const response = await queryRestNode({ endpoint, prefix, restUris });

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
  prefix: string,
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

    const response = await queryRestNode({ endpoint, prefix, restUris });

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
  prefix: string,
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

      const response = await queryRestNode({ endpoint, prefix, restUris });

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
  prefix: string,
  restUris: Uri[],
  validatorAddress?: string,
  bondStatus?: BondStatus,
): Promise<{ validators: ValidatorInfo[]; pagination: any }> => {
  try {
    if (validatorAddress) {
      let endpoint = `${COSMOS_CHAIN_ENDPOINTS.getValidators}${validatorAddress}`;
      const response = await queryRestNode({ endpoint, prefix, restUris });

      // Filter single validator by bond status if provided
      if (bondStatus && response?.validator?.status !== bondStatus) {
        return { validators: [], pagination: null };
      }

      return {
        validators: [response?.validator ?? defaultValidatorInfo],
        pagination: null,
      };
    } else {
      const allValidators = await fetchAllValidators(prefix, restUris, bondStatus);
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
  prefix: string,
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
        const response = await queryRestNode({ endpoint: specificEndpoint, prefix, restUris });
        return {
          validator: delegation.validator_address,
          rewards: response.rewards || [],
        };
      });

      const rewardsData = await Promise.all(rewardsPromises);
      return rewardsData;
    }

    // Fetch all rewards for the delegator
    const response = await queryRestNode({ endpoint, prefix, restUris });

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

export const fetchStakingParams = async (
  prefix: string,
  restUris: Uri[],
): Promise<StakingParams | null> => {
  try {
    const endpoint = `${COSMOS_CHAIN_ENDPOINTS.getStakingParams}`;
    const response = await queryRestNode({ endpoint, prefix, restUris });

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

const fetchAllSigningInfos = async (prefix: string, restUris: Uri[]): Promise<SigningInfo[]> => {
  let allInfos: SigningInfo[] = [];
  let nextKey: string | null = null;

  do {
    const endpoint = `${COSMOS_CHAIN_ENDPOINTS.getSigningInfos}${nextKey ? `?pagination.key=${encodeURIComponent(nextKey)}` : ''}`;
    const response = await queryRestNode({ endpoint, prefix, restUris });

    const infos = response?.info ?? [];
    allInfos = allInfos.concat(infos);
    console.log('Fetched signing infos:', infos.length, 'Total accumulated:', allInfos.length);

    nextKey = response.pagination?.next_key ?? null;
  } while (nextKey !== null && nextKey !== '0');

  return allInfos;
};

// TODO: move to utils
const getEpochsPerYear = (epochIdentifier: string): number => {
  switch (epochIdentifier.toLowerCase()) {
    case 'day':
      return 365;
    case 'week':
      return 52;
    case 'month':
      return 12;
    case 'hour':
      return 365 * 24;
    default:
      console.warn(`Unknown epoch identifier: ${epochIdentifier}, defaulting to weekly`);
      return 52;
  }
};

const fetchEpochBasedInflation = async (
  prefix: string,
  restUris: Uri[],
  mintModulePath: string,
): Promise<number> => {
  try {
    console.log(`[Endpoint] Starting epoch-based inflation calculation for ${mintModulePath}`);

    const [epochRes, paramsRes, poolRes] = await Promise.all([
      queryRestNode({
        prefix,
        restUris,
        endpoint: `${mintModulePath}/epoch_provisions`,
      }),
      queryRestNode({
        prefix,
        restUris,
        endpoint: `${mintModulePath}/params`,
      }),
      queryRestNode({
        prefix,
        restUris,
        endpoint: COSMOS_CHAIN_ENDPOINTS.getStakingPool,
      }),
    ]);

    console.log('[Endpoint] Raw API responses:', {
      epochProvisions: epochRes,
      mintParams: paramsRes,
      stakingPool: poolRes,
    });

    const epochProvisions = parseFloat(epochRes.epoch_provisions || '0');
    const params = paramsRes.params as unknown as MintParams;
    const stakingProportion = parseFloat(params.distribution_proportions?.staking || '0');
    const bondedTokens = parseFloat(poolRes.pool?.bonded_tokens || '1');

    console.log('[Endpoint] Parsed values:', {
      epochProvisions,
      stakingProportion,
      bondedTokens,
      distributionProportions: params.distribution_proportions,
      epochIdentifier: params.epoch_identifier,
    });

    const epochIdentifier = params.epoch_identifier || 'week';
    const epochsPerYear = getEpochsPerYear(epochIdentifier);

    console.log('[Endpoint] Epoch calculations:', {
      epochIdentifier,
      epochsPerYear,
      getEpochsPerYear: getEpochsPerYear(epochIdentifier),
    });

    const yearlyStakingInflation =
      (epochProvisions * epochsPerYear * stakingProportion) / bondedTokens;

    console.log('[Endpoint] Final calculation:', {
      yearlyStakingInflation,
      calculation: `(${epochProvisions} * ${epochsPerYear} * ${stakingProportion}) / ${bondedTokens}`,
    });

    return yearlyStakingInflation;
  } catch (error) {
    console.error('[Endpoint] Epoch-based inflation calculation failed:', {
      error,
      mintModulePath,
      restUris,
    });
    return 0;
  }
};

const fetchStandardCosmosInflation = async (prefix: string, restUris: Uri[]): Promise<number> => {
  try {
    // Try direct inflation endpoint first
    try {
      const inflationRes = await queryRestNode({
        prefix,
        restUris,
        endpoint: COSMOS_CHAIN_ENDPOINTS.getInflation,
      });
      if (inflationRes?.inflation) {
        return parseFloat(inflationRes.inflation);
      }
    } catch (error) {
      console.log('Direct inflation endpoint not available, falling back to params');
    }

    // Fallback to params-based calculation
    const [paramsRes, poolRes] = await Promise.all([
      queryRestNode({
        prefix,
        restUris,
        endpoint: COSMOS_CHAIN_ENDPOINTS.getMintParams,
      }),
      queryRestNode({
        prefix,
        restUris,
        endpoint: COSMOS_CHAIN_ENDPOINTS.getStakingPool,
      }),
    ]);

    const params = paramsRes.params as unknown as MintParams;
    const bondedTokens = parseFloat(poolRes.pool?.bonded_tokens || '1');

    // Try annual_provisions first
    if (params.annual_provisions) {
      return parseFloat(params.annual_provisions) / bondedTokens;
    }

    // Fallback to inflation rate parameters if available
    if (params.inflation_min && params.inflation_max) {
      return (parseFloat(params.inflation_min) + parseFloat(params.inflation_max)) / 2;
    }

    return 0;
  } catch (error) {
    console.error('Standard inflation calculation failed:', error);
    return 0;
  }
};

// TODO: move to utils
export const getMintEndpoint = (
  chainInfo: SimplifiedChainInfo,
  // customMintPaths: Record<string, Record<string, string>> = {},
): string => {
  // Check custom paths first (e.g., Stargaze uses 'publicawesome')
  // const customPath = customMintPaths[chainInfo.chain_id]?.mint;
  // console.log('[Endpoint] Mint Endpoint:', chainInfo, customPath);
  // if (customPath) return customPath;

  // Use chain_name from registry
  return `/${chainInfo.chain_name.replace(/\s+/g, '').toLowerCase()}/mint/v1beta1`;
};

const fetchInflation = async (chainInfo: SimplifiedChainInfo, restUris: Uri[]): Promise<number> => {
  const mintEndpoint = getMintEndpoint(
    chainInfo,
    // SPECIALIZED_ENDPOINTS
  );

  if (KNOWN_EPOCH_BASED_CHAINS.includes(chainInfo.chain_id)) {
    console.log('[Endpoint] Marking as epoch based chain:', chainInfo.chain_id);
    return fetchEpochBasedInflation(chainInfo.bech32_prefix, restUris, mintEndpoint);
  }
  return fetchStandardCosmosInflation(chainInfo.bech32_prefix, restUris);
};

const fetchCommunityTax = async (prefix: string, restUris: Uri[]): Promise<number> => {
  const res: any = await queryRestNode({
    prefix,
    endpoint: COSMOS_CHAIN_ENDPOINTS.getDistributionParams,
    restUris,
  });
  const tax = parseFloat(res.params?.community_tax || '0');
  return tax;
};

const fetchBondedRatio = async (prefix: string, restUris: Uri[]): Promise<number> => {
  const res = await queryRestNode({
    prefix,
    endpoint: COSMOS_CHAIN_ENDPOINTS.getStakingPool,
    restUris,
  });

  const bonded = parseFloat(res.pool?.bonded_tokens || '0');
  const notBonded = parseFloat(res.pool?.not_bonded_tokens || '0');
  const ratio = bonded / (bonded + notBonded);

  return ratio;
};

const fetchSignedBlocksWindow = async (prefix: string, restUris: Uri[]): Promise<number> => {
  try {
    const slashingData: any = await queryRestNode({
      prefix,
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

const convertPubKeyToValConsAddress = (pubKey: string, prefix: string): string => {
  try {
    const decoded = fromBase64(pubKey);
    const hashed = sha256(decoded).slice(0, 20);
    return toBech32(prefix, hashed);
  } catch (error) {
    console.error('Error converting pubkey to valcons address:', error);
    throw error;
  }
};

// TODO: move to utils
export const isSymphonyChain = (chainId: string): boolean => {
  return SYMPHONY_CHAIN_ID_LIST.includes(chainId);
};

const fetchUptimeData = async (
  prefix: string,
  restUris: Uri[],
  validators: ValidatorInfo[],
): Promise<{ uptimeMap: Record<string, string>; signedBlocksWindow: number }> => {
  const defaultWindow = 10000;
  const uptimeMap: Record<string, string> = {};

  try {
    // Get signed blocks window first
    const signedBlocksWindow = await fetchSignedBlocksWindow(prefix, restUris).catch(
      () => defaultWindow,
    );

    // Initialize all validators with default uptime
    validators.forEach(validator => {
      uptimeMap[validator.operator_address] = '0.00';
    });

    // Try to get all signing infos at once
    const signingInfos = await fetchAllSigningInfos(prefix, restUris).catch(() => []);

    if (signingInfos.length > 0) {
      const signingInfoMap = signingInfos.reduce<Record<string, number>>((acc, info) => {
        acc[info.address] = parseInt(info.missed_blocks_counter || '0');
        return acc;
      }, {});

      validators.forEach(validator => {
        if (validator.jailed) {
          uptimeMap[validator.operator_address] = '0.00';
          return;
        }

        const pubKey = validator.consensus_pubkey?.key;
        if (!pubKey) {
          uptimeMap[validator.operator_address] = '0.00';
          return;
        }

        try {
          const valcons = convertPubKeyToValConsAddress(pubKey, `${prefix}valcons`);
          const missed = signingInfoMap[valcons] ?? signedBlocksWindow;
          const uptime = ((signedBlocksWindow - missed) / signedBlocksWindow) * 100;
          uptimeMap[validator.operator_address] = uptime.toFixed(2);
        } catch (error) {
          console.error(`Error calculating uptime for ${validator.operator_address}:`, error);
          uptimeMap[validator.operator_address] = '0.00';
        }
      });
    }

    return { uptimeMap, signedBlocksWindow };
  } catch (error) {
    console.error('Error fetching uptime data:', error);
    // Fallback: return default uptime values
    validators.forEach(validator => {
      uptimeMap[validator.operator_address] = '0.00';
    });
    return { uptimeMap, signedBlocksWindow: defaultWindow };
  }
};

export const fetchValidatorData = async (
  chainRegistry: LocalChainRegistry,
  chainID: string,
  delegatorAddress: string,
): Promise<CombinedStakingInfo[]> => {
  console.log(`[ValidatorData] Starting fetch for chain: ${chainID}`);

  try {
    const chain = chainRegistry[chainID];
    const { bech32_prefix: prefix, rest_uris: restUris } = chain;

    // Validate chain configuration
    if (!chain || !prefix || !restUris?.length) {
      throw new Error(`Invalid chain configuration for ${chainID}`);
    }

    console.log(`[ValidatorData] Starting parallel queries for chain ${chainID}`);
    const startTime = Date.now();

    // First fetch validators separately since we need them for uptime calculation
    const { validators } = await fetchValidators(prefix, restUris);

    const [
      { delegations },
      rewards,
      stakingParams,
      { delegations: unbondingDelegations },
      communityTax,
      bondedRatio,
      inflation,
      { uptimeMap },
    ] = await Promise.all([
      fetchDelegations(prefix, restUris, delegatorAddress),
      fetchRewards(prefix, restUris, delegatorAddress),
      fetchStakingParams(prefix, restUris),
      fetchUnbondingDelegations(prefix, restUris, delegatorAddress),
      fetchCommunityTax(prefix, restUris),
      fetchBondedRatio(prefix, restUris),
      fetchInflation(chain, restUris),
      fetchUptimeData(prefix, restUris, validators),
    ]);

    console.log(`[ValidatorData] Completed queries in ${Date.now() - startTime}ms`);

    // Process validator data
    const totalTokens = validators.reduce(
      (sum: number, v: ValidatorInfo) => sum + parseFloat(v.tokens),
      0,
    );

    const result = validators.map((validator: ValidatorInfo) => {
      const validatorAddress = validator.operator_address;
      const delegation = delegations.find(
        (d: DelegationResponse) => d.delegation.validator_address === validatorAddress,
      );
      const rewardInfo = rewards.find(
        (r: { validator: string }) => r.validator === validatorAddress,
      );
      const unbonding = unbondingDelegations.find(
        (u: UnbondingDelegationResponse) =>
          u.validator_address === validatorAddress && u.delegator_address === delegatorAddress,
      );

      const commissionRate = parseFloat(validator.commission.commission_rates.rate);
      const theoreticalApr =
        ((inflation * (1 - communityTax)) / bondedRatio) * (1 - commissionRate) * 100;
      const tokens = parseFloat(validator.tokens);
      const votingPower =
        validator.status === BondStatus.BONDED ? ((tokens / totalTokens) * 100).toFixed(2) : '0';

      return {
        validator,
        delegation: delegation?.delegation || defaultDelegation,
        balance: delegation?.balance || defaultBalance,
        rewards: rewardInfo?.rewards || [],
        stakingParams,
        commission: (commissionRate * 100).toFixed(2),
        theoreticalApr: theoreticalApr.toFixed(2),
        votingPower,
        uptime: uptimeMap[validatorAddress] || '0',
        unbondingBalance: unbonding
          ? {
              balance: unbonding.entries
                .reduce((sum: number, e: { balance: string }) => sum + parseFloat(e.balance), 0)
                .toString(),
              completion_time: new Date(
                Math.max(
                  ...unbonding.entries.map((e: { completion_time: string }) =>
                    new Date(e.completion_time).getTime(),
                  ),
                ),
              ).toISOString(),
            }
          : defaultUnbonding,
      };
    });

    return result;
  } catch (error) {
    console.error(`[ValidatorData] Error fetching data for chain ${chainID}:`, error);
    throw error;
  }
};
