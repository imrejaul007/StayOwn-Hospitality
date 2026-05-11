/**
 * Booking DTOs (Data Transfer Objects)
 * STRAT-004: Modular structure for Hotel OTA
 */

import { z } from 'zod';

export const CreateBookingDto = z.object({
  roomTypeId: z.string().regex(/^[a-f\d]{24}$/i),
  guestId: z.string().regex(/^[a-f\d]{24}$/i),
  checkIn: z.string().datetime(),
  checkOut: z.string().datetime(),
  guestCount: z.number().int().min(1).max(10).default(1),
  guestDetails: z.array(z.object({
    name: z.string().min(1),
    phone: z.string().regex(/^\+?[1-9]\d{6,14}$/),
  })).optional(),
  specialRequests: z.string().max(500).optional(),
  source: z.enum(['ota', 'walkin', 'corporate']).default('ota'),
});

export const CancelBookingDto = z.object({
  bookingId: z.string().regex(/^[a-f\d]{24}$/i),
  reason: z.string().min(1).max(200),
  refundAmount: z.number().optional(), // Partial refund amount
});

export const BookingSearchDto = z.object({
  hotelId: z.string().regex(/^[a-f\d]{24}$/i).optional(),
  status: z.enum(['pending', 'confirmed', 'checked_in', 'checked_out', 'cancelled']).optional(),
  fromDate: z.string().datetime().optional(),
  toDate: z.string().datetime().optional(),
  page: z.coerce.number().int().min(1).default(1),
  limit: z.coerce.number().int().min(1).max(100).default(20),
});

export type CreateBookingInput = z.infer<typeof CreateBookingDto>;
export type CancelBookingInput = z.infer<typeof CancelBookingDto>;
export type BookingSearchInput = z.infer<typeof BookingSearchDto>;
