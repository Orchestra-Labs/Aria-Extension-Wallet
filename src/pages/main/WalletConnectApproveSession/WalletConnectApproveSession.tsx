'use dom';

import { SignClientTypes } from '@walletconnect/types';
import React from 'react';
import { useNavigate } from 'react-router-dom';

import { Header, WCProposalButtons, WCProposalMetadata } from '@/components';
import { ROUTES } from '@/constants';
import { closeAllExtensionPopups } from '@/helpers';
import { useSupportedWCNamespaces, useToast } from '@/hooks';
import { useApproveWCSessionMutation, useRejectWCSessionMutation } from '@/queries';
import { useAtomValue } from 'jotai';
import { chainInfoAtom } from '@/atoms';

const PAGE_TITLE = 'Requesting Connection';

export const WalletConnectApproveSession: React.FC = () => {
  const searchParams = new URLSearchParams(window.location.search);
  const proposal: SignClientTypes.EventArguments['session_proposal'] = JSON.parse(
    searchParams.get('proposal') ?? '',
  );

  const { metadata } = proposal.params.proposer;
  const navigate = useNavigate();
  const { toast } = useToast();
  const { supportedNamespaces } = useSupportedWCNamespaces();
  const { mutate: approveWCSession, isPending: approvingWCSession } = useApproveWCSessionMutation();

  const getChainInfo = useAtomValue(chainInfoAtom);

  const chainIds: string[] =
    Object.values(proposal.params.requiredNamespaces).flatMap(
      ({ chains }) => chains?.map(chain => chain.replace('cosmos:', '')) ?? [],
    ) ?? [];

  const chains = chainIds
    .map(chainId => {
      const info = getChainInfo(chainId);
      return info?.pretty_name ?? chainId;
    })
    .join(', ');

  const { verifyContext } = proposal;

  const closeScreen = () => {
    navigate({ pathname: ROUTES.APP.ROOT, search: '' });
    window.location.search = '';
    return closeAllExtensionPopups();
  };

  const onApprove = () => {
    approveWCSession(
      {
        supportedNamespaces,
        proposal,
      },
      {
        onError: async e => {
          toast({
            title: 'Error Approving Session',
            description: (e as Error)?.message ?? 'Something went wrong.',
            duration: 5000,
          });
        },
        onSuccess: async () => {
          await closeScreen();
        },
      },
    );
  };

  const { mutate: rejectWCSession, isPending: rejectingWCSession } = useRejectWCSessionMutation();

  const onReject = () => {
    rejectWCSession(
      { proposal },
      {
        onError: async e => {
          toast({
            title: 'Error Rejecting Session',
            description: (e as Error)?.message,
          });
        },
        onSuccess: async () => {
          await closeScreen();
        },
      },
    );
  };

  const onCloseClick = async () => {
    onReject();
    await closeScreen();
  };

  const { name } = metadata;
  const disabled = approvingWCSession || rejectingWCSession;

  return (
    <div className="h-screen flex flex-col overflow-hidden bg-black text-white">
      <Header title={PAGE_TITLE} onClose={onCloseClick} />

      <div className="p-8 mt-4 h-full flex flex-grow flex-col justify-center">
        <WCProposalMetadata metadata={metadata} verifyContext={verifyContext}>
          <div className="text-xl my-5 font-medium">
            {name} is requesting to connect to your account on {chains}
          </div>
        </WCProposalMetadata>
      </div>
      <WCProposalButtons disabled={disabled} onApprove={onApprove} onReject={onReject} />
    </div>
  );
};
