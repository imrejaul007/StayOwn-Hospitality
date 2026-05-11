import { BaseAgent } from '../core/BaseAgent.js';

/**
 * BookingSystemAgent - PMS-specific agent for hotel booking workflow analysis.
 * Validates booking lifecycle, room assignment, rate calculations, and guest management.
 */
export class BookingSystemAgent extends BaseAgent {
  constructor() {
    super('BookingSystemAgent', 'Analyzes PMS booking workflows, room assignment logic, rate calculations, and guest management');
  }

  async analyze(state, config) {
    const { scanner, projectRoot } = config;

    // Find all booking-related files
    const allFiles = [
      ...(state.context.files.controllers || []),
      ...(state.context.files.services || []),
      ...(state.context.files.routes || []),
      ...(state.context.files.models || []),
    ];

    const bookingFiles = allFiles.filter((f) =>
      /book|reserv|checkin|checkout|check.in|check.out|room|guest|folio|rate|tariff|occupancy/i.test(f.name)
    );

    console.log(`[BookingSystemAgent] Found ${bookingFiles.length} booking-related files`);

    for (const file of bookingFiles) {
      const content = await scanner.readFileContent(file.path);
      if (!content) continue;

      this._checkBookingLifecycle(state, content, file);
      this._checkRoomAssignment(state, content, file);
      this._checkRateCalculation(state, content, file);
      this._checkDateHandling(state, content, file);
      this._checkGuestDataHandling(state, content, file);
      this._checkCancellation(state, content, file);
      this._checkNoShowHandling(state, content, file);
      this._checkOverbooking(state, content, file);
    }

    // Check booking model integrity
    this._checkBookingModel(state);

    return {
      summary: `Booking system analysis complete — ${bookingFiles.length} files analyzed`,
      bookingFilesAnalyzed: bookingFiles.length,
    };
  }

  _checkBookingLifecycle(state, content, file) {
    // Verify proper status transitions
    const validTransitions = {
      pending: ['confirmed', 'cancelled'],
      confirmed: ['checked_in', 'cancelled', 'no_show'],
      checked_in: ['checked_out'],
      checked_out: [],
      cancelled: [],
      no_show: [],
    };

    // Check if status transition validation exists
    if (content.includes('status') && /book|reserv/i.test(file.name)) {
      const hasTransitionValidation =
        /validTransition|allowedStatus|statusTransition|validStatus|BOOKING_STATUS|bookingStateMachine|validateTransition|atomicStatusTransition|withTransaction/i.test(content);

      if (!hasTransitionValidation && content.includes('.status =')) {
        this.addFinding(state, {
          severity: 'medium',
          category: 'missing-feature',
          title: 'Missing booking status transition validation',
          description: `${file.relativePath} updates booking status but doesn't validate the transition. This allows invalid transitions like cancelled → checked_in or checked_out → pending, corrupting the booking state machine.`,
          file: file.relativePath,
          suggestion: 'Implement a state machine or transition map that validates: only allowed current_status → new_status transitions should proceed.',
          fixable: true,
        });
      }
    }
  }

  _checkRoomAssignment(state, content, file) {
    if (!/room|assign/i.test(content)) return;

    // Check for room assignment without availability verification
    const assignWithoutCheck = /(?:room|roomId|roomNumber)\s*(?:=|:)\s*(?:req\.body|req\.params)/g;
    let match;
    while ((match = assignWithoutCheck.exec(content))) {
      const surrounding = content.substring(
        Math.max(0, match.index - 500),
        match.index + match[0].length + 500
      );

      if (!/availab|occupied|blocked|maintenance|outOfOrder|isAvailable/.test(surrounding)) {
        const lineNum = content.substring(0, match.index).split('\n').length;
        this.addFinding(state, {
          severity: 'high',
          category: 'bug',
          title: 'Room assignment without availability check',
          description: `At line ${lineNum} in ${file.relativePath}: A room is assigned from user input without checking if it's available. This can assign occupied, blocked, or out-of-order rooms to guests.`,
          file: file.relativePath,
          line: lineNum,
          suggestion: 'Always verify room availability before assignment: check status, existing bookings for the date range, and maintenance blocks.',
          fixable: true,
        });
      }
    }
  }

  _checkRateCalculation(state, content, file) {
    if (!/rate|price|tariff|charge|amount|total/i.test(content)) return;

    // Floating point arithmetic for money
    const floatingPointMoney = /(?:price|rate|amount|total|charge|cost)\s*(?:=|\+=|-=)\s*[^;]*(?:\*|\/|\+|-)\s*(?:\d+\.\d+|parseFloat)/g;
    let match;
    while ((match = floatingPointMoney.exec(content))) {
      const lineNum = content.substring(0, match.index).split('\n').length;
      const surrounding = content.substring(match.index, match.index + 200);

      // Check if they're using proper rounding
      if (!surrounding.includes('toFixed') && !surrounding.includes('Math.round') && !surrounding.includes('Decimal')) {
        this.addFinding(state, {
          severity: 'medium',
          category: 'bug',
          title: 'Floating-point arithmetic for monetary calculations',
          description: `At line ${lineNum} in ${file.relativePath}: Financial calculations use floating-point arithmetic without proper rounding. This causes precision errors (e.g., 0.1 + 0.2 = 0.30000000000000004), leading to incorrect charges.`,
          file: file.relativePath,
          line: lineNum,
          suggestion: 'Use integer arithmetic (store amounts in smallest unit, e.g., paise/cents) or a decimal library. Always round to 2 decimal places for display.',
          fixable: true,
        });
        break; // One per file
      }
    }

    // Check for tax calculation
    if (/tax|gst|vat|service.?charge/i.test(content)) {
      // Ensure tax is calculated before total
      const taxAfterTotal = /total[\s\S]{1,200}tax\s*=/i;
      if (taxAfterTotal.test(content)) {
        this.addFinding(state, {
          severity: 'low',
          category: 'bug',
          title: 'Tax may be calculated after total',
          description: `${file.relativePath}: Tax appears to be calculated after the total is set. This could mean tax is not included in the final total presented to the guest.`,
          file: file.relativePath,
          suggestion: 'Calculate all taxes before computing the final total. total = subtotal + taxes + serviceCharges.',
          fixable: true,
        });
      }
    }
  }

  _checkDateHandling(state, content, file) {
    if (!/date|checkin|checkout|check.?in|check.?out/i.test(content)) return;

    // Skip if file uses UTC dates consistently or uses date-fns/moment
    if (/\.toISOString|utc|UTC|moment\.utc|startOf\('day'\)/i.test(content)) return;

    // Check for timezone issues
    if (content.includes('new Date(') && !content.includes('timezone') && !content.includes('utc') && !content.includes('moment')) {
      const hasDateComparison = /checkIn.*checkOut|startDate.*endDate|fromDate.*toDate/i.test(content);
      if (hasDateComparison) {
        this.addFinding(state, {
          severity: 'medium',
          category: 'bug',
          title: 'Date comparisons without timezone handling',
          description: `${file.relativePath} compares dates (check-in/check-out) without explicit timezone handling. Date comparisons across timezones can cause off-by-one-day errors, leading to bookings on wrong dates.`,
          file: file.relativePath,
          suggestion: 'Normalize all dates to UTC at the API boundary. Store dates in UTC. Convert to local timezone only for display.',
          fixable: true,
        });
      }
    }

    // Checkout before checkin validation
    if (/checkIn|check_in|checkin/i.test(content) && /checkOut|check_out|checkout/i.test(content)) {
      const hasDateValidation = /checkOut.*>.*checkIn|checkIn.*<.*checkOut|after.*before|before.*after/i.test(content);
      if (!hasDateValidation && !content.includes('isBefore') && !content.includes('isAfter')) {
        this.addFinding(state, {
          severity: 'medium',
          category: 'bug',
          title: 'Missing check-in/check-out date validation',
          description: `${file.relativePath} handles check-in and check-out dates but may not validate that check-out is after check-in. This can create negative-duration bookings.`,
          file: file.relativePath,
          suggestion: 'Add validation: if (checkOutDate <= checkInDate) throw new Error("Check-out must be after check-in");',
          fixable: true,
        });
      }
    }
  }

  _checkGuestDataHandling(state, content, file) {
    if (!/guest|customer|visitor/i.test(file.name)) return;

    // PII without encryption
    const piiFields = ['aadhaar', 'passport', 'panCard', 'pan_card', 'ssn', 'socialSecurity', 'driverLicense'];
    for (const field of piiFields) {
      if (content.toLowerCase().includes(field)) {
        if (!content.includes('encrypt') && !content.includes('hash') && !content.includes('cipher')) {
          this.addFinding(state, {
            severity: 'high',
            category: 'security',
            title: `PII field "${field}" may be stored without encryption`,
            description: `${file.relativePath} handles the PII field "${field}" but doesn't appear to encrypt it. Storing government IDs in plaintext violates data protection regulations (GDPR, India's PDPB).`,
            file: file.relativePath,
            suggestion: 'Encrypt PII at rest using AES-256. Only decrypt when needed for display (and mask partially).',
            fixable: true,
          });
          break;
        }
      }
    }
  }

  _checkCancellation(state, content, file) {
    if (!file.relativePath.includes('controller') && !file.relativePath.includes('route')) return;
    if (!/cancel/i.test(content)) return;

    // Cancellation without refund processing
    if (content.includes('cancel') && content.includes('status')) {
      const hasRefundLogic = /refund|payment.*cancel|cancel.*payment|reversal|cancellationRefund|CancellationRefundService|cancellationService|releaseRoomInventory/i.test(content);
      if (!hasRefundLogic) {
        this.addFinding(state, {
          severity: 'medium',
          category: 'missing-feature',
          title: 'Booking cancellation without refund processing',
          description: `${file.relativePath} handles booking cancellation but doesn't appear to process refunds. Guests who paid for cancelled bookings should receive appropriate refunds based on the cancellation policy.`,
          file: file.relativePath,
          suggestion: 'Implement cancellation refund logic: check cancellation policy, calculate refund amount, initiate refund via payment provider.',
          fixable: false,
        });
      }
    }

    // Cancellation without releasing room inventory
    if (content.includes('cancel') && /room|book/i.test(file.name)) {
      const releasesInventory = /availab|inventory|release|unblock|roomStatus/i.test(content);
      if (!releasesInventory) {
        this.addFinding(state, {
          severity: 'high',
          category: 'bug',
          title: 'Cancellation may not release room inventory',
          description: `${file.relativePath} cancels bookings but may not release the room back to available inventory. This causes phantom bookings that block rooms from being re-sold.`,
          file: file.relativePath,
          suggestion: 'When cancelling a booking, always update room availability and inventory for the cancelled date range.',
          fixable: true,
        });
      }
    }
  }

  _checkNoShowHandling(state, content, file) {
    if (!/no.?show|noshow/i.test(content)) return;

    // No-show without charging penalty
    const hasChargeLogic = /charge|penalty|fee|debit/i.test(content);
    if (!hasChargeLogic) {
      this.addFinding(state, {
        severity: 'low',
        category: 'missing-feature',
        title: 'No-show handling without penalty charge',
        description: `${file.relativePath} handles no-shows but doesn't appear to charge a penalty. Most hotels charge a no-show fee (typically one night's stay).`,
        file: file.relativePath,
        suggestion: 'Implement no-show penalty charging based on hotel policy.',
        fixable: false,
      });
    }
  }

  _checkOverbooking(state, content, file) {
    if (!/overbook|over.?book|capacity|maxOccupancy/i.test(content)) return;

    // Overbooking without management strategy
    if (content.includes('overbook') || content.includes('over_book')) {
      const hasOverbookingManagement = /waitlist|alternate|relocate|walk|compensation/i.test(content);
      if (!hasOverbookingManagement) {
        this.addFinding(state, {
          severity: 'medium',
          category: 'missing-feature',
          title: 'Overbooking allowed without management strategy',
          description: `${file.relativePath} allows overbooking but doesn't have a management strategy for when overbookings materialize. This can lead to guest dissatisfaction and operational chaos.`,
          file: file.relativePath,
          suggestion: 'Implement overbooking management: waitlist, guest relocation, compensation offers, and alerts for front desk.',
          fixable: false,
        });
      }
    }
  }

  _checkBookingModel(state) {
    const bookingModel = state.context.models.get('Booking');
    if (!bookingModel) return;

    // Check for essential fields
    const essentialFields = [
      'checkIn', 'checkOut', 'status', 'guest', 'room', 'hotel',
      'totalAmount', 'paymentStatus',
    ];

    const fieldNames = bookingModel.fields.map((f) => f.name.toLowerCase());
    const missingFields = essentialFields.filter(
      (ef) => !fieldNames.some((fn) => fn.includes(ef.toLowerCase()))
    );

    if (missingFields.length > 0) {
      this.addFinding(state, {
        severity: 'medium',
        category: 'missing-feature',
        title: `Booking model may be missing essential fields: ${missingFields.join(', ')}`,
        description: `The Booking model may not have all essential fields. Missing: ${missingFields.join(', ')}. These fields are critical for a functional PMS booking system.`,
        file: bookingModel.file,
        suggestion: 'Add missing fields to ensure complete booking data capture.',
        fixable: true,
      });
    }
  }
}
