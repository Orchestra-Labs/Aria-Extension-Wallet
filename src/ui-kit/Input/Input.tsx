import * as React from 'react';
import { ReactNode } from 'react';

import { cn } from '@/helpers/utils';

export interface InputProps extends React.InputHTMLAttributes<HTMLInputElement> {
  variant?: 'primary' | 'unstyled';
  label?: string;
  showMessageText?: boolean;
  status?: 'error' | 'success' | 'info' | null;
  messageText?: string;
  icon?: ReactNode;
  wrapperClass?: string;
  iconRole?: string;
  onIconClick?: () => void;
  reducedHeight?: boolean;
}

export const Input = React.forwardRef<HTMLInputElement, InputProps>(
  (
    {
      variant,
      className,
      type,
      label,
      showMessageText = false,
      status = null,
      messageText,
      icon,
      wrapperClass,
      iconRole,
      onIconClick,
      reducedHeight = false,
      ...props
    },
    ref,
  ) => {
    const isError = status === 'error';
    const isSuccess = status === 'success';
    const isInfo = status === 'info';

    switch (variant) {
      case 'primary': {
        return (
          <div className={cn('text-left', wrapperClass)}>
            {label && <label className="block mb-1.5 text-xs text-white/80">{label}</label>}
            <div
              className={cn(
                'flex items-center w-full rounded-md border bg-transparent group',
                'hover:border-neutral-1',
                'focus-within:outline-0',
                isError && 'border-error text-error hover:border-error focus-within:border-error',
                isSuccess &&
                  'border-success text-success hover:border-success focus-within:border-success',
                !isError && !isSuccess && !isInfo && 'border-neutral-3 focus-within:!border-blue',
                className,
              )}
            >
              <input
                type={type}
                className={cn(
                  'select-text',
                  `flex-grow ${reducedHeight ? 'h-8' : 'h-10'} bg-transparent px-2 py-1.5 text-base text-neutral-3`,
                  'border-none focus:outline-0',
                  'placeholder:text-xs placeholder:text-neutral-3',
                  isError && 'text-error hover:text-error focus:text-error',
                  isSuccess && 'text-success hover:text-success focus:text-success',
                  !isError &&
                    !isSuccess &&
                    !isInfo &&
                    'text-neutral-3 focus:text-white hover:text-neutral-1',
                  icon && 'pr-2',
                )}
                ref={ref}
                {...props}
              />

              {icon && (
                <div
                  className={cn(
                    'h-[57%] min-h-[21px] w-[1px]',
                    'group-hover:bg-neutral-1',
                    isError && 'bg-error group-hover:bg-error group-focus-within:bg-error',
                    isSuccess && 'bg-success group-hover:bg-success group-focus-within:bg-success',
                    !isError && !isSuccess && !isInfo && 'bg-neutral-3 group-focus-within:!bg-blue',
                  )}
                />
              )}

              {icon && (
                <div
                  role={iconRole}
                  className={cn(
                    'w-10 h-full flex items-center justify-center',
                    'rounded-r-md',
                    'text-neutral-3 hover:text-neutral-1 focus:text-white',
                    isError && 'text-error hover:text-error focus:text-error border-error',
                    isSuccess &&
                      'text-success hover:text-success focus:text-success border-success',
                    isInfo && 'text-blue hover:text-blue-hover focus:text-blue-pressed border-blue',
                  )}
                  onClick={onIconClick}
                >
                  {icon}
                </div>
              )}
            </div>
            {showMessageText && (
              <span className="mt-1.5 text-sm text-error min-h-[20px] mb-4">
                {messageText || '\u00A0'}
              </span>
            )}
          </div>
        );
      }
      default: {
        return (
          <>
            <input className={cn('select-text bg-transparent', className)} ref={ref} {...props} />
            {showMessageText && <span className="mt-1.5 text-sm min-h-[20px] mb-4">&nbsp;</span>}
          </>
        );
      }
    }
  },
);

Input.displayName = 'Input';
