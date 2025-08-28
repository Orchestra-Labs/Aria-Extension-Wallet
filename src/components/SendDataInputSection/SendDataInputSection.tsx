import { Asset } from '@/types';
import { AssetInput } from '../AssetInput/AssetInput';
import { Button, Separator } from '@/ui-kit';
import { Swap } from '@/assets/icons';
import { useAtom, useAtomValue, useSetAtom } from 'jotai';
import {
  hasSendErrorAtom,
  isTxPendingAtom,
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
} from '@/atoms';
import { useEffect, useRef } from 'react';
import { useExchangeRate, useSendActions } from '@/hooks';
import { AddressInput } from '../AddressInput';
import { InputStatus, SIM_TX_FRESHNESS_TIMEOUT } from '@/constants';
import { formatBalanceDisplay } from '@/helpers';

interface SendDataInputSectionProps {}

export const SendDataInputSection: React.FC<SendDataInputSectionProps> = () => {
  const { exchangeRate = 1 } = useExchangeRate();
  const { runSimulation } = useSendActions();

  // Atom state
  const [sendState, setSendState] = useAtom(sendStateAtom);
  const [receiveState, setReceiveState] = useAtom(receiveStateAtom);
  const maxAvailable = useAtomValue(maxAvailableAtom);
  const maxDisplayAvailable = useAtomValue(maxAvailableDisplayAtom);
  const recipientAddress = useAtomValue(recipientAddressAtom);
  const isTxPending = useAtomValue(isTxPendingAtom);
  const [sendError, setSendError] = useAtom(sendErrorAtom);
  const receiveError = useAtomValue(receiveErrorAtom);
  const hasSendError = useAtomValue(hasSendErrorAtom);
  const resetTxRoute = useSetAtom(resetTransactionRouteAtom);
  const updateTransactionRoute = useSetAtom(updateTransactionRouteAtom);
  const walletState = useAtomValue(chainWalletAtom(sendState.chainId));
  const [simulationInvalidation, setSimulationInvalidation] = useAtom(simulationInvalidationAtom);
  const transactionRouteHash = useAtomValue(transactionRouteHashAtom);
  const canRunSimulation = useAtomValue(canRunSimulationAtom);

  // Refs for tracking
  const simulationIntervalRef = useRef<NodeJS.Timeout>();
  const lastSimulationRunRef = useRef<number>(0);

  // Derived values
  // TODO: add max receivable atom for receiving unit
  const placeHolder = `Max: ${formatBalanceDisplay(`${maxDisplayAvailable}`, sendState.asset.symbol)}`;

  // Pure calculation function for derived state
  const calculateDerivedState = (update: {
    newSendAmount?: number;
    newReceiveAmount?: number;
    newSendAsset?: Asset;
    newReceiveAsset?: Asset;
  }) => {
    const newSendAsset = update.newSendAsset || sendState.asset;
    const newReceiveAsset = update.newReceiveAsset || receiveState.asset;

    const isSameAsset =
      (newSendAsset.originDenom || newSendAsset.denom) ===
      (newReceiveAsset.originDenom || newReceiveAsset.denom);
    const effectiveRate = isSameAsset ? 1 : exchangeRate;

    let newSendAmount = update.newSendAmount ?? sendState.displayAmount;
    let newReceiveAmount = update.newReceiveAmount ?? receiveState.displayAmount;

    // Determine which value was user-updated
    const isSendUpdate = update.newSendAmount !== undefined;
    const isReceiveUpdate = update.newReceiveAmount !== undefined;

    // Calculate derived amounts
    if (isSendUpdate) {
      newReceiveAmount = newSendAmount * effectiveRate;
    } else if (isReceiveUpdate) {
      newSendAmount = newReceiveAmount / effectiveRate;
    }

    // Apply max available constraints
    if (newSendAmount > maxDisplayAvailable) {
      newSendAmount = maxDisplayAvailable;
      newReceiveAmount = newSendAmount * effectiveRate;

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
      setReceiveState(prev => ({
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
  };

  const updateReceiveAsset = (newAsset: Asset) => {
    handleStateUpdate({
      newReceiveAsset: newAsset,
    });
  };

  const updateSendAmount = (amount: number) => handleStateUpdate({ newSendAmount: amount });
  const updateReceiveAmount = (amount: number) => handleStateUpdate({ newReceiveAmount: amount });

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
          : exchangeRate;
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
        await updateTransactionRoute({
          sendState,
          receiveState,
          walletAddress: walletState.address,
          isUserAction: true,
        });
      } catch (error) {
        console.error('Error updating transaction type:', error);
      }
    };

    updateTxType();
  }, [sendState, receiveState, recipientAddress, walletState]);

  // Main simulation trigger effect. Runs on timeout or when conditions change
  useEffect(() => {
    // Periodic simulation setup
    console.log('[Periodic Simulation Setup] Starting periodic invalidation');

    // Clear any existing interval
    if (simulationIntervalRef.current) {
      clearInterval(simulationIntervalRef.current);
    }

    // Set up periodic invalidation
    simulationIntervalRef.current = setInterval(() => {
      console.log('[Periodic Invalidation] Setting shouldInvalidate to true');
      setSimulationInvalidation(prev => ({
        ...prev,
        shouldInvalidate: true,
      }));
    }, SIM_TX_FRESHNESS_TIMEOUT);

    // Simulation execution logic
    if (simulationInvalidation.shouldInvalidate && canRunSimulation) {
      console.log('[Simulation Trigger] Running simulation due to invalidation');
      lastSimulationRunRef.current = Date.now();

      try {
        runSimulation();

        // Reset invalidation after successful simulation
        setSimulationInvalidation(prev => ({
          ...prev,
          routeHash: transactionRouteHash,
          shouldInvalidate: false,
        }));
      } catch (error) {
        console.error('[Simulation Trigger] Simulation failed:', error);
      }
    }

    // Cleanup on unmount
    return () => {
      if (simulationIntervalRef.current) {
        clearInterval(simulationIntervalRef.current);
      }
    };
  }, [simulationInvalidation, canRunSimulation]);

  useEffect(() => {
    if (hasSendError) {
      const timer = setTimeout(() => {
        setSendError({ message: '', status: InputStatus.NEUTRAL });
      }, 2000);
      return () => clearTimeout(timer);
    }
  }, [hasSendError]);

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
        disableButtons={isTxPending}
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
        disableButtons={isTxPending}
        onClear={clearAmount}
        onMax={() => setMaxAmount('receive')}
        includeBottomMargin={false}
        addClearMaxMargin
      />
    </>
  );
};
