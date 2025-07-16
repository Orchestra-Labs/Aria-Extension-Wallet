import React, { useState } from 'react';

import { Copy, VerifySuccess } from '@/assets/icons';
import { ICON_CHANGEOVER_TIMEOUT } from '@/constants';
import { Button } from '@/ui-kit';

interface CopyTextFieldProps {
  variant?: 'transparent' | 'text';
  displayText: string;
  copyText?: string;
  iconHeight?: number;
  includeMargin?: boolean;
}

export const CopyTextField: React.FC<CopyTextFieldProps> = ({
  variant = 'transparent',
  displayText,
  copyText,
  iconHeight = 20,
  includeMargin = true,
}) => {
  const [copied, setCopied] = useState(false);

  const handleCopyToClipboard = () => {
    // Use `copyText` if provided, otherwise use `displayText`
    navigator.clipboard.writeText(copyText || displayText);
    setCopied(true);
    // Reset after the icon changeover timeout
    setTimeout(() => setCopied(false), ICON_CHANGEOVER_TIMEOUT);
  };

  switch (variant) {
    case 'text': {
      return (
        <Button variant="transparent" size="small" onClick={handleCopyToClipboard}>
          <div className="flex items-center space-x-2">
            {copied ? (
              <VerifySuccess width={iconHeight} className="text-success animate-scale-up" />
            ) : (
              <Copy width={iconHeight} />
            )}
            <span className="ml-2.5 text-base">{displayText}</span>
          </div>
        </Button>
      );
    }
    default: {
      // TODO: click to claim in balance card widens drastically.  find out why and fix
      return (
        <Button
          variant="transparentNeutral"
          size="small"
          onClick={handleCopyToClipboard}
          className={includeMargin ? 'mt-3' : ''}
        >
          <div className="flex items-center space-x-2 px-2 rounded-full border border-neutral-2">
            {copied ? (
              <VerifySuccess width={iconHeight} className="text-success animate-scale-up" />
            ) : (
              <Copy width={iconHeight} />
            )}
            <span className="text-sm ml-2.5">{displayText}</span>
          </div>
        </Button>
      );
    }
  }
};
