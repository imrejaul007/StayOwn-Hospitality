import { prisma } from '../../config/database';
import { Errors } from '../../utils/errors';

export class CorporateService {
  static async createAccount(data: {
    companyName: string;
    gstin?: string;
    billingEmail?: string;
    billingAddress?: string;
    creditLimitPaise?: number;
    paymentTermsDays?: number;
  }) {
    return prisma.corporateAccount.create({ data: {
      companyName: data.companyName,
      gstin: data.gstin,
      billingEmail: data.billingEmail,
      billingAddress: data.billingAddress,
      creditLimitPaise: data.creditLimitPaise || 0,
      paymentTermsDays: data.paymentTermsDays || 30,
    }});
  }

  static async addUser(corporateAccountId: string, userId: string, role: 'admin' | 'traveller' | 'approver', costCenter?: string) {
    const account = await prisma.corporateAccount.findUnique({ where: { id: corporateAccountId } });
    if (!account) throw Errors.notFound('Corporate account');

    return prisma.corporateUser.create({ data: {
      corporateAccountId,
      userId,
      role,
      costCenter,
    }});
  }

  static async listAccounts(page = 1) {
    const [accounts, total] = await Promise.all([
      prisma.corporateAccount.findMany({
        orderBy: { createdAt: 'desc' },
        skip: (page - 1) * 20,
        take: 20,
        include: { _count: { select: { corporateUsers: true, bookings: true } } },
      }),
      prisma.corporateAccount.count(),
    ]);
    return { accounts, total, page };
  }

  static async getAccountDetail(id: string) {
    const account = await prisma.corporateAccount.findUnique({
      where: { id },
      include: {
        corporateUsers: { include: { user: { select: { fullName: true, phone: true, email: true } } } },
      },
    });
    if (!account) throw Errors.notFound('Corporate account');
    return account;
  }

  /**
   * Update corporate account details
   */
  static async updateAccount(id: string, data: {
    companyName?: string;
    gstin?: string;
    billingEmail?: string;
    billingAddress?: string;
    creditLimitPaise?: number;
    paymentTermsDays?: number;
    isActive?: boolean;
  }) {
    const account = await prisma.corporateAccount.findUnique({ where: { id } });
    if (!account) throw Errors.notFound('Corporate account');

    return prisma.corporateAccount.update({
      where: { id },
      data: {
        ...(data.companyName !== undefined && { companyName: data.companyName }),
        ...(data.gstin !== undefined && { gstin: data.gstin }),
        ...(data.billingEmail !== undefined && { billingEmail: data.billingEmail }),
        ...(data.billingAddress !== undefined && { billingAddress: data.billingAddress }),
        ...(data.creditLimitPaise !== undefined && { creditLimitPaise: data.creditLimitPaise }),
        ...(data.paymentTermsDays !== undefined && { paymentTermsDays: data.paymentTermsDays }),
        ...(data.isActive !== undefined && { isActive: data.isActive }),
      },
    });
  }

  /**
   * Deactivate corporate account
   */
  static async deactivateAccount(id: string) {
    const account = await prisma.corporateAccount.findUnique({ where: { id } });
    if (!account) throw Errors.notFound('Corporate account');

    return prisma.corporateAccount.update({
      where: { id },
      data: { isActive: false },
    });
  }

  /**
   * Update corporate user role/cost center
   */
  static async updateUser(corporateAccountId: string, corporateUserId: string, data: {
    role?: 'admin' | 'traveller' | 'approver';
    costCenter?: string;
    isActive?: boolean;
  }) {
    const user = await prisma.corporateUser.findFirst({
      where: { id: corporateUserId, corporateAccountId },
    });
    if (!user) throw Errors.notFound('Corporate user');

    return prisma.corporateUser.update({
      where: { id: corporateUserId },
      data: {
        ...(data.role !== undefined && { role: data.role }),
        ...(data.costCenter !== undefined && { costCenter: data.costCenter }),
        ...(data.isActive !== undefined && { isActive: data.isActive }),
      },
    });
  }

  /**
   * Remove user from corporate account
   */
  static async removeUser(corporateAccountId: string, corporateUserId: string) {
    const user = await prisma.corporateUser.findFirst({
      where: { id: corporateUserId, corporateAccountId },
    });
    if (!user) throw Errors.notFound('Corporate user');

    return prisma.corporateUser.update({
      where: { id: corporateUserId },
      data: { isActive: false },
    });
  }

  /**
   * Get corporate account bookings
   */
  static async getAccountBookings(corporateAccountId: string, page = 1, limit = 20) {
    const account = await prisma.corporateAccount.findUnique({ where: { id: corporateAccountId } });
    if (!account) throw Errors.notFound('Corporate account');

    const [bookings, total] = await Promise.all([
      prisma.booking.findMany({
        where: { corporateAccountId },
        orderBy: { createdAt: 'desc' },
        skip: (page - 1) * limit,
        take: limit,
        include: {
          hotel: { select: { id: true, name: true } },
          user: { select: { id: true, fullName: true } },
        },
      }),
      prisma.booking.count({ where: { corporateAccountId } }),
    ]);

    return {
      bookings: bookings.map(b => ({
        id: b.id,
        bookingRef: b.bookingRef,
        hotelId: b.hotel.id,
        hotelName: b.hotel.name,
        guestName: b.guestName || b.user.fullName,
        checkinDate: b.checkinDate,
        checkoutDate: b.checkoutDate,
        totalValuePaise: b.totalValuePaise,
        status: b.status,
        createdAt: b.createdAt,
      })),
      total,
      page,
    };
  }

  /**
   * Approve a corporate booking
   */
  static async approveBooking(corporateAccountId: string, bookingId: string) {
    const booking = await prisma.booking.findFirst({
      where: { id: bookingId, corporateAccountId },
    });
    if (!booking) throw Errors.notFound('Booking');

    // TODO: Implement actual approval logic with audit trail
    return { success: true, bookingId, status: 'approved' };
  }

  /**
   * Reject a corporate booking
   */
  static async rejectBooking(corporateAccountId: string, bookingId: string, reason: string) {
    const booking = await prisma.booking.findFirst({
      where: { id: bookingId, corporateAccountId },
    });
    if (!booking) throw Errors.notFound('Booking');

    // TODO: Implement actual rejection logic with audit trail
    return { success: true, bookingId, status: 'rejected', reason };
  }
}
