import { useAtomValue } from 'jotai';
import React, { ChangeEvent, useMemo, useState } from 'react';

import { walletStateAtom } from '@/atoms';
import { WALLET_PREFIX } from '@/constants';
import { truncateWalletAddress } from '@/helpers';
import { useDebounce } from '@/hooks';
import { Asset } from '@/types';
import { Button, CopyTextField, Input, SlideTray } from '@/ui-kit';

import { QRCodeContainer } from '../QRCodeContainer';

interface ReceiveDialogProps {
  buttonSize?: 'default' | 'medium' | 'small' | 'xsmall';
  asset: Asset;
}

export const ReceiveDialog: React.FC<ReceiveDialogProps> = ({ buttonSize = 'default', asset }) => {
  const walletState = useAtomValue(walletStateAtom);
  const [amount, setAmount] = useState<number>();
  const [includeCoinPreference, setIncludeCoinPreference] = useState(false);
  const debouncedAmount = useDebounce(amount);

  const handleChangeAmount = (e: ChangeEvent<HTMLInputElement>) =>
    setAmount(Number(e.target.value) || undefined);

  const walletDisplayAddress = useMemo(
    () => truncateWalletAddress(WALLET_PREFIX, walletState.address),
    [walletState.address],
  );

  const qrData = useMemo<string>(
    () =>
      includeCoinPreference
        ? JSON.stringify({
            address: walletState.address,
            denomPreference: asset.denom,
            amount: debouncedAmount || 0,
          })
        : walletState.address,
    [asset.denom, debouncedAmount, includeCoinPreference, walletState.address],
  );

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
        <div className="mb-3">
          <Button
            variant={!includeCoinPreference ? 'unselectedEnabled' : 'selectedEnabled'}
            size="small"
            onClick={() => setIncludeCoinPreference(!includeCoinPreference)}
            className="ml-1 px-2 rounded-md text-xs"
          >
            {includeCoinPreference ? 'Remove Data' : 'Include data (Aria Only)'}
          </Button>
        </div>

        {includeCoinPreference && (
          <div className="flex justify-center mb-3">
            <Input
              variant="primary"
              type="number"
              label="Amount:"
              labelPosition="left"
              placeholder="Enter the amount to receive"
              reducedHeight
              defaultValue={0}
              onChange={handleChangeAmount}
            />
          </div>
        )}

        <QRCodeContainer qrCodeValue={qrData} />

        <CopyTextField
          variant="transparent"
          displayText={walletDisplayAddress}
          copyText={walletState.address}
          iconHeight={16}
        />
      </div>
    </SlideTray>
  );
};
