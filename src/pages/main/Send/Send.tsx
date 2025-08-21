import { useEffect } from 'react';
import { useLocation } from 'react-router-dom';
import { ROUTES } from '@/constants';
import { Button, Separator } from '@/ui-kit';
import { useAtom, useAtomValue, useSetAtom } from 'jotai';
import {
  recipientAddressAtom,
  sendStateAtom,
  selectedAssetAtom,
  addressVerifiedAtom,
  chainWalletAtom,
  defaultAssetAtom,
  resetTransactionStatesAtom,
  isTxPendingAtom,
  isTransactionSuccessAtom,
  unloadFullRegistryAtom,
  loadFullRegistryAtom,
  loadSkipChainsAtom,
  loadSkipAssetsAtom,
  transactionHasValidRouteAtom,
  transactionRouteAtom,
  finalTransactionHashAtom,
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
  // TODO: set send state from selected asset
  const sendState = useAtomValue(sendStateAtom);
  const [recipientAddress, setRecipientAddress] = useAtom(recipientAddressAtom);
  const addressVerified = useAtom(addressVerifiedAtom);
  const [selectedAsset, setSelectedAsset] = useAtom(selectedAssetAtom);
  // const chainRegistry = useAtomValue(subscribedChainRegistryAtom);
  const defaultAsset = useAtomValue(defaultAssetAtom);
  const resetTransactionStates = useSetAtom(resetTransactionStatesAtom);
  console.log("[Send] selected asset's network id", selectedAsset.chainId);
  const walletState = useAtomValue(chainWalletAtom(selectedAsset.chainId));
  console.log('[Send] initial wallet state', walletState);
  const transactionHasValidRoute = useAtomValue(transactionHasValidRouteAtom);
  const isTxPending = useAtomValue(isTxPendingAtom);
  const isSuccess = useAtomValue(isTransactionSuccessAtom);
  const loadFullRegistry = useSetAtom(loadFullRegistryAtom);
  const unloadFullRegistry = useSetAtom(unloadFullRegistryAtom);
  const loadSkipChains = useSetAtom(loadSkipChainsAtom);
  const loadSkipAssets = useSetAtom(loadSkipAssetsAtom);
  const transactionRoute = useAtomValue(transactionRouteAtom);
  const finalTxHash = useAtomValue(finalTransactionHashAtom);

  const isSimulation = transactionRoute.isSimulation;

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

  useEffect(() => {
    console.log("[Send] walletstate's address on init", walletState.address);
    setRecipientAddress(walletState.address);
    loadFullRegistry();
    loadSkipChains();
    loadSkipAssets();

    return () => {
      // Reset the states when the component is unmounted (user leaves the page)
      resetStates();
      unloadFullRegistry();
    };
  }, []);

  if (location.pathname === ROUTES.APP.SEND && isSuccess && !isSimulation) {
    return <WalletSuccessScreen caption="Transaction success!" txHash={finalTxHash} />;
  }

  return (
    <div className="h-screen flex flex-col bg-black text-white">
      <Header title={'Send'} onClose={handleBackClick} useArrow={true} />

      {/* Content container */}
      <div className="flex flex-col justify-between flex-grow p-4 rounded-lg overflow-y-auto">
        {/* TODO: add chain selection if self */}
        <SendDataInputSection />

        {/* Info Section */}
        <TransactionInfoPanel />

        {/* Separator */}
        <div className="mt-2">
          <Separator variant="top" />

          {/* Send Button */}
          <Button
            className="w-[85%]"
            onClick={() => runTransaction()}
            disabled={isTxPending || sendState.amount === 0 || !transactionHasValidRoute}
          >
            Send
          </Button>
        </div>
      </div>
    </div>
  );
};
