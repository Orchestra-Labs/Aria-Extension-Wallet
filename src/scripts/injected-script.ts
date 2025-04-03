import { ROUTES } from '@/constants';
import type { InjectedAria } from '@/types/injected-aria';

const aria: InjectedAria = {
  connect: async (uri: string) => {
    window.postMessage({ action: 'connect', data: { uri } }, '*');
    return;
  },
  openExtension: async (pathname?: string) => {
    window.postMessage({ action: 'open_extension', data: { pathname } }, '*');
    return;
  },
  signTransaction: async () => {
    window.postMessage(
      { action: 'open_extension', data: { pathname: ROUTES.APP.WALLET_CONNECT.LOADER } },
      '*',
    );
    return;
  },
};

Object.defineProperty(window, 'aria', {
  value: aria,
});
