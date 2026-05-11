/**
 * SLA Monitor Service
 *
 * Tracks service level agreements for hotel room service requests.
 * Monitors response times, compliance rates, and alerts on breaches.
 */
import mongoose from 'mongoose';
export interface SLAThresholds {
    responseTimeMinutes: number;
    completionTimeMinutes: number;
    urgentResponseTimeMinutes: number;
}
export declare const DEFAULT_SLA_THRESHOLDS: SLAThresholds;
export declare const SERVICE_SLA_THRESHOLDS: Record<string, Partial<SLAThresholds>>;
export interface ISLARecord {
    requestId: string;
    bookingId: string;
    hotelId: string;
    roomId: string;
    roomNumber: string;
    guestName: string;
    serviceType: string;
    priority: 'low' | 'medium' | 'high' | 'urgent';
    createdAt: Date;
    assignedAt?: Date;
    inProgressAt?: Date;
    completedAt?: Date;
    responseTimeSeconds?: number;
    completionTimeSeconds?: number;
    responseSLAMet?: boolean;
    completionSLAMet?: boolean;
    isBreaching?: boolean;
    assignedTo?: string;
    staffName?: string;
    notes?: string;
}
export declare const SLARecord: mongoose.Model<any, {}, {}, {}, any, any>;
export declare class SLAMonitorService {
    /**
     * Create a new SLA record when a service request is created
     */
    recordRequestCreated(params: {
        requestId: string;
        bookingId: string;
        hotelId: string;
        roomId: string;
        roomNumber: string;
        guestName: string;
        serviceType: string;
        priority?: 'low' | 'medium' | 'high' | 'urgent';
    }): Promise<ISLARecord>;
    /**
     * Record when a request is assigned to a staff member
     */
    recordAssignment(params: {
        requestId: string;
        staffId: string;
        staffName?: string;
    }): Promise<void>;
    /**
     * Record when a request moves to in-progress
     */
    recordInProgress(requestId: string): Promise<void>;
    /**
     * Record when a request is completed
     */
    recordCompletion(params: {
        requestId: string;
        notes?: string;
    }): Promise<void>;
    /**
     * Get thresholds for a specific request based on service type and priority
     */
    private getThresholdsForRequest;
    /**
     * Get SLA metrics for a hotel
     */
    getHotelSLAMetrics(hotelId: string, periodDays?: number): Promise<{
        overall: {
            totalRequests: number;
            slaComplianceRate: number;
            averageResponseTimeMinutes: number;
            averageCompletionTimeMinutes: number;
            breachingCount: number;
            breachingRate: number;
        };
        byServiceType: Array<{
            serviceType: string;
            totalRequests: number;
            complianceRate: number;
            avgResponseMinutes: number;
            avgCompletionMinutes: number;
        }>;
        breachingRequests: ISLARecord[];
        trends: Array<{
            date: string;
            totalRequests: number;
            complianceRate: number;
            avgResponseMinutes: number;
        }>;
    }>;
    /**
     * Get breaching SLA requests for alerts
     */
    getBreachingRequests(hotelId: string): Promise<ISLARecord[]>;
    /**
     * Get staff performance metrics
     */
    getStaffPerformance(hotelId: string, periodDays?: number): Promise<Array<{
        staffId: string;
        staffName: string;
        totalAssigned: number;
        completed: number;
        slaComplianceRate: number;
        avgResponseMinutes: number;
        avgCompletionMinutes: number;
    }>>;
    /**
     * Check and update breach status for all active requests
     */
    updateBreachStatus(): Promise<number>;
    /**
     * Helper: Group array by key
     */
    private groupBy;
}
export declare const slaMonitor: SLAMonitorService;
export default slaMonitor;
//# sourceMappingURL=sla-monitor.d.ts.map