import { NetworkLevel } from '@/constants';

export const getValidatorLogoUrl = (validatorDescription: { identity?: string }): string | null => {
  // Use identity hash (common in Cosmos chains)
  if (validatorDescription.identity) {
    return `https://keybase.io/_/api/1.0/user/lookup.json?key_suffix=${validatorDescription.identity}&fields=pictures`;
  }

  return null;
};

export const getFallbackValidatorLogo = (chainId: string, chainRegistry: any): string | null => {
  const chain =
    chainRegistry[NetworkLevel.MAINNET][chainId] || chainRegistry[NetworkLevel.TESTNET][chainId];

  return chain?.logo_uri || null;
};
