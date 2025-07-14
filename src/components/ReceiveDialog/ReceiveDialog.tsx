import { useAtomValue } from 'jotai';
import React, { useEffect, useMemo, useState } from 'react';
import clsx from 'clsx';

import { truncateWalletAddress } from '@/helpers';
import { useDebounce } from '@/hooks';
import { Asset } from '@/types';
import { Button, CopyTextField, SlideTray } from '@/ui-kit';
import { AssetInput } from '@/components';

import { QRCodeContainer } from '../QRCodeContainer';
import { chainWalletAtom, networkLevelAtom, subscribedChainRegistryAtom } from '@/atoms';

interface ReceiveDialogProps {
  buttonSize?: 'default' | 'medium' | 'small' | 'xsmall';
  asset: Asset;
  chainId: string;
}

export const ReceiveDialog: React.FC<ReceiveDialogProps> = ({
  buttonSize = 'default',
  asset,
  chainId,
}) => {
  const chainRegistry = useAtomValue(subscribedChainRegistryAtom);
  const networkLevel = useAtomValue(networkLevelAtom);
  const walletState = useAtomValue(chainWalletAtom(chainId));
  const [amount, setAmount] = useState<number>(0);
  const [showPreferenceInput, setShowPreferenceInput] = useState(false);
  const [selectedAsset, setSelectedAsset] = useState<Asset>(asset);
  const debouncedAmount = useDebounce(amount);

  const getPrefix = () => {
    try {
      const chain = chainRegistry[networkLevel][chainId];
      console.log(`[ReceiveDialog] Chain information for chain ${chainId}:`, chain);
      const prefix = chain.bech32_prefix;
      console.log(`[ReceiveDialog] Bech32 prefix for chain ${chainId}:`, prefix);
      return prefix;
    } catch (error) {
      console.error('[ReceiveDialog] Error getting Bech32 prefix:', error);
      console.log(
        '[ReceiveDialog] Available chains in registry:',
        Object.keys(chainRegistry[networkLevel] || {}),
      );
      return 'unknown'; // Fallback prefix
    }
  };

  const walletDisplayAddress = useMemo(() => {
    const prefix = getPrefix();
    console.log('[ReceiveDialog] Using prefix:', prefix, 'for address:', walletState.address);
    return truncateWalletAddress(prefix, walletState.address);
  }, [walletState, chainId, networkLevel]);

  const qrData = useMemo<string>(
    () =>
      showPreferenceInput
        ? JSON.stringify({
            address: walletState.address,
            denom: selectedAsset.denom,
            amount: debouncedAmount || 0,
          })
        : walletState.address,
    [selectedAsset, debouncedAmount, showPreferenceInput],
  );

  // reset asset and amount when dialog closes
  useEffect(() => {
    if (!showPreferenceInput) {
      setAmount(0);
      setSelectedAsset(asset); // reset to prop
    }
  }, [showPreferenceInput]);

  return (
    <SlideTray
      triggerComponent={
        <Button size={buttonSize} variant="secondary" className="w-full">
          Receive
        </Button>
      }
      title="Copy Address"
      showBottomBorder
      reducedTopMargin
    >
      <div className="flex flex-col items-center">
        <div className={`${showPreferenceInput ? '' : 'mb-1'} transition-all duration-300`}>
          {!showPreferenceInput ? (
            <Button
              variant="link"
              size="small"
              onClick={() => setShowPreferenceInput(true)}
              className="text-xs"
            >
              Add unit/amount? (Aria Only)
            </Button>
          ) : (
            <Button
              variant="link"
              size="small"
              onClick={() => setShowPreferenceInput(false)}
              className="text-xs"
            >
              Return to default
            </Button>
          )}
        </div>

        {/* Animated AssetInput */}
        <div
          className={clsx(
            'overflow-hidden transition-all duration-300 ease-in-out w-full transform-gpu',
            showPreferenceInput
              ? 'max-h-32 mb-1.5 opacity-100 translate-y-0'
              : 'max-h-0 opacity-0 -translate-y-4',
          )}
        >
          <AssetInput
            placeholder="Enter the amount to receive"
            variant="receive"
            assetState={selectedAsset}
            amountState={amount}
            updateAsset={setSelectedAsset}
            updateAmount={setAmount}
            reducedHeight
            includeBottomMargin={false}
          />
        </div>

        <QRCodeContainer qrCodeValue={qrData} />

        {/* Animated Copy Field */}
        <div
          className={clsx(
            'overflow-hidden transition-all duration-300 ease-in-out flex justify-center',
            showPreferenceInput ? 'max-h-0 opacity-0' : 'max-h-20 opacity-100',
          )}
        >
          <CopyTextField
            variant="transparent"
            displayText={walletDisplayAddress}
            copyText={walletState.address}
            iconHeight={16}
          />
        </div>
      </div>
    </SlideTray>
  );
};
