import { useAtom, useAtomValue, useSetAtom } from 'jotai';
import {
  sendStateAtom,
  receiveStateAtom,
  chainWalletAtom,
  recipientAddressAtom,
  feeStateAtom,
  networkLevelAtom,
  chainInfoAtom,
  transactionRouteAtom,
  updateRouteStepStatusAtom,
  resetRouteStatusAtom,
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

// TODO: set toast for if not on original page
// TODO: ensure if sending with no receive address value, user sends to self on send address value
export const useSendActions = () => {
  const { refreshData } = useRefreshData();

  // Get all required state values at the hook level
  const sendState = useAtomValue(sendStateAtom);
  const receiveState = useAtomValue(receiveStateAtom);
  const walletState = useAtomValue(chainWalletAtom(sendState.chainId));
  const recipientAddress = useAtomValue(recipientAddressAtom);
  // TODO: play around with fee state.  can't show for multiple cryptos currently, and can't show for just one step
  const [feeState, _] = useAtom(feeStateAtom);
  const networkLevel = useAtomValue(networkLevelAtom);
  const getChainInfo = useAtomValue(chainInfoAtom);
  const txRoute = useAtomValue(transactionRouteAtom);
  const updateStepStatus = useSetAtom(updateRouteStepStatusAtom);
  const resetRouteStatus = useSetAtom(resetRouteStatusAtom);

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
    } finally {
      console.groupEnd();
    }
  };

  const executeStep = async (
    step: TransactionStep,
    isSimulation: boolean,
  ): Promise<TransactionResult> => {
    const sendObject: SendObject = {
      recipientAddress: recipientAddress || walletState.address,
      amount: sendState.amount.toString(),
      denom: step.fromAsset.denom,
      feeToken: feeState.feeToken,
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
    // Reset route status if real transaction
    if (!isSimulation) {
      resetRouteStatus();
    }

    // Execute steps sequentially
    for (let i = 0; i < txRoute.steps.length; i++) {
      const step = txRoute.steps[i];

      // Update step to pending
      updateStepStatus({
        stepIndex: i,
        status: TransactionStatus.PENDING,
      });

      const result = await executeStep(step, isSimulation);

      if (!result.success) {
        updateStepStatus({
          stepIndex: i,
          status: TransactionStatus.ERROR,
          error: result.message,
        });
        return result;
      }

      updateStepStatus({
        stepIndex: i,
        status: TransactionStatus.SUCCESS,
        txHash: result.data?.txHash,
      });

      // For simulations, only execute first step
      if (isSimulation) return result;
    }

    // Complete transaction
    if (!isSimulation) {
      refreshData({ wallet: true });
    }

    return { success: true, message: '' };
  };

  const runTransaction = async (): Promise<TransactionResult> => {
    return executeTransactionRoute(false);
  };

  const runSimulation = async (): Promise<TransactionResult> => {
    return executeTransactionRoute(true);
  };

  return {
    runTransaction,
    runSimulation,
  };
};
