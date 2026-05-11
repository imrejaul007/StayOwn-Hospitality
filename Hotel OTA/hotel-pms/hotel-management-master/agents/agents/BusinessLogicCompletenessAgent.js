import { BaseAgent } from '../core/BaseAgent.js';

/**
 * BusinessLogicCompletenessAgent - Validates feature completeness from a product perspective.
 *
 * This is the "20 PM" agent. It asks:
 * - Can a guest complete the full booking journey?
 * - Are users notified at every critical touchpoint?
 * - Does every role have appropriate access?
 * - Are all business rules enforced?
 * - Is reporting complete for management decisions?
 */
export class BusinessLogicCompletenessAgent extends BaseAgent {
  constructor() {
    super('BusinessLogicCompletenessAgent', 'Validates feature completeness: user journeys, notification coverage, role access, reporting, and business rule enforcement');
  }

  async analyze(state, config) {
    await this._checkBookingJourney(state, config);
    await this._checkNotificationCoverage(state, config);
    await this._checkRoleAccessCompleteness(state, config);
    await this._checkCRUDCompleteness(state, config);
    await this._checkReportingCompleteness(state, config);
    await this._checkSearchCapabilities(state, config);
    await this._checkWorkflowCompleteness(state, config);
    await this._checkNightAudit(state, config);
    await this._checkMultiPropertyOps(state, config);
    await this._checkGuestCommunication(state, config);

    return {
      summary: 'Business logic completeness analysis complete.',
    };
  }

  async _checkBookingJourney(state, config) {
    const { scanner } = config;
    const services = state.context.files.services || [];
    const controllers = state.context.files.controllers || [];
    const allFiles = [...services, ...controllers];

    // Critical steps in the booking journey
    const journeySteps = [
      { step: 'availability search', patterns: ['availab', 'search', 'checkAvail'], found: false },
      { step: 'rate calculation', patterns: ['rate', 'price', 'tariff', 'calculateRate'], found: false },
      { step: 'booking creation', patterns: ['createBooking', 'newBooking', 'book'], found: false },
      { step: 'payment processing', patterns: ['paymentIntent', 'processPayment', 'charge'], found: false },
      { step: 'booking confirmation', patterns: ['confirm', 'confirmation'], found: false },
      { step: 'pre-arrival email', patterns: ['preArrival', 'pre-arrival', 'beforeCheckIn', 'preCheckIn', 'reminder', 'preArrival'], found: false },
      { step: 'check-in', patterns: ['checkIn', 'check_in', 'checkin'], found: false },
      { step: 'room assignment', patterns: ['assignRoom', 'roomAssign'], found: false },
      { step: 'folio management', patterns: ['folio', 'billing', 'charge'], found: false },
      { step: 'check-out', patterns: ['checkOut', 'check_out', 'checkout'], found: false },
      { step: 'invoice generation', patterns: ['invoice', 'generateInvoice', 'bill'], found: false },
      { step: 'post-stay feedback', patterns: ['review', 'feedback', 'survey', 'postStay'], found: false },
    ];

    for (const file of allFiles) {
      const content = await scanner.readFileContent(file.path);
      if (!content) continue;

      for (const step of journeySteps) {
        if (!step.found) {
          step.found = step.patterns.some((p) => content.toLowerCase().includes(p.toLowerCase()));
        }
      }
    }

    const missingSteps = journeySteps.filter((s) => !s.found);
    if (missingSteps.length > 0) {
      this.addFinding(state, {
        severity: 'high',
        category: 'missing-feature',
        title: `Guest booking journey: ${missingSteps.length} steps may be missing`,
        description: `The following booking journey steps were not found in the codebase:\n${missingSteps.map((s) => `  - ${s.step}`).join('\n')}\n\nA complete guest journey from search to post-stay is essential for a PMS. Missing steps create manual workarounds for staff and poor guest experience.`,
        suggestion: 'Implement the missing journey steps. Priority: payment processing → room assignment → invoice generation → post-stay feedback.',
        fixable: false,
      });
    }
  }

  async _checkNotificationCoverage(state, config) {
    const { scanner } = config;
    const allFiles = [
      ...(state.context.files.services || []),
      ...(state.context.files.controllers || []),
    ];

    // Critical events that MUST trigger notifications
    const criticalEvents = [
      { event: 'booking confirmed', patterns: ['bookingConfirm', 'confirmBooking', 'status.*confirmed'], found: false, needsEmail: true, needsNotif: true },
      { event: 'booking cancelled', patterns: ['bookingCancel', 'cancelBooking', 'status.*cancel'], found: false, needsEmail: true, needsNotif: true },
      { event: 'payment received', patterns: ['paymentReceived', 'paymentSuccess', 'payment.*complete'], found: false, needsEmail: true, needsNotif: true },
      { event: 'payment failed', patterns: ['paymentFail', 'paymentDecline', 'payment.*fail'], found: false, needsEmail: true, needsNotif: true },
      { event: 'check-in completed', patterns: ['checkIn.*complete', 'checked_in'], found: false, needsEmail: false, needsNotif: true },
      { event: 'check-out completed', patterns: ['checkOut.*complete', 'checked_out'], found: false, needsEmail: true, needsNotif: true },
      { event: 'no-show detected', patterns: ['noShow', 'no_show', 'no-show'], found: false, needsEmail: false, needsNotif: true },
      { event: 'maintenance request', patterns: ['maintenance.*create', 'maintenanceRequest'], found: false, needsEmail: false, needsNotif: true },
      { event: 'low inventory alert', patterns: ['lowStock', 'reorder', 'inventoryAlert', 'low.*inventory'], found: false, needsEmail: false, needsNotif: true },
      { event: 'settlement due', patterns: ['settlementDue', 'settlement.*due'], found: false, needsEmail: true, needsNotif: true },
      { event: 'guest complaint/incident', patterns: ['incident', 'complaint'], found: false, needsEmail: false, needsNotif: true },
      { event: 'staff task assigned', patterns: ['taskAssign', 'assignTask', 'staffTask.*create'], found: false, needsEmail: false, needsNotif: true },
    ];

    for (const file of allFiles) {
      const content = await scanner.readFileContent(file.path);
      if (!content) continue;

      for (const event of criticalEvents) {
        if (event.found) continue;
        const hasEvent = event.patterns.some((p) => new RegExp(p, 'i').test(content));
        if (hasEvent) {
          const hasNotification = /notification|notify|sendEmail|emailService|emit|socket|alert/i.test(content);
          event.found = hasNotification;
        }
      }
    }

    const missingNotifications = criticalEvents.filter((e) => !e.found);
    if (missingNotifications.length > 0) {
      this.addFinding(state, {
        severity: 'medium',
        category: 'missing-feature',
        title: `${missingNotifications.length} critical events may lack notifications`,
        description: `The following events may not trigger proper notifications:\n${missingNotifications.map((e) => `  - ${e.event}${e.needsEmail ? ' (needs email)' : ''}`).join('\n')}\n\nMissing notifications mean staff miss critical events and guests don't get confirmations. This leads to operational chaos and poor guest satisfaction.`,
        suggestion: 'Add email + in-app notifications for all critical business events. Use the existing notification service.',
        fixable: false,
      });
    }
  }

  async _checkRoleAccessCompleteness(state, config) {
    const { scanner } = config;
    const routeFiles = state.context.files.routes || [];

    // Roles that should exist in the system
    const expectedRoles = ['admin', 'manager', 'frontdesk', 'staff', 'housekeeping', 'guest', 'travel_agent'];

    let rolesFound = new Set();
    for (const file of routeFiles) {
      const content = await scanner.readFileContent(file.path);
      if (!content) continue;

      const roleMatches = content.match(/(?:authorize|role|roles)\s*\(\s*['"]([\w,\s'"]+)/gi) || [];
      for (const match of roleMatches) {
        const roles = match.match(/['"](\w+)['"]/g) || [];
        roles.forEach((r) => rolesFound.add(r.replace(/['"]/g, '')));
      }
    }

    const missingRoles = expectedRoles.filter((r) => !rolesFound.has(r));
    if (missingRoles.length > 0) {
      this.addFinding(state, {
        severity: 'medium',
        category: 'missing-feature',
        title: `Role-based access: ${missingRoles.length} expected roles not found in route guards`,
        description: `Roles not referenced in route authorization: ${missingRoles.join(', ')}. Without role-specific route guards, these roles either have no dedicated access or share access with other roles.`,
        suggestion: 'Define specific route access for each role. Housekeeping staff shouldn\'t access financial data. Guests shouldn\'t access admin panels.',
        fixable: false,
      });
    }
  }

  async _checkCRUDCompleteness(state, config) {
    const routes = state.context.routes;

    // Core entities that need full CRUD
    const coreEntities = ['booking', 'room', 'guest', 'payment', 'invoice', 'housekeeping', 'inventory', 'staff'];

    for (const entity of coreEntities) {
      let hasCreate = false;
      let hasRead = false;
      let hasUpdate = false;
      let hasDelete = false;
      let hasList = false;

      for (const [, routeInfo] of routes) {
        if (!routeInfo.file.toLowerCase().includes(entity)) continue;

        for (const ep of routeInfo.endpoints) {
          if (ep.method === 'POST' && !ep.path.includes('search')) hasCreate = true;
          if (ep.method === 'GET' && ep.path.includes(':')) hasRead = true;
          if (ep.method === 'GET' && !ep.path.includes(':')) hasList = true;
          if (ep.method === 'PUT' || ep.method === 'PATCH') hasUpdate = true;
          if (ep.method === 'DELETE') hasDelete = true;
        }
      }

      const missing = [];
      if (!hasCreate) missing.push('CREATE');
      if (!hasRead) missing.push('READ');
      if (!hasList) missing.push('LIST');
      if (!hasUpdate) missing.push('UPDATE');
      if (!hasDelete) missing.push('DELETE');

      if (missing.length > 0) {
        this.addFinding(state, {
          severity: missing.length > 2 ? 'medium' : 'low',
          category: 'missing-feature',
          title: `Incomplete CRUD for "${entity}": missing ${missing.join(', ')}`,
          description: `The "${entity}" entity may be missing API operations: ${missing.join(', ')}. Incomplete CRUD forces workarounds — staff may need to directly edit the database.`,
          suggestion: `Add the missing endpoints for "${entity}". Every core entity should have: list, get-by-id, create, update, soft-delete.`,
          fixable: false,
        });
      }
    }
  }

  async _checkReportingCompleteness(state, config) {
    const { scanner } = config;
    const allFiles = [
      ...(state.context.files.services || []),
      ...(state.context.files.controllers || []),
    ];

    // KPIs that hotel managers NEED
    const essentialKPIs = [
      { kpi: 'Occupancy Rate', patterns: ['occupancy', 'occupancyRate'], found: false },
      { kpi: 'ADR (Average Daily Rate)', patterns: ['averageDailyRate', 'ADR', 'avgRate'], found: false },
      { kpi: 'RevPAR (Revenue Per Available Room)', patterns: ['revPAR', 'revenuePerAvailable'], found: false },
      { kpi: 'GOPPAR (Gross Operating Profit)', patterns: ['goppar', 'grossOperating'], found: false },
      { kpi: 'Guest Satisfaction Score', patterns: ['satisfaction', 'NPS', 'guestScore', 'reviewScore'], found: false },
      { kpi: 'Cancellation Rate', patterns: ['cancellationRate', 'cancelRate'], found: false },
      { kpi: 'No-Show Rate', patterns: ['noShowRate', 'noshow.*rate'], found: false },
      { kpi: 'Average Length of Stay', patterns: ['averageLOS', 'lengthOfStay', 'avgStay'], found: false },
      { kpi: 'Revenue by Channel', patterns: ['revenueByChannel', 'channelRevenue', 'otaRevenue'], found: false },
      { kpi: 'Housekeeping Turnaround Time', patterns: ['turnaround', 'cleaningTime', 'housekeeping.*time'], found: false },
    ];

    for (const file of allFiles) {
      const content = await scanner.readFileContent(file.path);
      if (!content) continue;

      for (const kpi of essentialKPIs) {
        if (!kpi.found) {
          kpi.found = kpi.patterns.some((p) => new RegExp(p, 'i').test(content));
        }
      }
    }

    const missingKPIs = essentialKPIs.filter((k) => !k.found);
    if (missingKPIs.length > 0) {
      this.addFinding(state, {
        severity: missingKPIs.length > 5 ? 'medium' : 'low',
        category: 'missing-feature',
        title: `${missingKPIs.length} essential hotel KPIs may be missing from reports`,
        description: `The following industry-standard KPIs were not found:\n${missingKPIs.map((k) => `  - ${k.kpi}`).join('\n')}\n\nHotel managers rely on these KPIs for daily decisions. Without them, the PMS doesn't provide enough business intelligence for effective management.`,
        suggestion: 'Implement missing KPIs in the analytics/reporting module. Most can be derived from existing booking and financial data.',
        fixable: false,
      });
    }
  }

  async _checkSearchCapabilities(state, config) {
    const { scanner } = config;
    const controllers = state.context.files.controllers || [];

    let listEndpointsWithoutSearch = 0;
    let total = 0;

    for (const file of controllers) {
      const content = await scanner.readFileContent(file.path);
      if (!content) continue;

      // Check if list/get-all endpoints support search/filter
      const hasList = /getAll|list|index|\.find\s*\(/i.test(content);
      if (!hasList) continue;
      total++;

      const hasSearch = /search|filter|query|keyword|q=|searchTerm|textSearch|\$text/i.test(content);
      const hasSorting = /sort|orderBy|order_by|sortBy/i.test(content);
      const hasFiltering = /filter|where|status.*=|date.*=|type.*=/i.test(content);

      if (!hasSearch && !hasFiltering) {
        listEndpointsWithoutSearch++;
      }
    }

    if (listEndpointsWithoutSearch > 10) {
      this.addFinding(state, {
        severity: 'medium',
        category: 'missing-feature',
        title: `~${listEndpointsWithoutSearch} list endpoints without search/filter capabilities`,
        description: `Approximately ${listEndpointsWithoutSearch} out of ${total} list endpoints don't support search or filtering. Staff searching through hundreds of bookings/guests without filters will waste significant time, especially during busy check-in periods.`,
        suggestion: 'Add search/filter support to all list endpoints. Support: keyword search, date range, status filter, and sorting.',
        fixable: false,
      });
    }
  }

  async _checkWorkflowCompleteness(state, config) {
    const { scanner } = config;
    const allFiles = [...(state.context.files.services || []), ...(state.context.files.controllers || [])];

    // Check for approval workflow completeness
    let hasApprovalCreate = false;
    let hasApprovalApprove = false;
    let hasApprovalReject = false;
    let hasApprovalEscalation = false;

    for (const file of allFiles) {
      if (!file.name.toLowerCase().includes('approval') && !file.name.toLowerCase().includes('workflow')) continue;
      const content = await scanner.readFileContent(file.path);
      if (!content) continue;

      if (/create.*approval|requestApproval/i.test(content)) hasApprovalCreate = true;
      if (/approve|approved/i.test(content)) hasApprovalApprove = true;
      if (/reject|denied/i.test(content)) hasApprovalReject = true;
      if (/escalat|timeout|expire.*approval/i.test(content)) hasApprovalEscalation = true;
    }

    if (hasApprovalCreate && !hasApprovalEscalation) {
      this.addFinding(state, {
        severity: 'medium',
        category: 'missing-feature',
        title: 'Approval workflow may lack escalation/timeout',
        description: 'The approval workflow supports creation and approval/rejection but may not handle escalation or timeout. Pending approvals can stay forever, blocking operations like rate overrides, discount requests, or bypass requests.',
        suggestion: 'Add: (1) Auto-escalation after X hours to a higher authority. (2) Auto-approve/reject after timeout. (3) Notification reminders for pending approvals.',
        fixable: false,
      });
    }
  }

  async _checkNightAudit(state, config) {
    const { scanner } = config;
    const allFiles = [...(state.context.files.services || []), ...(state.context.files.jobs || [])];

    let hasNightAudit = false;
    let hasDayClose = false;
    let hasAutoPostCharges = false;
    let hasNoShowProcessing = false;

    for (const file of allFiles) {
      const content = await scanner.readFileContent(file.path);
      if (!content) continue;

      if (/nightAudit|night_audit|endOfDay|dayClose|NightAuditService/i.test(content)) hasNightAudit = true;
      if (/dayClose|closeDay|endOfBusiness/i.test(content)) hasDayClose = true;
      if (/autoPost|postRoomCharge|dailyRate.*post/i.test(content)) hasAutoPostCharges = true;
      if (/noShow.*process|processNoShow|markNoShow/i.test(content)) hasNoShowProcessing = true;
    }

    if (!hasNightAudit) {
      this.addFinding(state, {
        severity: 'high',
        category: 'missing-feature',
        title: 'Missing Night Audit / End-of-Day process',
        description: 'No night audit process found. This is a CRITICAL feature for any PMS. Night audit performs: (1) Post daily room charges to folios, (2) Process no-shows, (3) Advance the business date, (4) Generate daily revenue reports, (5) Reconcile cash/card transactions. Without it, daily financial operations require manual work.',
        suggestion: 'Implement a night audit job that runs at a configurable time (typically 2-4 AM). Should be triggerable manually and via cron.',
        fixable: false,
      });
    }
  }

  async _checkMultiPropertyOps(state, config) {
    const { scanner } = config;
    const allFiles = [...(state.context.files.services || []), ...(state.context.files.controllers || [])];

    let hasCentralDashboard = false;
    let hasCrossPropertyReporting = false;
    let hasCentralizedUserMgmt = false;

    for (const file of allFiles) {
      const content = await scanner.readFileContent(file.path);
      if (!content) continue;

      if (/centralDashboard|multiProperty.*dashboard|allProperties/i.test(content)) hasCentralDashboard = true;
      if (/crossProperty|allHotels.*report|consolidated.*report/i.test(content)) hasCrossPropertyReporting = true;
      if (/centralUser|crossProperty.*user|multiHotel.*user/i.test(content)) hasCentralizedUserMgmt = true;
    }

    const missing = [];
    if (!hasCentralDashboard) missing.push('central dashboard across all properties');
    if (!hasCrossPropertyReporting) missing.push('cross-property consolidated reporting');
    if (!hasCentralizedUserMgmt) missing.push('centralized user management across properties');

    if (missing.length > 1) {
      this.addFinding(state, {
        severity: 'medium',
        category: 'missing-feature',
        title: `Multi-property management gaps: ${missing.length} features missing`,
        description: `For a multi-property PMS, the following are missing:\n${missing.map((m) => `  - ${m}`).join('\n')}\n\nHotel chains need to manage multiple properties from a single interface. Without these, each property operates in isolation.`,
        suggestion: 'Implement: central dashboard showing all properties, consolidated reporting, and centralized user/role management.',
        fixable: false,
      });
    }
  }

  async _checkGuestCommunication(state, config) {
    const { scanner } = config;
    const allFiles = [...(state.context.files.services || []), ...(state.context.files.controllers || [])];

    const communicationChannels = [
      { channel: 'Email notifications', pattern: /email|sendMail|nodemailer/i, found: false },
      { channel: 'SMS notifications', pattern: /sms|twilio|textMessage|sendSMS/i, found: false },
      { channel: 'Push notifications', pattern: /pushNotification|webPush|firebase.*message/i, found: false },
      { channel: 'WhatsApp integration', pattern: /whatsapp|whatsApp/i, found: false },
      { channel: 'In-app messaging', pattern: /chat|messaging|conversation|livechat/i, found: false },
    ];

    for (const file of allFiles) {
      const content = await scanner.readFileContent(file.path);
      if (!content) continue;

      for (const ch of communicationChannels) {
        if (!ch.found && ch.pattern.test(content)) ch.found = true;
      }
    }

    const missing = communicationChannels.filter((c) => !c.found);
    if (missing.length > 2) {
      this.addFinding(state, {
        severity: 'low',
        category: 'missing-feature',
        title: `Guest communication: ${missing.length} channels not implemented`,
        description: `Missing communication channels: ${missing.map((m) => m.channel).join(', ')}. Modern guests expect multi-channel communication. SMS for urgent updates, WhatsApp for convenience, push for real-time alerts.`,
        suggestion: 'Prioritize: SMS for booking confirmations and check-in alerts. WhatsApp for guest requests. Push notifications for real-time updates.',
        fixable: false,
      });
    }
  }
}
