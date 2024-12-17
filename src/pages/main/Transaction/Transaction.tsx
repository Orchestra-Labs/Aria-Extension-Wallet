import React from 'react';
import { NavLink } from 'react-router-dom';

import { ArrowLeft, Copy, FullArrowRight, Logo } from '@/assets/icons';
import { ROUTES } from '@/constants';
import { cn } from '@/helpers/utils';
import { Button } from '@/ui-kit';

const TRANSACTION_INFO = [
  { id: 1, label: 'Transaction ID', value: '105' },
  { id: 2, label: 'Gas limit', value: '91390' },
  { id: 3, label: 'Gas used', value: '91390' },
  { id: 4, label: 'Priority gas', value: '5' },
  { id: 5, label: 'Sum gas', value: '0.005 MLD' },
  { id: 6, label: 'Total sum', value: '0.00554 MLD' },
];

export const Transaction: React.FC = () => (
  <div className="h-full pt-5 px-4">
    <div className="flex justify-between items-center w-full">
      <NavLink
        to={ROUTES.APP.TRANSACTIONS_HISTORY}
        className="flex items-center justify-center max-w-5 max-h-5 p-0.5"
      >
        <ArrowLeft className="w-full h-full text-white" />
      </NavLink>
      <h1 className="text-h5 text-white font-bold">Transaction</h1>
      <div className="max-w-5 w-full max-h-5" />
    </div>
    <div className="p-4 border rounded-xl border-neutral-2 mt-5">
      <div className="flex justify-between items-center">
        <h6 className="text-base text-white">Status</h6>
        <div className="rounded-md bg-success-dark text-success text-sm font-semibold px-1.5 py-1">
          Confirmed
        </div>
      </div>
      <div className="flex justify-between items-center mt-2.5">
        <a className="text-blue text-sm font-normal hover:text-blue-dark" href="#">
          See tx in explorer
        </a>
        <Button variant="link" size="xsmall" className="p-0">
          Copy tx hash
          <Copy className="ml-1" height="100%" />
        </Button>
      </div>
    </div>
    <div className="flex justify-between items-center mt-5 text-left">
      <div className="bg-neutral-2 rounded-2xl py-2 px-3 w-full h-14">
        <h6 className="text-sm text-neutral-1">From</h6>
        <div className="flex items-center mt-1">
          <Logo className="w-5 h-5 rounded-full mr-1" />
          <p className="text-white text-base">Au4...Z45U56x</p>
        </div>
      </div>
      <div className="bg-blue rounded-full mx-3 h-9 w-9 p-2 flex justify-center items-center">
        <FullArrowRight className="text-background-dark-grey" />
      </div>
      <div className="bg-neutral-2 rounded-2xl py-3 px-3 w-full h-16">
        <h6 className="text-sm text-neutral-1">To</h6>
        <div className="flex items-center mt-1">
          <Logo className="w-5 h-5 rounded-full mr-1" />
          <p className="text-white text-base">Au4...Z45U56x</p>
        </div>
      </div>
    </div>
    <div className="p-4 border rounded-xl border-neutral-2 mt-5">
      <h5 className="text-lg text-white text-left">Transaction info</h5>
      <div className="flex w-full flex-col mt-3">
        {TRANSACTION_INFO.map((item, index) => (
          <div
            key={item.id}
            className={cn('flex justify-between items-center not-last:mb-2.5 last:mt-1')}
          >
            <p
              className={cn(
                'text-xs text-neutral-1',
                index === TRANSACTION_INFO.length - 1 && 'text-base text-blue',
              )}
            >
              {item.label}
            </p>
            <p
              className={cn(
                'text-sm text-white',
                index === TRANSACTION_INFO.length - 1 && 'text-base text-blue',
              )}
            >
              {item.value}
            </p>
          </div>
        ))}
      </div>
    </div>
  </div>
);
