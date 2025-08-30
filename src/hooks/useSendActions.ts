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
} from '@/atoms';
import { TransactionStatus, TransactionType } from '@/constants';
import {
  Asset,
  FeeToken,
  IBCObject,
  SendObject,
  TransactionResult,
  TransactionStep,
  Uri,
} from '@/types';
import {
  getAddressByChainPrefix,
  getBalances,
  getSessionToken,
  getValidIBCChannel,
  sendIBCTransaction,
  sendTransaction,
  swapTransaction,
  executeSkipRoute,
  initializeSkipClient,
  getSkipRoute,
} from '@/helpers';
import { useRefreshData } from './useRefreshData';
import { useGetSigner } from './useGetSigner';
import { useEffect } from 'react';
import { UserAddress } from '@skip-go/client/cjs';

// TODO: set toast for if not on original page
// TODO: ensure if sending with no receive address value, user sends to self on send address value
export const useSendActions = () => {
  const { refreshData } = useRefreshData();
  const { getCosmosSigner, getEvmSigner, getSvmSigner } = useGetSigner();

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
  // In useSendActions.ts
  const executeSkipTx = async ({
    sendObject,
    receiveAssetDenom,
    simulateTransaction,
  }: {
    sendObject: SendObject;
    receiveAssetDenom: string;
    simulateTransaction: boolean;
  }): Promise<TransactionResult> => {
    console.log('[executeSkipTx] Starting Skip Tx');

    try {
      const amount = `${sendState.amount}`;

      // Use the new Skip client route function instead of direct API call
      const routeResponse = await getSkipRoute({
        fromChainId: sendState.asset.originChainId,
        fromDenom: sendObject.denom,
        toChainId: receiveState.chainId,
        toDenom: receiveAssetDenom,
        amount,
      });

      if (!routeResponse.operations?.length) {
        throw new Error('No valid IBC route found');
      }

      // For simulation, return early with route info
      if (simulateTransaction) {
        const totalFees =
          routeResponse.estimatedFees?.reduce(
            (total: number, fee: any) => total + parseInt(fee.amount || '0', 10),
            0,
          ) || 0;

        return {
          success: true,
          message: 'Transaction simulation successful',
          data: {
            code: 0,
            txHash: 'simulated',
            gasWanted: totalFees.toString(),
            route: routeResponse,
            estimatedAmountOut: routeResponse.estimatedAmountOut,
            fees: routeResponse.estimatedFees,
          },
        };
      }

      // NOTE: DO NOT deduplicate! The Skip client expects the exact same number of addresses
      const requiredChainAddresses = routeResponse.requiredChainAddresses;

      const userAddresses: UserAddress[] = await Promise.all(
        requiredChainAddresses.map(async (chainId: string, index: number) => {
          console.log(`🔄 Processing chain ${index}: ${chainId}`);

          let address: string;
          const chainWallet = getWalletInfo(chainId);

          if ((chainWallet && chainWallet.address) || chainWallet.address.trim() !== '') {
            console.log(`✅ Using local wallet for ${chainId}: ${chainWallet.address}`);
            address = chainWallet.address;
          } else {
            console.log(`⚠️  No local wallet found for ${chainId}, generating from mnemonic`);
            // Fallback: get address from mnemonic
            const sessionToken = getSessionToken();
            if (!sessionToken) throw new Error("Session token doesn't exist");

            const chainInfo = getFullRegistryChainInfo(chainId);
            console.log(`🔍 Chain info for ${chainId}:`, chainInfo);

            if (!chainInfo?.bech32_prefix) {
              console.error(`❌ Prefix not found for chain ${chainId}`);
              throw new Error(`Prefix not found for ${chainInfo?.pretty_name || chainId}`);
            }

            console.log(
              `🔑 Generating address for ${chainId} with prefix: ${chainInfo.bech32_prefix}`,
            );
            try {
              address = await getAddressByChainPrefix(
                sessionToken.mnemonic,
                chainInfo.bech32_prefix,
              );
              console.log(`✅ Generated address for ${chainId}: ${address}`);
            } catch (error) {
              console.error(`❌ Failed to generate address for ${chainId}:`, error);
              throw error;
            }
          }

          return {
            chainId,
            address,
          };
        }),
      );

      console.log('👥 Final user addresses:', userAddresses);

      // FIX: Validate that all addresses are properly defined
      const validAddresses = userAddresses.filter(
        addr => addr && addr.chainId && addr.address && addr.address.trim() !== '',
      );

      if (validAddresses.length !== requiredChainAddresses.length) {
        throw new Error('Failed to generate valid addresses for all required chains');
      }

      // Execute the route using Skip's built-in execution
      const result = await executeSkipRoute(
        routeResponse,
        userAddresses,
        async (chainId: string) => {
          console.log(`🖊️  Getting signer for chain: ${chainId}`);
          const signer = await getCosmosSigner(chainId);
          return signer;
        },
        getEvmSigner,
        getSvmSigner,
      );

      if (result.success) {
        return {
          success: true,
          message: 'Route successfully executed',
          data: {
            code: 0,
            txHash: 'multi-tx', // Skip handles multiple transactions
            gasWanted: '0',
            route: routeResponse,
          },
        };
      } else {
        throw new Error(result.message);
      }
    } catch (error) {
      console.error('[useSendActions] Skip Tx failed:', error);
      return {
        success: false,
        message: error instanceof Error ? error.message : 'Skip Tx failed',
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

        // If false or no results
        if (!(result?.success || false)) {
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
          status: result?.success ? TransactionStatus.SUCCESS : TransactionStatus.ERROR,
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

  useEffect(() => {
    // Initialize Skip client
    console.log('[useSendActions] Initializing Skip client...');
    initializeSkipClient();
  }, []);

  return {
    runTransaction,
    runSimulation,
  };
};
