import { useAtom, useAtomValue } from 'jotai';
import React, { ComponentType } from 'react';
import { NavLink, Outlet } from 'react-router-dom';

import { LogoIcon } from '@/assets/icons';
import { OptionsDialog } from '@/components';
import { NetworkLevel, ROUTES } from '@/constants';
import { networkLevelAtom, sessionWalletAtom } from '@/atoms';

const MainLayout: React.FC = () => {
  const [networkLevel, setNetworkLevel] = useAtom(networkLevelAtom);
  const userWallet = useAtomValue(sessionWalletAtom);

  const toggleNetworkLevel = () => {
    setNetworkLevel(prev =>
      prev === NetworkLevel.MAINNET ? NetworkLevel.TESTNET : NetworkLevel.MAINNET,
    );
  };

  return (
    <div className="max-w-full bg-background-dark-grey flex flex-col w-[420px] h-[600px]">
      <header className="bg-gradient-to-b from-[#202022] to-[#33334652] h-20 p-4 flex items-center">
        <NavLink className="flex max-h-12 mr-4" to={ROUTES.APP.ROOT}>
          <LogoIcon className="h-auto w-auto" />
        </NavLink>
        {/* TODO: change text for text-button as below so user can change wallet selection */}
        {/* <div
        role="button"
        className="flex items-center py-1.5 px-2 rounded-full border border-neutral-2 h-8"
      >
        <img className="h-5 w-5" src={avatarUrl} alt="Avatar" />
        <span className="text-sm text-white ml-1.5">Au4...Z45U56x</span>
        <Copy width="14px" className="text-neutral-1 ml-1" />
      </div> */}
        <h1 className="text-white text-h3 font-semibold">{userWallet?.name}</h1>

        <div className="flex-1" />
        <div className="flex gap-x-2.5">
          {/* TODO: enable if these become available, and are possible */}
          {/* <ConnectedServicesDialog /> */}
          {/* <Button className="p-[7px]" variant="icon" size="rounded-default" asChild>
          <NavLink to={ROUTES.APP.TRANSACTIONS_HISTORY}>
            <History width="100%" height="100%" />
          </NavLink>
        </Button> */}
          <button
            onClick={toggleNetworkLevel}
            className="px-3 py-1 rounded-md text-sm"
            style={{
              backgroundColor: networkLevel === NetworkLevel.MAINNET ? '#4CAF50' : '#F44336',
              color: 'white',
            }}
          >
            {networkLevel === NetworkLevel.MAINNET ? 'Mainnet' : 'Testnet'}
          </button>

          <OptionsDialog />
        </div>
      </header>
      <Outlet />
    </div>
  );
};

export default MainLayout as ComponentType;
