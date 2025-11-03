import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAtomValue, useSetAtom } from 'jotai';
import { ROUTES, REFERRAL_SERVICE_URL } from '@/constants';
import { Button } from '@/ui-kit';
import { referralCodeAtom, updateReferralCodeAtom } from '@/atoms';
import { Header } from '@/components';

export const RedeemReferral: React.FC = () => {
  const navigate = useNavigate();
  const [referralCode, setReferralCode] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState(false);
  const [redemptionStatus, setRedemptionStatus] = useState<{
    hasRedeemed: boolean;
    redeemedCode: string | null;
    redeemedAt: string | null;
  } | null>(null);

  const referralData = useAtomValue(referralCodeAtom);
  const updateReferralData = useSetAtom(updateReferralCodeAtom);

  // Check redemption status when component mounts or userId changes
  useEffect(() => {
    const checkRedemptionStatus = async () => {
      if (!referralData.userId) return;

      try {
        const response = await fetch(
          `${REFERRAL_SERVICE_URL}/user/${referralData.userId}/redemption-status`,
          {
            method: 'GET',
            headers: {
              'Content-Type': 'application/json',
            },
          },
        );

        if (response.ok) {
          const result = await response.json();
          if (result.success) {
            setRedemptionStatus(result.data);
            // Update local state to match server state
            if (result.data.hasRedeemed) {
              updateReferralData({
                hasRedeemedCode: true,
                redeemedCode: result.data.redeemedCode,
              });
            }
          }
        }
      } catch (err) {
        console.error('Error checking redemption status:', err);
      }
    };

    checkRedemptionStatus();
  }, [referralData.userId, updateReferralData]);

  const closeAndReturn = () => {
    navigate(ROUTES.APP.ROOT);
  };

  const handleRedeem = async () => {
    if (!referralCode.trim()) {
      setError('Please enter a referral code');
      return;
    }

    // Basic validation
    const cleanCode = referralCode.replace(/-/g, '').toUpperCase();
    if (cleanCode.length !== 8) {
      setError('Referral code must be 8 characters');
      return;
    }

    if (!referralData.userId) {
      setError('User information not available. Please try again.');
      return;
    }

    // Check if user has already redeemed (server-side verification)
    if (redemptionStatus?.hasRedeemed) {
      setError('You have already redeemed a referral code');
      return;
    }

    setLoading(true);
    setError('');

    try {
      const response = await fetch(`${REFERRAL_SERVICE_URL}/redeem`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          user_id: referralData.userId,
          referral_code: cleanCode,
        }),
      });

      const result = await response.json();

      if (!response.ok) {
        throw new Error(result.error || 'Failed to redeem referral code');
      }

      // Update local state and redemption status
      updateReferralData({
        hasRedeemedCode: true,
        redeemedCode: cleanCode,
      });

      setRedemptionStatus({
        hasRedeemed: true,
        redeemedCode: cleanCode,
        redeemedAt: new Date().toISOString(),
      });

      setSuccess(true);
      setTimeout(() => {
        closeAndReturn();
      }, 2000);
    } catch (err: any) {
      setError(err.message || 'An error occurred while redeeming the code');
    } finally {
      setLoading(false);
    }
  };

  const formatInput = (value: string) => {
    const cleanValue = value.replace(/-/g, '').toUpperCase();
    if (cleanValue.length <= 4) return cleanValue;
    return `${cleanValue.slice(0, 4)}-${cleanValue.slice(4, 8)}`;
  };

  const handleChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const formatted = formatInput(e.target.value);
    setReferralCode(formatted);
    if (error) setError('');
  };

  // Show loading while checking redemption status
  if (redemptionStatus === null && referralData.userId) {
    return (
      <div className="h-screen flex flex-col overflow-hidden bg-black text-white">
        <Header title="Redeem Referral Code" onClose={closeAndReturn} />
        <div className="flex flex-grow items-center justify-center">
          <div className="text-center">
            <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue mx-auto mb-4"></div>
            <p className="text-neutral-3">Checking redemption status...</p>
          </div>
        </div>
      </div>
    );
  }

  // If user has already redeemed, show different UI
  // TODO: simplify
  if (redemptionStatus?.hasRedeemed) {
    return (
      <div className="h-screen flex flex-col overflow-hidden bg-black text-white">
        <Header title="Referral Code" onClose={closeAndReturn} />

        <div className="flex flex-grow flex-col px-6 pt-6">
          <div className="text-center mb-8">
            <div className="w-16 h-16 bg-green-500/20 rounded-full flex items-center justify-center mx-auto mb-4">
              <svg
                className="w-8 h-8 text-green-400"
                fill="none"
                stroke="currentColor"
                viewBox="0 0 24 24"
              >
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  strokeWidth={2}
                  d="M5 13l4 4L19 7"
                />
              </svg>
            </div>
            <h3 className="text-lg font-semibold text-white mb-2">Referral Code Redeemed</h3>
            <p className="text-neutral-3 text-sm">
              You've already redeemed a referral code
              {redemptionStatus.redeemedCode && (
                <span className="block mt-1 text-blue">
                  Code: {formatInput(redemptionStatus.redeemedCode)}
                </span>
              )}
              {redemptionStatus.redeemedAt && (
                <span className="block mt-1 text-neutral-3 text-xs">
                  Redeemed on: {new Date(redemptionStatus.redeemedAt).toLocaleDateString()}
                </span>
              )}
            </p>
          </div>

          <div className="flex-1" />

          <Button className="w-full mb-4" onClick={closeAndReturn}>
            Return to App
          </Button>
        </div>
      </div>
    );
  }

  return (
    <div className="h-screen flex flex-col overflow-hidden bg-black text-white">
      <Header title="Redeem Referral Code" onClose={closeAndReturn} />

      <div className="flex flex-grow flex-col px-6 pt-6">
        <div className="text-center mb-8">
          <p className="text-neutral-3 text-sm">
            Enter someone's referral code to receive benefits
          </p>
        </div>

        <div className="flex flex-col gap-4">
          <div>
            <label htmlFor="referralCode" className="text-sm font-medium text-neutral-1 mb-2 block">
              Referral Code
            </label>
            <input
              id="referralCode"
              type="text"
              placeholder="XXXX-XXXX"
              value={referralCode}
              onChange={handleChange}
              maxLength={9}
              className="w-full p-3 bg-neutral-8 border border-neutral-6 rounded-lg text-white placeholder-neutral-4 focus:outline-none focus:border-blue uppercase"
              disabled={loading || success}
            />
          </div>

          {error && (
            <div className="p-3 bg-red-500/20 border border-red-500 rounded-lg text-red-300 text-sm">
              {error}
            </div>
          )}

          {success && (
            <div className="p-3 bg-green-500/20 border border-green-500 rounded-lg text-green-300 text-sm">
              Referral code redeemed successfully!
            </div>
          )}
        </div>

        <div className="flex-1" />

        <Button
          className="w-full mb-4"
          onClick={handleRedeem}
          disabled={loading || success || !referralCode.trim()}
        >
          {loading ? 'Redeeming...' : success ? 'Success!' : 'Redeem Code'}
        </Button>
      </div>
    </div>
  );
};
