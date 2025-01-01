import React from 'react';
import { Header, RecoveryPhraseGrid } from '@/components';
import { useNavigate } from 'react-router-dom';
import { ROUTES } from '@/constants';
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

  return (
    <div className="h-full">
      <Header title="Recovery phrase" />

      <div className="w-full h-full pt-7 flex flex-col">
        <p className="mt-2.5 text-base text-neutral-1">Remember to keep your phrase hidden!</p>
        <RecoveryPhraseGrid singleWordCount />
      </div>
    </div>
  );
};
