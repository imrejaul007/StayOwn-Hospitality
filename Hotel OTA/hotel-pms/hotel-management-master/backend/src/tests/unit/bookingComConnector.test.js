jest.mock('axios', () => ({
  get: jest.fn(),
  post: jest.fn()
}));

jest.mock('../../models/Room.js', () => ({
  __esModule: true,
  default: {
    find: jest.fn()
  }
}));

import axios from 'axios';
import Room from '../../models/Room.js';
import { BookingComConnector } from '../../services/bookingComConnector.js';

describe('BookingComConnector.fetchAvailability', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  it('uses provided hotelId when external API fails', async () => {
    axios.get.mockRejectedValue(new Error('external api down'));

    const roomLeanMock = jest.fn().mockResolvedValue([
      { number: '101', status: 'available', baseRate: 150, roomType: 'standard' }
    ]);
    const roomLimitMock = jest.fn(() => ({ lean: roomLeanMock }));
    Room.find.mockReturnValue({ limit: roomLimitMock });

    const connector = new BookingComConnector();
    const response = await connector.fetchAvailability('bc_hotel_1', 'token-1', 'hotel-123');

    expect(Room.find).toHaveBeenCalledWith({
      hotelId: 'hotel-123',
      status: { $in: ['available', 'occupied', 'maintenance'] }
    });
    expect(response).toHaveProperty('rooms');
    expect(Array.isArray(response.rooms)).toBe(true);
  });
});
