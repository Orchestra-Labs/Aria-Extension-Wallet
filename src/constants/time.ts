export const ONE_SECOND = 1000;
export const ONE_MINUTE = 60 * 1000;
export const FIVE_MINUTES = 5 * ONE_MINUTE;
const FIFTEEN_MINUTES = 3 * FIVE_MINUTES; // 15 minutes in milliseconds
const ONE_HOUR = 4 * FIFTEEN_MINUTES;
const ONE_DAY = 24 * ONE_HOUR;

export const RECHECK_TIMEOUT = FIVE_MINUTES;
export const INACTIVITY_TIMEOUT = FIFTEEN_MINUTES;
export const TOKEN_EXPIRATION_TIME = FIFTEEN_MINUTES;
export const STORED_DATA_TIMEOUT = ONE_DAY;
export const DATA_FRESHNESS_TIMEOUT = ONE_SECOND * 15; // Data is considered fresh for 15 seconds
export const SIM_TX_FRESHNESS_TIMEOUT = DATA_FRESHNESS_TIMEOUT * 2;
export const ICON_CHANGEOVER_TIMEOUT = 750; // 0.75 seconds to hold confirmation icon
export const DELAY_BETWEEN_NODE_ATTEMPTS = 1000; //1 second between queries

export const DEFAULT_REST_TIMEOUT = 2000;
