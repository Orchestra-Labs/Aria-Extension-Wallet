import { WINDOW_SIZE } from '@/constants/default';

export const openExtensionWindow = (url: string) => {
  if ('chrome' in window) {
    window.chrome.windows.create({
      url: url,
      type: 'popup',
      width: WINDOW_SIZE.width,
      height: WINDOW_SIZE.height,
    });
  }
  if ('browser' in window) {
    window.browser?.windows.create({
      url: url,
      type: 'popup',
      width: WINDOW_SIZE.width,
      height: WINDOW_SIZE.height,
    });
  }
};
