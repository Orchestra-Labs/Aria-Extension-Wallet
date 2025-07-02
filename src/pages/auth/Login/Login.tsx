import React, { useState } from 'react';
import { useNavigate, NavLink } from 'react-router-dom';
import { EyeOpen, EyeClose } from '@/assets/icons';
import { InputStatus, ROUTES } from '@/constants';
import { Button, Input } from '@/ui-kit';
import { tryAuthorizeAccess } from '@/helpers';
import { useSetAtom } from 'jotai';
import { isLoggedInAtom } from '@/atoms';

export const Login: React.FC = () => {
  const navigate = useNavigate();

  const setIsLoggedIn = useSetAtom(isLoggedInAtom);

  const [password, setPassword] = useState('');
  const [passwordVisible, setPasswordVisible] = useState(false);
  const [passwordStatus, setPasswordStatus] = useState<InputStatus>(InputStatus.NEUTRAL);
  const [passwordMessage, setPasswordMessage] = useState<string>('');

  // Reset status on typing
  const handlePasswordChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const newPassword = e.target.value;
    setPassword(newPassword);

    // Only reset the error state if the user had an error before
    if (passwordStatus === InputStatus.ERROR) {
      setPasswordStatus(InputStatus.NEUTRAL);
      setPasswordMessage('');
    }
  };

  const handlePasswordPaste = (e: React.ClipboardEvent<HTMLInputElement>) => {
    e.preventDefault();
    const pastedText = e.clipboardData.getData('text');
    setPassword(pastedText.trim());

    // Only reset the error state if the user had an error before
    if (passwordStatus === InputStatus.ERROR) {
      setPasswordStatus(InputStatus.NEUTRAL);
      setPasswordMessage('');
    }
  };

  const handleUnlock = async () => {
    const authStatus = await tryAuthorizeAccess(password);

    if (authStatus === 'success') {
      setIsLoggedIn(true);
      navigate(ROUTES.APP.ROOT);
    } else if (authStatus === 'no_wallet') {
      setPasswordStatus(InputStatus.ERROR);
      setPasswordMessage('No wallet found.  Make or import a new one.');
    } else {
      setPasswordStatus(InputStatus.ERROR);
      setPasswordMessage('Incorrect password.');
    }
  };

  const handleKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key === 'Enter') {
      e.preventDefault();
      handleUnlock();
    }
  };

  return (
    <div className="mt-6 h-full">
      <div className="w-full h-full pt-7 px-8 flex flex-col">
        <h1 className="text-white text-h2 font-bold">Welcome back!</h1>
        <p className="mt-2.5 text-neutral-1 text-base">Sign in to securely access your wallet</p>
        <form className="mt-9 flex-1">
          <Input
            variant="primary"
            showMessageText={true}
            status={passwordStatus}
            messageText={passwordMessage}
            className="w-full"
            wrapperClass="mb-4"
            label="Password"
            placeholder="Enter password"
            type={passwordVisible ? 'text' : 'password'}
            value={password}
            onChange={handlePasswordChange}
            onKeyDown={e => handleKeyDown(e)}
            onPaste={handlePasswordPaste}
            icon={passwordVisible ? <EyeOpen width={20} /> : <EyeClose width={20} />}
            iconRole="button"
            onIconClick={() => setPasswordVisible(!passwordVisible)}
          />
        </form>
        <div className="flex flex-col gap-y-4 w-full justify-between gap-x-5 pb-2">
          <Button className="w-full text-black" onClick={handleUnlock}>
            Unlock
          </Button>
          <div>
            <span className="text-base text-white mr-1">Don't have a wallet yet?</span>
            <Button variant="link" size="xsmall" className="text-base" asChild>
              <NavLink to={ROUTES.AUTH.NEW_WALLET.ROOT}>Create wallet</NavLink>
            </Button>
          </div>
        </div>
      </div>
    </div>
  );
};
