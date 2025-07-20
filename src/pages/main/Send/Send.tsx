import { useEffect } from 'react';
import { useLocation } from 'react-router-dom';
import { Spinner } from '@/assets/icons';
import { ROUTES, TransactionStatus } from '@/constants';
import { Button, Separator } from '@/ui-kit';
import { useAtom, useAtomValue, useSetAtom } from 'jotai';
import {
  recipientAddressAtom,
  receiveStateAtom,
  sendStateAtom,
  selectedAssetAtom,
  addressVerifiedAtom,
  // symphonyAssetsAtom,
  // subscribedChainRegistryAtom,
  chainWalletAtom,
  defaultAssetAtom,
  resetTransactionStatesAtom,
  transactionTypeAtom,
  // transactionLogAtom,
  transactionErrorAtom,
  transactionStatusAtom,
  isLoadingAtom,
  isTransactionSuccessAtom,
  transactionFailedAtom,
  unloadFullRegistryAtom,
  loadFullRegistryAtom,
  calculatedFeeAtom,
} from '@/atoms';
import {
  WalletSuccessScreen,
  TransactionResultsTile,
  Header,
  AssetInputSection,
} from '@/components';
import {
  // convertToGreaterUnit,
  formatLowBalanceDisplay,
  // truncateWalletAddress
} from '@/helpers';
import { useTransactionHandler } from '@/hooks/';

// TODO: handle bridges to non-cosmos chains (Axelar to Ethereum and others)
export const Send = () => {
  const location = useLocation();
  const { runTransaction } = useTransactionHandler();

  // const symphonyAssets = useAtomValue(symphonyAssetsAtom);
  const [sendState, setSendState] = useAtom(sendStateAtom);
  const setReceiveState = useSetAtom(receiveStateAtom);
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
  // const [transactionLog, setTransactionLog] = useAtom(transactionLogAtom);
  const [transactionStatus, setTransactionStatus] = useAtom(transactionStatusAtom);
  const isLoading = useAtomValue(isLoadingAtom);
  const isSuccess = useAtomValue(isTransactionSuccessAtom);
  const transactionFailed = useAtomValue(transactionFailedAtom);
  const transactionError = useAtomValue(transactionErrorAtom);
  const loadFullRegistry = useSetAtom(loadFullRegistryAtom);
  const unloadFullRegistry = useSetAtom(unloadFullRegistryAtom);
  const calculatedFee = useAtomValue(calculatedFeeAtom);

  const resetStates = () => {
    console.log('Resetting transaction states');

    // Reset all transaction-related atoms
    resetTransactionStates();

    // Reset recipient and selection
    const stableAddress = walletState.address;
    if (stableAddress && recipientAddress !== walletState.address && !addressVerified) {
      setRecipientAddress(stableAddress);
      setSelectedAsset(defaultAsset);
    }

    // Reset transaction status
    setTransactionStatus({
      status: TransactionStatus.IDLE,
    });

    // Reset transaction log
    // setTransactionLog({
    //   isSimulation: false,
    //   entries: [],
    // });
  };

  const handleBackClick = () => {
    resetStates();
    unloadFullRegistry();
  };

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
    // When selected asset changes, update send state chain ID
    setSendState(prev => ({
      ...prev,
      chainID: selectedAsset.networkID,
    }));
    setReceiveState(prev => ({
      ...prev,
      chainID: selectedAsset.networkID,
    }));
  }, [selectedAsset]);

  useEffect(() => {
    console.log("[Send] walletstate's address on init", walletState.address);
    setRecipientAddress(walletState.address);
    loadFullRegistry();

    return () => {
      // Reset the states when the component is unmounted (user leaves the page)
      resetStates();
      unloadFullRegistry();
    };
  }, []);

  if (location.pathname === ROUTES.APP.SEND && isSuccess) {
    return <WalletSuccessScreen caption="Transaction success!" txHash={transactionStatus.txHash} />;
  }

  //  TODO: move fee section to own component
  console.log('[Send] Current calculated fee display:', calculatedFee);
  return (
    <div className="h-screen flex flex-col bg-black text-white">
      <Header title={'Send'} onClose={handleBackClick} useArrow={true} />

      {/* Content container */}
      <div className="flex flex-col justify-between flex-grow p-4 rounded-lg overflow-y-auto">
        <>
          {/* TODO: add chain selection if self */}
          <AssetInputSection />
        </>

        {/* 
          TODO: add labels above text in fee block
          TODO: view error then resolve to list
        */}

        {/* Info Section */}
        <div
          className={`flex flex-grow mx-2 my-4 border rounded-md border-neutral-4 justify-center ${
            isLoading || transactionError
              ? 'items-center '
              : 'flex-col items-start overflow-y-auto p-4'
          }`}
        >
          {isLoading && <Spinner className="h-16 w-16 animate-spin fill-blue" />}
          {transactionFailed && (
            <TransactionResultsTile isSuccess={false} size="sm" message={transactionError} />
          )}
          {/* {!isLoading &&
            !transactionFailed &&
            transactionLog.entries.map((entry, index) => {
              const { sendObject } = entry;

              const sendChain = chainRegistry.mainnet[sendState.chainID];
              const receiveChain = chainRegistry.mainnet[receiveState.chainID];
              const sendChainName = sendChain.chain_name;
              const receiveChainName = receiveChain.chain_name;

              const isIBC = sendChainName !== receiveChainName;
              const isSwap = sendState.asset?.denom !== receiveState.asset?.denom;

              const sendAssetSymbol = sendState.asset.symbol;
              const exponent = sendState.asset.exponent;
              const sendReadableAmount = formatBalanceDisplay(
                convertToGreaterUnit(sendObject.amount, exponent).toFixed(exponent),
                sendAssetSymbol,
              );
              const receiveChainPrefix = receiveChain.bech32_prefix;

              let description = `Send ${sendReadableAmount}`;
              if (isIBC) {
                description += ` to ${truncateWalletAddress(receiveChainPrefix, sendObject.recipientAddress)}`;
              } else if (isSwap) {
                const receiveAsset = symphonyAssets.find(
                  asset => asset.denom === receiveState.asset?.denom,
                );

                description += ` → ${receiveAsset?.symbol} to ${truncateWalletAddress(
                  receiveChainPrefix,
                  sendObject.recipientAddress,
                )}`;
              } else {
                description += ` to ${truncateWalletAddress(receiveChainPrefix, sendObject.recipientAddress)}`;
              }
              description += ` on ${receiveChainName.charAt(0).toUpperCase()}${receiveChainName.slice(1)}`;

              return (
                <div
                  key={index}
                  className="flex justify-between items-center w-full text-sm text-white mb-1"
                >
                  <span className="text-left truncate">{description}</span>
                  <span className="text-right min-w-[2rem]">
                    {entry.isSuccess === true && transactionLog.isSimulation && (
                      <span className="text-success">✔</span>
                    )}
                    {entry.isSuccess === true && !transactionLog.isSimulation && (
                      <span className="text-success">✔✔</span>
                    )}
                    {entry.isSuccess !== true && <span className="text-gray-500">—</span>}
                  </span>
                </div>
              );
            })} */}
        </div>

        {/* Fee Section */}
        <div className="flex justify-between items-center text-blue text-sm font-bold mx-2">
          <p>Estimated Fee</p>
          <p className={calculatedFee.textClass}>
            {calculatedFee && calculatedFee.feeAmount > 0 && sendState.amount !== 0
              ? formatLowBalanceDisplay(`${calculatedFee.calculatedFee}`, calculatedFee.feeUnit)
              : '-'}
          </p>
        </div>

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
