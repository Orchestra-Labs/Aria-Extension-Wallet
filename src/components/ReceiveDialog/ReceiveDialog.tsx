import clsx from 'clsx';
import { useAtomValue } from 'jotai';
import React, { useEffect, useMemo, useState } from 'react';

import { walletStateAtom } from '@/atoms';
import { AssetInput } from '@/components';
import { WALLET_PREFIX } from '@/constants';
import { truncateWalletAddress } from '@/helpers';
import { useDebounce } from '@/hooks';
import { Asset } from '@/types';
import { Button, CopyTextField, SlideTray } from '@/ui-kit';

import { QRCodeContainer } from '../QRCodeContainer';

interface ReceiveDialogProps {
  buttonSize?: 'default' | 'medium' | 'small' | 'xsmall';
  asset: Asset;
}

export const ReceiveDialog: React.FC<ReceiveDialogProps> = ({ buttonSize = 'default', asset }) => {
  const walletState = useAtomValue(walletStateAtom);
  const [amount, setAmount] = useState<number>(0);
  const [showPreferenceInput, setShowPreferenceInput] = useState(false);
  const [selectedAsset, setSelectedAsset] = useState<Asset>(asset);
  const debouncedAmount = useDebounce(amount);

  const walletDisplayAddress = useMemo(
    () => truncateWalletAddress(WALLET_PREFIX, walletState.address),
    [walletState.address],
  );

  const qrData = useMemo<string>(
    () =>
      showPreferenceInput
        ? JSON.stringify({
            address: walletState.address,
            denom: selectedAsset.denom,
            amount: debouncedAmount || 0,
          })
        : walletState.address,
    [selectedAsset.denom, debouncedAmount, showPreferenceInput, walletState.address],
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
              Add data? (Aria Only)
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
