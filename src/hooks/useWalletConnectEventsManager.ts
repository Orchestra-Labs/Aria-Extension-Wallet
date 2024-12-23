import { COSMOS_SIGNING_METHODS } from '@/data/COSMOSData';
import ModalStore from '@/store/ModalStore';
import SettingsStore from '@/store/SettingsStore';
import { walletkit } from '@/utils/WalletConnectUtil';
import { SignClientTypes } from '@walletconnect/types';
import { useCallback, useEffect, useMemo } from 'react';
import { approveNearRequest } from '@/utils/NearRequestHandlerUtil';
import { formatJsonRpcError } from '@json-rpc-tools/utils';
import { approveEIP5792Request } from '@/utils/EIP5792RequestHandlerUtils';
import EIP155Lib from '@/lib/EIP155Lib';
import { getWallet } from '@/utils/EIP155WalletUtil';
import { refreshSessionsList } from '@/pages/wc';

export default function useWalletConnectEventsManager(initialized: boolean) {
  /******************************************************************************
   * 1. Open session proposal modal for confirmation / rejection
   *****************************************************************************/
  const onSessionProposal = useCallback(
    (proposal: SignClientTypes.EventArguments['session_proposal']) => {
      console.log('session_proposal', proposal);
      // set the verify context so it can be displayed in the projectInfoCard
      SettingsStore.setCurrentRequestVerifyContext(proposal.verifyContext);
      ModalStore.open('SessionProposalModal', { proposal });
    },
    [],
  );

  /******************************************************************************
   * 3. Open request handling modal based on method that was used
   *****************************************************************************/
  const onSessionRequest = useCallback(
    async (requestEvent: SignClientTypes.EventArguments['session_request']) => {
      const { topic, params, verifyContext, id } = requestEvent;
      const { request } = params;
      const requestSession = walletkit.engine.signClient.session.get(topic);
      // set the verify context so it can be displayed in the projectInfoCard
      SettingsStore.setCurrentRequestVerifyContext(verifyContext);
      switch (request.method) {
        case COSMOS_SIGNING_METHODS.COSMOS_SIGN_DIRECT:
        case COSMOS_SIGNING_METHODS.COSMOS_SIGN_AMINO:
          return ModalStore.open('SessionSignCosmosModal', { requestEvent, requestSession });
        default:
          return ModalStore.open('SessionUnsuportedMethodModal', { requestEvent, requestSession });
      }
    },
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [],
  );

  const onSessionAuthenticate = useCallback(
    (authRequest: SignClientTypes.EventArguments['session_authenticate']) => {
      ModalStore.open('SessionAuthenticateModal', { authRequest });
    },
    [],
  );

  /******************************************************************************
   * Set up WalletConnect event listeners
   *****************************************************************************/
  useEffect(() => {
    if (initialized && walletkit) {
      //sign
      walletkit.on('session_proposal', onSessionProposal);
      walletkit.on('session_request', onSessionRequest);
      // TODOs
      walletkit.engine.signClient.events.on('session_ping', data => console.log('ping', data));
      walletkit.on('session_delete', data => {
        console.log('session_delete event received', data);
        refreshSessionsList();
      });
      walletkit.on('session_authenticate', onSessionAuthenticate);
      // load sessions on init
      refreshSessionsList();
    }
  }, [initialized, onSessionAuthenticate, onSessionProposal, onSessionRequest]);
}
