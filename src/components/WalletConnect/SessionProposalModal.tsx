import { useCallback, useMemo, useState } from 'react';
import { buildApprovedNamespaces, getSdkError } from '@walletconnect/utils';
import { SignClientTypes } from '@walletconnect/types';
import { web3wallet } from './walletConnectUtil';
import { COSMOS_MAINNET_CHAINS, COSMOS_SIGNING_METHODS } from './cosmosConnectionData';
import { getChainData } from './chainsUtil';
import { modalAtom } from './sessionProposalModalAtom';
import { useAtom, useAtomValue } from 'jotai';
import { walletAddressAtom } from '@/atoms';
import { useToast } from '@/hooks';

export default function SessionProposalModal() {
  const { toast } = useToast();

  // Get proposal data and wallet address from store
  const [modalState, setModalState] = useAtom(modalAtom);
  const walletAddress = useAtomValue(walletAddressAtom);
  const proposal = modalState?.data?.proposal as SignClientTypes.EventArguments['session_proposal'];
  const [isLoadingApprove, setIsLoadingApprove] = useState(false);
  const [isLoadingReject, setIsLoadingReject] = useState(false);

  const supportedNamespaces = useMemo(() => {
    // cosmos
    const cosmosChains = Object.keys(COSMOS_MAINNET_CHAINS);
    const cosmosMethods = Object.values(COSMOS_SIGNING_METHODS);

    return {
      cosmos: {
        chains: cosmosChains,
        methods: cosmosMethods,
        events: [],
        accounts: cosmosChains.map(chain => `${chain}:${walletAddress}`).flat(),
      },
    };
  }, []);

  const requestedChains = useMemo(() => {
    if (!proposal) return [];
    const required = [];
    for (const [key, values] of Object.entries(proposal.params.requiredNamespaces)) {
      const chains = key.includes(':') ? key : values.chains;
      required.push(chains);
    }

    const optional = [];
    for (const [key, values] of Object.entries(proposal.params.optionalNamespaces)) {
      const chains = key.includes(':') ? key : values.chains;
      optional.push(chains);
    }
    console.log('requestedChains', [...new Set([...required.flat(), ...optional.flat()])]);

    return [...new Set([...required.flat(), ...optional.flat()])];
  }, [proposal]);

  // the chains that are supported by the wallet from the proposal
  const supportedChains = useMemo(
    () =>
      requestedChains
        .map(chain => {
          const chainData = getChainData(chain!);

          if (!chainData) return null;

          return chainData;
        })
        .filter(chain => chain), // removes null values
    [requestedChains],
  );

  // get required chains that are not supported by the wallet
  const notSupportedChains = useMemo(() => {
    if (!proposal) return [];
    const required = [];
    for (const [key, values] of Object.entries(proposal.params.requiredNamespaces)) {
      const chains = key.includes(':') ? key : values.chains;
      required.push(chains);
    }

    return required
      .flat()
      .filter(
        chain =>
          !supportedChains
            .map(supportedChain => `${supportedChain?.namespace}:${supportedChain?.chainId}`)
            .includes(chain!),
      );
  }, [proposal, supportedChains]);
  console.log('notSupportedChains', { notSupportedChains, supportedChains });

  const namespaces = useMemo(() => {
    try {
      // the builder throws an exception if required namespaces are not supported
      return buildApprovedNamespaces({
        proposal: proposal.params,
        supportedNamespaces,
      });
    } catch (e) {}
  }, [proposal.params, supportedNamespaces]);

  // Hanlde approve action, construct session namespace
  const onApprove = useCallback(async () => {
    if (proposal && namespaces) {
      setIsLoadingApprove(true);
      try {
        await web3wallet.approveSession({
          id: proposal.id,
          namespaces,
        });
      } catch (e) {
        setIsLoadingApprove(false);
        toast({
          title: 'Error!',
          description: (e as Error).message,
          duration: 5000,
        });
        return;
      }
    }

    setIsLoadingApprove(false);
    setModalState({ ...modalState, open: false });
  }, [namespaces, proposal]);

  // Handle reject action
  const onReject = useCallback(async () => {
    if (proposal) {
      try {
        setIsLoadingReject(true);
        await new Promise(resolve => setTimeout(resolve, 1000));
        await web3wallet.rejectSession({
          id: proposal.id,
          reason: getSdkError('USER_REJECTED_METHODS'),
        });
      } catch (e) {
        setIsLoadingReject(false);
        toast({
          title: 'Error!',
          description: (e as Error).message,
          duration: 5000,
        });
        return;
      }
    }
    setIsLoadingReject(false);
    setModalState({ ...modalState, open: false });
  }, [proposal]);
  console.log('notSupportedChains', notSupportedChains);

  return (
    <div className="max-w-lg p-6 bg-background-dialog-bg rounded-md shadow-lg mx-auto text-white font-sans">
      <h2 className="text-h3 font-semibold mb-4">Requested Permissions</h2>
      <div className="space-y-3">
        <div className="flex items-center gap-2">
          <span className="text-success text-xl">✔</span>
          <span>View your balance and activity</span>
        </div>
        <div className="flex items-center gap-2">
          <span className="text-success text-xl">✔</span>
          <span>Send approval requests</span>
        </div>
        <div className="flex items-center gap-2 text-grey-dark">
          <span className="text-grey-dark text-xl">✖</span>
          <span>Move funds without permission</span>
        </div>
      </div>

      <div className="mt-6">
        <h4 className="text-h5 font-medium mb-2">Accounts</h4>
        <div className="space-y-1">
          {supportedNamespaces.cosmos.accounts.map((account, index) => (
            <div key={index} className="text-sm text-grey">
              {account}
            </div>
          ))}
        </div>
      </div>

      <div className="mt-6">
        <h4 className="text-h5 font-medium mb-2">Chains</h4>
        <div className="space-y-1">
          {supportedNamespaces.cosmos.chains.map((chain, index) => (
            <div key={index} className="text-sm text-grey">
              {chain}
            </div>
          ))}
        </div>
      </div>

      <div className="flex justify-between mt-8">
        <button
          onClick={onApprove}
          className="bg-success hover:bg-success-dark text-black font-medium py-2 px-4 rounded"
          disabled={isLoadingApprove}
        >
          {isLoadingApprove ? 'Approving...' : 'Approve'}
        </button>
        <button
          onClick={onReject}
          className="bg-error hover:bg-error-dark text-black font-medium py-2 px-4 rounded"
          disabled={isLoadingReject}
        >
          {isLoadingReject ? 'Rejecting...' : 'Reject'}
        </button>
      </div>
    </div>
  );
}
