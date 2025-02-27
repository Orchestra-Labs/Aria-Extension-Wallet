import { RequestParams, useGetBalancesQuery } from './useGetBalancesQuery';

export function useGetBalances(params: Partial<RequestParams>) {
  const { data, error, isLoading } = useGetBalancesQuery(
    {
      walletAddress: params.walletAddress!,
    },
    {
      enabled: !!params.walletAddress,
    },
  );

  const balances = data?.balances;

  return {
    balances,
    error,
    isLoading,
  };
}
