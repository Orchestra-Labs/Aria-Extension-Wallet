import { useAtom, useAtomValue, useSetAtom } from 'jotai';
import React, { ComponentType } from 'react';
import { NavLink, Outlet } from 'react-router-dom';

import { LogoIcon } from '@/assets/icons';
import { OptionsDialog } from '@/components';
import { NetworkLevel, ROUTES, SettingsOption } from '@/constants';
import {
  networkLevelAtom,
  resetSelectedValidatorChainAtom,
  sessionWalletAtom,
  userAccountAtom,
  validatorDataAtom,
} from '@/atoms';
import { Button } from '@/ui-kit';

const MainLayout: React.FC = () => {
  const [networkLevel, setNetworkLevel] = useAtom(networkLevelAtom);
  const userWallet = useAtomValue(sessionWalletAtom);
  const userAccount = useAtomValue(userAccountAtom);
  const setValidatorState = useSetAtom(validatorDataAtom);
  const resetSelectedValidatorChain = useSetAtom(resetSelectedValidatorChainAtom);

  const toggleNetworkLevel = () => {
    setValidatorState([]);
    resetSelectedValidatorChain();
    setNetworkLevel(prev =>
      prev === NetworkLevel.MAINNET ? NetworkLevel.TESTNET : NetworkLevel.MAINNET,
    );
  };

  const showTestnetButton = userAccount?.settings[SettingsOption.TESTNET_ACCESS] ?? false;

  return (
    <div className="max-w-full bg-background-dark-grey flex flex-col w-[420px] h-[600px]">
      <header className="bg-gradient-to-b from-[#202022] to-[#33334652] h-20 p-4 flex items-center">
        <NavLink className="flex max-h-12 mr-4" to={ROUTES.APP.ROOT}>
          <LogoIcon className="h-auto w-auto" />
        </NavLink>

        <h1 className="text-white text-h3 font-semibold">{userWallet?.name}</h1>

        <div className="flex-1" />
        <div className="flex gap-x-2.5 items-center">
          {showTestnetButton && (
            <Button
              variant={networkLevel === NetworkLevel.MAINNET ? 'default' : 'secondary'}
              size="medium"
              onClick={toggleNetworkLevel}
              className="px-3 py-1 rounded-md font-medium"
            >
              {networkLevel === NetworkLevel.MAINNET ? 'Mainnet' : 'Testnet'}
            </Button>
          )}

          {/* Menu label now to the LEFT of the dots */}
          <span className="text-white text-sm">Menu</span>
          <OptionsDialog />
        </div>
      </header>
      <Outlet />
    </div>
  );
};

export default MainLayout as ComponentType;
