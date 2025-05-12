import { useEffect, useState } from 'react';
import { useLocation } from 'react-router-dom';
import { Spinner, Swap } from '@/assets/icons';
import {
  DEFAULT_ASSET,
  DEFAULT_CHAIN_NAME,
  defaultReceiveState,
  defaultSendState,
  GREATER_EXPONENT_DEFAULT,
  LOCAL_CHAIN_REGISTRY,
  NetworkLevel,
  ROUTES,
} from '@/constants';
import { Button, Separator } from '@/ui-kit';
import { useAtom, useAtomValue } from 'jotai';
import {
  callbackChangeMapAtom,
  changeMapAtom,
  recipientAddressAtom,
  receiveStateAtom,
  sendStateAtom,
  walletStateAtom,
  selectedAssetAtom,
  addressVerifiedAtom,
  symphonyAssetsAtom,
  feeStateAtom,
} from '@/atoms';
import { Asset, TransactionResult, TransactionState, TransactionSuccess } from '@/types';
import { AssetInput, WalletSuccessScreen, TransactionResultsTile, Header } from '@/components';
import {
  convertToGreaterUnit,
  formatBalanceDisplay,
  getSessionStorageItem,
  isIBC,
  isValidSwap,
  isValidTransaction,
  removeSessionStorageItem,
  removeTrailingZeroes,
  sendIBC,
  sendTransaction,
  setSessionStorageItem,
  swapTransaction,
  truncateWalletAddress,
} from '@/helpers';
import { useExchangeRate, useRefreshData, useToast } from '@/hooks/';
import { AddressInput } from './AddressInput';

const pageMountedKey = 'userIsOnPage';
const setUserIsOnPage = (isOnPage: boolean) => {
  if (isOnPage) {
    removeSessionStorageItem(pageMountedKey);
  } else {
    setSessionStorageItem(pageMountedKey, 'false');
  }
};
const userIsOnPage = () => {
  const result = getSessionStorageItem(pageMountedKey) !== 'false';
  return result;
};

export const Send = () => {
  const { refreshData } = useRefreshData();
  const { exchangeRate } = useExchangeRate();
  const { toast } = useToast();
  const location = useLocation();

  const symphonyAssets = useAtomValue(symphonyAssetsAtom);
  const [sendState, setSendState] = useAtom(sendStateAtom);
  const [receiveState, setReceiveState] = useAtom(receiveStateAtom);
  const [feeState, setFeeState] = useAtom(feeStateAtom);
  const [changeMap, setChangeMap] = useAtom(changeMapAtom);
  const [callbackChangeMap, setCallbackChangeMap] = useAtom(callbackChangeMapAtom);
  const [recipientAddress, setRecipientAddress] = useAtom(recipientAddressAtom);
  const [addressVerified, setAddressVerified] = useAtom(addressVerifiedAtom);
  const [selectedAsset, setSelectedAsset] = useAtom(selectedAssetAtom);
  const walletState = useAtomValue(walletStateAtom);
  const walletAssets = walletState?.assets || [];

  // TODO: handle bridges to non-cosmos chains (Axelar to Ethereum and others)
  const [transactionType, setTransactionType] = useState({
    isSwap: false,
    isIBC: false,
    isValid: true,
  });
  const [simulatedFee, setSimulatedFee] = useState<{
    fee: string;
    textClass: 'text-error' | 'text-warn' | 'text-blue';
  } | null>({ fee: '0 MLD', textClass: 'text-blue' });
  const [sendPlaceholder, setSendPlaceholder] = useState<string>('');
  const [receivePlaceholder, setReceivePlaceholder] = useState<string>('');
  const [transactionState, setTransactionState] = useState<TransactionSuccess>({
    isSuccess: false,
  });
  const [isLoading, setLoading] = useState(false);
  const [error, setError] = useState<string>('');
  const [transactionLog, setTransactionLog] = useState<{
    isSimulation: boolean;
    entries: { sendObject: any; isSuccess?: boolean }[];
  }>({ isSimulation: false, entries: [] });
  const [lastEditTime, setLastEditTime] = useState<number>(0);

  const handleTransactionError = (errorMessage: string) => {
    const onPage = userIsOnPage();

    // Only show toast when component is unmounted
    if (onPage) {
      setError(errorMessage);
      setTimeout(() => {
        setError('');
      }, 3000);
    } else {
      toast({
        title: 'Transaction failed!',
        description: errorMessage,
        duration: 5000,
      });
      setUserIsOnPage(false);
    }
  };

  const handleTransactionSuccess = (txHash: string) => {
    const displayTransactionHash = truncateWalletAddress('', txHash);
    const onPage = userIsOnPage();

    // Only show toast when component is unmounted
    if (onPage) {
      if (location.pathname === ROUTES.APP.SEND) {
        setTransactionState({ isSuccess: true, txHash });
      }
    } else {
      toast({
        title: `${transactionType.isSwap ? 'Swap' : 'Send'} success!`,
        description: `Transaction hash: ${displayTransactionHash}`,
        duration: 5000,
      });
      setUserIsOnPage(false);
    }
    refreshData({ validator: false });
  };

  const executeSend = async ({
    sendObject,
    simulateTransaction,
  }: {
    sendObject: any;
    simulateTransaction: boolean;
  }): Promise<TransactionResult> => {
    console.log('Executing sendTransaction');
    const result = await sendTransaction(walletState.address, sendObject, simulateTransaction);
    console.log('sendTransaction result:', result);

    setTransactionLog({
      isSimulation: simulateTransaction,
      entries: [
        {
          sendObject,
          isSuccess: result?.data?.code === 0,
        },
      ],
    });

    return result;
  };

  const executeIBC = async ({
    sendObject,
    simulateTransaction,
  }: {
    sendObject: any;
    simulateTransaction: boolean;
  }): Promise<TransactionResult> => {
    const fromAddress = walletState.address;
    const sendChain = sendState.chainName;
    const receiveChain = receiveState.chainName;
    const networkLevel = NetworkLevel.TESTNET;
    const ibcObject = { fromAddress, sendObject, sendChain, receiveChain, networkLevel };

    const result = await sendIBC({ ibcObject, simulateTransaction });
    console.log('IBC Transaction Result:', result);

    setTransactionLog({
      isSimulation: simulateTransaction,
      entries: [
        {
          sendObject,
          isSuccess: result?.data?.code === 0,
        },
      ],
    });

    return result;
  };

  const executeSwap = async ({
    sendObject,
    simulateTransaction,
    receiveAsset,
  }: {
    sendObject: any;
    simulateTransaction: boolean;
    receiveAsset: Asset;
  }): Promise<TransactionResult> => {
    const swapObject = { sendObject, resultDenom: receiveAsset.denom };
    console.log('Executing swapTransaction with swapObject:', swapObject);
    const result = await swapTransaction(walletState.address, swapObject, simulateTransaction);
    console.log('swapTransaction result:', result);

    setTransactionLog({
      isSimulation: simulateTransaction,
      entries: [
        {
          sendObject,
          isSuccess: result?.data?.code === 0,
        },
      ],
    });

    return result;
  };

  const handleTransaction = async ({ simulateTransaction = false } = {}) => {
    console.log('Entering handleTransaction...');
    console.log('Current transaction type:', transactionType);

    if (!transactionType.isValid) return;

    const currentRecipientAddress = recipientAddress || walletState.address;
    if (!currentRecipientAddress || !addressVerified) return;

    const sendAsset = sendState.asset;
    let sendAmount = sendState.amount;
    const receiveAsset = receiveState.asset;

    if (!sendAsset || !receiveAsset) return;

    const assetToSend = walletAssets.find(a => a.denom === sendAsset.denom);
    if (!assetToSend) return;

    if (simulateTransaction && sendAmount === 0) {
      const maxAvailable = calculateMaxAvailable(sendAsset, 0);
      sendAmount = maxAvailable / 2;
    }

    const adjustedAmount = (
      sendAmount * Math.pow(10, assetToSend.exponent || GREATER_EXPONENT_DEFAULT)
    ).toFixed(0); // No decimals, minor unit

    const sendObject = {
      recipientAddress: currentRecipientAddress,
      amount: adjustedAmount,
      denom: sendAsset.denom,
      symphonyAssets,
    };

    if (!simulateTransaction) setLoading(true);

    try {
      let result: TransactionResult;
      console.log('Transaction details:', {
        sendObject,
        simulateTransaction,
        transactionType,
      });

      // Routing logic based on transactionType
      if (!transactionType.isSwap && !transactionType.isIBC) {
        result = await executeSend({ sendObject, simulateTransaction });
      } else if (transactionType.isIBC) {
        result = await executeIBC({ sendObject, simulateTransaction });
      } else if (transactionType.isSwap) {
        result = await executeSwap({ sendObject, simulateTransaction, receiveAsset });
      } else {
        handleTransactionError('Invalid transaction type');
        setLoading(false);
        return;
      }

      console.log('Result data:', simulateTransaction, result?.data?.code);

      if (simulateTransaction && result?.data?.code === 0) {
        return result;
      } else if (result.success && result.data?.code === 0) {
        const txHash = result.data.txHash || 'Hash not provided';
        handleTransactionSuccess(txHash);
      } else {
        const errorMessage = `Transaction failed: ${result.data}`;
        handleTransactionError(errorMessage);
      }
    } catch (error) {
      const errorMessage = `Transaction failed: ${error}`;
      handleTransactionError(errorMessage);
    } finally {
      if (!simulateTransaction) {
        setLoading(false);
      }
    }

    return null;
  };

  const calculateMaxAvailable = (sendAsset: Asset, simulatedFeeAmount?: number) => {
    const walletAsset = walletAssets.find(asset => asset.denom === sendAsset.denom);
    if (!walletAsset) return 0;

    const maxAmount = parseFloat(walletAsset.amount || '0');
    const feeAmount = simulatedFeeAmount ? simulatedFeeAmount : feeState.amount;

    const maxAvailable = Math.max(0, maxAmount - feeAmount);
    return maxAvailable;
  };

  const updateSendAsset = (newAsset: Asset, propagateChanges: boolean = false) => {
    setSendState(prevState => ({
      ...prevState,
      asset: {
        ...newAsset,
      },
    }));
    setChangeMap(prevMap => ({ ...prevMap, sendAsset: true }));
    updateTransactionType({
      sendStateOverride: { ...sendState, asset: newAsset },
    });

    if (propagateChanges) {
      setCallbackChangeMap({
        sendAsset: true,
        receiveAsset: false,
        sendAmount: false,
        receiveAmount: false,
      });
    }
  };

  const updateReceiveAsset = (newAsset: Asset, propagate: boolean = false) => {
    setReceiveState(prevState => ({
      ...prevState,
      asset: {
        ...newAsset,
      },
    }));
    setChangeMap(prevMap => ({
      ...prevMap,
      receiveAsset: true,
    }));
    updateTransactionType({
      receiveStateOverride: { ...receiveState, asset: newAsset },
    });

    if (propagate) {
      setCallbackChangeMap({
        sendAsset: false,
        receiveAsset: true,
        sendAmount: false,
        receiveAmount: false,
      });
    }
  };

  const updateSendAmount = async (newSendAmount: number, propagateChanges: boolean = false) => {
    const sendAsset = sendState.asset;
    if (!sendAsset) return;

    setSendState(prev => ({ ...prev, amount: newSendAmount }));
    updateTransactionType({
      sendStateOverride: { ...sendState, amount: newSendAmount },
    });
    setLastEditTime(Date.now());

    if (propagateChanges) {
      setChangeMap(prevMap => ({
        ...prevMap,
        sendAmount: true,
      }));

      setCallbackChangeMap({
        sendAsset: false,
        receiveAsset: false,
        sendAmount: true,
        receiveAmount: false,
      });
    }
  };

  const updateReceiveAmount = async (
    newReceiveAmount: number,
    propagateChanges: boolean = false,
  ) => {
    const receiveAsset = receiveState.asset;
    if (!receiveAsset) return;

    setReceiveState(prevState => ({
      ...prevState,
      amount: newReceiveAmount,
    }));
    updateTransactionType({
      receiveStateOverride: { ...receiveState, amount: newReceiveAmount },
    });
    setLastEditTime(Date.now());

    if (propagateChanges) {
      setChangeMap(prevMap => ({
        ...prevMap,
        receiveAmount: true,
      }));
      setCallbackChangeMap({
        sendAsset: false,
        receiveAsset: false,
        sendAmount: false,
        receiveAmount: true,
      });
    }
  };

  const updateTransactionType = async ({
    sendStateOverride = sendState,
    receiveStateOverride = receiveState,
  }: {
    sendStateOverride?: TransactionState;
    receiveStateOverride?: TransactionState;
  } = {}) => {
    const sendAsset = sendStateOverride.asset;
    const receiveAsset = receiveStateOverride.asset;
    const network = sendStateOverride.networkLevel;

    if (!sendAsset || !receiveAsset) {
      console.error('Missing assets for transaction type update');
      return;
    }

    try {
      const isIBCEnabled = await isIBC({
        sendAddress: walletState.address,
        recipientAddress,
        network,
      });

      const isSwapEnabled = isValidSwap({ sendAsset, receiveAsset });
      const isValidTransactionEnabled = await isValidTransaction({
        sendAddress: walletState.address,
        recipientAddress,
        sendState: sendStateOverride,
        receiveState: receiveStateOverride,
      });

      const newTransactionType = {
        isIBC: isIBCEnabled,
        isSwap: isSwapEnabled,
        isValid: isValidTransactionEnabled,
      };

      console.log('Computed transaction type:', newTransactionType);
      setTransactionType(newTransactionType);

      const maxSendable = calculateMaxAvailable(sendAsset);
      const applicableExchangeRate = sendAsset.denom === receiveAsset.denom ? 1 : exchangeRate || 1;
      const maxReceivable = maxSendable * applicableExchangeRate;

      setSendPlaceholder(
        `Max: ${formatBalanceDisplay(`${maxSendable}`, sendAsset.symbol || 'MLD')}`,
      );
      setReceivePlaceholder(
        !newTransactionType.isSwap
          ? 'No exchange on current pair'
          : `Max: ${removeTrailingZeroes(maxReceivable)}${receiveAsset.symbol}`,
      );

      return newTransactionType;
    } catch (error) {
      console.error('Error updating transaction type:', error);
    }

    return {
      isIBC: false,
      isSwap: false,
      isValid: false,
    };
  };

  const switchFields = () => {
    const sendAsset = sendState.asset as Asset;
    const receiveAsset = receiveState.asset as Asset;
    const receiveAmount = receiveState.amount;

    if (sendAsset.denom !== receiveAsset.denom) {
      updateReceiveAsset(sendAsset);
      updateSendAmount(receiveAmount);
      updateSendAsset(receiveAsset, true);
    }
  };

  const propagateChanges = (
    map = changeMap,
    setMap = setChangeMap,
    isExchangeRateUpdate = false,
  ) => {
    if (map.sendAsset) {
      const sendAsset = sendState.asset;
      const sendAmount = sendState.amount;
      if (!sendAsset) return;

      const maxAvailable = calculateMaxAvailable(sendAsset);

      if (sendAmount > maxAvailable) {
        const newSendAmount = maxAvailable;
        const newReceiveAmount = newSendAmount * (exchangeRate || 1);

        updateSendAmount(newSendAmount);
        updateReceiveAmount(newReceiveAmount);
      } else {
        const newReceiveAmount = sendAmount * (exchangeRate || 1);
        updateReceiveAmount(newReceiveAmount);
      }

      if (!isExchangeRateUpdate) {
        setMap(prevMap => ({ ...prevMap, sendAsset: false }));
      }
    }

    if (map.receiveAsset) {
      const sendAmount = sendState.amount;
      const newReceiveAmount = sendAmount * (exchangeRate || 1);

      updateReceiveAmount(newReceiveAmount);

      if (!isExchangeRateUpdate) {
        setMap(prevMap => ({ ...prevMap, receiveAsset: false }));
      }
    }

    if (map.sendAmount) {
      const sendAsset = sendState.asset;
      if (!sendAsset) return;

      const sendAmount = sendState.amount;
      const maxAvailable = calculateMaxAvailable(sendAsset);
      const verifiedSendAmount = Math.min(sendAmount, maxAvailable);

      if (verifiedSendAmount !== sendAmount) {
        updateSendAmount(verifiedSendAmount);
      }

      const applicableExchangeRate =
        sendAsset.denom === receiveState.asset?.denom ? 1 : exchangeRate || 1;
      const newReceiveAmount = verifiedSendAmount * applicableExchangeRate;

      updateReceiveAmount(newReceiveAmount);

      if (!isExchangeRateUpdate) {
        setMap(prevMap => ({ ...prevMap, sendAmount: false }));
      }
    }

    if (map.receiveAmount) {
      const sendAsset = sendState.asset;
      if (!sendAsset) return;

      const receiveAmount = receiveState.amount;
      const applicableExchangeRate =
        sendAsset.denom === receiveState.asset?.denom ? 1 : 1 / (exchangeRate || 1);
      let newSendAmount = receiveAmount * applicableExchangeRate;
      const maxAvailable = calculateMaxAvailable(sendAsset);

      if (newSendAmount > maxAvailable) {
        newSendAmount = maxAvailable;
        const adjustedReceiveAmount = newSendAmount * (exchangeRate || 1);

        updateSendAmount(newSendAmount);
        updateReceiveAmount(adjustedReceiveAmount);
      } else {
        updateSendAmount(newSendAmount);
      }

      if (!isExchangeRateUpdate) {
        setMap(prevMap => ({ ...prevMap, receiveAmount: false }));
      }
    }
  };

  const setMaxAmount = (type: 'send' | 'receive') => {
    const asset = type === 'send' ? sendState.asset : receiveState.asset;
    if (!asset) return;

    const maxAvailable = calculateMaxAvailable(asset);
    if (type === 'send') {
      updateSendAmount(maxAvailable, true);
    } else {
      const applicableExchangeRate =
        sendState.asset.denom === receiveState.asset.denom ? 1 : exchangeRate || 1;
      updateReceiveAmount(maxAvailable * applicableExchangeRate, true);
    }
  };

  const clearAmount = () => {
    setSendState(prev => ({ ...prev, amount: 0 }));
    setReceiveState(prev => ({ ...prev, amount: 0 }));

    setChangeMap(prevMap => ({
      ...prevMap,
      sendAmount: false,
      receiveAmount: false,
    }));

    setCallbackChangeMap({
      sendAsset: false,
      receiveAsset: false,
      sendAmount: false,
      receiveAmount: false,
    });
  };

  const resetStates = () => {
    console.log('resetting states');
    setSendState(defaultSendState);
    setReceiveState(defaultReceiveState);
    setRecipientAddress('');
    setSelectedAsset(DEFAULT_ASSET);
    setFeeState(prev => ({
      ...prev,
      asset: defaultSendState.asset,
      amount: 0,
    }));
  };

  const runSimulation = async () => {
    console.log(`[runSimulation] Triggered.  current sendstate: ${sendState.amount}`);
    if (
      isNaN(sendState.amount) ||
      sendState.amount === 0 ||
      isNaN(receiveState.amount) ||
      receiveState.amount === 0
    ) {
      setTransactionLog({ isSimulation: false, entries: [] });

      setFeeState(prev => ({
        ...prev,
        asset: sendState.asset,
        amount: 0,
      }));
      return;
    }

    const simulationResponse = await handleTransaction({ simulateTransaction: true });

    if (simulationResponse && simulationResponse.data) {
      const gasWanted = parseInt(simulationResponse.data.gasWanted || '0', 10);
      const defaultGasPrice = 0.025;
      const exponent = sendState.asset?.exponent || GREATER_EXPONENT_DEFAULT;
      const feeAmount = gasWanted * defaultGasPrice;
      const feeInGreaterUnit = feeAmount / Math.pow(10, exponent);

      // Update fee state
      setFeeState(prevState => ({
        ...prevState,
        asset: sendState.asset,
        amount: feeInGreaterUnit,
      }));

      // Recalculate max available based on new fee
      const maxAvailable = calculateMaxAvailable(sendState.asset, feeAmount);

      console.log('Max available after fee:', maxAvailable);

      // Ensure send amount does not exceed max available
      const finalSendAmount = Math.min(sendState.amount, maxAvailable);
      console.log('Final send amount after fee adjustment:', finalSendAmount);

      const applicableExchangeRate =
        sendState.asset?.denom === receiveState.asset?.denom ? 1 : exchangeRate || 1;
      const newReceiveAmount = finalSendAmount * applicableExchangeRate;

      setSendState(prevState => ({
        ...prevState,
        amount: finalSendAmount,
      }));

      setReceiveState(prevState => ({
        ...prevState,
        amount: newReceiveAmount,
      }));

      updateTransactionType({
        sendStateOverride: { ...sendState, amount: finalSendAmount },
        receiveStateOverride: { ...receiveState, amount: newReceiveAmount },
      });
    } else {
      console.error('Failed to retrieve fee details during simulation.');
    }
  };

  useEffect(() => {
    propagateChanges();
  }, [changeMap]);

  useEffect(() => {
    const hasPendingChanges = Object.values(changeMap).some(Boolean);

    console.log('[useEffect] hasPendingChanges:', hasPendingChanges);
    console.log('[useEffect] sendState.amount:', sendState.amount);
    console.log('[useEffect] receiveState.amount:', receiveState.amount);
    console.log('[changeMap]', changeMap);

    if (
      !hasPendingChanges &&
      ((sendState.amount > 0 && receiveState.amount > 0) ||
        (isNaN(sendState.amount) && isNaN(receiveState.amount)))
    ) {
      const now = Date.now();
      const timeSinceLastEdit = now - lastEditTime;

      if (timeSinceLastEdit >= 300) {
        runSimulation();
      } else {
        const timeout = setTimeout(() => {
          runSimulation();
        }, 300 - timeSinceLastEdit);
        return () => clearTimeout(timeout);
      }
    }
  }, [changeMap, sendState.amount, receiveState.amount]);

  useEffect(() => {
    const exponent = sendState.asset?.exponent || GREATER_EXPONENT_DEFAULT;
    const symbol = feeState.asset;
    const feeAmount = feeState.amount;
    const feeInGreaterUnit = feeAmount / Math.pow(10, exponent);

    const feePercentage =
      sendState.amount === 0
        ? 0
        : feeInGreaterUnit
          ? (feeInGreaterUnit / sendState.amount) * 100
          : 0;

    setSimulatedFee({
      fee: formatBalanceDisplay(feeAmount.toFixed(exponent), symbol.symbol || 'MLD'),
      textClass:
        feePercentage > 1 ? 'text-error' : feePercentage > 0.75 ? 'text-warn' : 'text-blue',
    });
  }, [feeState]);

  // Update on late exchangeRate returns
  useEffect(() => {
    propagateChanges(callbackChangeMap, setCallbackChangeMap, true);
  }, [exchangeRate]);

  useEffect(() => {
    console.log('recipient address updated to', recipientAddress);
    updateTransactionType();

    const simulateIfValid = async () => {
      const newTransactionType = await updateTransactionType();
      const currentAddress = recipientAddress || walletState.address;

      const shouldSimulate =
        sendState.amount > 0 && addressVerified && newTransactionType?.isValid && !!currentAddress;

      if (shouldSimulate) {
        await handleTransaction({ simulateTransaction: true });
      }
    };

    simulateIfValid();
  }, [recipientAddress]);

  useEffect(() => {
    setUserIsOnPage(true);
    setRecipientAddress(walletState.address);
    setAddressVerified(true);
    updateSendAsset(selectedAsset);
    updateReceiveAsset(selectedAsset);

    return () => {
      setUserIsOnPage(false);
      // Reset the states when the component is unmounted (user leaves the page)
      resetStates();
    };
  }, []);

  const handleBackClick = () => {
    resetStates();
    setUserIsOnPage(false);
  };

  if (location.pathname === ROUTES.APP.SEND && transactionState.isSuccess) {
    return <WalletSuccessScreen caption="Transaction success!" txHash={transactionState.txHash} />;
  }

  return (
    <div className="h-screen flex flex-col bg-black text-white">
      <Header title={'Send'} onClose={handleBackClick} useArrow={true} />

      {/* Content container */}
      <div className="flex flex-col justify-between flex-grow p-4 rounded-lg overflow-y-auto">
        <>
          {/* TODO: add chain selection if self */}
          {/* Address Input */}
          <AddressInput
            addBottomMargin={false}
            updateReceiveAsset={updateReceiveAsset}
            updateTransactionType={updateTransactionType}
          />

          {/* Separator */}
          <Separator variant="top" />

          {/* Send Section */}
          <AssetInput
            placeholder={sendPlaceholder}
            variant="send"
            assetState={sendState.asset}
            amountState={sendState.amount}
            updateAsset={updateSendAsset}
            updateAmount={updateSendAmount}
            showClearAndMax
            disableButtons={isLoading}
            onClear={() => clearAmount()}
            onMax={() => setMaxAmount('send')}
            includeBottomMargin={false}
            addClearMaxMargin
          />

          {/* Separator with reverse icon */}
          <div className="flex justify-center mb-2">
            <Button className="rounded-md h-9 w-9 bg-neutral-3" onClick={switchFields}>
              <Swap />
            </Button>
          </div>

          {/* Receive Section */}
          <AssetInput
            placeholder={receivePlaceholder}
            variant="receive"
            assetState={receiveState.asset}
            amountState={receiveState.amount}
            updateAsset={updateReceiveAsset}
            updateAmount={updateReceiveAmount}
            showClearAndMax
            disableButtons={isLoading}
            onClear={() => clearAmount()}
            onMax={() => setMaxAmount('receive')}
            includeBottomMargin={false}
            addClearMaxMargin
          />
        </>

        {/* 
          TODO: add labels above text in fee block
          TODO: should be able to swap.  is it down or an error?  everything HXAU to HEUR is showing as 1 MLD.  HETH and HBTC are the only ones not
          TODO: view error then resolve to list
        */}

        {/* Info Section */}
        <div
          className={`flex flex-grow mx-2 my-4 border rounded-md border-neutral-4 justify-center ${
            isLoading || error ? 'items-center ' : 'flex-col items-start overflow-y-auto p-4'
          }`}
        >
          {isLoading && <Spinner className="h-16 w-16 animate-spin fill-blue" />}
          {error && <TransactionResultsTile isSuccess={false} size="sm" message={error} />}
          {!isLoading &&
            !error &&
            transactionLog.entries.map((entry, index) => {
              const { sendObject } = entry;
              const isIBC = sendState.chainName !== receiveState.chainName;
              const isSwap = sendState.asset?.denom !== receiveState.asset?.denom;

              const sendAssetSymbol =
                (sendState.chainName === DEFAULT_CHAIN_NAME
                  ? symphonyAssets.find(asset => asset.denom === sendState.asset?.denom)?.symbol
                  : sendState.asset?.symbol) || 'MLD';
              const exponent = sendState.asset?.exponent || GREATER_EXPONENT_DEFAULT;
              const sendReadableAmount = formatBalanceDisplay(
                convertToGreaterUnit(sendObject.amount, exponent).toFixed(exponent),
                sendAssetSymbol,
              );
              const receiveChainPrefix =
                Object.values(LOCAL_CHAIN_REGISTRY).find(
                  entry => entry.chainName?.toLowerCase() === receiveState.chainName.toLowerCase(),
                )?.prefix || '';

              let description = `Send ${sendReadableAmount}`;
              if (isIBC) {
                description += ` to ${truncateWalletAddress(receiveChainPrefix, sendObject.recipientAddress)}`;
              } else if (isSwap) {
                const receiveAsset = symphonyAssets.find(
                  asset => asset.denom === receiveState.asset?.denom,
                );

                description += ` → ${receiveAsset?.symbol} to ${truncateWalletAddress(
                  receiveChainPrefix,
                  sendObject.recipientAddress,
                )}`;
              } else {
                description += ` to ${truncateWalletAddress(receiveChainPrefix, sendObject.recipientAddress)}`;
              }
              description += ` on ${receiveState.chainName.charAt(0).toUpperCase()}${receiveState.chainName.slice(1)}`;

              return (
                <div
                  key={index}
                  className="flex justify-between items-center w-full text-sm text-white mb-1"
                >
                  <span className="text-left truncate">{description}</span>
                  <span className="text-right min-w-[2rem]">
                    {entry.isSuccess === true && transactionLog.isSimulation && (
                      <span className="text-success">✔</span>
                    )}
                    {entry.isSuccess === true && !transactionLog.isSimulation && (
                      <span className="text-success">✔✔</span>
                    )}
                    {entry.isSuccess !== true && <span className="text-gray-500">—</span>}
                  </span>
                </div>
              );
            })}
        </div>

        {/* Fee Section */}
        <div className="flex justify-between items-center text-blue text-sm font-bold mx-2">
          <p>Fee</p>
          <p className={simulatedFee?.textClass}>
            {simulatedFee && sendState.amount !== 0 ? simulatedFee?.fee : '-'}
          </p>
        </div>

        {/* Separator */}
        <div className="mt-2">
          <Separator variant="top" />

          {/* Send Button */}
          <Button
            className="w-[85%]"
            onClick={() => handleTransaction()}
            disabled={isLoading || sendState.amount === 0 || !transactionType.isValid}
          >
            Send
          </Button>
        </div>
      </div>
    </div>
  );
};
