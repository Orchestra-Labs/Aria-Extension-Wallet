import { useAtom, useAtomValue, useSetAtom } from 'jotai';
import {
  executeSendAtom,
  executeIBCAtom,
  executeSwapAtom,
  // transactionLogAtom,
  transactionStatusAtom,
  transactionTypeAtom,
  sendStateAtom,
  receiveStateAtom,
  chainWalletAtom,
  recipientAddressAtom,
  feeStateAtom,
} from '@/atoms';
import { TransactionStatus } from '@/constants';
import { TransactionResult } from '@/types';

// TODO: set toast for if not on original page
// TODO: ensure if sending with no receive address value, user sends to self on send address value
export const useTransactionHandler = () => {
  console.log('[useTransactionHandler] Initializing hook');
  // Get all required state values at the hook level
  const sendState = useAtomValue(sendStateAtom);
  const receiveState = useAtomValue(receiveStateAtom);
  const walletState = useAtomValue(chainWalletAtom(sendState.chainID));
  const recipientAddress = useAtomValue(recipientAddressAtom);
  const transactionType = useAtomValue(transactionTypeAtom);
  const [feeState, setFeeState] = useAtom(feeStateAtom);

  console.log('[useTransactionHandler] Current state:', {
    sendState,
    receiveState,
    walletState: walletState ? { ...walletState, privateKey: '***' } : null,
    recipientAddress,
    transactionType,
  });

  // Action atoms
  const executeSend = useSetAtom(executeSendAtom);
  const executeIBC = useSetAtom(executeIBCAtom);
  const executeSwap = useSetAtom(executeSwapAtom);

  // State atoms
  // const [
  //   transactionLog,
  //   setTransactionLog
  // ] = useAtom(transactionLogAtom);
  const setTransactionStatus = useSetAtom(transactionStatusAtom);

  const delayClearTransactionStatus = () => {
    setTimeout(() => {
      setTransactionStatus(prev => ({
        ...prev,
        status: TransactionStatus.IDLE,
      }));
    }, 5000);
  };

  const handleTransactionSuccess = (txHash: string) => {
    console.log('[useTransactionHandler] Transaction successful with hash:', txHash);
    setTransactionStatus({
      status: TransactionStatus.SUCCESS,
      txHash,
    });

    delayClearTransactionStatus();
  };

  const handleTransactionError = (errorMessage: string) => {
    console.error('[useTransactionHandler] ', errorMessage);
    setTransactionStatus({
      status: TransactionStatus.ERROR,
      error: errorMessage,
    });

    delayClearTransactionStatus();
  };

  const handleTransaction = async ({ isSimulation = false } = {}) => {
    console.group('[useTransactionHandler] Starting transaction');

    if (!isSimulation) {
      console.log('[useTransactionHandler] Setting loading state');
      setTransactionStatus({
        status: TransactionStatus.LOADING,
        txHash: '',
      });
    }

    try {
      console.log('[useTransactionHandler] Current fee state:', feeState);
      const adjustedAmount = (sendState.amount * Math.pow(10, sendState.asset.exponent)).toFixed(0);

      const sendObject = {
        recipientAddress: recipientAddress || walletState.address,
        amount: adjustedAmount,
        denom: sendState.asset.denom,
        feeToken: feeState.feeToken,
      };

      console.log('[useTransactionHandler] Prepared send object:', sendObject);

      let result: TransactionResult;
      const startTime = performance.now();

      if (transactionType.isIBC) {
        console.log('[useTransactionHandler] Executing IBC transfer');
        result = await executeIBC({ sendObject, simulateTransaction: isSimulation });
      } else if (transactionType.isSwap) {
        console.log('[useTransactionHandler] Executing swap');
        result = await executeSwap({
          sendObject,
          simulateTransaction: isSimulation,
          receiveAsset: receiveState.asset,
        });
      } else {
        console.log('[useTransactionHandler] Executing standard send');
        result = await executeSend({ sendObject, simulateTransaction: isSimulation });
      }

      const duration = performance.now() - startTime;
      console.log(`[useTransactionHandler] Transaction completed in ${duration.toFixed(2)}ms`);
      console.log('[useTransactionHandler] Result:', result);

      // Update transaction log
      const logEntry = {
        isSimulation: isSimulation,
        entries: [
          {
            sendObject,
            isSuccess: result?.data?.code === 0,
          },
        ],
      };
      console.log('[useTransactionHandler] Updating transaction log:', logEntry);
      // setTransactionLog(logEntry);

      if (result.success && result.data?.code === 0) {
        console.log('[useTransactionHandler] Transaction successful');
        if (isSimulation) {
          const gasWanted = parseInt(result.data.gasWanted || '0', 10);
          const gasPrice = feeState.feeToken.gasPriceStep.average;
          const feeInBaseUnits = gasWanted * gasPrice;

          console.log('[useTransactionHandler] Updating fee state with simulation results', {
            gasWanted,
            gasPrice,
            feeInBaseUnits,
            currentFeeState: feeState,
          });

          setFeeState({
            ...feeState,
            amount: feeInBaseUnits,
            gasWanted,
            gasPrice,
          });

          console.log('[useTransactionHandler] Updated fee state');
        } else {
          handleTransactionSuccess(result.data.txHash || '');
          setFeeState({
            ...feeState,
            amount: 0,
            gasWanted: 0,
            gasPrice: 0,
          });
        }

        console.groupEnd();
        return result;
      } else {
        const errorMessage = `Transaction failed: ${result.message || 'Unknown error'}`;
        console.error('[useTransactionHandler]', errorMessage);
        handleTransactionError(errorMessage);
        console.groupEnd();
        return null;
      }
    } catch (error) {
      const errorMessage = `Transaction failed: ${
        error instanceof Error ? error.message : String(error)
      }`;
      console.error('[useTransactionHandler] Caught error:', error);
      handleTransactionError(errorMessage);
      console.groupEnd();
      return null;
    }
  };

  const runTransaction = async (): Promise<TransactionResult | null> => {
    return handleTransaction({ isSimulation: false });
  };

  const runSimulation = async (): Promise<TransactionResult | null> => {
    return handleTransaction({ isSimulation: true });
  };

  console.log('[useTransactionHandler] Hook initialization complete');

  return {
    runTransaction,
    runSimulation,
    // transactionLog,
  };
};
