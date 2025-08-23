import { useAtomValue, useSetAtom } from 'jotai';
import {
  sendStateAtom,
  receiveStateAtom,
  chainWalletAtom,
  recipientAddressAtom,
  networkLevelAtom,
  chainInfoAtom,
  transactionRouteAtom,
  updateTxStepLogAtom,
  resetRouteStatusAtom,
  simulationInvalidationAtom,
} from '@/atoms';
import { TransactionStatus, TransactionType } from '@/constants';
import { Asset, IBCObject, SendObject, TransactionResult, TransactionStep } from '@/types';
import {
  getRoute,
  getTransactionMessages,
  getValidIBCChannel,
  sendIBCTransaction,
  sendTransaction,
  swapTransaction,
} from '@/helpers';
import { useRefreshData } from './useRefreshData';
import { transactionLogsAtom } from '@/atoms/transactionLogsAtom';

// TODO: set toast for if not on original page
// TODO: ensure if sending with no receive address value, user sends to self on send address value
export const useSendActions = () => {
  const { refreshData } = useRefreshData();

  // Get all required state values at the hook level
  const sendState = useAtomValue(sendStateAtom);
  const receiveState = useAtomValue(receiveStateAtom);
  const walletState = useAtomValue(chainWalletAtom(sendState.chainId));
  const recipientAddress = useAtomValue(recipientAddressAtom);
  const networkLevel = useAtomValue(networkLevelAtom);
  const getChainInfo = useAtomValue(chainInfoAtom);
  const txRoute = useAtomValue(transactionRouteAtom);
  const txLogs = useAtomValue(transactionLogsAtom);
  const updateStepLog = useSetAtom(updateTxStepLogAtom);
  const resetRouteStatus = useSetAtom(resetRouteStatusAtom);
  const setSimulationInvalidation = useSetAtom(simulationInvalidationAtom);

  const executeSend = async ({
    sendObject,
    simulateTransaction,
  }: {
    sendObject: SendObject;
    simulateTransaction: boolean;
  }): Promise<TransactionResult> => {
    console.log('[executeSend] Starting standard send transaction', sendObject);
    const sendChain = getChainInfo(sendState.chainId);
    const prefix = sendChain.bech32_prefix;
    const rpcUris = sendChain.rpc_uris;
    console.log(`[executeSend] Using prefix: ${prefix} for chain: ${sendState.chainId}`);

    return await sendTransaction({
      fromAddress: walletState.address,
      sendObject,
      prefix,
      rpcUris,
      chainId: sendState.chainId,
      simulateOnly: simulateTransaction,
    });
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
    const swapParams = {
      sendObject,
      resultDenom: receiveAsset.denom, // need to use current denom here so it fails if ibc
    };
    const sendChain = getChainInfo(sendState.chainId);
    const restUris = sendChain.rest_uris;

    return await swapTransaction({
      fromAddress: walletState.address,
      swapObject: swapParams,
      rpcUris: restUris,
      chainId: sendState.chainId,
      simulateOnly: simulateTransaction,
    });
  };

  const executeIBC = async ({
    sendObject,
    simulateTransaction,
  }: {
    sendObject: SendObject;
    simulateTransaction: boolean;
  }): Promise<TransactionResult> => {
    console.log('[useSendActions] executeIBC - Starting IBC transaction');
    try {
      const sendChain = getChainInfo(sendState.chainId);
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
        chainId: sendState.chainId,
        simulateOnly: simulateTransaction,
      });
    } catch (error) {
      console.error('IBC transaction failed:', error);
      return {
        success: false,
        message: error instanceof Error ? error.message : 'IBC transaction failed',
      };
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
    console.log('[executeSkipTx] Starting IBC via Skip');
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

      if (!routeResponse.operations?.length) {
        throw new Error('No valid IBC route found');
      }

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
    }
  };

  const executeStep = async (
    step: TransactionStep,
    isSimulation: boolean,
  ): Promise<TransactionResult> => {
    const stepLog = txLogs[step.hash];
    const feeToken = stepLog?.fee?.feeToken;

    const sendObject: SendObject = {
      recipientAddress: recipientAddress || walletState.address,
      amount: sendState.amount.toString(),
      denom: step.fromAsset.denom,
      feeToken,
    };

    switch (step.type) {
      case TransactionType.SEND:
        return await executeSend({ sendObject, simulateTransaction: isSimulation });
      case TransactionType.SWAP:
        return await executeStablecoinSwap({
          sendObject,
          receiveAsset: step.toAsset,
          simulateTransaction: isSimulation,
        });
      case TransactionType.IBC_SEND:
        return await executeIBC({ sendObject, simulateTransaction: isSimulation });
      case TransactionType.EXCHANGE:
        return await executeSkipTx({
          sendObject,
          receiveAssetDenom: step.toAsset.denom,
          simulateTransaction: isSimulation,
        });
      default:
        throw new Error(`Unsupported transaction type: ${step.type}`);
    }
  };

  const executeTransactionRoute = async (isSimulation: boolean): Promise<TransactionResult> => {
    console.log('[executeTransactionRoute] Starting', {
      isSimulation,
      txRouteSteps: txRoute.steps.length,
      txRoute: txRoute,
    });

    resetRouteStatus(isSimulation);

    let result: TransactionResult = { success: true, message: '' };

    try {
      // Execute steps sequentially
      for (let i = 0; i < txRoute.steps.length; i++) {
        const step = txRoute.steps[i];

        console.log('[executeTransactionRoute] Processing step', {
          stepIndex: i,
          stepType: step.type,
          stepVia: step.via,
          fromChain: step.fromChain,
          toChain: step.toChain,
          fromAsset: step.fromAsset,
          toAsset: step.toAsset,
        });

        // Update step to pending
        updateStepLog({
          stepIndex: i,
          status: TransactionStatus.PENDING,
        });

        result = await executeStep(step, isSimulation);

        console.log('[executeTransactionRoute] Step result', {
          stepIndex: i,
          success: result.success,
          message: result.message,
          data: result.data,
        });

        if (!result.success) {
          console.error('[executeTransactionRoute] Step failed', {
            stepIndex: i,
            error: result.message,
          });

          // Update failed step to ERROR
          updateStepLog({
            stepIndex: i,
            status: TransactionStatus.ERROR,
            error: result.message,
          });

          // Mark all remaining steps as IDLE
          for (let j = i + 1; j < txRoute.steps.length; j++) {
            updateStepLog({
              stepIndex: j,
              status: TransactionStatus.IDLE,
            });
          }

          break;
        }

        let feeData = undefined;

        if (result.data) {
          // Handle different fee structures
          if (result.data.fee) {
            // For the structure shown in your logs {fee: {amount: Array, gas: string}}
            const feeAmount =
              result.data.fee.amount?.reduce(
                (total: number, fee: any) => total + parseInt(fee.amount || '0', 10),
                0,
              ) || 0;

            feeData = {
              gasWanted: result.data.fee.gas || result.data.gasWanted,
              amount: feeAmount,
            };
          } else {
            // For the expected structure {gasWanted: string, gasPrice: string}
            feeData = {
              gasWanted: result.data.gasWanted,
              amount: result.data.fees
                ? result.data.fees.reduce(
                    (total: number, fee: any) => total + parseInt(fee.amount || '0', 10),
                    0,
                  )
                : undefined,
            };
          }
        }

        updateStepLog({
          stepIndex: i,
          status: TransactionStatus.SUCCESS,
          txHash: result.data?.txHash,
          feeData: feeData,
        });
      }

      // Complete transaction if it was successful
      if (result.success && !isSimulation) {
        console.log('[executeTransactionRoute] Transaction successful, refreshing data');
        refreshData({ wallet: true });
      }
    } catch (error) {
      console.error('[executeTransactionRoute] Unexpected error:', error);
      result = {
        success: false,
        message: error instanceof Error ? error.message : 'Unknown error occurred',
      };
    }

    console.log('[executeTransactionRoute] Final result:', result);
    return result;
  };

  const runTransaction = async (): Promise<TransactionResult> => {
    return executeTransactionRoute(false);
  };

  // In your useSendActions, add more logging:
  const runSimulation = async (): Promise<TransactionResult> => {
    console.log('[runSimulation] Function called at:', Date.now());
    try {
      const result = await executeTransactionRoute(true);

      setSimulationInvalidation(prev => ({
        ...prev,
        lastRunTimestamp: Date.now(),
      }));

      console.log('[runSimulation] Completed:', result);
      return result;
    } catch (error) {
      console.error('[runSimulation] Error:', error);

      setSimulationInvalidation(prev => ({
        ...prev,
        lastRunTimestamp: Date.now(),
      }));

      return {
        success: false,
        message: error instanceof Error ? error.message : 'Unknown error',
      };
    }
  };

  return {
    runTransaction,
    runSimulation,
  };
};
