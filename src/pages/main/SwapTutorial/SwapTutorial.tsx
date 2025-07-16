import { useAtom, useAtomValue } from 'jotai';
import { useState } from 'react';
import { useNavigate } from 'react-router-dom';

import selectPageImage from '@/assets/images/receive_asset_tile.png';
import sendPageImage from '@/assets/images/send_page.png';
import sendImage from '@/assets/images/swap_enabled.png';
import { isInitialDataLoadAtom } from '@/atoms';
import { userAccountAtom } from '@/atoms/accountAtom';
import { Header, TutorialDisplay } from '@/components';
import { ROUTES } from '@/constants';
import { saveAccountByID } from '@/helpers';
import { Button, Separator, Stepper } from '@/ui-kit';

const PAGE_TITLE = 'Swap Tutorial';

const STEPS = [
  {
    label: 'Click Icon',
    imageSrc: sendPageImage,
    altText: 'Click the receive icon',
    pointerPosition: { top: '9.85rem', left: '9.65rem' },
    ripplePosition: { top: '9.5rem', left: '9.8rem' },
    description: 'Click the receive icon to open the options.',
  },
  {
    label: 'Select Asset',
    imageSrc: selectPageImage,
    altText: 'Select asset to receive',
    pointerPosition: { top: '11rem', left: '50%' },
    ripplePosition: { top: '10.65rem', left: '51%' },
    description: 'Select the asset you are swapping into.',
  },
  {
    label: 'Send Transaction',
    imageSrc: sendImage,
    altText: 'Send the transaction',
    pointerPosition: { top: '15.45rem', left: '46%' },
    ripplePosition: { top: '15.1rem', left: '47%' },
    description: 'Enter amount press send.',
  },
];

export const SwapTutorial = () => {
  const navigate = useNavigate();

  const [activeScreen, setActiveScreen] = useState(0);

  const isInitialDataLoad = useAtomValue(isInitialDataLoadAtom);
  const [userAccount, setUserAccount] = useAtom(userAccountAtom);

  const nextStep = () => setActiveScreen(current => Math.min(current + 1, STEPS.length - 1));
  const prevStep = () => setActiveScreen(current => Math.max(current - 1, 0));

  const STEP_LABELS = STEPS.map(step => step.label);
  const isLastStep = activeScreen === STEPS.length - 1;

  const confirmHasViewedTutorial = () => {
    if (userAccount) {
      const updatedUserAccount = {
        ...userAccount,
        settings: {
          ...userAccount.settings,
          hasViewedTutorial: true,
        },
      };

      console.log('updated user account', updatedUserAccount);

      // Update state and save to local storage
      setUserAccount(updatedUserAccount);
      saveAccountByID(updatedUserAccount);
    } else {
      console.warn('userAccount is undefined');
    }
  };

  const closeAndReturn = () => {
    confirmHasViewedTutorial();
    navigate(ROUTES.APP.ROOT);
  };

  return (
    <div className="h-screen flex flex-col overflow-hidden bg-black text-white">
      <Header title={PAGE_TITLE} onClose={closeAndReturn} />

      <div className="mt-4 h-full flex flex-grow flex-col">
        <Stepper
          active={activeScreen}
          labels={STEP_LABELS}
          progressBarClass="px-9"
          containerClass="flex flex-col flex-grow"
        >
          {STEPS.map((step, index) => (
            <div key={index}>
              <div className="w-full px-8 flex flex-col flex-grow">
                <h1 className="text-white text-h3 font-semibold">{step.label}</h1>
                {step.description && <p className="text-base text-neutral-1">{step.description}</p>}

                <TutorialDisplay
                  imageSrc={step.imageSrc}
                  altText={step.altText}
                  pointerPosition={step.pointerPosition}
                  ripplePosition={step.ripplePosition}
                />
              </div>
            </div>
          ))}
        </Stepper>

        {/* Separator */}
        <div className="mt-2 flex w-full justify-between gap-x-5 pb-4">
          <Separator variant="bottom" />

          <div className="flex justify-center w-full">
            <div className="flex justify-center items-center gap-x-5 w-[85%]">
              {/* Buttons */}
              <Button
                variant="secondary"
                className="w-full"
                onClick={prevStep}
                disabled={activeScreen === 0}
              >
                Back
              </Button>
              <Button
                className="w-full"
                onClick={isLastStep ? closeAndReturn : nextStep}
                disabled={isLastStep && isInitialDataLoad}
              >
                {isLastStep ? 'Done' : 'Next'}
              </Button>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};
