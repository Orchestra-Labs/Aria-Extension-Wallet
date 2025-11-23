import { useAtomValue, useSetAtom } from 'jotai';
import {
  sendStateAtom,
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
  osmosisFeeTokenByDenomAtom,
  transactionRouteHashAtom,
  isTxRunningAtom,
  referralCodeAtom,
} from '@/atoms';
import {
  GREATER_EXPONENT_DEFAULT,
  OSMOSIS_REVENUE_CONFIG,
  TransactionStatus,
  TransactionType,
} from '@/constants';
import {
  Asset,
  FeeState,
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
  initializeSkipClient,
  useOsmosisDEX,
  recordExchangeRevenue,
} from '@/helpers';
import { useRefreshData } from './useRefreshData';
import { useEffect } from 'react';

// TODO: set toast for if not on original page
// TODO: ensure if sending with no receive address value, user sends to self on send address value
export const useSendActions = () => {
  const { refreshData } = useRefreshData();
  // const { getCosmosSigner, getEvmSigner, getSvmSigner } = useGetSigner();

  // Get all required state values at the hook level
  const sendState = useAtomValue(sendStateAtom);
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
  const getOsmosisFeeTokenByDenom = useAtomValue(osmosisFeeTokenByDenomAtom);
  const txRouteHash = useAtomValue(transactionRouteHashAtom);

  const setIsTransactionRunning = useSetAtom(isTxRunningAtom);

  const referralData = useAtomValue(referralCodeAtom);

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

  const recordRevenue = async (
    chainId: string,
    currency: string,
    amount: number,
    transactionHash?: string,
  ) => {
    try {
      const refereeId = referralData.userId || undefined;
      await recordExchangeRevenue(chainId, currency, amount, transactionHash, refereeId);
      console.log('[Revenue] Successfully recorded trade revenue');
    } catch (error) {
      console.error('[Revenue] Failed to record trade revenue:', error);
    }
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
    const sendChain = getFullRegistryChainInfo(chainId);
    const rpcUris = sendChain.rpc_uris;

    try {
      const result = await sendTransaction({
        fromAddress,
        sendObject,
        prefix: sendChain.bech32_prefix,
        rpcUris: rpcUris,
        chainId: sendChain.chain_id,
        simulateOnly: simulateTransaction,
      });

      return result;
    } catch (error: any) {
      // Handle unfunded account error during simulation
      if (
        simulateTransaction &&
        (error.message?.includes('does not exist on chain') ||
          error.message?.includes('account not found'))
      ) {
        console.warn('[executeSend] Account not funded, using default gas estimation');

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

  const executeOsmosisExchange = async ({
    step,
    inputAmount,
    isSimulation,
  }: {
    step: TransactionStep;
    inputAmount: string;
    isSimulation: boolean;
  }): Promise<TransactionResult> => {
    try {
      // Get session token for mnemonic
      const sessionToken = getSessionToken();
      if (!sessionToken) {
        throw new Error("Session token doesn't exist");
      }

      const mnemonic = sessionToken.mnemonic;

      // Get chain info for Osmosis chain
      const osmosisChainId = step.fromChain; // Should be the same as toChain for Osmosis exchanges
      const chainInfo = getFullRegistryChainInfo(osmosisChainId);

      if (!chainInfo) {
        throw new Error(`Chain info not found for Osmosis chain: ${osmosisChainId}`);
      }

      // Get RPC endpoint
      const rpcEndpoint = chainInfo.rpc_uris[0]?.address;
      if (!rpcEndpoint) {
        throw new Error(`No RPC endpoint found for Osmosis chain: ${osmosisChainId}`);
      }

      // Get sender address for Osmosis chain
      const senderAddress = await getAddressByChainPrefix(mnemonic, chainInfo.bech32_prefix);

      // Get the fee token using the atom
      const inputTokenDenom = step.fromAsset.denom;
      const selectedFeeToken = getOsmosisFeeTokenByDenom(inputTokenDenom);
      console.log('[DEBUG][executeOsmosisExchange] Selected fee token:', selectedFeeToken);

      if (!selectedFeeToken) {
        throw new Error('No fee tokens available for Osmosis chain');
      }

      // TODO: supply the route if it's been calculated already

      // Execute the Osmosis swap
      const result = await useOsmosisDEX({
        mnemonic: mnemonic,
        rpcEndpoint,
        senderAddress,
        tokenIn: {
          amount: inputAmount,
          denom: step.fromAsset.denom,
        },
        tokenOutDenom: step.toAsset.denom,
        feeToken: selectedFeeToken,
        simulateOnly: isSimulation,
      });
      console.log('[DEBUG][executeOsmosisExchange] useOsmosisDEX result:', result);

      // TODO: for simulation record, subtract fees from route input before return

      // Format the result to match the expected TransactionResult format
      if (result.success) {
        if (isSimulation) {
          // For simulation, return the estimated gas and routes
          return {
            success: true,
            message: 'Osmosis swap simulation successful',
            data: {
              code: 0,
              txHash: 'simulated',
              gasWanted: result.estimatedGas?.toString() || '0',
              estimatedAmountOut: result.tokenOutMinAmount
                ? (parseInt(result.tokenOutMinAmount) * 1.01).toString() // Add 1% buffer for simulation
                : inputAmount, // Fallback to input amount if no output estimate
              fees: {
                amount: [
                  {
                    denom: selectedFeeToken.denom,
                    amount: result.recommendedFee?.gas || '0',
                  },
                ],
                gas: result.estimatedGas?.toString() || '0',
              },
            },
          };
        } else {
          if (result.success && !isSimulation && result.transactionHash) {
            const swapAmount = Number(inputAmount);
            const expectedFeePercent = Number(OSMOSIS_REVENUE_CONFIG.FEE_PERCENT);
            const expectedRevenueAmount = Math.floor(swapAmount * expectedFeePercent);

            await recordRevenue(
              osmosisChainId,
              step.fromAsset.denom,
              expectedRevenueAmount,
              result.transactionHash,
            );
          }

          // For actual execution, return the transaction hash
          return {
            success: true,
            message: 'Osmosis swap executed successfully',
            data: {
              code: 0,
              txHash: result.transactionHash,
              gasWanted: result.gasUsed?.toString() || '0',
            },
          };
        }
      } else {
        throw new Error(result.message || 'Osmosis swap failed');
      }
    } catch (error: any) {
      console.error('[executeOsmosisExchange] Error:', error);
      return {
        success: false,
        message: error instanceof Error ? error.message : 'Osmosis exchange failed',
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
    console.log('[DEBUG][executeStep] Starting step execution', {
      stepHash: step.hash,
      stepType: step.type,
      fromChain: step.fromChain,
      toChain: step.toChain,
      fromAsset: step.fromAsset.denom,
      toAsset: step.toAsset.denom,
      inputAmount,
      isSimulation,
    });

    const stepLog = txLogs[step.hash];
    console.log('[DEBUG][executeStep] Getting fee token');
    const feeToken = stepLog?.fees?.[0]?.feeToken;
    console.log('[DEBUG][executeStep] Got fee token');

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
      console.log('[DEBUG][executeStep] Step type:', step.type);
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
          result = await executeOsmosisExchange({
            step,
            inputAmount,
            isSimulation,
          });
          break;
        default:
          throw new Error(`Unsupported transaction type: ${step.type}`);
      }

      return result;
    } catch (error: any) {
      return { success: false, message: error.message };
    }
  };

  const executeTransactionRoute = async (isSimulation: boolean): Promise<TransactionResult> => {
    resetRouteStatus(isSimulation);

    let result: TransactionResult = { success: true, message: '' };
    let currentInputAmount = sendState.amount.toString();

    try {
      // Execute steps sequentially
      for (let i = 0; i < txRoute.steps.length; i++) {
        const step = txRoute.steps[i];
        const stepLog = txLogs[step.hash];

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

            // FIX: Get fee token from the appropriate source based on step type
            let feeToken: FeeToken | null;

            if (step.type === TransactionType.EXCHANGE) {
              // For EXCHANGE steps, use the Osmosis fee token atom
              feeToken = getOsmosisFeeTokenByDenom(step.fromAsset.denom);
              console.log(
                '[DEBUG][executeTransactionRoute] Using Osmosis fee token for EXCHANGE step:',
                {
                  stepIndex: i,
                  denom: step.fromAsset.denom,
                  feeToken,
                },
              );
            } else {
              // For other steps, use the fee token from step log
              feeToken = stepLog?.fees?.[0]?.feeToken;
            }

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

          let feeToken: FeeToken | null;
          if (step.type === TransactionType.EXCHANGE) {
            feeToken = getOsmosisFeeTokenByDenom(step.fromAsset.denom);
          } else {
            feeToken = stepLog?.fees?.[0]?.feeToken;
          }

          // Handle FeeStructure type (amount array)
          if (fees.amount && Array.isArray(fees.amount)) {
            for (const feeAmount of fees.amount) {
              // Use the helper function to resolve the asset
              let asset = resolveAssetFromDenom(feeAmount.denom, step.fromChain);

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
            const intEstAmountOut = Math.floor(parseFloat(result.data.estimatedAmountOut));
            expectedOutput = BigInt(intEstAmountOut);
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
      } else if (result.success && isSimulation) {
        console.log('[DEBUG][executeTransactionRoute] Setting successful simulation hash:', {
          routeHash: txRouteHash,
          resultSuccess: result.success,
        });
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
    try {
      setIsTransactionRunning(true);
      const result = await executeTransactionRoute(false);
      return result;
    } finally {
      setIsTransactionRunning(false);
    }
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
