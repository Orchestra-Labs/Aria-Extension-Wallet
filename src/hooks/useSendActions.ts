import { useAtom, useAtomValue, useSetAtom } from 'jotai';
import {
  transactionStatusAtom,
  transactionTypeAtom,
  sendStateAtom,
  receiveStateAtom,
  chainWalletAtom,
  recipientAddressAtom,
  feeStateAtom,
  transactionLogAtom,
  addTransactionLogEntryAtom,
  updateTransactionLogEntryAtom,
  networkLevelAtom,
  chainInfoAtom,
} from '@/atoms';
import { TransactionStatus } from '@/constants';
import { Asset, IBCObject, SendObject, TransactionResult, TransactionState } from '@/types';
import { handleTransactionError, handleTransactionSuccess } from '@/helpers/transactionHandlers';
import {
  getValidIBCChannel,
  sendIBCTransaction,
  sendTransaction,
  swapTransaction,
} from '@/helpers';
import { useRefreshData } from './useRefreshData';

// TODO: set toast for if not on original page
// TODO: ensure if sending with no receive address value, user sends to self on send address value
export const useSendActions = () => {
  const { refreshData } = useRefreshData();

  console.log('[useTransactionHandler] Initializing hook');
  // Get all required state values at the hook level
  const sendState = useAtomValue(sendStateAtom);
  const receiveState = useAtomValue(receiveStateAtom);
  const walletState = useAtomValue(chainWalletAtom(sendState.chainID));
  const recipientAddress = useAtomValue(recipientAddressAtom);
  const transactionType = useAtomValue(transactionTypeAtom);
  const [feeState, setFeeState] = useAtom(feeStateAtom);
  const setTransactionStatus = useSetAtom(transactionStatusAtom);
  const addLogEntry = useSetAtom(addTransactionLogEntryAtom);
  const updateLogEntry = useSetAtom(updateTransactionLogEntryAtom);
  const transactionLog = useAtomValue(transactionLogAtom);
  const networkLevel = useAtomValue(networkLevelAtom);
  const getChainInfo = useAtomValue(chainInfoAtom);

  console.log('[useTransactionHandler] Current state:', {
    sendState,
    receiveState,
    walletState: walletState ? walletState : null,
    recipientAddress,
    transactionType,
  });

  const executeSend = async ({
    sendObject,
    simulateTransaction,
  }: {
    sendObject: SendObject;
    simulateTransaction: boolean;
  }): Promise<TransactionResult> => {
    console.group('[executeSend] Starting standard send transaction');
    try {
      const sendChain = getChainInfo(sendState.chainID);
      const prefix = sendChain.bech32_prefix;
      const rpcUris = sendChain.rpc_uris;

      return await sendTransaction(
        walletState.address,
        sendObject,
        simulateTransaction,
        prefix,
        rpcUris,
      );
    } finally {
      console.groupEnd();
    }
  };

  const executeIBC = async ({
    sendObject,
    simulateTransaction,
  }: {
    sendObject: SendObject;
    simulateTransaction: boolean;
  }): Promise<TransactionResult> => {
    console.group('[executeIBC] Starting IBC transaction');
    try {
      const sendChain = getChainInfo(sendState.chainID);
      const validChannel = await getValidIBCChannel({
        sendChain,
        receiveChainId: receiveState.chainID,
        networkLevel,
        prefix: sendChain.bech32_prefix,
        restUris: sendChain.rest_uris,
      });

      if (!validChannel) {
        return {
          success: false,
          message: 'No valid IBC channel found for this connection',
        };
      }

      const ibcObject: IBCObject = {
        fromAddress: walletState.address,
        sendObject,
        ibcChannel: {
          channel_id: validChannel.channel_id,
          port_id: validChannel.port_id,
        },
      };

      return await sendIBCTransaction({
        ibcObject,
        prefix: sendChain.bech32_prefix,
        rpcUris: sendChain.rpc_uris,
        simulateOnly: simulateTransaction,
      });
    } finally {
      console.groupEnd();
    }
  };

  const executeSwap = async ({
    sendObject,
    receiveAsset,
    simulateTransaction,
  }: {
    sendObject: SendObject;
    receiveAsset: Asset;
    simulateTransaction: boolean;
  }): Promise<TransactionResult> => {
    console.group('[executeSwap] Starting swap transaction');
    try {
      const swapParams = {
        sendObject,
        resultDenom: receiveAsset.denom,
      };
      const sendChain = getChainInfo(sendState.chainID);
      const restUris = sendChain.rest_uris;

      return await swapTransaction(walletState.address, swapParams, restUris, simulateTransaction);
    } finally {
      console.groupEnd();
    }
  };

  const formatTransactionDescription = (
    sendState: TransactionState,
    recipientAddress: string,
    isIBC: boolean,
  ) => {
    const amount = `${sendState.amount} ${sendState.asset.symbol}`;
    const toAddress = recipientAddress
      ? `to ${recipientAddress.substring(0, 10)}...${recipientAddress.substring(recipientAddress.length - 5)}`
      : '';
    const chainInfo = isIBC ? ` on ${sendState.chainID}` : '';

    return `Send ${amount} ${toAddress}${chainInfo}`;
  };

  const handleTransaction = async ({
    isSimulation = false,
  } = {}): Promise<TransactionResult | null> => {
    console.log('[useTransactionHandler] Starting transaction');

    const description = formatTransactionDescription(
      sendState,
      recipientAddress,
      transactionType.isIBC,
    );

    const hasExistingEntries = transactionLog.entries.length > 0;

    // Add or update log entry based on existing entries
    let logIndex = 0;
    if (!hasExistingEntries) {
      // Add new entry if no existing logs
      addLogEntry({
        description,
        status: TransactionStatus.LOADING,
      });
    } else {
      // Update entry if logs exist
      // TODO: update to handle multi-step transactions
      logIndex = 0;
      updateLogEntry({
        index: logIndex,
        updates: {
          description,
          status: TransactionStatus.LOADING,
        },
      });
    }

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
      console.log('[useTransactionHandler] Current transactiontype:', transactionType);

      let result: TransactionResult;
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

      console.log('[useTransactionHandler] Result:', result);

      // Update transaction log
      const success = result?.data?.code === 0;

      // Update log entry with result
      updateLogEntry({
        // TODO: update with index for multi-step transactions
        index: 0,
        updates: {
          status: success ? TransactionStatus.SUCCESS : TransactionStatus.ERROR,
          description,
          ...(!success && { error: result.message }),
        },
      });

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
          handleTransactionSuccess(
            result.data.txHash || '',
            setTransactionStatus,
            transactionType.type,
          );
          setFeeState({
            ...feeState,
            amount: 0,
            gasWanted: 0,
            gasPrice: 0,
          });
          refreshData({ wallet: true });
        }

        return result;
      } else {
        const errorMessage = `Transaction failed: ${result.message || 'Unknown error'}`;
        console.error('[useTransactionHandler]', errorMessage);
        handleTransactionError(errorMessage, setTransactionStatus, transactionType.type);
        return null;
      }
    } catch (error) {
      const errorMessage = `Transaction failed: ${
        error instanceof Error ? error.message : String(error)
      }`;
      console.error('[useTransactionHandler] Caught error:', error);
      handleTransactionError(errorMessage, setTransactionStatus, transactionType.type);
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
  };
};
