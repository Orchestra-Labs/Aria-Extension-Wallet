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
  allWalletAssetsAtom,
  updateStepLogAtom,
} from '@/atoms';
import { GREATER_EXPONENT_DEFAULT, TransactionStatus, TransactionType } from '@/constants';
import {
  Asset,
  FeeState,
  FeeStructure,
  FeeToken,
  IBCObject,
  SendObject,
  SkipOperationFee,
  SkipOperationSimulation,
  SkipSimulationResult,
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
  simulateOsmosisSwap,
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
  const updateStepLog = useSetAtom(updateStepLogAtom);
  const updateTxStepLog = useSetAtom(updateTxStepLogAtom);
  const resetRouteStatus = useSetAtom(resetRouteStatusAtom);
  const setSimulationInvalidation = useSetAtom(simulationInvalidationAtom);
  const allWalletAssets = useAtomValue(allWalletAssetsAtom);

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

  const resolveAssetFromDenom = (denom: string, chainId: string): Asset => {
    console.log('[resolveAssetFromDenom] Looking for asset:', { denom, chainId });

    // First, try to find in wallet assets (these should already have resolved IBC assets)
    const walletAsset = allWalletAssets.find(
      asset => (asset.denom === denom || asset.originDenom === denom) && asset.chainId === chainId,
    );

    if (walletAsset) {
      console.log('[resolveAssetFromDenom] Found in wallet assets:', walletAsset);
      return walletAsset;
    }

    // If not found in wallet, try chain registry
    const chainInfo = getFullRegistryChainInfo(chainId);
    const registryAsset = chainInfo.assets?.[denom];

    if (registryAsset) {
      console.log('[resolveAssetFromDenom] Found in chain registry:', registryAsset);
      return {
        ...registryAsset,
        chainId,
        networkName: chainInfo.pretty_name || chainInfo.chain_name || chainId,
        amount: '0',
        displayAmount: '0',
        price: 0,
        isIbc: false,
        originDenom: denom,
        originChainId: chainId,
      };
    }

    // Fallback: create a basic asset object
    console.warn(`[resolveAssetFromDenom] Asset not found for ${denom}, creating basic asset`);

    return {
      denom,
      symbol: denom,
      name: denom,
      exponent: GREATER_EXPONENT_DEFAULT,
      logo: '',
      isFeeToken: false,
      coinGeckoId: undefined,
      chainId,
      networkName: chainInfo?.pretty_name || chainInfo?.chain_name || chainId,
      amount: '0',
      displayAmount: '0',
      price: 0,
      isIbc: denom.startsWith('ibc/'),
      originDenom: denom,
      originChainId: chainId,
      trace: '',
    };
  };

  const calculateSkipFees = (
    routeResponse: any, // TODO: should be of type Skip Route Response.  search Skip library for type
    simulationResult?: SkipSimulationResult,
  ): SkipOperationFee[] => {
    const fees: SkipOperationFee[] = [];

    // Process each operation to collect fees
    routeResponse.operations.forEach((operation: any, index: any) => {
      let operationFee: SkipOperationFee | null = null;
      let simulationFee: SkipOperationSimulation | null = null;

      // Get corresponding simulation result if available
      if (simulationResult && simulationResult.operations[index]) {
        simulationFee = simulationResult.operations[index];
      }

      // Check if operation has a transfer with fee amount
      if (operation.transfer && operation.transfer.feeAmount) {
        operationFee = {
          denom: operation.transfer.feeDenom || operation.transfer.denomIn,
          amount: operation.transfer.feeAmount,
          chainId: operation.transfer.fromChainId,
          operationType: 'transfer',
        };
      }

      // For swap operations, prioritize simulation results over affiliate fees
      if (operation.swap) {
        // First, check if we have a valid simulation result
        if (simulationFee && simulationFee.success) {
          operationFee = {
            denom: simulationFee.feeToken.denom,
            amount: simulationFee.feeAmount.toString(),
            chainId: simulationFee.chainId,
            operationType: 'swap',
          };
        }
        // Only use affiliate fee if no simulation result and it's non-zero
        else if (operation.swap.estimatedAffiliateFee) {
          const affiliateFee = operation.swap.estimatedAffiliateFee;

          if (affiliateFee && affiliateFee !== '0') {
            // Find the index where numbers end and letters begin
            let splitIndex = 0;
            while (splitIndex < affiliateFee.length && !isNaN(parseInt(affiliateFee[splitIndex]))) {
              splitIndex++;
            }

            const amount = affiliateFee.substring(0, splitIndex);
            const denom = affiliateFee.substring(splitIndex);

            if (amount !== '0') {
              operationFee = {
                denom: denom || operation.swap.denomOut,
                amount: amount,
                chainId: operation.swap.fromChainId,
                operationType: 'swap',
              };
            }
          }
        }
      }

      // Use simulation result as fallback if no fee found yet
      if ((!operationFee || operationFee.amount === '0') && simulationFee) {
        operationFee = {
          denom: simulationFee.feeToken.denom,
          amount: simulationFee.feeAmount.toString(),
          chainId: simulationFee.chainId,
          operationType: simulationFee.operationType || 'transfer',
        };
      }

      // Check if we still don't have a fee
      if (!operationFee) {
        // Final fallback: use a conservative default estimate
        const defaultGasEstimate = operation.swap ? 200000 : 250000; // Different defaults for swap vs transfer
        const chainInfo = getFullRegistryChainInfo(
          operation.swap ? operation.swap.fromChainId : operation.transfer.fromChainId,
        );
        const feeToken = chainInfo?.fees?.[0];

        if (feeToken) {
          const gasPrice = feeToken.gasPriceStep.average;
          const feeAmount = Math.ceil(defaultGasEstimate * gasPrice);

          operationFee = {
            denom: feeToken.denom,
            amount: feeAmount.toString(),
            chainId: operation.swap ? operation.swap.fromChainId : operation.transfer.fromChainId,
            operationType: operation.swap ? 'swap' : 'transfer',
          };
        }
      }

      // Add the fee to the list if valid
      if (operationFee && operationFee.amount !== '0') {
        // Ensure denoms match when summing fees for the same chain
        const existingFeeIndex = fees.findIndex(
          f => f.chainId === operationFee!.chainId && f.denom === operationFee!.denom,
        );

        if (existingFeeIndex >= 0) {
          // Sum fees with matching denoms and chainIds
          const existingAmount = BigInt(fees[existingFeeIndex].amount);
          const newAmount = BigInt(operationFee.amount);
          const totalAmount = (existingAmount + newAmount).toString();

          fees[existingFeeIndex].amount = totalAmount;
        } else {
          fees.push(operationFee);
        }
      }
    });

    return fees;
  };

  const runSkipFeeSimulations = async (
    skipRoute: any,
    userAddresses: { chainId: string; address: string }[],
  ): Promise<SkipSimulationResult> => {
    const simulations: SkipOperationSimulation[] = [];
    const operationFees: SkipOperationFee[] = [];
    let totalEstimatedFees = 0;
    let allSufficient = true;

    // Process each operation in the route
    for (const operation of skipRoute.operations) {
      let chainId: string;
      let denom: string;
      let operationType: string;

      if (operation.swap) {
        chainId = operation.swap.fromChainId;
        denom = operation.swap.denomIn;
        operationType = 'swap';
      } else {
        chainId = operation.transfer.fromChainId;
        denom = operation.transfer.denomIn;
        operationType = 'transfer';
      }

      console.log(
        `[runSkipFeeSimulations] Processing ${operationType} operation on ${chainId} with ${denom}`,
      );

      // TODO: start here.  logs show processing line above, but not code walkthrough below. find out if going through correct process, then test and clean up
      const chainInfo = getFullRegistryChainInfo(chainId);
      if (!chainInfo) {
        simulations.push({
          chainId,
          denom,
          operationType,
          success: false,
          estimatedGas: '0',
          feeAmount: 0,
          feeToken: { denom: 'unknown', gasPriceStep: { low: 0, average: 0, high: 0 } },
          error: `Chain info not found for ${chainId}`,
        });
        operationFees.push({ amount: '0', denom, chainId, operationType });
        allSufficient = false;
        continue;
      }

      // Get the correct address for this specific chain
      const userAddress = userAddresses.find(addr => addr.chainId === chainId)?.address;
      if (!userAddress) {
        simulations.push({
          chainId,
          denom,
          operationType,
          success: false,
          estimatedGas: '0',
          feeAmount: 0,
          feeToken: { denom: 'unknown', gasPriceStep: { low: 0, average: 0, high: 0 } },
          error: `User address not found for chain ${chainId}`,
        });
        operationFees.push({ amount: '0', denom, chainId, operationType });
        allSufficient = false;
        continue;
      }

      const feeToken = chainInfo.fees?.[0];
      if (!feeToken) {
        simulations.push({
          chainId,
          denom,
          operationType,
          success: false,
          estimatedGas: '0',
          feeAmount: 0,
          feeToken: { denom: 'unknown', gasPriceStep: { low: 0, average: 0, high: 0 } },
          error: `No fee tokens available for chain ${chainId}`,
        });
        operationFees.push({ amount: '0', denom, chainId, operationType });
        allSufficient = false;
        continue;
      }

      // Use a smaller amount for simulation to avoid insufficient funds errors
      const simulationAmount = '1000';
      const sendObject: SendObject = {
        recipientAddress: userAddress,
        amount: simulationAmount,
        denom,
        feeToken,
      };

      let simulationResult: TransactionResult;
      let operationFeeAmount = 0;
      let isDefaultEstimate = false;

      try {
        // NOTE: swapVenue name will be osmosis-poolmanager
        if (operation.swap) {
          // TODO: don't use hard indexing
          const swapOperations = operation.swap.swapIn?.swapOperations;
          if (swapOperations && swapOperations.length > 0) {
            // Use the unified swap simulation function for both single and multi-hop
            simulationResult = await simulateOsmosisSwap({
              sender: userAddress,
              swapOperations,
              tokenInAmount: simulationAmount,
              chainId,
              restUris: chainInfo.rest_uris,
              feeToken,
            });
          } else {
            simulationResult = await executeSend({
              fromAddress: userAddress,
              sendObject,
              chainId: chainId,
              simulateTransaction: true,
            });
          }
        } else if (operation.transfer) {
          const ibcSendObject: SendObject = {
            ...sendObject,
            amount: simulationAmount,
          };

          simulationResult = await executeIBC({
            fromAddress: userAddress,
            sendObject: ibcSendObject,
            sendChainId: chainId,
            receiveChainId: operation.transfer.toChainId,
            simulateTransaction: true,
          });
        } else {
          simulationResult = await executeSend({
            fromAddress: userAddress,
            sendObject,
            chainId: chainId,
            simulateTransaction: true,
          });
        }

        if (simulationResult.success && simulationResult.data) {
          const estimatedGas = simulationResult.data.gasWanted || '0';
          const gasPrice = feeToken.gasPriceStep.average;
          const feeAmount = Math.ceil(parseInt(estimatedGas) * gasPrice);
          operationFeeAmount = feeAmount;

          // Check if this is a default estimate
          isDefaultEstimate = simulationResult.message?.includes('default gas estimate') || false;

          if (!isDefaultEstimate) {
            // Only check balance for actual simulations, not default estimates
            const balanceCheck = await checkGasBalance({
              address: userAddress,
              feeToken,
              estimatedGas,
              chainId,
              restUris: chainInfo.rest_uris,
            });

            const operationSuccess = balanceCheck.hasSufficientBalance;
            if (!operationSuccess) {
              allSufficient = false;
            }

            simulations.push({
              chainId,
              denom,
              operationType,
              success: operationSuccess,
              estimatedGas,
              feeAmount,
              feeToken,
              error: operationSuccess
                ? undefined
                : `Insufficient ${feeToken.denom} for gas fees. Required: ${balanceCheck.required}, Available: ${balanceCheck.balance}`,
            });
          } else {
            // For default estimates, assume insufficient balance
            simulations.push({
              chainId,
              denom,
              operationType,
              success: false,
              estimatedGas,
              feeAmount,
              feeToken,
            });
          }

          totalEstimatedFees += feeAmount;
        } else {
          // If simulation fails completely, use conservative default (with IBC being higher)
          const defaultGasEstimate = operationType === 'transfer' ? 250000 : 200000;
          const gasPrice = feeToken.gasPriceStep.average;
          const feeAmount = Math.ceil(defaultGasEstimate * gasPrice);
          operationFeeAmount = feeAmount;
          isDefaultEstimate = true;

          simulations.push({
            chainId,
            denom,
            operationType,
            success: false,
            estimatedGas: defaultGasEstimate.toString(),
            feeAmount,
            feeToken,
            error: simulationResult?.message || 'Simulation failed',
          });

          totalEstimatedFees += feeAmount;
        }
      } catch (error) {
        console.error(
          `[runSkipFeeSimulations] Error simulating ${operationType} on ${chainId}:`,
          error,
        );

        simulations.push({
          chainId,
          denom,
          operationType,
          success: false,
          estimatedGas: '0',
          feeAmount: 0,
          feeToken,
          error: error instanceof Error ? error.message : 'Simulation failed',
        });
        operationFees.push({ amount: '0', denom, chainId, operationType });
        allSufficient = false;
        continue;
      }

      // Calculate final fee amount for this operation
      let finalFeeAmount = operationFeeAmount;

      // Add estimated affiliate fee if it exists (for swaps)
      if (operation.swap && operation.swap.estimatedAffiliateFee) {
        const affiliateFee = operation.swap.estimatedAffiliateFee;
        const [affiliateAmount, affiliateDenom] = affiliateFee.split(/(?=\D+$)/); // Split at the first non-digit

        if (affiliateDenom === denom) {
          finalFeeAmount += parseInt(affiliateAmount) || 0;
        }
      }

      operationFees.push({
        amount: finalFeeAmount.toString(),
        denom: isDefaultEstimate ? feeToken.denom : denom, // Use fee token denom for default estimates
        chainId,
        operationType,
      });
    }

    console.log('[runSkipFeeSimulations] Completed simulations:', {
      totalOperations: simulations.length,
      totalEstimatedFees,
      allSufficient,
      simulations,
      operationFees,
    });

    return {
      operations: simulations,
      totalEstimatedFees,
      hasSufficientBalances: allSufficient,
      operationFees,
    };
  };

  const executeSend = async ({
    fromAddress,
    sendObject,
    chainId,
    simulateTransaction,
  }: {
    fromAddress: string;
    sendObject: SendObject;
    chainId: string;
    simulateTransaction: boolean;
  }): Promise<TransactionResult> => {
    console.log('[DEBUG][executeSend] Starting standard send transaction', {
      fromAddress,
      sendObject,
      chainId,
      simulateTransaction,
      originalAmount: sendObject.amount,
      denom: sendObject.denom,
    });
    const sendChain = getFullRegistryChainInfo(chainId);
    const prefix = sendChain.bech32_prefix;
    const rpcUris = sendChain.rpc_uris;
    console.log(`[executeSend] Using prefix: ${prefix} for chain: ${sendChain.chain_id}`);

    try {
      const result = await sendTransaction({
        fromAddress,
        sendObject,
        prefix: sendChain.bech32_prefix,
        rpcUris: rpcUris,
        chainId: sendChain.chain_id,
        simulateOnly: simulateTransaction,
      });

      console.log('[DEBUG][executeSend] Transaction result:', {
        success: result.success,
        gasWanted: result.data?.gasWanted,
        fees: result.data?.fees,
        originalAmount: sendObject.amount,
        denom: sendObject.denom,
      });

      return result;
    } catch (error: any) {
      // Handle unfunded account error during simulation
      if (
        simulateTransaction &&
        (error.message?.includes('does not exist on chain') ||
          error.message?.includes('account not found'))
      ) {
        console.log('[executeSend] Account not funded, using default gas estimation');

        const feeToken = sendObject.feeToken;
        if (!feeToken) {
          return {
            success: false,
            message: 'No fee token available for default estimation',
          };
        }

        const defaultGasEstimate = 200000; // Conservative default
        const gasPrice = feeToken.gasPriceStep.average;
        const feeAmount = Math.ceil(defaultGasEstimate * gasPrice);

        return {
          success: true,
          message: 'Simulation completed with default gas estimate',
          data: {
            code: 0,
            gasWanted: defaultGasEstimate.toString(),
            fees: {
              amount: [
                {
                  denom: feeToken.denom,
                  amount: feeAmount.toString(),
                },
              ],
              gas: defaultGasEstimate.toString(),
            },
          },
        };
      }

      // Re-throw other errors
      throw error;
    }
  };

  const executeStablecoinSwap = async ({
    fromAddress,
    sendObject,
    receiveAsset,
    simulateTransaction,
  }: {
    fromAddress: string;
    sendObject: SendObject;
    receiveAsset: Asset;
    simulateTransaction: boolean;
  }): Promise<TransactionResult> => {
    console.log('[DEBUG][executeStablecoinSwap] Starting swap transaction', {
      fromAddress,
      sendObject,
      receiveAsset: receiveAsset.denom,
      originalAmount: sendObject.amount,
      inputDenom: sendObject.denom,
      outputDenom: receiveAsset.denom,
      simulateTransaction,
    });

    const swapParams = {
      sendObject,
      resultDenom: receiveAsset.denom, // need to use current denom here so it fails if ibc
    };
    const sendChain = getChainInfo(sendState.chainId);
    const restUris = sendChain.rest_uris;

    return await swapTransaction({
      fromAddress,
      swapObject: swapParams,
      rpcUris: restUris,
      chainId: sendState.chainId,
      simulateOnly: simulateTransaction,
    });
  };

  const executeIBC = async ({
    fromAddress,
    sendObject,
    sendChainId,
    receiveChainId,
    simulateTransaction,
  }: {
    fromAddress: string;
    sendObject: SendObject;
    sendChainId: string;
    receiveChainId: string;
    simulateTransaction: boolean;
  }): Promise<TransactionResult> => {
    console.log('[DEBUG][executeIBC] Starting IBC transaction', {
      fromAddress,
      sendObject,
      sendChainId,
      receiveChainId,
      originalAmount: sendObject.amount,
      denom: sendObject.denom,
      simulateTransaction,
    });

    try {
      const sendChain = getFullRegistryChainInfo(sendChainId);
      const validChannel = await getValidIBCChannel({
        sendChain,
        receiveChainId,
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
        fromAddress,
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
    } catch (error: any) {
      // Handle unfunded account error during simulation
      if (
        simulateTransaction &&
        (error.message?.includes('does not exist on chain') ||
          error.message?.includes('account not found'))
      ) {
        console.log('[executeIBC] Account not funded, using default gas estimation');

        const feeToken = sendObject.feeToken;
        if (!feeToken) {
          return {
            success: false,
            message: 'No fee token available for default estimation',
          };
        }

        const defaultGasEstimate = 250000; // IBC transactions typically need more gas
        const gasPrice = feeToken.gasPriceStep.average;
        const feeAmount = Math.ceil(defaultGasEstimate * gasPrice);

        return {
          success: true,
          message: 'Simulation completed with default gas estimate',
          data: {
            code: 0,
            gasWanted: defaultGasEstimate.toString(),
            fees: {
              amount: [
                {
                  denom: feeToken.denom,
                  amount: feeAmount.toString(),
                },
              ],
              gas: defaultGasEstimate.toString(),
            },
          },
        };
      }

      return {
        success: false,
        message: error instanceof Error ? error.message : 'IBC transaction failed',
      };
    }
  };

  // TODO: enable amount out as an option (to handle billing)
  // TODO: use call to Osmosis for exchange after getting pool from route
  const executeSkipTx = async ({
    step,
    sendObject,
    receiveAssetDenom,
    simulateTransaction,
  }: {
    step: TransactionStep;
    sendObject: SendObject;
    receiveAssetDenom: string;
    simulateTransaction: boolean;
  }): Promise<TransactionResult> => {
    console.log('[DEBUG][executeSkipTx] Starting Skip transaction', {
      stepType: step.type,
      stepHash: step.hash,
      originalAmount: sendObject.amount,
      inputDenom: sendObject.denom,
      outputDenom: receiveAssetDenom,
      simulateTransaction,
    });

    try {
      // First, get the initial route to calculate fees
      const routeResponse = await getSkipRoute({
        fromChainId: sendState.asset.originChainId,
        fromDenom: sendObject.denom,
        toChainId: receiveState.chainId,
        toDenom: receiveAssetDenom,
        amount: sendObject.amount,
      });

      console.log('[DEBUG][executeSkipTx] Route response:', {
        operationsCount: routeResponse.operations?.length,
        amountIn: routeResponse.amountIn,
        amountOut: routeResponse.amountOut,
        operations: routeResponse.operations?.map((op: any, index: number) => ({
          index,
          type: op.swap ? 'swap' : 'transfer',
          fromChain: op.swap ? op.swap.fromChainId : op.transfer?.fromChainId,
          toChain: op.swap ? op.swap.toChainId : op.transfer?.toChainId,
          inputDenom: op.swap ? op.swap.denomIn : op.transfer?.denomIn,
          outputDenom: op.swap ? op.swap.denomOut : op.transfer?.denomOut,
        })),
      });

      if (!routeResponse.operations?.length) {
        throw new Error('No valid Skip route found');
      }

      // Get user addresses for all required chains
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

      // Validate that all addresses are properly defined
      const validAddresses = userAddresses.filter(
        addr => addr && addr.chainId && addr.address && addr.address.trim() !== '',
      );

      if (validAddresses.length !== requiredChainAddresses.length) {
        throw new Error('Missing addresses on Skip path');
      }

      // Run fee simulations before proceeding
      const simulationResult = await runSkipFeeSimulations(routeResponse, userAddresses);
      const calculatedFees = calculateSkipFees(routeResponse, simulationResult);

      // Calculate fees for the initial chain (first operation)
      const initialChainFees = calculatedFees.filter(
        fee => fee.chainId === sendState.asset.originChainId,
      );

      let adjustedInputAmount = BigInt(sendObject.amount);

      // Subtract fees from the initial amount for the first chain
      if (initialChainFees.length > 0) {
        const totalFees = initialChainFees.reduce(
          (sum, fee) => sum + BigInt(fee.amount),
          BigInt(0),
        );

        // Ensure we don't subtract more than available
        if (totalFees > adjustedInputAmount) {
          throw new Error(
            `Insufficient funds: ${sendObject.amount}${sendObject.denom} available, but ${totalFees.toString()}${initialChainFees[0].denom} needed for fees`,
          );
        }

        adjustedInputAmount -= totalFees;

        console.log('[DEBUG][executeSkipTx] Adjusted input amount after fee deduction:', {
          originalAmount: sendObject.amount,
          totalFees: totalFees.toString(),
          adjustedAmount: adjustedInputAmount.toString(),
          feeDenom: initialChainFees[0].denom,
        });
      }

      // Get a new route with the adjusted amount if we subtracted fees
      let finalRouteResponse = routeResponse;
      if (adjustedInputAmount !== BigInt(sendObject.amount)) {
        console.log('[DEBUG][executeSkipTx] Requesting new route with adjusted amount');

        finalRouteResponse = await getSkipRoute({
          fromChainId: sendState.asset.originChainId,
          fromDenom: sendObject.denom,
          toChainId: receiveState.chainId,
          toDenom: receiveAssetDenom,
          amount: adjustedInputAmount.toString(),
        });

        console.log('[DEBUG][executeSkipTx] Adjusted route response:', {
          operationsCount: finalRouteResponse.operations?.length,
          amountIn: finalRouteResponse.amountIn,
          amountOut: finalRouteResponse.amountOut,
        });
      }

      // For simulation, return early with route info
      if (simulateTransaction) {
        const feeStructure: FeeStructure = {
          amount: calculatedFees.map(fee => ({
            denom: fee.denom,
            amount: fee.amount,
          })),
          gas: calculatedFees[0]?.amount || '0',
        };

        updateStepLog({
          stepHash: step.hash,
          log: {
            skipRoute: finalRouteResponse,
            inputAmount: sendObject.amount,
            outputAmount: finalRouteResponse.estimatedAmountOut || '0',
            // Also update fees if available from simulation
            fees: calculatedFees.map(fee => {
              const chainRegistryFeeInfo = getFullRegistryChainInfo(fee.chainId)?.fees?.[0];
              const asset = resolveAssetFromDenom(fee.denom, fee.chainId);

              // Parse the fee amount to ensure it's a number
              const feeAmount = parseInt(fee.amount, 10);

              return {
                asset,
                amount: feeAmount,
                chainId: fee.chainId,
                feeToken: chainRegistryFeeInfo || {
                  denom: fee.denom,
                  gasPriceStep: { low: 0, average: 0, high: 0 },
                },
                gasWanted: feeAmount,
                gasPrice: chainRegistryFeeInfo?.gasPriceStep?.average || 0,
              };
            }),
          },
        });

        console.log('[DEBUG][executeSkipTx] Simulation completed:', {
          originalInput: sendObject.amount,
          finalOutput: finalRouteResponse.estimatedAmountOut,
          fees: calculatedFees.map(fee => ({
            chainId: fee.chainId,
            denom: fee.denom,
            amount: fee.amount,
            operationType: fee.operationType,
          })),
          operations: finalRouteResponse.operations?.map((op: any, index: number) => ({
            index,
            type: op.swap ? 'swap' : 'transfer',
            inputAmount: op.swap ? op.swap.amountIn : op.transfer?.amount,
            outputAmount: op.swap ? op.swap.amountOut : op.transfer?.amount,
          })),
        });

        return {
          success: true,
          message: 'Transaction simulation successful',
          data: {
            code: 0,
            txHash: 'simulated',
            gasWanted: calculatedFees[0]?.amount || '0',
            route: finalRouteResponse,
            estimatedAmountOut: finalRouteResponse.amountOut,
            fees: feeStructure,
          },
        };
      }

      // Execute the route using Skip's built-in execution
      const result = await executeSkipRoute(
        finalRouteResponse,
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
            txHash: 'multi-tx', // TODO: change to array of tx hashes or to final tx hash
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

  const executeStep = async ({
    step,
    inputAmount,
    isSimulation,
  }: {
    step: TransactionStep;
    inputAmount: string;
    isSimulation: boolean;
  }): Promise<TransactionResult> => {
    console.log('[DEBUG][executeStep] Executing step:', {
      stepIndex: txRoute.steps.indexOf(step),
      stepType: step.type,
      stepHash: step.hash,
      fromChain: step.fromChain,
      toChain: step.toChain,
      inputAmount,
      inputDenom: step.fromAsset.denom,
      outputDenom: step.toAsset.denom,
      isSimulation,
    });

    const stepLog = txLogs[step.hash];
    const feeToken = stepLog?.fees?.[0].feeToken;

    // TODO: this getAddressForChain code is also used in the skip function.  extract to hook or helper function for use in both places
    // Helper function to get address for any chain (similar to Skip function)
    const getAddressForChain = async (chainId: string): Promise<string> => {
      // First try to get from local wallet state
      const chainWallet = getWalletInfo(chainId);

      if (chainWallet?.address && chainWallet.address.trim() !== '') {
        return chainWallet.address;
      }

      // Fallback: generate address from mnemonic
      const sessionToken = getSessionToken();
      if (!sessionToken) {
        throw new Error("Session token doesn't exist");
      }

      const chainInfo = getFullRegistryChainInfo(chainId);

      if (!chainInfo?.bech32_prefix) {
        throw new Error(`Prefix not found for ${chainInfo?.pretty_name || chainId}`);
      }

      try {
        const address = await getAddressByChainPrefix(
          sessionToken.mnemonic,
          chainInfo.bech32_prefix,
        );

        return address;
      } catch (error) {
        throw error;
      }
    };

    // Determine the correct recipient address
    let finalRecipientAddress: string;
    if (step.fromChain !== step.toChain) {
      // Cross-chain transfer: use the destination chain address
      try {
        finalRecipientAddress = await getAddressForChain(step.toChain);
      } catch (error) {
        return {
          success: false,
          message: `Failed to get address for destination chain ${step.toChain}`,
        };
      }
    } else {
      // Same-chain transfer: use the provided recipient or self
      finalRecipientAddress = recipientAddress || walletState.address;
    }

    const sendObject: SendObject = {
      recipientAddress: finalRecipientAddress,
      amount: inputAmount,
      denom: step.fromAsset.denom,
      feeToken,
    };

    // TODO: may need to source address from outside walletState, given this is a step, not the start of the route
    try {
      let result;
      switch (step.type) {
        case TransactionType.SEND:
          result = await executeSend({
            fromAddress: walletState.address,
            sendObject,
            chainId: step.fromChain,
            simulateTransaction: isSimulation,
          });
          break;
        case TransactionType.SWAP:
          result = await executeStablecoinSwap({
            fromAddress: walletState.address,
            sendObject,
            receiveAsset: step.toAsset,
            simulateTransaction: isSimulation,
          });
          break;
        case TransactionType.IBC_SEND:
          result = await executeIBC({
            fromAddress: walletState.address,
            sendObject,
            sendChainId: step.fromChain,
            receiveChainId: step.toChain,
            simulateTransaction: isSimulation,
          });
          break;
        case TransactionType.EXCHANGE:
          const skipSendObject: SendObject = {
            recipientAddress: finalRecipientAddress,
            amount: inputAmount,
            denom: step.fromAsset.originDenom, // Skip only recognizes the original denom
            feeToken,
          };
          result = await executeSkipTx({
            step,
            sendObject: skipSendObject,
            receiveAssetDenom: step.toAsset.denom,
            simulateTransaction: isSimulation,
          });
          break;
        default:
          throw new Error(`Unsupported transaction type: ${step.type}`);
      }

      console.log('[DEBUG][executeStep] Step completed:', {
        stepIndex: txRoute.steps.indexOf(step),
        success: result.success,
        gasWanted: result.data?.gasWanted,
        fees: result.data?.fees,
        estimatedOutput: result.data?.estimatedAmountOut,
        inputAmount,
        outputAmount: result.data?.estimatedAmountOut || '0',
      });

      return result;
    } catch (error: any) {
      return { success: false, message: error.message };
    }
  };

  const executeTransactionRoute = async (isSimulation: boolean): Promise<TransactionResult> => {
    console.log('[DEBUG][executeTransactionRoute] Starting transaction route', {
      isSimulation,
      totalSteps: txRoute.steps.length,
      originalAmount: sendState.amount.toString(),
      originalDenom: sendState.asset.denom,
      targetChain: receiveState.chainId,
      targetDenom: receiveState.asset.denom,
    });

    resetRouteStatus(isSimulation);

    let result: TransactionResult = { success: true, message: '' };
    let currentInputAmount = sendState.amount.toString();

    try {
      // Execute steps sequentially
      for (let i = 0; i < txRoute.steps.length; i++) {
        const step = txRoute.steps[i];
        const stepLog = txLogs[step.hash];

        console.log('[DEBUG][executeTransactionRoute] Processing step:', {
          stepIndex: i,
          stepType: step.type,
          fromChain: step.fromChain,
          toChain: step.toChain,
          inputAmount: currentInputAmount,
          inputDenom: step.fromAsset.denom,
          outputDenom: step.toAsset.denom,
        });

        // Update step to pending
        updateTxStepLog({
          stepIndex: i,
          status: TransactionStatus.PENDING,
        });

        try {
          result = await executeStep({ step, inputAmount: currentInputAmount, isSimulation }); // Use output from previous step as input
        } catch (error) {
          console.error('[executeTransactionRoute] Step execution threw error:', error);
          result = {
            success: false,
            message: error instanceof Error ? error.message : 'Step execution failed',
          };
        }

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
            const feeToken = stepLog?.fees?.[0].feeToken;

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
        if (!result.success) {
          console.error('[executeTransactionRoute] Step failed', {
            stepIndex: i,
            error: result.message,
          });

          // Update failed step to ERROR
          updateTxStepLog({
            stepIndex: i,
            status: TransactionStatus.ERROR,
            error: result.message,
          });

          // Mark all remaining steps as IDLE
          for (let j = i + 1; j < txRoute.steps.length; j++) {
            updateTxStepLog({
              stepIndex: j,
              status: TransactionStatus.IDLE,
            });
          }

          break;
        }

        let feeData: FeeState[] = [];
        // TODO: resolve to one format.  is gaswanted being used?

        if (result.data?.fees) {
          const fees = result.data.fees;
          const feeToken = stepLog?.fees?.[0].feeToken;

          // Handle FeeStructure type (amount array)
          if (fees.amount && Array.isArray(fees.amount)) {
            for (const feeAmount of fees.amount) {
              // Use the helper function to resolve the asset
              let asset = resolveAssetFromDenom(feeAmount.denom, step.fromChain);

              console.log('[executeTransactionRoute] resolved asset for fees.amount:', asset);
              const feeState: FeeState = {
                asset,
                amount: parseInt(feeAmount.amount, 10),
                chainId: step.fromChain,
                feeToken: feeToken!,
                gasWanted: parseInt(result.data?.gasWanted || '0', 10),
                gasPrice: feeToken?.gasPriceStep?.average || 0,
              };

              feeData.push(feeState);
            }
          }
          // Handle simple gasWanted/amount structure
          else if (result.data.gasWanted) {
            const feeDenom = feeToken?.denom || '';
            let asset = resolveAssetFromDenom(feeDenom, step.fromChain);

            console.log(
              '[executeTransactionRoute] resolved asset for result.data.gaswanted:',
              asset,
            );
            const feeAmount =
              parseInt(result.data.gasWanted, 10) * (feeToken?.gasPriceStep?.average || 0);

            const feeState: FeeState = {
              asset,
              amount: feeAmount,
              chainId: step.fromChain,
              feeToken: feeToken!,
              gasWanted: parseInt(result.data.gasWanted, 10),
              gasPrice: feeToken?.gasPriceStep?.average || 0,
            };

            feeData.push(feeState);
          }
        }

        let netOutput = currentInputAmount;

        if (result.success) {
          // Calculate total fees
          const totalFees = feeData.reduce((sum, fee) => sum + BigInt(fee.amount), BigInt(0));

          // Get the expected output amount
          let expectedOutput = BigInt(currentInputAmount);
          if (result.data?.estimatedAmountOut) {
            expectedOutput = BigInt(result.data.estimatedAmountOut);
          } else if (step.type === TransactionType.SWAP || step.type === TransactionType.EXCHANGE) {
            // For swaps/exchanges, if no explicit output, we might need to estimate
            // This would ideally come from the route response or simulation
            expectedOutput = BigInt(currentInputAmount); // Fallback
          }

          // Calculate net output based on transaction type
          switch (step.type) {
            case TransactionType.SEND:
            case TransactionType.IBC_SEND:
              // For sends: output = input - fees
              netOutput = (BigInt(currentInputAmount) - totalFees).toString();
              break;

            case TransactionType.SWAP:
            case TransactionType.EXCHANGE:
              // For swaps: output = expected_output - fees
              netOutput = (expectedOutput - totalFees).toString();
              break;

            default:
              netOutput = expectedOutput.toString();
          }
        }

        console.log('[DEBUG][executeTransactionRoute] Step completed:', {
          stepIndex: i,
          success: result.success,
          inputAmount: currentInputAmount,
          outputAmount: netOutput,
          fees: feeData.map(fee => ({
            chainId: fee.chainId,
            denom: fee.asset.denom,
            amount: fee.amount,
            gasWanted: fee.gasWanted,
            gasPrice: fee.gasPrice,
          })),
          stepType: step.type,
        });

        // Update the step log with net output and fees
        updateStepLog({
          stepHash: step.hash,
          log: {
            inputAmount: currentInputAmount,
            outputAmount: netOutput,
          },
          feeData: feeData,
        });

        if (i < txRoute.steps.length) {
          updateTxStepLog({
            stepIndex: i,
            status: result?.success ? TransactionStatus.SUCCESS : TransactionStatus.ERROR,
            txHash: result.data?.txHash,
            ...(feeData.length > 0 && { feeData: feeData }),
          });
        } else {
          console.error('[executeTransactionRoute] Attempted to update non-existent step:', {
            stepIndex: i,
            totalSteps: txRoute.steps.length,
          });
        }

        // Update current input for next step
        currentInputAmount = netOutput; // This will be the input for the next step
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
