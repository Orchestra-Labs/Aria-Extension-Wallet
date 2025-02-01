import React, { ComponentType } from 'react';
import { Outlet, useNavigate } from 'react-router-dom';

import { Logo } from '@/assets/icons';
import { ROUTES } from '@/constants';

const ExpandedLayout: React.FC = () => {
  const navigate = useNavigate();

  const onLogoClick = () => {
    navigate(ROUTES.APP.ROOT);
  };
  return (
    <div className="max-w-full bg-background-black h-full p-5 flex flex-col">
      <div className="container max-w-5xl min-h-dvh mx-auto text-start flex flex-col">
        <header className="py-2 flex justify-center items-center">
          <Logo className="h-9" role="button" onClick={onLogoClick} />
        </header>
        <Outlet />
      </div>
    </div>
  );
};

export default ExpandedLayout as ComponentType;
