import { AminoSignResponse, StdSignDoc } from '@cosmjs/amino';
import deepmerge from 'deepmerge';
import Long from 'long';

import { ExtensionMessageRequester } from '@/providers/wallet/requester';
import { ChainInfo, DirectSignResponse, Key, StdTx } from '@/providers/wallet/types';

import { Aria as IAria, AriaInteractionOptions, AriaSignOptions } from './types/aria';
import {
  EnableAccessMsg,
  GetKeyMsg,
  RequestSignAminoMsg,
  RequestSignDirectMsg,
  SendTxMsg,
  SuggestChainInfoMsg,
} from './types/messages';
import { ROUTES } from '@/constants';

const requester = new ExtensionMessageRequester('aria');

export class Aria implements IAria {
  public defaultOptions: AriaInteractionOptions = {};

  async enable(chainIds: string | string[]): Promise<void> {
    if (typeof chainIds === 'string') {
      chainIds = [chainIds];
    }

    return requester.enableAccess(new EnableAccessMsg(chainIds));
  }

  async experimentalSuggestChain(chainInfo: ChainInfo): Promise<void> {
    const suggestChainMessage = new SuggestChainInfoMsg(chainInfo);

    return await requester.experimentalSuggestChain(suggestChainMessage);
  }

  async disconnect(): Promise<boolean> {
    return false;
  }

  async getKey(chainId: string): Promise<Key> {
    const msg = new GetKeyMsg(chainId);

    return await requester.getKey(msg);
  }

  async sendTx(
    chainId: string,
    tx: StdTx | Uint8Array,
    mode: 'sync' | 'async' | 'block',
  ): Promise<Uint8Array> {
    const msg = new SendTxMsg(chainId, tx, mode);
    return await requester.sendTx(msg);
  }

  async signAmino(
    chainId: string,
    signer: string,
    signDoc: StdSignDoc,
    signOptions: AriaSignOptions = {},
  ): Promise<AminoSignResponse> {
    if (!signer) throw new Error('Signer is required');

    const msg = new RequestSignAminoMsg(
      chainId,
      signer,
      signDoc,
      deepmerge(this.defaultOptions.sign ?? {}, signOptions),
    );
    const response = await requester.signAmino(msg);
    return response;
  }

  async signDirect(
    chainId: string,
    signer: string,
    signDoc: {
      bodyBytes?: Uint8Array | null;
      authInfoBytes?: Uint8Array | null;
      chainId?: string | null;
      accountNumber?: Long | null;
    },
    signOptions: AriaSignOptions = {},
  ): Promise<DirectSignResponse> {
    const msg = new RequestSignDirectMsg(
      chainId,
      signer,
      {
        bodyBytes: signDoc.bodyBytes,
        authInfoBytes: signDoc.authInfoBytes,
        chainId: signDoc.chainId,
        accountNumber: signDoc.accountNumber ? signDoc.accountNumber.toString() : null,
      },
      deepmerge(this.defaultOptions.sign ?? {}, signOptions),
    );
    const response = await requester.signDirect(msg);
    if (!response.signed) {
      throw new Error('Transaction declined');
    }

    const returnValue = {
      signed: {
        bodyBytes: response?.signed?.bodyBytes,
        authInfoBytes: response?.signed?.authInfoBytes,
        chainId: response?.signed?.chainId,
        accountNumber: Long.fromString(response?.signed?.accountNumber),
      },
      signature: response?.signature,
    };

    return returnValue;
  }

  async connect(uri: string) {
    window.postMessage({ action: 'connect', data: { uri } }, '*');
    return;
  }
  async openExtension(pathname?: string) {
    window.postMessage({ action: 'open_extension', data: { pathname } }, '*');
    return;
  }
  async signTransaction() {
    window.postMessage(
      { action: 'open_extension', data: { pathname: ROUTES.APP.WALLET_CONNECT.LOADER } },
      '*',
    );
    return;
  }
}
