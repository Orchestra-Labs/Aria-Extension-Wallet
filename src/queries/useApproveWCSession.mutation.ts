import { useMutation, UseMutationOptions } from '@tanstack/react-query';
import { SignClientTypes } from '@walletconnect/types';
import { buildApprovedNamespaces, BuildApprovedNamespacesParams } from '@walletconnect/utils';

import { walletkit } from '@/helpers';

type Params = {
  supportedNamespaces: BuildApprovedNamespacesParams['supportedNamespaces'];
  proposal: SignClientTypes.EventArguments['session_proposal'];
};

const approveWCSession = async ({ supportedNamespaces, proposal }: Params) => {
  const namespaces = buildApprovedNamespaces({
    proposal: proposal.params,
    supportedNamespaces,
  });
  if (!proposal || !namespaces) throw new Error('Invalid proposal');
  await walletkit.approveSession({
    id: proposal.id,
    namespaces,
  });
};

export const useApproveWCSessionMutation = (
  options?: UseMutationOptions<void, Error, Params, unknown>,
) => {
  return useMutation({
    mutationFn: approveWCSession,
    ...options,
  });
};
