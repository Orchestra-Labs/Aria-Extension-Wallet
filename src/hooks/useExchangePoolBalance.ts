import { useAtomValue } from 'jotai';
import { useGetBalances } from './useGetBalances';
import { useGetModuleAccountsQuery } from './useGetModuleAccountsQuery';
import { chainInfoAtom, networkLevelAtom } from '@/atoms';
import { getSymphonyChainId } from '@/helpers';

const EXCHANGE_POOL_NAME = 'market';

export const useExchangePoolBalance = () => {
  const networkLevel = useAtomValue(networkLevelAtom);
  const getChainInfo = useAtomValue(chainInfoAtom);

  const symphonyChainId = getSymphonyChainId(networkLevel);
  const chain = getChainInfo(symphonyChainId);

  const prefix = chain.bech32_prefix;
  const restUris = chain.rest_uris;

  const { data: moduleAccountsData, isLoading: moduleAccountsLoading } = useGetModuleAccountsQuery({
    chainId: symphonyChainId,
    prefix,
    restUris,
  });

  const exchangePoolAccount = moduleAccountsData?.accounts.find(
    account => account.name === EXCHANGE_POOL_NAME,
  );

  const exchangePoolAccountAddress = exchangePoolAccount?.base_account.address;

  const { balances, isLoading: loadingBalances } = useGetBalances({
    walletAddress: exchangePoolAccountAddress,
  });

  const isLoading = moduleAccountsLoading || loadingBalances;

  return {
    balance: balances?.[0],
    isLoading,
  };
};
