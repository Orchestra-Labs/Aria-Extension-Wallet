import { ClassValue } from 'clsx';
import React, { Children } from 'react';

import { cn } from '@/helpers/utils';

type StepperProps = {
  children: React.ReactNode;
  active: number;
  containerClass?: ClassValue | string;
  progressBarClass?: ClassValue | string;
  labels: string[];
};

export const Stepper: React.FC<StepperProps> = ({
  children,
  active,
  containerClass,
  progressBarClass,
  labels,
}) => {
  const childrenArray = Children.toArray(children);

  return (
    <div className={cn('flex items-center flex-col', containerClass as ClassValue | string)}>
      <ol className={cn('flex items-center w-full mb-2', progressBarClass as ClassValue | string)}>
        {labels.map((label, index) => (
          <li
            key={`step-${index}`}
            className={cn(
              'flex items-center w-full relative text-indigo-600',
              "not-last:after:content-[''] not-last:after:absolute not-last:after:top-[15px] not-last:after:left-[67px] not-last:after:right-[-12px] not-last:after:h-1.5 not-last:after:bg-neutral-2 not-last:after:inline-block not-last:after:rounded-full",
              active > index && 'not-last:after:bg-blue',
              'last:w-auto',
            )}
          >
            <div
              className={cn(
                'whitespace-nowrap max-w-20 w-full z-10 flex flex-col items-center text-white',
                active >= index && 'text-blue',
              )}
            >
              <span
                className={cn(
                  'w-7 h-7 bg-neutral-2 rounded-full flex justify-center items-center text-sm text-white',
                  active === index && 'border border-blue text-blue bg-transparent',
                  active > index && 'bg-blue text-black',
                )}
              >
                {index + 1}
              </span>
              <p className={cn('mt-2 text-xs text-nowrap')}>{label}</p>
            </div>
          </li>
        ))}
      </ol>
      {childrenArray[active]}
    </div>
  );
};
