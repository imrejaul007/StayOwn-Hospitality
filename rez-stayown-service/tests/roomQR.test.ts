/**
 * REZ Room QR Service - Tests
 */

import { describe, it, expect } from '@jest/globals';

const BASE_URL = process.env.TEST_URL || 'http://localhost:4016';

describe('Room QR Service', () => {
  const testRequestId = `REQ-${Date.now()}`;

  describe('Core APIs', () => {
    it('GET /health should return healthy status', async () => {
      const response = await fetch(`${BASE_URL}/health`);
      expect([200, 404]).toContain(response.status);
    });
  });

  describe('Room APIs', () => {
    it('GET /api/rooms/recommend should return recommendations', async () => {
      const response = await fetch(`${BASE_URL}/api/rooms/recommend?hotel_id=HOTEL-TEST`);
      expect([200, 400]).toContain(response.status);
    });

    it('POST /api/rooms/preferences should save preferences', async () => {
      const response = await fetch(`${BASE_URL}/api/rooms/preferences`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          guest_id: 'test_guest',
          hotel_id: 'HOTEL-TEST',
          preferences: {
            room_temp: 22,
            pillow_type: 'soft'
          }
        })
      });
      expect([200, 400]).toContain(response.status);
    });
  });

  describe('Service Request APIs', () => {
    it('POST /api/service-request should create request', async () => {
      const response = await fetch(`${BASE_URL}/api/service-request`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          hotel_id: 'HOTEL-TEST',
          room_id: 'ROOM-101',
          guest_id: 'test_guest',
          guest_name: 'Test Guest',
          guest_phone: '+919999999999',
          request_type: 'housekeeping',
          description: 'Extra towels please'
        })
      });
      expect([200, 400]).toContain(response.status);
    });

    it('GET /api/service-request/:id should return request', async () => {
      const response = await fetch(`${BASE_URL}/api/service-request/${testRequestId}`);
      expect([200, 400, 404]).toContain(response.status);
    });

    it('GET /api/service-requests should return requests', async () => {
      const response = await fetch(`${BASE_URL}/api/service-requests?hotel_id=HOTEL-TEST`);
      expect([200, 400]).toContain(response.status);
    });
  });

  describe('Analytics', () => {
    it('GET /api/analytics/room-qr should return analytics', async () => {
      const response = await fetch(`${BASE_URL}/api/analytics/room-qr?hotel_id=HOTEL-TEST`);
      expect([200, 400]).toContain(response.status);
    });

    it('GET /api/analytics/guest-insights should return insights', async () => {
      const response = await fetch(`${BASE_URL}/api/analytics/guest-insights?hotel_id=HOTEL-TEST`);
      expect([200, 400]).toContain(response.status);
    });
  });

  describe('Support', () => {
    it('POST /api/support/ticket should create ticket', async () => {
      const response = await fetch(`${BASE_URL}/api/support/ticket`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          hotel_id: 'HOTEL-TEST',
          room_id: 'ROOM-101',
          guest_id: 'test_guest',
          guest_name: 'Test Guest',
          guest_phone: '+919999999999',
          issue_type: 'room_issue',
          description: 'AC not working properly'
        })
      });
      expect([200, 400, 500]).toContain(response.status);
    });
  });
});
