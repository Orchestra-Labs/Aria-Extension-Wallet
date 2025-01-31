const APP_ROOT = '/';
const AUTH_ROOT = '/auth';

// TODO: organize and include sub-routing for open slidetrays and swipe indices
export const ROUTES = {
  APP: {
    ROOT: APP_ROOT,
    TRANSACTIONS_HISTORY: `/history`,
    TRANSACTION: `/history/:id`,
    SEND: '/send',
    RECEIVE: '/receive',
    ADD_NETWORK: '/add-network',
    EDIT_COIN_LIST: '/edit-coin-list',
    SETTINGS: '/settings',
    VIEW_PASSPHRASE: '/view-passphrase',
    CHANGE_PASSWORD: '/change-password',
    VIEW_TUTORIAL: '/view-tutorial',
    MEDIA_ONBOARDING: '/media-onboarding',
  },
  AUTH: {
    ROOT: AUTH_ROOT,
    NEW_WALLET: {
      ROOT: `${AUTH_ROOT}/wallet`,
      CREATE: `${AUTH_ROOT}/wallet/create`,
      IMPORT: `${AUTH_ROOT}/wallet/import`,
    },
  },
};
