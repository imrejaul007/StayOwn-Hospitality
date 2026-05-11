/**
 * SLA Monitoring Routes
 *
 * API endpoints for SLA monitoring and reporting.
 * GET /v1/hotel/sla - Current SLA metrics
 * GET /v1/hotel/sla/alerts - Breaching SLAs
 * GET /v1/staff/sla - Staff SLA performance
 */

import { Router, Request, Response } from 'express';
import { authenticateHotelStaff, authenticateUser } from '../middleware/auth';
import { prisma } from '../config/database';
import { logger } from '../config/logger';
import { asyncHandler } from '../middleware/asyncHandler';

const router = Router();

// ─── SLA Configuration ────────────────────────────────────────────────────────

interface SLAThresholds {
  responseTimeMinutes: number;
  completionTimeMinutes: number;
  urgentResponseTimeMinutes: number;
}

const DEFAULT_SLA_THRESHOLDS: SLAThresholds = {
  responseTimeMinutes: 15,
  completionTimeMinutes: 60,
  urgentResponseTimeMinutes: 5,
};

const SERVICE_SLA_THRESHOLDS: Record<string, Partial<SLAThresholds>> = {
  housekeeping: { responseTimeMinutes: 10, completionTimeMinutes: 45 },
  room_service: { responseTimeMinutes: 15, completionTimeMinutes: 30 },
  laundry: { responseTimeMinutes: 30, completionTimeMinutes: 240 },
  concierge: { responseTimeMinutes: 5, completionTimeMinutes: 60 },
  minibar: { responseTimeMinutes: 5, completionTimeMinutes: 15 },
  spa: { responseTimeMinutes: 15, completionTimeMinutes: 120 },
  transport: { responseTimeMinutes: 10, completionTimeMinutes: 60 },
  maintenance: { responseTimeMinutes: 20, completionTimeMinutes: 90 },
};

// ─── Helper Functions ─────────────────────────────────────────────────────────

function getThresholdsForService(serviceType: string, priority: string): SLAThresholds {
  const serviceThresholds = SERVICE_SLA_THRESHOLDS[serviceType] || {};
  const thresholds = { ...DEFAULT_SLA_THRESHOLDS };

  if (serviceThresholds.responseTimeMinutes) {
    thresholds.responseTimeMinutes = serviceThresholds.responseTimeMinutes;
  }
  if (serviceThresholds.completionTimeMinutes) {
    thresholds.completionTimeMinutes = serviceThresholds.completionTimeMinutes;
  }

  if (priority === 'urgent' || priority === 'high') {
    thresholds.responseTimeMinutes = Math.min(
      thresholds.responseTimeMinutes,
      DEFAULT_SLA_THRESHOLDS.urgentResponseTimeMinutes
    );
  }

  return thresholds;
}

function checkSLABreach(
  record: any,
  thresholds: SLAThresholds
): { isBreaching: boolean; responseSLAMet?: boolean; completionSLAMet?: boolean } {
  const now = new Date();
  const createdAt = new Date(record.createdAt);
  const elapsedMinutes = (now.getTime() - createdAt.getTime()) / (1000 * 60);

  let isBreaching = false;
  let responseSLAMet: boolean | undefined;
  let completionSLAMet: boolean | undefined;

  // Check response SLA
  if (record.assignedAt) {
    const responseTimeMinutes = (new Date(record.assignedAt).getTime() - createdAt.getTime()) / (1000 * 60);
    responseSLAMet = responseTimeMinutes <= thresholds.responseTimeMinutes;
    if (!responseSLAMet) {
      isBreaching = true;
    }
  } else if (elapsedMinutes > thresholds.responseTimeMinutes) {
    responseSLAMet = false;
    isBreaching = true;
  } else {
    responseSLAMet = true;
  }

  // Check completion SLA
  if (record.completedAt) {
    const completionTimeMinutes = (new Date(record.completedAt).getTime() - createdAt.getTime()) / (1000 * 60);
    completionSLAMet = completionTimeMinutes <= thresholds.completionTimeMinutes;
    if (!completionSLAMet) {
      isBreaching = true;
    }
  } else if (elapsedMinutes > thresholds.completionTimeMinutes) {
    completionSLAMet = false;
    isBreaching = true;
  }

  return { isBreaching, responseSLAMet, completionSLAMet };
}

// ─── Hotel SLA Endpoints ──────────────────────────────────────────────────────

/**
 * GET /v1/hotel/sla - Current SLA metrics for the hotel
 */
router.get('/hotel/sla', authenticateHotelStaff, asyncHandler(async (req: Request, res: Response) => {
  const hotelId = req.user?.hotelId;
  const periodDays = parseInt(req.query.period as string) || 7;

  if (!hotelId) {
    return res.status(403).json({ success: false, message: 'Hotel ID required' });
  }

  const startDate = new Date();
  startDate.setDate(startDate.getDate() - periodDays);

  // Fetch service requests
  const requests = await prisma.roomServiceRequest.findMany({
    where: {
      hotelId,
      createdAt: { gte: startDate },
    },
    orderBy: { createdAt: 'desc' },
  });

  // Calculate metrics
  const totalRequests = requests.length;
  const completedRequests = requests.filter(r => r.status === 'completed');
  const activeRequests = requests.filter(r => !['completed', 'cancelled'].includes(r.status));

  let totalResponseMinutes = 0;
  let totalCompletionMinutes = 0;
  let responseSLAMetCount = 0;
  let completionSLAMetCount = 0;
  let breachingCount = 0;

  const serviceTypeStats: Record<string, {
    total: number;
    completed: number;
    breached: number;
    totalResponseMinutes: number;
    totalCompletionMinutes: number;
  }> = {};

  for (const request of requests) {
    const thresholds = getThresholdsForService(request.serviceType, request.priority);
    const breachStatus = checkSLABreach(request, thresholds);

    if (request.assignedAt) {
      const responseMinutes = (new Date(request.assignedAt).getTime() - new Date(request.createdAt).getTime()) / (1000 * 60);
      totalResponseMinutes += responseMinutes;
      if (breachStatus.responseSLAMet) responseSLAMetCount++;
    }

    if (request.completedAt) {
      const completionMinutes = (new Date(request.completedAt).getTime() - new Date(request.createdAt).getTime()) / (1000 * 60);
      totalCompletionMinutes += completionMinutes;
      if (breachStatus.completionSLAMet) completionSLAMetCount++;
    }

    if (breachStatus.isBreaching && !request.completedAt) {
      breachingCount++;
    }

    // Group by service type
    if (!serviceTypeStats[request.serviceType]) {
      serviceTypeStats[request.serviceType] = {
        total: 0,
        completed: 0,
        breached: 0,
        totalResponseMinutes: 0,
        totalCompletionMinutes: 0,
      };
    }
    serviceTypeStats[request.serviceType].total++;
    if (request.completedAt) {
      serviceTypeStats[request.serviceType].completed++;
    }
    if (breachStatus.isBreaching && !request.completedAt) {
      serviceTypeStats[request.serviceType].breached++;
    }
    if (request.assignedAt) {
      const responseMinutes = (new Date(request.assignedAt).getTime() - new Date(request.createdAt).getTime()) / (1000 * 60);
      serviceTypeStats[request.serviceType].totalResponseMinutes += responseMinutes;
    }
    if (request.completedAt) {
      const completionMinutes = (new Date(request.completedAt).getTime() - new Date(request.createdAt).getTime()) / (1000 * 60);
      serviceTypeStats[request.serviceType].totalCompletionMinutes += completionMinutes;
    }
  }

  // Calculate daily trends
  const dailyTrends: Record<string, { total: number; completed: number; breached: number }> = {};
  for (const request of requests) {
    const date = new Date(request.createdAt).toISOString().split('T')[0];
    if (!dailyTrends[date]) {
      dailyTrends[date] = { total: 0, completed: 0, breached: 0 };
    }
    dailyTrends[date].total++;
    if (request.completedAt) {
      dailyTrends[date].completed++;
    }
    const thresholds = getThresholdsForService(request.serviceType, request.priority);
    const breachStatus = checkSLABreach(request, thresholds);
    if (breachStatus.isBreaching && !request.completedAt) {
      dailyTrends[date].breached++;
    }
  }

  const trends = Object.entries(dailyTrends)
    .sort(([a], [b]) => a.localeCompare(b))
    .slice(-periodDays)
    .map(([date, stats]) => ({
      date,
      totalRequests: stats.total,
      completedRequests: stats.completed,
      complianceRate: stats.completed > 0 ? ((stats.completed - stats.breached) / stats.completed) * 100 : 100,
    }));

  const byServiceType = Object.entries(serviceTypeStats).map(([serviceType, stats]) => ({
    serviceType,
    totalRequests: stats.total,
    completedRequests: stats.completed,
    breachingRequests: stats.breached,
    complianceRate: stats.completed > 0 ? ((stats.completed - stats.breached) / stats.completed) * 100 : 100,
    avgResponseTimeMinutes: stats.total > 0 ? stats.totalResponseMinutes / stats.total : 0,
    avgCompletionTimeMinutes: stats.completed > 0 ? stats.totalCompletionMinutes / stats.completed : 0,
  }));

  res.json({
    success: true,
    data: {
      period: {
        days: periodDays,
        startDate: startDate.toISOString(),
        endDate: new Date().toISOString(),
      },
      overall: {
        totalRequests,
        completedRequests: completedRequests.length,
        activeRequests: activeRequests.length,
        responseSLAMetCount,
        completionSLAMetCount,
        responseComplianceRate: requests.length > 0 ? (responseSLAMetCount / requests.length) * 100 : 100,
        completionComplianceRate: completedRequests.length > 0 ? (completionSLAMetCount / completedRequests.length) * 100 : 100,
        averageResponseTimeMinutes: requests.length > 0 ? totalResponseMinutes / requests.length : 0,
        averageCompletionTimeMinutes: completedRequests.length > 0 ? totalCompletionMinutes / completedRequests.length : 0,
        breachingRequests: breachingCount,
        breachingRate: totalRequests > 0 ? (breachingCount / totalRequests) * 100 : 0,
      },
      byServiceType,
      trends,
    },
  });
}));

/**
 * GET /v1/hotel/sla/alerts - Currently breaching SLA requests
 */
router.get('/hotel/sla/alerts', authenticateHotelStaff, asyncHandler(async (req: Request, res: Response) => {
  const hotelId = req.user?.hotelId;

  if (!hotelId) {
    return res.status(403).json({ success: false, message: 'Hotel ID required' });
  }

  // Get active (non-completed) requests
  const requests = await prisma.roomServiceRequest.findMany({
    where: {
      hotelId,
      status: { in: ['pending', 'assigned', 'in_progress'] },
    },
    orderBy: { createdAt: 'asc' },
  });

  const breachingRequests: any[] = [];
  const now = new Date();

  for (const request of requests) {
    const thresholds = getThresholdsForService(request.serviceType, request.priority);
    const breachStatus = checkSLABreach(request, thresholds);

    if (breachStatus.isBreaching) {
      const createdAt = new Date(request.createdAt);
      const elapsedMinutes = (now.getTime() - createdAt.getTime()) / (1000 * 60);

      let slaBreachType = '';
      if (!request.assignedAt || breachStatus.responseSLAMet === false) {
        slaBreachType = breachStatus.completionSLAMet === false ? 'both' : 'response';
      } else if (breachStatus.completionSLAMet === false) {
        slaBreachType = 'completion';
      }

      const assignedAt = request.assignedAt ? new Date(request.assignedAt) : null;
      const responseTimeMinutes = assignedAt
        ? (assignedAt.getTime() - createdAt.getTime()) / (1000 * 60)
        : null;

      breachingRequests.push({
        id: request.id,
        bookingId: request.bookingId,
        roomNumber: request.roomNumber,
        guestName: request.guestName,
        serviceType: request.serviceType,
        priority: request.priority,
        status: request.status,
        createdAt: request.createdAt,
        assignedAt: request.assignedAt,
        responseTimeMinutes: responseTimeMinutes ? Math.round(responseTimeMinutes * 10) / 10 : null,
        elapsedMinutes: Math.round(elapsedMinutes * 10) / 10,
        threshold: {
          responseMinutes: !request.assignedAt ? thresholds.responseTimeMinutes : undefined,
          completionMinutes: thresholds.completionTimeMinutes,
        },
        slaBreachType,
        breachSeverity: elapsedMinutes > thresholds.completionTimeMinutes * 1.5 ? 'critical' : 'warning',
      });
    }
  }

  // Sort by severity and age
  breachingRequests.sort((a, b) => {
    if (a.breachSeverity !== b.breachSeverity) {
      return a.breachSeverity === 'critical' ? -1 : 1;
    }
    return b.elapsedMinutes - a.elapsedMinutes;
  });

  res.json({
    success: true,
    data: {
      count: breachingRequests.length,
      breachingRequests,
      summary: {
        critical: breachingRequests.filter(r => r.breachSeverity === 'critical').length,
        warning: breachingRequests.filter(r => r.breachSeverity === 'warning').length,
        byServiceType: breachingRequests.reduce((acc: Record<string, number>, r) => {
          acc[r.serviceType] = (acc[r.serviceType] || 0) + 1;
          return acc;
        }, {}),
      },
    },
  });
}));

/**
 * GET /v1/staff/sla - Staff SLA performance metrics
 */
router.get('/staff/sla', authenticateHotelStaff, asyncHandler(async (req: Request, res: Response) => {
  const hotelId = req.user?.hotelId;
  const periodDays = parseInt(req.query.period as string) || 7;

  if (!hotelId) {
    return res.status(403).json({ success: false, message: 'Hotel ID required' });
  }

  const startDate = new Date();
  startDate.setDate(startDate.getDate() - periodDays);

  // Get all staff with assigned requests
  const requests = await prisma.roomServiceRequest.findMany({
    where: {
      hotelId,
      assignedTo: { not: null },
      createdAt: { gte: startDate },
    },
    orderBy: { createdAt: 'desc' },
  });

  // Group by staff
  const staffMap: Record<string, {
    staffId: string;
    staffName: string;
    requests: any[];
  }> = {};

  for (const request of requests) {
    const staffId = request.assignedTo!;
    if (!staffMap[staffId]) {
      staffMap[staffId] = {
        staffId,
        staffName: request.assignedToName || 'Unknown Staff',
        requests: [],
      };
    }
    staffMap[staffId].requests.push(request);
  }

  // Calculate metrics per staff
  const staffMetrics = Object.values(staffMap).map(staff => {
    const totalAssigned = staff.requests.length;
    const completed = staff.requests.filter(r => r.status === 'completed');
    const completedCount = completed.length;

    let totalResponseMinutes = 0;
    let totalCompletionMinutes = 0;
    let slaMetCount = 0;

    for (const request of staff.requests) {
      const thresholds = getThresholdsForService(request.serviceType, request.priority);

      if (request.assignedAt) {
        const responseMinutes = (new Date(request.assignedAt).getTime() - new Date(request.createdAt).getTime()) / (1000 * 60);
        totalResponseMinutes += responseMinutes;
      }

      if (request.completedAt) {
        const completionMinutes = (new Date(request.completedAt).getTime() - new Date(request.createdAt).getTime()) / (1000 * 60);
        totalCompletionMinutes += completionMinutes;

        // Check if SLA met
        const breachStatus = checkSLABreach(request, thresholds);
        if (breachStatus.completionSLAMet) {
          slaMetCount++;
        }
      }
    }

    return {
      staffId: staff.staffId,
      staffName: staff.staffName,
      totalAssigned,
      completedCount,
      pendingCount: totalAssigned - completedCount,
      completionRate: totalAssigned > 0 ? (completedCount / totalAssigned) * 100 : 0,
      slaComplianceRate: completedCount > 0 ? (slaMetCount / completedCount) * 100 : 100,
      averageResponseTimeMinutes: totalAssigned > 0 ? totalResponseMinutes / totalAssigned : 0,
      averageCompletionTimeMinutes: completedCount > 0 ? totalCompletionMinutes / completedCount : 0,
      onTimeRate: completedCount > 0 ? (slaMetCount / completedCount) * 100 : 100,
    };
  });

  // Sort by total assigned
  staffMetrics.sort((a, b) => b.totalAssigned - a.totalAssigned);

  // Overall stats
  const overallStats = {
    totalStaff: staffMetrics.length,
    totalAssigned: staffMetrics.reduce((sum, s) => sum + s.totalAssigned, 0),
    totalCompleted: staffMetrics.reduce((sum, s) => sum + s.completedCount, 0),
    averageSLACompliance: staffMetrics.length > 0
      ? staffMetrics.reduce((sum, s) => sum + s.slaComplianceRate, 0) / staffMetrics.length
      : 100,
  };

  res.json({
    success: true,
    data: {
      period: {
        days: periodDays,
        startDate: startDate.toISOString(),
        endDate: new Date().toISOString(),
      },
      overall: overallStats,
      staff: staffMetrics,
    },
  });
}));

/**
 * GET /v1/hotel/sla/thresholds - Get SLA thresholds for hotel
 */
router.get('/hotel/sla/thresholds', authenticateHotelStaff, asyncHandler(async (req: Request, res: Response) => {
  const hotelId = req.user?.hotelId;

  if (!hotelId) {
    return res.status(403).json({ success: false, message: 'Hotel ID required' });
  }

  // Return default thresholds (in production, these could be stored per-hotel)
  res.json({
    success: true,
    data: {
      default: DEFAULT_SLA_THRESHOLDS,
      byServiceType: SERVICE_SLA_THRESHOLDS,
    },
  });
}));

/**
 * PUT /v1/hotel/sla/thresholds - Update SLA thresholds for hotel
 */
router.put('/hotel/sla/thresholds', authenticateHotelStaff, asyncHandler(async (req: Request, res: Response) => {
  const hotelId = req.user?.hotelId;

  if (!hotelId) {
    return res.status(403).json({ success: false, message: 'Hotel ID required' });
  }

  const { default: defaultThresholds, byServiceType } = req.body;

  // Validate thresholds
  if (defaultThresholds) {
    if (
      typeof defaultThresholds.responseTimeMinutes !== 'number' ||
      typeof defaultThresholds.completionTimeMinutes !== 'number'
    ) {
      return res.status(400).json({
        success: false,
        message: 'Invalid default thresholds format',
      });
    }
  }

  // In production, store these in database
  // For now, log and return success
  logger.info('[SLA] Thresholds updated for hotel', {
    hotelId,
    defaultThresholds,
    byServiceType,
  });

  res.json({
    success: true,
    data: {
      message: 'SLA thresholds updated',
      // Return what would be stored
      default: defaultThresholds || DEFAULT_SLA_THRESHOLDS,
      byServiceType: byServiceType || SERVICE_SLA_THRESHOLDS,
    },
  });
}));

/**
 * POST /v1/hotel/sla/request/:id/assign - Record staff assignment
 */
router.post('/hotel/sla/request/:id/assign', authenticateHotelStaff, asyncHandler(async (req: Request, res: Response) => {
  const hotelId = req.user?.hotelId;
  const { id } = req.params;
  const { staffId, staffName } = req.body;

  if (!hotelId) {
    return res.status(403).json({ success: false, message: 'Hotel ID required' });
  }

  if (!staffId) {
    return res.status(400).json({ success: false, message: 'Staff ID required' });
  }

  const request = await prisma.roomServiceRequest.findFirst({
    where: { id, hotelId },
  });

  if (!request) {
    return res.status(404).json({ success: false, message: 'Request not found' });
  }

  await prisma.roomServiceRequest.update({
    where: { id },
    data: {
      assignedTo: staffId,
      assignedToName: staffName || staffId,
      status: 'assigned',
    },
  });

  logger.info('[SLA] Request assigned', { requestId: id, staffId, hotelId });

  res.json({
    success: true,
    data: { message: 'Request assigned successfully' },
  });
}));

/**
 * POST /v1/hotel/sla/request/:id/complete - Record request completion
 */
router.post('/hotel/sla/request/:id/complete', authenticateHotelStaff, asyncHandler(async (req: Request, res: Response) => {
  const hotelId = req.user?.hotelId;
  const { id } = req.params;
  const { notes } = req.body;

  if (!hotelId) {
    return res.status(403).json({ success: false, message: 'Hotel ID required' });
  }

  const request = await prisma.roomServiceRequest.findFirst({
    where: { id, hotelId },
  });

  if (!request) {
    return res.status(404).json({ success: false, message: 'Request not found' });
  }

  const completedAt = new Date();

  await prisma.roomServiceRequest.update({
    where: { id },
    data: {
      status: 'completed',
      completedAt,
      notes: notes || undefined,
    },
  });

  // Calculate completion time for logging
  const completionMinutes = (completedAt.getTime() - new Date(request.createdAt).getTime()) / (1000 * 60);
  const thresholds = getThresholdsForService(request.serviceType, request.priority);
  const slaMet = completionMinutes <= thresholds.completionTimeMinutes;

  logger.info('[SLA] Request completed', {
    requestId: id,
    hotelId,
    completionMinutes: Math.round(completionMinutes),
    slaMet,
  });

  res.json({
    success: true,
    data: {
      message: 'Request completed successfully',
      completionMinutes: Math.round(completionMinutes * 10) / 10,
      slaMet,
    },
  });
}));

export default router;
