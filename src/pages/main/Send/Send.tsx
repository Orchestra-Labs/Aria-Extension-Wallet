import { useEffect } from 'react';
import { useLocation } from 'react-router-dom';
import { ROUTES } from '@/constants';
import { Button, Separator } from '@/ui-kit';
import { useAtom, useAtomValue, useSetAtom } from 'jotai';
import {
  recipientAddressAtom,
  receiveStateAtom,
  sendStateAtom,
  selectedAssetAtom,
  addressVerifiedAtom,
  chainWalletAtom,
  defaultAssetAtom,
  resetTransactionStatesAtom,
  transactionTypeAtom,
  transactionErrorAtom,
  transactionStatusAtom,
  isLoadingAtom,
  isTransactionSuccessAtom,
  unloadFullRegistryAtom,
  loadFullRegistryAtom,
  calculatedFeeAtom,
  resetTransactionLogAtom,
  updateTransactionTypeAtom,
} from '@/atoms';
import {
  WalletSuccessScreen,
  Header,
  SendDataInputSection,
  TransactionInfoPanel,
} from '@/components';
import { useSendActions } from '@/hooks/';

// TODO: handle bridges to non-cosmos chains (Axelar to Ethereum and others)
export const Send = () => {
  const location = useLocation();
  const { runTransaction } = useSendActions();

  // const symphonyAssets = useAtomValue(symphonyAssetsAtom);
  const sendState = useAtomValue(sendStateAtom);
  const receiveState = useAtomValue(receiveStateAtom);
  const [recipientAddress, setRecipientAddress] = useAtom(recipientAddressAtom);
  const addressVerified = useAtom(addressVerifiedAtom);
  const [selectedAsset, setSelectedAsset] = useAtom(selectedAssetAtom);
  // const chainRegistry = useAtomValue(subscribedChainRegistryAtom);
  const defaultAsset = useAtomValue(defaultAssetAtom);
  const resetTransactionStates = useSetAtom(resetTransactionStatesAtom);
  console.log("[Send] selected asset's network id", selectedAsset.networkID);
  const walletState = useAtomValue(chainWalletAtom(selectedAsset.networkID));
  console.log('[Send] initial wallet state', walletState);
  const transactionType = useAtomValue(transactionTypeAtom);
  const [transactionStatus, setTransactionStatus] = useAtom(transactionStatusAtom);
  const isLoading = useAtomValue(isLoadingAtom);
  const isSuccess = useAtomValue(isTransactionSuccessAtom);
  const transactionError = useAtomValue(transactionErrorAtom);
  const loadFullRegistry = useSetAtom(loadFullRegistryAtom);
  const unloadFullRegistry = useSetAtom(unloadFullRegistryAtom);
  const calculatedFee = useAtomValue(calculatedFeeAtom);
  const resetLogs = useSetAtom(resetTransactionLogAtom);
  const updateTransactionType = useSetAtom(updateTransactionTypeAtom);

  const resetStates = () => {
    console.log('[Send] Resetting transaction states');

    // Reset all transaction-related atoms
    resetTransactionStates();

    // Reset recipient and selection
    const stableAddress = walletState.address;
    if (stableAddress && recipientAddress !== walletState.address && !addressVerified) {
      setRecipientAddress(stableAddress);
      setSelectedAsset(defaultAsset);
    }
  };

  const handleBackClick = () => {
    resetStates();
    unloadFullRegistry();
  };

  // const updateTransactionType = async ({
  //   sendState,
  //   receiveState,
  //   walletAddress,
  //   recipientAddress,
  // }: {
  //   sendState: TransactionState;
  //   receiveState: TransactionState;
  //   walletAddress: string;
  //   recipientAddress: string;
  // }) => {
  //   if (!sendState.asset || !receiveState.asset) {
  //     console.error('Missing assets for transaction type update');
  //     return;
  //   }

  //   console.log('[TransactionType] Chain IDs', sendState.chainID, receiveState.chainID);

  //   try {
  //     console.log('[TransactionType] Chain IDs', sendState.chainID, receiveState.chainID);
  //     const sendChain = getChainInfo(sendState.chainID);
  //     const restUris = sendChain.rest_uris;

  //     const isValidIbcTx = await getValidIBCChannel({
  //       sendChain,
  //       receiveChainId: receiveState.chainID,
  //       networkLevel: sendChain.network_level,
  //       prefix: sendChain.bech32_prefix,
  //       restUris,
  //     });
  //     console.log('[TransactionTypeAtom] Is IBC enabled?:', isValidIbcTx);

  //     const isValidSwapTx = isValidSwap({
  //       sendAsset: sendState.asset,
  //       receiveAsset: receiveState.asset,
  //     });

  //     const isValidTx = await isValidTransaction({
  //       sendAddress: walletAddress,
  //       recipientAddress,
  //       sendState,
  //       receiveState,
  //     });

  //     const newTransactionType = getTransactionType(
  //       isValidIbcTx ? true : false,
  //       isValidSwapTx,
  //       isValidTx,
  //     );
  //     const newTransactionDetails = {
  //       type: newTransactionType,
  //       isValid: isValidTx,
  //       isIBC: isValidIbcTx ? true : false,
  //       isSwap: isValidSwapTx,
  //     };

  //     console.log('[TransactionTypeAtom] Setting transaction details to:', newTransactionDetails);

  //     setTransactionType(newTransactionDetails);
  //   } catch (error) {
  //     console.error('Error updating transaction type:', error);
  //     setTransactionType({
  //       type: TransactionType.INVALID,
  //       isValid: false,
  //       isIBC: false,
  //       isSwap: false,
  //     });
  //   }
  // };

  useEffect(() => {
    const updateTxType = async () => {
      if (!walletState.address) return;

      try {
        await updateTransactionType({
          sendState,
          receiveState,
          walletAddress: walletState.address,
          recipientAddress: recipientAddress,
        });
      } catch (error) {
        console.error('Error updating transaction type:', error);
      }
    };

    updateTxType();
  }, [sendState, receiveState, recipientAddress, walletState]);

  useEffect(() => {
    if (!transactionError) return;

    const timeout = setTimeout(() => {
      setTransactionStatus(prev => ({
        ...prev,
        // NOTE: Clear error after timeout
        error: undefined,
      }));
    }, 5000);

    return () => clearTimeout(timeout);
  }, [transactionError]);

  useEffect(() => {
    console.log("[Send] walletstate's address on init", walletState.address);
    setRecipientAddress(walletState.address);
    loadFullRegistry();
    resetLogs();

    return () => {
      // Reset the states when the component is unmounted (user leaves the page)
      resetStates();
      unloadFullRegistry();
    };
  }, []);

  if (location.pathname === ROUTES.APP.SEND && isSuccess) {
    return <WalletSuccessScreen caption="Transaction success!" txHash={transactionStatus.txHash} />;
  }

  console.log('[Send] Current calculated fee display:', calculatedFee);
  return (
    <div className="h-screen flex flex-col bg-black text-white">
      <Header title={'Send'} onClose={handleBackClick} useArrow={true} />

      {/* Content container */}
      <div className="flex flex-col justify-between flex-grow p-4 rounded-lg overflow-y-auto">
        <>
          {/* TODO: add chain selection if self */}
          <SendDataInputSection />
        </>

        {/* Info Section */}
        <TransactionInfoPanel />

        {/* Separator */}
        <div className="mt-2">
          <Separator variant="top" />

          {/* Send Button */}
          <Button
            className="w-[85%]"
            onClick={() => runTransaction()}
            disabled={isLoading || sendState.amount === 0 || !transactionType.isValid}
          >
            Send
          </Button>
        </div>
      </div>
    </div>
  );
};
