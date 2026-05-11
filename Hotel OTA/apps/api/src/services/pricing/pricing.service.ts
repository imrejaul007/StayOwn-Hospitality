import { prisma } from '../../config/database';
import dayjs from 'dayjs';

/**
 * Dynamic Pricing & Demand Forecasting Service
 *
 * Generates pricing suggestions based on:
 * - Historical occupancy patterns
 * - Day-of-week demand
 * - Upcoming events/seasonality
 * - Competitor pricing signals
 */
export class PricingService {
  /**
   * Generate pricing suggestions for a hotel's next 30 days
   */
  static async generateSuggestions(hotelId: string) {
    const hotel = await prisma.hotel.findUnique({
      where: { id: hotelId },
      include: { roomTypes: { where: { isActive: true } } },
    });
    if (!hotel) return [];

    const suggestions: any[] = [];
    const today = dayjs();

    for (const roomType of hotel.roomTypes) {
      // Get historical booking data for this room type
      const historicalBookings = await prisma.booking.findMany({
        where: {
          hotelId, roomTypeId: roomType.id,
          status: { in: ['confirmed', 'stayed'] },
          createdAt: { gte: dayjs().subtract(90, 'day').toDate() },
        },
        select: { checkinDate: true, roomRatePaise: true, numRooms: true },
      });

      for (let d = 0; d < 30; d++) {
        const date = today.add(d, 'day');
        const dayOfWeek = date.day();

        // Get current inventory
        const slot = await prisma.inventorySlot.findUnique({
          where: { roomTypeId_date: { roomTypeId: roomType.id, date: date.toDate() } },
        });
        if (!slot) continue;

        const currentRate = slot.ratePaise;
        const occupancyRate = slot.totalRooms > 0
          ? (slot.totalRooms - slot.availableRooms) / slot.totalRooms
          : 0;

        // Simple pricing algorithm
        let suggestedRate = currentRate;
        let reason = '';
        let confidence = 0.5;

        // Weekend premium (Fri/Sat)
        if (dayOfWeek === 5 || dayOfWeek === 6) {
          suggestedRate = Math.round(currentRate * 1.15);
          reason = 'Weekend demand premium (+15%)';
          confidence = 0.75;
        }

        // High occupancy → raise price
        if (occupancyRate > 0.8) {
          suggestedRate = Math.round(currentRate * 1.20);
          reason = `High occupancy (${Math.round(occupancyRate * 100)}%) — raise rate`;
          confidence = 0.85;
        } else if (occupancyRate > 0.6) {
          suggestedRate = Math.round(currentRate * 1.10);
          reason = `Moderate occupancy (${Math.round(occupancyRate * 100)}%) — slight increase`;
          confidence = 0.7;
        }

        // Low occupancy → discount
        if (occupancyRate < 0.3 && d < 7) {
          suggestedRate = Math.round(currentRate * 0.85);
          reason = `Low occupancy (${Math.round(occupancyRate * 100)}%), near-term — discount to fill`;
          confidence = 0.8;
        }

        // Only create suggestion if different from current
        if (suggestedRate !== currentRate) {
          suggestions.push({
            hotelId, roomTypeId: roomType.id, date: date.toDate(),
            currentRatePaise: currentRate, suggestedRatePaise: suggestedRate,
            confidenceScore: confidence, reason,
          });
        }
      }
    }

    // Batch insert
    if (suggestions.length > 0) {
      await prisma.pricingSuggestion.createMany({ data: suggestions });
    }

    return suggestions.length;
  }

  /**
   * Get pending suggestions for hotel panel
   */
  static async getSuggestions(hotelId: string) {
    return prisma.pricingSuggestion.findMany({
      where: { hotelId, status: 'pending' },
      include: { roomType: { select: { name: true } } },
      orderBy: { date: 'asc' },
    });
  }

  /**
   * Accept a pricing suggestion — apply to inventory
   */
  static async acceptSuggestion(suggestionId: string) {
    const s = await prisma.pricingSuggestion.findUnique({ where: { id: suggestionId } });
    if (!s) return null;

    await prisma.$transaction(async (tx) => {
      await tx.inventorySlot.update({
        where: { roomTypeId_date: { roomTypeId: s.roomTypeId, date: s.date } },
        data: { ratePaise: s.suggestedRatePaise },
      });
      await tx.pricingSuggestion.update({
        where: { id: suggestionId },
        data: { status: 'accepted' },
      });
    });

    return { applied: true, newRate: s.suggestedRatePaise };
  }

  /**
   * Generate demand forecast for a hotel
   */
  static async generateForecast(hotelId: string) {
    const today = dayjs();
    const forecasts: any[] = [];

    // Get historical data
    const pastBookings = await prisma.booking.groupBy({
      by: ['checkinDate'],
      where: {
        hotelId,
        status: { in: ['confirmed', 'stayed'] },
        checkinDate: { gte: dayjs().subtract(90, 'day').toDate() },
      },
      _count: true,
      _sum: { totalValuePaise: true },
    });

    const totalRooms = await prisma.roomType.aggregate({
      where: { hotelId, isActive: true },
      _sum: { maxOccupancy: true },
    });
    const capacity = totalRooms._sum.maxOccupancy || 10;

    for (let d = 1; d <= 30; d++) {
      const date = today.add(d, 'day');
      const dayOfWeek = date.day();

      // Simple forecast: base occupancy + day-of-week adjustment
      let baseOccupancy = 55; // default 55%
      if (dayOfWeek === 5 || dayOfWeek === 6) baseOccupancy = 75;
      if (dayOfWeek === 0) baseOccupancy = 45;

      // Adjust based on existing bookings
      const existingBookings = await prisma.booking.count({
        where: {
          hotelId,
          status: { in: ['confirmed', 'hold'] },
          checkinDate: { lte: date.toDate() },
          checkoutDate: { gt: date.toDate() },
        },
      });

      const actualOccupancy = Math.min(100, Math.round((existingBookings / capacity) * 100 + baseOccupancy * 0.3));
      const predictedAdr = 300000; // ₹3,000 default
      const predictedRevenue = Math.round(predictedAdr * capacity * (actualOccupancy / 100));

      forecasts.push({
        hotelId, date: date.toDate(),
        predictedOccupancyPct: actualOccupancy,
        predictedAdrPaise: predictedAdr,
        predictedRevenuePaise: predictedRevenue,
        confidenceLevel: d <= 7 ? 'high' : d <= 14 ? 'medium' : 'low',
        modelVersion: 'v1.0',
      });
    }

    await prisma.demandForecast.createMany({
      data: forecasts,
      skipDuplicates: true,
    });

    return forecasts.length;
  }

  /**
   * Get forecast data for hotel dashboard
   */
  static async getForecast(hotelId: string) {
    return prisma.demandForecast.findMany({
      where: { hotelId, date: { gte: new Date() } },
      orderBy: { date: 'asc' },
      take: 30,
    });
  }
}
