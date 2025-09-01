/* eslint-disable @typescript-eslint/no-explicit-any */
import browser from 'webextension-polyfill';

import { getWallet } from '@/helpers';
import { openPopup } from '@/scripts/background-script';
import { SessionToken, WalletRecord } from '@/types';
import { ROUTES } from '@/constants';

export const toUint8Array = (str: string) =>
  new Uint8Array(
    atob(str)
      .split('')
      .map(char => char.charCodeAt(0)),
  );

export function requestEnableAccess(payload: {
  origin: string;
  validChainIds: string[];
  payloadId: string;
}) {
  // Store the listener function in a variable so we can remove it later
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const listener = (message: any, sender: any) => {
    if (sender.id !== browser.runtime.id) throw new Error('Invalid sender');

    if (message.type === 'get-key') {
      browser.runtime.sendMessage({
        type: 'enable-access',
        payload: { ...payload, pathname: ROUTES.APP.WALLET_CONNECT.LOADER },
      });
      // remove this listener after sending the message
      browser.runtime.onMessage.removeListener(listener);
    }
  };

  // Add the listener
  browser.runtime.onMessage.addListener(listener);
}

type GetKeyRequest = {
  message: {
    payload: any;
    type: string;
  };
  sendResponse: (eventName: string, payload: any, payloadId: number) => void;
};

const ACCOUNTS_TOKEN = 'accountsToken';
const SESSION_TOKEN = 'sessionToken';

export async function getKey() {
  const { accountsToken, sessionToken } = await browser.storage.local.get([
    ACCOUNTS_TOKEN,
    SESSION_TOKEN,
  ]);

  const walletID = (accountsToken as any)?.settings.activeWalletID;
  const walletInfo = Object.values((accountsToken as any)?.wallets)?.find(
    (wallet: any) => wallet.id === walletID,
  );

  const mnemonic = (sessionToken as SessionToken)?.mnemonic;
  const decryptedWallet = await getWallet(mnemonic);

  return {
    address: decryptedWallet,
    algo: 'secp256k1',
    bech32Address: decryptedWallet,
    isNanoLedger: false,
    name: (walletInfo as WalletRecord)?.name,
    pubKey: toUint8Array(''),
  };
}

const requests = new Map();

export async function handleGetKey({ message, sendResponse }: GetKeyRequest) {
  requests.set(message.payload.id, false);
  const { payload, type } = message;
  const msg = payload;
  const chainIds = msg.chainIds ?? (Array.isArray(msg.chainId) ? msg.chainId : [msg.chainId]);
  const eventName = `on${type.toUpperCase()}`;

  const queryString = `?origin=${msg?.origin}`;

  try {
    const payloadId = payload.id;

    await openPopup('approveConnection', queryString);
    requestEnableAccess({
      origin: msg.origin,
      validChainIds: chainIds,
      payloadId,
    });

    try {
      const key = await getKey();
      sendResponse(eventName, { key }, payloadId);
    } catch (e) {
      sendResponse(eventName, { error: 'Request rejected' }, payload.id);
    }
  } catch (e: any) {
    sendResponse(eventName, { error: `Unable to get key ${e.message}` }, payload.id);
  }
}
