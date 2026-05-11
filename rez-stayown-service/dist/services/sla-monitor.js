"use strict";
/**
 * SLA Monitor Service
 *
 * Tracks service level agreements for hotel room service requests.
 * Monitors response times, compliance rates, and alerts on breaches.
 */
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.slaMonitor = exports.SLAMonitorService = exports.SLARecord = exports.SERVICE_SLA_THRESHOLDS = exports.DEFAULT_SLA_THRESHOLDS = void 0;
const mongoose_1 = __importDefault(require("mongoose"));
exports.DEFAULT_SLA_THRESHOLDS = {
    responseTimeMinutes: 15, // 15 minutes to acknowledge/assign
    completionTimeMinutes: 60, // 60 minutes to complete
    urgentResponseTimeMinutes: 5, // 5 minutes for urgent
};
// Service type specific SLAs
exports.SERVICE_SLA_THRESHOLDS = {
    housekeeping: { responseTimeMinutes: 10, completionTimeMinutes: 45 },
    room_service: { responseTimeMinutes: 15, completionTimeMinutes: 30 },
    laundry: { responseTimeMinutes: 30, completionTimeMinutes: 240 }, // 4 hours
    concierge: { responseTimeMinutes: 5, completionTimeMinutes: 60 },
    minibar: { responseTimeMinutes: 5, completionTimeMinutes: 15 },
    spa: { responseTimeMinutes: 15, completionTimeMinutes: 120 }, // 2 hours
    transport: { responseTimeMinutes: 10, completionTimeMinutes: 60 },
    maintenance: { responseTimeMinutes: 20, completionTimeMinutes: 90 },
};
const SLARecordSchema = new mongoose_1.default.Schema({
    requestId: { type: String, required: true, unique: true, index: true },
    bookingId: { type: String, required: true, index: true },
    hotelId: { type: String, required: true, index: true },
    roomId: { type: String, required: true, index: true },
    roomNumber: { type: String, required: true },
    guestName: { type: String, required: true },
    serviceType: { type: String, required: true, index: true },
    priority: {
        type: String,
        enum: ['low', 'medium', 'high', 'urgent'],
        default: 'medium'
    },
    // Timestamps
    createdAt: { type: Date, required: true, index: true },
    assignedAt: { type: Date },
    inProgressAt: { type: Date },
    completedAt: { type: Date },
    // Calculated times
    responseTimeSeconds: { type: Number },
    completionTimeSeconds: { type: Number },
    // SLA status
    responseSLAMet: { type: Boolean },
    completionSLAMet: { type: Boolean },
    isBreaching: { type: Boolean, index: true },
    // Metadata
    assignedTo: { type: String, index: true },
    staffName: { type: String },
    notes: { type: String },
}, { timestamps: true });
// Index for efficient SLA breach queries
SLARecordSchema.index({ hotelId: 1, isBreaching: 1, createdAt: -1 });
SLARecordSchema.index({ hotelId: 1, serviceType: 1, createdAt: -1 });
SLARecordSchema.index({ hotelId: 1, assignedTo: 1, createdAt: -1 });
exports.SLARecord = mongoose_1.default.models.SLARecord ||
    mongoose_1.default.model('SLARecord', SLARecordSchema);
// ─── SLA Service Class ────────────────────────────────────────────────────────
class SLAMonitorService {
    /**
     * Create a new SLA record when a service request is created
     */
    async recordRequestCreated(params) {
        const record = new exports.SLARecord({
            requestId: params.requestId,
            bookingId: params.bookingId,
            hotelId: params.hotelId,
            roomId: params.roomId,
            roomNumber: params.roomNumber,
            guestName: params.guestName,
            serviceType: params.serviceType,
            priority: params.priority || 'medium',
            createdAt: new Date(),
            isBreaching: false,
        });
        await record.save();
        return record;
    }
    /**
     * Record when a request is assigned to a staff member
     */
    async recordAssignment(params) {
        const record = await exports.SLARecord.findOne({ requestId: params.requestId });
        if (!record) {
            console.warn(`[SLAMonitor] Record not found for request: ${params.requestId}`);
            return;
        }
        const now = new Date();
        record.assignedAt = now;
        record.assignedTo = params.staffId;
        record.staffName = params.staffName;
        // Calculate response time
        if (record.createdAt) {
            record.responseTimeSeconds = Math.round((now.getTime() - record.createdAt.getTime()) / 1000);
            // Check response SLA
            const thresholds = this.getThresholdsForRequest(record);
            const responseTimeMinutes = record.responseTimeSeconds / 60;
            record.responseSLAMet = responseTimeMinutes <= thresholds.responseTimeMinutes;
            // Check if currently breaching
            if (!record.responseSLAMet && !record.completedAt) {
                record.isBreaching = true;
            }
        }
        await record.save();
    }
    /**
     * Record when a request moves to in-progress
     */
    async recordInProgress(requestId) {
        const record = await exports.SLARecord.findOne({ requestId });
        if (!record)
            return;
        record.inProgressAt = new Date();
        await record.save();
    }
    /**
     * Record when a request is completed
     */
    async recordCompletion(params) {
        const record = await exports.SLARecord.findOne({ requestId: params.requestId });
        if (!record)
            return;
        const now = new Date();
        record.completedAt = now;
        // Calculate completion time
        if (record.createdAt) {
            record.completionTimeSeconds = Math.round((now.getTime() - record.createdAt.getTime()) / 1000);
            // Check completion SLA
            const thresholds = this.getThresholdsForRequest(record);
            const completionTimeMinutes = record.completionTimeSeconds / 60;
            record.completionSLAMet = completionTimeMinutes <= thresholds.completionTimeMinutes;
            // If SLA is met, no longer breaching
            if (record.completionSLAMet) {
                record.isBreaching = false;
            }
        }
        if (params.notes) {
            record.notes = params.notes;
        }
        await record.save();
    }
    /**
     * Get thresholds for a specific request based on service type and priority
     */
    getThresholdsForRequest(record) {
        const serviceThresholds = exports.SERVICE_SLA_THRESHOLDS[record.serviceType] || {};
        const thresholds = { ...exports.DEFAULT_SLA_THRESHOLDS };
        // Apply service-specific thresholds
        if (serviceThresholds.responseTimeMinutes) {
            thresholds.responseTimeMinutes = serviceThresholds.responseTimeMinutes;
        }
        if (serviceThresholds.completionTimeMinutes) {
            thresholds.completionTimeMinutes = serviceThresholds.completionTimeMinutes;
        }
        // Urgent requests have tighter SLAs
        if (record.priority === 'urgent' || record.priority === 'high') {
            thresholds.responseTimeMinutes = Math.min(thresholds.responseTimeMinutes, exports.DEFAULT_SLA_THRESHOLDS.urgentResponseTimeMinutes);
        }
        return thresholds;
    }
    /**
     * Get SLA metrics for a hotel
     */
    async getHotelSLAMetrics(hotelId, periodDays = 7) {
        const startDate = new Date();
        startDate.setDate(startDate.getDate() - periodDays);
        // Get all records for the period
        const records = await exports.SLARecord.find({
            hotelId,
            createdAt: { $gte: startDate },
        });
        // Overall metrics
        const completedRecords = records.filter(r => r.completedAt);
        const totalRequests = records.length;
        const breachedCount = records.filter(r => r.isBreaching).length;
        const responseSLAMetCount = records.filter(r => r.responseSLAMet === true).length;
        const completionSLAMetCount = completedRecords.filter(r => r.completionSLAMet === true).length;
        const avgResponseSeconds = records.reduce((sum, r) => sum + (r.responseTimeSeconds || 0), 0) / (records.length || 1);
        const avgCompletionSeconds = completedRecords.reduce((sum, r) => sum + (r.completionTimeSeconds || 0), 0) / (completedRecords.length || 1);
        // By service type
        const serviceTypeGroups = this.groupBy(records, 'serviceType');
        const byServiceType = Object.entries(serviceTypeGroups).map(([serviceType, recs]) => {
            const completed = recs.filter(r => r.completedAt);
            const metCount = completed.filter(r => r.completionSLAMet).length;
            return {
                serviceType,
                totalRequests: recs.length,
                complianceRate: completed.length > 0 ? (metCount / completed.length) * 100 : 0,
                avgResponseMinutes: (recs.reduce((sum, r) => sum + (r.responseTimeSeconds || 0), 0) / (recs.length || 1)) / 60,
                avgCompletionMinutes: (completed.reduce((sum, r) => sum + (r.completionTimeSeconds || 0), 0) / (completed.length || 1)) / 60,
            };
        });
        // Currently breaching requests
        const breachingRequests = records.filter(r => r.isBreaching && !r.completedAt);
        // Daily trends
        const dailyGroups = this.groupBy(records, (r) => r.createdAt.toISOString().split('T')[0]);
        const trends = Object.entries(dailyGroups)
            .sort(([a], [b]) => a.localeCompare(b))
            .slice(-periodDays)
            .map(([date, recs]) => {
            const completed = recs.filter(r => r.completedAt);
            const metCount = completed.filter(r => r.completionSLAMet).length;
            return {
                date,
                totalRequests: recs.length,
                complianceRate: completed.length > 0 ? (metCount / completed.length) * 100 : 0,
                avgResponseMinutes: (recs.reduce((sum, r) => sum + (r.responseTimeSeconds || 0), 0) / (recs.length || 1)) / 60,
            };
        });
        return {
            overall: {
                totalRequests,
                slaComplianceRate: completedRecords.length > 0 ? (completionSLAMetCount / completedRecords.length) * 100 : 100,
                averageResponseTimeMinutes: avgResponseSeconds / 60,
                averageCompletionTimeMinutes: avgCompletionSeconds / 60,
                breachingCount: breachingRequests.length,
                breachingRate: totalRequests > 0 ? (breachedCount / totalRequests) * 100 : 0,
            },
            byServiceType,
            breachingRequests,
            trends,
        };
    }
    /**
     * Get breaching SLA requests for alerts
     */
    async getBreachingRequests(hotelId) {
        return exports.SLARecord.find({
            hotelId,
            isBreaching: true,
            completedAt: { $exists: false },
        }).sort({ createdAt: 1 });
    }
    /**
     * Get staff performance metrics
     */
    async getStaffPerformance(hotelId, periodDays = 7) {
        const startDate = new Date();
        startDate.setDate(startDate.getDate() - periodDays);
        const records = await exports.SLARecord.find({
            hotelId,
            assignedTo: { $exists: true },
            createdAt: { $gte: startDate },
        });
        const staffGroups = this.groupBy(records.filter(r => r.assignedTo), 'assignedTo');
        return Object.entries(staffGroups).map(([staffId, recs]) => {
            const completed = recs.filter(r => r.completedAt);
            const metCount = completed.filter(r => r.completionSLAMet).length;
            return {
                staffId,
                staffName: recs[0]?.staffName || 'Unknown',
                totalAssigned: recs.length,
                completed: completed.length,
                slaComplianceRate: completed.length > 0 ? (metCount / completed.length) * 100 : 0,
                avgResponseMinutes: (recs.reduce((sum, r) => sum + (r.responseTimeSeconds || 0), 0) / (recs.length || 1)) / 60,
                avgCompletionMinutes: (completed.reduce((sum, r) => sum + (r.completionTimeSeconds || 0), 0) / (completed.length || 1)) / 60,
            };
        }).sort((a, b) => b.totalAssigned - a.totalAssigned);
    }
    /**
     * Check and update breach status for all active requests
     */
    async updateBreachStatus() {
        const activeRecords = await exports.SLARecord.find({
            completedAt: { $exists: false },
        });
        let updatedCount = 0;
        for (const record of activeRecords) {
            const thresholds = this.getThresholdsForRequest(record);
            const now = new Date();
            const elapsedMinutes = (now.getTime() - record.createdAt.getTime()) / (1000 * 60);
            const wasBreaching = record.isBreaching;
            // Check if response SLA is breached
            if (!record.assignedAt) {
                if (elapsedMinutes > thresholds.responseTimeMinutes) {
                    record.isBreaching = true;
                    record.responseSLAMet = false;
                }
            }
            // Check if completion SLA is breached
            if (elapsedMinutes > thresholds.completionTimeMinutes) {
                record.isBreaching = true;
                record.completionSLAMet = false;
            }
            if (record.isBreaching !== wasBreaching) {
                await record.save();
                updatedCount++;
            }
        }
        return updatedCount;
    }
    /**
     * Helper: Group array by key
     */
    groupBy(array, key) {
        return array.reduce((groups, item) => {
            const groupKey = typeof key === 'function' ? key(item) : String(item[key]);
            groups[groupKey] = groups[groupKey] || [];
            groups[groupKey].push(item);
            return groups;
        }, {});
    }
}
exports.SLAMonitorService = SLAMonitorService;
// ─── Singleton Export ─────────────────────────────────────────────────────────
exports.slaMonitor = new SLAMonitorService();
exports.default = exports.slaMonitor;
//# sourceMappingURL=sla-monitor.js.map