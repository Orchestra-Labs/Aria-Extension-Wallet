import { atom, WritableAtom } from 'jotai';
import {
  DEFAULT_FEE_STATE,
  DEFAULT_RECEIVE_STATE,
  DEFAULT_SEND_STATE,
  InputStatus,
  SIM_TX_FRESHNESS_TIMEOUT,
  TextClass,
  TransactionStatus,
} from '@/constants';
import { Asset, CalculatedFeeDisplay, FeeState, TransactionState } from '@/types';
import { selectedAssetAtom } from './assetsAtom';
import { allWalletAssetsAtom } from './walletAtom';
import {
  transactionHasValidRouteAtom,
  transactionRouteAtom,
  transactionRouteFailedAtom,
  transactionRouteHashAtom,
} from './transactionRouteAtom';
import { transactionLogsAtom } from './transactionLogsAtom';
import { addressVerifiedAtom, recipientAddressAtom } from './addressAtom';

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

// In transactionStateAtom.ts or a new feeAtoms.ts
export const derivedFeeStateAtom = atom<FeeState | null>(get => {
  const transactionRoute = get(transactionRouteAtom);
  const transactionLogs = get(transactionLogsAtom);

  if (transactionRoute.steps.length === 0) {
    return null;
  }

  // Get fee from the first step (starting asset)
  const firstStep = transactionRoute.steps[0];
  const firstStepLog = transactionLogs[firstStep.hash];

  if (!firstStepLog?.fee) {
    return null;
  }

  // Ensure feeToken is defined by providing a fallback
  const feeToken = firstStepLog.fee.feeToken;

  return {
    asset: firstStepLog.fee.asset,
    amount: firstStepLog.fee.amount,
    chainId: firstStepLog.fee.chainId,
    feeToken: feeToken,
    gasWanted: firstStepLog.fee.gasWanted || 0,
    gasPrice: firstStepLog.fee.gasPrice || 0,
  };
});

export const totalFeesAtom = atom(get => {
  const transactionRoute = get(transactionRouteAtom);
  const transactionLogs = get(transactionLogsAtom);
  const derivedFeeState = get(derivedFeeStateAtom);

  let totalFee = 0;
  let feeAsset: Asset | null = derivedFeeState?.asset || null;

  transactionRoute.steps.forEach(step => {
    const log = transactionLogs[step.hash];
    if (log?.fee) {
      // Only sum fees that use the same asset as the derived fee state
      if (feeAsset && log.fee.asset.denom === feeAsset.denom) {
        totalFee += log.fee.amount;
      }
    }
  });

  return { totalFee, feeAsset };
});

export const calculatedTotalFeeDisplayAtom = atom<CalculatedFeeDisplay>(get => {
  const sendState = get(sendStateAtom);
  const { totalFee, feeAsset } = get(totalFeesAtom);
  const transactionHasValidRoute = get(transactionHasValidRouteAtom);
  const derivedFeeState = get(derivedFeeStateAtom);

  const defaultReturn: CalculatedFeeDisplay = {
    feeAmount: 0,
    feeUnit: '',
    textClass: TextClass.GOOD,
    percentage: 0,
    calculatedFee: 0,
    gasWanted: 0,
    gasPrice: 0,
  };

  if (!sendState.asset || !transactionHasValidRoute || !feeAsset) {
    return defaultReturn;
  }

  const exponent = feeAsset.exponent;
  const calculatedFee = totalFee / Math.pow(10, exponent);
  const percentage = sendState.amount > 0 ? (calculatedFee / sendState.amount) * 100 : 0;

  return {
    feeAmount: totalFee,
    feeUnit: feeAsset.symbol,
    textClass: percentage > 0.1 ? TextClass.WARNING : TextClass.GOOD,
    percentage,
    calculatedFee,
    gasWanted: derivedFeeState?.gasWanted || 0,
    gasPrice: derivedFeeState?.gasPrice || 0,
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

  // Reset errors
  set(sendErrorAtom, {
    message: '',
    status: InputStatus.NEUTRAL,
  });

  set(receiveErrorAtom, {
    message: '',
    status: InputStatus.NEUTRAL,
  });

  // TODO: reset transaction logs here too
  // Reset transaction route
  set(transactionRouteAtom, {
    steps: [],
    currentStep: 0,
    isComplete: false,
    isSimulation: true,
  });

  set(transactionLogsAtom, {});
});

// TODO: consider later steps and the maximums inherent to those as well
export const maxAvailableAtom = atom(get => {
  const sendAsset = get(sendStateAtom).asset;
  const walletAssets = get(allWalletAssetsAtom);
  const derivedFeeState = get(derivedFeeStateAtom);

  if (!sendAsset) return 0;

  const walletAsset = walletAssets.find(
    (asset: Asset) => asset.originDenom || asset.denom === sendAsset.originDenom || sendAsset.denom,
  );
  if (!walletAsset) return 0;

  const maxAmount = parseFloat(walletAsset.amount || '0');
  const feeAmount = derivedFeeState?.amount || 0;

  return Math.max(0, maxAmount - feeAmount);
});

export const isTxPendingAtom = atom(get => {
  const route = get(transactionRouteAtom);
  const logs = get(transactionLogsAtom);

  // Check if any step is in progress
  return route.steps.some(step => {
    const log = logs[step.hash];
    return log?.status === TransactionStatus.PENDING;
  });
});

export const isTransactionSuccessAtom = atom(get => {
  const route = get(transactionRouteAtom);
  return route.isComplete;
});

export const transactionFailedAtom = atom(get => {
  return get(transactionRouteFailedAtom);
});

export const transactionErrorAtom = atom(get => {
  const route = get(transactionRouteAtom);
  const logs = get(transactionLogsAtom);

  // Find the first error message from any failed step
  for (const step of route.steps) {
    const log = logs[step.hash];
    if (log?.status === TransactionStatus.ERROR && log.error) {
      return log.error;
    }
  }

  return undefined;
});

export const finalTransactionHashAtom = atom(get => {
  const route = get(transactionRouteAtom);
  const logs = get(transactionLogsAtom);

  // If the route is complete, get the hash from the last step
  if (route.isComplete && route.steps.length > 0) {
    const lastStep = route.steps[route.steps.length - 1];
    const lastStepLog = logs[lastStep.hash];

    return lastStepLog?.txHash;
  }

  // If it's a simulation or not complete, return undefined
  return undefined;
});

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

export const simulationInvalidationAtom = atom({
  lastRunTimestamp: 0,
  routeHash: '',
  shouldInvalidate: false,
});

export const invalidateSimulationAtom = atom(null, (get, set) => {
  const currentRouteHash = get(transactionRouteHashAtom);
  set(simulationInvalidationAtom, {
    lastRunTimestamp: 0,
    routeHash: currentRouteHash,
    shouldInvalidate: true,
  });
});

export const canRunSimulationAtom = atom(get => {
  const sendState = get(sendStateAtom);
  const maxAvailable = get(maxAvailableAtom);
  const recipientAddress = get(recipientAddressAtom);
  const addressVerified = get(addressVerifiedAtom);
  const transactionHasValidRoute = get(transactionHasValidRouteAtom);
  const isTxPending = get(isTxPendingAtom);
  const transactionError = get(transactionErrorAtom);
  const simulationInvalidation = get(simulationInvalidationAtom);
  const transactionRouteHash = get(transactionRouteHashAtom);
  const isTxSuccess = get(isTransactionSuccessAtom);

  const hasValidAmount =
    !isNaN(sendState.amount) && sendState.amount > 0 && sendState.amount <= maxAvailable;

  const needsInvalidation =
    simulationInvalidation.shouldInvalidate ||
    simulationInvalidation.routeHash !== transactionRouteHash ||
    Date.now() - simulationInvalidation.lastRunTimestamp > SIM_TX_FRESHNESS_TIMEOUT;

  const canRun =
    recipientAddress &&
    addressVerified &&
    hasValidAmount &&
    transactionHasValidRoute &&
    !isTxPending &&
    !transactionError &&
    (needsInvalidation || !isTxSuccess);

  console.log('[canRunSimulationAtom] Evaluation:', {
    recipientAddress: !!recipientAddress,
    addressVerified,
    hasValidAmount,
    transactionHasValidRoute,
    isTxPending,
    transactionError: !!transactionError,
    needsInvalidation,
    result: canRun,
  });

  return canRun;
});
