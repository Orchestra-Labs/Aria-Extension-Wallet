import { atom } from 'jotai';
import { defaultFeeState, defaultReceiveState, defaultSendState } from '@/constants';
import { TransactionState } from '@/types';
import { defaultAssetAtom } from './assetsAtom';
import { networkLevelAtom } from './networkLevelAtom';
import { subscribedChainRegistryAtom } from './chainRegistryAtom';

// Helper function to create a transaction state atom with default asset fallback
const createTransactionStateAtom = (defaultState: TransactionState) => {
  return atom(
    get => {
      const defaultAsset = get(defaultAssetAtom);
      return {
        ...defaultState,
        asset: defaultAsset,
        chainID: defaultAsset.networkID,
      };
    },
    (get, set, update: TransactionState | ((prev: TransactionState) => TransactionState)) => {
      const defaultAsset = get(defaultAssetAtom);
      const newValue =
        typeof update === 'function'
          ? update({
              ...defaultState,
              asset: defaultAsset,
              chainID: defaultAsset.networkID,
            })
          : update;

      set(defaultStateAtom, newValue);
    },
  );
};

// Special atom for fee state that considers chain-specific fee tokens
export const feeStateAtom = atom(
  get => {
    const defaultAsset = get(defaultAssetAtom);
    const networkLevel = get(networkLevelAtom);
    const chainRegistry = get(subscribedChainRegistryAtom);

    // Get the chain info for the default asset's network
    const chainInfo = chainRegistry[networkLevel][defaultAsset.networkID];

    // Find the first fee token that matches our default asset
    const feeToken = chainInfo?.fees?.find(fee => fee.denom === defaultAsset.denom);

    return {
      asset: defaultAsset,
      amount: feeToken?.gasPriceStep?.average || defaultFeeState.amount,
      chainID: defaultAsset.networkID,
      // Include additional fee token info if available
      feeToken: feeToken
        ? {
            denom: defaultAsset.denom,
            gasPriceStep: feeToken.gasPriceStep,
          }
        : undefined,
    };
  },
  (get, set, update: TransactionState | ((prev: TransactionState) => TransactionState)) => {
    const currentState = get(feeStateAtom);
    const newValue = typeof update === 'function' ? update(currentState) : update;
    set(defaultStateAtom, newValue);
  },
);

export const sendStateAtom = createTransactionStateAtom(defaultSendState);
export const receiveStateAtom = createTransactionStateAtom(defaultReceiveState);

// Maintain the original atom for internal use
const defaultStateAtom = atom<TransactionState>(defaultSendState);

// Helper function to reset all transaction states
export const resetTransactionStatesAtom = atom(null, (get, set) => {
  const defaultAsset = get(defaultAssetAtom);

  set(sendStateAtom, {
    ...defaultSendState,
    asset: defaultAsset,
    chainID: defaultAsset.networkID,
  });

  set(receiveStateAtom, {
    ...defaultReceiveState,
    asset: defaultAsset,
    chainID: defaultAsset.networkID,
  });

  set(feeStateAtom, get(feeStateAtom));
});
