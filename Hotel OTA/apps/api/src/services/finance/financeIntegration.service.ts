/**
 * REZ Finance Integration — Hotel OTA
 *
 * Calls rez-finance-service internal API to get contextual credit offers
 * during booking checkout (BNPL, instant loan, etc.)
 *
 * Non-blocking: all failures are swallowed so the booking flow is never affected.
 */

import axios from 'axios';

const FINANCE_URL = process.env.FINANCE_SERVICE_URL || '';
const INTERNAL_TOKEN = process.env.INTERNAL_SERVICE_TOKEN || '';

export interface FinanceOffer {
  eligible: boolean;
  message?: string;
  offerType?: string;
  limit?: number;
}

export async function getContextualFinanceOffer(
  userId: string,
  screen: string,
  bookingId: string,
  amountInRupees: number,
): Promise<FinanceOffer | null> {
  if (!FINANCE_URL || !INTERNAL_TOKEN) return null;

  const res = await axios.post<{ success: boolean; offer: FinanceOffer | null }>(
    `${FINANCE_URL}/internal/finance/contextual-offer`,
    { userId, screen, orderId: bookingId, amount: amountInRupees },
    {
      headers: { 'x-internal-token': INTERNAL_TOKEN, 'Content-Type': 'application/json' },
      timeout: 3000,
    },
  );

  return res.data?.offer ?? null;
}
