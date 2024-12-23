import React, { ReactNode } from 'react';
import Tippy from '@tippyjs/react';
import 'tippy.js/dist/tippy.css';
import { Position } from '@/constants';

interface TooltipProps {
  children: ReactNode;
  tooltipText: string;
  position?: Position;
}

const Tooltip: React.FC<TooltipProps> = ({ children, tooltipText, position = Position.TOP }) => {
  return (
    <div className="flex justify-center items-center w-full">
      <div className="flex-1 flex justify-center items-center" />

      <div className="flex items-center">
        <div className="text-white text-center">{children}</div>

        <Tippy
          content={tooltipText}
          placement={position}
          maxWidth="100px"
          arrow={true}
          theme="dark"
        >
          <span className="text-blue rounded-full">
            <span className="p-1 text-sm">?</span>
          </span>
        </Tippy>
      </div>

      <div className="flex-1 flex justify-center items-center" />
    </div>
  );
};

export default Tooltip;
