self.window = self;

import { closeAllExtensionPopups } from '@/helpers/closeAllExtensionPopups';
import { getExtensionUrl } from '@/helpers/getExtensionUrl';
import { openExtensionWindow } from '@/helpers/openExtensionWindow';

// todo use 'browser' instead of 'chrome'
chrome?.runtime?.onMessage?.addListener(async (m: unknown) => {
  const message = m as { action?: string; data?: object };
  const url = (message?.data as { url?: string })?.url;

  switch (message.action) {
    case 'open_extension':
      await closeAllExtensionPopups();
      return openExtensionWindow(url ?? getExtensionUrl().href);
    default:
      console.error('Unknown action:', (m as { action: string }).action);
      return;
  }
});
