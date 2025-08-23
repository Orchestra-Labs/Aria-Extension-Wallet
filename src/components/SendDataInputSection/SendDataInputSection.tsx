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
  const placeHolder = `Max: ${formatBalanceDisplay(`${maxAvailable}`, sendState.asset.symbol)}`;

  // Pure calculation function for derived state
  const calculateDerivedState = (update: {
    sendAmount?: number;
    receiveAmount?: number;
    sendAsset?: Asset;
    receiveAsset?: Asset;
  }) => {
    const currentSendAsset = update.sendAsset || sendState.asset;
    const currentReceiveAsset = update.receiveAsset || receiveState.asset;
    const isSameAsset =
      (currentSendAsset.originDenom || currentSendAsset.denom) ===
      (currentReceiveAsset.originDenom || currentReceiveAsset.denom);
    const effectiveRate = isSameAsset ? 1 : exchangeRate;

    let sendAmount = update.sendAmount ?? sendState.amount;
    let receiveAmount = update.receiveAmount ?? receiveState.amount;

    // Determine which value was user-updated
    const isSendUpdate = update.sendAmount !== undefined;
    const isReceiveUpdate = update.receiveAmount !== undefined;

    // Calculate derived amounts
    if (isSendUpdate) {
      receiveAmount = sendAmount * effectiveRate;
    } else if (isReceiveUpdate) {
      sendAmount = receiveAmount / effectiveRate;
    }

    // Apply max available constraints
    if (sendAmount > maxAvailable) {
      sendAmount = maxAvailable;
      receiveAmount = sendAmount * effectiveRate;
      setSendError({
        message: `Amount exceeded available balance.`,
        status: InputStatus.WARNING,
      });
    }

    return {
      sendAmount,
      receiveAmount,
      sendAsset: currentSendAsset,
      receiveAsset: currentReceiveAsset,
    };
  };

  // Unified state update handler
  const handleStateUpdate = async (update: {
    sendAmount?: number;
    receiveAmount?: number;
    sendAsset?: Asset;
    receiveAsset?: Asset;
  }) => {
    console.log('[AssetInputSection] handleStateUpdate called with:', update);
    const newState = calculateDerivedState(update);

    console.log('[AssetInputSection] New state:', newState);

    // Update states if values changed
    if (newState.sendAmount !== sendState.amount || newState.sendAsset !== sendState.asset) {
      console.log('[AssetInputSection] Updating send state');
      setSendState(prev => ({
        ...prev,
        amount: newState.sendAmount,
        asset: newState.sendAsset,
        chainId: newState.sendAsset.chainId,
      }));
    }

    if (
      newState.receiveAmount !== receiveState.amount ||
      newState.receiveAsset !== receiveState.asset
    ) {
      console.log('[AssetInputSection] Updating receive state');
      setReceiveState(prev => ({
        ...prev,
        amount: newState.receiveAmount,
        asset: newState.receiveAsset,
        chainId: receiveState.chainId, // ensure receive chain id only changes via address
      }));
    }
  };

  // Handler functions
  const updateSendAsset = (newAsset: Asset) => {
    handleStateUpdate({
      sendAsset: newAsset,
      sendAmount: 0,
      receiveAmount: 0,
    });
  };

  const updateReceiveAsset = (newAsset: Asset) => {
    handleStateUpdate({
      receiveAsset: newAsset,
      sendAmount: 0,
      receiveAmount: 0,
    });
  };

  const updateSendAmount = (amount: number) => handleStateUpdate({ sendAmount: amount });
  const updateReceiveAmount = (amount: number) => handleStateUpdate({ receiveAmount: amount });

  const switchFields = () => {
    handleStateUpdate({
      sendAsset: receiveState.asset,
      receiveAsset: sendState.asset,
      sendAmount: receiveState.amount,
      receiveAmount: sendState.amount,
    });
  };

  const setMaxAmount = (type: 'send' | 'receive') => {
    if (type === 'send') {
      handleStateUpdate({ sendAmount: maxAvailable });
    } else {
      const sendAsset = sendState.asset;
      const receiveAsset = receiveState.asset;

      const effectiveRate =
        (sendAsset.originDenom || sendAsset.denom) ===
        (receiveAsset.originDenom || receiveAsset.denom)
          ? 1
          : exchangeRate;
      handleStateUpdate({ receiveAmount: maxAvailable * effectiveRate });
    }
  };

  const clearAmount = () => {
    handleStateUpdate({ sendAmount: 0, receiveAmount: 0 });
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
        amountState={sendState.amount}
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
        amountState={receiveState.amount}
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
