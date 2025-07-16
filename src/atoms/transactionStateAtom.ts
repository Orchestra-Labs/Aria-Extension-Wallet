import { atom, WritableAtom } from 'jotai';
import { defaultFeeState, defaultReceiveState, defaultSendState } from '@/constants';
import { TransactionState } from '@/types';
import { selectedAssetAtom } from './assetsAtom';
import { networkLevelAtom } from './networkLevelAtom';
import { subscribedChainRegistryAtom } from './chainRegistryAtom';

type TransactionStateAtom = WritableAtom<
  TransactionState,
  [TransactionState | ((prev: TransactionState) => TransactionState)],
  void
>;

// Helper function to create transaction state atoms
const createTransactionAtom = (
  defaultState: TransactionState,
  storageAtom: WritableAtom<TransactionState, [TransactionState], void>,
) => {
  return atom(
    get => {
      const baseState = get(storageAtom);
      if (baseState.asset.denom === defaultState.asset.denom) {
        const selectedAsset = get(selectedAssetAtom);
        return {
          ...defaultState,
          asset: selectedAsset,
          chainID: selectedAsset.networkID,
        };
      }
      return baseState;
    },
    (get, set, update: TransactionState | ((prev: TransactionState) => TransactionState)) => {
      const current = get(storageAtom);
      const newValue = typeof update === 'function' ? update(current) : update;
      set(storageAtom, newValue);
    },
  ) as TransactionStateAtom;
};

// Base storage atoms
const _sendStateAtom = atom<TransactionState>(defaultSendState);
const _receiveStateAtom = atom<TransactionState>(defaultReceiveState);
const _feeStateAtom = atom<TransactionState>(defaultFeeState);

// Public state atoms
export const sendStateAtom = createTransactionAtom(defaultSendState, _sendStateAtom);
export const receiveStateAtom = createTransactionAtom(defaultReceiveState, _receiveStateAtom);

export const feeStateAtom: TransactionStateAtom = atom(
  get => {
    const selectedAsset = get(selectedAssetAtom);
    const networkLevel = get(networkLevelAtom);
    const chainRegistry = get(subscribedChainRegistryAtom);

    const chainInfo = chainRegistry[networkLevel][selectedAsset.networkID];
    const feeToken = chainInfo?.fees?.find(fee => fee.denom === selectedAsset.denom);

    return {
      asset: selectedAsset,
      amount: feeToken?.gasPriceStep?.average || defaultFeeState.amount,
      chainID: selectedAsset.networkID,
      feeToken: feeToken
        ? {
            denom: selectedAsset.denom,
            gasPriceStep: feeToken.gasPriceStep,
          }
        : undefined,
    };
  },
  (get, set, update: TransactionState | ((prev: TransactionState) => TransactionState)) => {
    const current = get(_feeStateAtom);
    const newValue = typeof update === 'function' ? update(current) : update;
    set(_feeStateAtom, newValue);
  },
);

// Reset function
export const resetTransactionStatesAtom = atom(null, (get, set) => {
  const selectedAsset = get(selectedAssetAtom);

  set(_sendStateAtom, {
    ...defaultSendState,
    asset: selectedAsset,
    chainID: selectedAsset.networkID,
  });

  set(_receiveStateAtom, {
    ...defaultReceiveState,
    asset: selectedAsset,
    chainID: selectedAsset.networkID,
  });

  // Reset fee state while maintaining the current fee calculation
  set(_feeStateAtom, {
    ...get(feeStateAtom),
    ...defaultFeeState,
  });
});
