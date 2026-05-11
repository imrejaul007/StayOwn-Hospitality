import { Router } from 'express';
const router = Router();

const REZ_SUPPORT_URL = process.env.REZ_SUPPORT_COPILOT_URL || 'https://REZ-support-copilot.onrender.com';

/**
 * POST /api/chat/ai
 * AI-powered chat for Hotel OTA
 */
router.post('/ai', async (req, res) => {
  try {
    const { message, guestId, roomId, hotelId } = req.body;

    const response = await fetch(`${REZ_SUPPORT_URL}/api/chat`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        message,
        userId: guestId,
        sessionId: `hotel-${hotelId}-${roomId}`,
        source: 'hotel-ota',
        context: { roomId, hotelId },
      }),
    });

    const data = await response.json();
    res.json(data);
  } catch (error) {
    console.error('Hotel chat error:', error);
    res.status(500).json({ error: 'AI service unavailable' });
  }
});

/**
 * POST /api/chat/room-service
 * Room service ordering via AI
 */
router.post('/room-service', async (req, res) => {
  const { items, roomId, hotelId } = req.body;

  const response = await fetch(`${REZ_SUPPORT_URL}/api/order`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      items,
      roomId,
      hotelId,
      source: 'hotel-room-service',
    }),
  });

  res.json(await response.json());
});

export default router;
