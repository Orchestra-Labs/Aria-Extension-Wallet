import { Dialog, DialogTrigger } from '@radix-ui/react-dialog';
import {
  EditIcon,
  Globe,
  GraduationCap,
  LogOut,
  NotebookPenIcon,
  NotebookTextIcon,
  Settings,
} from 'lucide-react';
import React, { useState } from 'react';
import { Link } from 'react-router-dom';

import { ArrowLeft, Discord, DotsVertical } from '@/assets/icons';
import { ROUTES } from '@/constants';
import { useLogout } from '@/hooks';
import { Button, DialogContent } from '@/ui-kit';

const OPTIONS = [
  {
    id: 1,
    name: 'Settings',
    icon: <Settings width={16} height={16} />,
    target: '',
    to: ROUTES.APP.SETTINGS,
  },
  {
    id: 2,
    name: 'Change Password',
    icon: <NotebookPenIcon width={16} height={16} />,
    target: '',
    to: ROUTES.APP.CHANGE_PASSWORD,
  },
  {
    id: 3,
    name: 'View Passphrase',
    icon: <NotebookTextIcon width={16} height={16} />,
    target: '',
    to: ROUTES.APP.VIEW_PASSPHRASE,
  },
  {
    id: 4,
    name: 'Edit Coin List',
    icon: <EditIcon width={16} height={16} />,
    target: '',
    to: ROUTES.APP.EDIT_COIN_LIST,
  },
  {
    id: 5,
    name: 'View Tutorial',
    icon: <GraduationCap width={16} height={16} />,
    target: '',
    to: ROUTES.APP.VIEW_TUTORIAL,
  },
  {
    id: 6,
    name: 'Contact Us',
    icon: <Discord />,
    target: '_blank',
    to: 'https://discord.gg/symphony-1162823265975279636',
  },
  {
    id: 7,
    name: 'Connected dApps',
    icon: <Globe />,
    target: '',
    to: ROUTES.APP.WALLET_CONNECT.PAIRINGS,
  },
];

// TODO: add animation slide down on open, animation slide up on close
export const OptionsDialog: React.FC = () => {
  const [open, setOpen] = useState(false);
  const logout = useLogout();

  const handleLogOut = () => {
    logout();
  };

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button className="p-[7px]" variant="icon" size="rounded-default">
          <DotsVertical width="100%" height="100%" />
        </Button>
      </DialogTrigger>
      <DialogContent>
        <h3 className="text-h5 font-bold">Options</h3>
        <div className="grid">
          {OPTIONS.map(option => (
            <Link
              key={option.id}
              to={option.to}
              target={option.target}
              onClick={() => setOpen(false)}
              className="flex items-center text-sm text-white font-normal py-3 not-last:border-b not-last:border-neutral-4 hover:text-white"
            >
              <div className="h-8 w-8 bg-blue rounded-full flex items-center justify-center p-1.5 mr-2.5 text-black">
                {option.icon}
              </div>
              {option.name}
              <div className="flex-1" />
              <ArrowLeft className="rotate-180 h-3 w-3" />
            </Link>
          ))}
          <Button
            variant="transparent"
            className="flex items-center text-sm text-white font-normal py-3 px-0 h-auto rounded-none hover:text-white"
            onClick={handleLogOut}
          >
            <div className="h-8 w-8 bg-blue rounded-full flex items-center justify-center p-1.5 mr-2.5 text-black">
              <LogOut width={16} height={16} />
            </div>
            Logout
            <div className="flex-1" />
            <ArrowLeft className="rotate-180 h-3 w-3" />
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
};
