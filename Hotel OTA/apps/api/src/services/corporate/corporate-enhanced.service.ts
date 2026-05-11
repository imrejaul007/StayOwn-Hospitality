import { prisma } from '../../config/database';
import { Errors } from '../../utils/errors';
import dayjs from 'dayjs';

/**
 * Enhanced Corporate Service
 * Handles travel policies, approval workflows, negotiated rates, and invoicing.
 */
export class CorporateEnhanced {
  /**
   * Check if a corporate booking needs approval.
   * Rules:
   * - Bookings over policy limit need approver sign-off
   * - Weekend bookings may need approval
   * - Out-of-policy hotels need approval
   */
  static async checkApprovalRequired(corporateAccountId: string, userId: string, bookingValuePaise: number): Promise<{
    required: boolean;
    reason?: string;
    approverIds: string[];
  }> {
    const corpUser = await prisma.corporateUser.findFirst({
      where: { corporateAccountId, userId, isActive: true },
      include: { corporateAccount: true },
    });

    if (!corpUser) throw Errors.notFound('Corporate user');

    // Admin role = no approval needed
    if (corpUser.role === 'admin') {
      return { required: false, approverIds: [] };
    }

    // Check credit limit
    const account = corpUser.corporateAccount;
    const remainingCredit = account.creditLimitPaise - account.usedCreditPaise;

    if (bookingValuePaise > remainingCredit) {
      return {
        required: true,
        reason: 'Exceeds remaining credit limit',
        approverIds: await this.getApprovers(corporateAccountId),
      };
    }

    // Default policy: bookings over ₹10,000 need approval for travellers
    if (corpUser.role === 'traveller' && bookingValuePaise > 1000000) {
      return {
        required: true,
        reason: 'Booking exceeds ₹10,000 policy limit',
        approverIds: await this.getApprovers(corporateAccountId),
      };
    }

    return { required: false, approverIds: [] };
  }

  /**
   * Get approver user IDs for a corporate account
   */
  static async getApprovers(corporateAccountId: string): Promise<string[]> {
    const approvers = await prisma.corporateUser.findMany({
      where: { corporateAccountId, role: { in: ['admin', 'approver'] }, isActive: true },
      select: { userId: true },
    });
    return approvers.map((a) => a.userId);
  }

  /**
   * Process corporate booking on credit (no PG payment).
   * Deducts from company credit limit.
   */
  static async processOnCredit(corporateAccountId: string, bookingId: string, amountPaise: number): Promise<void> {
    await prisma.$transaction(async (tx) => {
      const account = await tx.corporateAccount.findUnique({ where: { id: corporateAccountId } });
      if (!account) throw Errors.notFound('Corporate account');

      const remaining = account.creditLimitPaise - account.usedCreditPaise;
      if (amountPaise > remaining) {
        throw Errors.validation(`Insufficient credit. Remaining: ₹${remaining / 100}`);
      }

      await tx.corporateAccount.update({
        where: { id: corporateAccountId },
        data: { usedCreditPaise: { increment: amountPaise } },
      });

      await tx.booking.update({
        where: { id: bookingId },
        data: { paymentMethod: 'corporate_credit', paymentStatus: 'paid' },
      });
    });
  }

  /**
   * Generate monthly invoice for a corporate account.
   * Aggregates all bookings in the period.
   */
  static async generateInvoice(corporateAccountId: string, month: string): Promise<{
    invoiceNumber: string;
    companyName: string;
    gstin: string | null;
    period: string;
    bookings: any[];
    subtotalPaise: number;
    gstPaise: number;
    totalPaise: number;
  }> {
    const account = await prisma.corporateAccount.findUnique({ where: { id: corporateAccountId } });
    if (!account) throw Errors.notFound('Corporate account');

    const startOfMonth = dayjs(month).startOf('month').toDate();
    const endOfMonth = dayjs(month).endOf('month').toDate();

    const bookings = await prisma.booking.findMany({
      where: {
        corporateAccountId,
        status: { in: ['confirmed', 'checked_in', 'stayed'] },
        createdAt: { gte: startOfMonth, lte: endOfMonth },
      },
      include: {
        hotel: { select: { name: true } },
        user: { select: { fullName: true } },
      },
    });

    const subtotalPaise = bookings.reduce((sum, b) => sum + b.totalValuePaise, 0);
    const gstPaise = Math.round(subtotalPaise * 0.18);
    const totalPaise = subtotalPaise + gstPaise;

    const invoiceNumber = `INV-${account.companyName.slice(0, 3).toUpperCase()}-${dayjs(month).format('YYYYMM')}-${Date.now().toString(36).slice(-4).toUpperCase()}`;

    return {
      invoiceNumber,
      companyName: account.companyName,
      gstin: account.gstin,
      period: dayjs(month).format('MMMM YYYY'),
      bookings: bookings.map((b) => ({
        bookingRef: b.bookingRef,
        hotelName: b.hotel.name,
        traveller: b.guestName || b.user.fullName,
        checkinDate: b.checkinDate,
        checkoutDate: b.checkoutDate,
        amountPaise: b.totalValuePaise,
      })),
      subtotalPaise,
      gstPaise,
      totalPaise,
    };
  }

  /**
   * Get corporate dashboard data.
   */
  static async getDashboard(corporateAccountId: string): Promise<{
    account: any;
    thisMonth: { bookings: number; spendPaise: number };
    topTravellers: any[];
    recentBookings: any[];
  }> {
    const startOfMonth = dayjs().startOf('month').toDate();

    const [account, monthBookings, topTravellers, recentBookings] = await Promise.all([
      prisma.corporateAccount.findUnique({
        where: { id: corporateAccountId },
        include: { _count: { select: { corporateUsers: true } } },
      }),
      prisma.booking.aggregate({
        where: { corporateAccountId, createdAt: { gte: startOfMonth } },
        _count: true,
        _sum: { totalValuePaise: true },
      }),
      prisma.booking.groupBy({
        by: ['userId'],
        where: { corporateAccountId, createdAt: { gte: dayjs().subtract(90, 'day').toDate() } },
        _count: true,
        _sum: { totalValuePaise: true },
        orderBy: { _sum: { totalValuePaise: 'desc' } },
        take: 5,
      }),
      prisma.booking.findMany({
        where: { corporateAccountId },
        include: { hotel: { select: { name: true } }, user: { select: { fullName: true } } },
        orderBy: { createdAt: 'desc' },
        take: 10,
      }),
    ]);

    return {
      account,
      thisMonth: {
        bookings: monthBookings._count,
        spendPaise: monthBookings._sum.totalValuePaise || 0,
      },
      topTravellers,
      recentBookings: recentBookings.map((b) => ({
        bookingRef: b.bookingRef,
        hotel: b.hotel.name,
        traveller: b.guestName || b.user.fullName,
        amount: b.totalValuePaise,
        status: b.status,
        date: b.createdAt,
      })),
    };
  }
}
