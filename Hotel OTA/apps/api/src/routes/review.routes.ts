import { Router, Request, Response } from 'express';
import { asyncHandler } from '../middleware/asyncHandler';
import { authenticateUser } from '../middleware/auth';
import { prisma } from '../config/database';
import { Errors } from '../utils/errors';
import { q, qInt } from '../utils/query';

const router = Router();

/**
 * POST /reviews — Submit a review for a completed booking
 */
router.post('/reviews', authenticateUser, asyncHandler(async (req: Request, res: Response) => {
  const { booking_id, rating, cleanliness, location, value, service, comment } = req.body;
  if (!booking_id || !rating) throw Errors.validation('booking_id and rating required');
  if (rating < 1 || rating > 5) throw Errors.validation('Rating must be 1-5');

  const booking = await prisma.booking.findUnique({ where: { id: booking_id } });
  if (!booking) throw Errors.notFound('Booking');
  if (booking.userId !== req.user!.userId) throw Errors.forbidden();
  if (!['stayed', 'checked_in'].includes(booking.status)) throw Errors.validation('Can only review completed stays');

  // Check if already reviewed
  const existing = await prisma.review.findUnique({ where: { bookingId: booking_id } });
  if (existing) throw Errors.validation('Already reviewed this booking');

  const review = await prisma.review.create({
    data: {
      userId: req.user!.userId,
      hotelId: booking.hotelId,
      bookingId: booking_id,
      rating,
      cleanliness: cleanliness || null,
      location: location || null,
      value: value || null,
      service: service || null,
      comment: comment || null,
    },
  });

  res.status(201).json(review);
}));

/**
 * GET /reviews/hotel/:hotelId — Get reviews for a hotel
 */
router.get('/reviews/hotel/:hotelId', asyncHandler(async (req: Request, res: Response) => {
  const page = qInt(req, 'page') || 1;
  const perPage = qInt(req, 'per_page') || 10;

  const [reviews, total, avgRating] = await Promise.all([
    prisma.review.findMany({
      where: { hotelId: req.params.hotelId, isPublished: true },
      include: { user: { select: { fullName: true } } },
      orderBy: { createdAt: 'desc' },
      skip: (page - 1) * perPage,
      take: perPage,
    }),
    prisma.review.count({ where: { hotelId: req.params.hotelId, isPublished: true } }),
    prisma.review.aggregate({
      where: { hotelId: req.params.hotelId, isPublished: true },
      _avg: { rating: true, cleanliness: true, location: true, value: true, service: true },
    }),
  ]);

  res.json({
    reviews: reviews.map((r) => ({
      id: r.id,
      userName: r.user.fullName || 'Guest',
      rating: r.rating,
      cleanliness: r.cleanliness,
      location: r.location,
      value: r.value,
      service: r.service,
      comment: r.comment,
      createdAt: r.createdAt,
    })),
    total,
    page,
    averages: {
      overall: avgRating._avg.rating ? Number(avgRating._avg.rating.toFixed(1)) : null,
      cleanliness: avgRating._avg.cleanliness ? Number(avgRating._avg.cleanliness.toFixed(1)) : null,
      location: avgRating._avg.location ? Number(avgRating._avg.location.toFixed(1)) : null,
      value: avgRating._avg.value ? Number(avgRating._avg.value.toFixed(1)) : null,
      service: avgRating._avg.service ? Number(avgRating._avg.service.toFixed(1)) : null,
    },
  });
}));

/**
 * POST /wishlists/:hotelId — Add hotel to wishlist
 */
router.post('/wishlists/:hotelId', authenticateUser, asyncHandler(async (req: Request, res: Response) => {
  await prisma.wishlist.upsert({
    where: { userId_hotelId: { userId: req.user!.userId, hotelId: req.params.hotelId } },
    create: { userId: req.user!.userId, hotelId: req.params.hotelId },
    update: {},
  });
  res.json({ saved: true });
}));

/**
 * DELETE /wishlists/:hotelId — Remove from wishlist
 */
router.delete('/wishlists/:hotelId', authenticateUser, asyncHandler(async (req: Request, res: Response) => {
  await prisma.wishlist.deleteMany({
    where: { userId: req.user!.userId, hotelId: req.params.hotelId },
  });
  res.json({ removed: true });
}));

/**
 * GET /wishlists — Get user's wishlist
 */
router.get('/wishlists', authenticateUser, asyncHandler(async (req: Request, res: Response) => {
  const wishlists = await prisma.wishlist.findMany({
    where: { userId: req.user!.userId },
    include: {
      hotel: { select: { id: true, name: true, slug: true, city: true, starRating: true, category: true, images: true, addressLine1: true } },
    },
    orderBy: { createdAt: 'desc' },
  });

  res.json({
    hotels: wishlists.map((w) => ({
      hotelId: w.hotel.id,
      name: w.hotel.name,
      city: w.hotel.city,
      starRating: w.hotel.starRating,
      category: w.hotel.category,
      address: w.hotel.addressLine1,
      thumbnailUrl: (w.hotel.images as string[])?.[0] || null,
      savedAt: w.createdAt,
    })),
  });
}));

export default router;
