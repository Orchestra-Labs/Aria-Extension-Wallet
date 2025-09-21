import { SendObject } from './transactionTypes';

export interface SwapObject {
  sendObject: SendObject;
  resultDenom: string;
}
