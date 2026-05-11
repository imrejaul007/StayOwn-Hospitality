import { prisma } from '../../config/database';
import { Errors } from '../../utils/errors';
import { Prisma } from '@prisma/client';

interface SearchParams {
  city: string;
  checkin: string;
  checkout: string;
  rooms?: number;
  guests?: number;
  category?: string;
  minRate?: number;
  maxRate?: number;
  lat?: number;
  lng?: number;
  radiusKm?: number;
  sort?: string;
  page?: number;
  perPage?: number;
}

export class HotelService {
  /**
   * Search available hotels for given dates
   */
  static async search(params: SearchParams) {
    const {
      city,
      checkin,
      checkout,
      rooms = 1,
      guests = 2,
      category,
      minRate,
      maxRate,
      sort = 'relevance',
      page = 1,
      perPage = 20,
    } = params;

    const checkinDate = new Date(checkin);
    const checkoutDate = new Date(checkout);

    // Build hotel filter
    const hotelWhere: Prisma.HotelWhereInput = {
      city: { equals: city, mode: 'insensitive' },
      onboardingStatus: 'active',
    };
    if (category) {
      hotelWhere.category = category as any;
    }

    // Find hotels with available inventory for all dates in range
    const hotels = await prisma.hotel.findMany({
      where: hotelWhere,
      include: {
        roomTypes: {
          where: { isActive: true, maxOccupancy: { gte: guests } },
          include: {
            inventorySlots: {
              where: {
                date: { gte: checkinDate, lt: checkoutDate },
                isBlocked: false,
                availableRooms: { gte: rooms },
              },
            },
          },
        },
      },
    });

    // Calculate number of nights needed
    const numNights = Math.ceil((checkoutDate.getTime() - checkinDate.getTime()) / (1000 * 60 * 60 * 24));

    // Filter to hotels that have availability for ALL dates
    const results = hotels
      .map((hotel) => {
        const availableRoomTypes = hotel.roomTypes
          .filter((rt) => rt.inventorySlots.length === numNights)
          .map((rt) => {
            const totalForStay = rt.inventorySlots.reduce((sum, slot) => sum + slot.ratePaise, 0) * rooms;
            const avgRate = Math.round(totalForStay / numNights / rooms);
            const minAvailable = Math.min(...rt.inventorySlots.map((s) => s.availableRooms));

            return {
              roomTypeId: rt.id,
              name: rt.name,
              ratePerNightPaise: avgRate,
              totalForStayPaise: totalForStay,
              availableCount: minAvailable,
              maxOccupancy: rt.maxOccupancy,
            };
          })
          .filter((rt) => {
            if (minRate && rt.ratePerNightPaise < minRate) return false;
            if (maxRate && rt.ratePerNightPaise > maxRate) return false;
            return true;
          });

        if (availableRoomTypes.length === 0) return null;

        const lowestRate = Math.min(...availableRoomTypes.map((rt) => rt.ratePerNightPaise));

        return {
          hotelId: hotel.id,
          name: hotel.name,
          slug: hotel.slug,
          starRating: hotel.starRating,
          category: hotel.category,
          address: [hotel.addressLine1, hotel.addressLine2, hotel.city].filter(Boolean).join(', '),
          latitude: hotel.latitude ? Number(hotel.latitude) : null,
          longitude: hotel.longitude ? Number(hotel.longitude) : null,
          thumbnailUrl: (hotel.images as string[])?.[0] || null,
          avgRating: null, // TODO: implement reviews
          reviewCount: 0,
          availableRoomTypes,
          otaCoinEarnPreviewPaise: Math.round(lowestRate * numNights * 0.06), // default 6%
          rezCoinEarnPreviewPaise: Math.round(lowestRate * numNights * 0.04), // default 4%
          amenities: hotel.amenities || [],
          _lowestRate: lowestRate,
        };
      })
      .filter(Boolean) as any[];

    // Sort results
    if (sort === 'price_asc') {
      results.sort((a, b) => a._lowestRate - b._lowestRate);
    } else if (sort === 'price_desc') {
      results.sort((a, b) => b._lowestRate - a._lowestRate);
    }

    // Remove internal sort field
    results.forEach((r) => delete r._lowestRate);

    // Paginate
    const total = results.length;
    const paginated = results.slice((page - 1) * perPage, page * perPage);

    return { total, page, results: paginated };
  }

  /**
   * Get full hotel detail
   */
  static async list(page = 1, perPage = 50) {
    const skip = Math.max(0, (page - 1) * perPage);
    const take = Math.min(perPage, 100);
    const hotels = await prisma.hotel.findMany({
      where: { onboardingStatus: 'active' },
      select: { id: true, name: true, city: true, addressLine1: true },
      orderBy: { name: 'asc' },
      skip,
      take,
    });
    return {
      results: hotels.map((h) => ({ hotelId: h.id, name: h.name, city: h.city, address: h.addressLine1 })),
    };
  }

  static async getById(hotelId: string) {
    const hotel = await prisma.hotel.findUnique({
      where: { id: hotelId },
      include: {
        roomTypes: { where: { isActive: true } },
      },
    });

    if (!hotel || hotel.onboardingStatus !== 'active') {
      throw Errors.notFound('Hotel');
    }

    return {
      hotelId: hotel.id,
      name: hotel.name,
      description: hotel.description,
      starRating: hotel.starRating,
      images: hotel.images || [],
      amenities: hotel.amenities || [],
      address: [hotel.addressLine1, hotel.addressLine2, hotel.city, hotel.pincode].filter(Boolean).join(', '),
      latitude: hotel.latitude ? Number(hotel.latitude) : null,
      longitude: hotel.longitude ? Number(hotel.longitude) : null,
      avgRating: null,
      policies: {
        checkinTime: '14:00',
        checkoutTime: '11:00',
        cancellationPolicy: 'Free cancellation until 24 hours before checkin',
      },
      roomTypes: hotel.roomTypes.map((rt) => ({
        roomTypeId: rt.id,
        name: rt.name,
        description: rt.description,
        maxOccupancy: rt.maxOccupancy,
        bedType: rt.bedType,
        sizeSqft: rt.sizeSqft,
        amenities: rt.amenities || [],
        images: rt.images || [],
        baseRatePaise: rt.baseRatePaise,
      })),
    };
  }
}
