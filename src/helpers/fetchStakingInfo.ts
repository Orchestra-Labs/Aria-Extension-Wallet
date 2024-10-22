import { DelegationResponse, ValidatorInfo } from '@/types';
import { queryRestNode } from './queryNodes';
import { CHAIN_ENDPOINTS } from '@/constants';

// Fetch delegations (staked assets) from either the REST or RPC endpoint
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

    console.log(
      'Fetching delegations for delegator:',
      delegatorAddress,
      'Validator:',
      validatorAddress || 'all',
    );

    const response = await queryRestNode({ endpoint });

    console.log('Delegation response:', response);

    return {
      delegations: response.delegation_responses.map((item: any) => {
        console.log('Delegation recorded as:', item);

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

//fetch all validators using an optional bond status 
type BondStatus = 'BOND_STATUS_UNSPECIFIED' | 'BOND_STATUS_UNBONDED' | 'BOND_STATUS_UNBONDING' | 'BOND_STATUS_BONDED';

export const fetchAllValidators = async (bondStatus?: BondStatus): Promise<ValidatorInfo[]> => {
  let allValidators: ValidatorInfo[] = [];
  let nextKey: string | null = null;
  
  do {
    try {
      let endpoint = `${CHAIN_ENDPOINTS.getValidators}?pagination.key=${encodeURIComponent(nextKey || '')}`;
      if (bondStatus) {
        endpoint += `&status=${bondStatus}`;
      }
      
      console.log('Fetching validators, page key:', nextKey || 'first page', 'status:', bondStatus || 'all');
      
      const response = await queryRestNode({ endpoint });
      
      console.log('Validators response:', response);
      
      allValidators = allValidators.concat(response.validators);
      
      nextKey = response.pagination.next_key;
    } catch (error) {
      console.error('Error fetching validators:', error);
      throw error;
    }
  } while (nextKey);

  return allValidators;
};

// Fetch validator details using either the REST or RPC endpoint
export const fetchValidators = async (
  validatorAddress?: string,
  bondStatus?: BondStatus
): Promise<{ validators: ValidatorInfo[]; pagination: any }> => {
  try {
    if (validatorAddress) {
      let endpoint = `${CHAIN_ENDPOINTS.getValidators}${validatorAddress}`;
      console.log('Fetching validator info for:', validatorAddress);
      const response = await queryRestNode({ endpoint });
      console.log('Validator response:', response);
      
      // Filter single validator by bond status if provided
      if (bondStatus && response.validator.status !== bondStatus) {
        return { validators: [], pagination: null };
      }
      
      return {
        validators: [response.validator],
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
      error
    );
    throw error;
  }
};
