import React, { ReactNode } from 'react';

import { LogoIcon } from '@/assets/icons';
import { cn } from '@/helpers/utils';

interface SeparatorProps {
  showBorder?: boolean;
  variant?: 'top' | 'bottom' | 'centered-icon' | 'neutral';
  className?: string;
  icon?: ReactNode;
}

const variantStyles = {
  top: 'mb-4',
  bottom: 'mt-1 mb-2',
  neutral: '',
};

export const Separator: React.FC<SeparatorProps> = ({
  showBorder = true,
  variant = 'neutral',
  className = '',
  icon = <LogoIcon />,
}) => {
  const lineColor = showBorder ? 'border-neutral-2' : 'border-transparent';

  return variant === 'centered-icon' ? (
    <div className="relative flex items-center justify-center mb-4">
      <div className={cn(`flex-grow border-t ${lineColor}`, className)} />
      {icon}
      <div className={cn(`flex-grow border-t ${lineColor}`, className)} />
    </div>
  ) : (
    <div className={cn(`border-b ${lineColor}`, variantStyles[variant], className)} />
  );
};
