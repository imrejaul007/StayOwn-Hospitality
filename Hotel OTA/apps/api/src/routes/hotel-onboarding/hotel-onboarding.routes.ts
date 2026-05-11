import { Router, Request, Response } from 'express';
import crypto from 'crypto';
import { v4 as uuidv4 } from 'uuid';
import { prisma } from '../../config/database';
import { logger } from '../../config/logger';
import { Errors } from '../../utils/errors';
import { asyncHandler } from '../../middleware/asyncHandler';
import { generateRoomQR } from '../../utils/generateRoomQR';

const router = Router();

// In-memory session store (in production, use Redis)
interface OnboardingSession {
  id: string;
  token: string;
  hotelId?: string;
  partnerId?: string;
  step: number;
  data: {
    hotelName?: string;
    location?: string;
    hotelType?: string;
    starRating?: number;
    phone?: string;
    constactEmail?: string;
    rooms?: any[];
    services?: Record<string, boolean>;
    staffInvites?: { email: string; role: string }[];
  };
  createdAt: Date;
  expiresAt: Date;
}

const sessions = new Map<string, OnboardingSession>();

// Clean up expired sessions every hour
setInterval(() => {
  const now = new Date();
  for (const [id, session] of sessions.entries()) {
    if (session.expiresAt < now) {
      sessions.delete(id);
    }
  }
}, 60 * 60 * 1000);

/**
 * POST /v1/hotel/onboarding/start
 * Start a new onboarding session with an invitation token
 */
router.post('/start', asyncHandler(async (req: Request, res: Response) => {
  const { token } = req.body;

  if (!token) {
    throw Errors.validation('Invitation token is required');
  }

  // In production, validate token against database
  // For now, generate a new session
  const sessionId = uuidv4();
  const session: OnboardingSession = {
    id: sessionId,
    token,
    step: 1,
    data: {},
    createdAt: new Date(),
    expiresAt: new Date(Date.now() + 24 * 60 * 60 * 1000), // 24 hours
  };

  sessions.set(sessionId, session);

  logger.info('[Onboarding] Started new session', { sessionId });

  res.json({
    success: true,
    session: {
      sessionId: session.id,
      token: session.token,
      step: session.step,
      createdAt: session.createdAt.toISOString(),
      expiresAt: session.expiresAt.toISOString(),
    },
  });
}));

/**
 * POST /v1/hotel/onboarding/step-1
 * Save hotel information
 */
router.post('/step-1', asyncHandler(async (req: Request, res: Response) => {
  const { sessionId, hotelName, location, hotelType, starRating, phone, constactEmail } = req.body;

  if (!sessionId) {
    throw Errors.validation('Session ID is required');
  }

  const session = sessions.get(sessionId);
  if (!session) {
    throw Errors.notFound('Onboarding session');
  }

  if (!hotelName || !location || !hotelType || !phone) {
    throw Errors.validation('hotelName, location, hotelType, and phone are required');
  }

  // Validate star rating
  if (starRating && (starRating < 1 || starRating > 5)) {
    throw Errors.validation('Star rating must be between 1 and 5');
  }

  // Update session data
  session.data = {
    ...session.data,
    hotelName,
    location,
    hotelType,
    starRating: starRating || 3,
    phone,
    constactEmail,
  };
  session.step = 2;

  logger.info('[Onboarding] Step 1 completed', { sessionId, hotelName });

  res.json({
    success: true,
    session: {
      sessionId: session.id,
      token: session.token,
      step: session.step,
      ...session.data,
      createdAt: session.createdAt.toISOString(),
      expiresAt: session.expiresAt.toISOString(),
    },
  });
}));

/**
 * POST /v1/hotel/onboarding/step-2
 * Save room configuration and generate QR codes
 */
router.post('/step-2', asyncHandler(async (req: Request, res: Response) => {
  const { sessionId, rooms } = req.body;

  if (!sessionId) {
    throw Errors.validation('Session ID is required');
  }

  const session = sessions.get(sessionId);
  if (!session) {
    throw Errors.notFound('Onboarding session');
  }

  if (!rooms || !Array.isArray(rooms) || rooms.length === 0) {
    throw Errors.validation('At least one room is required');
  }

  // Validate rooms
  const roomNumbers = new Set<string>();
  for (const room of rooms) {
    if (!room.roomNumber || !room.roomType) {
      throw Errors.validation('Each room must have roomNumber and roomType');
    }
    if (roomNumbers.has(room.roomNumber)) {
      throw Errors.validation(`Duplicate room number: ${room.roomNumber}`);
    }
    roomNumbers.add(room.roomNumber);

    // Generate room ID if not provided
    if (!room.roomId) {
      room.roomId = uuidv4();
    }
  }

  // Generate QR codes for each room
  const roomsWithQR = await Promise.all(
    rooms.map(async (room) => {
      const qrData = {
        roomId: room.roomId,
        roomNumber: room.roomNumber,
        roomType: room.roomType,
        floor: room.floor || '1',
        hotelId: session.data.hotelName, // Will be replaced with actual hotelId after creation
      };

      const qrResult = await generateRoomQR(qrData, session.token);

      return {
        ...room,
        qrCode: qrResult.qrCodeDataUrl,
        printUrl: qrResult.printUrl,
      };
    })
  );

  // Update session data
  session.data.rooms = roomsWithQR;
  session.step = 3;

  logger.info('[Onboarding] Step 2 completed', {
    sessionId,
    roomCount: rooms.length,
  });

  res.json({
    success: true,
    session: {
      sessionId: session.id,
      token: session.token,
      step: session.step,
      rooms: session.data.rooms,
      createdAt: session.createdAt.toISOString(),
      expiresAt: session.expiresAt.toISOString(),
    },
  });
}));

/**
 * POST /v1/hotel/onboarding/step-3
 * Save services configuration
 */
router.post('/step-3', asyncHandler(async (req: Request, res: Response) => {
  const { sessionId, services } = req.body;

  if (!sessionId) {
    throw Errors.validation('Session ID is required');
  }

  const session = sessions.get(sessionId);
  if (!session) {
    throw Errors.notFound('Onboarding session');
  }

  // Validate services
  const validServices = [
    'room_service',
    'housekeeping',
    'minibar',
    'laundry',
    'spa',
    'transport',
    'concierge',
    'business',
  ];

  if (services) {
    for (const service of Object.keys(services)) {
      if (!validServices.includes(service)) {
        throw Errors.validation(`Invalid service: ${service}`);
      }
    }
  }

  // Update session data
  session.data.services = services || {};
  session.step = 4;

  logger.info('[Onboarding] Step 3 completed', {
    sessionId,
    services: Object.keys(services || {}),
  });

  res.json({
    success: true,
    session: {
      sessionId: session.id,
      token: session.token,
      step: session.step,
      services: session.data.services,
      createdAt: session.createdAt.toISOString(),
      expiresAt: session.expiresAt.toISOString(),
    },
  });
}));

/**
 * POST /v1/hotel/onboarding/step-4
 * Save staff invitations
 */
router.post('/step-4', asyncHandler(async (req: Request, res: Response) => {
  const { sessionId, staffInvites } = req.body;

  if (!sessionId) {
    throw Errors.validation('Session ID is required');
  }

  const session = sessions.get(sessionId);
  if (!session) {
    throw Errors.notFound('Onboarding session');
  }

  // Validate staff invites
  const validRoles = ['manager', 'front_desk', 'housekeeping', 'room_service'];

  if (staffInvites && Array.isArray(staffInvites)) {
    for (const invite of staffInvites) {
      if (invite.email && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(invite.email)) {
        throw Errors.validation(`Invalid email: ${invite.email}`);
      }
      if (invite.role && !validRoles.includes(invite.role)) {
        throw Errors.validation(`Invalid role: ${invite.role}`);
      }
    }
  }

  // Update session data
  session.data.staffInvites = staffInvites || [];
  session.step = 5;

  logger.info('[Onboarding] Step 4 completed', {
    sessionId,
    inviteCount: (staffInvites || []).length,
  });

  res.json({
    success: true,
    session: {
      sessionId: session.id,
      token: session.token,
      step: session.step,
      staffInvites: session.data.staffInvites,
      createdAt: session.createdAt.toISOString(),
      expiresAt: session.expiresAt.toISOString(),
    },
  });
}));

/**
 * POST /v1/hotel/onboarding/complete
 * Finalize onboarding and create hotel in database
 */
router.post('/complete', asyncHandler(async (req: Request, res: Response) => {
  const { sessionId } = req.body;

  if (!sessionId) {
    throw Errors.validation('Session ID is required');
  }

  const session = sessions.get(sessionId);
  if (!session) {
    throw Errors.notFound('Onboarding session');
  }

  // Validate all required data is present
  const { hotelName, location, hotelType, starRating, phone, rooms, services, staffInvites } = session.data;

  if (!hotelName || !location || !hotelType || !phone) {
    throw Errors.validation('Hotel information incomplete. Please restart onboarding.');
  }

  if (!rooms || rooms.length === 0) {
    throw Errors.validation('Room configuration incomplete. Please restart onboarding.');
  }

  // Create hotel in database
  const hotel = await prisma.hotel.create({
    data: {
      name: hotelName,
      addressLine1: location || '',
      category: hotelType as any,
      starRating: starRating || 3,
      primaryContactPhone: phone,
      primaryContactEmail: session.data.constactEmail,
      slug: hotelName.toLowerCase().replace(/\s+/g, '-').replace(/[^a-z0-9-]/g, ''),
    },
  });

  // Create room types
  const roomTypeMap = new Map<string, string>();
  const uniqueRoomTypes = [...new Set(rooms.map((r) => r.roomType))];

  for (const roomType of uniqueRoomTypes) {
    const created = await prisma.roomType.create({
      data: {
        hotelId: hotel.id,
        name: roomType.charAt(0).toUpperCase() + roomType.slice(1).replace('_', ' '),
        baseRatePaise: rooms.find((r) => r.roomType === roomType)?.price || 200000,
        maxOccupancy: 2,
      },
    });
    roomTypeMap.set(roomType, created.id);
  }

  // Create rooms
  for (const room of rooms) {
    await prisma.room.create({
      data: {
        hotelId: hotel.id,
        roomTypeId: roomTypeMap.get(room.roomType) || '',
        roomNumber: room.roomNumber,
        floor: room.floor || '1',
        isActive: true,
      },
    });
  }

  // Enable services
  if (services) {
    for (const [serviceId, enabled] of Object.entries(services)) {
      if (enabled) {
        await prisma.hotelService.create({
          data: {
            hotelId: hotel.id,
            name: serviceId.replace('_', ' '),
            serviceName: serviceId.replace('_', ' '),
            category: 'general',
            pricePaise: 0,
            isEnabled: true,
            serviceConfig: {},
          },
        });
      }
    }
  }

  // Create staff invites
  for (const invite of staffInvites || []) {
    if (invite.email) {
      // In production, create invite record and send email
      await prisma.staffInvite.create({
        data: {
          hotelId: hotel.id,
          email: invite.email,
          role: invite.role,
          inviteToken: crypto.randomBytes(32).toString('hex'),
          expiresAt: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000), // 7 days
        },
      });
    }
  }

  // Clean up session
  sessions.delete(sessionId);

  logger.info('[Onboarding] Completed successfully', {
    sessionId,
    hotelId: hotel.id,
    hotelName,
    roomCount: rooms.length,
  });

  res.json({
    success: true,
    hotelId: hotel.id,
    message: 'Hotel onboarding completed successfully',
  });
}));

/**
 * POST /v1/hotel/onboarding/generate-qr
 * Generate QR codes for specific rooms
 */
router.post('/generate-qr', asyncHandler(async (req: Request, res: Response) => {
  const { sessionId, roomIds } = req.body;

  if (!sessionId) {
    throw Errors.validation('Session ID is required');
  }

  const session = sessions.get(sessionId);
  if (!session) {
    throw Errors.notFound('Onboarding session');
  }

  if (!roomIds || !Array.isArray(roomIds)) {
    throw Errors.validation('Room IDs array is required');
  }

  const rooms = session.data.rooms || [];
  const targetRooms = rooms.filter((r) => roomIds.includes(r.roomId));

  const roomsWithQR = await Promise.all(
    targetRooms.map(async (room) => {
      const qrData = {
        roomId: room.roomId,
        roomNumber: room.roomNumber,
        roomType: room.roomType,
        floor: room.floor || '1',
      };

      const qrResult = await generateRoomQR(qrData, session.token);

      return {
        ...room,
        qrCode: qrResult.qrCodeDataUrl,
        printUrl: qrResult.printUrl,
      };
    })
  );

  // Update session rooms
  const updatedRooms = rooms.map((room) => {
    const updated = roomsWithQR.find((r) => r.roomId === room.roomId);
    return updated || room;
  });
  session.data.rooms = updatedRooms;

  res.json({
    success: true,
    rooms: roomsWithQR,
  });
}));

/**
 * GET /v1/hotel/onboarding/session/:sessionId
 * Get session status
 */
router.get('/session/:sessionId', asyncHandler(async (req: Request, res: Response) => {
  const { sessionId } = req.params;

  const session = sessions.get(sessionId);
  if (!session) {
    throw Errors.notFound('Onboarding session');
  }

  res.json({
    success: true,
    session: {
      sessionId: session.id,
      token: session.token,
      step: session.step,
      ...session.data,
      createdAt: session.createdAt.toISOString(),
      expiresAt: session.expiresAt.toISOString(),
    },
  });
}));

/**
 * POST /v1/hotel/onboarding/cancel
 * Cancel onboarding session
 */
router.post('/cancel', asyncHandler(async (req: Request, res: Response) => {
  const { sessionId } = req.body;

  if (!sessionId) {
    throw Errors.validation('Session ID is required');
  }

  sessions.delete(sessionId);

  logger.info('[Onboarding] Session cancelled', { sessionId });

  res.json({
    success: true,
    message: 'Onboarding session cancelled',
  });
}));

export default router;
