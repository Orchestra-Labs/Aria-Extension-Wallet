import React from 'react';
import Tippy from '@tippyjs/react';
import 'tippy.js/dist/tippy.css';
import { Position } from '@/constants';

export enum TriggerType {
  ON_HOVER = 'mouseenter focus',
  ON_CLICK = 'click',
}

interface TooltipProps {
  children: React.ReactElement;
  tooltipText: string;
  maxWidth?: number;
  position?: Position;
  trigger?: TriggerType;
  className?: string;
}

export const Tooltip: React.FC<TooltipProps> = ({
  children,
  tooltipText,
  maxWidth = 150,
  position = Position.TOP,
  trigger = TriggerType.ON_HOVER,
  className = '',
}) => {
  // Clone the child element to ensure it can receive refs
  const childWithRef = React.cloneElement(children, {
    className: `${children.props.className || ''} ${className}`,
  });

  return (
    <Tippy
      content={tooltipText}
      placement={position}
      maxWidth={maxWidth}
      arrow={true}
      theme="dark"
      trigger={trigger}
      interactive={trigger === TriggerType.ON_CLICK}
      hideOnClick={trigger === TriggerType.ON_CLICK ? false : true}
    >
      {childWithRef}
    </Tippy>
  );
};
