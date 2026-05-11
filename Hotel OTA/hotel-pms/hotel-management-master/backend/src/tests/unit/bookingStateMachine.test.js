import { validateTransition, VALID_TRANSITIONS, TERMINAL_STATES } from '../../utils/bookingStateMachine.js';

describe('Booking State Machine', () => {
  describe('validateTransition', () => {
    test('allows pending → confirmed', () => {
      const result = validateTransition('pending', 'confirmed');
      expect(result.valid).toBe(true);
    });

    test('allows pending → cancelled', () => {
      const result = validateTransition('pending', 'cancelled');
      expect(result.valid).toBe(true);
    });

    test('allows confirmed → checked_in', () => {
      const result = validateTransition('confirmed', 'checked_in');
      expect(result.valid).toBe(true);
    });

    test('allows confirmed → cancelled', () => {
      const result = validateTransition('confirmed', 'cancelled');
      expect(result.valid).toBe(true);
    });

    test('allows confirmed → no_show', () => {
      const result = validateTransition('confirmed', 'no_show');
      expect(result.valid).toBe(true);
    });

    test('allows checked_in → checked_out', () => {
      const result = validateTransition('checked_in', 'checked_out');
      expect(result.valid).toBe(true);
    });

    test('rejects cancelled → confirmed (terminal state)', () => {
      const result = validateTransition('cancelled', 'confirmed');
      expect(result.valid).toBe(false);
      expect(result.error).toContain('terminal state');
    });

    test('rejects checked_out → checked_in (terminal state)', () => {
      const result = validateTransition('checked_out', 'checked_in');
      expect(result.valid).toBe(false);
    });

    test('rejects no_show → confirmed (terminal state)', () => {
      const result = validateTransition('no_show', 'confirmed');
      expect(result.valid).toBe(false);
    });

    test('allows confirmed → modified (OTA amendment)', () => {
      const result = validateTransition('confirmed', 'modified');
      expect(result.valid).toBe(true);
    });

    test('allows modified → confirmed (amendment accepted)', () => {
      const result = validateTransition('modified', 'confirmed');
      expect(result.valid).toBe(true);
    });

    test('allows modified → cancelled', () => {
      const result = validateTransition('modified', 'cancelled');
      expect(result.valid).toBe(true);
    });

    test('allows modified → checked_in', () => {
      const result = validateTransition('modified', 'checked_in');
      expect(result.valid).toBe(true);
    });

    test('rejects pending → checked_in (invalid skip)', () => {
      const result = validateTransition('pending', 'checked_in');
      expect(result.valid).toBe(false);
      expect(result.error).toContain('Invalid transition');
    });

    test('rejects checked_in → pending (backward)', () => {
      const result = validateTransition('checked_in', 'pending');
      expect(result.valid).toBe(false);
    });

    test('rejects unknown status', () => {
      const result = validateTransition('unknown', 'confirmed');
      expect(result.valid).toBe(false);
      expect(result.error).toContain('Unknown');
    });
  });

  describe('VALID_TRANSITIONS', () => {
    test('all defined statuses have transition rules', () => {
      const statuses = ['pending', 'confirmed', 'modified', 'checked_in', 'checked_out', 'cancelled', 'no_show'];
      statuses.forEach(s => {
        expect(VALID_TRANSITIONS).toHaveProperty(s);
        expect(Array.isArray(VALID_TRANSITIONS[s])).toBe(true);
      });
    });

    test('terminal states have empty transition arrays', () => {
      TERMINAL_STATES.forEach(s => {
        expect(VALID_TRANSITIONS[s]).toEqual([]);
      });
    });
  });
});
