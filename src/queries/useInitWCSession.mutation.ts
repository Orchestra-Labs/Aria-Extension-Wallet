import { useMutation, UseMutationOptions } from '@tanstack/react-query';
import { parseUri } from '@walletconnect/utils';

import { walletkit } from '@/helpers';

type Params = {
  uri: string;
  onPairingExpired?: () => void;
};

export const initWCSession = async ({ uri, onPairingExpired }: Params) => {
  const { topic: pairingTopic } = parseUri(uri);
  const pairingExpiredListener = ({ topic }: { topic: string }) => {
    if (pairingTopic === topic) {
      onPairingExpired?.();
      walletkit.core.pairing.events.removeListener('pairing_expire', pairingExpiredListener);
    }
  };
  walletkit.once('session_proposal', () => {
    walletkit.core.pairing.events.removeListener('pairing_expire', pairingExpiredListener);
  });

  walletkit.core.pairing.events.on('pairing_expire', pairingExpiredListener);
  await walletkit.pair({ uri });
};

export const useInitWCSessionMutation = (
  options?: UseMutationOptions<void, Error, Params, unknown>,
) => {
  return useMutation({
    mutationFn: initWCSession,
    ...options,
  });
};
