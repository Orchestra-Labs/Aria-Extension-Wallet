import { Dialog, DialogTrigger } from '@radix-ui/react-dialog';
import React, { useState } from 'react';

import { Check, Link, LogoIcon } from '@/assets/icons';
import { Button, DialogContent } from '@/ui-kit';

const EXAMPLE_SERVICES = [
  { id: 1, name: 'Symphony labs', logo: <LogoIcon width="24px" /> },
  { id: 2, name: 'Uniswap', logo: <LogoIcon className="w-full h-full" /> },
  { id: 3, name: 'Binance', logo: <LogoIcon className="w-full h-full" /> },
];

export const ConnectedServicesDialog: React.FC = () => {
  const [selected, setSelected] = useState<number[]>([]);

  const onSelect = (serviceId: number) => {
    const isSelected = selected.includes(serviceId);

    if (isSelected) {
      setSelected(prevState => prevState.filter(item => item !== serviceId));
    } else {
      setSelected(prevState => [...prevState, serviceId]);
    }
  };

  return (
    <Dialog>
      <DialogTrigger asChild>
        <Button className="p-[7px]" variant="icon" size="rounded-default">
          <Link width="100%" height="100%" />
        </Button>
      </DialogTrigger>
      <DialogContent>
        <h3 className="text-h5 font-bold">Connected services</h3>
        <div className="grid">
          {EXAMPLE_SERVICES.map(item => (
            <div
              key={item.id}
              role="button"
              className="flex items-center text-sm text-white font-normal py-2.5 not-last:border-b not-last:border-neutral-4 hover:text-white last:pb-0"
              onClick={() => onSelect(item.id)}
            >
              <div className="h-10 w-10 bg-[#323338] rounded-full flex items-center justify-center mr-2.5">
                {item.logo}
              </div>
              <div>{item.name}</div>
              <div className="flex-1" />
              {selected.includes(item.id) && (
                <div className="text-white">
                  <Check width={16} />
                </div>
              )}
            </div>
          ))}
        </div>
      </DialogContent>
    </Dialog>
  );
};
