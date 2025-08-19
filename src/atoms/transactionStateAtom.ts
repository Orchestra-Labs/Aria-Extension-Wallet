import { atom, WritableAtom } from 'jotai';
import {
  DEFAULT_FEE_TOKEN,
  DEFAULT_FEE_STATE,
  DEFAULT_RECEIVE_STATE,
  DEFAULT_SEND_STATE,
  InputStatus,
  TransactionStatus,
} from '@/constants';
import {
  Asset,
  CalculatedFeeDisplay,
  FeeState,
  TransactionState,
  TransactionStatusState,
} from '@/types';
import { selectedAssetAtom } from './assetsAtom';
import { networkLevelAtom } from './networkLevelAtom';
import { subscribedChainRegistryAtom } from './chainRegistryAtom';
import { allWalletAssetsAtom } from './walletAtom';
import { getFeeTextClass } from '@/helpers';
import { transactionHasValidRouteAtom, transactionRouteAtom } from './transactionRouteAtom';

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
      const selectedAsset = get(selectedAssetAtom);

      // Only apply defaults if chainId matches default
      if (baseState.chainId === defaultState.chainId) {
        return {
          ...baseState, // Preserve any existing state
          asset: selectedAsset,
          chainId: selectedAsset.chainId,
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
const _sendStateAtom = atom<TransactionState>(DEFAULT_SEND_STATE);
const _receiveStateAtom = atom<TransactionState>(DEFAULT_RECEIVE_STATE);
export const _feeStateAtom = atom<FeeState>(DEFAULT_FEE_STATE);

// Public state atoms
export const sendStateAtom = createTransactionAtom(DEFAULT_SEND_STATE, _sendStateAtom);
export const receiveStateAtom = createTransactionAtom(DEFAULT_RECEIVE_STATE, _receiveStateAtom);

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

    const chainInfo = chainRegistry[networkLevel][selectedAsset.chainId];
    const feeToken =
      chainInfo?.fees?.find(
        fee => fee.denom === selectedAsset.originDenom || selectedAsset.denom,
      ) || chainInfo?.fees?.[0];

    return {
      ...currentState, // Preserve any other manually set fields
      asset: selectedAsset,
      amount: 0,
      chainId: selectedAsset.chainId,
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
  const transactionHasValidRoute = get(transactionHasValidRouteAtom);

  console.log('Send state:', sendState);
  console.log('Fee state:', feeState);
  console.log('Transaction type valid:', transactionHasValidRoute);

  const defaultReturn: CalculatedFeeDisplay = {
    feeAmount: 0,
    feeUnit: '',
    textClass: 'text-blue',
    percentage: 0,
    calculatedFee: 0,
    gasWanted: 0,
    gasPrice: 0,
  };

  if (!sendState.asset || !transactionHasValidRoute) {
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
    ...DEFAULT_SEND_STATE,
    asset: selectedAsset,
    chainId: selectedAsset.chainId,
  });

  set(_receiveStateAtom, {
    ...DEFAULT_RECEIVE_STATE,
    asset: selectedAsset,
    chainId: selectedAsset.chainId,
  });

  // Reset fee state
  set(_feeStateAtom, {
    ...get(feeStateAtom),
    ...DEFAULT_FEE_STATE,
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

  // Reset transaction route
  set(transactionRouteAtom, {
    steps: [],
    currentStep: 0,
    isComplete: false,
    isSimulation: true,
  });
});

export const maxAvailableAtom = atom(get => {
  const sendAsset = get(sendStateAtom).asset;
  const walletAssets = get(allWalletAssetsAtom);
  const feeState = get(feeStateAtom);

  if (!sendAsset) return 0;

  const walletAsset = walletAssets.find(
    (asset: Asset) => asset.originDenom || asset.denom === sendAsset.originDenom || sendAsset.denom,
  );
  if (!walletAsset) return 0;

  const maxAmount = parseFloat(walletAsset.amount || '0');
  const feeAmount = feeState.amount;

  return Math.max(0, maxAmount - feeAmount);
});

export const transactionStatusAtom = atom<TransactionStatusState>({
  status: TransactionStatus.IDLE,
});

export const isLoadingAtom = atom(
  get => get(transactionStatusAtom).status === TransactionStatus.PENDING,
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
export const isInvalidTransactionAtom = atom(get => get(transactionHasValidRouteAtom) !== true);
export const hasSendErrorAtom = atom(get => get(sendErrorAtom).message !== '');
export const hasReceiveErrorAtom = atom(get => get(receiveErrorAtom).message !== '');

export const lastSimulationUpdateAtom = atom<number>(0);
export const simulationBlockedAtom = atom<boolean>(false);
