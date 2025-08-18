import { TransactionType } from '@/constants';
import { TransactionDetails, TransactionState } from '@/types';
import { chainInfoAtom, skipChainsAtom } from './chainRegistryAtom';
import { chainWalletAtom } from './walletAtom';
import { recipientAddressAtom } from './addressAtom';
import { categorizeTransaction, getValidIBCChannel, isValidSwap } from '@/helpers';
import { atom } from 'jotai';
import { receiveStateAtom, sendStateAtom } from './transactionStateAtom';
import { skipAssetsAtom } from './assetsAtom';

export const transactionTypeAtom = atom<TransactionDetails>({
  type: TransactionType.INVALID,
  isValid: false,
  isIBC: false,
  isSwap: false,
  isExchange: false,
});

// TODO: skip IBC check if chains are the same.  skip exchange and swap checks if denoms are the same
// TODO: check isValid and transaction type separately.  isValid sets whether or not to send simulations and transactions.  transaction type determines what
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
    const skipAssets = get(skipAssetsAtom);

    if (!sendState.asset || !receiveState.asset) {
      console.error('Missing assets for transaction type update');
      return;
    }

    console.log('[TransactionType] Chain ids', sendState.chainId, receiveState.chainId);
    const sendChain = getChainInfo(sendState.chainId);
    const restUris = sendChain.rest_uris;

    try {
      const receiveChainId = receiveState.chainId;

      const isValidSend =
        sendState.chainId === receiveChainId &&
        sendState.asset.originDenom === receiveState.asset.originDenom;

      // TODO: modify swap check to validate against Symphony's list of assets.  via useExchangeAssets?
      // const isSwapTx = false;
      // sendState.asset.chainId === receiveChainId &&
      // receiveChainId === getSymphonyChainId(sendChain.network_level);
      const isValidSwapTx = isValidSwap({
        sendAsset: sendState.asset,
        receiveAsset: receiveState.asset,
      });

      // Create a Set of all Skip-supported denoms for quick lookup
      const skipSupportedDenoms = new Set<string>();
      for (const asset of Object.values(skipAssets)) {
        skipSupportedDenoms.add(asset.originDenom || asset.denom);
      }
      console.log('[TransactionTypeAtom] Skip supported denoms:', skipSupportedDenoms);

      // Check if both assets are supported by Skip
      const isSendAssetSupported = skipSupportedDenoms.has(sendState.asset.originDenom); // skip uses origin denom
      console.log(
        '[TransactionTypeAtom] isSendAssetSupported:',
        sendState.asset.originDenom,
        isSendAssetSupported,
      );
      const isReceiveAssetSupported = skipSupportedDenoms.has(receiveState.asset.originDenom); // skip uses origin denom
      console.log(
        '[TransactionTypeAtom] isReceiveAssetSupported:',
        receiveState.asset.originDenom,
        isReceiveAssetSupported,
      );

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

      // Transaction is Skip-supported if both chains and assets are supported
      const isSkipSupported =
        isSendChainSupported &&
        isReceiveChainSupported &&
        isSendAssetSupported &&
        isReceiveAssetSupported;

      console.log('[TransactionTypeAtom] Is skip supported?:', isSkipSupported);
      // const isIBCTx = sendChain.chain_id !== receiveChainId;
      const isValidIbcTx = await getValidIBCChannel({
        sendChain,
        receiveChainId: receiveChainId,
        networkLevel: sendChain.network_level,
        prefix: sendChain.bech32_prefix,
        restUris,
      });
      console.log('[TransactionTypeAtom] Is IBC enabled?:', isValidIbcTx);

      const isValidExchange = isSkipSupported && sendState.asset !== receiveState.asset;

      // TODO: modify isValidTransaction.  transaction is valid if is same asset on same chain, or is valid swap, exchange, or ibc
      const txCategorizationDetails = await categorizeTransaction({
        sendAddress: walletAddress,
        recipientAddress,
        sendState,
        receiveState,
        isSend: isValidSend,
        isIBC: isValidIbcTx ? true : false,
        isSwap: isValidSwapTx,
        isExchange: isValidExchange,
      });

      console.log('[TransactionTypeAtom] Setting transaction details to:', txCategorizationDetails);
      set(transactionTypeAtom, txCategorizationDetails);
    } catch (error) {
      console.error('Error updating transaction type:', error);
      set(transactionTypeAtom, {
        type: TransactionType.INVALID,
        isValid: false,
        isIBC: false,
        isSwap: false,
        isExchange: false,
      });
    }
  },
);
