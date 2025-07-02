import { useAtomValue } from 'jotai';
import { useGetBalances } from './useGetBalances';
import { useGetModuleAccountsQuery } from './useGetModuleAccountsQuery';
import { chainRegistryAtom } from '@/atoms';
import { DEFAULT_CHAIN_ID } from '@/constants';

const RESERVE_POOL_NAME = 'treasury';

export const useReservePoolBalance = () => {
  const chainRegistry = useAtomValue(chainRegistryAtom);
  const restUris = chainRegistry[DEFAULT_CHAIN_ID].rest_uris;

  const { data: moduleAccountsData, isLoading: moduleAccountsLoading } = useGetModuleAccountsQuery({
    restUris,
  });

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
