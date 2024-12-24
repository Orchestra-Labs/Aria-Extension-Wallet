import { useEffect, useState } from 'react';
import { NavLink, useLocation } from 'react-router-dom';
import { ArrowLeft, Spinner, Swap } from '@/assets/icons';
import {
  DEFAULT_ASSET,
  defaultReceiveState,
  defaultSendState,
  GREATER_EXPONENT_DEFAULT,
  NetworkLevel,
  Position,
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
} from '@/atoms';
import { Asset, TransactionResult, TransactionSuccess } from '@/types';
import { AssetInput, WalletSuccessScreen, TransactionResultsTile } from '@/components';
import {
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
import Tooltip from '@/components/Tooltip/Tooltip';

const pageMountedKey = 'userIsOnPage';
const setUserIsOnPage = (isOnPage: boolean) => {
  console.log(`Setting user on page to: ${isOnPage}`);
  if (isOnPage) {
    removeSessionStorageItem(pageMountedKey);
  } else {
    setSessionStorageItem(pageMountedKey, 'false');
  }
  console.log(`Session storage after setting: ${getSessionStorageItem(pageMountedKey)}`);
};
const userIsOnPage = () => {
  const result = getSessionStorageItem(pageMountedKey) !== 'false';
  console.log(`Checking if user is on page (should be false if navigated away): ${result}`);
  return result;
};

// TODO: fix issue where navigation away is not clearing asset selection
export const Send = () => {
  const { refreshData } = useRefreshData();
  const { exchangeRate } = useExchangeRate();
  const { toast } = useToast();
  const location = useLocation();

  const [sendState, setSendState] = useAtom(sendStateAtom);
  const [receiveState, setReceiveState] = useAtom(receiveStateAtom);
  const [changeMap, setChangeMap] = useAtom(changeMapAtom);
  const [callbackChangeMap, setCallbackChangeMap] = useAtom(callbackChangeMapAtom);
  const [recipientAddress, setRecipientAddress] = useAtom(recipientAddressAtom);
  const addressVerified = useAtomValue(addressVerifiedAtom);
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

  const handleTransaction = async ({ simulateTransaction = false } = {}) => {
    console.log('Entering handleTransaction...');
    console.log('Current transaction type:', transactionType);

    if (!transactionType.isValid) return;

    let currentRecipientAddress = '';
    if (!addressVerified || !recipientAddress) {
      currentRecipientAddress = walletState.address;
    } else {
      currentRecipientAddress = recipientAddress;
    }

    if (!currentRecipientAddress) return;

    const sendAsset = sendState.asset;
    const sendAmount = sendState.amount;
    const receiveAsset = receiveState.asset;

    if (!sendAsset || !receiveAsset) return;

    const assetToSend = walletAssets.find(a => a.denom === sendAsset.denom);
    if (!assetToSend) return;

    const adjustedAmount = (
      sendAmount * Math.pow(10, assetToSend.exponent || GREATER_EXPONENT_DEFAULT)
    ).toFixed(0); // No decimals, minor unit

    const sendObject = {
      recipientAddress: currentRecipientAddress,
      amount: adjustedAmount,
      denom: sendAsset.denom,
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
        console.log('Executing sendTransaction');
        result = await sendTransaction(walletState.address, sendObject, simulateTransaction);
        console.log('sendTransaction result:', result);
      } else if (transactionType.isIBC) {
        const fromAddress = walletState.address;
        const sendChain = sendState.chainName;
        const receiveChain = receiveState.chainName;
        const networkLevel = NetworkLevel.TESTNET;
        const ibcObject = { fromAddress, sendObject, sendChain, receiveChain, networkLevel };
        console.log('Executing IBC Transaction with the following details:');
        console.log('From Address:', fromAddress);
        console.log('Send Chain:', sendChain);
        console.log('Receive Chain:', receiveChain);
        console.log('Network Level:', networkLevel);

        result = await sendIBC({ ibcObject, simulateTransaction });
        console.log('IBC Transaction Result:', result);
      } else if (transactionType.isSwap) {
        const swapObject = { sendObject, resultDenom: receiveAsset.denom };
        console.log('Executing swapTransaction with swapObject:', swapObject);
        result = await swapTransaction(walletState.address, swapObject, simulateTransaction);
        console.log('swapTransaction result:', result);
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

  const calculateMaxAvailable = (sendAsset: Asset) => {
    const walletAsset = walletAssets.find(asset => asset.denom === sendAsset.denom);
    if (!walletAsset) return 0;

    const maxAmount = parseFloat(walletAsset.amount || '0');
    const feeAmount = simulatedFee ? parseFloat(simulatedFee.fee) : 0;

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

    if (propagate) {
      setCallbackChangeMap({
        sendAsset: false,
        receiveAsset: true,
        sendAmount: false,
        receiveAmount: false,
      });
    }
  };

  const updateSendAmount = (newSendAmount: number, propagateChanges: boolean = false) => {
    const sendAsset = sendState.asset;
    if (!sendAsset) {
      return;
    }

    setSendState(prevState => {
      return {
        ...prevState,
        amount: newSendAmount,
      };
    });

    // Handle propagation of changes if required
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

  const updateReceiveAmount = (newReceiveAmount: number, propagateChanges: boolean = false) => {
    const receiveAsset = receiveState.asset;
    if (!receiveAsset) {
      console.log('No receive asset found');
      return;
    }

    setReceiveState(prevState => ({
      ...prevState,
      amount: newReceiveAmount,
    }));

    if (propagateChanges) {
      console.log('Propagating changes for receive amount');
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

  const updateFee = async () => {
    if (sendState.amount > 0 && transactionType.isValid) {
      const simulationResponse = await handleTransaction({ simulateTransaction: true });

      if (simulationResponse && simulationResponse.data) {
        const gasWanted = parseInt(simulationResponse.data.gasWanted || '0', 10);

        // TODO: get default gas price from chain registry
        const defaultGasPrice = 0.025;
        const exponent = sendState.asset?.exponent || GREATER_EXPONENT_DEFAULT;
        const symbol = sendState.asset.symbol || DEFAULT_ASSET.symbol || 'MLD';
        const feeAmount = gasWanted * defaultGasPrice;
        const feeInGreaterUnit = feeAmount / Math.pow(10, exponent);

        const feePercentage = feeInGreaterUnit ? (feeInGreaterUnit / sendState.amount) * 100 : 0;

        console.log('Fee details:', {
          feeAmount,
          feeInGreaterUnit,
          feePercentage,
        });

        setSimulatedFee({
          fee: formatBalanceDisplay(feeInGreaterUnit.toFixed(exponent), symbol),
          textClass:
            feePercentage > 1 ? 'text-error' : feePercentage > 0.75 ? 'text-warn' : 'text-blue',
        });
      } else {
        console.error('Simulation did not return gas details');
      }
    } else {
      setSimulatedFee({
        fee: '0 MLD',
        textClass: 'text-blue',
      });
    }
  };

  const updateTransactionType = async () => {
    const sendAsset = sendState.asset;
    const receiveAsset = receiveState.asset;
    const network = sendState.networkLevel;

    if (!sendAsset || !receiveAsset) {
      console.log('Missing assets for transaction type update');
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
        sendState,
        receiveState,
        network,
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

      console.log('Transaction placeholders:', {
        maxSendable,
        applicableExchangeRate,
        maxReceivable,
      });

      setSendPlaceholder(
        `Max: ${formatBalanceDisplay(`${maxSendable}`, sendAsset.symbol || 'MLD')}`,
      );
      setReceivePlaceholder(
        !newTransactionType.isSwap
          ? 'No exchange on current pair'
          : `Max: ${removeTrailingZeroes(maxReceivable)}${receiveAsset.symbol}`,
      );
    } catch (error) {
      console.error('Error updating transaction type:', error);
    }
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
    if (map.sendAsset || map.receiveAsset) {
      updateTransactionType();
    }

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

    // TODO: add fee update to changemap?
    updateFee();
  };

  const resetStates = () => {
    console.log('resetting states');
    setSendState(defaultSendState);
    setReceiveState(defaultReceiveState);
    setRecipientAddress('');
    setSelectedAsset(DEFAULT_ASSET);
  };

  useEffect(() => {
    propagateChanges();
  }, [changeMap]);

  // Update on late exchangeRate returns
  useEffect(() => {
    propagateChanges(callbackChangeMap, setCallbackChangeMap, true);
  }, [exchangeRate]);

  useEffect(() => {
    console.log('recipient address updated to', recipientAddress);
    updateTransactionType();
  }, [recipientAddress]);

  useEffect(() => {
    setUserIsOnPage(true);
    updateSendAsset(selectedAsset);
    updateReceiveAsset(selectedAsset);
    updateTransactionType();

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
      {/* Top bar with back button and title */}
      <div className="flex justify-between items-center w-full p-5">
        <NavLink
          to={ROUTES.APP.ROOT}
          className="flex items-center justify-center max-w-5 max-h-5 p-0.5"
          onClick={handleBackClick}
        >
          <ArrowLeft className="w-full h-full text-white" />
        </NavLink>

        <Tooltip tooltipText={'To swap, click the receive field icon'} position={Position.RIGHT}>
          <h1 className="text-h5 text-white font-bold">Send</h1>
        </Tooltip>

        <div className="max-w-5 w-full max-h-5" />
      </div>

      {/* Content container */}
      <div className="flex flex-col justify-between flex-grow p-4 border border-neutral-2 rounded-lg overflow-y-auto">
        <>
          {/* TODO: add chain selection if self */}
          {/* Address Input */}
          <AddressInput
            addBottomMargin={false}
            updateSendAsset={updateSendAsset}
            labelWidth="w-14"
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
            includeBottomMargin={false}
            labelWidth="w-14"
          />

          {/* Separator with reverse icon */}
          <div className="flex justify-center my-2">
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
            includeBottomMargin={false}
            labelWidth="w-14"
          />
        </>

        {/* Fee Section */}
        <div className="flex flex-grow items-center justify-center mx-2 my-4 border rounded-md border-neutral-4">
          {isLoading && <Spinner className="h-16 w-16 animate-spin fill-blue" />}
          {error && <TransactionResultsTile isSuccess={false} size="sm" message={error} />}
        </div>
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
