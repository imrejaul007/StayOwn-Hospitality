/**
 * Domain-specific status transition maps.
 *
 * Each map defines which status transitions are legal for a given entity type.
 * This centralises transition validation so that routes/controllers don't
 * scatter ad-hoc checks.
 */

// ── Housekeeping tasks ──────────────────────────────────────────────────
export const HOUSEKEEPING_TRANSITIONS = {
  // Allow pending → in_progress as a shortcut: staff can self-assign and start an
  // unassigned task in one step (mirrors the maintenance pending → in_progress shortcut).
  pending:     ['assigned', 'in_progress', 'cancelled'],
  assigned:    ['in_progress', 'pending', 'cancelled'], // can be unassigned or cancelled
  in_progress: ['completed', 'assigned', 'cancelled'],  // can be reassigned or cancelled
  completed:   ['inspected', 'assigned'],                // failed inspection -> reassign
  inspected:   [],                                       // terminal
  cancelled:   []                                        // terminal
};

// ── Maintenance requests ────────────────────────────────────────────────
export const MAINTENANCE_TRANSITIONS = {
  open:          ['in_progress', 'cancelled'],
  in_progress:   ['completed', 'on_hold'],
  on_hold:       ['in_progress', 'cancelled'],
  completed:     ['verified'],
  verified:      [],                             // terminal
  cancelled:     [],                             // terminal
};

// ── Guest service requests ──────────────────────────────────────────────
export const GUEST_SERVICE_TRANSITIONS = {
  // pending -> in_progress allowed as shortcut when staff self-assigns and immediately starts
  pending:      ['assigned', 'in_progress', 'cancelled'],
  assigned:     ['in_progress', 'cancelled'],
  in_progress:  ['completed', 'cancelled'],
  completed:    [],                              // terminal
  cancelled:    [],                              // terminal
};

// ── Meet-up requests ────────────────────────────────────────────────────
// FIX: Use 'accepted'/'declined' to match MeetUpRequest model enum (not 'approved'/'rejected'/'in_progress')
export const MEETUP_TRANSITIONS = {
  pending:   ['accepted', 'declined', 'cancelled'],
  accepted:  ['completed', 'cancelled'],
  declined:  [],
  completed: [],
  cancelled: [],
};

// ── Inventory consumption approvals ─────────────────────────────────────
export const INVENTORY_CONSUMPTION_TRANSITIONS = {
  pending:   ['approved', 'rejected'],
  approved:  [],
  rejected:  [],
};

/**
 * Generic validator that works with any transition map.
 * @param {Object} transitionMap - e.g. HOUSEKEEPING_TRANSITIONS
 * @param {string} currentStatus
 * @param {string} newStatus
 * @returns {{ valid: boolean, error?: string }}
 */
export const validateStatusTransition = (transitionMap, currentStatus, newStatus) => {
  const allowed = transitionMap[currentStatus];
  if (!allowed) {
    return { valid: false, error: `Unknown current status: "${currentStatus}"` };
  }
  if (allowed.length === 0) {
    return { valid: false, error: `Cannot transition from terminal state "${currentStatus}"` };
  }
  if (!allowed.includes(newStatus)) {
    return {
      valid: false,
      error: `Invalid transition: "${currentStatus}" -> "${newStatus}". Allowed: ${allowed.join(', ')}`
    };
  }
  return { valid: true };
};

export default {
  HOUSEKEEPING_TRANSITIONS,
  MAINTENANCE_TRANSITIONS,
  GUEST_SERVICE_TRANSITIONS,
  MEETUP_TRANSITIONS,
  INVENTORY_CONSUMPTION_TRANSITIONS,
  validateStatusTransition
};
