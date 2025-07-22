import { atom } from 'jotai';
import { DEFAULT_FEE_STATE, DEFAULT_FEE_TOKEN, TransactionStatus } from '@/constants';
import { CalculatedFeeDisplay, FeeState } from '@/types';
import { chainInfoAtom, selectedValidatorChainAtom } from './chainRegistryAtom';
import { getFeeTextClass } from '@/helpers';

export const validatorTransactionStateAtom = atom<{
  status: TransactionStatus;
  error?: string;
  txHash?: string;
  type?: 'stake' | 'unstake' | 'claim';
  claimToRestake?: boolean;
}>({
  status: TransactionStatus.IDLE,
});

export const validatorAmountAtom = atom(0);

// Derived atoms
export const isValidatorLoadingAtom = atom(
  get => get(validatorTransactionStateAtom).status === TransactionStatus.LOADING,
);

export const isValidatorSuccessAtom = atom(
  get => get(validatorTransactionStateAtom).status === TransactionStatus.SUCCESS,
);

export const validatorTxFailedAtom = atom(
  get => get(validatorTransactionStateAtom).status === TransactionStatus.ERROR,
);

export const validatorErrorAtom = atom(get => get(validatorTransactionStateAtom).error);

export const validatorTxHash = atom(get => get(validatorTransactionStateAtom).txHash || '');

export const _validatorFeeStateAtom = atom<FeeState>(DEFAULT_FEE_STATE);
export const validatorFeeStateAtom = atom<
  FeeState,
  [FeeState | ((prev: FeeState) => FeeState)],
  void
>(
  get => {
    // First get the current manually set state
    const currentState = get(_validatorFeeStateAtom);

    // If we have manually set values (non-zero), use those
    if (currentState.amount > 0 || currentState.gasWanted > 0) {
      return currentState;
    }

    // Otherwise compute default state
    const selectedChainId = get(selectedValidatorChainAtom);
    const chainId = get(selectedValidatorChainAtom);
    const chainInfo = get(chainInfoAtom);

    const chain = chainInfo(chainId);

    // Always reset when chain changes
    if (currentState.chainID !== selectedChainId) {
      const feeToken = chain?.fees?.[0] || DEFAULT_FEE_TOKEN;
      const asset = chain?.assets?.[feeToken.denom] || DEFAULT_FEE_STATE.asset;

      return {
        ...DEFAULT_FEE_STATE,
        chainID: selectedChainId,
        feeToken,
        asset,
      };
    }

    return currentState;
  },
  (get, set, update: FeeState | ((prev: FeeState) => FeeState)) => {
    const current = get(_validatorFeeStateAtom);
    const newValue = typeof update === 'function' ? update(current) : update;
    set(_validatorFeeStateAtom, newValue);
  },
);

export const validatorCalculatedFeeAtom = atom<CalculatedFeeDisplay>(get => {
  const feeState = get(validatorFeeStateAtom);
  console.log('[validatorCalculatedFeeAtom] Current fee state:', feeState);
  const chainId = get(selectedValidatorChainAtom);
  const chainInfo = get(chainInfoAtom);

  // Try to find asset by fee token denom first
  const chain = chainInfo(chainId);
  let asset = chain.assets?.[feeState.feeToken.denom];
  console.log('[validatorCalculatedFeeAtom] Found asset:', asset);

  // If not found, try staking denom as fallback
  if (!asset && chain.staking_denoms?.[0]) {
    asset = chain.assets?.[chain.staking_denoms[0]];
  }

  if (!asset) {
    console.log('[validatorCalculatedFeeAtom] No asset found, returning default');
    return {
      feeAmount: 0,
      feeUnit: '',
      textClass: 'text-blue',
      percentage: 0,
      calculatedFee: 0,
      gasWanted: 0,
      gasPrice: 0,
    };
  }

  const exponent = asset.exponent;
  const calculatedFee = feeState.amount / Math.pow(10, exponent);
  console.log('[validatorCalculatedFeeAtom] Calculated fee:', {
    exponent,
    calculatedFee,
    amount: feeState.amount,
  });

  return {
    feeAmount: feeState.amount,
    feeUnit: asset.symbol,
    // NOTE: Percentage not applicable here since we don't have amount context
    textClass: getFeeTextClass(0),
    percentage: 0,
    calculatedFee,
    gasWanted: feeState.gasWanted,
    gasPrice: feeState.gasPrice,
  };
});

export const resetValidatorTransactionAtom = atom(null, (get, set) => {
  const chainId = get(selectedValidatorChainAtom);
  const chainInfo = get(chainInfoAtom);
  const chain = chainInfo(chainId);

  // Get the default fee token for current chain
  const feeToken = chain?.fees?.[0] || DEFAULT_FEE_TOKEN;
  const asset = chain?.assets?.[feeToken.denom] || DEFAULT_FEE_STATE.asset;

  set(validatorTransactionStateAtom, {
    status: TransactionStatus.IDLE,
  });
  set(validatorAmountAtom, 0);
  set(_validatorFeeStateAtom, {
    ...get(_validatorFeeStateAtom),
    ...DEFAULT_FEE_STATE,
    chainID: chainId,
    feeToken,
    asset,
  });
});
