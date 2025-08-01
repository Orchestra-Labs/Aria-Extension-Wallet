import { TransactionType } from '@/constants';
import { TransactionDetails, TransactionState } from '@/types';
import { subscribedChainRegistryAtom } from './chainRegistryAtom';
import { chainWalletAtom } from './walletAtom';
import { recipientAddressAtom } from './addressAtom';
import { getTransactionDetails, isIBC, isValidSwap, isValidTransaction } from '@/helpers';
import { atom } from 'jotai';
import { receiveStateAtom, sendStateAtom } from './transactionStateAtom';

export const transactionTypeAtom = atom<TransactionDetails>({
  type: TransactionType.INVALID,
  isValid: false,
  isIBC: false,
  isSwap: false,
});

export const updateTransactionTypeAtom = atom(
  null,
  async (
    get,
    set,
    params: {
      sendStateOverride?: TransactionState;
      receiveStateOverride?: TransactionState;
      walletAddress?: string;
      recipientAddress?: string;
      chainRegistry?: any;
    },
  ) => {
    const sendState = params.sendStateOverride || get(sendStateAtom);
    const receiveState = params.receiveStateOverride || get(receiveStateAtom);
    const walletAddress = params.walletAddress || get(chainWalletAtom(sendState.chainID))?.address;
    const recipientAddress = params.recipientAddress || get(recipientAddressAtom);
    const chainRegistry = params.chainRegistry || get(subscribedChainRegistryAtom);

    if (!sendState.asset || !receiveState.asset) {
      console.error('Missing assets for transaction type update');
      return;
    }

    const sendChain = chainRegistry.mainnet[sendState.chainID];
    const sendChainLevel = sendChain.network_level;
    const restUris = sendChain.rest_uris;

    try {
      const isIBCEnabled = await isIBC({
        sendAddress: walletAddress,
        recipientAddress,
        network: sendChainLevel,
        prefix: sendChain.bech32_prefix,
        restUris,
      });

      const isSwapEnabled = isValidSwap({
        sendAsset: sendState.asset,
        receiveAsset: receiveState.asset,
      });

      const isValidTransactionEnabled = await isValidTransaction({
        sendAddress: walletAddress,
        recipientAddress,
        sendState,
        receiveState,
      });

      const newTransactionDetails = getTransactionDetails(
        isIBCEnabled,
        isSwapEnabled,
        isValidTransactionEnabled,
      );

      set(transactionTypeAtom, newTransactionDetails);
      return newTransactionDetails;
    } catch (error) {
      console.error('Error updating transaction type:', error);
      set(transactionTypeAtom, {
        type: TransactionType.INVALID,
        isValid: false,
        isIBC: false,
        isSwap: false,
      });
      return {
        type: TransactionType.INVALID,
        isValid: false,
        isIBC: false,
        isSwap: false,
      };
    }
  },
);
