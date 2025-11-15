import { Dialog, DialogTrigger } from '@radix-ui/react-dialog';
import {
  DollarSign,
  EditIcon,
  GiftIcon,
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
import { ROUTES, SYMPHONY_MAINNET_ID, REFERRAL_SERVICE_URL, SYMPHONY_PREFIX } from '@/constants';
import { useLogout } from '@/hooks';
import { Button, DialogContent, CopyTextField } from '@/ui-kit';
import { walletAddressesAtom, updateChainWalletAtom } from '@/atoms';
import {
  referralCodeAtom,
  isReferralCodeFreshAtom,
  freshReferralCodeAtom,
  updateReferralCodeAtom,
  clearReferralCodeAtom,
} from '@/atoms';
import { getAddressByChainPrefix, getSessionToken } from '@/helpers';

const OPTIONS = [
  {
    id: 1,
    name: 'Redeem Referral Code',
    icon: <GiftIcon width={16} height={16} />,
    target: '',
    to: ROUTES.APP.REDEEM_REFERRAL,
  },
  {
    id: 2,
    name: 'Referral Earnings',
    icon: <DollarSign width={16} height={16} />,
    target: '',
    to: ROUTES.APP.REFERRAL_EARNINGS,
  },
  {
    id: 3,
    name: 'Settings',
    icon: <Settings width={16} height={16} />,
    target: '',
    to: ROUTES.APP.SETTINGS,
  },
  {
    id: 4,
    name: 'Change Password',
    icon: <NotebookPenIcon width={16} height={16} />,
    target: '',
    to: ROUTES.APP.CHANGE_PASSWORD,
  },
  {
    id: 5,
    name: 'View Passphrase',
    icon: <NotebookTextIcon width={16} height={16} />,
    target: '',
    to: ROUTES.APP.VIEW_PASSPHRASE,
  },
  {
    id: 6,
    name: 'Edit Coin List',
    icon: <EditIcon width={16} height={16} />,
    target: '',
    to: ROUTES.APP.EDIT_COIN_LIST,
  },
  {
    id: 7,
    name: 'View Tutorial',
    icon: <GraduationCap width={16} height={16} />,
    target: '',
    to: ROUTES.APP.VIEW_TUTORIAL,
  },
  {
    id: 8,
    name: 'Contact Us',
    icon: <Discord />,
    target: '_blank',
    to: 'https://discord.gg/symphony-1162823265975279636',
  },
  {
    id: 9,
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

// TODO: add loader for code before it's pulled
// TODO: add bounce effect to checkmark
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

  console.log('[OptionsDialog] Current state:', {
    userReferralCode,
    isReferralCodeFresh,
    freshReferralCode,
    walletAddresses: Object.keys(walletAddresses),
    hasSymphonyAddress: !!walletAddresses[SYMPHONY_MAINNET_ID],
  });

  const handleLogOut = () => {
    // Clear referral data on logout
    clearUserReferral();
    logout();
  };

  // Get mnemonic from session token
  const getMnemonic = (): string | null => {
    const sessionToken = getSessionToken();
    console.log('[OptionsDialog] Session token exists:', !!sessionToken);
    return sessionToken?.mnemonic || null;
  };

  // Get or create Symphony mainnet address
  const getOrCreateSymphonyAddress = async (): Promise<string | null> => {
    const existingAddress = walletAddresses[SYMPHONY_MAINNET_ID];
    console.log('[OptionsDialog] Existing Symphony address:', existingAddress);

    if (existingAddress && existingAddress.length > 0) {
      console.log('[OptionsDialog] Using existing Symphony address');
      return existingAddress;
    }

    const mnemonic = getMnemonic();
    if (!mnemonic) {
      console.error('[OptionsDialog] No mnemonic available to generate Symphony address');
      return null;
    }

    try {
      console.log('[OptionsDialog] Generating new Symphony address from mnemonic');
      const symphonyAddress = await getAddressByChainPrefix(mnemonic, SYMPHONY_PREFIX);
      console.log('[OptionsDialog] Generated Symphony address:', symphonyAddress);

      updateChainWallet({
        chainId: SYMPHONY_MAINNET_ID,
        address: symphonyAddress,
      });

      console.log('[OptionsDialog] Updated chain wallet with Symphony address');
      return symphonyAddress;
    } catch (error) {
      console.error('[OptionsDialog] Failed to generate Symphony address:', error);
      return null;
    }
  };

  // Create referral code if user exists but doesn't have one
  const createReferralCode = async (userId: string): Promise<string | null> => {
    console.log('[OptionsDialog] Creating referral code for user:', userId);
    try {
      const response = await fetch(`${REFERRAL_SERVICE_URL}/user/${userId}/referral-code`, {
        method: 'GET',
        headers: {
          'Content-Type': 'application/json',
        },
      });

      console.log('[OptionsDialog] Referral code creation response status:', response.status);

      if (response.ok) {
        const data = await response.json();
        console.log('[OptionsDialog] Referral code created successfully:', data.data.referral_code);
        return data.data.referral_code;
      } else {
        const errorText = await response.text();
        console.error(
          '[OptionsDialog] Failed to create referral code:',
          response.status,
          errorText,
        );
        return null;
      }
    } catch (error) {
      console.error('[OptionsDialog] Error creating referral code:', error);
      return null;
    }
  };

  // Fetch user data and ensure they have a referral code
  const fetchUserAndEnsureReferralCode = async (forceRefresh = false) => {
    console.log(
      '[OptionsDialog] fetchUserAndEnsureReferralCode called, forceRefresh:',
      forceRefresh,
    );

    // If data is fresh and we're not forcing a refresh, don't fetch
    if (
      isReferralCodeFresh &&
      userReferralCode.userId &&
      userReferralCode.referralCode &&
      !forceRefresh
    ) {
      console.log('[OptionsDialog] Data is fresh, skipping fetch');
      return;
    }

    console.log('[OptionsDialog] Starting to fetch Symphony address');
    const symphonyAddress = await getOrCreateSymphonyAddress();
    if (!symphonyAddress) {
      console.error('[OptionsDialog] No Symphony address available');
      return;
    }
    console.log('[OptionsDialog] Using Symphony address:', symphonyAddress);

    setLoading(true);
    try {
      let currentUserId = userReferralCode.userId;
      let currentReferralCode = userReferralCode.referralCode;

      console.log(
        '[OptionsDialog] Current user ID:',
        currentUserId,
        'Current referral code:',
        currentReferralCode,
      );

      // Only fetch user if we don't have a fresh user ID
      if (!currentUserId || forceRefresh) {
        console.log('[OptionsDialog] Fetching user data with address:', symphonyAddress);
        const userResponse = await fetch(`${REFERRAL_SERVICE_URL}/user`, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({
            cosmos_address: symphonyAddress,
            evm_address: null,
            svm_address: null,
          }),
        });

        console.log('[OptionsDialog] User API response status:', userResponse.status);

        if (!userResponse.ok) {
          const errorText = await userResponse.text();
          console.error('[OptionsDialog] User API error:', userResponse.status, errorText);
          throw new Error(`Failed to get/create user: ${userResponse.status} ${errorText}`);
        }

        const userData = await userResponse.json();
        console.log('[OptionsDialog] User API response data:', userData);

        currentUserId = userData.data.id;
        console.log('[OptionsDialog] Setting user ID:', currentUserId);

        // Update atom with new user ID
        updateUserReferral({ userId: currentUserId });

        // If we just created/found a user but don't have a referral code, create one
        if (currentUserId && !currentReferralCode) {
          console.log('[OptionsDialog] User exists but no referral code, creating one...');
          currentReferralCode = await createReferralCode(currentUserId);
          if (currentReferralCode) {
            console.log('[OptionsDialog] Successfully created referral code:', currentReferralCode);
            updateUserReferral({ referralCode: currentReferralCode });
          } else {
            console.error('[OptionsDialog] Failed to create referral code');
          }
        }
      }

      // If we have a user ID but no referral code, create one
      if (currentUserId && !currentReferralCode) {
        console.log('[OptionsDialog] User ID exists but no referral code, creating one...');
        currentReferralCode = await createReferralCode(currentUserId);
        if (currentReferralCode) {
          console.log('[OptionsDialog] Successfully created referral code:', currentReferralCode);
          updateUserReferral({ referralCode: currentReferralCode });
        } else {
          console.error('[OptionsDialog] Failed to create referral code');
        }
      }

      // Only fetch existing referral code if we still don't have one
      if ((!freshReferralCode || forceRefresh) && currentUserId && !currentReferralCode) {
        console.log('[OptionsDialog] Fetching existing referral code for user:', currentUserId);
        const referralResponse = await fetch(
          `${REFERRAL_SERVICE_URL}/user/${currentUserId}/referral-code`,
          {
            method: 'GET',
            headers: {
              'Content-Type': 'application/json',
            },
          },
        );

        console.log(
          '[OptionsDialog] Referral code fetch response status:',
          referralResponse.status,
        );

        if (referralResponse.ok) {
          const referralData = await referralResponse.json();
          console.log('[OptionsDialog] Referral code fetch response data:', referralData);
          const rawCode = referralData.data.referral_code;
          // Update atom with new referral code
          updateUserReferral({ referralCode: rawCode });
          console.log('[OptionsDialog] Updated referral code:', rawCode);
        } else {
          const errorText = await referralResponse.text();
          console.error('[OptionsDialog] Referral API error:', referralResponse.status, errorText);
        }
      }

      console.log(
        '[OptionsDialog] Final state - User ID:',
        currentUserId,
        'Referral Code:',
        currentReferralCode,
      );
    } catch (error) {
      console.error('[OptionsDialog] Failed to fetch user or referral code:', error);
    } finally {
      console.log('[OptionsDialog] Finished fetch process');
      setLoading(false);
    }
  };

  // Fetch data on component mount if needed
  useEffect(() => {
    console.log('[OptionsDialog] useEffect triggered', {
      isReferralCodeFresh,
      hasUserId: !!userReferralCode.userId,
      hasReferralCode: !!userReferralCode.referralCode,
    });

    if (!isReferralCodeFresh || !userReferralCode.userId || !userReferralCode.referralCode) {
      console.log('[OptionsDialog] Conditions met, fetching data...');
      fetchUserAndEnsureReferralCode();
    } else {
      console.log('[OptionsDialog] Conditions not met, skipping fetch');
    }
  }, []);

  const hasSymphonyAddress = !!walletAddresses[SYMPHONY_MAINNET_ID];
  const displayReferralCode = freshReferralCode || userReferralCode.referralCode;

  console.log('[OptionsDialog] Render state:', {
    loading,
    hasSymphonyAddress,
    displayReferralCode,
    formattedCode: displayReferralCode ? formatReferralCode(displayReferralCode) : 'none',
  });

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
