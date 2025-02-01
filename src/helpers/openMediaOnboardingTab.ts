import { ROUTES } from '@/constants';

export const openMediaOnboardingTab = () => {
  const extensionURL = (() => {
    if ('chrome' in window) {
      return (window.chrome as any)?.runtime.getURL('index.html');
    }
    if ('browser' in window) {
      return (window.browser as any)?.runtime.getURL('index.html');
    }
    if ('safari' in window) {
      return (window.safari as any)?.extension.baseURI;
    }
    return window.location.origin;
  })();

  const url = new URL('/index.html', extensionURL);

  url.hash = ROUTES.APP.MEDIA_ONBOARDING;

  window.open(url, '_blank');
};
