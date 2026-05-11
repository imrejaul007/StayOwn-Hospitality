import { prisma } from '../../config/database';
import { Errors } from '../../utils/errors';
import crypto from 'crypto';

const REFERRER_REWARD_PAISE = 20000;  // ₹200
const REFERRED_REWARD_PAISE = 10000;  // ₹100

export class ReferralService {
  /**
   * Generate a referral code for a user
   */
  static async getOrCreateCode(userId: string): Promise<string> {
    const existing = await prisma.referral.findFirst({
      where: { referrerId: userId, status: 'pending' },
    });
    if (existing) return existing.referralCode;

    const code = `REF${crypto.randomBytes(4).toString('hex').toUpperCase()}`;
    await prisma.referral.create({
      data: { referrerId: userId, referralCode: code },
    });
    return code;
  }

  /**
   * Apply referral code during signup
   */
  static async applyReferral(referralCode: string, newUserId: string) {
    const referral = await prisma.referral.findUnique({ where: { referralCode } });
    if (!referral) throw Errors.notFound('Referral code');
    if (referral.referredUserId) throw Errors.validation('Referral code already used');
    if (referral.referrerId === newUserId) throw Errors.validation('Cannot refer yourself');

    await prisma.referral.update({
      where: { id: referral.id },
      data: { referredUserId: newUserId, status: 'active' },
    });
  }

  /**
   * Complete referral after first booking — award coins to both
   */
  static async completeReferral(userId: string) {
    const referral = await prisma.referral.findFirst({
      where: { referredUserId: userId, status: 'active' },
    });
    if (!referral) return;

    // Award referrer
    const referrerWallet = await prisma.coinWallet.findUnique({ where: { userId: referral.referrerId } });
    if (referrerWallet) {
      const newBal = referrerWallet.otaCoinBalancePaise + REFERRER_REWARD_PAISE;
      await prisma.$transaction(async (tx) => {
        await tx.coinTransaction.create({
          data: {
            userId: referral.referrerId,
            walletId: referrerWallet.id,
            coinType: 'ota',
            transactionType: 'earn',
            amountPaise: REFERRER_REWARD_PAISE,
            direction: 'credit',
            balanceAfterPaise: newBal,
            notes: 'Referral bonus: friend completed first booking',
          },
        });
        await tx.coinWallet.update({
          where: { id: referrerWallet.id },
          data: { otaCoinBalancePaise: newBal, otaCoinLifetimeEarnedPaise: { increment: REFERRER_REWARD_PAISE } },
        });
      });
    }

    // Award referred user
    const referredWallet = await prisma.coinWallet.findUnique({ where: { userId } });
    if (referredWallet) {
      const newBal = referredWallet.otaCoinBalancePaise + REFERRED_REWARD_PAISE;
      await prisma.$transaction(async (tx) => {
        await tx.coinTransaction.create({
          data: {
            userId,
            walletId: referredWallet.id,
            coinType: 'ota',
            transactionType: 'earn',
            amountPaise: REFERRED_REWARD_PAISE,
            direction: 'credit',
            balanceAfterPaise: newBal,
            notes: 'Referral bonus: welcome reward for first booking',
          },
        });
        await tx.coinWallet.update({
          where: { id: referredWallet.id },
          data: { otaCoinBalancePaise: newBal, otaCoinLifetimeEarnedPaise: { increment: REFERRED_REWARD_PAISE } },
        });
      });
    }

    await prisma.referral.update({
      where: { id: referral.id },
      data: {
        status: 'completed',
        referrerRewardPaise: REFERRER_REWARD_PAISE,
        referredRewardPaise: REFERRED_REWARD_PAISE,
        completedAt: new Date(),
      },
    });
  }
}
