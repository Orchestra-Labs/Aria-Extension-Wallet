import { atom } from 'jotai';
import { TransactionStatus } from '@/constants';
import { chainWalletAtom, selectedValidatorChainAtom, chainInfoAtom } from '@/atoms';
import { validatorFeeStateAtom, validatorTransactionStateAtom } from './validatorStateAtom';
import { FullValidatorInfo } from '@/types';
import { claimAndRestake, claimAndUnstake, claimRewards, stakeToValidator } from '@/helpers';

// TODO: may not need this pass-through file
export const executeStakeAtom = atom(
  null,
  async (
    get,
    set,
    {
      amount,
      denom,
      validatorAddress,
      simulate,
    }: {
      amount: string;
      denom: string;
      validatorAddress: string;
      simulate: boolean;
    },
  ) => {
    const getChainInfo = get(chainInfoAtom);

    const chainId = get(selectedValidatorChainAtom);
    const walletState = get(chainWalletAtom(chainId));
    const feeState = get(validatorFeeStateAtom);
    const chain = getChainInfo(chainId);

    try {
      if (!simulate) {
        set(validatorTransactionStateAtom, {
          status: TransactionStatus.LOADING,
        });
      }

      const result = await stakeToValidator(
        amount,
        denom,
        walletState.address,
        validatorAddress,
        chain,
        feeState.feeToken,
        simulate,
      );

      if (result.success) {
        if (!simulate) {
          set(validatorTransactionStateAtom, {
            status: TransactionStatus.SUCCESS,
            txHash: result.data?.txHash,
          });
        }
        return result;
      } else {
        throw new Error(result.message || 'Stake failed');
      }
    } catch (error) {
      set(validatorTransactionStateAtom, {
        status: TransactionStatus.ERROR,
        error: error instanceof Error ? error.message : 'Stake failed',
      });
      throw error;
    }
  },
);

export const executeUnstakeAtom = atom(
  null,
  async (
    get,
    set,
    {
      amount = undefined,
      validatorInfoArray,
      simulate,
    }: {
      amount?: string;
      validatorInfoArray: FullValidatorInfo[];
      simulate: boolean;
    },
  ) => {
    const getChainInfo = get(chainInfoAtom);
    const chainId = get(selectedValidatorChainAtom);
    const feeState = get(validatorFeeStateAtom);
    const chain = getChainInfo(chainId);

    try {
      if (!simulate) {
        set(validatorTransactionStateAtom, {
          status: TransactionStatus.LOADING,
        });
      }

      const result = await claimAndUnstake({
        chain,
        amount,
        validatorInfoArray,
        feeToken: feeState.feeToken,
        simulateOnly: simulate,
      });

      if (result.success) {
        if (!simulate) {
          set(validatorTransactionStateAtom, {
            status: TransactionStatus.SUCCESS,
            txHash: result.data?.txHash,
          });
        }
        return result;
      } else {
        throw new Error(result.message || 'Unstake failed');
      }
    } catch (error) {
      set(validatorTransactionStateAtom, {
        status: TransactionStatus.ERROR,
        error: error instanceof Error ? error.message : 'Unstake failed',
      });
      throw error;
    }
  },
);

export const executeClaimAtom = atom(
  null,
  async (
    get,
    set,
    {
      validatorInfoArray = [],
      isToRestake,
      simulate,
    }: {
      validatorInfoArray?: FullValidatorInfo[];
      isToRestake: boolean;
      simulate: boolean;
    },
  ) => {
    const getChainInfo = get(chainInfoAtom);
    const chainId = get(selectedValidatorChainAtom);
    const feeState = get(validatorFeeStateAtom);
    const chain = getChainInfo(chainId);

    try {
      if (!simulate) {
        set(validatorTransactionStateAtom, {
          status: TransactionStatus.LOADING,
        });
      }

      let result;
      if (isToRestake) {
        result = await claimAndRestake(chain, validatorInfoArray, feeState.feeToken, simulate);
      } else {
        result = await claimRewards(chain, validatorInfoArray, feeState.feeToken, simulate);
      }

      if (result.success) {
        if (!simulate) {
          set(validatorTransactionStateAtom, {
            status: TransactionStatus.SUCCESS,
            txHash: result.data?.txHash,
          });
        }
        return result;
      } else {
        throw new Error(result.message || 'Claim failed');
      }
    } catch (error) {
      set(validatorTransactionStateAtom, {
        status: TransactionStatus.ERROR,
        error: error instanceof Error ? error.message : 'Claim failed',
      });
      throw error;
    }
  },
);
