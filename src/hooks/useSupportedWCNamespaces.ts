import { useMemo } from 'react';

import { COSMOS_SIGNING_METHODS } from '@/constants';
import { formatChainIdForWC } from '@/helpers';
import { useAtomValue } from 'jotai';
import { networkLevelAtom, subscribedChainRegistryAtom, walletAddressesAtom } from '@/atoms';

export const useSupportedWCNamespaces = () => {
  const registry = useAtomValue(subscribedChainRegistryAtom);
  const networkLevel = useAtomValue(networkLevelAtom);
  const walletAddresses = useAtomValue(walletAddressesAtom);

  const supportedNamespaces = useMemo(() => {
    // Get all chains from the registry for current network level
    const chains = registry[networkLevel];
    const chainIds = Object.keys(chains);

    const cosmosMethods = Object.values(COSMOS_SIGNING_METHODS);

    // Format chain IDs for WalletConnect (cosmos:chain-id)
    const wcChainIds = chainIds.map(id => formatChainIdForWC(id));

    // Create accounts array with walletconnect format (cosmos:chain-id:address)
    const accounts = chainIds
      .map(chainId => {
        const address = walletAddresses[chainId];
        return address ? `${formatChainIdForWC(chainId)}:${address}` : null;
      })
      .filter(Boolean) as string[];

    return {
      cosmos: {
        chains: wcChainIds,
        methods: cosmosMethods,
        events: ['accountsChanged', 'chainChanged'],
        accounts,
      },
    };
  }, [registry, networkLevel, walletAddresses]);

  return { supportedNamespaces };
};
