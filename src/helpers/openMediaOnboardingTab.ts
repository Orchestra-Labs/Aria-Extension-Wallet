import { ROUTES } from '@/constants';

import { getExtensionUrl } from './getExtensionUrl';

export const openMediaOnboardingTab = () => {
  const url = getExtensionUrl(ROUTES.APP.MEDIA_ONBOARDING);

  window.open(url, '_blank');
};
