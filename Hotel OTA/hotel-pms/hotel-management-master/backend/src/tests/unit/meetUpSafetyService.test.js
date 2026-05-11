import GuestMeetUpBlock from '../../models/GuestMeetUpBlock.js';
import MeetUpRequest from '../../models/MeetUpRequest.js';
import {
  getMeetUpBlockedPeerIds,
  assertMeetUpNotBlocked,
  assertUnderPendingMeetUpCap,
  isHotelInMeetUpQuietHours
} from '../../services/meetUpSafetyService.js';
describe('meetUpSafetyService', () => {
  afterEach(() => {
    jest.restoreAllMocks();
  });

  describe('getMeetUpBlockedPeerIds', () => {
    it('returns empty when hotelId missing', async () => {
      expect(await getMeetUpBlockedPeerIds(null, 'u1')).toEqual([]);
    });

    it('collects the peer on the other side of a block row', async () => {
      jest.spyOn(GuestMeetUpBlock, 'find').mockReturnValue({
        select: () => ({
          lean: () =>
            Promise.resolve([
              { blockerUserId: 'u1', blockedUserId: 'u2' },
              { blockerUserId: 'u3', blockedUserId: 'u1' }
            ])
        })
      });
      const peers = await getMeetUpBlockedPeerIds('hotel1', 'u1');
      expect(peers.sort()).toEqual(['u2', 'u3'].sort());
    });
  });

  describe('assertMeetUpNotBlocked', () => {
    it('no-ops when ids missing', async () => {
      await expect(assertMeetUpNotBlocked('h', null, 'b')).resolves.toBeUndefined();
    });

    it('throws MEETUP_BLOCKED when a row exists', async () => {
      jest.spyOn(GuestMeetUpBlock, 'exists').mockResolvedValue({ _id: 'x' });
      await expect(assertMeetUpNotBlocked('h', 'a', 'b')).rejects.toMatchObject({
        code: 'MEETUP_BLOCKED'
      });
    });

    it('resolves when not blocked', async () => {
      jest.spyOn(GuestMeetUpBlock, 'exists').mockResolvedValue(null);
      await expect(assertMeetUpNotBlocked('h', 'a', 'b')).resolves.toBeUndefined();
    });
  });

  describe('assertUnderPendingMeetUpCap', () => {
    it('no-ops when cap missing or invalid', async () => {
      await expect(assertUnderPendingMeetUpCap('h', 'u', null)).resolves.toBeUndefined();
      await expect(assertUnderPendingMeetUpCap('h', 'u', 0)).resolves.toBeUndefined();
    });

    it('throws MEETUP_PENDING_CAP at cap', async () => {
      jest.spyOn(MeetUpRequest, 'countDocuments').mockResolvedValue(3);
      await expect(assertUnderPendingMeetUpCap('h', 'u', 3)).rejects.toMatchObject({
        code: 'MEETUP_PENDING_CAP'
      });
    });

    it('allows when under cap', async () => {
      jest.spyOn(MeetUpRequest, 'countDocuments').mockResolvedValue(2);
      await expect(assertUnderPendingMeetUpCap('h', 'u', 3)).resolves.toBeUndefined();
    });
  });

  describe('isHotelInMeetUpQuietHours', () => {
    it('returns false when window not configured', () => {
      expect(isHotelInMeetUpQuietHours('UTC', '', '22:00')).toBe(false);
    });

    it('returns false when start equals end', () => {
      expect(isHotelInMeetUpQuietHours('UTC', '10:00', '10:00')).toBe(false);
    });
  });
});
