import { atom, WritableAtom } from 'jotai';
import {
  DEFAULT_FEE_TOKEN,
  defaultFeeState,
  defaultReceiveState,
  defaultSendState,
  InputStatus,
  TransactionStatus,
} from '@/constants';
import { Asset, CalculatedFeeDisplay, FeeState, TransactionLog, TransactionState } from '@/types';
import { selectedAssetAtom } from './assetsAtom';
import { networkLevelAtom } from './networkLevelAtom';
import { subscribedChainRegistryAtom } from './chainRegistryAtom';
import { allWalletAssetsAtom } from './walletAtom';
import { transactionTypeAtom } from './transactionTypeAtom';

type TransactionStateAtom = WritableAtom<
  TransactionState,
  [TransactionState | ((prev: TransactionState) => TransactionState)],
  void
>;

const createTransactionAtom = (
  defaultState: TransactionState,
  storageAtom: WritableAtom<TransactionState, [TransactionState], void>,
) => {
  return atom(
    get => {
      const baseState = get(storageAtom);
      if (baseState.asset === defaultState.asset) {
        const selectedAsset = get(selectedAssetAtom);
        return {
          ...defaultState,
          asset: selectedAsset,
          chainID: selectedAsset.networkID,
        };
      }
      return baseState;
    },
    (get, set, update: TransactionState | ((prev: TransactionState) => TransactionState)) => {
      const current = get(storageAtom);
      const newValue = typeof update === 'function' ? update(current) : update;
      set(storageAtom, newValue);
    },
  ) as TransactionStateAtom;
};

// Base storage atoms
const _sendStateAtom = atom<TransactionState>(defaultSendState);
const _receiveStateAtom = atom<TransactionState>(defaultReceiveState);
const _feeStateAtom = atom<FeeState>(defaultFeeState);

// Public state atoms
export const sendStateAtom = createTransactionAtom(defaultSendState, _sendStateAtom);
export const receiveStateAtom = createTransactionAtom(defaultReceiveState, _receiveStateAtom);

export const feeStateAtom = atom<FeeState, [FeeState | ((prev: FeeState) => FeeState)], void>(
  get => {
    // First get the current manually set state
    const currentState = get(_feeStateAtom);

    // If we have manually set values (non-zero), use those
    if (currentState.amount > 0 || currentState.gasWanted > 0) {
      return currentState;
    }

    // Otherwise compute default state
    const selectedAsset = get(selectedAssetAtom);
    const networkLevel = get(networkLevelAtom);
    const chainRegistry = get(subscribedChainRegistryAtom);

    const chainInfo = chainRegistry[networkLevel][selectedAsset.networkID];
    const feeToken =
      chainInfo?.fees?.find(fee => fee.denom === selectedAsset.denom) || chainInfo?.fees?.[0];

    return {
      ...currentState, // Preserve any other manually set fields
      asset: selectedAsset,
      amount: 0,
      chainID: selectedAsset.networkID,
      feeToken: feeToken || DEFAULT_FEE_TOKEN,
      gasWanted: 0,
      gasPrice: 0,
    };
  },
  (get, set, update: FeeState | ((prev: FeeState) => FeeState)) => {
    const current = get(_feeStateAtom);
    const newValue = typeof update === 'function' ? update(current) : update;
    console.log('[feeStateAtom] Updating fee state:', {
      current: get(_feeStateAtom),
      newValue,
    });
    set(_feeStateAtom, newValue);
    console.log('[feeStateAtom] Updated fee state:', get(_feeStateAtom));
  },
);

export const calculatedFeeAtom = atom<CalculatedFeeDisplay>(get => {
  console.group('[calculatedFeeAtom] Recalculating fee display');
  const sendState = get(sendStateAtom);
  const feeState = get(feeStateAtom);
  const transactionType = get(transactionTypeAtom);

  console.log('Send state:', sendState);
  console.log('Fee state:', feeState);
  console.log('Transaction type valid:', transactionType.isValid);

  const defaultReturn: CalculatedFeeDisplay = {
    feeAmount: 0,
    feeUnit: '',
    textClass: 'text-blue',
    percentage: 0,
    calculatedFee: 0,
    gasWanted: 0,
    gasPrice: 0,
  };

  if (!sendState.asset || !transactionType.isValid) {
    console.log('Returning default - no asset or invalid transaction type');
    console.groupEnd();
    return defaultReturn;
  }

  const exponent = sendState.asset.exponent;
  const calculatedFee = feeState.amount / Math.pow(10, exponent);
  const percentage = sendState.amount > 0 ? (calculatedFee / sendState.amount) * 100 : 0;

  console.log('Calculated values:', {
    exponent,
    calculatedFee,
    percentage,
  });
  console.groupEnd();

  const getFeeTextClass = (percentage: number) => {
    if (percentage > 1) return 'text-error';
    if (percentage > 0.75) return 'text-warn';
    return 'text-blue';
  };

  return {
    ...defaultReturn,
    feeAmount: feeState.amount,
    feeUnit: sendState.asset.symbol,
    textClass: getFeeTextClass(percentage),
    percentage,
    calculatedFee,
    gasWanted: feeState.gasWanted,
    gasPrice: feeState.gasPrice,
  };
});

// Reset function
export const resetTransactionStatesAtom = atom(null, (get, set) => {
  const selectedAsset = get(selectedAssetAtom);

  // Reset main states
  set(_sendStateAtom, {
    ...defaultSendState,
    asset: selectedAsset,
    chainID: selectedAsset.networkID,
  });

  set(_receiveStateAtom, {
    ...defaultReceiveState,
    asset: selectedAsset,
    chainID: selectedAsset.networkID,
  });

  // Reset fee state
  set(_feeStateAtom, {
    ...get(feeStateAtom),
    ...defaultFeeState,
  });

  // Reset errors
  set(sendErrorAtom, {
    message: '',
    status: InputStatus.NEUTRAL,
  });

  set(receiveErrorAtom, {
    message: '',
    status: InputStatus.NEUTRAL,
  });

  // Reset transaction status
  set(transactionStatusAtom, {
    status: TransactionStatus.IDLE,
  });
});

export const maxAvailableAtom = atom(get => {
  const sendAsset = get(sendStateAtom).asset;
  const walletAssets = get(allWalletAssetsAtom);
  const feeState = get(feeStateAtom);

  if (!sendAsset) return 0;

  const walletAsset = walletAssets.find((asset: Asset) => asset.denom === sendAsset.denom);
  if (!walletAsset) return 0;

  const maxAmount = parseFloat(walletAsset.amount || '0');
  const feeAmount = feeState.amount;

  return Math.max(0, maxAmount - feeAmount);
});

export const transactionLogAtom = atom<TransactionLog>({
  isSimulation: false,
  entries: [],
});

export const transactionStatusAtom = atom<{
  status: TransactionStatus;
  error?: string;
  txHash?: string;
}>({
  status: TransactionStatus.IDLE,
});

export const isLoadingAtom = atom(
  get => get(transactionStatusAtom).status === TransactionStatus.LOADING,
);

export const isTransactionSuccessAtom = atom(
  get => get(transactionStatusAtom).status === TransactionStatus.SUCCESS,
);

export const transactionFailedAtom = atom(
  get => get(transactionStatusAtom).status === TransactionStatus.ERROR,
);

export const transactionErrorAtom = atom(get => get(transactionStatusAtom).error);

// In transactionStateAtom.ts
export const sendErrorAtom = atom<{
  message: string;
  status: InputStatus;
}>({
  message: '',
  status: InputStatus.NEUTRAL,
});

export const receiveErrorAtom = atom<{
  message: string;
  status: InputStatus;
}>({
  message: '',
  status: InputStatus.NEUTRAL,
});

// Add these derived atoms for convenience
export const isInvalidTransactionAtom = atom(get => get(transactionTypeAtom).isValid !== true);
export const hasSendErrorAtom = atom(get => get(sendErrorAtom).message !== '');
export const hasReceiveErrorAtom = atom(get => get(receiveErrorAtom).message !== '');

export const lastSimulationUpdateAtom = atom<number>(0);
export const simulationBlockedAtom = atom<boolean>(false);
