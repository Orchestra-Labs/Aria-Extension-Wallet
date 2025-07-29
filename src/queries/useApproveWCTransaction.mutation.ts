/* eslint-disable no-case-declarations */
import { formatJsonRpcResult } from '@json-rpc-tools/utils';
import { useMutation, UseMutationOptions } from '@tanstack/react-query';
import { SignClientTypes } from '@walletconnect/types';
import { getSdkError } from '@walletconnect/utils';
import { Buffer } from 'buffer';
import Long from 'long';

import { COSMOS_SIGNING_METHODS } from '@/constants/wc';
import {
  createAminoSignerByPrefix,
  createOfflineSignerByPrefix,
  getSessionToken,
  walletkit,
} from '@/helpers';
import { useAtomValue } from 'jotai';
import { chainInfoAtom } from '@/atoms';

const bufferFromBase64 = (base64: string) => Buffer.from(base64, 'base64');
const base64FromUint8Array = (array: Uint8Array) => Buffer.from(array).toString('base64');

type Params = {
  requestEvent: SignClientTypes.EventArguments['session_request'];
};

const approveWCTransaction = async ({ requestEvent }: Params) => {
  const getChainInfo = useAtomValue(chainInfoAtom);

  const { id, params, topic } = requestEvent;
  const { request, chainId } = params;

  const sessionToken = getSessionToken();
  if (!sessionToken) {
    throw new Error(getSdkError('USER_DISCONNECTED').message);
  }

  const chain = getChainInfo(chainId);
  if (!chain) {
    throw getSdkError('UNSUPPORTED_CHAINS', `Chain ${chainId} not supported`);
  }

  const signerPrefix = chain.bech32_prefix;
  const directSigner = await createOfflineSignerByPrefix(sessionToken.mnemonic, signerPrefix);
  const aminoSigner = await createAminoSignerByPrefix(sessionToken.mnemonic, signerPrefix);

  const signTransaction = async () => {
    const accounts = await directSigner.getAccounts();
    const response = accounts.map(account => {
      const pubkeyBuffer = Buffer.from(account.pubkey);
      return {
        address: account.address,
        algo: account.algo ?? 'secp256k1',
        pubkey: pubkeyBuffer,
      };
    });

    switch (request.method) {
      case COSMOS_SIGNING_METHODS.COSMOS_SIGN_DIRECT:
        const signDoc = request.params.signDoc;
        const signedDirect = await directSigner.signDirect(request.params.signerAddress, {
          bodyBytes: bufferFromBase64(signDoc.bodyBytes) as unknown as Uint8Array,
          authInfoBytes: bufferFromBase64(signDoc.authInfoBytes) as unknown as Uint8Array,
          chainId: signDoc.chainId,
          accountNumber: Long.fromString(signDoc.accountNumber) as unknown as bigint,
        });

        const result = {
          signature: signedDirect.signature,
          signed: {
            bodyBytes: base64FromUint8Array(signedDirect.signed.bodyBytes),
            authInfoBytes: base64FromUint8Array(signedDirect.signed.authInfoBytes),
            chainId: signedDirect.signed.chainId,
            accountNumber: signedDirect.signed.accountNumber.toString(),
          },
        };

        return formatJsonRpcResult(id, result);

      case COSMOS_SIGNING_METHODS.COSMOS_SIGN_AMINO:
        const signedAmino = await aminoSigner.signAmino(
          request.params.signerAddress,
          request.params.signDoc,
        );
        return formatJsonRpcResult(id, signedAmino);

      case COSMOS_SIGNING_METHODS.COSMOS_GET_ACCOUNTS:
        return formatJsonRpcResult(id, response);

      default:
        throw new Error(getSdkError('INVALID_METHOD').message);
    }
  };

  const response = await signTransaction();

  await walletkit.respondSessionRequest({
    topic,
    response,
  });
};

export const useApproveWCTransactionMutation = (
  options?: UseMutationOptions<void, Error, Params, unknown>,
) => {
  return useMutation({
    mutationFn: approveWCTransaction,
    ...options,
    onError: e => {
      // TODO: alerts are blockers.  handle more gracefully
      alert(e.message);
    },
  });
};
