import { Router, Request, Response } from 'express';
import { prisma } from '../config/database';
import { authenticateUser, authenticateHotelStaff } from '../middleware/auth';
import { logger } from '../config/logger';

const router = Router();

// ─── Types ──────────────────────────────────────────────────────────────────────

interface BundleService {
  id: string;
  name: string;
  description?: string;
  icon: string;
  included: boolean;
}

interface Bundle {
  id: string;
  name: string;
  description: string;
  pricePaise: number;
  originalPricePaise?: number;
  discountPercent?: number;
  image?: string;
  category: string;
  services: BundleService[];
  duration?: string;
  available: boolean;
  badges?: string[];
  isPopular?: boolean;
  isAiSuggested?: boolean;
  suggestedReason?: string;
  hotelId: string;
  createdAt: Date;
  updatedAt: Date;
}

interface BundleOrder {
  id: string;
  bundleId: string;
  bundleName: string;
  bookingId: string;
  roomId: string;
  guestId: string;
  hotelId: string;
  status: 'pending' | 'confirmed' | 'in_progress' | 'completed' | 'cancelled';
  scheduledFor?: Date;
  notes?: string;
  totalAmountPaise: number;
  createdAt: Date;
  updatedAt: Date;
  completedAt?: Date;
}

// ─── Default Bundles ────────────────────────────────────────────────────────────

const DEFAULT_BUNDLES: Omit<Bundle, 'hotelId' | 'createdAt' | 'updatedAt'>[] = [
  {
    id: 'romantic-dinner',
    name: 'Romantic Dinner',
    description: 'Candlelit dinner with champagne, rose petals, and a personalized menu',
    pricePaise: 450000,
    originalPricePaise: 600000,
    discountPercent: 25,
    category: 'romantic',
    services: [
      { id: 'dinner', name: 'Candlelit Dinner', description: '3-course meal for two', icon: 'utensils', included: true },
      { id: 'champagne', name: 'Champagne', description: 'Premium bottle', icon: 'heart', included: true },
      { id: 'decoration', name: 'Room Decoration', description: 'Rose petals & candles', icon: 'sparkles', included: true },
    ],
    duration: '3 hours',
    available: true,
    badges: ['Couples Favorite'],
    isPopular: true,
  },
  {
    id: 'spa-combo',
    name: 'Spa Relaxation Combo',
    description: 'Full body massage and rejuvenating facial for ultimate relaxation',
    pricePaise: 800000,
    originalPricePaise: 1000000,
    discountPercent: 20,
    category: 'spa',
    services: [
      { id: 'massage', name: 'Full Body Massage', description: '60 minutes', icon: 'spa', included: true },
      { id: 'facial', name: 'Facial Treatment', description: '45 minutes', icon: 'leaf', included: true },
      { id: 'steam', name: 'Steam Room Access', description: '30 minutes', icon: 'spa', included: true },
    ],
    duration: '2.5 hours',
    available: true,
    badges: ['Best Value'],
    isPopular: true,
  },
  {
    id: 'late-checkout-breakfast',
    name: 'Late Checkout + Breakfast',
    description: 'Extended checkout until 4 PM with breakfast in bed',
    pricePaise: 150000,
    category: 'convenience',
    services: [
      { id: 'late-checkout', name: 'Late Checkout', description: 'Until 4 PM', icon: 'clock', included: true },
      { id: 'breakfast', name: 'Breakfast in Bed', description: 'Full breakfast', icon: 'utensils', included: true },
    ],
    duration: 'Until 4 PM',
    available: true,
  },
  {
    id: 'airport-transfer-lounge',
    name: 'Airport Transfer + Lounge',
    description: 'Premium airport pickup with lounge access',
    pricePaise: 350000,
    category: 'transport',
    services: [
      { id: 'pickup', name: 'Airport Pickup', description: 'Premium sedan', icon: 'car', included: true },
      { id: 'lounge', name: 'Lounge Access', description: '2 persons', icon: 'sparkles', included: true },
      { id: 'wifi', name: 'Portable WiFi', description: 'Unlimited data', icon: 'sparkles', included: true },
    ],
    duration: 'As needed',
    available: true,
    badges: ['Business Traveler'],
  },
  {
    id: 'birthday-special',
    name: 'Birthday Special',
    description: 'Celebrate with cake, decorations, and surprise gift',
    pricePaise: 300000,
    category: 'celebration',
    services: [
      { id: 'cake', name: 'Birthday Cake', description: 'Custom flavor', icon: 'party', included: true },
      { id: 'decoration', name: 'Room Setup', description: 'Balloons & banners', icon: 'sparkles', included: true },
      { id: 'gift', name: 'Surprise Gift', description: 'Hotel merchandise', icon: 'party', included: true },
      { id: 'breakfast', name: 'Special Breakfast', description: 'Birthday special', icon: 'utensils', included: true },
    ],
    duration: 'All day',
    available: true,
    badges: ['Special Occasion'],
    isPopular: true,
  },
  {
    id: 'staycation-package',
    name: 'Weekend Staycation',
    description: 'Pool access, spa treatment, and dinner - everything for a perfect staycation',
    pricePaise: 1500000,
    originalPricePaise: 2000000,
    discountPercent: 25,
    category: 'staycation',
    services: [
      { id: 'pool', name: 'Pool Access', description: 'Full day', icon: 'sun', included: true },
      { id: 'spa', name: 'Spa Treatment', description: '45 minutes', icon: 'spa', included: true },
      { id: 'dinner', name: 'Dinner', description: 'Buffet for two', icon: 'utensils', included: true },
      { id: 'breakfast', name: 'Breakfast', description: 'Next morning', icon: 'utensils', included: true },
    ],
    duration: '24 hours',
    available: true,
    badges: ['Weekend Deal'],
    isAiSuggested: true,
    suggestedReason: 'Perfect for a quick getaway',
  },
  {
    id: 'anniversary-package',
    name: 'Anniversary Celebration',
    description: 'Romantic dinner, couples massage, and champagne to celebrate your special day',
    pricePaise: 850000,
    category: 'celebration',
    services: [
      { id: 'dinner', name: 'Romantic Dinner', description: '4-course meal', icon: 'utensils', included: true },
      { id: 'massage', name: 'Couples Massage', description: '60 minutes', icon: 'spa', included: true },
      { id: 'champagne', name: 'Champagne', description: 'Premium bottle', icon: 'heart', included: true },
      { id: 'cake', name: 'Anniversary Cake', description: 'Custom design', icon: 'party', included: true },
    ],
    duration: 'Full evening',
    available: true,
    badges: ['Most Booked'],
    isAiSuggested: true,
    suggestedReason: 'Popular for special occasions',
  },
];

// ─── Routes ─────────────────────────────────────────────────────────────────────

/**
 * Get available bundles for a hotel
 * GET /api/bundles/:hotelId
 */
router.get('/:hotelId', async (req: Request, res: Response) => {
  try {
    const { hotelId } = req.params;

    // Get hotel bundles from database
    const hotelBundles = await prisma.hotelBundle.findMany({
      where: {
        hotelId,
        available: true,
      },
      orderBy: [
        { isPopular: 'desc' },
        { createdAt: 'desc' },
      ],
    });

    // If no custom bundles, return defaults with hotelId
    const bundles: Bundle[] = hotelBundles.length > 0
      ? hotelBundles.map(b => ({
          id: b.id,
          name: b.name,
          description: b.description || '',
          pricePaise: b.pricePaise || b.basePricePaise,
          originalPricePaise: b.originalPricePaise,
          discountPercent: b.discountPct,
          category: b.category || '',
          services: b.services ? JSON.parse(b.services) : [],
          available: b.available,
          badges: b.badges ? JSON.parse(b.badges) : [],
          isPopular: b.isPopular,
          isAiSuggested: b.isAiSuggested,
          suggestedReason: b.suggestedReason,
          hotelId: b.hotelId,
          createdAt: b.createdAt,
          updatedAt: b.updatedAt,
        }))
      : DEFAULT_BUNDLES.map(b => ({
          ...b,
          hotelId,
          createdAt: new Date(),
          updatedAt: new Date(),
        }));

    res.json({
      success: true,
      data: {
        bundles,
        hotelId,
      },
    });
  } catch (error: any) {
    logger.error('Failed to fetch bundles', { error: error.message, hotelId: req.params.hotelId });
    res.status(500).json({
      success: false,
      message: 'Failed to fetch bundles',
    });
  }
});

/**
 * Get a specific bundle
 * GET /api/bundles/:hotelId/:bundleId
 */
router.get('/:hotelId/:bundleId', async (req: Request, res: Response) => {
  try {
    const { hotelId, bundleId } = req.params;

    // Find bundle in database
    const bundle = await prisma.hotelBundle.findFirst({
      where: {
        id: bundleId,
        hotelId,
      },
    });

    if (bundle) {
      return res.json({
        success: true,
        data: {
          ...bundle,
          services: JSON.parse(bundle.services as string),
        },
      });
    }

    // Fall back to default bundles
    const defaultBundle = DEFAULT_BUNDLES.find(b => b.id === bundleId);
    if (defaultBundle) {
      return res.json({
        success: true,
        data: {
          ...defaultBundle,
          hotelId,
          createdAt: new Date(),
          updatedAt: new Date(),
        },
      });
    }

    res.status(404).json({
      success: false,
      message: 'Bundle not found',
    });
  } catch (error: any) {
    logger.error('Failed to fetch bundle', { error: error.message, bundleId: req.params.bundleId });
    res.status(500).json({
      success: false,
      message: 'Failed to fetch bundle',
    });
  }
});

/**
 * Order a bundle
 * POST /api/bundles/:bundleId/order
 */
router.post('/:bundleId/order', authenticateUser, async (req: Request, res: Response) => {
  try {
    const { bundleId } = req.params;
    const { bookingId, roomId, scheduledFor, notes } = req.body;
    const guestId = req.user?.id;

    if (!bookingId || !roomId || !guestId) {
      return res.status(400).json({
        success: false,
        message: 'bookingId, roomId, and guestId are required',
      });
    }

    // Verify booking exists and belongs to user
    const booking = await prisma.booking.findFirst({
      where: {
        id: bookingId,
        userId: guestId,
        status: { in: ['confirmed', 'checked_in'] },
      },
      select: {
        id: true,
        hotelId: true,
        checkinDate: true,
        checkoutDate: true,
        hotel: { select: { id: true, name: true } },
      },
    });

    if (!booking) {
      return res.status(404).json({
        success: false,
        message: 'Booking not found or not active',
      });
    }

    // Get bundle details
    const bundle = await prisma.hotelBundle.findFirst({
      where: {
        id: bundleId,
        hotelId: booking.hotelId,
        available: true,
      },
    });

    let bundleName: string;
    let totalAmountPaise: number;
    let services: BundleService[];

    if (bundle) {
      bundleName = bundle.name;
      totalAmountPaise = bundle.pricePaise;
      services = JSON.parse(bundle.services as string);
    } else {
      // Use default bundle
      const defaultBundle = DEFAULT_BUNDLES.find(b => b.id === bundleId);
      if (!defaultBundle) {
        return res.status(404).json({
          success: false,
          message: 'Bundle not found',
        });
      }
      bundleName = defaultBundle.name;
      totalAmountPaise = defaultBundle.pricePaise;
      services = defaultBundle.services;
    }

    // Parse scheduled time
    let scheduledForDate: Date | undefined;
    if (scheduledFor) {
      scheduledForDate = new Date(scheduledFor);
      if (isNaN(scheduledForDate.getTime())) {
        return res.status(400).json({
          success: false,
          message: 'Invalid scheduledFor date format',
        });
      }
    }

    // Create bundle order
    const order = await prisma.bundleOrder.create({
      data: {
        bundleId: bundleId as string,
        bundleName,
        bookingId: bookingId as string,
        roomId: roomId as string,
        userId: guestId as string,
        hotelId: booking.hotelId as string,
        checkInDate: booking.checkinDate,
        checkOutDate: booking.checkoutDate,
        status: 'pending',
        scheduledFor: scheduledForDate,
        notes: notes as string | undefined,
        totalAmountPaise,
      } as any,
    });

    logger.info('Bundle order created', {
      orderId: order.id,
      bundleId,
      bookingId,
      hotelId: booking.hotelId,
    });

    // TODO: Notify hotel staff of new bundle order
    // TODO: Create room service requests for individual services in the bundle

    res.status(201).json({
      success: true,
      data: {
        id: order.id,
        bundleId: order.bundleId,
        bundleName: order.bundleName,
        bookingId: order.bookingId,
        status: order.status,
        scheduledFor: order.scheduledFor?.toISOString(),
        totalAmountPaise: order.totalAmountPaise,
        createdAt: order.createdAt.toISOString(),
      },
    });
  } catch (error: any) {
    logger.error('Failed to create bundle order', { error: error.message, bundleId: req.params.bundleId });
    res.status(500).json({
      success: false,
      message: 'Failed to create bundle order',
    });
  }
});

/**
 * Get AI-suggested bundle recommendations for a guest
 * GET /api/bundles/recommendations/:guestId
 */
router.get('/recommendations/:guestId', authenticateUser, async (req: Request, res: Response) => {
  try {
    const { guestId } = req.params;
    const { stayPurpose } = req.query;
    const userId = req.user?.id;

    // Users can only see their own recommendations
    if (userId !== guestId) {
      return res.status(403).json({
        success: false,
        message: 'Access denied',
      });
    }

    // Get guest's booking and stay history
    const bookings = await prisma.booking.findMany({
      where: {
        userId: guestId,
        status: { in: ['confirmed', 'checked_in', 'completed'] },
      },
      include: {
        hotel: { select: { id: true, name: true } },
        roomType: { select: { name: true } },
      },
      orderBy: { checkIn: 'desc' },
      take: 5,
    });

    // Get previous service requests
    const previousServices = await prisma.roomServiceRequest.findMany({
      where: {
        guestUserId: guestId,
        status: 'completed',
      },
      select: { serviceType: true },
    });

    const serviceTypes = [...new Set(previousServices.map(s => s.serviceType))];

    // Get current active booking
    const activeBooking = bookings.find(b =>
      b.status === 'confirmed' || b.status === 'checked_in'
    );

    // Get hotel bundles
    const hotelId = activeBooking?.hotelId || bookings[0]?.hotelId;
    if (!hotelId) {
      return res.json({
        success: true,
        data: {
          recommendations: [],
          stayPurpose: stayPurpose || 'mixed',
          guestProfile: {
            isReturningGuest: bookings.length > 1,
            stayCount: bookings.length,
            previousServices: serviceTypes,
          },
        },
      });
    }

    // Fetch bundles for the hotel
    const hotelBundles = await prisma.hotelBundle.findMany({
      where: {
        hotelId,
        available: true,
      },
    });

    // Use default bundles if none configured
    const allBundles = hotelBundles.length > 0
      ? hotelBundles.map(b => ({
          ...b,
          services: JSON.parse(b.services as string),
        }))
      : DEFAULT_BUNDLES.map(b => ({
          ...b,
          hotelId,
          createdAt: new Date(),
          updatedAt: new Date(),
        }));

    // Score and rank bundles based on guest profile
    const scoredBundles = allBundles.map(bundle => {
      let score = 0;

      // Boost AI-suggested bundles
      if (bundle.isAiSuggested) score += 20;

      // Boost popular bundles
      if (bundle.isPopular) score += 10;

      // Match based on stay purpose
      const purpose = stayPurpose as string || 'mixed';
      if (purpose === 'business' && bundle.category === 'transport') score += 30;
      if (purpose === 'business' && bundle.category === 'convenience') score += 20;
      if (purpose === 'pleasure' && bundle.category === 'spa') score += 30;
      if (purpose === 'pleasure' && bundle.category === 'romantic') score += 25;
      if (purpose === 'pleasure' && bundle.category === 'staycation') score += 20;

      // Boost based on previous services
      const serviceNames = bundle.services.map(s => s.name.toLowerCase());
      if (serviceTypes.includes('spa') && serviceNames.some(n => n.includes('massage'))) score += 15;
      if (serviceTypes.includes('room_service') && serviceNames.some(n => n.includes('dinner'))) score += 15;

      // Returning guest boost for celebration bundles
      if (bookings.length > 1 && bundle.category === 'celebration') score += 15;

      return { bundle, score };
    });

    // Sort by score and take top 5
    scoredBundles.sort((a, b) => b.score - a.score);
    const recommendations = scoredBundles.slice(0, 5).map(s => s.bundle);

    res.json({
      success: true,
      data: {
        recommendations,
        stayPurpose: stayPurpose || 'mixed',
        guestProfile: {
          isReturningGuest: bookings.length > 1,
          stayCount: bookings.length,
          previousServices: serviceTypes,
        },
      },
    });
  } catch (error: any) {
    logger.error('Failed to fetch recommendations', { error: error.message, guestId: req.params.guestId });
    res.status(500).json({
      success: false,
      message: 'Failed to fetch recommendations',
    });
  }
});

/**
 * Get guest's bundle orders for a booking
 * GET /api/bundles/orders/:bookingId
 */
router.get('/orders/:bookingId', authenticateUser, async (req: Request, res: Response) => {
  try {
    const { bookingId } = req.params;
    const userId = req.user?.id;

    // Verify booking belongs to user
    const booking = await prisma.booking.findFirst({
      where: {
        id: bookingId,
        userId,
      },
    });

    if (!booking) {
      return res.status(403).json({
        success: false,
        message: 'Access denied',
      });
    }

    const orders = await prisma.bundleOrder.findMany({
      where: {
        bookingId,
        userId: userId,
      },
      orderBy: { createdAt: 'desc' },
    });

    res.json({
      success: true,
      data: {
        orders: orders.map(o => ({
          id: o.id,
          bundleId: o.bundleId,
          bundleName: o.bundleName,
          bookingId: o.bookingId,
          status: o.status,
          scheduledFor: o.scheduledFor?.toISOString(),
          totalAmountPaise: o.totalAmountPaise,
          createdAt: o.createdAt.toISOString(),
          completedAt: o.completedAt?.toISOString(),
        })),
      },
    });
  } catch (error: any) {
    logger.error('Failed to fetch bundle orders', { error: error.message, bookingId: req.params.bookingId });
    res.status(500).json({
      success: false,
      message: 'Failed to fetch bundle orders',
    });
  }
});

/**
 * Cancel a bundle order
 * DELETE /api/bundles/orders/:orderId
 */
router.delete('/orders/:orderId', authenticateUser, async (req: Request, res: Response) => {
  try {
    const { orderId } = req.params;
    const userId = req.user?.id;

    const order = await prisma.bundleOrder.findFirst({
      where: {
        id: orderId,
        userId: userId,
      },
    });

    if (!order) {
      return res.status(404).json({
        success: false,
        message: 'Order not found',
      });
    }

    if (order.status === 'completed') {
      return res.status(400).json({
        success: false,
        message: 'Cannot cancel a completed order',
      });
    }

    if (order.status === 'cancelled') {
      return res.status(400).json({
        success: false,
        message: 'Order is already cancelled',
      });
    }

    // Cancel the order
    await prisma.bundleOrder.update({
      where: { id: orderId },
      data: { status: 'cancelled' },
    });

    logger.info('Bundle order cancelled', { orderId, guestId: userId });

    res.json({
      success: true,
      message: 'Order cancelled successfully',
    });
  } catch (error: any) {
    logger.error('Failed to cancel bundle order', { error: error.message, orderId: req.params.orderId });
    res.status(500).json({
      success: false,
      message: 'Failed to cancel order',
    });
  }
});

/**
 * Hotel staff: Update bundle order status
 * PATCH /api/bundles/orders/:orderId/status
 */
router.patch('/orders/:orderId/status', authenticateHotelStaff, async (req: Request, res: Response) => {
  try {
    const { orderId } = req.params;
    const { status } = req.body;
    const hotelId = req.user?.hotelId;

    if (!['pending', 'confirmed', 'in_progress', 'completed', 'cancelled'].includes(status)) {
      return res.status(400).json({
        success: false,
        message: 'Invalid status',
      });
    }

    const order = await prisma.bundleOrder.findFirst({
      where: {
        id: orderId,
        hotelId,
      },
    });

    if (!order) {
      return res.status(404).json({
        success: false,
        message: 'Order not found',
      });
    }

    const updateData: any = { status };
    if (status === 'completed') {
      updateData.completedAt = new Date();
    }

    const updated = await prisma.bundleOrder.update({
      where: { id: orderId },
      data: updateData,
    });

    logger.info('Bundle order status updated', { orderId, status, hotelId });

    res.json({
      success: true,
      data: updated,
    });
  } catch (error: any) {
    logger.error('Failed to update bundle order status', { error: error.message, orderId: req.params.orderId });
    res.status(500).json({
      success: false,
      message: 'Failed to update order status',
    });
  }
});

/**
 * Hotel staff: Get all bundle orders
 * GET /api/bundles/hotel/orders
 */
router.get('/hotel/orders', authenticateHotelStaff, async (req: Request, res: Response) => {
  try {
    const hotelId = req.user?.hotelId;
    const { status, page = '1', limit = '20' } = req.query;

    const pageNum = parseInt(page as string, 10);
    const limitNum = Math.min(parseInt(limit as string, 10), 100);
    const skip = (pageNum - 1) * limitNum;

    const where: any = { hotelId };
    if (status) where.status = status;

    const [orders, total] = await Promise.all([
      prisma.bundleOrder.findMany({
        where,
        orderBy: { createdAt: 'desc' },
        skip,
        take: limitNum,
      }),
      prisma.bundleOrder.count({ where }),
    ]);

    res.json({
      success: true,
      data: {
        orders: orders.map(o => ({
          id: o.id,
          bundleId: o.bundleId,
          bundleName: o.bundleName,
          bookingId: o.bookingId,
          roomId: o.roomId,
          status: o.status,
          scheduledFor: o.scheduledFor?.toISOString(),
          notes: o.notes,
          totalAmountPaise: o.totalAmountPaise,
          createdAt: o.createdAt.toISOString(),
          completedAt: o.completedAt?.toISOString(),
        })),
        page: pageNum,
        limit: limitNum,
        totalCount: total,
        totalPages: Math.ceil(total / limitNum),
      },
    });
  } catch (error: any) {
    logger.error('Failed to fetch hotel bundle orders', { error: error.message });
    res.status(500).json({
      success: false,
      message: 'Failed to fetch bundle orders',
    });
  }
});

/**
 * Hotel staff: Create/update a bundle
 * POST /api/bundles/hotel
 */
router.post('/hotel', authenticateHotelStaff, async (req: Request, res: Response) => {
  try {
    const hotelId = req.user?.hotelId;
    const {
      id,
      name,
      description,
      pricePaise,
      originalPricePaise,
      category,
      services,
      duration,
      badges,
      isPopular,
      isAiSuggested,
      suggestedReason,
      available = true,
    } = req.body;

    if (!name || !description || !pricePaise || !category || !services) {
      return res.status(400).json({
        success: false,
        message: 'name, description, pricePaise, category, and services are required',
      });
    }

    const bundleData = {
      hotelId: hotelId!,
      name,
      description,
      basePricePaise: pricePaise,
      pricePaise,
      originalPricePaise,
      category,
      services: JSON.stringify(services),
      duration,
      badges: badges ? JSON.stringify(badges) : null,
      isPopular: isPopular || false,
      isAiSuggested: isAiSuggested || false,
      suggestedReason,
      available,
    };

    let bundle;
    if (id) {
      // Update existing
      bundle = await prisma.hotelBundle.update({
        where: { id },
        data: bundleData,
      });
    } else {
      // Create new
      bundle = await prisma.hotelBundle.create({
        data: bundleData,
      });
    }

    logger.info('Bundle saved', { bundleId: bundle.id, hotelId });

    res.json({
      success: true,
      data: {
        ...bundle,
        services: JSON.parse(bundle.services as string),
      },
    });
  } catch (error: any) {
    logger.error('Failed to save bundle', { error: error.message });
    res.status(500).json({
      success: false,
      message: 'Failed to save bundle',
    });
  }
});

export default router;
