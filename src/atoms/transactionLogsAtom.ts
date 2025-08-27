import { atom } from 'jotai';
import { TransactionLog, TransactionLogs, TransactionStep } from '@/types';
import { DEFAULT_FEE_TOKEN, TransactionStatus } from '@/constants';
import { chainInfoAtom } from './chainRegistryAtom';
import { determineFeeToken } from '@/helpers';

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
      feeData?: {
        gasWanted?: string;
        amount?: number;
      };
    },
  ) => {
    const currentLogs = get(transactionLogsAtom);
    const existingLog = currentLogs[params.stepHash] || {};

    let feeUpdate = {};
    if (params.feeData) {
      const { gasWanted, amount } = params.feeData;
      feeUpdate = {
        fee: {
          ...existingLog.fee,
          ...(gasWanted && { gasWanted: parseInt(gasWanted, 10) }),
          ...(amount !== undefined && { amount }),
        },
      };
    }

    set(transactionLogsAtom, {
      ...currentLogs,
      [params.stepHash]: {
        ...existingLog,
        ...params.log,
        ...feeUpdate,
      },
    });
  },
);

export const resetTransactionLogsAtom = atom(null, (_, set) => {
  console.log('[resetTransactionLogsAtom] Resetting transaction logs');
  set(transactionLogsAtom, {});
});

export const createStepLogAtom = atom(
  null,
  (get, set, params: { step: TransactionStep; description: string }) => {
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

      set(transactionLogsAtom, {
        ...currentLogs,
        [stepHash]: {
          description: params.description,
          status: TransactionStatus.IDLE,
          fee: {
            amount: 0,
            asset: params.step.fromAsset,
            chainId: params.step.fromChain,
            feeToken: feeToken,
            gasWanted: 0,
            gasPrice: gasPrice,
          },
          feeSymbol: feeSymbol,
        },
      });
    }

    return stepHash;
  },
);
