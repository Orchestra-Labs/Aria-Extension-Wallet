/* eslint-disable no-case-declarations */
import { formatJsonRpcResult } from '@json-rpc-tools/utils';
import { useMutation, UseMutationOptions } from '@tanstack/react-query';
import { SignClientTypes } from '@walletconnect/types';
import { getSdkError } from '@walletconnect/utils';
import { Buffer } from 'buffer';
import Long from 'long';

import { COSMOS_SIGNING_METHODS } from '@/constants/wc';
import {
  createAminoSignerFromMnemonic,
  createOfflineSignerFromMnemonic,
  getSessionToken,
  walletkit,
} from '@/helpers';

const bufferFromBase64 = (base64: string) => Buffer.from(base64, 'base64');
const base64FromUint8Array = (array: Uint8Array) => Buffer.from(array).toString('base64');

type Params = {
  requestEvent: SignClientTypes.EventArguments['session_request'];
};

const approveWCTransaction = async ({ requestEvent }: Params) => {
  const { id, params, topic } = requestEvent;

  const { request } = params;

  const sessionToken = await getSessionToken();
  if (!sessionToken) {
    throw new Error(getSdkError('USER_DISCONNECTED').message);
  }

  const directSigner = await createOfflineSignerFromMnemonic(sessionToken.mnemonic || '');
  const aminoSigner = await createAminoSignerFromMnemonic(sessionToken.mnemonic || '');

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
      alert(e.message);
    },
  });
};
