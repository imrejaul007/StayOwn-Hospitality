import { describe, test, expect, vi, beforeEach } from 'vitest';
import { bookingService } from './bookingService';
import { api } from './api';

vi.mock('./api', () => ({
  api: {
    get: vi.fn(),
    post: vi.fn()
  }
}));

const mockApi = api as unknown as {
  get: ReturnType<typeof vi.fn>;
  post: ReturnType<typeof vi.fn>;
};

describe('bookingService.createBooking', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockApi.get.mockRejectedValue(new Error('no current hotel'));
  });

  test('fails if property context is missing', async () => {
    const request = {
      checkIn: '2026-04-01',
      checkOut: '2026-04-05'
    } as any;

    await expect(bookingService.createBooking(request)).rejects.toThrow('No property selected for booking');
    expect(mockApi.post).not.toHaveBeenCalled();
  });
});
