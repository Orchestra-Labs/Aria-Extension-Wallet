import { SignClientTypes } from '@walletconnect/types';
import { buildApprovedNamespaces } from '@walletconnect/utils';
import { useCallback, useEffect } from 'react';
import { useLocation, useNavigate } from 'react-router-dom';

import { COSMOS_SIGNING_METHODS, ROUTES } from '@/constants';
import { walletkit } from '@/helpers';
import { useApproveWCTransactionMutation } from '@/queries';

import { useSupportedWCNamespaces } from './useSupportedWCNamespaces';
import { useToast } from './useToast';
import { useAtomValue } from 'jotai';
import { chainInfoAtom } from '@/atoms';

type Params = { initialized: boolean };

export const useWalletConnectEventsManager = ({ initialized }: Params) => {
  const { mutate: approveWCTransaction } = useApproveWCTransactionMutation({
    retry: 3,
  });
  const { supportedNamespaces } = useSupportedWCNamespaces();
  const { toast } = useToast();
  const location = useLocation();
  const navigate = useNavigate();

  const getChainInfo = useAtomValue(chainInfoAtom);

  const { pathname } = location;

  /******************************************************************************
   * 1. Open session proposal modal
   *****************************************************************************/
  const onSessionProposal = useCallback(
    async (proposal: SignClientTypes.EventArguments['session_proposal']) => {
      try {
        // if succeeds, we can approve session
        buildApprovedNamespaces({
          proposal: proposal.params,
          supportedNamespaces,
        });
        navigate(ROUTES.APP.WALLET_CONNECT.APPROVE_SESSION);
        window.location.search = new URLSearchParams({
          proposal: JSON.stringify(proposal),
        }).toString();
      } catch (e) {
        toast({
          title: 'Requested connection is not supported',
          duration: 5000,
        });
      }
    },
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [supportedNamespaces],
  );

  /******************************************************************************
   * 3. Open request handling modal based on method that was used
   *****************************************************************************/
  const onSessionRequest = useCallback(
    async (requestEvent: SignClientTypes.EventArguments['session_request']) => {
      if (pathname === ROUTES.APP.WALLET_CONNECT.SIGN_TRANSACTION) return;

      const { params } = requestEvent;
      const { request, chainId } = params;

      const chainInfo = getChainInfo(chainId);
      if (!chainInfo) {
        toast({
          title: 'Unsupported Chain',
          description: `Chain ${chainId} is not supported`,
          duration: 5000,
        });
        return;
      }

      switch (request.method) {
        case COSMOS_SIGNING_METHODS.COSMOS_SIGN_DIRECT:
        case COSMOS_SIGNING_METHODS.COSMOS_SIGN_AMINO:
          navigate(ROUTES.APP.WALLET_CONNECT.SIGN_TRANSACTION);
          window.location.search = new URLSearchParams({
            requestEvent: JSON.stringify(requestEvent),
          }).toString();
          return;
        case COSMOS_SIGNING_METHODS.COSMOS_GET_ACCOUNTS:
          return approveWCTransaction({
            requestEvent,
          });
        default:
          toast({
            title: 'Cannot process request',
            description: `Method ${request.method} is not supported`,
            duration: 5000,
          });
          return;
      }
    },
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [pathname],
  );

  /******************************************************************************
   * Set up WalletConnect event listeners
   *****************************************************************************/
  useEffect(() => {
    if (!initialized || !walletkit) return;
    walletkit.on('session_proposal', onSessionProposal);
    walletkit.on('session_request', onSessionRequest);

    return () => {
      walletkit.off('session_request', onSessionRequest);
      walletkit.off('session_proposal', onSessionProposal);
    };
  }, [initialized, onSessionProposal, onSessionRequest]);
};
