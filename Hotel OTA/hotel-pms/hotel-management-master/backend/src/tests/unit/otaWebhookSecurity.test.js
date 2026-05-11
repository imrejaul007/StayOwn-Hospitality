import express from 'express';
import request from 'supertest';
import crypto from 'crypto';
import otaWebhookRoutes from '../../routes/otaWebhooks.js';

describe('OTA webhook replay/signature security', () => {
  const app = express();

  beforeAll(() => {
    app.use(express.json({
      verify: (req, _res, buf) => {
        req.rawBody = buf.toString('utf8');
      }
    }));
    app.use('/api/v1/ota-webhooks', otaWebhookRoutes);
  });

  beforeEach(() => {
    process.env.NODE_ENV = 'production';
    process.env.BOOKINGCOM_WEBHOOK_SECRET = 'booking-secret-test';
  });

  it('rejects stale webhook timestamps', async () => {
    const body = {
      channel: 'booking_com',
      eventType: 'reservation',
      data: { bookingId: 'b-1', hotelId: 'h-1', roomTypeId: 'rt-1', checkIn: '2026-04-01', checkOut: '2026-04-02' }
    };
    const rawBody = JSON.stringify(body);
    const staleTs = `${Date.now() - 10 * 60 * 1000}`;
    const signature = crypto
      .createHmac('sha256', process.env.BOOKINGCOM_WEBHOOK_SECRET)
      .update(`${staleTs}.${rawBody}`)
      .digest('hex');

    const response = await request(app)
      .post('/api/v1/ota-webhooks/ota')
      .set('x-webhook-timestamp', staleTs)
      .set('x-webhook-signature', signature)
      .send(body);

    expect(response.status).toBe(401);
    expect(response.body.error).toContain('timestamp too old');
  });

  it('rejects invalid signatures', async () => {
    const body = {
      channel: 'booking_com',
      eventType: 'reservation',
      data: { bookingId: 'b-2', hotelId: 'h-1', roomTypeId: 'rt-1', checkIn: '2026-04-01', checkOut: '2026-04-02' }
    };
    const ts = `${Date.now()}`;

    const response = await request(app)
      .post('/api/v1/ota-webhooks/ota')
      .set('x-webhook-timestamp', ts)
      .set('x-webhook-signature', '00ff11')
      .send(body);

    expect(response.status).toBe(401);
    expect(response.body.error).toContain('Invalid webhook signature');
  });
});
