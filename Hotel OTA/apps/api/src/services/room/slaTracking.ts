/**
 * SLA Tracking Service for Hotel Staff Dashboard
 * Tracks and monitors Service Level Agreement compliance for room service requests
 */

import { prisma } from '../../config/database';
import { logger } from '../../config/logger';

// SLA Configuration - Target response times in minutes
export const SLA_TARGETS: Record<string, number> = {
  housekeeping: 30,  // 30 minutes
  room_service: 20,  // 20 minutes
  spa: 60,          // 60 minutes
  laundry: 120,      // 2 hours
  maintenance: 45,   // 45 minutes
  concierge: 15,     // 15 minutes
  transport: 30,     // 30 minutes
  minibar: 15,       // 15 minutes
};

// SLA Warning threshold (percentage of target time)
export const SLA_WARNING_THRESHOLD = 0.75; // 75% of target time

// SLA Breach threshold (percentage of target time)
export const SLA_BREACH_THRESHOLD = 1.0; // 100% of target time

// SLA statuses
export type SLAStatus = 'ok' | 'warning' | 'breach';

// SLA Alert thresholds (in minutes)
export interface SLAAlertThresholds {
  warning: number; // When to send warning notification
  breach: number; // When to mark as breached
}

// Interface for SLA tracking data
export interface SLAStatusResult {
  requestId: string;
  serviceType: string;
  priority: string;
  targetMinutes: number;
  elapsedMinutes: number;
  percentUsed: number;
  status: SLAStatus;
  estimatedCompletion: Date | null;
  warnings: string[];
}

// Interface for SLA statistics
export interface SLAStatistics {
  totalRequests: number;
  onTime: number;
  breached: number;
  inProgress: number;
  complianceRate: number;
  avgResponseTime: number;
  avgResolutionTime: number;
  byServiceType: {
    serviceType: string;
    total: number;
    breached: number;
    complianceRate: number;
    avgResponseTime: number;
  }[];
  byPriority: {
    priority: string;
    total: number;
    breached: number;
    complianceRate: number;
  }[];
}

/**
 * Calculate SLA status for a specific request
 */
export async function getRequestSLAStatus(requestId: string): Promise<SLAStatusResult | null> {
  try {
    const request = await prisma.roomServiceRequest.findUnique({
      where: { id: requestId },
    });

    if (!request) {
      logger.warn('Request not found for SLA tracking', { requestId });
      return null;
    }

    const targetMinutes = SLA_TARGETS[request.serviceType] || 30;
    const createdAt = request.createdAt;
    const now = new Date();
    const elapsedMs = now.getTime() - createdAt.getTime();
    const elapsedMinutes = elapsedMs / 60000;
    const percentUsed = (elapsedMinutes / targetMinutes) * 100;

    // Determine status based on elapsed time
    let status: SLAStatus = 'ok';
    const warnings: string[] = [];

    if (percentUsed >= SLA_BREACH_THRESHOLD * 100) {
      status = 'breach';
      warnings.push(`SLA breached by ${Math.round(elapsedMinutes - targetMinutes)} minutes`);
    } else if (percentUsed >= SLA_WARNING_THRESHOLD * 100) {
      status = 'warning';
      const remaining = targetMinutes - elapsedMinutes;
      warnings.push(`SLA warning: ${Math.round(remaining)} minutes remaining`);
    }

    // Priority adjustment - urgent requests should be tracked more closely
    if (request.priority === 'urgent' && status !== 'breach') {
      const urgentThreshold = 0.5; // 50% for urgent
      if (percentUsed >= urgentThreshold * 100) {
        warnings.push('Urgent request is taking longer than expected');
      }
    }

    // Calculate estimated completion (based on average resolution time for this service type)
    let estimatedCompletion: Date | null = null;
    if (request.status !== 'completed') {
      const avgResolution = await getAverageResolutionTime(request.serviceType);
      estimatedCompletion = new Date(createdAt.getTime() + avgResolution * 60000);
    }

    return {
      requestId: request.id,
      serviceType: request.serviceType,
      priority: request.priority,
      targetMinutes,
      elapsedMinutes: Math.round(elapsedMinutes),
      percentUsed: Math.round(percentUsed),
      status,
      estimatedCompletion,
      warnings,
    };
  } catch (error) {
    logger.error('Error calculating SLA status', { requestId, error });
    throw error;
  }
}

/**
 * Get all SLA alerts for active requests
 */
export async function getSLAAlerts(hotelId: string): Promise<{
  warnings: SLAStatusResult[];
  breaches: SLAStatusResult[];
}> {
  try {
    // Get all active requests (not completed or cancelled)
    const activeRequests = await prisma.roomServiceRequest.findMany({
      where: {
        hotelId,
        status: { in: ['pending', 'assigned', 'in_progress'] },
      },
    });

    const warnings: SLAStatusResult[] = [];
    const breaches: SLAStatusResult[] = [];

    for (const request of activeRequests) {
      const slaStatus = await getRequestSLAStatus(request.id);
      if (slaStatus) {
        if (slaStatus.status === 'warning') {
          warnings.push(slaStatus);
        } else if (slaStatus.status === 'breach') {
          breaches.push(slaStatus);
        }
      }
    }

    // Sort by priority and elapsed time
    const sortByPriority = (a: SLAStatusResult, b: SLAStatusResult) => {
      const priorityOrder = { urgent: 0, high: 1, medium: 2, low: 3 };
      const priorityDiff = priorityOrder[a.priority as keyof typeof priorityOrder] -
                          priorityOrder[b.priority as keyof typeof priorityOrder];
      if (priorityDiff !== 0) return priorityDiff;
      return b.elapsedMinutes - a.elapsedMinutes;
    };

    warnings.sort(sortByPriority);
    breaches.sort(sortByPriority);

    return { warnings, breaches };
  } catch (error) {
    logger.error('Error getting SLA alerts', { hotelId, error });
    throw error;
  }
}

/**
 * Get SLA statistics for a given time period
 */
export async function getSLAStatistics(
  hotelId: string,
  startDate: Date,
  endDate: Date
): Promise<SLAStatistics> {
  try {
    // Get all requests in the time period
    const requests = await prisma.roomServiceRequest.findMany({
      where: {
        hotelId,
        createdAt: { gte: startDate, lte: endDate },
      },
    });

    const totalRequests = requests.length;
    let onTime = 0;
    let breached = 0;
    let inProgress = 0;
    let totalResponseTime = 0;
    let totalResolutionTime = 0;
    let responseTimeCount = 0;
    let resolutionTimeCount = 0;

    // Group by service type
    const byServiceType: Record<string, { total: number; breached: number; responseTimes: number[]; resolutionTimes: number[] }> = {};
    const byPriority: Record<string, { total: number; breached: number }> = {};

    for (const request of requests) {
      const targetMinutes = SLA_TARGETS[request.serviceType] || 30;
      const status = request.status;
      const priority = request.priority;

      // Initialize service type group
      if (!byServiceType[request.serviceType]) {
        byServiceType[request.serviceType] = { total: 0, breached: 0, responseTimes: [], resolutionTimes: [] };
      }

      // Initialize priority group
      if (!byPriority[priority]) {
        byPriority[priority] = { total: 0, breached: 0 };
      }

      byServiceType[request.serviceType].total++;
      byPriority[priority].total++;

      if (status === 'completed') {
        const responseTime = (request.assignedAt?.getTime() || request.createdAt.getTime()) - request.createdAt.getTime();
        const resolutionTime = request.completedAt
          ? request.completedAt.getTime() - request.createdAt.getTime()
          : 0;

        const responseMinutes = responseTime / 60000;
        const resolutionMinutes = resolutionTime / 60000;

        totalResponseTime += responseMinutes;
        totalResolutionTime += resolutionMinutes;
        responseTimeCount++;
        resolutionTimeCount++;

        byServiceType[request.serviceType].responseTimes.push(responseMinutes);
        byServiceType[request.serviceType].resolutionTimes.push(resolutionMinutes);

        if (responseMinutes <= targetMinutes) {
          onTime++;
        } else {
          breached++;
          byServiceType[request.serviceType].breached++;
          byPriority[priority].breached++;
        }
      } else if (status !== 'cancelled') {
        inProgress++;
      }
    }

    // Calculate averages and compliance rates
    const serviceTypeStats = Object.entries(byServiceType).map(([serviceType, data]) => {
      const avgResponseTime = data.responseTimes.length > 0
        ? data.responseTimes.reduce((a, b) => a + b, 0) / data.responseTimes.length
        : 0;
      const complianceRate = data.total > 0
        ? ((data.total - data.breached) / data.total) * 100
        : 100;

      return {
        serviceType,
        total: data.total,
        breached: data.breached,
        complianceRate: Math.round(complianceRate),
        avgResponseTime: Math.round(avgResponseTime),
      };
    });

    const priorityStats = Object.entries(byPriority).map(([priority, data]) => {
      const complianceRate = data.total > 0
        ? ((data.total - data.breached) / data.total) * 100
        : 100;

      return {
        priority,
        total: data.total,
        breached: data.breached,
        complianceRate: Math.round(complianceRate),
      };
    });

    return {
      totalRequests,
      onTime,
      breached,
      inProgress,
      complianceRate: totalRequests > 0 ? Math.round((onTime / totalRequests) * 100) : 100,
      avgResponseTime: Math.round(responseTimeCount > 0 ? totalResponseTime / responseTimeCount : 0),
      avgResolutionTime: Math.round(resolutionTimeCount > 0 ? totalResolutionTime / resolutionTimeCount : 0),
      byServiceType: serviceTypeStats,
      byPriority: priorityStats,
    };
  } catch (error) {
    logger.error('Error calculating SLA statistics', { hotelId, error });
    throw error;
  }
}

/**
 * Get average resolution time for a service type
 */
async function getAverageResolutionTime(serviceType: string): Promise<number> {
  try {
    const recentCompleted = await prisma.roomServiceRequest.findMany({
      where: {
        serviceType,
        status: 'completed',
        completedAt: {
          gte: new Date(Date.now() - 7 * 24 * 60 * 60 * 1000), // Last 7 days
        },
      },
      select: {
        createdAt: true,
        completedAt: true,
      },
      take: 50, // Sample last 50 for efficiency
    });

    if (recentCompleted.length === 0) {
      return SLA_TARGETS[serviceType] || 30; // Default to SLA target
    }

    const avgMs =
      recentCompleted.reduce((sum, req) => {
        const duration = (req.completedAt?.getTime() || 0) - req.createdAt.getTime();
        return sum + duration;
      }, 0) / recentCompleted.length;

    return avgMs / 60000; // Convert to minutes
  } catch (error) {
    logger.warn('Error calculating average resolution time', { serviceType, error });
    return SLA_TARGETS[serviceType] || 30;
  }
}

/**
 * Update SLA status when a request is created
 */
export async function onRequestCreated(requestId: string): Promise<void> {
  try {
    const slaStatus = await getRequestSLAStatus(requestId);
    if (slaStatus && slaStatus.status === 'ok') {
      logger.info('SLA tracking started', {
        requestId,
        serviceType: slaStatus.serviceType,
        targetMinutes: slaStatus.targetMinutes,
      });
    }
  } catch (error) {
    logger.error('Error in onRequestCreated hook', { requestId, error });
  }
}

/**
 * Update SLA status when a request is assigned
 */
export async function onRequestAssigned(requestId: string, staffId: string): Promise<void> {
  try {
    // Update assigned timestamp for response time tracking
    await prisma.roomServiceRequest.update({
      where: { id: requestId },
      data: { assignedAt: new Date() },
    });

    const slaStatus = await getRequestSLAStatus(requestId);
    if (slaStatus) {
      logger.info('Request assigned - SLA tracking updated', {
        requestId,
        staffId,
        elapsedMinutes: slaStatus.elapsedMinutes,
        targetMinutes: slaStatus.targetMinutes,
      });

      // Check if already in warning/breach status
      if (slaStatus.status === 'warning') {
        logger.warn('SLA warning for newly assigned request', {
          requestId,
          percentUsed: slaStatus.percentUsed,
        });
      }
    }
  } catch (error) {
    logger.error('Error in onRequestAssigned hook', { requestId, staffId, error });
  }
}

/**
 * Update SLA status when a request is completed
 */
export async function onRequestCompleted(requestId: string): Promise<{
  responseTime: number;
  resolutionTime: number;
  metSLA: boolean;
}> {
  try {
    const request = await prisma.roomServiceRequest.findUnique({
      where: { id: requestId },
    });

    if (!request) {
      throw new Error('Request not found');
    }

    const targetMinutes = SLA_TARGETS[request.serviceType] || 30;
    const responseTime = request.assignedAt
      ? (request.assignedAt.getTime() - request.createdAt.getTime()) / 60000
      : 0;
    const resolutionTime = request.completedAt
      ? (request.completedAt.getTime() - request.createdAt.getTime()) / 60000
      : 0;
    const metSLA = responseTime <= targetMinutes;

    logger.info('Request completed - SLA final status', {
      requestId,
      serviceType: request.serviceType,
      responseTime: Math.round(responseTime),
      resolutionTime: Math.round(resolutionTime),
      targetMinutes,
      metSLA,
    });

    return {
      responseTime: Math.round(responseTime),
      resolutionTime: Math.round(resolutionTime),
      metSLA,
    };
  } catch (error) {
    logger.error('Error in onRequestCompleted hook', { requestId, error });
    throw error;
  }
}

/**
 * Get SLA compliance trend over time
 */
export async function getSLAComplianceTrend(
  hotelId: string,
  days: number = 7
): Promise<{ date: string; complianceRate: number; totalRequests: number }[]> {
  try {
    const results: { date: string; complianceRate: number; totalRequests: number }[] = [];
    const now = new Date();

    for (let i = days - 1; i >= 0; i--) {
      const date = new Date(now);
      date.setDate(date.getDate() - i);
      date.setHours(0, 0, 0, 0);

      const nextDate = new Date(date);
      nextDate.setDate(nextDate.getDate() + 1);

      const stats = await getSLAStatistics(hotelId, date, nextDate);

      results.push({
        date: date.toISOString().split('T')[0],
        complianceRate: stats.complianceRate,
        totalRequests: stats.totalRequests,
      });
    }

    return results;
  } catch (error) {
    logger.error('Error getting SLA compliance trend', { hotelId, error });
    throw error;
  }
}

/**
 * Check and update SLA status for all active requests
 * Should be called periodically (e.g., every minute)
 */
export async function updateAllSLAStatuses(hotelId: string): Promise<{
  ok: number;
  warnings: number;
  breaches: number;
}> {
  try {
    const alerts = await getSLAAlerts(hotelId);

    // Log summary
    logger.info('SLA status update', {
      hotelId,
      ok: alerts.warnings.length + alerts.breaches.length === 0 ? 1 : 0,
      warnings: alerts.warnings.length,
      breaches: alerts.breaches.length,
    });

    return {
      ok: 0, // Would need to calculate from total - warnings - breaches
      warnings: alerts.warnings.length,
      breaches: alerts.breaches.length,
    };
  } catch (error) {
    logger.error('Error updating all SLA statuses', { hotelId, error });
    throw error;
  }
}

export default {
  SLA_TARGETS,
  SLA_WARNING_THRESHOLD,
  SLA_BREACH_THRESHOLD,
  getRequestSLAStatus,
  getSLAAlerts,
  getSLAStatistics,
  getSLAComplianceTrend,
  updateAllSLAStatuses,
  onRequestCreated,
  onRequestAssigned,
  onRequestCompleted,
};
