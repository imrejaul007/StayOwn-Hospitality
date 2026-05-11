import { prisma } from '../../config/database';
import dayjs from 'dayjs';

interface AttributionResult {
  partner: string | null;
  type: 'first_touch' | 'campaign_override' | 'none';
  demandFeePct: number;
  campaignId: string | null;
}

/**
 * Attribution engine per spec:
 * 1. Campaign override (7-day last touch)
 * 2. First touch (12-month window with decaying fee)
 * 3. No attribution
 */
export class AttributionService {
  static async resolveAttribution(
    userId: string,
    rezCampaignId?: string | null,
    rezSessionId?: string | null
  ): Promise<AttributionResult> {
    const user = await prisma.user.findUnique({ where: { id: userId } });
    if (!user) {
      return { partner: null, type: 'none', demandFeePct: 0, campaignId: null };
    }

    // Check campaign override first (7-day last touch)
    if (rezCampaignId && user.lastCampaignClickTs) {
      const daysSinceClick = dayjs().diff(dayjs(user.lastCampaignClickTs), 'day');
      if (daysSinceClick <= 7) {
        return {
          partner: 'rez',
          type: 'campaign_override',
          demandFeePct: 1.0,
          campaignId: rezCampaignId,
        };
      }
    }

    // Check first touch window
    if (user.attributionPartner === 'rez' && user.attributionExpiryTs) {
      const firstTouchStart = dayjs(user.attributionExpiryTs).subtract(12, 'month');
      const monthsSinceFirst = dayjs().diff(firstTouchStart, 'month');

      if (monthsSinceFirst <= 6) {
        return { partner: 'rez', type: 'first_touch', demandFeePct: 1.0, campaignId: null };
      } else if (monthsSinceFirst <= 12) {
        return { partner: 'rez', type: 'first_touch', demandFeePct: 0.5, campaignId: null };
      }
    }

    // No attribution
    return { partner: null, type: 'none', demandFeePct: 0, campaignId: null };
  }

  /**
   * Set first-touch attribution for a new user coming via ReZ
   */
  static async setFirstTouch(userId: string, rezUserId: string): Promise<void> {
    await prisma.user.update({
      where: { id: userId },
      data: {
        attributionSource: 'rez_app',
        attributionPartner: 'rez',
        attributionExpiryTs: dayjs().add(12, 'month').toDate(),
        rezUserId,
      },
    });
  }

  /**
   * Update campaign click timestamp
   */
  static async recordCampaignClick(userId: string, campaignId: string): Promise<void> {
    await prisma.user.update({
      where: { id: userId },
      data: {
        lastCampaignClickTs: new Date(),
        lastCampaignId: campaignId,
      },
    });
  }
}
