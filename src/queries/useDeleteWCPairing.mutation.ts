import { useMutation, UseMutationOptions, useQueryClient } from '@tanstack/react-query';
import { getSdkError } from '@walletconnect/utils';

import { walletkit } from '@/helpers';
import { GetWCPairingsResponse } from '@/queries';

type Params = {
  pairing: GetWCPairingsResponse[number];
};

export const deleteWCPairing = async ({ pairing: { topic } }: Params) => {
  await walletkit.disconnectSession({
    topic,
    reason: getSdkError('USER_DISCONNECTED'),
  });
};

export const useDeleteWCPairingMutation = (
  options?: UseMutationOptions<void, Error, Params, unknown>,
) => {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: deleteWCPairing,
    onSuccess: () => {
      queryClient.invalidateQueries({
        queryKey: ['wc-pairings'],
      });
    },
    ...options,
  });
};
