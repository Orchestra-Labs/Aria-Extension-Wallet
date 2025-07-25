import { useAtomValue } from 'jotai';

import { chainWalletAtom } from '@/atoms';

export const useWCAddress = (chainId: string) => {
  const { address } = useAtomValue(chainWalletAtom(chainId));

  const wcAddress = `cosmos:${chainId}:${address}`;

  return {
    address: wcAddress,
  };
};
