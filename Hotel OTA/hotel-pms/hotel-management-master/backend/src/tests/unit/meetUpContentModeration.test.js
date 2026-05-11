import { moderateMeetUpText, moderateMeetUpCreateBody } from '../../services/meetUpContentModeration.js';
import { ApplicationError } from '../../middleware/errorHandler.js';

describe('meetUpContentModeration', () => {
  describe('moderateMeetUpText', () => {
    it('replaces http(s) URLs when blockUrls is true', () => {
      const out = moderateMeetUpText('Visit https://evil.test/x now', { blockUrls: true });
      expect(out).toContain('[link removed]');
      expect(out).not.toContain('evil.test');
    });

    it('keeps URLs when blockUrls is false', () => {
      const out = moderateMeetUpText('Visit https://ok.test/x', { blockUrls: false });
      expect(out).toContain('https://ok.test/x');
    });

    it('throws MEETUP_CONTENT_BLOCKED when profanityAction is block', () => {
      let err;
      try {
        moderateMeetUpText('This is fuck nonsense', { blockUrls: false, profanityAction: 'block' });
      } catch (e) {
        err = e;
      }
      expect(err).toBeInstanceOf(ApplicationError);
      expect(err.code).toBe('MEETUP_CONTENT_BLOCKED');
    });

    it('sanitizes profanity when profanityAction is sanitize', () => {
      const out = moderateMeetUpText('What the shit', { profanityAction: 'sanitize' });
      expect(out.toLowerCase()).not.toContain('shit');
    });
  });

  describe('moderateMeetUpCreateBody', () => {
    it('maps guestExperience.blockUrlsInMeetUpText to URL stripping', () => {
      const body = moderateMeetUpCreateBody(
        { title: 'x https://a.com', description: 'y', location: { name: 'z', details: 'www.b.com' } },
        { blockUrlsInMeetUpText: false, profanityAction: 'none' }
      );
      expect(body.title).toContain('https://a.com');
      expect(body.description).toBe('y');
    });

    it('applies block when blockUrlsInMeetUpText defaults true', () => {
      const body = moderateMeetUpCreateBody(
        { title: 'see http://x.com' },
        { profanityAction: 'none' }
      );
      expect(body.title).toContain('[link removed]');
    });
  });
});
