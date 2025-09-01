/* eslint-disable @typescript-eslint/no-explicit-any */
import { WindowPostMessageStream } from '@metamask/post-message-stream';
import PortStream from 'extension-port-stream';

import { ROUTES } from '@/constants/routes';
import { getExtensionUrl } from '@/helpers/getExtensionUrl';

const runtime = window.chrome?.runtime;

const WORKER_RESET_INTERVAL = 10000;
const WORKER_RESET_MESSAGE = 'WORKER_RESET_MESSAGE';

let extensionPort: any;
let pageStream: any;
let extensionStream: any;

const injectInPageScript = (path: string) => {
  const container = document.head || document.documentElement;
  const scriptElement = document.createElement('script');

  const url = runtime.getURL(path);

  if (!url) return console.error('Failed to get URL for path:', path);

  scriptElement.src = url;

  scriptElement.type = 'text/javascript';
  container.insertBefore(scriptElement, container.children[0]);
  scriptElement.remove();
};

function initKeepWorkerAlive() {
  const interval = setInterval(async () => {
    try {
      await runtime.sendMessage({ name: WORKER_RESET_MESSAGE });
    } catch (e: any) {
      if (e.message === 'Extension context invalidated.') {
        clearInterval(interval);
      }
    }
  }, WORKER_RESET_INTERVAL);
}

window.addEventListener('message', event => {
  console.log('MESSAGE SENT', event);
  const initSessionUrl = getExtensionUrl(ROUTES.APP.WALLET_CONNECT.INIT_SESSION);
  initSessionUrl.searchParams.append('uri', event?.data?.data?.uri);
  const openExtensionUrl = getExtensionUrl(event?.data?.data?.pathname);

  switch (event.data.action) {
    case 'connect':
      runtime?.sendMessage({ action: 'open_extension', data: { url: initSessionUrl.toString() } });
      break;
    case 'open_extension':
      runtime?.sendMessage({
        action: 'open_extension',
        data: { url: openExtensionUrl.toString() },
      });
      break;
    default:
      break;
  }
});

function doctypeCheck() {
  const { doctype } = window.document;
  if (doctype) {
    return doctype.name === 'html';
  }
  return true;
}

function suffixCheck() {
  const prohibitedTypes = [
    /\.xml$/,
    /\.pdf$/,
    /\.asp$/,
    /\.jsp$/,
    /\.php$/,
    /\.md$/,
    /\.svg$/,
    /\.docx$/,
    /\.odt$/,
    /\.eml$/,
  ];
  const currentUrl = window.location.pathname;
  for (let i = 0; i < prohibitedTypes.length; i += 1) {
    if (prohibitedTypes[i].test(currentUrl)) {
      return false;
    }
  }
  return true;
}

function documentElementCheck() {
  const documentElement = document.documentElement.nodeName;
  if (documentElement) {
    return documentElement.toLowerCase() === 'html';
  }
  return true;
}

function shouldInjectProvider() {
  return doctypeCheck() && suffixCheck() && documentElementCheck();
}

// creates extension stream to connect with the inpage stream
function setupExtensionStream() {
  extensionPort = runtime.connect({
    name: 'AriaExtension',
  });

  extensionStream = new PortStream(extensionPort);
  pageStream.pipe(extensionStream);
  extensionStream.pipe(pageStream);
}

function setUpPageStreams() {
  const identifier = 'aria';

  pageStream = new WindowPostMessageStream({
    name: `${identifier}:content`,
    target: `${identifier}:inpage`,
  });
}

// resets the extension stream with new streams to connect with inpage streams.
function resetExtensionStreamListeners() {
  extensionPort.onDisconnect.removeListener(resetExtensionStreamListeners);
  extensionStream.destroy();
  setupExtensionStream();
  extensionPort.onDisconnect.addListener(resetExtensionStreamListeners);
}

function setupStreams() {
  setUpPageStreams();
  setupExtensionStream();

  extensionPort.onDisconnect.addListener(resetExtensionStreamListeners);
}

async function init() {
  setupStreams();
}

if (shouldInjectProvider()) {
  injectInPageScript('/injected-script.js');

  await init();

  initKeepWorkerAlive();
}
