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
  skipChainsAtom,
} from '@/atoms';
import { TransactionStatus } from '@/constants';
import { Asset, IBCObject, SendObject, TransactionResult, TransactionState } from '@/types';
import { handleTransactionError, handleTransactionSuccess } from '@/helpers/transactionHandlers';
import {
  getRoute,
  getTransactionMessages,
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
  const walletState = useAtomValue(chainWalletAtom(sendState.chainId));
  const recipientAddress = useAtomValue(recipientAddressAtom);
  const transactionType = useAtomValue(transactionTypeAtom);
  const [feeState, setFeeState] = useAtom(feeStateAtom);
  const setTransactionStatus = useSetAtom(transactionStatusAtom);
  const addLogEntry = useSetAtom(addTransactionLogEntryAtom);
  const updateLogEntry = useSetAtom(updateTransactionLogEntryAtom);
  const transactionLog = useAtomValue(transactionLogAtom);
  const networkLevel = useAtomValue(networkLevelAtom);
  const getChainInfo = useAtomValue(chainInfoAtom);
  const skipChains = useAtomValue(skipChainsAtom);

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
      const sendChain = getChainInfo(sendState.chainId);
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

  const executeStablecoinSwap = async ({
    sendObject,
    receiveAsset,
    simulateTransaction,
  }: {
    sendObject: SendObject;
    receiveAsset: Asset;
    simulateTransaction: boolean;
  }): Promise<TransactionResult> => {
    console.group('[executeSwap] Starting stablecoin swap transaction');
    try {
      // Fall back to direct swap if Skip fails or not simulation
      const swapParams = {
        sendObject,
        resultDenom: receiveAsset.denom, // need to use current denom here so it fails if ibc
      };
      const sendChain = getChainInfo(sendState.chainId);
      const restUris = sendChain.rest_uris;

      return await swapTransaction(walletState.address, swapParams, restUris, simulateTransaction);
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
    console.group('[useSendActions] executeIBC - Starting IBC transaction');
    try {
      const sendChain = getChainInfo(sendState.chainId);
      console.log('[useSendActions] Getting valid IBC channel for:', {
        sendChain: sendChain.chain_id,
        receiveChainId: receiveState.chainId,
      });

      const validChannel = await getValidIBCChannel({
        sendChain,
        receiveChainId: receiveState.chainId,
        networkLevel,
        prefix: sendChain.bech32_prefix,
        restUris: sendChain.rest_uris,
      });

      if (!validChannel) {
        console.error('[useSendActions] No valid IBC channel found');
        return {
          success: false,
          message: 'No valid IBC channel found for this connection',
        };
      }

      console.log('[useSendActions] Found valid IBC channel:', validChannel);
      const ibcObject: IBCObject = {
        fromAddress: walletState.address,
        sendObject,
        ibcChannel: {
          channel_id: validChannel.channel_id,
          port_id: validChannel.port_id,
        },
      };

      console.log('[useSendActions] Executing direct IBC transaction with:', ibcObject);
      return await sendIBCTransaction({
        ibcObject,
        prefix: sendChain.bech32_prefix,
        rpcUris: sendChain.rpc_uris,
        simulateOnly: simulateTransaction,
      });
    } catch (error) {
      console.error('IBC transaction failed:', error);
      return {
        success: false,
        message: error instanceof Error ? error.message : 'IBC transaction failed',
      };
    } finally {
      console.groupEnd();
    }
  };

  const executeSkipTx = async ({
    sendObject,
    receiveAssetDenom,
    simulateTransaction,
  }: {
    sendObject: SendObject;
    receiveAssetDenom: string;
    simulateTransaction: boolean;
  }): Promise<TransactionResult> => {
    console.group('[executeSkipTx] Starting IBC via Skip');
    console.log('[executeSkipTx] Send Object', sendObject);
    console.log('[executeSkipTx] Receive Asset Denom', receiveAssetDenom);
    try {
      const amountIn = (sendState.amount * Math.pow(10, sendState.asset.exponent)).toFixed(0);

      // First get the route
      const routeResponse = await getRoute(
        sendState.chainId,
        sendObject.denom, // need to use current denom here whether ibc or original
        receiveState.chainId,
        receiveAssetDenom,
        amountIn,
        { allow_multi_tx: true, allow_swaps: false },
      );

      console.log('[executeSkipTx] Route response:', JSON.stringify(routeResponse, null, 2));

      if (!routeResponse.operations?.length) {
        throw new Error('No valid IBC route found');
      }

      // Log each operation step
      routeResponse.operations.forEach((operation: any) => {
        const operationType = Object.keys(operation)[0]; // e.g. "axelar_transfer", "swap"
        const operationData = operation[operationType];

        let stepDescription = '';
        let feeInfo = null;

        if (operationType === 'swap') {
          stepDescription = `Swap ${sendObject.denom} into ${operationData.denom_out} on ${operationData.chain_id}`;
        } else {
          stepDescription = `${operationType} ${operationData.from_chain} to ${operationData.to_chain}`;
          feeInfo = {
            amount: operationData.fee_amount as string,
            denom: (operationData.fee_asset?.symbol || 'unknown') as string,
          };
        }

        addLogEntry({
          description: stepDescription,
          status: TransactionStatus.LOADING,
          routeStep: {
            operationType,
            fromChain: operationData.from_chain_id || operationData.chain_id,
            toChain: operationData.to_chain_id || operationData.chain_id,
            asset: operationData.asset || operationData.denom_in,
            estimatedFee: feeInfo || undefined,
          },
        });
      });

      const addressList = routeResponse.required_chain_addresses.map(() => walletState.address);
      const messagesResponse = await getTransactionMessages(
        sendState.chainId,
        sendObject.denom, // need to use current denom here whether ibc or original
        receiveState.chainId,
        receiveAssetDenom,
        amountIn,
        addressList,
        routeResponse.operations,
        routeResponse.estimated_amount_out,
        '0.25',
      );

      // Calculate total fees
      const totalFees =
        routeResponse.estimated_fees?.reduce(
          (total: number, fee: any) => total + parseInt(fee.amount || '0', 10),
          0,
        ) || 0;

      return {
        success: true,
        message: simulateTransaction ? 'Transaction simulation successful' : 'Transaction prepared',
        data: {
          code: 0,
          txHash: simulateTransaction ? 'simulated' : '',
          gasWanted: totalFees.toString(),
          route: routeResponse,
          estimatedAmountOut: routeResponse.estimated_amount_out,
          fees: routeResponse.estimated_fees,
          messages: messagesResponse.msgs,
          minAmountOut: messagesResponse.min_amount_out,
        },
      };
    } catch (error) {
      console.error('IBC via Skip failed:', error);
      return {
        success: false,
        message: error instanceof Error ? error.message : 'IBC via Skip failed',
      };
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
    const chainInfo = isIBC ? ` on ${sendState.chainId}` : '';

    return `Send ${amount} ${toAddress}${chainInfo}`;
  };

  const handleTransaction = async ({
    isSimulation = false,
  } = {}): Promise<TransactionResult | null> => {
    console.log('[useSendActions] handleTransaction - Starting transaction', { isSimulation });

    const description = formatTransactionDescription(
      sendState,
      recipientAddress,
      transactionType.isIBC,
    );
    console.log('[useSendActions] Transaction description:', description);

    const hasExistingEntries = transactionLog.entries.length > 0;
    console.log('[useSendActions] Existing transaction log entries:', hasExistingEntries);

    // TODO: move add log entry lines to the execute functions?  Need to be able to query for them AND update them
    // Log entry handling
    let logIndex = 0;
    if (!hasExistingEntries) {
      console.log('[useSendActions] Adding new transaction log entry');
      addLogEntry({
        description,
        status: TransactionStatus.LOADING,
      });
    } else {
      console.log('[useSendActions] Updating existing transaction log entry');
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
      console.log('[useSendActions] Setting transaction status to LOADING');
      setTransactionStatus({
        status: TransactionStatus.LOADING,
        txHash: '',
      });
    }

    try {
      console.log('[useSendActions] Current fee state:', feeState);
      const adjustedAmount = (sendState.amount * Math.pow(10, sendState.asset.exponent)).toFixed(0);
      console.log('[useSendActions] Adjusted amount:', adjustedAmount);

      const sendObject = {
        recipientAddress: recipientAddress || walletState.address,
        amount: adjustedAmount,
        denom: sendState.asset.denom, // need to use current denom here whether ibc or original
        feeToken: feeState.feeToken,
      };

      console.log('[useSendActions] Prepared send object:', sendObject);
      console.log('[useSendActions] Transaction type:', {
        isIBC: transactionType.isIBC,
        isSwap: transactionType.isSwap,
        isValid: transactionType.isValid,
      });

      // Check Skip support first
      const bothChainsSupported =
        skipChains.includes(sendState.chainId) && skipChains.includes(receiveState.chainId);
      console.log('[useSendActions] Both chains supported by Skip:', bothChainsSupported);

      let result: TransactionResult;
      if (transactionType.isIBC) {
        console.log('[useSendActions] Executing IBC transfer path');
        result = bothChainsSupported
          ? await executeSkipTx({
              sendObject,
              receiveAssetDenom: receiveState.asset.denom, // need to use current denom here regardless of if original chain or ibc
              simulateTransaction: isSimulation,
            })
          : await executeIBC({ sendObject, simulateTransaction: isSimulation });
      } else if (transactionType.isExchange) {
        result = await executeSkipTx({
          sendObject,
          receiveAssetDenom: receiveState.asset.denom, // need to use current denom here regardless of if original chain or ibc
          simulateTransaction: isSimulation,
        });
      } else if (transactionType.isSwap) {
        console.log('[useSendActions] Executing swap path');
        result = await executeStablecoinSwap({
          sendObject,
          simulateTransaction: isSimulation,
          receiveAsset: receiveState.asset,
        });
      } else {
        console.log('[useSendActions] Executing standard send path');
        result = await executeSend({ sendObject, simulateTransaction: isSimulation });
      }

      console.log('[useSendActions] Transaction result:', {
        success: result.success,
        code: result.data?.code,
        message: result.message,
      });

      const success = result?.data?.code === 0;
      console.log('[useSendActions] Transaction success status:', success);

      // Update log entry
      updateLogEntry({
        index: 0,
        updates: {
          status: success ? TransactionStatus.SUCCESS : TransactionStatus.ERROR,
          description,
          ...(!success && { error: result.message }),
        },
      });

      if (result.success && result.data?.code === 0) {
        console.log('[useSendActions] Handling successful transaction');
        if (isSimulation) {
          const gasWanted = parseInt(result.data.gasWanted || '0', 10);
          const gasPrice = feeState.feeToken.gasPriceStep.average;
          const feeInBaseUnits = gasWanted * gasPrice;

          console.log('[useSendActions] Simulation results:', {
            gasWanted,
            gasPrice,
            feeInBaseUnits,
          });

          setFeeState({
            ...feeState,
            amount: feeInBaseUnits,
            gasWanted,
            gasPrice,
          });

          console.log('[useSendActions] Updated fee state after simulation');
        } else {
          console.log('[useSendActions] Handling actual transaction success');
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
        console.error('[useSendActions] Transaction failed:', errorMessage);
        handleTransactionError(errorMessage, setTransactionStatus, transactionType.type);
        return null;
      }
    } catch (error) {
      const errorMessage = `Transaction failed: ${
        error instanceof Error ? error.message : String(error)
      }`;
      console.error('[useSendActions] Caught error in handleTransaction:', {
        error: errorMessage,
        stack: error instanceof Error ? error.stack : undefined,
      });
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
