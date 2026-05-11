import { BaseAgent } from '../core/BaseAgent.js';

/**
 * HotelOperationsAgent - Validates hotel operational workflows.
 *
 * PMs from operations ask: Does housekeeping workflow work end-to-end?
 * Can maintenance track SLAs? Does inventory auto-reorder? Is laundry tracked?
 */
export class HotelOperationsAgent extends BaseAgent {
  constructor() {
    super('HotelOperationsAgent', 'Validates housekeeping, maintenance, inventory, laundry, and staff operational workflows');
  }

  async analyze(state, config) {
    const { scanner } = config;
    const allFiles = [
      ...(state.context.files.controllers || []),
      ...(state.context.files.services || []),
      ...(state.context.files.routes || []),
      ...(state.context.files.models || []),
      ...(state.context.files.jobs || []),
    ];

    await this._checkHousekeepingWorkflow(state, allFiles, scanner);
    await this._checkMaintenanceWorkflow(state, allFiles, scanner);
    await this._checkInventoryManagement(state, allFiles, scanner);
    await this._checkLaundryOperations(state, allFiles, scanner);
    await this._checkStaffManagement(state, allFiles, scanner);
    await this._checkLostAndFound(state, allFiles, scanner);
    await this._checkRoomStatusSync(state, allFiles, scanner);
    await this._checkGuestRequestHandling(state, allFiles, scanner);

    return {
      summary: `Hotel operations analysis complete across ${allFiles.length} files.`,
    };
  }

  async _checkHousekeepingWorkflow(state, allFiles, scanner) {
    const hkFiles = allFiles.filter((f) => /housekeep|cleaning|hk/i.test(f.name));

    let hasTaskAssignment = false;
    let hasRoomStatusUpdate = false;
    let hasPrioritySystem = false;
    let hasInspection = false;
    let hasCheckoutTrigger = false;
    let hasRealTimeUpdate = false;
    let hasMobileSupport = false;

    for (const file of hkFiles) {
      const content = await scanner.readFileContent(file.path);
      if (!content) continue;

      if (/assign|assignTo|assignee|housekeep.*staff/i.test(content)) hasTaskAssignment = true;
      if (/roomStatus|status.*clean|dirty|inspected|outOfOrder/i.test(content)) hasRoomStatusUpdate = true;
      if (/priority|urgent|rush|vip.*clean/i.test(content)) hasPrioritySystem = true;
      if (/inspect|inspection|supervisor.*check|quality/i.test(content)) hasInspection = true;
      if (/checkout.*trigger|checkout.*clean|auto.*assign/i.test(content)) hasCheckoutTrigger = true;
      if (/socket|realtime|emit|broadcast|websocket/i.test(content)) hasRealTimeUpdate = true;
      if (/mobile|app|push/i.test(content)) hasMobileSupport = true;
    }

    const missing = [];
    if (!hasTaskAssignment) missing.push('staff task assignment');
    if (!hasRoomStatusUpdate) missing.push('room status lifecycle (dirty→cleaning→inspected→clean)');
    if (!hasPrioritySystem) missing.push('cleaning priority (VIP, rush, stayover vs checkout)');
    if (!hasInspection) missing.push('supervisor inspection step');
    if (!hasCheckoutTrigger) missing.push('auto-trigger cleaning on checkout');
    if (!hasRealTimeUpdate) missing.push('real-time status updates for front desk');

    if (missing.length > 0) {
      this.addFinding(state, {
        severity: missing.length > 3 ? 'high' : 'medium',
        category: 'missing-feature',
        title: `Housekeeping workflow: ${missing.length} capabilities missing`,
        description: `Housekeeping workflow gaps:\n${missing.map((m) => `  - ${m}`).join('\n')}\n\nHousekeeping is THE most operationally critical department. Without proper workflow automation, rooms aren't cleaned on time, VIP rooms aren't prioritized, and front desk doesn't know which rooms are ready.`,
        suggestion: 'Implement complete housekeeping lifecycle: checkout triggers dirty → assignment → cleaning → inspection → clean. Real-time sync to front desk.',
        fixable: false,
      });
    }
  }

  async _checkMaintenanceWorkflow(state, allFiles, scanner) {
    const maintFiles = allFiles.filter((f) => /maintenan|repair|incident/i.test(f.name));

    let hasSLATracking = false;
    let hasPriorityEscalation = false;
    let hasPreventiveMaint = false;
    let hasVendorAssignment = false;
    let hasRoomBlocking = false;

    for (const file of maintFiles) {
      const content = await scanner.readFileContent(file.path);
      if (!content) continue;

      if (/sla|SLA|dueDate|deadline|responseTime/i.test(content)) hasSLATracking = true;
      if (/escalat|overdue|past.*due|timeout/i.test(content)) hasPriorityEscalation = true;
      if (/preventive|scheduled.*maint|recurring.*maint/i.test(content)) hasPreventiveMaint = true;
      if (/vendor|contractor|external.*assign/i.test(content)) hasVendorAssignment = true;
      if (/blockRoom|roomBlock|outOfOrder|outOfService/i.test(content)) hasRoomBlocking = true;
    }

    const missing = [];
    if (!hasSLATracking) missing.push('SLA/response time tracking');
    if (!hasPriorityEscalation) missing.push('automatic escalation for overdue tasks');
    if (!hasPreventiveMaint) missing.push('preventive/scheduled maintenance');
    if (!hasRoomBlocking) missing.push('automatic room blocking for major repairs');

    if (missing.length > 0) {
      this.addFinding(state, {
        severity: 'medium',
        category: 'missing-feature',
        title: `Maintenance workflow: ${missing.length} capabilities missing`,
        description: `Maintenance management gaps:\n${missing.map((m) => `  - ${m}`).join('\n')}\n\nWithout SLA tracking, maintenance delays go unnoticed. Without preventive maintenance, equipment fails unexpectedly. Without room blocking, guests get assigned to rooms with broken AC.`,
        suggestion: 'Add SLA tracking with escalation alerts. Implement preventive maintenance schedules. Auto-block rooms when major repairs are logged.',
        fixable: false,
      });
    }
  }

  async _checkInventoryManagement(state, allFiles, scanner) {
    const invFiles = allFiles.filter((f) => /inventor|stock|supply|purchas|vendor/i.test(f.name));

    let hasAutoReorder = false;
    let hasParLevel = false;
    let hasExpiryTracking = false;
    let hasConsumptionTracking = false;
    let hasCostAnalysis = false;
    let hasMultiLocation = false;

    for (const file of invFiles) {
      const content = await scanner.readFileContent(file.path);
      if (!content) continue;

      if (/autoReorder|reorderPoint|reorderLevel|autoOrder/i.test(content)) hasAutoReorder = true;
      if (/parLevel|par_level|minimumStock|minQuantity/i.test(content)) hasParLevel = true;
      if (/expir|expiryDate|bestBefore|shelfLife/i.test(content)) hasExpiryTracking = true;
      if (/consumption|consumed|usage.*track/i.test(content)) hasConsumptionTracking = true;
      if (/cost.*analy|costPer|unitCost|totalCost/i.test(content)) hasCostAnalysis = true;
      if (/location|warehouse|store.*room|department.*stock/i.test(content)) hasMultiLocation = true;
    }

    const missing = [];
    if (!hasAutoReorder) missing.push('automatic reorder when stock hits par level');
    if (!hasParLevel) missing.push('par level / minimum stock configuration');
    if (!hasExpiryTracking) missing.push('expiry date tracking (critical for F&B)');
    if (!hasConsumptionTracking) missing.push('per-room/department consumption tracking');

    if (missing.length > 0) {
      this.addFinding(state, {
        severity: 'medium',
        category: 'missing-feature',
        title: `Inventory management: ${missing.length} capabilities missing`,
        description: `Inventory management gaps:\n${missing.map((m) => `  - ${m}`).join('\n')}\n\nWithout auto-reorder, hotels run out of supplies during peak seasons. Without expiry tracking, food safety is compromised. Without consumption tracking, theft goes undetected.`,
        suggestion: 'Implement: par levels → auto-reorder alerts → PO generation → receiving → consumption tracking → variance analysis.',
        fixable: false,
      });
    }
  }

  async _checkLaundryOperations(state, allFiles, scanner) {
    const laundryFiles = allFiles.filter((f) => /laundry|linen/i.test(f.name));

    if (laundryFiles.length === 0) {
      this.addFinding(state, {
        severity: 'low',
        category: 'missing-feature',
        title: 'No laundry management module found',
        description: 'Hotels process hundreds of laundry items daily (linens, towels, guest laundry). Without a laundry management module, tracking is manual, costs are unknown, and guest laundry requests can get lost.',
        suggestion: 'Implement: guest laundry request → collection → processing → delivery. Track per-item costs, turnaround times, and express service.',
        fixable: false,
      });
      return;
    }

    let hasGuestLaundry = false;
    let hasLinenTracking = false;

    for (const file of laundryFiles) {
      const content = await scanner.readFileContent(file.path);
      if (!content) continue;

      if (/guestLaundry|guest.*laundry|personal.*laundry/i.test(content)) hasGuestLaundry = true;
      if (/linen|towel|bedsheet|pillow.*case/i.test(content)) hasLinenTracking = true;
    }

    if (!hasGuestLaundry) {
      this.addFinding(state, {
        severity: 'low',
        category: 'missing-feature',
        title: 'Guest laundry service not tracked',
        description: 'Guest laundry requests and billing may not be tracked. This is a revenue stream for hotels — express laundry charges, dry cleaning, etc.',
        suggestion: 'Add: guest laundry request form → pickup scheduling → item tracking → billing → delivery confirmation.',
        fixable: false,
      });
    }
  }

  async _checkStaffManagement(state, allFiles, scanner) {
    const staffFiles = allFiles.filter((f) => /staff|employee|schedule|shift/i.test(f.name));

    let hasShiftScheduling = false;
    let hasAttendanceTracking = false;
    let hasPerformanceMetrics = false;
    let hasTaskLoadBalancing = false;

    for (const file of staffFiles) {
      const content = await scanner.readFileContent(file.path);
      if (!content) continue;

      if (/shift|schedule|roster|timeSlot/i.test(content)) hasShiftScheduling = true;
      if (/attendance|clockIn|clockOut|timesheet/i.test(content)) hasAttendanceTracking = true;
      if (/performance|kpi|productivity|rating/i.test(content)) hasPerformanceMetrics = true;
      if (/loadBalance|distribute|autoAssign|workload/i.test(content)) hasTaskLoadBalancing = true;
    }

    const missing = [];
    if (!hasShiftScheduling) missing.push('shift scheduling');
    if (!hasAttendanceTracking) missing.push('attendance/clock-in tracking');
    if (!hasTaskLoadBalancing) missing.push('automatic task load balancing');

    if (missing.length > 1) {
      this.addFinding(state, {
        severity: 'low',
        category: 'missing-feature',
        title: `Staff management: ${missing.length} capabilities missing`,
        description: `Staff management gaps: ${missing.join(', ')}. Without shift scheduling, staffing levels may not match occupancy. Without load balancing, some staff are overwhelmed while others are idle.`,
        suggestion: 'Implement shift scheduling tied to occupancy forecast. Auto-distribute tasks based on current workload and location.',
        fixable: false,
      });
    }
  }

  async _checkLostAndFound(state, allFiles, scanner) {
    const lfFiles = allFiles.filter((f) => /lost|found/i.test(f.name));

    if (lfFiles.length === 0) {
      // Check if it's embedded in another module
      let found = false;
      for (const file of allFiles) {
        if (found) break;
        const content = await scanner.readFileContent(file.path);
        if (content && /lostAndFound|lost.*found|lostItem/i.test(content)) {
          found = true;
        }
      }

      if (!found) {
        this.addFinding(state, {
          severity: 'low',
          category: 'missing-feature',
          title: 'No Lost & Found module',
          description: 'Hotels need a Lost & Found system to track items left by guests, notify owners, manage storage, and handle disposal after retention period. Missing this means items get lost permanently, causing guest complaints.',
          suggestion: 'Implement: item logging with photo → guest notification → claim process → storage tracking → disposal after 90 days.',
          fixable: false,
        });
      }
    }
  }

  async _checkRoomStatusSync(state, allFiles, scanner) {
    const roomFiles = allFiles.filter((f) => /room|tapechart|availability/i.test(f.name));

    let hasRealTimeSync = false;
    let hasStatusHistory = false;
    let hasOutOfOrderMgmt = false;

    for (const file of roomFiles) {
      const content = await scanner.readFileContent(file.path);
      if (!content) continue;

      if (/socket|emit|broadcast|realtime|websocket/i.test(content)) hasRealTimeSync = true;
      if (/statusHistory|statusLog|previousStatus/i.test(content)) hasStatusHistory = true;
      if (/outOfOrder|out_of_order|outOfService|maintenance.*room/i.test(content)) hasOutOfOrderMgmt = true;
    }

    if (!hasRealTimeSync) {
      this.addFinding(state, {
        severity: 'medium',
        category: 'missing-feature',
        title: 'Room status may lack real-time sync to front desk',
        description: 'Room status changes (housekeeping completes cleaning, maintenance blocks a room) may not sync in real-time to the front desk tape chart. Staff make decisions on stale data, assigning dirty rooms to arriving guests.',
        suggestion: 'Use WebSocket to push room status changes to all connected front desk clients immediately.',
        fixable: true,
      });
    }
  }

  async _checkGuestRequestHandling(state, allFiles, scanner) {
    const requestFiles = allFiles.filter((f) => /request|service|concierge/i.test(f.name));

    let hasRequestTracking = false;
    let hasResponseSLA = false;
    let hasDepartmentRouting = false;

    for (const file of requestFiles) {
      const content = await scanner.readFileContent(file.path);
      if (!content) continue;

      if (/guestRequest|serviceRequest|requestTrack/i.test(content)) hasRequestTracking = true;
      if (/sla|responseTime|turnaround|deadline/i.test(content)) hasResponseSLA = true;
      if (/department|route.*department|assign.*department/i.test(content)) hasDepartmentRouting = true;
    }

    if (!hasResponseSLA) {
      this.addFinding(state, {
        severity: 'low',
        category: 'missing-feature',
        title: 'Guest requests may lack SLA tracking',
        description: 'Guest service requests (extra towels, room service, wake-up calls) may not have SLA/response time tracking. Without SLAs, requests sit unattended for hours, damaging guest satisfaction scores.',
        suggestion: 'Add SLA tracking: set response time targets per request type. Alert supervisor when SLA is about to breach. Report on SLA compliance.',
        fixable: false,
      });
    }
  }
}
