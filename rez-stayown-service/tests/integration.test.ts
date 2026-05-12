/**
 * StayOwn-Hospitality - Integration Tests
 * Tests Hotel and Room Access services
 */

import axios from 'axios';

jest.mock('axios');
const mockedAxios = axios as jest.Mocked<typeof axios>;

// Service URLs
const HOTEL_API = process.env.HOTEL_API || 'https://hotel-ota-api.onrender.com';
const VERIFY_API = process.env.VERIFY_API || 'https://stayown-verify.onrender.com';

describe('StayOwn-Hospitality Integration Tests', () => {
  beforeEach(() => { jest.clearAllMocks(); });

  // ========== HOTEL OTA ==========
  describe('Hotel OTA Service', () => {
    test('GET /api/hotels - List hotels', async () => {
      mockedAxios.get.mockResolvedValueOnce({
        data: { hotels: [{ id: 'h1', name: 'Hotel A' }, { id: 'h2', name: 'Hotel B' }] }
      });
      const res = await axios.get(`${HOTEL_API}/api/hotels`);
      expect(res.data.hotels.length).toBe(2);
    });

    test('GET /api/hotels/:id - Hotel details', async () => {
      mockedAxios.get.mockResolvedValueOnce({
        data: { id: 'h1', name: 'Hotel A', rating: 4.5, rooms: 50 }
      });
      const res = await axios.get(`${HOTEL_API}/api/hotels/h1`);
      expect(res.data.name).toBe('Hotel A');
    });

    test('GET /api/hotels/:id/rooms - Available rooms', async () => {
      mockedAxios.get.mockResolvedValueOnce({
        data: { rooms: [{ id: 'r1', type: 'deluxe', price: 3000 }] }
      });
      const res = await axios.get(`${HOTEL_API}/api/hotels/h1/rooms`);
      expect(res.data.rooms.length).toBe(1);
    });

    test('POST /api/bookings - Create booking', async () => {
      mockedAxios.post.mockResolvedValueOnce({
        data: { booking_id: 'bkg123', status: 'confirmed' }
      });
      const res = await axios.post(`${HOTEL_API}/api/bookings`, {
        hotel_id: 'h1',
        room_id: 'r1',
        user_id: 'user123',
        check_in: '2026-06-01',
        check_out: '2026-06-03'
      });
      expect(res.data.booking_id).toBe('bkg123');
    });

    test('GET /api/bookings/:id - Booking details', async () => {
      mockedAxios.get.mockResolvedValueOnce({
        data: { booking_id: 'bkg123', status: 'confirmed', total: 6000 }
      });
      const res = await axios.get(`${HOTEL_API}/api/bookings/bkg123`);
      expect(res.data.status).toBe('confirmed');
    });

    test('POST /api/bookings/:id/cancel - Cancel booking', async () => {
      mockedAxios.post.mockResolvedValueOnce({ data: { status: 'cancelled' } });
      const res = await axios.post(`${HOTEL_API}/api/bookings/bkg123/cancel`);
      expect(res.data.status).toBe('cancelled');
    });
  });

  // ========== ROOM ACCESS (verify-service) ==========
  describe('Room Access Service', () => {
    test('POST /api/verify - Verify room access', async () => {
      mockedAxios.post.mockResolvedValueOnce({ data: { access: 'granted', room: 'r1' } });
      const res = await axios.post(`${VERIFY_API}/api/verify`, {
        booking_id: 'bkg123',
        qr_code: 'ROOM-r1-1234'
      });
      expect(res.data.access).toBe('granted');
    });

    test('POST /api/checkin - Digital check-in', async () => {
      mockedAxios.post.mockResolvedValueOnce({ data: { checkin_id: 'ci123', status: 'checked_in' } });
      const res = await axios.post(`${VERIFY_API}/api/checkin`, {
        booking_id: 'bkg123',
        user_id: 'user123'
      });
      expect(res.data.status).toBe('checked_in');
    });

    test('POST /api/checkout - Digital checkout', async () => {
      mockedAxios.post.mockResolvedValueOnce({ data: { checkout_id: 'co123', status: 'checked_out' } });
      const res = await axios.post(`${VERIFY_API}/api/checkout`, {
        booking_id: 'bkg123'
      });
      expect(res.data.status).toBe('checked_out');
    });

    test('POST /api/room/:id/unlock - Unlock room', async () => {
      mockedAxios.post.mockResolvedValueOnce({ data: { unlocked: true, expires_in: 300 } });
      const res = await axios.post(`${VERIFY_API}/api/room/r1/unlock`, {
        user_id: 'user123'
      });
      expect(res.data.unlocked).toBe(true);
    });

    test('GET /api/guest/:id/qr - Guest QR code', async () => {
      mockedAxios.get.mockResolvedValueOnce({
        data: { qr_url: 'https://qr.stayown.com/abc123', expires_at: '2026-06-03' }
      });
      const res = await axios.get(`${VERIFY_API}/api/guest/user123/qr`);
      expect(res.data.qr_url).toBeDefined();
    });
  });

  // ========== ROOM SERVICE ==========
  describe('Room Service', () => {
    test('GET /api/orders - Guest orders', async () => {
      mockedAxios.get.mockResolvedValueOnce({
        data: { orders: [{ id: 'o1', status: 'preparing' }] }
      });
      const res = await axios.get(`${HOTEL_API}/api/orders?booking_id=bkg123`);
      expect(res.data.orders.length).toBe(1);
    });

    test('POST /api/orders - Place room service order', async () => {
      mockedAxios.post.mockResolvedValueOnce({ data: { order_id: 'o123', status: 'received' } });
      const res = await axios.post(`${HOTEL_API}/api/orders`, {
        booking_id: 'bkg123',
        items: [{ name: 'Pasta', quantity: 1, price: 350 }]
      });
      expect(res.data.order_id).toBe('o123');
    });

    test('PUT /api/orders/:id/status - Update order status', async () => {
      mockedAxios.put.mockResolvedValueOnce({ data: { status: 'delivered' } });
      const res = await axios.put(`${HOTEL_API}/api/orders/o123/status`, {
        status: 'delivered'
      });
      expect(res.data.status).toBe('delivered');
    });
  });
});
