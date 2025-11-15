import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAtomValue } from 'jotai';
import { ROUTES, REFERRAL_SERVICE_URL } from '@/constants';
import { Button } from '@/ui-kit';
import { referralCodeAtom } from '@/atoms';
import { Header } from '@/components';

interface DisbursementStats {
  totalDisbursed: Record<string, Record<string, number>>;
  pendingDisbursement: Record<string, Record<string, number>>;
}

export const ReferralEarnings: React.FC = () => {
  const navigate = useNavigate();
  const referralData = useAtomValue(referralCodeAtom);
  const [loading, setLoading] = useState(true);
  const [stats, setStats] = useState<DisbursementStats | null>(null);
  const [error, setError] = useState('');

  useEffect(() => {
    const fetchDisbursementStats = async () => {
      if (!referralData.userId) {
        setError('User information not available');
        setLoading(false);
        return;
      }

      try {
        const response = await fetch(
          `${REFERRAL_SERVICE_URL}/user/${referralData.userId}/disbursements`,
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
            setStats(result.data);
          }
        } else {
          throw new Error('Failed to fetch disbursement stats');
        }
      } catch (err: any) {
        setError(err.message || 'Error loading earnings data');
      } finally {
        setLoading(false);
      }
    };

    fetchDisbursementStats();
  }, [referralData.userId]);

  const closeAndReturn = () => {
    navigate(ROUTES.APP.ROOT);
  };

  if (loading) {
    return (
      <div className="h-screen flex flex-col overflow-hidden bg-black text-white">
        <Header title="Referral Earnings" onClose={closeAndReturn} />
        <div className="flex flex-grow items-center justify-center">
          <div className="text-center">
            <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue mx-auto mb-4"></div>
            <p className="text-neutral-3">Loading earnings...</p>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="h-screen flex flex-col overflow-hidden bg-black text-white">
      <Header title="Referral Earnings" onClose={closeAndReturn} />

      <div className="flex flex-grow flex-col px-6 pt-6">
        {error ? (
          <div className="p-3 bg-red-500/20 border border-red-500 rounded-lg text-red-300 text-sm">
            {error}
          </div>
        ) : (
          <div className="space-y-6">
            {/* Total Disbursed */}
            <div>
              <h3 className="text-lg font-semibold text-white mb-4">Total Earnings</h3>
              {stats && Object.keys(stats.totalDisbursed).length > 0 ? (
                <div className="space-y-3">
                  {Object.entries(stats.totalDisbursed).map(([chain, currencies]) => (
                    <div key={chain} className="bg-neutral-8 rounded-lg p-4">
                      <h4 className="text-blue font-medium mb-2">{chain}</h4>
                      {Object.entries(currencies).map(([currency, amount]) => (
                        <div key={currency} className="flex justify-between text-sm">
                          <span className="text-neutral-3">{currency}</span>
                          <span className="text-white font-medium">{amount}</span>
                        </div>
                      ))}
                    </div>
                  ))}
                </div>
              ) : (
                <p className="text-neutral-3 text-center py-8">No earnings yet</p>
              )}
            </div>

            {/* Pending Disbursement */}
            <div>
              <h3 className="text-lg font-semibold text-white mb-4">Pending Earnings</h3>
              {stats && Object.keys(stats.pendingDisbursement).length > 0 ? (
                <div className="space-y-3">
                  {Object.entries(stats.pendingDisbursement).map(([chain, currencies]) => (
                    <div key={chain} className="bg-neutral-8 rounded-lg p-4">
                      <h4 className="text-blue font-medium mb-2">{chain}</h4>
                      {Object.entries(currencies).map(([currency, amount]) => (
                        <div key={currency} className="flex justify-between text-sm">
                          <span className="text-neutral-3">{currency}</span>
                          <span className="text-white font-medium">{amount}</span>
                        </div>
                      ))}
                    </div>
                  ))}
                </div>
              ) : (
                <p className="text-neutral-3 text-center py-8">No pending earnings</p>
              )}
            </div>
          </div>
        )}

        <div className="flex-1" />

        <Button className="w-full mb-4" onClick={closeAndReturn}>
          Return to App
        </Button>
      </div>
    </div>
  );
};
