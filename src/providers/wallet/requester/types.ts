/* eslint-disable @typescript-eslint/no-explicit-any */
import browser from 'webextension-polyfill';

import { Message } from '../types/messages';
import { RequesterMethods } from './index';

export type MessageSender = Pick<browser.Runtime.MessageSender, 'id' | 'url' | 'tab'>;

export type FnRequestInteractionOptions = {
  forceOpenWindow?: boolean;
  channel?: string;
};

export type FnRequestInteraction = <M extends Message<unknown>>(
  url: string,
  msg: M,
  options?: FnRequestInteractionOptions,
) => Promise<M extends Message<infer R> ? R : never>;

export interface Env {
  readonly isInternalMsg: boolean;
  readonly requestInteraction: FnRequestInteraction;
}

export type EnvProducer = (sender: MessageSender, routerMeta: Record<string, any>) => Env;

export type Guard = (
  env: Omit<Env, 'requestInteraction'>,
  msg: Message<unknown>,
  sender: MessageSender,
) => Promise<void>;

export type ResponseData = {
  name: string;
  payload: any;
};

export interface MessageRequester {
  send(type: any, data?: any): number;
  request(type: any, data?: any): Promise<any>;
  requestWrapper(method: RequesterMethods, message: Message<unknown>): any;
  on(...args: any[]): void;
  once(...args: any[]): void;
}
