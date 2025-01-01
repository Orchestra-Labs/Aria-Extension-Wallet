import React from 'react';
import { RecoveryPhraseGrid } from '@/components';
import { NavLink, useNavigate } from 'react-router-dom';
import { ROUTES } from '@/constants';
import { X } from '@/assets/icons';
import { Separator } from '@/ui-kit';
import { getSessionToken } from '@/helpers';
import { useSetAtom } from 'jotai';
import { mnemonic12State, mnemonic24State, use24WordsState } from '@/atoms';

interface ViewPassphraseProps {}

export const ViewPassphrase: React.FC<ViewPassphraseProps> = () => {
  const navigate = useNavigate();

  const setMnemonic12 = useSetAtom(mnemonic12State);
  const setMnemonic24 = useSetAtom(mnemonic24State);
  const setUse24Words = useSetAtom(use24WordsState);

  const session = getSessionToken();
  const passphrase = session?.mnemonic.split(' ');

  const passphraseLength = passphrase?.length;
  const passphraseIs24Words = passphraseLength === 24;

  if (passphrase) {
    if (passphraseIs24Words) {
      setUse24Words(true);
      setMnemonic24(passphrase);
    } else {
      setUse24Words(false);
      setMnemonic12(passphrase);
    }
  } else {
    navigate(ROUTES.APP.ROOT);
  }

  // TODO: separate header to new component for this, settings screen, other options screens, and send page
  return (
    <div className="mt-6 h-full">
      <div className="flex justify-between items-center w-full p-5">
        <NavLink
          to={ROUTES.APP.ROOT}
          className="flex items-center justify-center max-w-5 max-h-5 p-0.5"
        >
          <X className="w-full h-full text-white" />
        </NavLink>
        <div>
          <h1 className="text-h5 text-white font-bold">Recovery phrase</h1>
        </div>
        <div className="max-w-5 w-full max-h-5" />
      </div>

      <Separator />

      <div className="w-full h-full pt-7 flex flex-col">
        <p className="mt-2.5 text-base text-neutral-1">Remember to keep your phrase hidden!</p>
        <RecoveryPhraseGrid singleWordCount />
      </div>
    </div>
  );
};
