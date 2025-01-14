import * as React from 'react';
import { ReactNode } from 'react';

import { cn } from '@/helpers/utils';
import { InputStatus } from '@/constants';
import { Button } from '../Button';

export interface InputProps extends React.InputHTMLAttributes<HTMLInputElement> {
  variant?: 'primary' | 'unstyled';
  label?: string;
  showMessageText?: boolean;
  status?: InputStatus;
  messageText?: string;
  icon?: ReactNode;
  wrapperClass?: string;
  iconRole?: string;
  onIconClick?: () => void;
  reducedHeight?: boolean;
  showClearAndMax?: boolean;
  showEndButton?: boolean;
  disableButtons?: boolean;
  onClear?: () => void;
  onMax?: () => void;
  onEndButtonClick?: () => void;
  endButtonTitle?: string;
  addClearMaxMargin?: boolean;
}

export const Input = React.forwardRef<HTMLInputElement, InputProps>(
  (
    {
      variant,
      className,
      type,
      label,
      showMessageText = false,
      status = InputStatus.NEUTRAL,
      messageText,
      icon,
      wrapperClass,
      iconRole,
      onIconClick,
      reducedHeight = false,
      showClearAndMax = false,
      showEndButton = false,
      disableButtons = true,
      onClear,
      onMax,
      onEndButtonClick,
      endButtonTitle = '',
      addClearMaxMargin = false,
      ...props
    },
    ref,
  ) => {
    const isError = status === InputStatus.ERROR;
    const isWarning = status === InputStatus.WARNING;
    const isSuccess = status === InputStatus.SUCCESS;
    const isInfo = status === InputStatus.INFO;

    console.log('input page add margin?', addClearMaxMargin);
    switch (variant) {
      case 'primary': {
        return (
          <>
            <div className="flex items-center w-full">
              <div className="flex-grow mr-2">
                <div className={cn('text-left', wrapperClass)}>
                  {label && <label className="block mb-1.5 text-xs text-white/80">{label}</label>}
                  <div
                    className={cn(
                      'flex items-center w-full rounded-md border bg-transparent group',
                      'hover:border-neutral-1',
                      'focus-within:outline-0 focus-within:!border-blue',
                      isError &&
                        'border-error text-error hover:border-error focus-within:border-error',
                      isWarning &&
                        'border-warning text-warning hover:border-warning focus-within:border-warning',
                      isSuccess &&
                        'border-success text-success hover:border-success focus-within:border-success',
                      !status && 'border-neutral-3',
                      className,
                    )}
                  >
                    <input
                      type={type}
                      className={cn(
                        'select-text',
                        `flex-grow ${reducedHeight ? 'h-8' : 'h-10'} bg-transparent px-2 py-1.5 text-base text-neutral-3`,
                        'border-none focus:outline-0',
                        'hover:text-neutral-1 focus:text-white',
                        'placeholder:text-xs placeholder:text-neutral-3',
                        isError && 'text-error hover:text-error focus:text-error',
                        isWarning && 'text-warning hover:text-warning focus:text-warning',
                        isSuccess && 'text-success hover:text-success focus:text-success',
                        !status && 'text-neutral-3',
                        icon && 'pr-2',
                      )}
                      ref={ref}
                      {...props}
                    />

                    {icon && (
                      <div
                        className={cn(
                          'h-[57%] min-h-[21px] w-[1px]',
                          'group-hover:bg-neutral-1 group-focus-within:!bg-blue',
                          isError && 'bg-error group-hover:bg-error group-focus-within:bg-error',
                          isWarning &&
                            'bg-warning group-hover:bg-warning group-focus-within:bg-warning',
                          isSuccess &&
                            'bg-success group-hover:bg-success group-focus-within:bg-success',
                          !status && 'bg-neutral-3',
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
                          isWarning &&
                            'text-warning hover:text-warning focus:text-warning border-warning',
                          isSuccess &&
                            'text-success hover:text-success focus:text-success border-success',
                          isInfo &&
                            'text-blue hover:text-blue-hover focus:text-blue-pressed border-blue',
                        )}
                        onClick={onIconClick}
                      >
                        {icon}
                      </div>
                    )}
                  </div>
                  {showMessageText && (
                    <span
                      className={cn(
                        `mt-1.5 text-sm ${isWarning && 'text-warning'} ${isError && 'text-error'} min-h-[20px] mb-4`,
                      )}
                    >
                      {messageText || '\u00A0'}
                    </span>
                  )}
                </div>
              </div>
              {showEndButton && (
                <Button
                  size="sm"
                  className="ml-2 px-2 py-1 rounded-md w-16"
                  disabled={disableButtons}
                  onClick={onEndButtonClick}
                >
                  {endButtonTitle}
                </Button>
              )}
            </div>

            {showClearAndMax && (
              <div className={cn(`flex justify-between mt-1 ${addClearMaxMargin ? 'mr-2' : ''}`)}>
                <Button
                  size="xs"
                  variant="unselected"
                  className="px-2 rounded-md text-xs"
                  disabled={disableButtons}
                  onClick={onClear}
                >
                  Clear
                </Button>
                <Button
                  size="xs"
                  variant="unselected"
                  className="px-2 rounded-md text-xs"
                  disabled={disableButtons}
                  onClick={onMax}
                >
                  Max
                </Button>
              </div>
            )}
          </>
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
