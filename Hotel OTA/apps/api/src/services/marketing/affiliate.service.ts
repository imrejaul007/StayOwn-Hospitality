import { prisma } from '../../config/database';
import { Errors } from '../../utils/errors';

export class AffiliateService {
  static async createPartner(data: {
    name: string; code: string; commissionPct: number; type: string; contactEmail?: string;
  }) {
    return prisma.affiliatePartner.create({ data: {
      name: data.name, code: data.code, commissionPct: data.commissionPct,
      type: data.type, contactEmail: data.contactEmail,
    }});
  }

  static async trackClick(partnerCode: string, userId?: string) {
    const partner = await prisma.affiliatePartner.findUnique({ where: { code: partnerCode } });
    if (!partner || !partner.isActive) throw Errors.notFound('Affiliate partner');

    await prisma.$transaction(async (tx) => {
      await tx.affiliateTrackingEvent.create({
        data: { partnerId: partner.id, eventType: 'click', userId, metadata: { timestamp: new Date() } },
      });
      await tx.affiliatePartner.update({
        where: { id: partner.id },
        data: { totalClickCount: { increment: 1 } },
      });
    });
  }

  static async trackBooking(partnerCode: string, bookingId: string, bookingValuePaise: number) {
    const partner = await prisma.affiliatePartner.findUnique({ where: { code: partnerCode } });
    if (!partner) return;

    const commission = Math.round(bookingValuePaise * (Number(partner.commissionPct) / 100));

    await prisma.$transaction(async (tx) => {
      await tx.affiliateTrackingEvent.create({
        data: { partnerId: partner.id, eventType: 'booking', bookingId, commissionPaise: commission },
      });
      await tx.affiliatePartner.update({
        where: { id: partner.id },
        data: { totalBookings: { increment: 1 }, totalEarnedPaise: { increment: commission } },
      });
    });
  }

  static async listPartners() {
    return prisma.affiliatePartner.findMany({ orderBy: { totalBookings: 'desc' } });
  }

  static async getPartnerStats(partnerId: string) {
    const [partner, recentEvents] = await Promise.all([
      prisma.affiliatePartner.findUnique({ where: { id: partnerId } }),
      prisma.affiliateTrackingEvent.findMany({
        where: { partnerId }, orderBy: { createdAt: 'desc' }, take: 50,
      }),
    ]);
    return { partner, recentEvents };
  }
}
