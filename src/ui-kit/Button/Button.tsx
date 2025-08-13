import { Slot } from '@radix-ui/react-slot';
import { cva, type VariantProps } from 'class-variance-authority';
import * as React from 'react';
import { cn } from '@/helpers/utils';

type ButtonConfig = {
  variant: {
    [key: string]: string | string[];
  };
  size: {
    [key: string]: string | string[];
  };
};

const buttonVariants = cva<ButtonConfig>(
  'inline-flex items-center justify-center whitespace-nowrap rounded-full text-sm',
  {
    variants: {
      variant: {
        default: [
          'text-black bg-blue',
          'hover:bg-blue-hover hover:text-blue-dark',
          'active:bg-blue-pressed active:text-black',
          'disabled:bg-neutral-3 disabled:text-neutral-1',
        ],
        blank: '',
        transparent: ['bg-transparent text-blue min-h-12', 'hover:text-blue-dark'],
        transparentNeutral: ['bg-transparent text-neutral-1 min-h-12', 'hover:text-grey-dark'],
        secondary: [
          'text-blue border bg-transparent',
          'hover:bg-blue-hover-secondary hover:text-blue-dark hover:border-blue-darker',
          'active:bg-blue-pressed-secondary active:text-blue active:border-blue',
          'disabled:border-neutral-3 disabled:text-neutral-3 disabled:bg-transparent',
        ],
        unselected: [
          'text-neutral-1 border-grey',
          'hover:bg-grey hover:text-grey-dark hover:border-grey',
          'active:bg-grey-pressed-secondary active:text-neutral-1 active:border-grey',
          'disabled:border-neutral-3 disabled:text-neutral-3 disabled:bg-transparent',
        ],
        unselectedEnabled: [
          'text-neutral-1 border border-grey',
          'hover:bg-grey hover:text-grey-dark hover:border-grey',
          'active:bg-grey-pressed-secondary active:text-neutral-1 active:border-grey',
          'disabled:border-neutral-3 disabled:text-neutral-3 disabled:bg-transparent',
        ],
        selected: [
          'text-blue border bg-transparent',
          'cursor-default',
          'disabled:border-neutral-3 disabled:text-neutral-3 disabled:bg-transparent',
        ],
        selectedEnabled: [
          'text-blue border bg-transparent',
          'hover:bg-blue-hover hover:text-blue-dark',
          'active:bg-blue-pressed active:text-blue-darker',
          'disabled:border-neutral-3 disabled:text-neutral-3 disabled:bg-transparent',
        ],
        icon: ['rounded-full bg-neutral-2 text-white', ''],
        reactiveIcon: [
          'rounded-full bg-neutral-2 text-white',
          'hover:bg-neutral-4 hover:text-white',
          'active:bg-neutral-3 active:text-neutral-1',
          'disabled:bg-neutral-3 disabled:text-neutral-1',
        ],
        secondaryReactiveIcon: [
          'rounded-full text-neutral-3',
          'hover:bg-neutral-4 hover:text-white',
          'active:bg-neutral-3 active:text-neutral-1',
          'disabled:bg-neutral-3 disabled:text-neutral-1',
        ],
        link: ['text-blue text-sm hover:text-blue-dark bg-transparent'],
        dialogOption: [
          'w-full text-sm text-white font-normal py-3 px-2',
          'bg-transparent text-left justify-start rounded-none',
          'hover:bg-neutral-4 hover:text-white',
          'active:bg-neutral-3 active:text-neutral-1',
          'not-last:border-b not-last:border-neutral-4',
        ],
      },
      size: {
        default: 'h-10 p-2.5',
        medium: 'h-8 p-0 min-h-8',
        small: 'h-6 p-0 min-h-6',
        'rounded-default': 'max-w-8 max-h-8 w-8 h-8',
        xsmall: 'h-[18px] p-0',
        blank: '',
      },
    },
    defaultVariants: {
      variant: 'default',
      size: 'default',
    },
  },
);

export interface ButtonProps
  extends React.ButtonHTMLAttributes<HTMLButtonElement>,
    VariantProps<typeof buttonVariants> {
  asChild?: boolean;
}

const Button = React.forwardRef<HTMLButtonElement, ButtonProps>(
  ({ className, variant, size, asChild = false, ...props }, ref) => {
    const Comp = asChild ? Slot : 'button';
    return (
      <Comp className={cn(buttonVariants({ variant, size, className }))} ref={ref} {...props} />
    );
  },
);
Button.displayName = 'Button';

export { Button, buttonVariants };
