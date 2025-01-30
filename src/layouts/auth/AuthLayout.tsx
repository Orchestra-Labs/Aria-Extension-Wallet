import React, { ComponentType } from 'react';
import { Outlet, useNavigate } from 'react-router-dom';

import { Logo } from '@/assets/icons';
import { ROUTES } from '@/constants';

const AuthLayout: React.FC = () => {
  const navigate = useNavigate();

  const onLogoClick = () => {
    navigate(ROUTES.APP.ROOT);
  };
  return (
    <div className="max-w-full bg-background-black p-5 flex flex-col w-[420px] h-[600px]">
      <header className="py-2 flex justify-center items-center">
        <Logo className="h-9" role="button" onClick={onLogoClick} />
      </header>
      <Outlet />
    </div>
  );
};

export default AuthLayout as ComponentType;
