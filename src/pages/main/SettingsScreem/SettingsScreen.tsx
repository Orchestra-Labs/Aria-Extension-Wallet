import React, { useState } from 'react';
import { isInitialDataLoadAtom } from '@/atoms';
import { useAtom, useAtomValue } from 'jotai';
import { useNavigate } from 'react-router-dom';
import { ROUTES, SettingsOption } from '@/constants';
import { Button, Separator } from '@/ui-kit';
import { saveAccountByID } from '@/helpers/dataHelpers/account';
import { userAccountAtom } from '@/atoms/accountAtom';
import { Header } from '@/components';

interface SettingsScreenProps {}

const DEFAULT_CONFIG = {
  // [SettingsOptions.STABLECOIN_FEE]: false,
  [SettingsOption.VALIDATOR_STATUS]: false,
  [SettingsOption.TESTNET_ACCESS]: false,
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

  const toggleOption = (option: SettingsOption) => {
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
      <Header title={PAGE_TITLE} onClose={closeAndReturn} />

      {/* Configuration options */}
      <div className="flex flex-grow flex-col px-4 pt-4">
        <h2 className="text-lg font-bold text-center">Configuration Options</h2>
        <div className="flex flex-col gap-4 mt-4 mx-[10%]">
          {/* <label className="flex flex-grow gap-4">
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
          </label> */}
          <label className="flex flex-grow gap-4">
            <input
              type="checkbox"
              checked={
                (tempSettings && tempSettings[SettingsOption.VALIDATOR_STATUS]) ||
                DEFAULT_CONFIG[SettingsOption.VALIDATOR_STATUS]
              }
              onChange={() => toggleOption(SettingsOption.VALIDATOR_STATUS)}
              className="form-checkbox h-5 w-5 text-blue-600"
            />
            <span className="text-left flex">View Validators by Activity Status</span>
          </label>

          <label className="flex flex-grow gap-4">
            <input
              type="checkbox"
              checked={
                (tempSettings && tempSettings[SettingsOption.TESTNET_ACCESS]) ||
                DEFAULT_CONFIG[SettingsOption.TESTNET_ACCESS]
              }
              onChange={() => toggleOption(SettingsOption.TESTNET_ACCESS)}
              className="form-checkbox h-5 w-5 text-blue-600"
            />
            <span className="text-left flex">Enable Testnet Access</span>
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
