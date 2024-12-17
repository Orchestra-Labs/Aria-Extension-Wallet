import React, { useState } from 'react';
import { useAtomValue } from 'jotai';
import { walletStateAtom } from '@/atoms';
import { Button, CopyTextField, SlideTray } from '@/ui-kit';
import { truncateWalletAddress } from '@/helpers';
import { WALLET_PREFIX } from '@/constants';
import { QRCodeContainer } from '../QRCodeContainer';
import { Asset } from '@/types';

interface ReceiveDialogProps {
  buttonSize?: 'default' | 'medium' | 'small' | 'xsmall';
  asset: Asset;
}

export const ReceiveDialog: React.FC<ReceiveDialogProps> = ({ buttonSize = 'default', asset }) => {
  const walletState = useAtomValue(walletStateAtom);

  const [includeCoinPreference, setIncludeCoinPreference] = useState(false);

  const walletAddress = walletState.address;
  const walletDisplayAddress = truncateWalletAddress(WALLET_PREFIX, walletAddress);

  const qrDataWithAddress = JSON.stringify({
    address: walletAddress,
    denomPreference: asset.denom,
  });
  const qrData = includeCoinPreference ? qrDataWithAddress : walletAddress;

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
        <div className="mb-2">
          <span>Aria Wallet Exclusive:</span>
          <Button
            variant={!includeCoinPreference ? 'unselected' : 'selectedEnabled'}
            size="small"
            onClick={() => setIncludeCoinPreference(!includeCoinPreference)}
            className="ml-1 px-2 rounded-md text-xs"
          >
            {`${includeCoinPreference ? 'Receiving' : 'Receive'} ${asset.symbol}${includeCoinPreference ? '' : '?'}`}
          </Button>
        </div>

        <QRCodeContainer qrCodeValue={qrData} />

        {/* Wallet Address */}
        <CopyTextField
          variant="transparent"
          displayText={walletDisplayAddress}
          copyText={walletAddress}
          iconHeight={16}
        />
      </div>
    </SlideTray>
  );
};
