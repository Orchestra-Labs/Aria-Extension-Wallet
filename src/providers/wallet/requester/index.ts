/* eslint-disable @typescript-eslint/no-explicit-any */
import { WindowPostMessageStream } from '@metamask/post-message-stream';
import Long from 'long';
import { v4 as uuidv4 } from 'uuid';

import {
  EnableAccessMsg,
  GetKeyMsg,
  Message,
  RequestSignAminoMsg,
  RequestSignDirectMsg,
  SendTxMsg,
  SuggestChainInfoMsg,
} from '../types/messages';
import { MessageRequester, ResponseData } from './types';

export enum RequesterMethods {
  EnableAccess = 'enable-access',
  GetKey = 'get-key',
  RequestSignDirect = 'request-sign-direct',
  RequestSignAmino = 'request-sign-amino',
  SendTx = 'send-tx-to-background',
  AddSuggestedChain = 'add-suggested-chain',
}

export class ExtensionMessageRequester implements MessageRequester {
  private inpageStream!: WindowPostMessageStream;
  private origin: string;

  constructor(identifier = 'aria') {
    this.inpageStream = new WindowPostMessageStream({
      name: `${identifier}:inpage`,
      target: `${identifier}:content`,
    });

    if (
      'setMaxListeners' in this.inpageStream &&
      typeof this.inpageStream.setMaxListeners === 'function'
    ) {
      this.inpageStream.setMaxListeners(100);
    }

    this.origin = window.location.origin;
  }

  private static generateId(): number {
    return Number(uuidv4());
  }

  destroy() {
    // @ts-expect-error: TS doesn't see nested properties
    this.inpageStream && this.inpageStream.destroy();
  }

  send(type: any, data?: any): number {
    const id = ExtensionMessageRequester.generateId();

    // @ts-expect-error: TS doesn't see nested properties
    this.inpageStream.write({
      ...data,
      id,
      type,
    });

    return id;
  }

  on(name: string, callback: (payload: any) => void): void;

  on(callback: (payload: any) => void): void;

  on(...args: any[]): void {
    // @ts-expect-error: TS doesn't see nested properties
    this.inpageStream.on('data', (data: ResponseData) => {
      if (typeof args[0] === 'string') {
        data.name === args[0] && args[1](data.payload, data.name);
      } else {
        args[0](data.payload, data.name);
      }
    });
  }

  once(name: string, callback: (payload: any) => void): void;

  once(callback: (payload: any) => void): void;

  once(...args: any[]): void {
    // @ts-expect-error: TS doesn't see nested properties
    this.inpageStream.once('data', (data: ResponseData) => {
      if (typeof args[0] === 'string') {
        data.name === args[0] && args[1](data.payload, data.name);
      } else {
        args[0](data.payload, data.name);
      }
    });
  }

  request(type: any, data?: any): Promise<any> {
    const originalData = { ...data, origin: this.origin };
    let modifiedData;
    try {
      modifiedData = JSON.parse(JSON.stringify(originalData)); // we are doing this to avoid proxy objects in Celenium request
    } catch (e) {
      //
    }

    const id = this.send(type, modifiedData || originalData);
    return new Promise(resolve => {
      // @ts-expect-error: TS doesn't see nested properties
      this.inpageStream.on('data', (result: any) => {
        if (result.id === id) {
          resolve(result);
        }
      });
    });
  }

  async requestWrapper(method: RequesterMethods, message: Message<unknown>) {
    if (message.validateBasic) {
      message.validateBasic();
    }
    const data = await this.request(method, message);
    if (data?.payload?.error) {
      throw new Error(data?.payload.error);
    }
    return data;
  }

  async enableAccess(message: EnableAccessMsg) {
    const data = await this.requestWrapper(RequesterMethods.EnableAccess, message);
    return data?.payload?.access;
  }

  async getKey(message: GetKeyMsg): Promise<any> {
    const data = await this.requestWrapper(RequesterMethods.GetKey, message);
    const key = data?.payload?.key;
    if (!key) {
      return this.getKey(message);
    }
    key.pubKey = new Uint8Array(Object.values(key?.pubKey ?? key?.publicKey));
    key.address = new Uint8Array(Object.values(key?.address));
    return key;
  }

  async signAmino(message: RequestSignAminoMsg) {
    const data = await this.requestWrapper(RequesterMethods.RequestSignAmino, message);
    return data?.payload?.aminoSignResponse;
  }

  async signDirect(message: RequestSignDirectMsg) {
    const data = await this.requestWrapper(RequesterMethods.RequestSignDirect, message);
    const directSignResponse = data?.payload?.directSignResponse;
    const { low, high, unsigned } = directSignResponse.signed.accountNumber;

    const accountNumber = new Long(low, high, unsigned);
    directSignResponse.signed.authInfoBytes = new Uint8Array(
      Object.values(directSignResponse.signed.authInfoBytes),
    );
    directSignResponse.signed.bodyBytes = new Uint8Array(
      Object.values(directSignResponse.signed.bodyBytes),
    );
    directSignResponse.signed.accountNumber = `${accountNumber.toString()}`;
    return directSignResponse;
  }

  async sendTx(message: SendTxMsg) {
    const data = await this.requestWrapper(RequesterMethods.SendTx, message);
    const txHash = data?.payload?.txHash;
    const retVal = new Uint8Array(Object.values(txHash));
    return retVal;
  }

  async experimentalSuggestChain(message: SuggestChainInfoMsg) {
    return (await this.requestWrapper(RequesterMethods.AddSuggestedChain, message)).payload;
  }
}
