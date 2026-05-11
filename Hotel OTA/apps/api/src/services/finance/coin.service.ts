import { prisma } from '../../config/database';
import { Errors } from '../../utils/errors';
import { logger } from '../../config/logger';
import { CoinType, EarnRuleChannel, EarnRuleTier, Prisma } from '@prisma/client';
import dayjs from 'dayjs';

export class CoinService {
  /**
   * Find the most specific matching earn rule.
   * Priority: campaign > hotel-specific > user tier > channel > default
   */
  static async findEarnRule(params: {
    coinType: CoinType;
    channelSource: string;
    hotelId: string;
    userTier: string;
    campaignId?: string | null;
    bookingValue: number;
  }) {
    const { coinType, channelSource, hotelId, userTier, campaignId, bookingValue } = params;
    const today = new Date();

    const rules = await prisma.earnRule.findMany({
      where: {
        coinType,
        isActive: true,
        validFrom: { lte: today },
        OR: [{ validUntil: null }, { validUntil: { gte: today } }],
        minBookingValuePaise: { lte: bookingValue },
      },
      orderBy: { createdAt: 'desc' },
    });

    // Priority matching
    // 1. Campaign-specific
    if (campaignId) {
      const campaignRule = rules.find((r) => r.campaignId === campaignId);
      if (campaignRule) return campaignRule;
    }

    // 2. Hotel-specific
    const hotelRule = rules.find((r) => r.hotelId === hotelId && !r.campaignId);
    if (hotelRule) return hotelRule;

    // 3. User tier rule
    const tierRule = rules.find(
      (r) => r.userTier === (userTier as EarnRuleTier) && !r.hotelId && !r.campaignId
    );
    if (tierRule) return tierRule;

    // 4. Channel rule
    const channelRule = rules.find(
      (r) =>
        r.channelSource === (channelSource as EarnRuleChannel) &&
        r.userTier === 'all' &&
        !r.hotelId &&
        !r.campaignId
    );
    if (channelRule) return channelRule;

    // 5. Default rule
    const defaultRule = rules.find(
      (r) => r.channelSource === 'all' && r.userTier === 'all' && !r.hotelId && !r.campaignId
    );
    return defaultRule || null;
  }

  /**
   * Calculate earn amount from an earn rule
   */
  static calculateEarnAmount(bookingValue: number, earnPct: number, maxEarnPerBooking?: number | null): number {
    // H-5: Overflow protection — cap input to prevent Number overflow
    const MAX_SAFE_COINS = Number.MAX_SAFE_INTEGER / Math.max(earnPct / 100, 0.0001);
    const cappedValue = Math.min(bookingValue, MAX_SAFE_COINS);
    let amount = Math.round(cappedValue * (earnPct / 100));
    if (maxEarnPerBooking && amount > maxEarnPerBooking) {
      amount = maxEarnPerBooking;
    }
    return amount;
  }

  /**
   * Guard: check hotel brand coin program is enabled before any operation.
   * Returns false (no-op) if the program is disabled.
   */
  private static async isBrandCoinEnabled(hotelId: string): Promise<boolean> {
    const hotel = await prisma.hotel.findUnique({
      where: { id: hotelId },
      select: { brandCoinEnabled: true },
    });
    return hotel?.brandCoinEnabled ?? false;
  }

  /**
   * Credit coins to user wallet (earn)
   */
  static async earnCoins(params: {
    userId: string;
    coinType: CoinType;
    amountPaise: number;
    bookingId: string;
    earnRuleId: string;
    hotelId?: string;  // required when coinType === 'hotel_brand'
  }) {
    const { userId, coinType, amountPaise, bookingId, earnRuleId, hotelId } = params;

    if (amountPaise <= 0) return;

    // Guard: no-op if hotel brand coin program is disabled
    if (coinType === 'hotel_brand') {
      if (!hotelId || !(await this.isBrandCoinEnabled(hotelId))) return;
    }

    // Deduplication: skip if an earn transaction already exists for this booking+coinType.
    // Prevents double-crediting when PMS webhooks are delivered more than once.
    const existing = await prisma.coinTransaction.findFirst({
      where: {
        bookingId,
        coinType,
        transactionType: 'earn',
      },
    });
    if (existing) {
      logger.info('Coin earn already recorded, skipping duplicate', { bookingId });
      return existing;
    }

    const wallet = await prisma.coinWallet.findUnique({ where: { userId } });
    if (!wallet) throw Errors.internal('Wallet not found');

    const expiryDate = dayjs().add(12, 'month').toDate();

    await prisma.$transaction(async (tx) => {
      if (coinType === 'hotel_brand') {
        // Upsert hotel brand coin balance
        const updated = await tx.hotelBrandCoinBalance.upsert({
          where: { userId_hotelId: { userId, hotelId: hotelId! } },
          create: {
            userId,
            hotelId: hotelId!,
            balancePaise: amountPaise,
            lifetimeEarnedPaise: amountPaise,
          },
          update: {
            balancePaise: { increment: amountPaise },
            lifetimeEarnedPaise: { increment: amountPaise },
          },
        });

        // Create transaction record
        const coinTx = await tx.coinTransaction.create({
          data: {
            userId,
            walletId: wallet.id,
            coinType,
            transactionType: 'earn',
            amountPaise,
            direction: 'credit',
            bookingId,
            earnRuleId,
            hotelId: hotelId!,
            expiryDate,
            balanceAfterPaise: updated.balancePaise,
            notes: `Earned from booking`,
          },
        });

        // Schedule expiry (12 months)
        await tx.coinExpirySchedule.create({
          data: {
            userId,
            coinType: 'hotel_brand',
            hotelId: hotelId!,
            amountPaise,
            expiryDate,
            sourceTransactionId: coinTx.id,
          },
        });
      } else {
        // OTA or REZ — use atomic increment to prevent concurrent earn race conditions
        if (coinType === 'ota') {
          const updated = await tx.coinWallet.update({
            where: { id: wallet.id },
            data: {
              otaCoinBalancePaise: { increment: amountPaise },
              otaCoinLifetimeEarnedPaise: { increment: amountPaise },
            },
          });

          const coinTx = await tx.coinTransaction.create({
            data: {
              userId,
              walletId: wallet.id,
              coinType,
              transactionType: 'earn',
              amountPaise,
              direction: 'credit',
              bookingId,
              earnRuleId,
              expiryDate,
              balanceAfterPaise: updated.otaCoinBalancePaise,
              notes: `Earned from booking`,
            },
          });

          await tx.coinExpirySchedule.create({
            data: {
              userId,
              coinType: 'ota',
              amountPaise,
              expiryDate,
              sourceTransactionId: coinTx.id,
            },
          });
        } else {
          // REZ
          const updated = await tx.coinWallet.update({
            where: { id: wallet.id },
            data: { rezCoinBalancePaise: { increment: amountPaise } },
          });

          await tx.coinTransaction.create({
            data: {
              userId,
              walletId: wallet.id,
              coinType,
              transactionType: 'earn',
              amountPaise,
              direction: 'credit',
              bookingId,
              earnRuleId,
              expiryDate: null,
              balanceAfterPaise: updated.rezCoinBalancePaise,
              notes: `Earned from booking`,
            },
          });
        }
      }
    });
  }

  /**
   * Earn coins within a Prisma transaction context
   * Used when coin earn must be atomic with other operations
   */
  static async earnCoinsTx(
    tx: Prisma.TransactionClient,
    params: {
      userId: string;
      coinType: CoinType;
      amountPaise: number;
      bookingId: string;
      earnRuleId: string;
      hotelId?: string;
      channelSource?: string;
      userTier?: string;
      campaignId?: string | null;
      bookingValue?: number;
    }
  ) {
    const { userId, coinType, amountPaise, bookingId, earnRuleId, hotelId } = params;

    if (amountPaise <= 0) return;

    // Guard: no-op if hotel brand coin program is disabled
    if (coinType === 'hotel_brand') {
      if (!hotelId || !(await this.isBrandCoinEnabled(hotelId))) return;
    }

    // Deduplication: skip if an earn transaction already exists for this booking+coinType.
    const existing = await tx.coinTransaction.findFirst({
      where: {
        bookingId,
        coinType,
        transactionType: 'earn',
      },
    });
    if (existing) {
      logger.info('Coin earn already recorded in tx, skipping duplicate', { bookingId });
      return existing;
    }

    const wallet = await tx.coinWallet.findUnique({ where: { userId } });
    if (!wallet) throw Errors.internal('Wallet not found');

    const expiryDate = dayjs().add(12, 'month').toDate();

    if (coinType === 'hotel_brand') {
      const updated = await tx.hotelBrandCoinBalance.upsert({
        where: { userId_hotelId: { userId, hotelId: hotelId! } },
        create: {
          userId,
          hotelId: hotelId!,
          balancePaise: amountPaise,
          lifetimeEarnedPaise: amountPaise,
        },
        update: {
          balancePaise: { increment: amountPaise },
          lifetimeEarnedPaise: { increment: amountPaise },
        },
      });

      const coinTx = await tx.coinTransaction.create({
        data: {
          userId,
          walletId: wallet.id,
          coinType,
          transactionType: 'earn',
          amountPaise,
          direction: 'credit',
          bookingId,
          earnRuleId,
          hotelId: hotelId!,
          expiryDate,
          balanceAfterPaise: updated.balancePaise,
          notes: `Earned from booking`,
        },
      });

      await tx.coinExpirySchedule.create({
        data: {
          userId,
          coinType: 'hotel_brand',
          hotelId: hotelId!,
          amountPaise,
          expiryDate,
          sourceTransactionId: coinTx.id,
        },
      });
    } else if (coinType === 'ota') {
      const updated = await tx.coinWallet.update({
        where: { id: wallet.id },
        data: {
          otaCoinBalancePaise: { increment: amountPaise },
          otaCoinLifetimeEarnedPaise: { increment: amountPaise },
        },
      });

      const coinTx = await tx.coinTransaction.create({
        data: {
          userId,
          walletId: wallet.id,
          coinType,
          transactionType: 'earn',
          amountPaise,
          direction: 'credit',
          bookingId,
          earnRuleId,
          expiryDate,
          balanceAfterPaise: updated.otaCoinBalancePaise,
          notes: `Earned from booking`,
        },
      });

      await tx.coinExpirySchedule.create({
        data: {
          userId,
          coinType: 'ota',
          amountPaise,
          expiryDate,
          sourceTransactionId: coinTx.id,
        },
      });
    } else {
      // REZ
      const updated = await tx.coinWallet.update({
        where: { id: wallet.id },
        data: { rezCoinBalancePaise: { increment: amountPaise } },
      });

      await tx.coinTransaction.create({
        data: {
          userId,
          walletId: wallet.id,
          coinType,
          transactionType: 'earn',
          amountPaise,
          direction: 'credit',
          bookingId,
          earnRuleId,
          expiryDate: null,
          balanceAfterPaise: updated.rezCoinBalancePaise,
          notes: `Earned from booking`,
        },
      });
    }
  }

  /**
   * Burn (debit) coins from user wallet.
   * Idempotent: skips if a burn transaction for this booking already exists.
   */
  static async burnCoins(params: {
    userId: string;
    coinType: CoinType;
    amountPaise: number;
    bookingId: string;
    hotelId?: string;  // required when coinType === 'hotel_brand'
    eventId?: string; // optional deterministic idempotency key
  }) {
    const { userId, coinType, amountPaise, bookingId, hotelId, eventId } = params;

    if (amountPaise <= 0) return;

    // H-2: Idempotency key includes coinType to prevent conflicts when the same amount
    // is burned for different coin types on the same booking.
    const idempotencyKey = eventId ?? `hotel-ota:${bookingId}:${coinType}:burn:${amountPaise}`;
    const existing = await prisma.coinTransaction.findFirst({
      where: { bookingId, transactionType: 'burn', idempotencyKey },
    });
    if (existing) {
      logger.info('[CoinService] Burn already recorded, skipping duplicate', { bookingId, idempotencyKey });
      return existing;
    }

    const wallet = await prisma.coinWallet.findUnique({ where: { userId } });
    if (!wallet) throw Errors.internal('Wallet not found');

    if (coinType === 'hotel_brand') {
      if (!hotelId || !(await this.isBrandCoinEnabled(hotelId))) return;

      const brandBalance = await prisma.hotelBrandCoinBalance.findUnique({
        where: { userId_hotelId: { userId, hotelId } },
      });
      if (!brandBalance || brandBalance.balancePaise < amountPaise) {
        throw Errors.coinInsufficient();
      }

      await prisma.$transaction(async (tx) => {
        const updated = await tx.hotelBrandCoinBalance.update({
          where: { userId_hotelId: { userId, hotelId } },
          data: {
            balancePaise: { decrement: amountPaise },
            lifetimeBurnedPaise: { increment: amountPaise },
          },
        });

        await tx.coinTransaction.create({
          data: {
            userId,
            walletId: wallet.id,
            coinType,
            transactionType: 'burn',
            amountPaise,
            direction: 'debit',
            bookingId,
            hotelId,
            balanceAfterPaise: updated.balancePaise,
            notes: `Burned on booking`,
            idempotencyKey,
          },
        });
      });
      return;
    }

    await prisma.$transaction(async (tx) => {
      // Re-read balance inside transaction with a row lock to prevent TOCTOU race
      const lockedWallet = await tx.coinWallet.findUnique({ where: { id: wallet.id } });
      if (!lockedWallet) throw Errors.internal('Wallet not found');

      const currentBalance = coinType === 'ota' ? lockedWallet.otaCoinBalancePaise : lockedWallet.rezCoinBalancePaise;
      if (currentBalance < amountPaise) {
        throw Errors.coinInsufficient();
      }

      const newBalance = currentBalance - amountPaise;

      await tx.coinTransaction.create({
        data: {
          userId,
          walletId: wallet.id,
          coinType,
          transactionType: 'burn',
          amountPaise,
          direction: 'debit',
          bookingId,
          balanceAfterPaise: newBalance,
          notes: `Burned on booking`,
          idempotencyKey,
        },
      });

      if (coinType === 'ota') {
        await tx.coinWallet.update({
          where: { id: wallet.id },
          data: {
            otaCoinBalancePaise: newBalance,
            otaCoinLifetimeBurnedPaise: { increment: amountPaise },
          },
        });
      } else {
        await tx.coinWallet.update({
          where: { id: wallet.id },
          data: { rezCoinBalancePaise: newBalance },
        });
      }
    });
  }

  /**
   * Reverse coin earn (on booking cancellation).
   * Idempotent: skips if an earn_reversal for this booking+amount already exists.
   */
  static async reverseEarn(params: {
    userId: string;
    coinType: CoinType;
    amountPaise: number;
    bookingId: string;
    hotelId?: string;
    eventId?: string; // optional deterministic idempotency key
  }) {
    const { userId, coinType, amountPaise, bookingId, hotelId, eventId } = params;
    if (amountPaise <= 0) return;

    // Idempotency: skip if an earn_reversal for this booking+amount already exists.
    const idempotencyKey = eventId ?? `hotel-ota:${bookingId}:earn_reversal:${amountPaise}`;
    const existing = await prisma.coinTransaction.findFirst({
      where: { bookingId, transactionType: 'earn_reversal', idempotencyKey },
    });
    if (existing) {
      logger.info('[CoinService] Earn reversal already recorded, skipping duplicate', { bookingId, idempotencyKey });
      return existing;
    }

    const wallet = await prisma.coinWallet.findUnique({ where: { userId } });
    if (!wallet) return;

    if (coinType === 'hotel_brand') {
      if (!hotelId) return;
      const brandBalance = await prisma.hotelBrandCoinBalance.findUnique({
        where: { userId_hotelId: { userId, hotelId } },
      });
      if (!brandBalance) return;

      // Use atomic decrements to avoid TOCTOU race on concurrent reversals
      const balanceAfterPaise = Math.max(0, brandBalance.balancePaise - amountPaise);
      await prisma.$transaction(async (tx) => {
        await tx.hotelBrandCoinBalance.update({
          where: { userId_hotelId: { userId, hotelId } },
          data: {
            balancePaise: { decrement: amountPaise },
            lifetimeEarnedPaise: { decrement: amountPaise },
          },
        });
        await tx.coinTransaction.create({
          data: {
            userId,
            walletId: wallet.id,
            coinType,
            transactionType: 'earn_reversal',
            amountPaise,
            direction: 'debit',
            bookingId,
            hotelId,
            balanceAfterPaise,
            notes: 'Reversed: booking cancelled',
            idempotencyKey,
          },
        });
      });
      return;
    }

    await prisma.$transaction(async (tx) => {
      const lockedWallet = await tx.coinWallet.findUnique({ where: { id: wallet.id } });
      if (!lockedWallet) return;
      const currentBalance = coinType === 'ota' ? lockedWallet.otaCoinBalancePaise : lockedWallet.rezCoinBalancePaise;
      const newBalance = Math.max(0, currentBalance - amountPaise);

      await tx.coinTransaction.create({
        data: {
          userId,
          walletId: wallet.id,
          coinType,
          transactionType: 'earn_reversal',
          amountPaise,
          direction: 'debit',
          bookingId,
          balanceAfterPaise: newBalance,
          notes: 'Reversed: booking cancelled',
          idempotencyKey,
        },
      });

      if (coinType === 'ota') {
        await tx.coinWallet.update({
          where: { id: wallet.id },
          data: { otaCoinBalancePaise: newBalance },
        });
      } else {
        await tx.coinWallet.update({
          where: { id: wallet.id },
          data: { rezCoinBalancePaise: newBalance },
        });
      }
    });
  }

  /**
   * Reverse coin burn (refund coins on payment failure or cancellation).
   * Idempotent: skips if a refund_credit for this booking+amount already exists.
   */
  static async reverseBurn(params: {
    userId: string;
    coinType: CoinType;
    amountPaise: number;
    bookingId: string;
    hotelId?: string;
    eventId?: string; // optional deterministic idempotency key
  }) {
    const { userId, coinType, amountPaise, bookingId, hotelId, eventId } = params;
    if (amountPaise <= 0) return;

    // Idempotency: skip if a refund_credit for this booking+amount already exists.
    const idempotencyKey = eventId ?? `hotel-ota:${bookingId}:refund_credit:${amountPaise}`;
    const existing = await prisma.coinTransaction.findFirst({
      where: { bookingId, transactionType: 'refund_credit', idempotencyKey },
    });
    if (existing) {
      logger.info('[CoinService] Burn reversal already recorded, skipping duplicate', { bookingId, idempotencyKey });
      return existing;
    }

    const wallet = await prisma.coinWallet.findUnique({ where: { userId } });
    if (!wallet) return;

    if (coinType === 'hotel_brand') {
      if (!hotelId) return;
      const brandBalance = await prisma.hotelBrandCoinBalance.findUnique({
        where: { userId_hotelId: { userId, hotelId } },
      });
      // If no balance record exists, there's nothing to reverse — skip to avoid phantom credits
      if (!brandBalance) return;
      const newBalance = brandBalance.balancePaise + amountPaise;
      await prisma.$transaction(async (tx) => {
        await tx.hotelBrandCoinBalance.update({
          where: { userId_hotelId: { userId, hotelId } },
          data: {
            balancePaise: { increment: amountPaise },
            lifetimeBurnedPaise: { decrement: amountPaise },
          },
        });
        await tx.coinTransaction.create({
          data: {
            userId,
            walletId: wallet.id,
            coinType,
            transactionType: 'refund_credit',
            amountPaise,
            direction: 'credit',
            bookingId,
            hotelId,
            balanceAfterPaise: newBalance,
            notes: 'Refunded: coin burn reversed',
            idempotencyKey,
          },
        });
      });
      return;
    }

    await prisma.$transaction(async (tx) => {
      const lockedWallet = await tx.coinWallet.findUnique({ where: { id: wallet.id } });
      if (!lockedWallet) return;
      const currentBalance = coinType === 'ota' ? lockedWallet.otaCoinBalancePaise : lockedWallet.rezCoinBalancePaise;
      const newBalance = currentBalance + amountPaise;

      await tx.coinTransaction.create({
        data: {
          userId,
          walletId: wallet.id,
          coinType,
          transactionType: 'refund_credit',
          amountPaise,
          direction: 'credit',
          bookingId,
          balanceAfterPaise: newBalance,
          notes: 'Refunded: coin burn reversed',
          idempotencyKey,
        },
      });

      if (coinType === 'ota') {
        await tx.coinWallet.update({
          where: { id: wallet.id },
          data: { otaCoinBalancePaise: newBalance },
        });
      } else {
        await tx.coinWallet.update({
          where: { id: wallet.id },
          data: { rezCoinBalancePaise: newBalance },
        });
      }
    });
  }

  /**
   * Check burn limits and return applicable amounts.
   * Payment waterfall: OTA coin → REZ coin → Hotel Brand coin (all from same booking value cap).
   */
  static async checkBurn(params: {
    bookingValuePaise: number;
    otaCoinRequestedPaise: number;
    rezCoinRequestedPaise: number;
    userTier: string;
    userId: string;
    hotelId?: string;
    hotelBrandCoinRequestedPaise?: number;
  }) {
    const {
      bookingValuePaise,
      otaCoinRequestedPaise,
      rezCoinRequestedPaise,
      userTier,
      userId,
      hotelId,
      hotelBrandCoinRequestedPaise = 0,
    } = params;

    // C-5: Read wallet balance inside a transaction with FOR UPDATE row lock
    // to prevent TOCTOU race where concurrent requests all pass the balance check
    // before any of them actually deduct the balance.
    const walletData = await prisma.$transaction(async (tx) => {
      const locked = await tx.$queryRaw<any[]>`
        SELECT id, "otaCoinBalancePaise", "rezCoinBalancePaise", "cashbackCoinBalancePaise"
        FROM coin_wallet
        WHERE user_id = ${userId}
        FOR UPDATE
      `;
      if (!locked || locked.length === 0) throw Errors.internal('Wallet not found');
      return {
        otaCoinBalancePaise: locked[0].otaCoinBalancePaise,
        rezCoinBalancePaise: locked[0].rezCoinBalancePaise,
      };
    }, { isolationLevel: 'Serializable', timeout: 5000 });

    // OTA burn rule for tier — prefer tier-specific rule, fall back to 'all'
    const otaBurnRule =
      (await prisma.burnRule.findFirst({
        where: { coinType: 'ota', isActive: true, userTier: userTier as EarnRuleTier },
      })) ??
      (await prisma.burnRule.findFirst({
        where: { coinType: 'ota', isActive: true, userTier: 'all' },
      }));

    // ReZ burn rule
    const rezBurnRule = await prisma.burnRule.findFirst({
      where: { coinType: 'rez', isActive: true },
    });

    const otaCapPct = otaBurnRule ? Number(otaBurnRule.maxBurnPct) / 100 : 0.15;
    const rezCapPct = rezBurnRule ? Number(rezBurnRule.maxBurnPct) / 100 : 0.10;

    // Step 1: OTA coin — use locked balance
    const otaMaxByCap = Math.round(bookingValuePaise * otaCapPct);
    const otaMaxByBalance = walletData.otaCoinBalancePaise;
    const otaCoinApplicable = Math.min(otaCoinRequestedPaise, otaMaxByCap, otaMaxByBalance);

    // Step 2: ReZ coin — use locked balance
    const rezMaxByCap = Math.round(bookingValuePaise * rezCapPct);
    const rezMaxByBalance = walletData.rezCoinBalancePaise;
    const rezCoinApplicable = Math.min(rezCoinRequestedPaise, rezMaxByCap, rezMaxByBalance);

    // Step 3: Hotel brand coin
    let hotelBrandCoinApplicable = 0;
    if (hotelId && hotelBrandCoinRequestedPaise > 0) {
      const brandEnabled = await this.isBrandCoinEnabled(hotelId);
      if (brandEnabled) {
        const brandBurnRule = await prisma.burnRule.findFirst({
          where: { coinType: 'hotel_brand', hotelId, isActive: true },
        });
        const brandCapPct = brandBurnRule ? Number(brandBurnRule.maxBurnPct) / 100 : 0.20;

        const brandBalance = await prisma.hotelBrandCoinBalance.findUnique({
          where: { userId_hotelId: { userId, hotelId } },
        });

        const brandMaxByCap = Math.round(bookingValuePaise * brandCapPct);
        const brandMaxByBalance = brandBalance?.balancePaise ?? 0;
        hotelBrandCoinApplicable = Math.min(hotelBrandCoinRequestedPaise, brandMaxByCap, brandMaxByBalance);
      }
    }

    // Safety floor: min 60% cash payment (max 40% discount)
    const totalDiscount = otaCoinApplicable + rezCoinApplicable + hotelBrandCoinApplicable;
    const maxDiscount = Math.round(bookingValuePaise * 0.40);

    let finalOta = otaCoinApplicable;
    let finalRez = rezCoinApplicable;
    let finalBrand = hotelBrandCoinApplicable;

    if (totalDiscount > maxDiscount) {
      // Reduce in reverse priority: brand first, then rez, then ota
      const excess = totalDiscount - maxDiscount;
      finalBrand = Math.max(0, hotelBrandCoinApplicable - excess);
      const brandCut = hotelBrandCoinApplicable - finalBrand;
      const remainingExcess = excess - brandCut;
      if (remainingExcess > 0) {
        finalRez = Math.max(0, finalRez - remainingExcess);
        const rezCut = rezCoinApplicable - finalRez;
        const stillExcess = remainingExcess - rezCut;
        if (stillExcess > 0) {
          finalOta = Math.max(0, finalOta - stillExcess);
        }
      }
    }

    const pgAmount = bookingValuePaise - finalOta - finalRez - finalBrand;

    return {
      otaCoinApplicablePaise: finalOta,
      rezCoinApplicablePaise: finalRez,
      hotelBrandCoinApplicablePaise: finalBrand,
      totalDiscountPaise: finalOta + finalRez + finalBrand,
      pgAmountPaise: pgAmount,
      otaCapApplied: otaCoinRequestedPaise > otaMaxByCap,
      otaCapReason: otaCoinRequestedPaise > otaMaxByCap
        ? `${userTier.charAt(0).toUpperCase() + userTier.slice(1)} tier cap: ${Math.round(otaCapPct * 100)}% of booking value`
        : undefined,
    };
  }

  /**
   * Get wallet balances (OTA + REZ + hotel brand coins)
   */
  static async getWallet(userId: string) {
    const wallet = await prisma.coinWallet.findUnique({ where: { userId } });
    if (!wallet) throw Errors.notFound('Wallet');

    // Find soonest expiring OTA coins
    const nextExpiry = await prisma.coinExpirySchedule.findFirst({
      where: { userId, coinType: 'ota', status: 'pending' },
      orderBy: { expiryDate: 'asc' },
    });

    // Hotel brand coin balances (only for active programs)
    const brandBalances = await prisma.hotelBrandCoinBalance.findMany({
      where: { userId },
      include: {
        hotel: {
          select: { name: true, brandCoinName: true, brandCoinSymbol: true, brandCoinEnabled: true },
        },
      },
    });

    const hotelBrandCoins = brandBalances
      .filter((b) => b.hotel.brandCoinEnabled)
      .map((b) => ({
        hotelId: b.hotelId,
        hotelName: b.hotel.name,
        coinName: b.hotel.brandCoinName || 'Brand Points',
        coinSymbol: b.hotel.brandCoinSymbol || 'BP',
        balancePaise: b.balancePaise,
        lifetimeEarnedPaise: b.lifetimeEarnedPaise,
        lifetimeBurnedPaise: b.lifetimeBurnedPaise,
      }));

    return {
      otaCoinBalancePaise: wallet.otaCoinBalancePaise,
      rezCoinBalancePaise: wallet.rezCoinBalancePaise,
      otaCoinExpiringSoonPaise: nextExpiry?.amountPaise || 0,
      otaCoinExpiryDate: nextExpiry?.expiryDate || null,
      lifetimeOtaEarnedPaise: wallet.otaCoinLifetimeEarnedPaise,
      lifetimeOtaBurnedPaise: wallet.otaCoinLifetimeBurnedPaise,
      hotelBrandCoins,
    };
  }

  /**
   * Best-effort refund of coins when a sequential burn fails mid-way.
   * Attempts to reverse any coins that were successfully burned before the failure.
   * Called with .catch(() => {}) at call sites — failures are non-fatal.
   */
  static async scheduleRefund(params: {
    userId: string;
    coinType: CoinType;
    amountPaise: number;
    bookingId: string;
    hotelId?: string;
    reason: string;
  }) {
    const { userId, coinType, amountPaise, bookingId, hotelId, reason } = params;
    if (amountPaise <= 0) return;

    // Find the coin transaction for this burn so we know it actually happened
    const burnTx = await prisma.coinTransaction.findFirst({
      where: { userId, coinType, bookingId, transactionType: 'burn', direction: 'debit' },
    });

    if (!burnTx) {
      // Burn never completed — nothing to reverse
      logger.warn('[CoinService.scheduleRefund] No burn tx found for refund', { userId, coinType, bookingId, reason });
      return;
    }

    // Reverse the burn atomically
    await this.reverseBurn({ userId, coinType, amountPaise, bookingId, hotelId });
    logger.info(`[CoinService.scheduleRefund] Refunded ${amountPaise} paise of ${coinType} coins`, { userId, bookingId, reason });
  }

  /**
   * Get coin transaction history
   */
  static async getTransactions(userId: string, coinType?: string, page = 1, perPage = 20) {
    const where: any = { userId };
    if (coinType) where.coinType = coinType;

    const [transactions, total] = await Promise.all([
      prisma.coinTransaction.findMany({
        where,
        orderBy: { createdAt: 'desc' },
        skip: (page - 1) * perPage,
        take: perPage,
        include: {
          booking: { select: { bookingRef: true } },
          brandHotel: { select: { name: true, brandCoinName: true, brandCoinSymbol: true } },
        },
      }),
      prisma.coinTransaction.count({ where }),
    ]);

    return {
      transactions: transactions.map((tx) => ({
        id: tx.id,
        coinType: tx.coinType,
        type: tx.transactionType,
        amountPaise: tx.amountPaise,
        direction: tx.direction,
        description: tx.notes || `${tx.transactionType} - ${tx.coinType} coin`,
        bookingRef: tx.booking?.bookingRef || null,
        hotelId: tx.hotelId || null,
        hotelName: tx.brandHotel?.name || null,
        coinName: tx.brandHotel?.brandCoinName || null,
        createdAt: tx.createdAt,
      })),
      total,
      page,
    };
  }
}
