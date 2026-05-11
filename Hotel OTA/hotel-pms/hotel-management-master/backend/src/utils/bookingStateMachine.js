export const VALID_TRANSITIONS = {
  pending: ['confirmed', 'cancelled'],
  confirmed: ['checked_in', 'cancelled', 'no_show', 'modified'],
  modified: ['confirmed', 'checked_in', 'cancelled', 'no_show'],
  checked_in: ['checked_out'],
  checked_out: [],
  cancelled: [],
  no_show: [],
};

export const TERMINAL_STATES = ['checked_out', 'cancelled', 'no_show'];

/**
 * Validate a booking status transition.
 * @param {string} currentStatus
 * @param {string} newStatus
 * @returns {{ valid: boolean, error?: string }}
 */
export const validateTransition = (currentStatus, newStatus) => {
  if (!VALID_TRANSITIONS[currentStatus]) {
    return { valid: false, error: `Unknown current status: ${currentStatus}` };
  }
  if (TERMINAL_STATES.includes(currentStatus)) {
    return { valid: false, error: `Cannot transition from terminal state: ${currentStatus}` };
  }
  if (!VALID_TRANSITIONS[currentStatus].includes(newStatus)) {
    return { valid: false, error: `Invalid transition: ${currentStatus} → ${newStatus}. Allowed: ${VALID_TRANSITIONS[currentStatus].join(', ') || 'none'}` };
  }
  return { valid: true };
};

/**
 * Atomically transition a booking's status, only if the current status matches.
 * Prevents race conditions by using findOneAndUpdate with a status precondition.
 *
 * @param {Model} BookingModel - Mongoose Booking model
 * @param {string} bookingId
 * @param {string} expectedCurrentStatus
 * @param {string} newStatus
 * @param {object} additionalUpdates - other fields to update
 * @param {object} options - { session } for transactions
 * @returns {object|null} Updated booking or null if transition failed
 */
export const atomicStatusTransition = async (BookingModel, bookingId, expectedCurrentStatus, newStatus, additionalUpdates = {}, options = {}) => {
  const validation = validateTransition(expectedCurrentStatus, newStatus);
  if (!validation.valid) {
    throw new Error(validation.error);
  }

  // Separate MongoDB update operators (e.g. $push, $inc) from plain field updates
  const mongoOperators = {};
  const plainFields = {};
  for (const [key, value] of Object.entries(additionalUpdates)) {
    if (key.startsWith('$')) {
      mongoOperators[key] = value;
    } else {
      plainFields[key] = value;
    }
  }

  const updateDoc = {
    $set: {
      status: newStatus,
      [`statusHistory.${Date.now()}`]: { from: expectedCurrentStatus, to: newStatus, at: new Date() },
      ...plainFields
    },
    ...mongoOperators
  };

  const updated = await BookingModel.findOneAndUpdate(
    { _id: bookingId, status: expectedCurrentStatus },
    updateDoc,
    { new: true, ...options }
  );

  if (!updated) {
    throw new Error(`Booking ${bookingId} is no longer in "${expectedCurrentStatus}" status. Another request may have changed it.`);
  }

  return updated;
};

// Default export for convenience; named exports above are preferred for ESM consumers
export default { validateTransition, atomicStatusTransition, VALID_TRANSITIONS, TERMINAL_STATES };
