import { ROUTES } from '@/constants/routes';
import { getExtensionUrl } from '@/helpers/getExtensionUrl';

const runtime = window.chrome?.runtime;

const injectInPageScript = (path: string) => {
  const container = document.head || document.documentElement;
  const scriptElement = document.createElement('script');

  const url = runtime.getURL(path);

  if (!url) return console.error('Failed to get URL for path:', path);

  scriptElement.src = url;

  scriptElement.type = 'text/javascript';
  container.insertBefore(scriptElement, container.children[0]);
  scriptElement.remove();
};
injectInPageScript('/injected-script.js');

window.addEventListener('message', event => {
  const initSessionUrl = getExtensionUrl(ROUTES.APP.WALLET_CONNECT.INIT_SESSION);
  initSessionUrl.searchParams.append('uri', event?.data?.data?.uri);
  const openExtensionUrl = getExtensionUrl(event?.data?.data?.pathname);

  switch (event.data.action) {
    case 'connect':
      runtime?.sendMessage({ action: 'open_extension', data: { url: initSessionUrl.toString() } });
      break;
    case 'open_extension':
      runtime?.sendMessage({
        action: 'open_extension',
        data: { url: openExtensionUrl.toString() },
      });
      break;
    default:
      break;
  }
});
