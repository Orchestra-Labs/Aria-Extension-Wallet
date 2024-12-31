import React, { useState } from 'react';
import { isInitialDataLoadAtom } from '@/atoms';
import { useAtom, useAtomValue } from 'jotai';
import { NavLink, useNavigate } from 'react-router-dom';
import { ROUTES, SettingsOptions } from '@/constants';
import { X } from '@/assets/icons';
import { Button, Separator } from '@/ui-kit';
import { saveAccountByID } from '@/helpers/dataHelpers/account';
import { userAccountAtom } from '@/atoms/accountAtom';

interface SettingsScreenProps {}

const DEFAULT_CONFIG = {
  [SettingsOptions.STABLECOIN_FEE]: false,
  [SettingsOptions.VALIDATOR_STATUS]: false,
};

const PAGE_TITLE = 'Change Settings';

export const SettingsScreen: React.FC<SettingsScreenProps> = () => {
  const navigate = useNavigate();

  const isInitialDataLoad = useAtomValue(isInitialDataLoadAtom);
  const [userAccount, setUserAccount] = useAtom(userAccountAtom);

  const [tempSettings, setTempSettings] = useState(userAccount?.settings);

  const closeAndReturn = () => {
    navigate(ROUTES.APP.ROOT);
  };

  const toggleOption = (option: SettingsOptions) => {
    if (tempSettings) {
      const updatedAccount = {
        ...tempSettings,
        [option]: !tempSettings[option],
      };

      setTempSettings(updatedAccount);
    } else {
      console.warn('Settings is undefined');
    }
  };

  const confirmSelection = () => {
    if (userAccount && tempSettings) {
      const updatedAccount = {
        ...userAccount,
        settings: tempSettings,
      };

      setUserAccount(updatedAccount);
      saveAccountByID(updatedAccount);
    } else {
      console.warn('Settings or userAccount is undefined:', { config: tempSettings, userAccount });
    }

    closeAndReturn();
  };

  return (
    <div className="h-screen flex flex-col overflow-hidden bg-black text-white">
      {/* Top bar */}
      <div className="flex justify-between items-center w-full p-5">
        <NavLink
          to={ROUTES.APP.ROOT}
          className="flex items-center justify-center max-w-5 max-h-5 p-0.5"
          onClick={closeAndReturn}
        >
          <X className="w-full h-full text-white" />
        </NavLink>
        <div>
          <h1 className="text-h5 text-white font-bold">{PAGE_TITLE}</h1>
        </div>
        <div className="max-w-5 w-full max-h-5" />
      </div>

      <Separator />

      {/* Configuration options */}
      <div className="px-4 py-2">
        <h2 className="text-lg font-bold text-center">Configuration Options</h2>
        <div className="flex flex-col gap-4 mt-4 mx-[10%]">
          <label className="flex flex-grow gap-4">
            <input
              type="checkbox"
              checked={
                (tempSettings && tempSettings[SettingsOptions.STABLECOIN_FEE]) ||
                DEFAULT_CONFIG[SettingsOptions.STABLECOIN_FEE]
              }
              onChange={() => toggleOption(SettingsOptions.STABLECOIN_FEE)}
              className="form-checkbox h-5 w-5 text-blue-600"
            />
            <span className="text-left flex">Pay Gas With Stablecoins</span>
          </label>
          <label className="flex flex-grow gap-4">
            <input
              type="checkbox"
              checked={
                (tempSettings && tempSettings[SettingsOptions.VALIDATOR_STATUS]) ||
                DEFAULT_CONFIG[SettingsOptions.VALIDATOR_STATUS]
              }
              onChange={() => toggleOption(SettingsOptions.VALIDATOR_STATUS)}
              className="form-checkbox h-5 w-5 text-blue-600"
            />
            <span className="text-left flex">View Validators by Activity Status</span>
          </label>
        </div>
      </div>

      <Separator variant="top" />
      <div className="flex justify-center mb-4">
        <Button
          className="w-[56%] text-center"
          disabled={isInitialDataLoad}
          onClick={confirmSelection}
        >
          Confirm
        </Button>
      </div>
    </div>
  );
};
