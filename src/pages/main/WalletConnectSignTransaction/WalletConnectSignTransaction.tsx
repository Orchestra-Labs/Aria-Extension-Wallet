'use dom';

import { SignClientTypes } from '@walletconnect/types';
import React from 'react';
import { useNavigate } from 'react-router-dom';

import { Header, WCProposalButtons } from '@/components';
import { WCProposalMetadata } from '@/components';
import { ROUTES } from '@/constants';
import { COSMOS_CHAINS } from '@/constants/wc';
import { sleep } from '@/helpers';
import { walletkit } from '@/helpers/walletConnect';
import { useToast } from '@/hooks';
import { useApproveWCTransactionMutation, useRejectWCTransactionMutation } from '@/queries';
import { Accordion, AccordionContent, AccordionItem, AccordionTrigger } from '@/ui-kit';

const PAGE_TITLE = 'Approve Transaction';

export const WalletConnectSignTransaction: React.FC = () => {
  const searchParams = new URLSearchParams(window.location.search);
  const requestEvent: SignClientTypes.EventArguments['session_request'] = JSON.parse(
    searchParams.get('requestEvent') ?? '',
  );

  const { verifyContext } = requestEvent;

  const signDoc: object | undefined = requestEvent.params.request.params?.signDoc;

  const { topic, params } = requestEvent;
  const { chainId } = params;

  const chainIds = [chainId];

  const chains = new Intl.ListFormat('en', {
    style: 'long',
    type: 'conjunction',
  }).format(
    chainIds.map(
      chainId => COSMOS_CHAINS?.[chainId as keyof typeof COSMOS_CHAINS]?.name ?? chainId,
    ) ?? [],
  );

  const requestSession = walletkit.engine.signClient.session.get(topic);

  const metadata = requestSession.peer.metadata;

  const { toast } = useToast();
  const navigate = useNavigate();

  const closeScreen = () => {
    navigate({ pathname: ROUTES.APP.ROOT, search: '' });
    window.location.search = '';
  };

  const { mutate: approveWCTransaction, isPending: approvingTransaction } =
    useApproveWCTransactionMutation();
  const { mutate: rejectWCTransaction, isPending: rejectingTransaction } =
    useRejectWCTransactionMutation();

  const onApprove = async () => {
    approveWCTransaction(
      {
        requestEvent,
      },
      {
        onError: error => {
          toast({
            title: 'Error approving',
            description: error.message ?? 'Something went wrong.',
            duration: 5000,
          });
        },
        onSuccess: () => {
          closeScreen();
        },
      },
    );
  };

  const onReject = async () => {
    rejectWCTransaction(
      { requestEvent },
      {
        onError: async error => {
          toast({
            title: 'Error rejecting',
            description: error.message ?? 'Something went wrong.',
            duration: 5000,
          });
          await sleep(5000);
          closeScreen();
        },
        onSuccess: () => {
          closeScreen();
        },
      },
    );
  };

  const onCloseClick = () => {
    onReject();
    closeScreen();
  };

  const { name } = metadata;

  const disabled = approvingTransaction || rejectingTransaction;

  return (
    <div className="h-full flex flex-col overflow-y-auto bg-black text-white">
      <Header title={PAGE_TITLE} onClose={onCloseClick} />

      <div className="p-8 mt-4 h-full overflow-y-auto flex flex-grow flex-col justify-center">
        <WCProposalMetadata metadata={metadata} verifyContext={verifyContext}>
          <div className="text-xl my-5 font-medium">
            {name} wants you to sign transaction on {chains}
          </div>
        </WCProposalMetadata>
        {signDoc && (
          <div>
            <Accordion type="single" collapsible>
              <AccordionItem value="item-1">
                <AccordionTrigger>Data</AccordionTrigger>
                <AccordionContent>
                  <pre className="max-w-full text-left overflow-auto select-none">
                    {JSON.stringify(signDoc, null, 2)}
                  </pre>
                </AccordionContent>
              </AccordionItem>
            </Accordion>
          </div>
        )}
      </div>

      <WCProposalButtons disabled={disabled} onApprove={onApprove} onReject={onReject} />
    </div>
  );
};
