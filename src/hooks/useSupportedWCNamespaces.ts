import { useMemo } from 'react';

import { COSMOS_CHAINS, COSMOS_SIGNING_METHODS } from '@/constants/wc';

import { useWCAddress } from './useWCAddress';

export const useSupportedWCNamespaces = () => {
  const { address } = useWCAddress();

  const supportedNamespaces = useMemo(() => {
    const cosmosChains = Object.keys(COSMOS_CHAINS);
    const cosmosMethods = Object.values(COSMOS_SIGNING_METHODS);
    return {
      cosmos: {
        chains: cosmosChains,
        methods: cosmosMethods,
        events: ['accountsChanged', 'chainChanged'],
        accounts: [address],
      },
    };
  }, [address]);

  return { supportedNamespaces };
};
