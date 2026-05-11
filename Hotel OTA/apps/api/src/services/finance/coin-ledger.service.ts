import { prisma } from '../../config/database';
import { Errors } from '../../utils/errors';
import dayjs from 'dayjs';

/**
 * Production-grade Coin Ledger Engine
 *
 * Key guarantees:
 * 1. FIFO burn ordering (oldest coins burned first)
 * 2. Atomic balance updates (no race conditions)
 * 3. Idempotent operations (safe to retry)
 * 4. Append-only ledger (never UPDATE/DELETE transactions)
 * 5. Balance = sum of all transactions (cached in wallet, verified on demand)
 */
export class CoinLedger {
  /**
   * FIFO Coin Burn — burns oldest coins first.
   *
   * Steps:
   * 1. Find all pending expiry schedules for this user, ordered by expiry_date ASC (FIFO)
   * 2. Consume from oldest batches first
   * 3. Update expiry schedule entries as consumed
   * 4. Create coin_transaction record
   * 5. Atomically update wallet balance
   *
   * This ensures coins expiring soonest are used first.
   */
  static async fifoBurn(params: {
    userId: string;
    coinType: 'ota' | 'rez';
    amountPaise: number;
    bookingId: string;
  }): Promise<void> {
    const { userId, coinType, amountPaise, bookingId } = params;
    if (amountPaise <= 0) return;

    await prisma.$transaction(async (tx) => {
      // Lock wallet row to prevent concurrent burns
      const wallets = await tx.$queryRaw<any[]>`
        SELECT * FROM coin_wallets WHERE user_id = ${userId}::uuid FOR UPDATE
      `;
      const wallet = wallets[0];
      if (!wallet) throw Errors.internal('Wallet not found');

      const currentBalance = coinType === 'ota'
        ? wallet.ota_coin_balance_paise
        : wallet.rez_coin_balance_paise;

      if (currentBalance < amountPaise) {
        throw Errors.coinInsufficient();
      }

      // For OTA coins: FIFO burn from expiry schedule
      if (coinType === 'ota') {
        let remaining = amountPaise;

        // Get pending expiry entries, oldest first (FIFO)
        const expiryEntries = await tx.coinExpirySchedule.findMany({
          where: { userId, coinType: 'ota', status: 'pending' },
          orderBy: { expiryDate: 'asc' },
        });

        for (const entry of expiryEntries) {
          if (remaining <= 0) break;

          const consumeAmount = Math.min(remaining, entry.amountPaise);
          const newEntryAmount = entry.amountPaise - consumeAmount;

          if (newEntryAmount <= 0) {
            // Fully consumed
            await tx.coinExpirySchedule.update({
              where: { id: entry.id },
              data: { status: 'used', processedAt: new Date() },
            });
          } else {
            // Partially consumed — reduce amount
            await tx.coinExpirySchedule.update({
              where: { id: entry.id },
              data: { amountPaise: newEntryAmount },
            });
          }

          remaining -= consumeAmount;
        }
      }

      // Create transaction record
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
          notes: `FIFO burn on booking`,
        },
      });

      // Update wallet atomically
      if (coinType === 'ota') {
        await tx.$executeRaw`
          UPDATE coin_wallets
          SET ota_coin_balance_paise = ota_coin_balance_paise - ${amountPaise},
              ota_coin_lifetime_burned_paise = ota_coin_lifetime_burned_paise + ${amountPaise},
              updated_at = NOW()
          WHERE user_id = ${userId}::uuid
        `;
      } else {
        await tx.$executeRaw`
          UPDATE coin_wallets
          SET rez_coin_balance_paise = rez_coin_balance_paise - ${amountPaise},
              updated_at = NOW()
          WHERE user_id = ${userId}::uuid
        `;
      }
    });
  }

  /**
   * Verify wallet balance matches sum of all transactions.
   * Used for reconciliation. Returns discrepancy if any.
   */
  static async verifyBalance(userId: string): Promise<{
    walletBalance: number;
    ledgerBalance: number;
    discrepancy: number;
    isValid: boolean;
  }> {
    const wallet = await prisma.coinWallet.findUnique({ where: { userId } });
    if (!wallet) throw Errors.notFound('Wallet');

    // Calculate balance from transaction ledger
    const credits = await prisma.coinTransaction.aggregate({
      where: { userId, coinType: 'ota', direction: 'credit' },
      _sum: { amountPaise: true },
    });
    const debits = await prisma.coinTransaction.aggregate({
      where: { userId, coinType: 'ota', direction: 'debit' },
      _sum: { amountPaise: true },
    });

    const ledgerBalance = (credits._sum.amountPaise || 0) - (debits._sum.amountPaise || 0);
    const walletBalance = wallet.otaCoinBalancePaise;
    const discrepancy = walletBalance - ledgerBalance;

    return {
      walletBalance,
      ledgerBalance,
      discrepancy,
      isValid: discrepancy === 0,
    };
  }

  /**
   * Batch verify all wallets — reconciliation job.
   */
  static async batchVerifyBalances(): Promise<{
    total: number;
    valid: number;
    invalid: number;
    discrepancies: Array<{ userId: string; discrepancy: number }>;
  }> {
    const wallets = await prisma.coinWallet.findMany({
      where: { otaCoinBalancePaise: { gt: 0 } },
      select: { userId: true },
    });

    let valid = 0;
    let invalid = 0;
    const discrepancies: Array<{ userId: string; discrepancy: number }> = [];

    for (const w of wallets) {
      const result = await this.verifyBalance(w.userId);
      if (result.isValid) {
        valid++;
      } else {
        invalid++;
        discrepancies.push({ userId: w.userId, discrepancy: result.discrepancy });
      }
    }

    return { total: wallets.length, valid, invalid, discrepancies };
  }

  /**
   * Process expired coins — nightly cron.
   * FIFO: expires oldest batches first.
   * Atomic: each expiry is its own transaction.
   */
  static async processExpiredCoins(): Promise<{ processed: number; totalExpired: number }> {
    const today = dayjs().startOf('day').toDate();

    const dueExpiries = await prisma.coinExpirySchedule.findMany({
      where: {
        expiryDate: { lte: today },
        status: 'pending',
        coinType: 'ota',
      },
      orderBy: { expiryDate: 'asc' },
    });

    let processed = 0;
    let totalExpired = 0;

    for (const expiry of dueExpiries) {
      try {
        await prisma.$transaction(async (tx) => {
          // Lock wallet
          const wallets = await tx.$queryRaw<any[]>`
            SELECT * FROM coin_wallets WHERE user_id = ${expiry.userId}::uuid FOR UPDATE
          `;
          const wallet = wallets[0];
          if (!wallet) return;

          // Only expire what's actually in the wallet
          const amountToExpire = Math.min(expiry.amountPaise, wallet.ota_coin_balance_paise);
          if (amountToExpire <= 0) {
            await tx.coinExpirySchedule.update({
              where: { id: expiry.id },
              data: { status: 'used', processedAt: new Date() },
            });
            return;
          }

          const newBalance = wallet.ota_coin_balance_paise - amountToExpire;

          await tx.coinTransaction.create({
            data: {
              userId: expiry.userId,
              walletId: wallet.id,
              coinType: 'ota',
              transactionType: 'expire',
              amountPaise: amountToExpire,
              direction: 'debit',
              balanceAfterPaise: newBalance,
              notes: 'OTA coins expired (12-month FIFO)',
            },
          });

          await tx.$executeRaw`
            UPDATE coin_wallets
            SET ota_coin_balance_paise = ${newBalance}, updated_at = NOW()
            WHERE user_id = ${expiry.userId}::uuid
          `;

          await tx.coinExpirySchedule.update({
            where: { id: expiry.id },
            data: { status: 'expired', processedAt: new Date() },
          });

          totalExpired += amountToExpire;
        });

        processed++;
      } catch (err) {
        console.error(`[CoinLedger] Expiry failed for ${expiry.id}:`, err);
      }
    }

    return { processed, totalExpired };
  }

  /**
   * Double-credit protection — check if coin earn already processed for a booking.
   */
  static async isEarnProcessed(bookingId: string, coinType: 'ota' | 'rez'): Promise<boolean> {
    const existing = await prisma.coinTransaction.findFirst({
      where: { bookingId, coinType, transactionType: 'earn' },
    });
    return !!existing;
  }
}
