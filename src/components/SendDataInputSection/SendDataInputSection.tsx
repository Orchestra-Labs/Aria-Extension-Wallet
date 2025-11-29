import { Asset } from '@/types';
import { AssetInput } from '../AssetInput/AssetInput';
import { Button, Separator } from '@/ui-kit';
import { Swap } from '@/assets/icons';
import { useAtom, useAtomValue, useSetAtom } from 'jotai';
import {
  hasSendErrorAtom,
  maxAvailableAtom,
  receiveErrorAtom,
  receiveStateAtom,
  recipientAddressAtom,
  sendErrorAtom,
  sendStateAtom,
  chainWalletAtom,
  updateTransactionRouteAtom,
  resetTransactionRouteAtom,
  simulationInvalidationAtom,
  transactionRouteHashAtom,
  canRunSimulationAtom,
  maxAvailableDisplayAtom,
  updateReceiveStateAtom,
  transactionRouteExchangeRateAtom,
  transactionRouteAtom,
  transactionLogsAtom,
  isSimulationRunningAtom,
  successfulSimTxRouteHashAtom,
} from '@/atoms';
import { useEffect, useRef, useState } from 'react';
import { useSendActions } from '@/hooks';
import { AddressInput } from '../AddressInput';
import { InputStatus, SIM_TX_FRESHNESS_TIMEOUT } from '@/constants';
import { formatBalanceDisplay } from '@/helpers';

interface SendDataInputSectionProps {}

export const SendDataInputSection: React.FC<SendDataInputSectionProps> = () => {
  // Refs for tracking
  const simulationIntervalRef = useRef<NodeJS.Timeout>();
  const lastSimulationRunRef = useRef<number>(0);

  // const { exchangeRate = 1 } = useStablecoinSwapExchangeRate();
  const { runSimulation } = useSendActions();

  // Atom state
  const [sendState, setSendState] = useAtom(sendStateAtom);
  const receiveState = useAtomValue(receiveStateAtom);
  const maxAvailable = useAtomValue(maxAvailableAtom);
  const maxDisplayAvailable = useAtomValue(maxAvailableDisplayAtom);
  const recipientAddress = useAtomValue(recipientAddressAtom);
  const isSimulationRunning = useAtomValue(isSimulationRunningAtom);
  const [sendError, setSendError] = useAtom(sendErrorAtom);
  const receiveError = useAtomValue(receiveErrorAtom);
  const hasSendError = useAtomValue(hasSendErrorAtom);
  const resetTxRoute = useSetAtom(resetTransactionRouteAtom);
  const updateTransactionRoute = useSetAtom(updateTransactionRouteAtom);
  const walletState = useAtomValue(chainWalletAtom(sendState.chainId));
  const [simulationInvalidation, setSimulationInvalidation] = useAtom(simulationInvalidationAtom);
  const transactionRouteHash = useAtomValue(transactionRouteHashAtom);
  const canRunSimulation = useAtomValue(canRunSimulationAtom);
  const updateReceiveState = useSetAtom(updateReceiveStateAtom);
  const routeExchangeRate = useAtomValue(transactionRouteExchangeRateAtom);
  const transactionRoute = useAtomValue(transactionRouteAtom);
  const transactionLogs = useAtomValue(transactionLogsAtom);
  const setSuccessfulSimTxRouteHash = useSetAtom(successfulSimTxRouteHashAtom);

  const [pendingSimulationRequest, setPendingSimulationRequest] = useState(false);

  // Derived values
  // TODO: add max receivable atom for receiving unit
  const placeHolder = `Max: ${formatBalanceDisplay(`${maxDisplayAvailable}`, sendState.asset.symbol)}`;

  const requestSimulation = (immediate = false) => {
    // NOTE: may be redundant.  remove if redundant (but TEST)
    const hasNonZeroAmount = sendState.amount > 0 && sendState.displayAmount > 0;
    const hasValidAmount =
      !isNaN(sendState.amount) && hasNonZeroAmount && sendState.amount <= maxAvailable;
    if (!hasValidAmount) return;

    if (immediate) {
      // For immediate requests (user input), set pending flag and reset invalidation
      setPendingSimulationRequest(true);
      setSimulationInvalidation(prev => ({
        ...prev,
        shouldInvalidate: true,
        lastRunTimestamp: 0, // Force immediate execution
      }));
    } else {
      // For periodic requests, use normal invalidation
      setSimulationInvalidation(prev => ({
        ...prev,
        shouldInvalidate: true,
      }));
    }
  };

  // Pure calculation function for derived state
  const calculateDerivedState = (update: {
    newSendAmount?: number;
    newReceiveAmount?: number;
    newSendAsset?: Asset;
    newReceiveAsset?: Asset;
  }) => {
    // Special handling for switch operation
    if (update.newSendAsset === receiveState.asset && update.newReceiveAsset === sendState.asset) {
      return {
        sendAmount: update.newSendAmount ?? receiveState.displayAmount,
        receiveAmount: update.newReceiveAmount ?? sendState.displayAmount,
        sendAsset: update.newSendAsset ?? receiveState.asset,
        receiveAsset: update.newReceiveAsset ?? sendState.asset,
      };
    }

    const newSendAsset = update.newSendAsset || sendState.asset;
    const newReceiveAsset = update.newReceiveAsset || receiveState.asset;

    const isSameAsset =
      (newSendAsset.originDenom || newSendAsset.denom) ===
      (newReceiveAsset.originDenom || newReceiveAsset.denom);

    let newSendAmount = update.newSendAmount ?? sendState.displayAmount;
    let newReceiveAmount = update.newReceiveAmount ?? receiveState.displayAmount;

    // Determine which value was user-updated
    const isSendUpdate = update.newSendAmount !== undefined;

    // Check if we have a valid simulation result
    const hasValidSimulation = transactionRoute.steps.length > 0;
    const finalStep = transactionRoute.steps[transactionRoute.steps.length - 1];
    const finalStepLog = transactionLogs[finalStep?.hash];
    const hasSimulationResult = finalStepLog?.outputAmount && finalStepLog.outputAmount !== '0';

    if (hasValidSimulation && hasSimulationResult) {
      // After simulation: use the actual output amount from the route
      if (isSendUpdate) {
        // When send amount changes after simulation, we need to re-run simulation
        // For now, keep the receive amount as is until new simulation completes
        newReceiveAmount = receiveState.displayAmount;
      } else {
        // When receive amount changes, calculate equivalent send amount
        const simulationOutput =
          parseFloat(finalStepLog.outputAmount) / Math.pow(10, newReceiveAsset.exponent);
        const simulationInput = sendState.displayAmount;
        const effectiveRate = simulationInput > 0 ? simulationInput / simulationOutput : 1;
        newSendAmount = newReceiveAmount * effectiveRate;
      }
    } else {
      // Before simulation: use exchange rate for estimation
      const effectiveRate = isSameAsset ? 1 : routeExchangeRate;

      if (isSendUpdate) {
        newReceiveAmount = newSendAmount * effectiveRate;
      } else {
        newSendAmount = newReceiveAmount / effectiveRate;
      }
    }

    // Apply max available constraints
    if (newSendAmount > maxDisplayAvailable) {
      newSendAmount = maxDisplayAvailable;

      if (hasValidSimulation && hasSimulationResult) {
        // Scale the receive amount proportionally after simulation
        const scaleFactor = newSendAmount / sendState.displayAmount;
        newReceiveAmount = receiveState.displayAmount * scaleFactor;
      } else {
        // Use exchange rate before simulation
        const effectiveRate = isSameAsset ? 1 : routeExchangeRate;
        newReceiveAmount = newSendAmount * effectiveRate;
      }

      setSendError({
        message: `Amount exceeded available balance.`,
        status: InputStatus.WARNING,
      });
    }

    return {
      sendAmount: newSendAmount,
      receiveAmount: newReceiveAmount,
      sendAsset: newSendAsset,
      receiveAsset: newReceiveAsset,
    };
  };

  // Unified state update handler
  const handleStateUpdate = async (update: {
    newSendAmount?: number;
    newReceiveAmount?: number;
    newSendAsset?: Asset;
    newReceiveAsset?: Asset;
  }) => {
    console.log('[AssetInputSection] handleStateUpdate called with:', update);
    const newDisplayState = calculateDerivedState(update);
    const newSendDisplayAmount = newDisplayState.sendAmount;
    const newSendAsset = newDisplayState.sendAsset;
    const newReceiveDisplayAmount = newDisplayState.receiveAmount;
    const newReceiveAsset = newDisplayState.receiveAsset;

    const newSendAmount = newSendDisplayAmount * Math.pow(10, newSendAsset.exponent);
    const newReceiveAmount = newReceiveDisplayAmount * Math.pow(10, newReceiveAsset.exponent);

    console.log('[AssetInputSection] New state:', newDisplayState);

    // Update states if values changed
    if (newSendAmount !== sendState.amount || newSendAsset !== sendState.asset) {
      console.log('[AssetInputSection] Updating send state');
      setSendState(prev => ({
        ...prev,
        amount: newSendAmount,
        displayAmount: newSendDisplayAmount,
        asset: newSendAsset,
        chainId: newSendAsset.chainId,
      }));
    }

    if (newReceiveAmount !== receiveState.amount || newReceiveAsset !== receiveState.asset) {
      console.log('[AssetInputSection] Updating receive state');
      updateReceiveState(prev => ({
        ...prev,
        amount: newReceiveAmount,
        displayAmount: newReceiveDisplayAmount,
        asset: newReceiveAsset,
        chainId: receiveState.chainId, // ensure receive chain id only changes via address
      }));
    }
  };

  // Handler functions
  const updateSendAsset = (newAsset: Asset) => {
    handleStateUpdate({
      newSendAsset: newAsset,
    });
    requestSimulation(true);
  };

  const updateReceiveAsset = (newAsset: Asset) => {
    handleStateUpdate({
      newReceiveAsset: newAsset,
    });
    requestSimulation(true);
  };

  const updateSendAmount = (amount: number) => {
    // If input is empty (NaN), treat it as a full clear action
    if (isNaN(amount)) {
      clearAmount();
      return;
    }

    handleStateUpdate({
      newSendAmount: amount,
    });
    requestSimulation(true); // Request immediate simulation
  };

  const updateReceiveAmount = (amount: number) => {
    // If input is empty (NaN), treat it as a full clear action
    if (isNaN(amount)) {
      clearAmount();
      return;
    }

    handleStateUpdate({
      newReceiveAmount: amount,
    });
    requestSimulation(true); // Request immediate simulation
  };

  const switchFields = () => {
    handleStateUpdate({
      newSendAsset: receiveState.asset,
      newReceiveAsset: sendState.asset,
      newSendAmount: receiveState.displayAmount,
      newReceiveAmount: sendState.displayAmount,
    });
  };

  const setMaxAmount = (type: 'send' | 'receive') => {
    if (type === 'send') {
      handleStateUpdate({ newSendAmount: maxAvailable });
    } else {
      const sendAsset = sendState.asset;
      const receiveAsset = receiveState.asset;

      const effectiveRate =
        (sendAsset.originDenom || sendAsset.denom) ===
        (receiveAsset.originDenom || receiveAsset.denom)
          ? 1
          : routeExchangeRate;
      handleStateUpdate({ newReceiveAmount: maxAvailable * effectiveRate });
    }
  };

  const clearAmount = () => {
    handleStateUpdate({ newSendAmount: 0, newReceiveAmount: 0 });
    setSendError({ message: '', status: InputStatus.NEUTRAL });
    resetTxRoute();
  };

  // Update transaction route when inputs change
  useEffect(() => {
    const updateTxType = async () => {
      if (!walletState.address) return;

      try {
        await updateTransactionRoute();
      } catch (error) {
        console.error('Error updating transaction type:', error);
      }
    };

    updateTxType();
  }, [sendState, receiveState, recipientAddress, walletState, transactionRouteHash]);

  // Main simulation trigger effect. Runs on timeout or when conditions change
  useEffect(() => {
    console.log('[DEBUG][SimulationEffect] Simulation effect triggered', {
      shouldInvalidate: simulationInvalidation.shouldInvalidate,
      canRunSimulation,
      lastRunTimestamp: simulationInvalidation.lastRunTimestamp,
      currentTime: Date.now(),
      timeSinceLastRun: Date.now() - simulationInvalidation.lastRunTimestamp,
      timeUntilNextRun: Math.max(
        0,
        SIM_TX_FRESHNESS_TIMEOUT - (Date.now() - simulationInvalidation.lastRunTimestamp),
      ),
    });

    // Clear any existing interval
    if (simulationIntervalRef.current) {
      console.log('[DEBUG][Periodic Simulation] Clearing existing interval');
      clearInterval(simulationIntervalRef.current);
    }

    // Set up periodic invalidation with proper timing
    simulationIntervalRef.current = setInterval(() => {
      const timeSinceLastRun = Date.now() - simulationInvalidation.lastRunTimestamp;

      // Only invalidate if enough time has passed since last simulation
      if (timeSinceLastRun >= SIM_TX_FRESHNESS_TIMEOUT) {
        console.log('[DEBUG][Periodic Invalidation] Setting shouldInvalidate to true');
        setSimulationInvalidation(prev => ({
          ...prev,
          shouldInvalidate: true,
        }));
      } else {
        console.log('[DEBUG][Periodic Invalidation] Skipping - too soon since last run', {
          timeSinceLastRun,
          timeRemaining: SIM_TX_FRESHNESS_TIMEOUT - timeSinceLastRun,
        });
      }
    }, SIM_TX_FRESHNESS_TIMEOUT);

    const shouldRunImmediately = pendingSimulationRequest;

    const shouldRunPeriodic =
      simulationInvalidation.shouldInvalidate &&
      canRunSimulation &&
      Date.now() - simulationInvalidation.lastRunTimestamp >= SIM_TX_FRESHNESS_TIMEOUT;

    const shouldRunSimulation = shouldRunImmediately || shouldRunPeriodic;

    if (shouldRunSimulation) {
      console.log('[DEBUG][Simulation Execution] Running simulation', {
        immediate: shouldRunImmediately,
        periodic: shouldRunPeriodic,
      });

      lastSimulationRunRef.current = Date.now();

      const runSimulationWithCooldown = async () => {
        try {
          await runSimulation();

          // Reset invalidation after successful simulation with cooldown
          setSimulationInvalidation(prev => ({
            ...prev,
            routeHash: transactionRouteHash,
            shouldInvalidate: false,
            lastRunTimestamp: Date.now(),
          }));

          setPendingSimulationRequest(false);
          setSuccessfulSimTxRouteHash(transactionRouteHash);
        } catch (error) {
          // Even on failure, update the timestamp to prevent immediate retry
          setSimulationInvalidation(prev => ({
            ...prev,
            lastRunTimestamp: Date.now(),
          }));

          // Only clear pending request if it was immediate
          if (shouldRunImmediately) {
            setPendingSimulationRequest(false);
          }
        }
      };

      runSimulationWithCooldown();
    } else {
      console.log('[DEBUG][Simulation Execution] Conditions not met', {
        shouldInvalidate: simulationInvalidation.shouldInvalidate,
        canRunSimulation,
        timeSinceLastRun: Date.now() - simulationInvalidation.lastRunTimestamp,
        meetsTimeRequirement:
          Date.now() - simulationInvalidation.lastRunTimestamp >= SIM_TX_FRESHNESS_TIMEOUT,
      });
    }

    // Cleanup on unmount
    return () => {
      if (simulationIntervalRef.current) {
        console.log('[DEBUG][Periodic Simulation] Cleaning up interval');
        clearInterval(simulationIntervalRef.current);
      }
    };
  }, [simulationInvalidation, canRunSimulation, transactionRouteHash, pendingSimulationRequest]);

  // Prevent re-running simulations on error
  useEffect(() => {
    if (hasSendError) {
      const timer = setTimeout(() => {
        setSendError({ message: '', status: InputStatus.NEUTRAL });
      }, 2000);
      return () => clearTimeout(timer);
    }
  }, [hasSendError]);

  useEffect(() => {
    if (transactionRoute.steps.length > 0 && sendState.displayAmount > 0) {
      // Get the final output amount from the route (last step's output)
      const finalStep = transactionRoute.steps[transactionRoute.steps.length - 1];
      const finalStepLog = transactionLogs[finalStep.hash];

      if (finalStepLog?.outputAmount && finalStepLog.outputAmount !== '0') {
        const finalOutputAmount =
          parseFloat(finalStepLog.outputAmount) / Math.pow(10, receiveState.asset.exponent);

        // Only update if the amount is significantly different to avoid flickering
        if (Math.abs(finalOutputAmount - receiveState.displayAmount) > 0.0001) {
          updateReceiveState(prev => ({
            ...prev,
            amount: parseFloat(finalStepLog.outputAmount),
            displayAmount: finalOutputAmount,
          }));
        }
      }
    }
  }, [transactionLogs]);

  // TODO: highlight on send dialog assets which can reach the selected receive asset
  return (
    <>
      <AddressInput addBottomMargin={false} updateReceiveAsset={updateReceiveAsset} />
      <Separator variant="top" />

      <AssetInput
        placeholder={placeHolder}
        variant="send"
        status={sendError.status}
        messageText={sendError.message}
        assetState={sendState.asset}
        amountState={sendState.displayAmount}
        updateAsset={updateSendAsset}
        updateAmount={updateSendAmount}
        showClearAndMax
        disableButtons={isSimulationRunning}
        onClear={clearAmount}
        onMax={() => setMaxAmount('send')}
        includeBottomMargin={false}
        addClearMaxMargin
      />

      <div className="flex justify-center mb-2">
        <Button className="rounded-md h-9 w-9 bg-neutral-3" onClick={switchFields}>
          <Swap />
        </Button>
      </div>

      <AssetInput
        placeholder={''}
        variant="receive"
        status={receiveError.status}
        messageText={receiveError.message}
        assetState={receiveState.asset}
        amountState={receiveState.displayAmount}
        updateAsset={updateReceiveAsset}
        updateAmount={updateReceiveAmount}
        showClearAndMax
        disableButtons={isSimulationRunning}
        onClear={clearAmount}
        onMax={() => setMaxAmount('receive')}
        includeBottomMargin={false}
        addClearMaxMargin
      />
    </>
  );
};
