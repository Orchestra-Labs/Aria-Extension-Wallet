import { atom } from 'jotai';
import { STORED_DATA_TIMEOUT } from '@/constants';

export interface ReferralData {
  userId: string | null;
  referralCode: string | null;
  lastUpdated: number | null;
  hasRedeemedCode: boolean;
  redeemedCode: string | null;
}

// Atom for storing user referral data with timestamp
export const referralCodeAtom = atom<ReferralData>({
  userId: null,
  referralCode: null,
  lastUpdated: null,
  hasRedeemedCode: false,
  redeemedCode: null,
});

// Derived atom to check if data is still fresh (within 1 day)
export const isReferralCodeFreshAtom = atom(get => {
  const referralData = get(referralCodeAtom);
  if (!referralData.lastUpdated) return false;

  const now = Date.now();
  return now - referralData.lastUpdated < STORED_DATA_TIMEOUT;
});

// Derived atom to get fresh referral code (returns null if data is stale)
export const freshReferralCodeAtom = atom(get => {
  const referralData = get(referralCodeAtom);
  const isFresh = get(isReferralCodeFreshAtom);
  return isFresh ? referralData.referralCode : null;
});

// Atom to check if user has redeemed a code
export const hasRedeemedCodeAtom = atom(get => {
  const referralData = get(referralCodeAtom);
  return referralData.hasRedeemedCode;
});

// Atom to update referral data with current timestamp
export const updateReferralCodeAtom = atom(
  null,
  (
    get,
    set,
    update: {
      userId?: string | null;
      referralCode?: string | null;
      hasRedeemedCode?: boolean;
      redeemedCode?: string | null;
    },
  ) => {
    const current = get(referralCodeAtom);
    set(referralCodeAtom, {
      userId: update.userId !== undefined ? update.userId : current.userId,
      referralCode: update.referralCode !== undefined ? update.referralCode : current.referralCode,
      hasRedeemedCode:
        update.hasRedeemedCode !== undefined ? update.hasRedeemedCode : current.hasRedeemedCode,
      redeemedCode: update.redeemedCode !== undefined ? update.redeemedCode : current.redeemedCode,
      lastUpdated: Date.now(),
    });
  },
);

// Atom to clear referral data
export const clearReferralCodeAtom = atom(null, (_, set) => {
  set(referralCodeAtom, {
    userId: null,
    referralCode: null,
    lastUpdated: null,
    hasRedeemedCode: false,
    redeemedCode: null,
  });
});
