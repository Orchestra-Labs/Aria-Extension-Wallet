import { useAtomValue } from 'jotai';
import { useGetBalances } from './useGetBalances';
import { useGetModuleAccountsQuery } from './useGetModuleAccountsQuery';
import { chainRegistryAtom } from '@/atoms';
import { DEFAULT_CHAIN_ID } from '@/constants';

const EXCHANGE_POOL_NAME = 'market';

export const useExchangePoolBalance = () => {
  const chainRegistry = useAtomValue(chainRegistryAtom);
  const restUris = chainRegistry[DEFAULT_CHAIN_ID].rest_uris;

  const { data: moduleAccountsData, isLoading: moduleAccountsLoading } = useGetModuleAccountsQuery({
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
