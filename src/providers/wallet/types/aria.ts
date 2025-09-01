import { AminoSignResponse, StdSignDoc } from '@cosmjs/amino';

import { ChainInfo } from './chain-info';
import { BroadcastMode, DirectAuxSignResponse, DirectSignResponse } from './cosmjs';
import { Key } from './key';

export interface Aria {
  enable(chainIds: string | string[]): Promise<void>;
  experimentalSuggestChain(chainInfo: ChainInfo): Promise<void>;
  getKey(chainId: string): Promise<Key>;
  signAmino(
    chainId: string,
    signer: string,
    signDoc: StdSignDoc,
    signOptions?: AriaSignOptions,
  ): Promise<AminoSignResponse>;
  signDirect(
    chainId: string,
    signer: string,
    signDoc: {
      /** SignDoc bodyBytes */
      bodyBytes?: Uint8Array | null;
      /** SignDoc authInfoBytes */
      authInfoBytes?: Uint8Array | null;
      /** SignDoc chainId */
      chainId?: string | null;
      /** SignDoc accountNumber */
      accountNumber?: Long | null;
    },
    signOptions?: AriaSignOptions,
  ): Promise<DirectSignResponse>;
  signDirectAux?(
    chainId: string,
    signer: string,
    signDoc: {
      bodyBytes?: Uint8Array | null;
      publicKey?: {
        typeUrl: string;
        value: Uint8Array;
      } | null;
      chainId?: string | null;
      accountNumber?: Long | null;
      sequence?: Long | null;
      tip?: {
        amount: {
          denom: string;
          amount: string;
        }[];
        tipper: string;
      } | null;
    },
    signOptions?: Exclude<AriaSignOptions, 'preferNoSetFee' | 'disableBalanceCheck'>,
  ): Promise<DirectAuxSignResponse>;
  sendTx(chainId: string, tx: Uint8Array, mode: BroadcastMode): Promise<Uint8Array>;
}

export interface AriaSignOptions {
  readonly preferNoSetFee?: boolean;
  readonly preferNoSetMemo?: boolean;
  readonly disableBalanceCheck?: boolean;
}

export interface AriaInteractionOptions {
  readonly sign?: AriaSignOptions;
}
