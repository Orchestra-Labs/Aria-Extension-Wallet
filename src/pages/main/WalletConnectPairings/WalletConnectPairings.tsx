'use dom';

import React from 'react';
import { useNavigate } from 'react-router-dom';

import { Header, PairingTile } from '@/components';
import { ROUTES } from '@/constants';
import { useGetWCPairingsQuery } from '@/queries';

const PAGE_TITLE = 'Connected Websites';

export const WalletConnectPairings: React.FC = () => {
  const navigate = useNavigate();
  const { data: pairings } = useGetWCPairingsQuery();

  const closeScreen = () => navigate(ROUTES.APP.ROOT);

  return (
    <div className="h-full flex flex-col overflow-hidden text-white">
      <Header title={PAGE_TITLE} onClose={closeScreen} />

      <div className="p-4 mt-4 h-full flex flex-grow flex-col gap-2">
        {!pairings?.length ? (
          <p className="font-bold text-center text-xl flex-grow h-full flex items-center justify-center">
            No connected websites yet
          </p>
        ) : (
          pairings.map(pairing => <PairingTile pairing={pairing} key={pairing.topic} />)
        )}
      </div>
    </div>
  );
};
