import { useSetAtom } from 'jotai';
import React, { useEffect } from 'react';
import { NavLink } from 'react-router-dom';

import { LogoWhite } from '@/assets/icons/LogoWhite/LogoWhite';
import { mnemonic12State, mnemonic24State, mnemonicVerifiedState, use24WordsState } from '@/atoms';
import { ROUTES } from '@/constants';
import { Button } from '@/ui-kit';

export const NewWallet: React.FC = () => {
  const setMnemonic12 = useSetAtom(mnemonic12State);
  const setMnemonic24 = useSetAtom(mnemonic24State);
  const setUse24Words = useSetAtom(use24WordsState);
  const setMnemonicVerified = useSetAtom(mnemonicVerifiedState);

  const clearState = () => {
    setMnemonic12(new Array(12).fill(''));
    setMnemonic24(new Array(24).fill(''));
    setUse24Words(false);
    setMnemonicVerified(false);
  };

  useEffect(() => {
    clearState();
  }, []);

  return (
    <div className="max-w-[300px] mx-auto mt-7 flex items-center flex-col text-white">
      <h1 className=" text-h2 font-bold text-center">Welcome to Symphony wallet</h1>
      <div className="py-1.5">
        <LogoWhite className="w-[156px]" />
      </div>
      <div className="w-full flex flex-col items-center mb-2">
        <Button className="w-full" asChild>
          <NavLink to={ROUTES.AUTH.NEW_WALLET.CREATE}>Create wallet</NavLink>
        </Button>
        <span className="mt-2.5 mb-3.5 text-sm">or</span>
        <Button className="w-full" variant="secondary" asChild>
          <NavLink to={ROUTES.AUTH.NEW_WALLET.IMPORT}>Import existing</NavLink>
        </Button>
        <div className="mt-4">
          <span className="text-base text-white mr-1">Already have a wallet?</span>
          <Button variant="link" size="xsmall" className="text-base" asChild>
            <NavLink to={ROUTES.AUTH.ROOT}>Sign In</NavLink>
          </Button>
        </div>
      </div>
    </div>
  );
};
