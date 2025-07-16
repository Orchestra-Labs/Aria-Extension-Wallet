import React from 'react';
import { NavLink } from 'react-router-dom';

import { VerifySuccess } from '@/assets/icons';
import { ROUTES } from '@/constants';
import { truncateWalletAddress } from '@/helpers';
import { Button, CopyTextField } from '@/ui-kit';

interface WalletSuccessScreenProps {
  caption: string;
  txHash?: string;
  onClick?: () => void;
}

export const WalletSuccessScreen: React.FC<WalletSuccessScreenProps> = ({
  caption,
  txHash,
  onClick,
}) => {
  return (
    <div className="w-full h-full pt-3 flex flex-col px-16">
      <div className="px-10 pb-2">
        <VerifySuccess width="100%" className="text-blue" />
      </div>
      <h1 className="text-white text-h3 font-semibold">Congratulations!</h1>
      <p className="mt-2.5 text-neutral-1 text-base">{caption}</p>
      {txHash && (
        <div className="mt-2 flex items-center justify-center space-x-2">
          <p className="text-neutral-1 text-sm">Tx Hash:</p>
          <CopyTextField
            copyText={txHash}
            displayText={truncateWalletAddress('', txHash)}
            variant="transparent"
            iconHeight={16}
            includeMargin={false}
          />
        </div>
      )}
      {onClick ? (
        <Button className="mt-8" onClick={onClick}>
          Got it
        </Button>
      ) : (
        <Button className="mt-8" asChild>
          <NavLink to={ROUTES.AUTH.ROOT}>Got it</NavLink>
        </Button>
      )}
    </div>
  );
};
