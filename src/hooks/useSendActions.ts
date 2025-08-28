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
  transactionLogsAtom,
  fullRegistryChainInfoAtom,
  getChainWalletAtom,
  updateChainWalletAtom,
} from '@/atoms';
import { TransactionStatus, TransactionType } from '@/constants';
import {
  Asset,
  FeeToken,
  IBCObject,
  SendObject,
  SignedTransactionData,
  TransactionResult,
  TransactionStep,
  Uri,
} from '@/types';
import {
  createAndSignSkipTransaction,
  getAccountInfo,
  getAddressByChainPrefix,
  getBalances,
  getRoute,
  getSessionToken,
  getTransactionMessages,
  getValidIBCChannel,
  sendIBCTransaction,
  sendTransaction,
  submitTransaction,
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
  const getWalletInfo = useAtomValue(getChainWalletAtom);
  const walletState = useAtomValue(chainWalletAtom(sendState.chainId));
  const recipientAddress = useAtomValue(recipientAddressAtom);
  const networkLevel = useAtomValue(networkLevelAtom);
  const getChainInfo = useAtomValue(chainInfoAtom);
  const getFullRegistryChainInfo = useAtomValue(fullRegistryChainInfoAtom);

  const txRoute = useAtomValue(transactionRouteAtom);
  const txLogs = useAtomValue(transactionLogsAtom);
  const updateStepLog = useSetAtom(updateTxStepLogAtom);
  const resetRouteStatus = useSetAtom(resetRouteStatusAtom);
  const setSimulationInvalidation = useSetAtom(simulationInvalidationAtom);
  const updateChainWallet = useSetAtom(updateChainWalletAtom);

  // TODO: clean up.  not all of these functions need to be in this file
  const checkGasBalance = async ({
    address,
    feeToken,
    estimatedGas,
    chainId,
    restUris,
  }: {
    address: string;
    feeToken: FeeToken;
    estimatedGas: string;
    chainId: string;
    restUris: Uri[];
  }): Promise<{ hasSufficientBalance: boolean; balance: number; required: number }> => {
    try {
      console.log('[checkGasBalance] Starting gas balance check', {
        address,
        feeTokenDenom: feeToken.denom,
        estimatedGas,
        chainId,
      });

      // FIRST: Check if wallet exists in local atom state
      const chainWallet = getWalletInfo(chainId);

      // If wallet doesn't exist in local state, query the chain using getBalances
      if (!chainWallet) {
        console.log(
          '[BalanceCheck] Wallet not found in local state, querying chain using getBalances...',
        );

        const balances = await getBalances(address, restUris);
        console.log('[BalanceCheck] Retrieved balances from chain:', balances);

        const feeTokenBalance = balances.find((b: any) => {
          console.log(
            '[BalanceCheck] Comparing balance denom:',
            b.denom,
            'with fee token denom:',
            feeToken.denom,
          );
          return b.denom === feeToken.denom;
        });

        const currentBalance = feeTokenBalance ? parseInt(feeTokenBalance.amount) : 0;
        const gasPrice = feeToken.gasPriceStep.average;
        const requiredGas = Math.ceil(parseInt(estimatedGas) * gasPrice);

        console.log('[BalanceCheck] Chain query result:', {
          feeTokenFound: !!feeTokenBalance,
          currentBalance,
          requiredGas,
          hasSufficient: currentBalance >= requiredGas,
          gasPrice,
          estimatedGas,
        });

        return {
          hasSufficientBalance: currentBalance >= requiredGas,
          balance: currentBalance,
          required: requiredGas,
        };
      }

      // SECOND: Wallet exists in local state - use it for balance check
      console.log('[BalanceCheck] Using local wallet state for chain:', chainId);
      console.log('[BalanceCheck] Local wallet assets:', chainWallet.assets);

      const localFeeTokenBalance = chainWallet.assets.find((asset: any) => {
        console.log(
          '[BalanceCheck] Comparing asset denom:',
          asset.denom,
          'with fee token denom:',
          feeToken.denom,
        );
        return asset.denom === feeToken.denom;
      });

      if (!localFeeTokenBalance) {
        // Fee token not found in local assets, assume insufficient
        const gasPrice = feeToken.gasPriceStep.average;
        const requiredGas = Math.ceil(parseInt(estimatedGas) * gasPrice);

        console.log('[BalanceCheck] Fee token not found in local assets:', {
          feeToken: feeToken.denom,
          availableAssets: chainWallet.assets.map(a => ({
            denom: a.denom,
            originDenom: a.originDenom,
            symbol: a.symbol,
          })),
          requiredGas,
        });

        return {
          hasSufficientBalance: false,
          balance: 0,
          required: requiredGas,
        };
      }

      const localBalance = parseInt(localFeeTokenBalance.amount || '0');
      const gasPrice = feeToken.gasPriceStep.average;
      const requiredGas = Math.ceil(parseInt(estimatedGas) * gasPrice);

      console.log('[BalanceCheck] Using local wallet state:', {
        localFeeTokenBalance: {
          denom: localFeeTokenBalance.denom,
          originDenom: localFeeTokenBalance.originDenom,
          amount: localFeeTokenBalance.amount,
          symbol: localFeeTokenBalance.symbol,
        },
        localBalance,
        requiredGas,
        hasSufficient: localBalance >= requiredGas,
        gasPrice,
        estimatedGas,
      });

      return {
        hasSufficientBalance: localBalance >= requiredGas,
        balance: localBalance,
        required: requiredGas,
      };
    } catch (error) {
      console.error('Error checking gas balance:', error);

      // Fallback: if query fails, use pessimistic approach
      const gasPrice = feeToken.gasPriceStep.average;
      const requiredGas = Math.ceil(parseInt(estimatedGas) * gasPrice);

      console.log('[BalanceCheck] Error occurred, using fallback values:', {
        requiredGas,
        gasPrice,
        estimatedGas,
      });

      return {
        hasSufficientBalance: false,
        balance: 0,
        required: requiredGas,
      };
    }
  };

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
    receiveChainId,
    simulateTransaction,
  }: {
    sendObject: SendObject;
    receiveChainId: string;
    simulateTransaction: boolean;
  }): Promise<TransactionResult> => {
    console.log('[useSendActions] executeIBC - Starting IBC transaction');
    try {
      const sendChain = getChainInfo(sendState.chainId);
      const validChannel = await getValidIBCChannel({
        sendChain,
        receiveChainId,
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

  // TODO: enable amount out as an option (to handle billing)
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
      const amount = `${sendState.amount}`;

      const routeResponse = await getRoute({
        fromChainId: sendState.asset.originChainId,
        fromDenom: sendObject.denom,
        toChainId: receiveState.chainId,
        toDenom: receiveAssetDenom,
        amount,
      });

      if (!routeResponse.operations?.length) {
        throw new Error('No valid IBC route found');
      }

      const totalFees =
        routeResponse.estimated_fees?.reduce(
          (total: number, fee: any) => total + parseInt(fee.amount || '0', 10),
          0,
        ) || 0;

      if (simulateTransaction) {
        return {
          success: true,
          message: 'Transaction simulation successful',
          data: {
            code: 0,
            txHash: 'simulated',
            gasWanted: totalFees.toString(),
            route: routeResponse,
            estimatedAmountOut: routeResponse.estimated_amount_out,
            fees: routeResponse.estimated_fees,
          },
        };
      }

      const sessionToken = getSessionToken();
      if (!sessionToken) throw new Error("Session token doesn't exist");
      const mnemonic = sessionToken.mnemonic;

      const addressList = await Promise.all(
        routeResponse.required_chain_addresses.map(async (chainId: string) => {
          const chainInfo = getFullRegistryChainInfo(chainId);
          if (!chainInfo?.bech32_prefix) {
            throw new Error(`Prefix not found for ${chainInfo?.pretty_name || chainId} in path`);
          }
          const prefix = chainInfo.bech32_prefix;

          // FIRST: Check if wallet exists in local state
          const existingWallet = getWalletInfo(chainId);

          // If wallet exists and address has correct prefix, use it
          if (existingWallet?.address && existingWallet.address.startsWith(prefix)) {
            console.log(
              `[executeSkipTx] Using existing wallet for chain ${chainId}: ${existingWallet.address}`,
            );
            return existingWallet.address;
          }

          // SECOND: If no wallet exists, create a new address for this chain
          console.log(
            `[executeSkipTx] No wallet found for chain ${chainId}, generating new address`,
          );
          const newAddress = await getAddressByChainPrefix(mnemonic, prefix);

          // Update the chain wallet atom with the new address (empty assets for now)
          updateChainWallet({
            chainId,
            address: newAddress,
            assets: [], // Empty assets array, will be populated later by refresh
          });

          return newAddress;
        }),
      );

      const accountInfoPromises = addressList.map(async (address, index) => {
        const chainId = routeResponse.required_chain_addresses[index];
        const chainInfo = getFullRegistryChainInfo(chainId);
        if (!chainInfo) throw new Error(`Chain info not found for ${chainId}`);

        try {
          return await getAccountInfo(address, chainInfo.rest_uris);
        } catch (error) {
          console.warn(
            `[executeSkipTx] Failed to get account info for ${address} on ${chainId}:`,
            error,
          );
          // Return default account info for new addresses
          return {
            accountNumber: BigInt(0),
            sequence: BigInt(0),
          };
        }
      });

      const accountInfos = await Promise.all(accountInfoPromises);

      const messagesResponse = await getTransactionMessages({
        fromChainId: sendState.asset.originChainId,
        fromDenom: sendObject.denom,
        toChainId: receiveState.chainId,
        toDenom: receiveAssetDenom,
        amount,
        addressList,
        operations: routeResponse.operations,
        estimatedAmountOut: routeResponse.estimated_amount_out,
        slippageTolerancePercent: '0.25',
      });

      const signedTransactions: SignedTransactionData[] = [];
      for (const skipTx of messagesResponse.txs) {
        if (!skipTx.cosmos_tx) throw new Error('Missing cosmos_tx in Skip response');

        const chainId = skipTx.cosmos_tx.chain_id;
        const chainInfo = getChainInfo(chainId);
        if (!chainInfo) throw new Error(`Chain info not found for ${chainId}`);

        const addressIndex = routeResponse.required_chain_addresses.indexOf(chainId);
        const accountInfo = accountInfos[addressIndex];

        // Later when calling createAndSignSkipTransaction:
        const signedBase64 = await createAndSignSkipTransaction(
          mnemonic,
          chainInfo,
          skipTx.cosmos_tx,
          chainInfo.bech32_prefix,
          accountInfo.accountNumber, // Now a number
          accountInfo.sequence, // Now a number
        );

        signedTransactions.push({ chainId, signedTx: signedBase64 });
      }

      if (!signedTransactions.length) throw new Error('No transactions were signed');

      const submissionResult = await submitSignedTransactions(signedTransactions);
      if (!submissionResult.success) return submissionResult;

      return {
        success: true,
        message: 'Transactions signed and ready to send',
        data: {
          code: 0,
          txHash: submissionResult.data?.txHash || '',
          gasWanted: totalFees.toString(),
          route: routeResponse,
          estimatedAmountOut: routeResponse.estimated_amount_out,
          fees: routeResponse.estimated_fees,
          messages: messagesResponse.msgs,
          minAmountOut: messagesResponse.min_amount_out,
        },
      };
    } catch (error) {
      console.error('[useSendActions] IBC via Skip failed:', error);
      return {
        success: false,
        message: error instanceof Error ? error.message : 'IBC via Skip failed',
      };
    }
  };

  // Add function to submit signed Skip transactions
  const submitSkipTransactions = async (
    signedTransactions: SignedTransactionData[],
  ): Promise<TransactionResult> => {
    try {
      const results = await Promise.all(
        signedTransactions.map(async txData => {
          const result = await submitTransaction(txData.chainId, txData.signedTx);

          // Return only the necessary data without chainId
          return {
            success: result.success,
            message: result.message,
            txHash: result.data?.txHash,
            explorerLink: result.data?.explorerLink,
          };
        }),
      );

      const allSuccessful = results.every(result => result.success);

      return {
        success: allSuccessful,
        message: allSuccessful
          ? 'All transactions submitted successfully'
          : 'Some transactions failed to submit',
        data: {
          code: allSuccessful ? 0 : 1,
          skipTxResponse: results,
          txHash: results[0]?.txHash, // First transaction hash as primary
          gasWanted: '0',
        },
      };
    } catch (error) {
      console.error('Error submitting Skip transactions:', error);
      return {
        success: false,
        message: error instanceof Error ? error.message : 'Failed to submit transactions',
      };
    }
  };

  const submitSignedTransactions = async (
    transactions: SignedTransactionData[],
  ): Promise<TransactionResult> => {
    return await submitSkipTransactions(transactions); // Pass stepHash
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
        return await executeIBC({
          sendObject,
          receiveChainId: step.toChain,
          simulateTransaction: isSimulation,
        });
      case TransactionType.EXCHANGE:
        const skipSendObject: SendObject = {
          recipientAddress: recipientAddress || walletState.address,
          amount: sendState.amount.toString(),
          denom: step.fromAsset.originDenom, // Skip only recognizes the original denom
          feeToken,
        };
        return await executeSkipTx({
          sendObject: skipSendObject,
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
        const stepLog = txLogs[step.hash];
        const feeToken = stepLog?.fee?.feeToken;

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

        if (
          isSimulation &&
          result.success &&
          (step.type === TransactionType.IBC_SEND || step.type === TransactionType.EXCHANGE)
        ) {
          try {
            const fromChainInfo = getChainInfo(step.fromChain);

            if (!feeToken) {
              throw new Error('No fee token available for gas balance check');
            }

            // Get the actual gas estimate from the simulation result
            const estimatedGas = result.data?.gasWanted || '0'; // If no gas estimate provided, assume none

            // Check gas balance with the actual estimated gas
            const gasCheck = await checkGasBalance({
              address: walletState.address,
              feeToken,
              estimatedGas,
              chainId: step.fromChain,
              restUris: fromChainInfo.rest_uris,
            });

            if (!gasCheck.hasSufficientBalance) {
              // TODO: match symbol for this
              const errorMessage = `Insufficient ${stepLog.feeSymbol} for gas.`;

              console.error(
                '[executeTransactionRoute] Insufficient gas balance after simulation:',
                {
                  stepIndex: i,
                  stepType: step.type,
                  feeToken: feeToken.denom,
                  required: gasCheck.required,
                  available: gasCheck.balance,
                  estimatedGas,
                  address: walletState.address,
                },
              );

              // Override the successful result with a gas balance failure
              result = {
                success: false,
                message: errorMessage,
              };
            } else {
              console.log('[executeTransactionRoute] Gas balance check passed after simulation:', {
                stepIndex: i,
                stepType: step.type,
                feeToken: feeToken.denom,
                required: gasCheck.required,
                available: gasCheck.balance,
                estimatedGas,
              });
            }
          } catch (error) {
            console.error(
              '[executeTransactionRoute] Gas balance check failed after simulation:',
              error,
            );
            // Don't override the simulation result if gas check fails, just log it
          }
        }

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
