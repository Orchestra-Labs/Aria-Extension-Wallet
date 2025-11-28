import { atom } from 'jotai';
import { TransactionType, TransactionStatus, TransferMethod } from '@/constants';
import { TransactionRoute, TransactionStep, Asset, FeeState } from '@/types';
import { fullRegistryChainInfoAtom, isOsmosisSupportedDenomAtom } from './chainRegistryAtom';
import {
  createRouteHash,
  createStepHash,
  getOsmosisChainId,
  getStepDescription,
  getValidIBCChannel,
} from '@/helpers';
import {
  successfulSimTxRouteHashAtom,
  receiveStateAtom,
  sendStateAtom,
  simulationInvalidationAtom,
} from './transactionStateAtom';
import { recipientAddressAtom } from './addressAtom';
import {
  createStepLogAtom,
  resetTransactionLogsAtom,
  transactionLogsAtom,
  updateStepLogAtom,
} from './transactionLogsAtom';
import { isValidStablecoinSwapAtom } from './symphonyStablecoinsAtom';
import { chainWalletAtom } from './walletAtom';
import { networkLevelAtom } from './networkLevelAtom';

export const transactionRouteHashAtom = atom<string>('');
export const transactionRouteAtom = atom<TransactionRoute>({
  steps: [],
  currentStep: 0,
  isComplete: false,
  isSimulation: true,
});

export const transactionRouteFailedAtom = atom(get => {
  const route = get(transactionRouteAtom);
  const logs = get(transactionLogsAtom);

  return route.steps.some(step => {
    const log = logs[step.hash];
    return log?.status === TransactionStatus.ERROR;
  });
});

export const resetTransactionRouteAtom = atom(null, (_, set) => {
  console.log('[resetTransactionRouteAtom] Resetting transaction route');
  set(transactionRouteAtom, {
    steps: [],
    currentStep: 0,
    isComplete: false,
    isSimulation: true,
  });
  set(transactionRouteHashAtom, '');
  set(resetTransactionLogsAtom);
  set(simulationInvalidationAtom, {
    lastRunTimestamp: 0,
    routeHash: '',
    shouldInvalidate: false,
  });
});

export const finalOutputAmountAtom = atom(get => {
  const route = get(transactionRouteAtom);
  const logs = get(transactionLogsAtom);

  const routeFinalIndex = route.steps.length - 1;
  const finalStepLog = logs[route.steps[routeFinalIndex].hash];
  const estimatedAmountOut = finalStepLog.outputAmount;

  return finalStepLog.status === TransactionStatus.SUCCESS ? estimatedAmountOut : null;
});

export const transactionRouteExchangeRateAtom = atom(get => {
  const transactionRoute = get(transactionRouteAtom);
  const transactionLogs = get(transactionLogsAtom);

  let overallExchangeRate = 1;

  // Multiply exchange rates from all steps that have them
  transactionRoute.steps.forEach(step => {
    const stepLog = transactionLogs[step.hash];
    if (stepLog?.exchangeRate && stepLog.exchangeRate !== 1) {
      overallExchangeRate *= stepLog.exchangeRate;
    }
  });

  return overallExchangeRate;
});

export const transactionHasValidRouteAtom = atom<boolean>(get => {
  const route = get(transactionRouteAtom);
  const isValid = route.steps.length > 0;

  console.log('[transactionHasValidRouteAtom] Checking route validity:', {
    steps: route.steps,
    stepsLength: route.steps.length,
    isValid,
    routeDetails: route.steps.map(step => ({
      type: step.type,
      fromChain: step.fromChain,
      toChain: step.toChain,
      fromAsset: step.fromAsset.symbol,
      toAsset: step.toAsset.symbol,
    })),
  });

  return isValid;
});

export const updateTxStepLogAtom = atom(
  null,
  (
    get,
    set,
    params: {
      stepIndex: number;
      status: TransactionStatus;
      txHash?: string;
      error?: string;
      feeData?: FeeState[];
    },
  ) => {
    const currentRoute = get(transactionRouteAtom);
    if (params.stepIndex >= currentRoute.steps.length) {
      console.error('[updateRouteStepStatusAtom] Step index out of bounds:', {
        stepIndex: params.stepIndex,
        totalSteps: currentRoute.steps.length,
        steps: currentRoute.steps.map((s, idx) => ({ index: idx, type: s.type })),
      });
      return;
    }

    const step = currentRoute.steps[params.stepIndex];
    if (!step) {
      console.error('[updateRouteStepStatusAtom] Step not found:', params.stepIndex);
      return;
    }

    const currentLogs = get(transactionLogsAtom);
    const existingLog = currentLogs[step.hash] || {};

    console.log('[DEBUG][updateTxStepLogAtom] Updating step log', {
      stepIndex: params.stepIndex,
      stepHash: step.hash,
      newStatus: params.status,
      existingFees: existingLog.fees?.map(f => ({ amount: f.amount, denom: f.asset?.denom })) || [],
      newFeeData: params.feeData?.map(f => ({ amount: f.amount, denom: f.asset?.denom })) || [],
    });

    // Preserve existing fee data unless new fee data is explicitly provided
    const finalFeeData = params.feeData !== undefined ? params.feeData : existingLog.fees;

    set(updateStepLogAtom, {
      stepHash: step.hash,
      log: {
        status: params.status,
        ...(params.txHash !== undefined && { txHash: params.txHash }),
        ...(params.error !== undefined && { error: params.error }),
      },
      feeData: finalFeeData,
    });

    set(transactionRouteAtom, {
      ...currentRoute,
      currentStep:
        params.status === TransactionStatus.SUCCESS
          ? params.stepIndex + 1
          : currentRoute.currentStep,
      isComplete:
        params.status === TransactionStatus.SUCCESS &&
        params.stepIndex === currentRoute.steps.length - 1,
    });
  },
);

// TODO: add optional index.  if index is provided only that step updates to idle
export const resetRouteStatusAtom = atom(null, (get, set, isSimulation: boolean = false) => {
  const route = get(transactionRouteAtom);
  const logs = get(transactionLogsAtom);

  // Reset all step statuses to IDLE
  route.steps.forEach(step => {
    const existingLog = logs[step.hash] || {};

    set(updateStepLogAtom, {
      stepHash: step.hash,
      log: {
        ...existingLog,
        status: TransactionStatus.IDLE,
        error: undefined,
        txHash: undefined,
      },
      feeData: existingLog.fees,
    });
  });

  set(transactionRouteAtom, {
    ...route,
    currentStep: 0,
    isComplete: false,
    isSimulation: isSimulation,
  });
});

// TODO: add from and to chains to step information to make useSendActions more consistent
export const updateTransactionRouteAtom = atom(null, async (get, set) => {
  const networkLevel = get(networkLevelAtom);
  const sendState = get(sendStateAtom);
  const receiveState = get(receiveStateAtom);
  const walletAddress = get(chainWalletAtom(sendState.chainId)).address;

  if (!sendState.asset || !receiveState.asset || !walletAddress) {
    console.error('[updateTransactionRouteAtom] Missing assets');
    return;
  }

  const getChainInfo = get(fullRegistryChainInfoAtom);
  const receiveAddress = get(recipientAddressAtom);
  // const skipChains = get(skipChainsAtom);
  // const skipAssets = get(skipAssetsAtom);
  const isValidStablecoinSwap = get(isValidStablecoinSwapAtom);
  const isOsmosisSupportedDenom = get(isOsmosisSupportedDenomAtom);

  const steps: TransactionStep[] = [];
  const sendChain = getChainInfo(sendState.chainId);
  const receiveChain = getChainInfo(receiveState.chainId);
  const restUris = sendChain?.rest_uris;

  if (!sendChain || !receiveChain) {
    console.error('[updateTransactionRouteAtom] Missing chain info');
    return;
  }

  // Check denom support
  const isSendDenomSupported = isOsmosisSupportedDenom(sendState.asset.originDenom);
  const isReceiveDenomSupported = isOsmosisSupportedDenom(receiveState.asset.originDenom);
  const coinExchangeIsSupported = isSendDenomSupported && isReceiveDenomSupported;

  const sendAndReceiveAssetsMatch = sendState.asset.originDenom === receiveState.asset.originDenom;
  const sendAndReceiveChainsMatch = sendState.chainId === receiveState.chainId;

  // Check if this is a simple send (same asset on same chain)
  const isSimpleSend = sendAndReceiveChainsMatch && sendAndReceiveAssetsMatch;

  console.log('[DEBUG][updateTransactionRouteAtom] Route matching conditions:', {
    // Basic conditions
    sendAndReceiveChainsMatch,
    sendAndReceiveAssetsMatch,
    isSimpleSend,

    // Asset support conditions
    isSendDenomSupported,
    isReceiveDenomSupported,
    coinExchangeIsSupported,

    // Special cases
    isValidStablecoinSwap,

    // Asset details
    sendAsset: {
      symbol: sendState.asset.symbol,
      originDenom: sendState.asset.originDenom,
      originChainId: sendState.asset.originChainId,
      currentChainId: sendState.chainId,
    },
    receiveAsset: {
      symbol: receiveState.asset.symbol,
      originDenom: receiveState.asset.originDenom,
      originChainId: receiveState.asset.originChainId,
      currentChainId: receiveState.chainId,
    },

    // Chain details
    sendChainId: sendState.chainId,
    receiveChainId: receiveState.chainId,
  });

  // Helper function to create a transaction step (without log)
  const createStep = (
    type: TransactionType,
    via: 'skip' | 'standard',
    fromChain: string,
    toChain: string,
    fromAsset: Asset,
    toAsset: Asset,
  ): TransactionStep => {
    const step = {
      type,
      via,
      fromChain,
      toChain,
      fromAsset,
      toAsset,
      hash: '',
    };

    return {
      ...step,
      hash: createStepHash(step),
    };
  };

  // Create steps and logs separately
  const createAndDescribeStep = ({
    type,
    via,
    fromChainId,
    toChainId,
    fromAsset,
    toAsset,
  }: {
    type: TransactionType;
    via: TransferMethod;
    fromChainId: string;
    toChainId: string;
    fromAsset: Asset;
    toAsset: Asset;
    isFirstStep: boolean;
  }): TransactionStep => {
    const fromChain = getChainInfo(fromChainId);
    const toChain = getChainInfo(toChainId);

    if (!fromChain || !toChain) {
      console.error('[createAndDescribeStep] Missing chain info:', {
        fromChainId,
        toChainId,
        fromChainExists: !!fromChain,
        toChainExists: !!toChain,
      });
      throw new Error(`Missing chain info for ${fromChainId} or ${toChainId}`);
    }

    const step = createStep(type, via, fromChainId, toChainId, fromAsset, toAsset);
    // TODO: this can be moved into transactionLogAtom if toAddress is included on the TransactionStep object
    const description = getStepDescription({
      step,
      toAddress: receiveAddress,
      sendChainInfo: fromChain,
      receiveChainInfo: toChain,
    });

    set(createStepLogAtom, {
      step,
      description,
      initialAmounts: {
        inputAmount: sendState.amount.toString(),
        outputAmount: '0', // Will be updated after execution
      },
    });

    return step;
  };

  // Case 1: Simple send (same asset, same chain)
  if (isSimpleSend) {
    console.log('[updateTransactionRouteAtom] Creating simple send route');
    steps.push(
      createAndDescribeStep({
        type: TransactionType.SEND,
        via: TransferMethod.STANDARD,
        fromChainId: sendState.chainId,
        toChainId: receiveState.chainId,
        fromAsset: sendState.asset,
        toAsset: receiveState.asset,
        isFirstStep: true,
      }),
    );
  }
  // Case 2: Local swap (different assets, same chain, Symphony stablecoins)
  else if (isValidStablecoinSwap && sendAndReceiveChainsMatch) {
    console.log('[updateTransactionRouteAtom] Creating local swap route');
    steps.push(
      createAndDescribeStep({
        type: TransactionType.SWAP,
        via: TransferMethod.STANDARD,
        fromChainId: sendState.chainId,
        toChainId: receiveState.chainId,
        fromAsset: sendState.asset,
        toAsset: receiveState.asset,
        isFirstStep: true,
      }),
    );
  }
  // Case 3: IBC transfer (same asset, different chains)
  else if (!sendAndReceiveChainsMatch && sendAndReceiveAssetsMatch) {
    console.log('[updateTransactionRouteAtom] Checking IBC channel');
    const isValidIbcTx = await getValidIBCChannel({
      sendChain,
      receiveChainId: receiveState.chainId,
      networkLevel: sendChain.network_level,
      prefix: sendChain.bech32_prefix,
      restUris,
    });

    if (isValidIbcTx) {
      steps.push(
        createAndDescribeStep({
          type: TransactionType.IBC_SEND,
          via: TransferMethod.STANDARD,
          fromChainId: sendState.chainId,
          toChainId: receiveState.chainId,
          fromAsset: sendState.asset,
          toAsset: receiveState.asset,
          isFirstStep: true,
        }),
      );
    }
  }
  // Case 4: Exchange on Osmosis
  else if (!sendAndReceiveAssetsMatch && coinExchangeIsSupported) {
    const osmosisChainId = getOsmosisChainId(networkLevel);

    const isSendChainOsmosis = sendState.chainId === osmosisChainId;
    const receiveChainIsNotOsmosis = receiveState.chainId !== osmosisChainId;

    // Check if assets are on their native chains
    const isSendAssetOnNativeChain = sendState.chainId === sendState.asset.originChainId;
    const destinationIsNotNativeChain = receiveState.chainId !== receiveState.asset.originChainId;

    const needsBridgeToOsmosis = !isSendChainOsmosis && isSendDenomSupported;
    const needsBridgeFromOsmosis = receiveChainIsNotOsmosis;

    // Create Osmosis versions of the assets
    const osmosisSendAsset = {
      ...sendState.asset,
      denom: sendState.asset.originDenom,
      chainId: osmosisChainId,
    };

    const osmosisReceiveAsset = {
      ...receiveState.asset,
      denom: receiveState.asset.originDenom,
      chainId: osmosisChainId,
    };

    // Step 0: If send asset is not on native chain and not on Osmosis, bridge to native chain first
    if (!isSendAssetOnNativeChain && !isSendChainOsmosis && isSendDenomSupported) {
      const nativeSendAsset = {
        ...sendState.asset,
        denom: sendState.asset.originDenom,
        chainId: sendState.asset.originChainId,
      };

      steps.push(
        createAndDescribeStep({
          type: TransactionType.IBC_SEND,
          via: TransferMethod.STANDARD,
          fromChainId: sendState.chainId,
          toChainId: sendState.asset.originChainId,
          fromAsset: sendState.asset,
          toAsset: nativeSendAsset,
          isFirstStep: true,
        }),
      );
    }

    // Step 1: Bridge to Osmosis (if needed)
    if (needsBridgeToOsmosis) {
      const fromChainId = isSendAssetOnNativeChain
        ? sendState.asset.originChainId
        : sendState.chainId;
      const fromAsset = isSendAssetOnNativeChain
        ? {
            ...sendState.asset,
            denom: sendState.asset.originDenom,
            chainId: sendState.asset.originChainId,
          }
        : sendState.asset;

      steps.push(
        createAndDescribeStep({
          type: TransactionType.IBC_SEND,
          via: TransferMethod.STANDARD,
          fromChainId,
          toChainId: osmosisChainId,
          fromAsset,
          toAsset: osmosisSendAsset,
          isFirstStep: steps.length === 0, // Only first step if no previous steps
        }),
      );
    }

    // Step 2: Exchange on Osmosis
    steps.push(
      createAndDescribeStep({
        type: TransactionType.EXCHANGE,
        via: TransferMethod.STANDARD,
        fromChainId: osmosisChainId,
        toChainId: osmosisChainId,
        fromAsset: needsBridgeToOsmosis
          ? osmosisSendAsset
          : isSendAssetOnNativeChain
            ? {
                ...sendState.asset,
                denom: sendState.asset.originDenom,
                chainId: sendState.asset.originChainId,
              }
            : sendState.asset,
        toAsset: needsBridgeFromOsmosis
          ? osmosisReceiveAsset
          : destinationIsNotNativeChain
            ? {
                ...receiveState.asset,
                denom: receiveState.asset.originDenom,
                chainId: receiveState.asset.originChainId,
              }
            : receiveState.asset,
        isFirstStep: steps.length === 0,
      }),
    );

    // Step 3: Bridge from Osmosis to destination (if needed)
    if (receiveChainIsNotOsmosis) {
      steps.push(
        createAndDescribeStep({
          type: TransactionType.IBC_SEND,
          via: TransferMethod.STANDARD,
          fromChainId: osmosisChainId,
          toChainId: receiveState.chainId,
          fromAsset: osmosisReceiveAsset,
          toAsset: receiveState.asset,
          isFirstStep: false,
        }),
      );
    }

    // Step 4: If receive asset needs to be on its native chain but destination is different
    if (receiveChainIsNotOsmosis && destinationIsNotNativeChain) {
      const nativeReceiveAsset = {
        ...receiveState.asset,
        denom: receiveState.asset.originDenom,
        chainId: receiveState.asset.originChainId,
      };

      steps.push(
        createAndDescribeStep({
          type: TransactionType.IBC_SEND,
          via: TransferMethod.STANDARD,
          fromChainId: receiveState.chainId,
          toChainId: receiveState.asset.originChainId,
          fromAsset: receiveState.asset,
          toAsset: nativeReceiveAsset,
          isFirstStep: false,
        }),
      );
    }
  }

  if (steps.length === 0) {
    console.warn('[updateTransactionRouteAtom] No route conditions were met');
  }

  const newRoute = {
    steps,
    currentStep: 0,
    isComplete: false,
    isSimulation: true,
  };

  const currentHash = get(transactionRouteHashAtom);
  const newHash = createRouteHash({ route: newRoute, toAddress: receiveAddress });

  if (currentHash !== newHash) {
    console.log('[DEBUG][updateTransactionRouteAtom] Resetting transaction route');
    set(resetTransactionLogsAtom);

    // Reset successful simulation when route structure changes
    set(successfulSimTxRouteHashAtom, '');

    console.log('[updateTransactionRouteAtom] Route changed, updating');
    set(transactionRouteAtom, newRoute);
    set(transactionRouteHashAtom, newHash);
    set(simulationInvalidationAtom, prev => ({
      ...prev,
      shouldInvalidate: true,
      routeHash: newHash,
    }));
  }
});
