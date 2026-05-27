import { httpRequest, getServiceUrl } from './external-services';
import { logger } from '../utils/logger';

const walletLogger = logger.child({ service: 'ReZ-Wallet' });

export interface WalletTransaction {
  transactionId: string;
  userId: string;
  type: 'credit' | 'debit';
  amount: number;
  coinType: 'rez' | 'prive' | 'branded' | 'promo' | 'cashback' | 'referral';
  description: string;
  createdAt: Date;
}

/**
 * Credit wallet for rewards
 */
export async function creditWallet(
  userId: string,
  amount: number,
  coinType: 'rez' | 'prive' | 'branded' | 'promo' | 'cashback' | 'referral' = 'rez',
  description: string = 'Habixo reward'
): Promise<{ success: boolean; transactionId?: string; error?: string }> {
  const result = await httpRequest<{
    success: boolean;
    transactionId?: string;
    error?: string;
  }>(
    `${getServiceUrl('wallet')}/api/wallet/credit`,
    {
      method: 'POST',
      body: {
        userId,
        amount,
        coinType,
        description,
        referenceType: 'habixo_reward',
      },
    }
  );

  if (result.success && result.data) {
    walletLogger.info({ userId, amount, coinType }, 'Wallet credited');
    return { success: true, transactionId: result.data.transactionId };
  }

  walletLogger.warn({ userId, amount }, 'Failed to credit wallet');
  return { success: false, error: result.error };
}

/**
 * Debit wallet for payments
 */
export async function debitWallet(
  userId: string,
  amount: number,
  description: string = 'Habixo payment'
): Promise<{ success: boolean; transactionId?: string; error?: string }> {
  const result = await httpRequest<{
    success: boolean;
    transactionId?: string;
    error?: string;
  }>(
    `${getServiceUrl('wallet')}/api/wallet/debit`,
    {
      method: 'POST',
      body: {
        userId,
        amount,
        description,
        referenceType: 'habixo_payment',
      },
    }
  );

  if (result.success && result.data) {
    walletLogger.info({ userId, amount }, 'Wallet debited');
    return { success: true, transactionId: result.data.transactionId };
  }

  walletLogger.warn({ userId, amount }, 'Failed to debit wallet');
  return { success: false, error: result.error };
}

/**
 * Get wallet balance
 */
export async function getWalletBalance(
  userId: string
): Promise<{ success: boolean; balance?: number; error?: string }> {
  const result = await httpRequest<{
    success: boolean;
    balance?: number;
  }>(
    `${getServiceUrl('wallet')}/api/wallet/${userId}/balance`
  );

  if (result.success && result.data) {
    return { success: true, balance: result.data.balance };
  }

  return { success: false, error: result.error };
}

// Predefined reward amounts
export const RewardAmounts = {
  BOOKING_CONFIRMED: 50,
  RENT_PAYMENT: 25,
  REVIEW_SUBMITTED: 20,
  FIVE_STAR_REVIEW: 100,
  REFERRAL_SIGNUP: 100,
  STREAK_BONUS: 10,
};
