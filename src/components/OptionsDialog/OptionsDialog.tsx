// OptionsDialog.tsx
import { Dialog, DialogTrigger } from '@radix-ui/react-dialog';
import {
  EditIcon,
  Globe,
  GraduationCap,
  LogOut,
  NotebookPenIcon,
  NotebookTextIcon,
  Settings,
} from 'lucide-react';
import React, { useState, useEffect } from 'react';
import { Link } from 'react-router-dom';
import { useAtomValue, useSetAtom } from 'jotai';

import { ArrowLeft, Discord, DotsVertical } from '@/assets/icons';
import { ROUTES, SYMPHONY_MAINNET_ID } from '@/constants';
import { useLogout } from '@/hooks';
import { Button, DialogContent, CopyTextField } from '@/ui-kit';
import { walletAddressesAtom, updateChainWalletAtom } from '@/atoms';
import {
  referralCodeAtom,
  isReferralCodeFreshAtom,
  freshReferralCodeAtom,
  updateReferralCodeAtom,
  clearReferralCodeAtom,
} from '@/atoms/referralcodeatom';
import { getAddressByChainPrefix, getSessionToken } from '@/helpers';

const OPTIONS = [
  {
    id: 1,
    name: 'Settings',
    icon: <Settings width={16} height={16} />,
    target: '',
    to: ROUTES.APP.SETTINGS,
  },
  {
    id: 2,
    name: 'Change Password',
    icon: <NotebookPenIcon width={16} height={16} />,
    target: '',
    to: ROUTES.APP.CHANGE_PASSWORD,
  },
  {
    id: 3,
    name: 'View Passphrase',
    icon: <NotebookTextIcon width={16} height={16} />,
    target: '',
    to: ROUTES.APP.VIEW_PASSPHRASE,
  },
  {
    id: 4,
    name: 'Edit Coin List',
    icon: <EditIcon width={16} height={16} />,
    target: '',
    to: ROUTES.APP.EDIT_COIN_LIST,
  },
  {
    id: 5,
    name: 'View Tutorial',
    icon: <GraduationCap width={16} height={16} />,
    target: '',
    to: ROUTES.APP.VIEW_TUTORIAL,
  },
  {
    id: 6,
    name: 'Contact Us',
    icon: <Discord />,
    target: '_blank',
    to: 'https://discord.gg/symphony-1162823265975279636',
  },
  {
    id: 7,
    name: 'Connected dApps',
    icon: <Globe />,
    target: '',
    to: ROUTES.APP.WALLET_CONNECT.PAIRINGS,
  },
];

// Function to format referral code with dashes every 4 characters
const formatReferralCode = (code: string): string => {
  if (!code) return '';
  const cleanCode = code.replace(/-/g, '');
  return cleanCode.match(/.{1,4}/g)?.join('-') || cleanCode;
};

export const OptionsDialog: React.FC = () => {
  const [open, setOpen] = useState(false);
  const [loading, setLoading] = useState(false);
  const logout = useLogout();
  const walletAddresses = useAtomValue(walletAddressesAtom);
  const updateChainWallet = useSetAtom(updateChainWalletAtom);

  // User referral atoms
  const userReferralCode = useAtomValue(referralCodeAtom);
  const isReferralCodeFresh = useAtomValue(isReferralCodeFreshAtom);
  const freshReferralCode = useAtomValue(freshReferralCodeAtom);
  const updateUserReferral = useSetAtom(updateReferralCodeAtom);
  const clearUserReferral = useSetAtom(clearReferralCodeAtom);

  const handleLogOut = () => {
    // Clear referral data on logout
    clearUserReferral();
    logout();
  };

  // Get mnemonic from session token
  const getMnemonic = (): string | null => {
    const sessionToken = getSessionToken();
    return sessionToken?.mnemonic || null;
  };

  // Get or create Symphony mainnet address
  const getOrCreateSymphonyAddress = async (): Promise<string | null> => {
    const existingAddress = walletAddresses[SYMPHONY_MAINNET_ID];

    if (existingAddress && existingAddress.length > 0) {
      return existingAddress;
    }

    const mnemonic = getMnemonic();
    if (!mnemonic) {
      console.error('[OptionsDialog] No mnemonic available to generate Symphony address');
      return null;
    }

    try {
      // FIX: Use 'symphony' as the prefix, not SYMPHONY_MAINNET_ID
      const symphonyAddress = await getAddressByChainPrefix(mnemonic, 'symphony');

      updateChainWallet({
        chainId: SYMPHONY_MAINNET_ID,
        address: symphonyAddress,
      });
      return symphonyAddress;
    } catch (error) {
      console.error('[OptionsDialog] Failed to generate Symphony address:', error);
      return null;
    }
  };

  // Fetch user data only when needed
  const fetchUserAndReferralCode = async (forceRefresh = false) => {
    // If data is fresh and we're not forcing a refresh, don't fetch
    if (
      isReferralCodeFresh &&
      userReferralCode.userId &&
      userReferralCode.referralCode &&
      !forceRefresh
    ) {
      return;
    }

    const symphonyAddress = await getOrCreateSymphonyAddress();
    if (!symphonyAddress) {
      console.error('[OptionsDialog] No Symphony address available');
      return;
    }

    setLoading(true);
    try {
      let currentUserId = userReferralCode.userId;

      // Only fetch user if we don't have a fresh user ID
      if (!currentUserId || forceRefresh) {
        const userResponse = await fetch('https://echo.orchestralabs.org/user', {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({
            cosmos_address: symphonyAddress,
          }),
        });

        if (!userResponse.ok) {
          const errorText = await userResponse.text();
          console.error('[OptionsDialog] User API error:', errorText);
          throw new Error(`Failed to get/create user: ${userResponse.status} ${errorText}`);
        }

        const userData = await userResponse.json();
        currentUserId = userData.data.id;
        // Update atom with new user ID
        updateUserReferral({ userId: currentUserId });
      }

      // Only fetch referral code if we don't have a fresh one
      if ((!freshReferralCode || forceRefresh) && currentUserId) {
        const referralResponse = await fetch(
          `https://echo.orchestralabs.org/user/${currentUserId}/referral-code`,
          {
            method: 'GET',
            headers: {
              'Content-Type': 'application/json',
            },
          },
        );

        if (referralResponse.ok) {
          const referralData = await referralResponse.json();
          // TODO: amend from 'code' on db side, then trim here
          const rawCode =
            referralData.data.referral_code ||
            referralData.data.code ||
            referralData.data.referralCode;
          // Update atom with new referral code
          updateUserReferral({ referralCode: rawCode });
        } else {
          const errorText = await referralResponse.text();
          console.error('[OptionsDialog] Referral API error:', errorText);
        }
      }
    } catch (error) {
      console.error('[OptionsDialog] Failed to fetch user or referral code:', error);
    } finally {
      setLoading(false);
    }
  };

  // Fetch data on component mount if needed
  useEffect(() => {
    if (!isReferralCodeFresh || !userReferralCode.userId || !userReferralCode.referralCode) {
      fetchUserAndReferralCode();
    }
  }, []);

  const hasSymphonyAddress = !!walletAddresses[SYMPHONY_MAINNET_ID];
  const displayReferralCode = freshReferralCode || userReferralCode.referralCode;

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button className="p-[7px]" variant="reactiveIcon" size="rounded-default">
          <DotsVertical width="100%" height="100%" />
        </Button>
      </DialogTrigger>
      <DialogContent className="gap-0 pb-0">
        <h3 className="text-h5 font-bold">Options</h3>

        {/* Referral Code Section */}
        <div className="border-b border-neutral-2 pb-4 mb-4">
          <div className="flex flex-col gap-2">
            <span className="text-sm font-medium text-neutral-1">Your Referral Code</span>
            {loading ? (
              <div className="text-sm text-neutral-3">-</div>
            ) : displayReferralCode ? (
              <CopyTextField
                variant="transparent"
                displayText={formatReferralCode(displayReferralCode)}
                copyText={displayReferralCode}
                includeMargin={false}
              />
            ) : (
              <div className="text-sm text-neutral-3">
                {hasSymphonyAddress
                  ? 'No referral code available'
                  : 'Connect wallet to get referral code'}
              </div>
            )}
          </div>
        </div>

        {/* Existing Options */}
        <div className="grid">
          {OPTIONS.map(option => (
            <Button key={option.id} variant="dialogOption" size={'blank'} asChild>
              <Link
                to={option.to}
                target={option.target}
                onClick={() => setOpen(false)}
                className="flex items-center"
              >
                <div className="h-8 w-8 bg-blue rounded-full flex items-center justify-center p-1.5 mr-2.5 text-black">
                  {option.icon}
                </div>
                {option.name}
                <div className="flex-1" />
                <ArrowLeft className="rotate-180 h-3 w-3" />
              </Link>
            </Button>
          ))}
          <Button
            variant="dialogOption"
            size={'blank'}
            className="flex items-center"
            onClick={handleLogOut}
          >
            <div className="h-8 w-8 bg-blue rounded-full flex items-center justify-center p-1.5 mr-2.5 text-black">
              <LogOut width={16} height={16} />
            </div>
            Logout
            <div className="flex-1" />
            <ArrowLeft className="rotate-180 h-3 w-3" />
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
};
