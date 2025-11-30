import { QueryType, REFERRAL_SERVICE_URL, RevenueEventType } from '@/constants';

// Types matching the server's revenue event schema
export interface RevenueEventRequest {
  chain_id: string;
  currency: string;
  amount: number;
  event_type: RevenueEventType;
  referee_id?: string;
  transaction_hash?: string;
}

export interface RevenueEventResponse {
  success: boolean;
  data: {
    id: string;
    chain_id: string;
    currency: string;
    amount: number;
    event_type: string;
    referee_id?: string;
    transaction_hash?: string;
    created_at: string;
    updated_at: string;
  };
}

/**
 * Record a revenue event to the server
 * @param eventData The revenue event data to record
 * @returns Promise with the response from the server
 */
export async function recordRevenueEvent(
  eventData: RevenueEventRequest,
): Promise<RevenueEventResponse> {
  try {
    const response = await fetch(`${REFERRAL_SERVICE_URL}/revenue`, {
      method: QueryType.POST,
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(eventData),
    });

    if (!response.ok) {
      const errorText = await response.text();
      throw new Error(`Failed to record revenue event: ${response.status} - ${errorText}`);
    }

    return await response.json();
  } catch (error) {
    console.error('Error recording revenue event:', error);
    throw error;
  }
}

/**
 * Helper to record on-ramping revenue
 */
export async function recordOnRampingRevenue(
  chainId: string,
  currency: string,
  amount: number,
  transactionHash?: string,
  refereeId?: string,
): Promise<RevenueEventResponse> {
  return recordRevenueEvent({
    chain_id: chainId,
    currency,
    amount,
    event_type: RevenueEventType.ON_RAMPING,
    transaction_hash: transactionHash,
    referee_id: refereeId,
  });
}

/**
 * Helper to record off-ramping revenue
 */
export async function recordOffRampingRevenue(
  chainId: string,
  currency: string,
  amount: number,
  transactionHash?: string,
  refereeId?: string,
): Promise<RevenueEventResponse> {
  return recordRevenueEvent({
    chain_id: chainId,
    currency,
    amount,
    event_type: RevenueEventType.OFF_RAMPING,
    transaction_hash: transactionHash,
    referee_id: refereeId,
  });
}

/**
 * Helper to record currency trade revenue (DEX swaps)
 */
export async function recordExchangeRevenue(
  chainId: string,
  coinDenom: string,
  amount: number,
  transactionHash?: string,
  refereeId?: string,
): Promise<RevenueEventResponse> {
  return recordRevenueEvent({
    chain_id: chainId,
    currency: coinDenom,
    amount,
    event_type: RevenueEventType.CURRENCY_TRADE,
    transaction_hash: transactionHash,
    referee_id: refereeId,
  });
}

/**
 * Helper to record AI subscription revenue
 */
export async function recordAISubscriptionRevenue(
  chainId: string,
  currency: string,
  amount: number,
  transactionHash?: string,
  refereeId?: string,
): Promise<RevenueEventResponse> {
  return recordRevenueEvent({
    chain_id: chainId,
    currency,
    amount,
    event_type: RevenueEventType.AI_SUBSCRIPTION,
    transaction_hash: transactionHash,
    referee_id: refereeId,
  });
}

/**
 * Helper to record staking service fee revenue
 */
export async function recordStakingServiceFeeRevenue(
  chainId: string,
  currency: string,
  amount: number,
  transactionHash?: string,
  refereeId?: string,
): Promise<RevenueEventResponse> {
  return recordRevenueEvent({
    chain_id: chainId,
    currency,
    amount,
    event_type: RevenueEventType.STAKING_SERVICE_FEE,
    transaction_hash: transactionHash,
    referee_id: refereeId,
  });
}
