import { TransactionType } from '@/constants';
import { TransactionDetails, TransactionState } from '@/types';
import { chainInfoAtom } from './chainRegistryAtom';
import { chainWalletAtom } from './walletAtom';
import { recipientAddressAtom } from './addressAtom';
import { getTransactionType, getValidIBCChannel, isValidSwap, isValidTransaction } from '@/helpers';
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
      sendState?: TransactionState;
      receiveState?: TransactionState;
      walletAddress?: string;
      recipientAddress?: string;
    },
  ) => {
    const getChainInfo = get(chainInfoAtom);
    const sendState = params.sendState || get(sendStateAtom);
    const receiveState = params.receiveState || get(receiveStateAtom);
    const walletAddress = params.walletAddress || get(chainWalletAtom(sendState.chainID))?.address;
    const recipientAddress = params.recipientAddress || get(recipientAddressAtom);

    if (!sendState.asset || !receiveState.asset) {
      console.error('Missing assets for transaction type update');
      return;
    }

    console.log('[TransactionType] Chain IDs', sendState.chainID, receiveState.chainID);
    const sendChain = getChainInfo(sendState.chainID);
    const restUris = sendChain.rest_uris;

    try {
      const isValidIbcTx = await getValidIBCChannel({
        sendChain,
        receiveChainId: receiveState.chainID,
        networkLevel: sendChain.network_level,
        prefix: sendChain.bech32_prefix,
        restUris,
      });
      console.log('[TransactionTypeAtom] Is IBC enabled?:', isValidIbcTx);

      const isValidSwapTx = isValidSwap({
        sendAsset: sendState.asset,
        receiveAsset: receiveState.asset,
      });

      const isValidTx = await isValidTransaction({
        sendAddress: walletAddress,
        recipientAddress,
        sendState,
        receiveState,
      });

      const newTransactionType = getTransactionType(
        isValidIbcTx ? true : false,
        isValidSwapTx,
        isValidTx,
      );
      const newTransactionDetails = {
        type: newTransactionType,
        isValid: isValidTx,
        isIBC: isValidIbcTx ? true : false,
        isSwap: isValidSwapTx,
      };

      console.log('[TransactionTypeAtom] Setting transaction details to:', newTransactionDetails);

      set(transactionTypeAtom, newTransactionDetails);
    } catch (error) {
      console.error('Error updating transaction type:', error);
      set(transactionTypeAtom, {
        type: TransactionType.INVALID,
        isValid: false,
        isIBC: false,
        isSwap: false,
      });
    }
  },
);
