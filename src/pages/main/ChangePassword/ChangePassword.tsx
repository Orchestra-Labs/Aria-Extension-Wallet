import React, { useEffect, useState } from 'react';
import { CreatePasswordForm, Header, TransactionResultsTile } from '@/components';
import { useNavigate } from 'react-router-dom';
import { InputStatus, ROUTES, VALID_PASSWORD_LENGTH } from '@/constants';
import { getSessionToken, updateAccountPassword } from '@/helpers';
import { useAtomValue } from 'jotai';
import { passwordAtom, passwordsVerifiedAtom } from '@/atoms';
import { Button, Input, Separator } from '@/ui-kit';
import { EyeClose, EyeOpen } from '@/assets/icons';

interface ViewPassphraseProps {}

export const ChangePassword: React.FC<ViewPassphraseProps> = () => {
  const navigate = useNavigate();

  const [oldPassword, setOldPassword] = useState<string>('');
  const passwordsVerified = useAtomValue(passwordsVerifiedAtom);
  const newPassword = useAtomValue(passwordAtom);

  const [oldPasswordVisible, setOldPasswordVisible] = useState(false);
  const [oldPasswordStatus, setOldPasswordStatus] = useState<InputStatus>(InputStatus.NEUTRAL);
  const [allowValidatePassword, setAllowValidatePassword] = useState(false);
  const [oldPasswordVerified, setOldPasswordVerified] = useState(false);
  const [error, setError] = useState<string>('');

  const validateOldPassword = () => {
    if (oldPassword === '') {
      setOldPasswordStatus(InputStatus.NEUTRAL);
      return;
    }
    const isPasswordValid = oldPassword.length >= VALID_PASSWORD_LENGTH;
    setOldPasswordStatus(isPasswordValid ? InputStatus.SUCCESS : InputStatus.ERROR);
  };

  const checkOldPasswordStatus = () => {
    if (allowValidatePassword || oldPassword.length === 0) {
      validateOldPassword();
    }
  };

  useEffect(() => {
    checkOldPasswordStatus();
  }, [oldPassword]);

  useEffect(() => {
    const passwordVerified = oldPasswordStatus === InputStatus.SUCCESS;

    setOldPasswordVerified(passwordVerified);
  }, [oldPasswordStatus]);

  const handlePasswordChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const oldPasswordValue = e.target.value;
    setOldPassword(oldPasswordValue);

    // Start validating after 8 characters, paste, or blur
    if (oldPasswordValue.length >= VALID_PASSWORD_LENGTH && !allowValidatePassword) {
      setAllowValidatePassword(true);
    }

    // Reset validation when empty
    if (oldPasswordValue === '') {
      setAllowValidatePassword(false);
      setOldPasswordStatus(InputStatus.NEUTRAL);
    }

    if (allowValidatePassword) {
      validateOldPassword();
    }
  };

  const handlePasswordBlur = () => {
    if (oldPassword.length > 0) {
      setAllowValidatePassword(true);
    }
    validateOldPassword();
  };

  const handlePasswordPaste = (e: React.ClipboardEvent<HTMLInputElement>) => {
    e.preventDefault();
    const pastedText = e.clipboardData.getData('text');
    setOldPassword(pastedText.trim());

    // Start validating immediately after paste
    if (pastedText.length > 0) {
      setAllowValidatePassword(true);
    }
    validateOldPassword();
  };

  const handleChangePassword = () => {
    try {
      const session = getSessionToken();
      const accountID = session?.accountID;
      if (accountID) {
        updateAccountPassword({ accountID, newPassword, oldPassword });
        navigate(ROUTES.APP.ROOT);
      } else {
        console.error('Error changing password:', error);
        handleChangePasswordError('No account ID found. Please try again.');
      }
    } catch (error) {
      console.error('Error changing password:', error);
      handleChangePasswordError('An error occurred while changing the password. Please try again.');
    }
  };

  const handleChangePasswordError = (errorMessage: string) => {
    setError(errorMessage);

    setTimeout(() => {
      setError('');
    }, 3000);
  };

  return (
    <div className="h-screen flex flex-col overflow-hidden bg-black text-white">
      <Header title="Change Password" />

      <div className="flex flex-grow flex-col px-4 pt-4">
        <Input
          variant="primary"
          showMessageText={true}
          status={oldPasswordStatus}
          messageText={
            oldPasswordStatus === InputStatus.ERROR ? 'Password must be at least 8 characters' : ''
          }
          label="Old password (8 characters min)"
          placeholder="Enter password"
          type={oldPasswordVisible ? 'text' : 'password'}
          value={oldPassword}
          onChange={handlePasswordChange}
          onBlur={handlePasswordBlur}
          onPaste={handlePasswordPaste}
          icon={oldPasswordVisible ? <EyeOpen width={20} /> : <EyeClose width={20} />}
          iconRole="button"
          onIconClick={() => setOldPasswordVisible(!oldPasswordVisible)}
          wrapperClass="mb-4"
        />

        <CreatePasswordForm includeFormClasses={false} />

        <div className="flex flex-grow items-center justify-center mx-2 my-4 border rounded-md border-neutral-4">
          {error && <TransactionResultsTile isSuccess={false} size="sm" message={error} />}
        </div>
      </div>

      {/* TODO: extract component to footer for options screens and other confirm selections */}
      <Separator variant="top" />
      <div className="flex justify-center mb-4">
        <Button
          className="w-[56%] text-center"
          disabled={!oldPasswordVerified || !passwordsVerified}
          onClick={handleChangePassword}
        >
          Confirm
        </Button>
      </div>
    </div>
  );
};
