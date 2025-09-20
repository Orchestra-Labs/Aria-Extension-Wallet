import { atom } from 'jotai';
import { FeeState, TransactionLog, TransactionLogs, TransactionStep } from '@/types';
import { DEFAULT_FEE_TOKEN, TransactionStatus, TransactionType } from '@/constants';
import { chainInfoAtom } from './chainRegistryAtom';
import { determineFeeToken } from '@/helpers';
import { transactionRouteAtom } from './transactionRouteAtom';

export const transactionLogsAtom = atom<TransactionLogs>({});

export const getStepLogAtom = (stepHash: string) => atom(get => get(transactionLogsAtom)[stepHash]);

export const updateStepLogAtom = atom(
  null,
  (
    get,
    set,
    params: {
      stepHash: string;
      log: Partial<TransactionLog>;
      feeData?: FeeState[];
    },
  ) => {
    const currentLogs = get(transactionLogsAtom);
    const existingLog = currentLogs[params.stepHash] || {};
    const route = get(transactionRouteAtom);
    const step = route.steps.find(s => s.hash === params.stepHash);

    // Handle fee data update - preserve existing if not provided
    let finalFeeData = existingLog.fees || [];
    if (params.feeData !== undefined) {
      finalFeeData = params.feeData;
    } else if (params.log.fees !== undefined) {
      finalFeeData = params.log.fees;
    }

    // Handle feeSymbol update - preserve existing if not provided
    let finalFeeSymbol = existingLog.feeSymbol || '';
    if (params.log.feeSymbol !== undefined) {
      finalFeeSymbol = params.log.feeSymbol;
    }

    // Handle inputAmount update - preserve existing if not provided
    let finalInputAmount = existingLog.inputAmount || '0';
    if (params.log.inputAmount !== undefined) {
      finalInputAmount = params.log.inputAmount;
    }

    // Handle outputAmount update - preserve existing if not provided
    let finalOutputAmount = existingLog.outputAmount || '0';
    if (params.log.outputAmount !== undefined) {
      finalOutputAmount = params.log.outputAmount;
    }

    let finalExchangeRate = existingLog.exchangeRate;
    // Only recalculate exchange rate if explicitly provided or if we have new amounts
    if (params.log.exchangeRate !== undefined) {
      finalExchangeRate = params.log.exchangeRate;
    } else if (
      finalInputAmount !== '0' &&
      finalOutputAmount !== '0' &&
      (finalInputAmount !== existingLog.inputAmount ||
        finalOutputAmount !== existingLog.outputAmount)
    ) {
      // Only recalculate if amounts actually changed
      const exchangeTypeTransactions = [
        TransactionType.EXCHANGE,
        TransactionType.SWAP,
        TransactionType.IBC_SWAP,
      ];
      if (step && exchangeTypeTransactions.includes(step.type)) {
        const inputAmount = Number(finalInputAmount);
        const outputAmount = Number(finalOutputAmount);
        if (inputAmount > 0 && outputAmount > 0) {
          finalExchangeRate = inputAmount / outputAmount;
        }
      } else {
        // For non-exchange steps, preserve existing exchange rate or set to 1 if none exists
        finalExchangeRate = existingLog.exchangeRate !== undefined ? existingLog.exchangeRate : 1;
      }
    } else {
      // Preserve existing exchange rate
      finalExchangeRate = existingLog.exchangeRate;
    }

    // Merge all properties with proper preservation logic
    const updatedLog: TransactionLog = {
      description:
        params.log.description !== undefined
          ? params.log.description
          : existingLog.description || '',
      status:
        params.log.status !== undefined
          ? params.log.status
          : existingLog.status || TransactionStatus.IDLE,
      txHash: params.log.txHash !== undefined ? params.log.txHash : existingLog.txHash,
      error: params.log.error !== undefined ? params.log.error : existingLog.error,
      skipRoute: params.log.skipRoute !== undefined ? params.log.skipRoute : existingLog.skipRoute,
      fees: finalFeeData,
      feeSymbol: finalFeeSymbol,
      inputAmount: finalInputAmount,
      outputAmount: finalOutputAmount,
      exchangeRate: finalExchangeRate,
    };

    set(transactionLogsAtom, {
      ...currentLogs,
      [params.stepHash]: updatedLog,
    });
  },
);

export const resetTransactionLogsAtom = atom(null, (_, set) => {
  console.log('[resetTransactionLogsAtom] Resetting transaction logs');
  set(transactionLogsAtom, {});
});

export const createStepLogAtom = atom(
  null,
  (
    get,
    set,
    params: {
      step: TransactionStep;
      description: string;
      initialAmounts?: { inputAmount?: string; outputAmount?: string };
    },
  ) => {
    const stepHash = params.step.hash;
    const currentLogs = get(transactionLogsAtom);
    const getChainInfo = get(chainInfoAtom);

    if (!currentLogs[stepHash]) {
      // Get chain info to determine default fee token
      const chainInfo = getChainInfo(params.step.fromChain);

      // Determine the fee token based on the send asset
      const feeTokenResult = determineFeeToken(params.step.fromAsset, chainInfo);
      const feeToken = feeTokenResult?.feeToken || DEFAULT_FEE_TOKEN;
      const gasPrice = feeToken?.gasPriceStep?.average || 0;

      // Get the symbol for display
      const feeSymbol = feeTokenResult?.symbol || feeToken.denom;
      const feeObject = {
        amount: 0,
        asset: params.step.fromAsset,
        chainId: params.step.fromChain,
        feeToken: feeToken,
        gasWanted: 0,
        gasPrice: gasPrice,
      };

      set(transactionLogsAtom, {
        ...currentLogs,
        [stepHash]: {
          description: params.description,
          status: TransactionStatus.IDLE,
          fees: [feeObject],
          feeSymbol: feeSymbol,
          inputAmount: params.initialAmounts?.inputAmount || '0',
          outputAmount: params.initialAmounts?.outputAmount || '0',
        },
      });
    }

    return stepHash;
  },
);

export const getExchangeRateAtom = atom(get => {
  const logs = get(transactionLogsAtom);
  const exchangeRates: { [stepHash: string]: number } = {};

  Object.entries(logs).forEach(([stepHash, log]) => {
    if (log.exchangeRate !== undefined && log.exchangeRate !== 1) {
      exchangeRates[stepHash] = log.exchangeRate;
    }
  });

  return exchangeRates;
});
