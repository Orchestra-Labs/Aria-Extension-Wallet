import React from 'react';

import { VerifyFailure, VerifySuccess } from '@/assets/icons';
import { cn, truncateWalletAddress } from '@/helpers';
import { CopyTextField } from '@/ui-kit';

interface TransactionResultsTileProps {
  isSuccess: boolean;
  message?: string;
  txHash?: string;
  size?: string;
}

export const TransactionResultsTile: React.FC<TransactionResultsTileProps> = ({
  isSuccess,
  message,
  txHash,
  size = 'sm',
}) => {
  const displayTxHash = truncateWalletAddress('', txHash as string);

  const headerTextSize = size === 'sm' ? 'text-sm' : 'text-lg';
  const subHeaderTextSize = size === 'sm' ? 'text-xs' : 'text-sm';
  const iconSize = size === 'sm' ? '3.5rem' : '6rem';
  const padding = size === 'sm' ? 'px-4' : '';

  return (
    <div className={cn(`flex items-center justify-center ${padding} space-x-4`)}>
      {isSuccess ? (
        <VerifySuccess
          style={{ width: iconSize, height: iconSize }}
          className="text-blue animate-scale-up"
        />
      ) : (
        <VerifyFailure
          style={{ width: iconSize, height: iconSize }}
          className="text-error animate-scale-up"
        />
      )}
      <div className="flex flex-col items-center justify-center space-x-2">
        <div className={cn(`text-white font-semibold ${headerTextSize}`)}>
          {isSuccess ? 'Success!' : 'Failure!'}
        </div>
        <div className="flex items-center mt-2 space-x-2">
          <span className={cn(`text-neutral-1 ${subHeaderTextSize}`)}>
            {message ? message : 'Tx Hash:'}
          </span>
          {isSuccess && <CopyTextField displayText={displayTxHash} includeMargin={false} />}
        </div>
      </div>
    </div>
  );
};
