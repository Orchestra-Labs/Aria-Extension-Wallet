import { atom } from 'jotai';
import { TransactionLog, TransactionLogs, TransactionStep } from '@/types';
import { DEFAULT_FEE_TOKEN, TransactionStatus } from '@/constants';
import { chainInfoAtom } from './chainRegistryAtom';

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
      const defaultFeeToken = chainInfo?.fees?.[0] || DEFAULT_FEE_TOKEN;

      const gasPrice = defaultFeeToken?.gasPriceStep?.average || 0;

      set(transactionLogsAtom, {
        ...currentLogs,
        [stepHash]: {
          description: params.description,
          status: TransactionStatus.IDLE,
          fee: {
            amount: 0,
            asset: params.step.fromAsset,
            chainId: params.step.fromChain,
            feeToken: defaultFeeToken,
            gasWanted: 0,
            gasPrice: gasPrice,
          },
        },
      });
    }

    return stepHash;
  },
);
