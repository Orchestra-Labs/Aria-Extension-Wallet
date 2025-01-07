import { useState } from 'react';
import { NavLink } from 'react-router-dom';
import { RecoveryPhraseGrid, WalletSuccessScreen } from '@/components';
import { ROUTES } from '@/constants';
import { Button, Stepper } from '@/ui-kit';
import StakingGuide from '@/components/StakingGuide/StakingGuide';

const STEPS_LABELS = ['Staking', 'Recovery phrase', 'Verify phrase'];

export const CreateWallet = () => {
  const [activeScreen, setActiveScreen] = useState(0);

  // Proceed to next step
  const nextStep = () => setActiveScreen(current => (current < 3 ? current + 1 : current));
  const prevStep = () => setActiveScreen(current => (current > 0 ? current - 1 : current));

  return (
    <div className="mt-6 h-full">
      {activeScreen < STEPS_LABELS.length ? (
        <Stepper
          active={activeScreen}
          labels={STEPS_LABELS}
          progressBarClass="px-9"
          containerClass="h-full"
        >
          {/* Step 1: Create password */}
          <div className="w-full h-full pt-7 px-8 flex flex-col">
            <h1 className="text-white text-h3 font-semibold">{STEPS_LABELS[0]}</h1>
            <StakingGuide />

            <div className="flex w-full justify-between gap-x-5 pb-2">
              <Button variant="secondary" className="w-full" asChild>
                <NavLink to={ROUTES.AUTH.NEW_WALLET.ROOT}>Back</NavLink>
              </Button>
              <Button className="w-full" onClick={nextStep} disabled={}>
                Next
              </Button>
            </div>
          </div>

          {/* Step 2: Display recovery phrase */}
          <div className="w-full h-full pt-7 flex flex-col">
            <h1 className="text-white text-h3 font-semibold">{STEPS_LABELS[1]}</h1>
            <p className="mt-2.5 text-base text-neutral-1">Backup your secret recovery phrase</p>
            <RecoveryPhraseGrid />
            <div className="flex w-full px-10 justify-between gap-x-5 pb-2 mt-4">
              <Button variant="secondary" className="w-full" onClick={prevStep}>
                Back
              </Button>
              <Button className="w-full" onClick={nextStep}>
                Next
              </Button>
            </div>
          </div>

          {/* Step 3: Verify recovery phrase */}
          <div className="w-full h-full pt-7 flex flex-col">
            <h1 className="text-white text-h3 font-semibold">{STEPS_LABELS[2]}</h1>
            <p className="mt-2.5 text-neutral-1 text-base">Confirm your secret recovery phrase</p>
            <RecoveryPhraseGrid isVerifyMode={true} hiddenIndices={} />
            <div className="flex w-full px-10 justify-between gap-x-5 pb-2">
              <Button variant="secondary" className="w-full" onClick={prevStep}>
                Back
              </Button>
              <Button className="w-full" onClick={} disabled={}>
                Next
              </Button>
            </div>
          </div>
        </Stepper>
      ) : (
        // Wallet success screen outside the Stepper
        <WalletSuccessScreen caption="Your wallet was created successfully" onClick={() => {}} />
      )}
    </div>
  );
};
