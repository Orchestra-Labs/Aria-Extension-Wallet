import { atom, WritableAtom } from 'jotai';
import {
  DEFAULT_FEE_STATE,
  DEFAULT_FEE_TOKEN,
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
import { resetTransactionLogsAtom, transactionLogsAtom } from './transactionLogsAtom';
import { addressVerifiedAtom, recipientAddressAtom } from './addressAtom';

type TransactionStateAtom = WritableAtom<
  TransactionState,
  [TransactionState | ((prev: TransactionState) => TransactionState)],
  void
>;

// Base storage atoms
const _sendStateAtom = atom<TransactionState>(DEFAULT_SEND_STATE);
const _receiveStateAtom = atom<TransactionState>(DEFAULT_RECEIVE_STATE);
export const _feeStateAtom = atom<FeeState>(DEFAULT_FEE_STATE);

// Public state atoms
export const sendStateAtom = atom(
  get => {
    return get(_sendStateAtom);
  },
  (get, set, update: TransactionState | ((prev: TransactionState) => TransactionState)) => {
    const current = get(_sendStateAtom);
    const newValue = typeof update === 'function' ? update(current) : update;
    set(_sendStateAtom, newValue);
  },
) as TransactionStateAtom;

export const receiveStateAtom = atom(
  get => {
    return get(_receiveStateAtom);
  },
  (get, set, update: TransactionState | ((prev: TransactionState) => TransactionState)) => {
    const current = get(_receiveStateAtom);
    const newValue = typeof update === 'function' ? update(current) : update;
    set(_receiveStateAtom, newValue);
  },
) as TransactionStateAtom;

export const updateSendAssetAndChainAtom = atom(null, (_, set, asset: Asset) => {
  set(_sendStateAtom, prev => ({
    ...prev,
    asset: asset,
    chainId: asset.chainId,
  }));
});

export const resetReceiveChainAtom = atom(null, (get, set) => {
  const selectedAsset = get(selectedAssetAtom);
  set(_receiveStateAtom, prev => ({
    ...prev,
    chainId: selectedAsset.chainId,
  }));
});

export const updateReceiveChainAtom = atom(null, (_, set, newChainId: string) => {
  set(_receiveStateAtom, prev => ({
    ...prev,
    chainId: newChainId,
  }));
});

export const updateReceiveAssetAndChainAtom = atom(null, (_, set, asset: Asset) => {
  set(_receiveStateAtom, prev => ({
    ...prev,
    asset: asset,
    chainId: asset.chainId,
  }));
});

export const updateReceiveStateAtom = atom(
  null,
  (get, set, update: TransactionState | ((prev: TransactionState) => TransactionState)) => {
    const current = get(_receiveStateAtom);
    const newValue = typeof update === 'function' ? update(current) : update;
    set(_receiveStateAtom, newValue);
  },
);

export const derivedFeeStateAtom = atom<FeeState | null>(get => {
  const transactionRoute = get(transactionRouteAtom);
  const transactionLogs = get(transactionLogsAtom);

  if (transactionRoute.steps.length === 0) {
    return null;
  }

  // Get fee from the first step (starting asset)
  const firstStep = transactionRoute.steps[0];
  const firstStepLog = transactionLogs[firstStep.hash];

  if (!firstStepLog?.fees || firstStepLog.fees.length === 0) {
    return null;
  }

  const originalFeeToken = firstStepLog.fees[0];

  if (!originalFeeToken || typeof originalFeeToken !== 'object') {
    return null;
  }

  const feeToken = originalFeeToken.feeToken || DEFAULT_FEE_TOKEN;
  const asset = originalFeeToken.asset || firstStep.fromAsset;
  const amount = originalFeeToken.amount || 0;
  const chainId = originalFeeToken.chainId || firstStep.fromChain;
  const gasWanted = originalFeeToken.gasWanted || 0;
  const gasPrice = originalFeeToken.gasPrice || 0;

  const result = {
    asset,
    amount,
    chainId,
    feeToken,
    gasWanted,
    gasPrice,
  };

  return result;
});

export const totalFeesAtom = atom(get => {
  const transactionRoute = get(transactionRouteAtom);
  const transactionLogs = get(transactionLogsAtom);
  const derivedFeeState = get(derivedFeeStateAtom);

  if (!derivedFeeState || !derivedFeeState.asset) {
    return { totalFee: 0, feeAsset: null };
  }

  let totalFee = 0;
  let feeAsset: Asset | null = derivedFeeState?.asset || null;
  transactionRoute.steps.forEach((step, _) => {
    const log = transactionLogs[step.hash];

    if (log?.fees) {
      const feesArray = Array.isArray(log.fees) ? log.fees : [log.fees];

      feesArray.forEach((fee, _) => {
        if (!fee.asset || typeof fee.asset !== 'object') {
          return;
        }

        // Only sum fees that use the same asset as the derived fee state
        if (feeAsset && fee.asset.originDenom === feeAsset.originDenom) {
          totalFee += fee.amount;
        }
      });
    }
  });

  const result = { totalFee, feeAsset };
  return result;
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

  const result = {
    feeAmount: totalFee,
    feeUnit: feeAsset.symbol,
    textClass: percentage > 0.1 ? TextClass.WARNING : TextClass.GOOD,
    percentage,
    calculatedFee,
    gasWanted: derivedFeeState?.gasWanted || 0,
    gasPrice: derivedFeeState?.gasPrice || 0,
  };

  return result;
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

  // Reset transaction logs
  set(resetTransactionLogsAtom);

  // Reset transaction route
  set(transactionRouteAtom, {
    steps: [],
    currentStep: 0,
    isComplete: false,
    isSimulation: true,
  });

  // Reset route hash
  set(transactionRouteHashAtom, '');
  set(successfulSimTxRouteHashAtom, '');

  // Reset simulation invalidation
  set(simulationInvalidationAtom, {
    lastRunTimestamp: 0,
    routeHash: '',
    shouldInvalidate: false,
  });

  // Reset fee state
  set(_feeStateAtom, DEFAULT_FEE_STATE);
});

export const maxAvailableAtom = atom(get => {
  const sendAsset = get(sendStateAtom).asset;
  const walletAssets = get(allWalletAssetsAtom);
  const derivedFeeState = get(derivedFeeStateAtom);

  if (!sendAsset) return 0;

  // Comprehensive asset matching: match on denom, originDenom, chainId, and originChainId
  const walletAsset = walletAssets.find((asset: Asset) => {
    // Check all four properties match exactly
    const denomMatch = asset.denom === sendAsset.denom;
    const originDenomMatch = asset.originDenom === sendAsset.originDenom;
    const chainIdMatch = asset.chainId === sendAsset.chainId;
    const originChainIdMatch = asset.originChainId === sendAsset.originChainId;

    const isMatch = denomMatch && originDenomMatch && chainIdMatch && originChainIdMatch;

    return isMatch;
  });

  if (!walletAsset) {
    console.error('[DEBUG] No matching wallet asset found with comprehensive matching');
    return 0;
  }

  const maxAmount = parseFloat(walletAsset.amount || '0');
  const feeAmount = derivedFeeState?.amount || 0;

  return Math.max(0, maxAmount - feeAmount);
});

// TODO: group in with maxAvailableAtom as dictionary return
export const maxAvailableDisplayAtom = atom(get => {
  const sendAsset = get(sendStateAtom).asset;
  const maxAmount = get(maxAvailableAtom);

  return maxAmount / Math.pow(10, sendAsset.exponent);
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

export const isSimulationRunningAtom = atom(get => {
  const route = get(transactionRouteAtom);
  const logs = get(transactionLogsAtom);

  // If no steps, simulation is not running
  if (route.steps.length === 0) {
    return false;
  }

  const isSimulationRunning = route.steps.some(step => {
    const log = logs[step.hash];
    const status = log?.status;
    return status === TransactionStatus.PENDING;
  });

  return isSimulationRunning;
});

export const successfulSimTxRouteHashAtom = atom<string>('');

export const isTxRunningAtom = atom(false);
export const canRunTransactionAtom = atom(get => {
  const txHasError = get(hasSendErrorAtom);
  const currentTxRouteHash = get(transactionRouteHashAtom);
  const lastSuccessfulSimTxRouteHash = get(successfulSimTxRouteHashAtom);
  const sendState = get(sendStateAtom);
  const hasValidTxRoute = get(transactionHasValidRouteAtom);
  const isTxRunning = get(isTxRunningAtom);

  const hasSuccessfulSimulation = lastSuccessfulSimTxRouteHash === currentTxRouteHash;
  const hasNonZeroSendAmount = sendState.amount > 0;

  const txIsEnabled =
    hasSuccessfulSimulation && !txHasError && hasNonZeroSendAmount && hasValidTxRoute;

  return txIsEnabled && !isTxRunning;
});

export const canRunSimulationAtom = atom(get => {
  const sendState = get(sendStateAtom);
  const maxAvailable = get(maxAvailableAtom);
  const recipientAddress = get(recipientAddressAtom);
  const addressVerified = get(addressVerifiedAtom);
  const hasValidTxRoute = get(transactionHasValidRouteAtom);
  const isSimulationRunning = get(isSimulationRunningAtom);
  const transactionError = get(transactionErrorAtom);
  const simulationInvalidation = get(simulationInvalidationAtom);
  const transactionRouteHash = get(transactionRouteHashAtom);
  const isTxSuccess = get(isTransactionSuccessAtom);
  const isTxRunning = get(isTxRunningAtom);

  const hasNonZeroAmount = sendState.amount > 0 && sendState.displayAmount > 0;
  const hasValidAmount =
    !isNaN(sendState.amount) && hasNonZeroAmount && sendState.amount <= maxAvailable;

  const needsInvalidation =
    simulationInvalidation.shouldInvalidate ||
    simulationInvalidation.routeHash !== transactionRouteHash ||
    Date.now() - simulationInvalidation.lastRunTimestamp > SIM_TX_FRESHNESS_TIMEOUT;

  const hasAllFields = recipientAddress && addressVerified && hasValidAmount;

  const simIsEnabled =
    hasAllFields &&
    hasValidTxRoute &&
    !transactionError &&
    (needsInvalidation || !isTxSuccess) &&
    !isTxRunning;

  const canRun = simIsEnabled && !isSimulationRunning;

  return canRun;
});
