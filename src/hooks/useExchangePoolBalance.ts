import { useAtomValue } from 'jotai';
import { useGetBalances } from './useGetBalances';
import { useGetModuleAccountsQuery } from './useGetModuleAccountsQuery';
import { subscribedChainRegistryAtom } from '@/atoms';
import { SYMPHONY_MAINNET_ID } from '@/constants';

const EXCHANGE_POOL_NAME = 'market';

// TODO: if not subscribed to Symphony, do not show reserve pool or reserve button
export const useExchangePoolBalance = () => {
  const chainRegistry = useAtomValue(subscribedChainRegistryAtom);

  const chain = chainRegistry.mainnet[SYMPHONY_MAINNET_ID];
  const prefix = chain.bech32_prefix;
  const restUris = chain.rest_uris;

  const { data: moduleAccountsData, isLoading: moduleAccountsLoading } = useGetModuleAccountsQuery({
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
