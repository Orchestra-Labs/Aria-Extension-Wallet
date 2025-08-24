import { atom } from 'jotai';
import { TransactionType, TransactionStatus, TransferMethod } from '@/constants';
import { TransactionRoute, TransactionStep, TransactionState, Asset } from '@/types';
import { nonSubbedChainInfoAtom, skipChainsAtom } from './chainRegistryAtom';
import {
  createRouteHash,
  createStepHash,
  getStepDescription,
  getValidIBCChannel,
  isValidSwap,
} from '@/helpers';
import {
  receiveStateAtom,
  sendStateAtom,
  simulationInvalidationAtom,
} from './transactionStateAtom';
import { skipAssetsAtom } from './assetsAtom';
import { recipientAddressAtom } from './addressAtom';
import {
  createStepLogAtom,
  resetTransactionLogsAtom,
  transactionLogsAtom,
  updateStepLogAtom,
} from './transactionLogsAtom';

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
  set(resetTransactionLogsAtom);
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
      feeData?: {
        gasWanted?: string;
        gasPrice?: string;
        amount?: number;
      };
    },
  ) => {
    const currentRoute = get(transactionRouteAtom);
    const step = currentRoute.steps[params.stepIndex];

    if (!step) {
      console.error('[updateRouteStepStatusAtom] Step not found:', params.stepIndex);
      return;
    }

    set(updateStepLogAtom, {
      stepHash: step.hash,
      log: {
        status: params.status,
        ...(params.txHash && { txHash: params.txHash }),
        ...(params.error && { error: params.error }),
      },
      feeData: params.feeData,
    });

    console.log('[updateRouteStepStatusAtom] Updating step status:', {
      stepIndex: params.stepIndex,
      stepHash: step.hash,
      newStatus: params.status,
      txHash: params.txHash,
      error: params.error,
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

export const resetRouteStatusAtom = atom(null, (get, set, isSimulation: boolean = false) => {
  const currentRoute = get(transactionRouteAtom);
  const logs = get(transactionLogsAtom);
  console.log('[resetRouteStatusAtom] Resetting route status');

  // Reset all step statuses to PENDING
  currentRoute.steps.forEach(step => {
    const existingLog = logs[step.hash];
    set(updateStepLogAtom, {
      stepHash: step.hash,
      log: {
        ...existingLog,
        status: TransactionStatus.IDLE,
        error: undefined,
      },
    });
  });

  set(transactionRouteAtom, {
    ...currentRoute,
    currentStep: 0,
    isComplete: false,
    isSimulation: isSimulation,
  });
});

export const updateTransactionRouteAtom = atom(
  null,
  async (
    get,
    set,
    params: {
      walletAddress: string;
      sendState?: TransactionState;
      receiveState?: TransactionState;
      isUserAction?: boolean;
    },
  ) => {
    console.log('[updateTransactionRouteAtom] Starting route update with params:', {
      walletAddress: params.walletAddress,
      sendState: params.sendState,
      receiveState: params.receiveState,
      isUserAction: params.isUserAction,
    });

    const getChainInfo = get(nonSubbedChainInfoAtom);
    const sendState = params.sendState || get(sendStateAtom);
    const receiveState = params.receiveState || get(receiveStateAtom);
    const receiveAddress = get(recipientAddressAtom);
    const skipChains = get(skipChainsAtom);
    const skipAssets = get(skipAssetsAtom);
    set(resetTransactionLogsAtom);

    sendState.amount;

    if (!sendState.asset || !receiveState.asset) {
      console.error('[updateTransactionRouteAtom] Missing assets');
      return;
    }

    const steps: TransactionStep[] = [];
    const sendChain = getChainInfo(sendState.chainId);
    const receiveChain = getChainInfo(receiveState.chainId);
    const restUris = sendChain?.rest_uris;

    if (!sendChain || !receiveChain) {
      console.error('[updateTransactionRouteAtom] Missing chain info');
      return;
    }

    console.log('[updateTransactionRouteAtom] Chain info:', {
      sendChain,
      receiveChain,
    });

    // Create a Set of all Skip-supported denoms
    const skipSupportedDenoms = new Set<string>();
    for (const asset of Object.values(skipAssets)) {
      skipSupportedDenoms.add(asset.originDenom || asset.denom);
    }

    console.log('[updateTransactionRouteAtom] Skip assets:', {
      skipAssetsCount: Object.keys(skipAssets).length,
      skipAssetsList: Object.values(skipAssets).map(a => ({
        denom: a.denom,
        originDenom: a.originDenom,
        symbol: a.symbol,
        chainId: a.chainId,
      })),
      lookingFor: 'uusdc',
    });

    // Check denom support
    const isCurrentSendDenomSupported = skipSupportedDenoms.has(sendState.asset.denom);
    const isOriginalSendDenomSupported = skipSupportedDenoms.has(sendState.asset.originDenom);
    const isCurrentReceiveDenomSupported = skipSupportedDenoms.has(receiveState.asset.denom);

    console.log('[updateTransactionRouteAtom] Denom support:', {
      currentSendDenom: sendState.asset.denom,
      isCurrentSendDenomSupported,
      originSendDenom: sendState.asset.originDenom,
      isOriginalSendDenomSupported,
      currentReceiveDenom: receiveState.asset.denom,
      isCurrentReceiveDenomSupported,
    });

    // Check chain support
    const areChainsSkipSupported =
      skipChains.includes(sendState.chainId) && skipChains.includes(receiveState.chainId);

    console.log('[updateTransactionRouteAtom] Chain support:', {
      sendChainInSkip: skipChains.includes(sendState.chainId),
      receiveChainInSkip: skipChains.includes(receiveState.chainId),
      areChainsSkipSupported,
    });

    const sendAndReceiveAssetsMatch =
      sendState.asset.originDenom === receiveState.asset.originDenom;
    const sendAndReceiveChainsMatch = sendState.chainId === receiveState.chainId;

    // Check if this is a simple send (same asset on same chain)
    const isSimpleSend = sendAndReceiveChainsMatch && sendAndReceiveAssetsMatch;

    // Check if this is a valid swap
    const isValidStablecoinSwapTx = isValidSwap({
      sendAsset: sendState.asset,
      receiveAsset: receiveState.asset,
    });

    console.log('[updateTransactionRouteAtom] Transaction type checks:', {
      sendAndReceiveAssetsMatch,
      sendAndReceiveChainsMatch,
      isSimpleSend,
      isValidStablecoinSwapTx,
    });

    // Helper function to create a transaction step (without log)
    const createStep = (
      type: TransactionType,
      via: 'skip' | 'standard',
      fromChain: string,
      toChain: string,
      fromAsset: Asset,
      toAsset: Asset,
      isFirstStep: boolean = false,
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
        // Pass sendState.amount for the first step only
        hash: createStepHash(step, isFirstStep ? sendState.amount : undefined),
      };
    };

    // Create steps and logs separately
    const createAndDescribeStep = (
      type: TransactionType,
      via: TransferMethod,
      fromChainId: string,
      toChainId: string,
      fromAsset: Asset,
      toAsset: Asset,
      isFirstStep: boolean = false,
    ): TransactionStep => {
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

      const step = createStep(type, via, fromChainId, toChainId, fromAsset, toAsset, isFirstStep);
      const description = getStepDescription({
        step,
        toAddress: receiveAddress,
        sendChainInfo: fromChain,
        receiveChainInfo: toChain,
      });

      // Create log entry for this step
      set(createStepLogAtom, {
        step,
        description,
      });

      return step;
    };

    // Case 1: Simple send
    if (isSimpleSend) {
      console.log('[updateTransactionRouteAtom] Creating simple send route');
      steps.push(
        createAndDescribeStep(
          TransactionType.SEND,
          TransferMethod.STANDARD,
          sendState.chainId,
          receiveState.chainId,
          sendState.asset,
          receiveState.asset,
          true,
        ),
      );
    }
    // Case 2: Local swap
    else if (isValidStablecoinSwapTx && sendAndReceiveChainsMatch) {
      console.log('[updateTransactionRouteAtom] Creating local swap route');
      steps.push(
        createAndDescribeStep(
          TransactionType.SWAP,
          TransferMethod.STANDARD,
          sendState.chainId,
          receiveState.chainId,
          sendState.asset,
          receiveState.asset,
          true,
        ),
      );
    }
    // Case 3: Direct exchange possible via Skip
    else if (
      isCurrentSendDenomSupported &&
      isCurrentReceiveDenomSupported &&
      areChainsSkipSupported &&
      !sendAndReceiveAssetsMatch
    ) {
      console.log('[updateTransactionRouteAtom] Creating Skip exchange route');
      steps.push(
        createAndDescribeStep(
          TransactionType.EXCHANGE,
          TransferMethod.SKIP,
          sendState.chainId,
          receiveState.chainId,
          sendState.asset,
          receiveState.asset,
          true,
        ),
      );
    }
    // Case 4: Need to bridge first (IBC to native then exchange via Skip)
    else if (
      !isCurrentSendDenomSupported &&
      isOriginalSendDenomSupported &&
      areChainsSkipSupported &&
      !sendAndReceiveAssetsMatch
    ) {
      console.log('[updateTransactionRouteAtom] Creating bridge + exchange route');
      console.log('[updateTransactionRouteAtom] Sending asset, case 4:', sendState);
      // Step 1: Bridge to native chain via IBC
      const useSkipForIBC =
        skipChains.includes(sendState.chainId) &&
        skipChains.includes(sendState.asset.originChainId);

      steps.push(
        createAndDescribeStep(
          TransactionType.IBC_SEND,
          useSkipForIBC ? TransferMethod.SKIP : TransferMethod.STANDARD,
          sendState.chainId,
          sendState.asset.originChainId,
          sendState.asset,
          {
            ...sendState.asset,
            denom: sendState.asset.originDenom,
            chainId: sendState.asset.originChainId,
          },
          true,
        ),
      );

      console.log('[updateTransactionRouteAtom] Steps, case 4:', steps);

      // Step 2: Then exchange via Skip
      steps.push(
        createAndDescribeStep(
          TransactionType.EXCHANGE,
          TransferMethod.SKIP,
          sendState.asset.originChainId,
          receiveState.chainId,
          {
            ...sendState.asset,
            denom: sendState.asset.originDenom,
            chainId: sendState.asset.originChainId,
          },
          receiveState.asset,
          false,
        ),
      );
    }
    // Case 5: Standard IBC transfer
    else if (!sendAndReceiveChainsMatch && sendAndReceiveAssetsMatch) {
      console.log('[updateTransactionRouteAtom] Checking IBC channel');
      const isValidIbcTx = await getValidIBCChannel({
        sendChain,
        receiveChainId: receiveState.chainId,
        networkLevel: sendChain.network_level,
        prefix: sendChain.bech32_prefix,
        restUris,
      });

      console.log('[updateTransactionRouteAtom] IBC channel validation:', { isValidIbcTx });

      if (isValidIbcTx) {
        const useSkip =
          skipChains.includes(sendState.chainId) && skipChains.includes(receiveState.chainId);

        console.log('[updateTransactionRouteAtom] Creating IBC transfer route', { useSkip });
        steps.push(
          createAndDescribeStep(
            TransactionType.IBC_SEND,
            useSkip ? TransferMethod.SKIP : TransferMethod.STANDARD,
            sendState.chainId,
            receiveState.chainId,
            sendState.asset,
            receiveState.asset,
            true,
          ),
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

    const currentRoute = get(transactionRouteAtom);
    const currentHash = createRouteHash(currentRoute);
    const newHash = createRouteHash(newRoute);

    if (currentHash !== newHash) {
      console.log('[updateTransactionRouteAtom] Route changed, updating');
      set(transactionRouteAtom, newRoute);
      set(transactionRouteHashAtom, newHash);
      set(simulationInvalidationAtom, prev => ({
        ...prev,
        shouldInvalidate: true,
        routeHash: newHash, // Reset route hash to force new simulation
      }));
    }
  },
);
