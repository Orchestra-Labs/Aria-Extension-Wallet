import Bowser from 'bowser';
import {
  MediaPermissionsError,
  MediaPermissionsErrorType,
  requestMediaPermissions,
} from 'mic-check';
import { useEffect, useRef } from 'react';
import { useState } from 'react';

import { ROUTES } from '@/constants';
import { getExtensionUrl, openExtensionWindow } from '@/helpers';
import { Accordion, AccordionContent, AccordionItem, AccordionTrigger, Button } from '@/ui-kit';

const browser = Bowser.getParser(window.navigator.userAgent);

enum View {
  explanation = 'explanation',
  systemDenied = 'systemDenied',
  userDenied = 'userDenied',
  trackError = 'trackError',
}

export const MediaOnboardingScreen: React.FC = () => {
  const [view, setView] = useState<View | null>(null);

  const [audioAllowed, setAudioAllowed] = useState<boolean>(false);
  const [videoAllowed, setVideoAllowed] = useState<boolean>(false);

  const [errorDetails, setErrorDetails] = useState<MediaPermissionsError | undefined>();

  // Create wrapper refs to access values even during setTimeout
  // https://github.com/facebook/react/issues/14010
  const viewRef = useRef(view);
  viewRef.current = view;
  const audioAllowedRef = useRef(audioAllowed);
  audioAllowedRef.current = audioAllowed;
  const videoAllowedRef = useRef(videoAllowed);
  videoAllowedRef.current = videoAllowed;

  useEffect(() => {
    checkMediaPermissions();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(() => {
    if (audioAllowed || videoAllowed) {
      const url = getExtensionUrl(ROUTES.APP.SEND);
      openExtensionWindow(url.toString());
      window.close();
    }
  }, [audioAllowed, videoAllowed]);

  const checkForExplanationDialog = () => {
    if ((!audioAllowedRef.current || !videoAllowedRef.current) && viewRef.current === null)
      setView(View.explanation);
  };

  const checkMediaPermissions = () => {
    // TODO: listen to if there is a change on the audio/video piece?

    requestMediaPermissions()
      .then(() => {
        setAudioAllowed(true);
        setVideoAllowed(true);
        setView(null);
      })
      .catch((error: MediaPermissionsError) => {
        console.log('MediaOnboardingDialog: ', error);
        if (error.type === MediaPermissionsErrorType.SystemPermissionDenied) {
          // user denied permission
          setView(View.systemDenied);
        } else if (error.type === MediaPermissionsErrorType.UserPermissionDenied) {
          // browser doesn't have access to devices
          setView(View.userDenied);
        } else if (error.type === MediaPermissionsErrorType.CouldNotStartVideoSource) {
          // most likely when other apps or tabs are using the cam/mic (mostly windows)
          setView(View.trackError);
        }
        setErrorDetails(error);
      });

    setTimeout(() => {
      checkForExplanationDialog();
    }, 500);
  };

  const _renderTryAgain = (text?: string) => {
    return (
      <div style={{ width: '100%', marginTop: 20 }}>
        <Button
          onClick={() => {
            if (browser.getBrowserName() === 'Safari') {
              // If on Safari, rechecking permissions results in glitches so just refresh the page
              window.location.reload();
            } else {
              checkMediaPermissions();
            }
          }}
          color="primary"
          style={{ float: 'right' }}
        >
          {text ? text : 'Retry'}
        </Button>
      </div>
    );
  };

  const _renderErrorMessage = () => {
    if (!errorDetails) return null;
    return (
      <div style={{ marginTop: 10 }}>
        <Accordion type="single" collapsible>
          <AccordionItem value="item-1">
            <AccordionTrigger>
              <h6 className="text-lg" style={{ color: 'red' }}>
                Error Details
              </h6>
            </AccordionTrigger>
            <AccordionContent>
              <h4 className="scroll-m-20 text-base font-semibold tracking-tight">
                {errorDetails.name}: {errorDetails.message}
              </h4>
            </AccordionContent>
          </AccordionItem>
        </Accordion>
      </div>
    );
  };

  const _renderExplanationView = () => {
    return (
      <div>
        <h5 className="scroll-m-20  pb-2 text-lg font-semibold tracking-tight first:mt-0">
          Allow App to use your camera and microphone
        </h5>
        <h4 className="scroll-m-20 text-xl font-semibold tracking-tight">
          App needs access to your camera and microphone
        </h4>
      </div>
    );
  };

  const _renderUserDeniedView = () => {
    return (
      <div>
        <h5 className="scroll-m-20  pb-2 text-lg font-semibold tracking-tight first:mt-0">
          Camera and microphone are blocked
        </h5>
        <span>
          App requires access to your camera and microphone.{' '}
          {browser.getBrowserName() !== 'Safari' && (
            <span>
              Click the camera blocked icon{' '}
              <img
                alt="icon"
                src={
                  'https://www.gstatic.com/meet/ic_blocked_camera_dark_f401bc8ec538ede48315b75286c1511b.svg'
                }
                style={{ display: 'inline' }}
              />{' '}
              in your browser&apos;s address bar. If you don&apos;t see the icon, please refresh the
              page.
            </span>
          )}
        </span>
        {_renderErrorMessage()}
        {_renderTryAgain()}
      </div>
    );
  };

  const _renderSystemDeniedView = () => {
    const settingsDataByOS: Record<string, { name: string; link: string }> = {
      macOS: {
        name: 'System Preferences',
        link: 'x-apple.systempreferences:com.apple.preference.security?Privacy_Camera',
      },
    };

    return (
      <div>
        <h5 className="scroll-m-20  pb-2 text-lg font-semibold tracking-tight first:mt-0">
          Can&apos;t use your camera or microphone
        </h5>
        <span>
          Your browser might not have access to your camera or microphone. To fix this problem, open{' '}
          {settingsDataByOS[browser.getOSName()] ? (
            <a
              onClick={() => {
                window.open(settingsDataByOS[browser.getOSName()].link, '_blank');
              }}
            >
              {settingsDataByOS[browser.getOSName()].name}
            </a>
          ) : (
            'Settings'
          )}
          .
        </span>
        {_renderErrorMessage()}
        {_renderTryAgain()}
      </div>
    );
  };

  const _renderTrackErrorView = () => {
    return (
      <div>
        <h5 className="scroll-m-20  pb-2 text-lg font-semibold tracking-tight first:mt-0">
          Can&apos;t start your camera or microphone
        </h5>
        <span>
          Another application (Zoom, Webex) or browser tab (Google Meet, Messenger Video) might
          already be using your webcam. Please turn off other cameras before proceeding.
        </span>
        {_renderErrorMessage()}
        {_renderTryAgain()}
      </div>
    );
  };

  const _renderContent = () => {
    switch (view) {
      case View.explanation:
        return _renderExplanationView();
      case View.systemDenied:
        return _renderSystemDeniedView();
      case View.userDenied:
        return _renderUserDeniedView();
      case View.trackError:
        return _renderTrackErrorView();
    }
  };

  return (
    <div className="flex flex-col justify-center items-center flex-grow">{_renderContent()}</div>
  );
};
