'use dom';

import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';

import { ROUTES } from '@/constants';

export const WalletConnectInitSessionInput: React.FC = () => {
  const [value, setValue] = useState('');

  const navigate = useNavigate();

  const onSubmit = () => {
    navigate({
      pathname: ROUTES.APP.WALLET_CONNECT.INIT_SESSION,
    });
    window.location.search = new URLSearchParams({ uri: value }).toString();
  };

  return (
    <div>
      <input
        type="text"
        name="uri"
        id="uri"
        value={value}
        onChange={e => setValue(e.target.value)}
      />
      <button onClick={onSubmit}>Connect</button>
    </div>
  );
};
