import { useGetBalances } from './useGetBalances';
import { useGetModuleAccountsQuery } from './useGetModuleAccountsQuery';

const RESERVE_POOL_NAME = 'treasury';

export const useReservePoolBalance = () => {
  const { data: moduleAccountsData, isLoading: moduleAccountsLoading } =
    useGetModuleAccountsQuery();

  const reservePoolAccount = moduleAccountsData?.accounts.find(
    account => account.name === RESERVE_POOL_NAME,
  );

  const reservePoolAccountAddress = reservePoolAccount?.base_account.address;

  const { balances, isLoading: loadingBalances } = useGetBalances({
    walletAddress: reservePoolAccountAddress,
  });

  const isLoading = moduleAccountsLoading || loadingBalances;

  return {
    balance: balances?.[0],
    isLoading,
  };
};
