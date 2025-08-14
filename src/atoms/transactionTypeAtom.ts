import { TransactionType } from '@/constants';
import { TransactionDetails, TransactionState } from '@/types';
import { chainInfoAtom, skipChainsAtom } from './chainRegistryAtom';
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
    const walletAddress = params.walletAddress || get(chainWalletAtom(sendState.chainId))?.address;
    const recipientAddress = params.recipientAddress || get(recipientAddressAtom);
    const skipChains = get(skipChainsAtom);

    if (!sendState.asset || !receiveState.asset) {
      console.error('Missing assets for transaction type update');
      return;
    }

    console.log('[TransactionType] Chain IDs', sendState.chainId, receiveState.chainId);
    const sendChain = getChainInfo(sendState.chainId);
    const restUris = sendChain.rest_uris;

    try {
      const receiveChainId = receiveState.chainId;
      console.log('[TransactionTypeAtom] Skip Chains:', skipChains);
      const isSendChainSupported = skipChains.includes(sendChain.chain_id);
      console.log(
        '[TransactionTypeAtom] isSendChainSupported:',
        sendChain.chain_id,
        isSendChainSupported,
      );
      const isReceiveChainSupported = skipChains.includes(receiveChainId);
      console.log(
        '[TransactionTypeAtom] isReceiveChainSupported:',
        receiveChainId,
        isReceiveChainSupported,
      );

      const isSkipSupported = isSendChainSupported && isReceiveChainSupported;
      console.log('[TransactionTypeAtom] Is skip supported?:', isSkipSupported);
      const isValidIbcTx =
        isSkipSupported ||
        (await getValidIBCChannel({
          sendChain,
          receiveChainId: receiveChainId,
          networkLevel: sendChain.network_level,
          prefix: sendChain.bech32_prefix,
          restUris,
        }));
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
