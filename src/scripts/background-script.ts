/* eslint-disable @typescript-eslint/no-explicit-any */
import { handleGetKey } from '@/scripts/handlers/get-key';

self.window = self;

import PortStream from 'extension-port-stream';
import browser from 'webextension-polyfill';

import { getExtensionUrl } from '@/helpers/getExtensionUrl';
import { openExtensionWindow } from '@/helpers/openExtensionWindow';
import { RequesterMethods } from '@/providers/wallet/requester';

const popupIds: Record<string, number> = {};
const pendingPromises: Record<string, Promise<browser.Windows.Window>> = {};

export type Page = 'approveConnection' | 'suggestChain';

// Handles opening popup and avoids multiple popups
export async function openPopup(page: Page, queryString?: string) {
  let url = `index.html#/`;
  if (page !== 'login') {
    url = url + page;
  }
  if (queryString) {
    url = url + queryString;
  }

  if (popupIds[url] || !!pendingPromises[url]) {
    try {
      let popupId = popupIds[url];
      if (!popupId) {
        const popup = await pendingPromises[url];
        if (popup.id) {
          popupId = popup.id;
        }
      }

      const existingPopup = await browser.windows.get(popupId, { populate: true });

      if (existingPopup.tabs?.length) {
        const [tab] = existingPopup.tabs;
        if (tab?.id) {
          await browser.tabs.update(tab.id, { active: true, url: url });
        } else {
          throw new Error('No tabs');
        }
      } else {
        throw new Error('No tabs');
      }
    } catch (e: any) {
      if (e.message.includes('Requests exceeded')) {
        throw e;
      }
      openExtensionWindow(url ?? getExtensionUrl().href);
    }
  } else {
    openExtensionWindow(url ?? getExtensionUrl().href);
  }
}

const connectRemote = (remotePort: any) => {
  if (remotePort.name !== 'AriaExtension') {
    return;
  }

  const portStream = new PortStream(remotePort);

  const sendResponse = (name: string, payload: any, id: number) => {
    // eslint-disable-next-line @typescript-eslint/ban-ts-comment
    // @ts-ignore
    portStream.write({ name, payload, id });
  };

  const requestHandler = async (data: any) => {
    const { type, ...payload } = data;
    const ACCOUNTS_KEY = 'accountsToken';

    const storage = await browser.storage.local.get([ACCOUNTS_KEY]);

    if (!storage[ACCOUNTS_KEY]) {
      return sendResponse(
        `on${type?.toUpperCase() ?? ''}`,
        { error: 'No wallet exists' },
        payload.id,
      );
    }

    switch (type) {
      case RequesterMethods.EnableAccess: {
        try {
          sendResponse(`on${type.toUpperCase()}`, { error: 'Invalid chain id' }, payload.id);
        } catch (e: any) {
          sendResponse(`on${type.toUpperCase()}`, { error: `Invalid chain id` }, payload.id);
        }
        break;
      }

      case RequesterMethods.GetKey: {
        await handleGetKey({
          message: { type, payload },
          sendResponse,
        });
        break;
      }

      //TODO: implement next methods to correctly handle transactions
      case RequesterMethods.RequestSignDirect: {
        break;
      }
      case RequesterMethods.RequestSignAmino: {
        break;
      }
      case RequesterMethods.SendTx: {
        break;
      }
    }
  };

  // eslint-disable-next-line @typescript-eslint/ban-ts-comment
  // @ts-ignore
  portStream.on('data', async (data: any) => {
    await requestHandler(data);
  });
};

browser.runtime.onConnect.addListener(connectRemote);
