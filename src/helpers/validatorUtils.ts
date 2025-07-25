import { LocalChainRegistry, ValidatorLogoInfo } from '@/types';

export const getValidatorLogoUrl = (validatorDescription: { identity?: string }): string | null => {
  if (validatorDescription.identity) {
    return `https://keybase.io/_/api/1.0/user/lookup.json?key_suffix=${validatorDescription.identity}&fields=pictures`;
  }
  return null;
};

export const getFallbackValidatorLogo = (
  chainId: string,
  chainRegistry: LocalChainRegistry,
): string | null => {
  const chain = chainRegistry[chainId];
  return chain?.logo_uri || null;
};

export const getValidatorLogoInfo = async (
  validatorDescription: { identity?: string },
  chainId: string,
  chainRegistry: LocalChainRegistry,
): Promise<ValidatorLogoInfo> => {
  console.log('Getting logo info for:', validatorDescription);
  try {
    const logoUrl = getValidatorLogoUrl(validatorDescription);
    console.log('Initial logo URL:', logoUrl);

    if (logoUrl) {
      if (logoUrl.includes('keybase.io')) {
        console.log('Fetching Keybase logo...');
        try {
          const response = await fetch(logoUrl);
          if (!response.ok) {
            console.warn('Keybase request failed with status:', response.status);
            throw new Error('Keybase request failed');
          }

          const data = await response.json();
          console.log('Keybase response:', data);

          if (data?.them?.[0]?.pictures?.primary?.url) {
            return {
              url: data.them[0].pictures.primary.url,
              isFallback: false,
              error: false,
            };
          }
        } catch (error) {
          console.warn('Keybase logo fetch failed:', error);
        }
      } else {
        console.log('Using direct logo URL');
        return {
          url: logoUrl,
          isFallback: false,
          error: false,
        };
      }
    }

    console.log('Trying fallback chain logo...');
    const chainLogo = getFallbackValidatorLogo(chainId, chainRegistry);
    console.log('Fallback chain logo:', chainLogo);

    return {
      url: chainLogo,
      isFallback: true,
      error: chainLogo === null,
    };
  } catch (error) {
    console.error('Error in getValidatorLogoInfo:', error);
    return {
      url: null,
      isFallback: true,
      error: true,
    };
  }
};
