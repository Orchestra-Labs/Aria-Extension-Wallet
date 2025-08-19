import { atom } from 'jotai';
import { TransactionType, TransactionStatus } from '@/constants';
import { TransactionRoute, TransactionStep, TransactionState, Asset } from '@/types';
import { chainInfoAtom, skipChainsAtom } from './chainRegistryAtom';
import { getStepDescription, getValidIBCChannel, isValidSwap } from '@/helpers';
import { receiveStateAtom, sendStateAtom } from './transactionStateAtom';
import { skipAssetsAtom } from './assetsAtom';
import { recipientAddressAtom } from './addressAtom';

export const transactionRouteAtom = atom<TransactionRoute>({
  steps: [],
  currentStep: 0,
  isComplete: false,
  isSimulation: true,
});

export const resetTransactionRouteAtom = atom(null, (_, set) => {
  console.log('[resetTransactionRouteAtom] Resetting transaction route');
  set(transactionRouteAtom, {
    steps: [],
    currentStep: 0,
    isComplete: false,
    isSimulation: true,
  });
});

export const transactionHasValidRouteAtom = atom<boolean>(get => {
  const route = get(transactionRouteAtom);
  const isValid = route.steps.length > 0;
  console.log('[transactionHasValidRouteAtom] Checking route validity:', {
    stepsLength: route.steps.length,
    isValid,
  });
  return isValid;
});

export const updateRouteStepStatusAtom = atom(
  null,
  (
    get,
    set,
    params: {
      stepIndex: number;
      status: TransactionStatus;
      txHash?: string;
      error?: string;
    },
  ) => {
    const currentRoute = get(transactionRouteAtom);
    console.log('[updateRouteStepStatusAtom] Updating step status:', {
      stepIndex: params.stepIndex,
      currentStatus: currentRoute.steps[params.stepIndex]?.log.status,
      newStatus: params.status,
      txHash: params.txHash,
      error: params.error,
    });

    const updatedSteps = currentRoute.steps.map((step, idx) => {
      if (idx === params.stepIndex) {
        return {
          ...step,
          log: {
            ...step.log,
            status: params.status,
            ...(params.txHash && { txHash: params.txHash }),
            ...(params.error && { error: params.error }),
          },
        };
      }
      return step;
    });

    set(transactionRouteAtom, {
      ...currentRoute,
      steps: updatedSteps,
      currentStep:
        params.status === TransactionStatus.SUCCESS
          ? params.stepIndex + 1
          : currentRoute.currentStep,
      isComplete:
        params.status === TransactionStatus.SUCCESS && params.stepIndex === updatedSteps.length - 1,
    });
  },
);

export const resetRouteStatusAtom = atom(null, (get, set) => {
  const currentRoute = get(transactionRouteAtom);
  console.log('[resetRouteStatusAtom] Resetting route status');
  set(transactionRouteAtom, {
    ...currentRoute,
    steps: currentRoute.steps.map(step => ({
      ...step,
      log: {
        ...step.log,
        status: TransactionStatus.PENDING,
        txHash: undefined,
        error: undefined,
      },
    })),
    currentStep: 0,
    isComplete: false,
    isSimulation: false,
  });
});

export const updateTransactionRouteAtom = atom(
  null,
  async (
    get,
    set,
    params: {
      walletAddress: string;
      recipientAddress?: string;
      sendState?: TransactionState;
      receiveState?: TransactionState;
    },
  ) => {
    console.log('[updateTransactionRouteAtom] Starting route update');

    const getChainInfo = get(chainInfoAtom);
    const sendState = params.sendState || get(sendStateAtom);
    const receiveState = params.receiveState || get(receiveStateAtom);
    const receiveAddress = params.recipientAddress || get(recipientAddressAtom);
    const skipChains = get(skipChainsAtom);
    const skipAssets = get(skipAssetsAtom);

    if (!sendState.asset || !receiveState.asset) {
      console.error('[updateTransactionRouteAtom] Missing assets:', {
        sendAsset: sendState.asset,
        receiveAsset: receiveState.asset,
      });
      return;
    }

    console.log('[updateTransactionRouteAtom] Initial state:', {
      sendState,
      receiveState,
      receiveAddress,
      skipChains,
      skipAssetsCount: Object.keys(skipAssets).length,
    });

    const steps: TransactionStep[] = [];
    const sendChain = getChainInfo(sendState.chainId);
    const receiveChain = getChainInfo(receiveState.chainId);
    const restUris = sendChain?.rest_uris;

    if (!sendChain || !receiveChain) {
      console.error('[updateTransactionRouteAtom] Missing chain info:', {
        sendChainId: sendState.chainId,
        sendChainExists: !!sendChain,
        receiveChainId: receiveState.chainId,
        receiveChainExists: !!receiveChain,
      });
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

    // Helper function to create a transaction step with log
    const createAndDescribeStep = (
      type: TransactionType,
      via: 'skip' | 'standard',
      fromChain: string,
      toChain: string,
      fromAsset: Asset,
      toAsset: Asset,
    ): TransactionStep => {
      const baseStep = {
        type,
        via,
        fromChain,
        toChain,
        fromAsset,
        toAsset,
      };

      const description = getStepDescription(
        { ...baseStep, log: { description: '', status: TransactionStatus.PENDING } },
        receiveAddress,
        params.walletAddress,
      );

      console.log('[updateTransactionRouteAtom] Creating step:', {
        type,
        via,
        fromChain,
        toChain,
        fromAssetDenom: fromAsset.denom,
        toAssetDenom: toAsset.denom,
        description,
      });

      return {
        ...baseStep,
        log: {
          description,
          status: TransactionStatus.PENDING,
        },
      };
    };

    // Case 1: Simple send
    if (isSimpleSend) {
      console.log('[updateTransactionRouteAtom] Creating simple send route');
      steps.push(
        createAndDescribeStep(
          TransactionType.SEND,
          'standard',
          sendState.chainId,
          receiveState.chainId,
          sendState.asset,
          receiveState.asset,
        ),
      );
    }
    // Case 2: Local swap
    else if (isValidStablecoinSwapTx && sendAndReceiveChainsMatch) {
      console.log('[updateTransactionRouteAtom] Creating local swap route');
      steps.push(
        createAndDescribeStep(
          TransactionType.SWAP,
          'standard',
          sendState.chainId,
          receiveState.chainId,
          sendState.asset,
          receiveState.asset,
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
          'skip',
          sendState.chainId,
          receiveState.chainId,
          sendState.asset,
          receiveState.asset,
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
      // Step 1: Bridge to native chain via IBC
      const useSkipForIBC =
        skipChains.includes(sendState.chainId) &&
        skipChains.includes(sendState.asset.originChainId);

      steps.push(
        createAndDescribeStep(
          TransactionType.IBC_SEND,
          useSkipForIBC ? 'skip' : 'standard',
          sendState.chainId,
          sendState.asset.originChainId,
          sendState.asset,
          {
            ...sendState.asset,
            denom: sendState.asset.originDenom,
            chainId: sendState.asset.originChainId,
          },
        ),
      );

      // Step 2: Then exchange via Skip
      steps.push(
        createAndDescribeStep(
          TransactionType.EXCHANGE,
          'skip',
          sendState.asset.originChainId,
          receiveState.chainId,
          {
            ...sendState.asset,
            denom: sendState.asset.originDenom,
            chainId: sendState.asset.originChainId,
          },
          receiveState.asset,
        ),
      );
    }
    // Case 5: Direct IBC transfer (use Skip if supported, otherwise standard)
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
            useSkip ? 'skip' : 'standard',
            sendState.chainId,
            receiveState.chainId,
            sendState.asset,
            receiveState.asset,
          ),
        );
      }
    }

    if (steps.length === 0) {
      console.warn('[updateTransactionRouteAtom] No route conditions were met. Details:', {
        sendAsset: sendState.asset,
        receiveAsset: receiveState.asset,
        sendChain: sendChain,
        receiveChain: receiveChain,
        isSimpleSend,
        isValidStablecoinSwapTx,
        isCurrentSendDenomSupported,
        isCurrentReceiveDenomSupported,
        areChainsSkipSupported,
        sendAndReceiveAssetsMatch,
        sendAndReceiveChainsMatch,
      });
    } else {
      console.log('[updateTransactionRouteAtom] Generated route steps:', steps);
    }

    set(transactionRouteAtom, {
      steps,
      currentStep: 0,
      isComplete: false,
      isSimulation: true,
    });
  },
);
