import { useEffect, useState } from 'react';
import { NavLink } from 'react-router-dom';
import { CreatePasswordForm, RecoveryPhraseGrid, WalletSuccessScreen } from '@/components';
import { ROUTES } from '@/constants';
import { Button, Stepper } from '@/ui-kit';
import { createWallet, generateToken } from '@/helpers/wallet';
import { useAtom, useSetAtom } from 'jotai';
import {
  confirmPasswordAtom,
  mnemonic12State,
  mnemonic24State,
  mnemonicVerifiedState,
  passwordAtom,
  passwordsVerifiedAtom,
  use24WordsState,
} from '@/atoms';

const STEPS_LABELS = ['Enter Passphrase', 'Create password'];

export const ImportWallet = () => {
  const [mnemonic12, setMnemonic12] = useAtom(mnemonic12State);
  const [mnemonic24, setMnemonic24] = useAtom(mnemonic24State);
  const [use24Words, setUse24Words] = useAtom(use24WordsState);
  const [mnemonicVerified, setMnemonicVerified] = useAtom(mnemonicVerifiedState);

  const [password, setPassword] = useAtom(passwordAtom);
  const setConfirmPassword = useSetAtom(confirmPasswordAtom);
  const [passwordsVerified, setPasswordsVerified] = useAtom(passwordsVerifiedAtom);

  const [activeScreen, setActiveScreen] = useState(0);
  const [fullyVerified, setFullyVerified] = useState(false);

  // Proceed to next step
  const nextStep = () => setActiveScreen(current => (current < 2 ? current + 1 : current));
  const prevStep = () => setActiveScreen(current => (current > 0 ? current - 1 : current));

  useEffect(() => {
    clearState();
  }, []);

  useEffect(() => {
    // Ensure both passwords and mnemonic are fully validated before enabling the next button
    setFullyVerified(passwordsVerified && mnemonicVerified);
  }, [passwordsVerified, mnemonicVerified]);

  const clearState = () => {
    setMnemonic12(new Array(12).fill(''));
    setMnemonic24(new Array(24).fill(''));
    setUse24Words(false);
    setMnemonicVerified(false);

    setPassword('');
    setConfirmPassword('');
    setPasswordsVerified(false);
  };

  const getCurrentMnemonic = () => (use24Words ? mnemonic24 : mnemonic12);
  const getStringMnemonic = () => getCurrentMnemonic().join(' ');

  // Check everything is completed properly and pass to confirmation screen
  const handleCreateWallet = async () => {
    try {
      // Generate wallet from the mnemonic and create the token
      const { walletAddress } = await createWallet(getStringMnemonic(), password);
      generateToken(walletAddress);

      // Clear state and navigate to confirmation page after wallet creation
      clearState();
      nextStep();
    } catch (error) {
      console.error('Error creating wallet:', error);
    }
  };

  return (
    <div className="mt-6 h-full">
      {activeScreen < STEPS_LABELS.length ? (
        <Stepper
          active={activeScreen}
          labels={STEPS_LABELS}
          progressBarClass="px-9"
          containerClass="h-full"
        >
          {/* Step 1: Display recovery phrase */}
          <div className="w-full h-full pt-7 flex flex-col">
            <h1 className="text-white text-h3 font-semibold">{STEPS_LABELS[0]}</h1>
            <p className="mt-2.5 text-base text-neutral-1">Backup your secret recovery phrase</p>
            <RecoveryPhraseGrid isEditable />
            <div className="flex w-full px-10 justify-between gap-x-5 pb-2 mt-4">
              <Button variant="secondary" className="w-full" asChild>
                <NavLink to={ROUTES.AUTH.NEW_WALLET.ROOT}>Back</NavLink>
              </Button>
              <Button className="w-full" onClick={nextStep} disabled={!mnemonicVerified}>
                Next
              </Button>
            </div>
          </div>

          {/* Step 2: Create password */}
          <div className="w-full h-full pt-7 px-8 flex flex-col">
            <h1 className="text-white text-h3 font-semibold">{STEPS_LABELS[1]}</h1>
            <CreatePasswordForm />

            <div className="flex w-full justify-between gap-x-5 pb-2">
              <Button variant="secondary" className="w-full" onClick={prevStep}>
                Back
              </Button>
              <Button className="w-full" onClick={handleCreateWallet} disabled={!fullyVerified}>
                Next
              </Button>
            </div>
          </div>
        </Stepper>
      ) : (
        // Wallet success screen outside the Stepper
        <WalletSuccessScreen caption="Your wallet was imported successfully" />
      )}
    </div>
  );
};
