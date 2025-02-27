import { useGetBalances } from './useGetBalances';
import { useGetModuleAccountsQuery } from './useGetModuleAccountsQuery';

const EXCHANGE_POOL_NAME = 'market';

export const useExchangePoolBalance = () => {
  const { data: moduleAccountsData, isLoading: moduleAccountsLoading } =
    useGetModuleAccountsQuery();

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
