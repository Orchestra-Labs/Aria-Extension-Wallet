import { SendObject } from './transactionTypes';

export interface IBCChannel {
  channel_id: string;
  port_id: string;
}

export interface IBCChannelData {
  channel_id: string;
  port_id: string;
  state: string;
  counterparty: {
    channel_id: string;
    port_id: string;
  };
}

export interface IBCObject {
  fromAddress: string;
  sendObject: SendObject;
  ibcChannel: IBCChannel;
}
