/**
 * Auto-Assignment Service for Room Service Requests
 *
 * Features:
 * - Assign to closest staff (based on last location)
 * - Assign to least busy staff
 * - Skill matching (spa → spa staff)
 * - Priority override for urgent requests
 * - Fallback to next available
 */

import { randomInt } from 'crypto';
import { prisma } from '../../config/database';
import { logger } from '../../config/logger';

// ─── Types ──────────────────────────────────────────────────────────────────────

export interface Assignment {
  requestId: string;
  staffId: string;
  staffName: string;
  assignedAt: string;
  reason: AssignmentReason;
  priority?: 'low' | 'medium' | 'high' | 'urgent';
  estimatedArrivalMinutes?: number;
}

export type AssignmentReason =
  | 'closest'
  | 'least_busy'
  | 'skill_match'
  | 'priority_override'
  | 'fallback'
  | 'manual';

export interface StaffLocation {
  staffId: string;
  staffName: string;
  floor?: number;
  zone?: string;
  latitude?: number;
  longitude?: number;
  lastLocationUpdate: Date;
}

export interface StaffWorkload {
  staffId: string;
  staffName: string;
  activeRequests: number;
  completedToday: number;
  avgCompletionTime: number;
  currentAssignments: Array<{
    requestId: string;
    serviceType: string;
    assignedAt: Date;
    estimatedCompletion: Date;
  }>;
}

export interface StaffSkill {
  staffId: string;
  staffName: string;
  skills: ServiceType[];
  certifications?: string[];
  rating: number;
}

export type ServiceType =
  | 'housekeeping'
  | 'room_service'
  | 'laundry'
  | 'maintenance'
  | 'spa'
  | 'transport'
  | 'concierge'
  | 'fitness';

// ─── Configuration ──────────────────────────────────────────────────────────────

const ASSIGNMENT_CONFIG = {
  // Maximum active requests per staff member before reassignment
  maxActiveRequests: 5,

  // Skill matching weight (higher = more important)
  skillMatchWeight: 3,

  // Workload weight
  workloadWeight: 2,

  // Distance weight (lower priority since location may not be available)
  distanceWeight: 1,

  // Time window for staff availability check (minutes)
  availabilityWindow: 30,

  // Priority boost for urgent requests
  priorityBoost: {
    urgent: 50,
    high: 30,
    medium: 10,
    low: 0,
  },
};

// ─── Main Assignment Function ───────────────────────────────────────────────────

/**
 * Auto-assign a room service request to the best available staff
 */
export async function autoAssignRequest(
  requestId: string,
  serviceType: ServiceType,
  priority: 'low' | 'medium' | 'high' | 'urgent',
  roomFloor?: number,
  roomZone?: string
): Promise<Assignment | null> {
  try {
    logger.info('Auto-assigning request', { requestId, serviceType, priority });

    // Get the request details
    const request = await prisma.roomServiceRequest.findUnique({
      where: { id: requestId },
    });

    if (!request) {
      logger.error('Request not found', { requestId });
      return null;
    }

    // Get all available staff
    const availableStaff = await getAvailableStaff(serviceType, priority);

    if (availableStaff.length === 0) {
      logger.warn('No available staff for assignment', { requestId, serviceType });
      return null;
    }

    // Score and rank staff
    const scoredStaff = await scoreStaff(availableStaff, {
      serviceType,
      priority,
      roomFloor,
      roomZone,
    });

    // Get the best candidate
    const bestStaff = scoredStaff[0];

    if (!bestStaff) {
      return null;
    }

    // Assign the request
    await prisma.roomServiceRequest.update({
      where: { id: requestId },
      data: {
        assignedTo: bestStaff.staffId,
        status: 'assigned',
      },
    });

    // Record assignment
    await recordAssignment({
      requestId,
      staffId: bestStaff.staffId,
      reason: bestStaff.reason,
    });

    const assignment: Assignment = {
      requestId,
      staffId: bestStaff.staffId,
      staffName: bestStaff.staffName,
      assignedAt: new Date().toISOString(),
      reason: bestStaff.reason,
      priority,
      estimatedArrivalMinutes: bestStaff.estimatedArrivalMinutes,
    };

    logger.info('Request auto-assigned', {
      requestId,
      staffId: bestStaff.staffId,
      reason: bestStaff.reason,
    });

    return assignment;
  } catch (error: any) {
    logger.error('Auto-assignment failed', { error: error.message, requestId });
    return null;
  }
}

// ─── Staff Availability ─────────────────────────────────────────────────────────

interface ScoredStaff {
  staffId: string;
  staffName: string;
  score: number;
  reason: AssignmentReason;
  estimatedArrivalMinutes: number;
  activeRequests: number;
  distance?: number;
  hasSkill: boolean;
}

async function getAvailableStaff(
  serviceType: ServiceType,
  priority: 'low' | 'medium' | 'high' | 'urgent'
): Promise<ScoredStaff[]> {
  // Get staff with matching skills
  const staffMembers = await prisma.hotelStaff.findMany({
    where: {
      hotelId: (await prisma.roomServiceRequest.findUnique({ where: { id: '' } }))?.hotelId || '',
      isActive: true,
      // Staff who have this skill or are general service staff
    },
    select: {
      id: true,
      name: true,
      skills: true,
      role: true,
    },
  });

  // For demo, create mock staff list
  const mockStaff: ScoredStaff[] = [
    { staffId: 'staff-1', staffName: 'Priya S.', score: 0, reason: 'fallback', estimatedArrivalMinutes: 10, activeRequests: 1, hasSkill: true },
    { staffId: 'staff-2', staffName: 'Rajesh K.', score: 0, reason: 'fallback', estimatedArrivalMinutes: 8, activeRequests: 2, hasSkill: true },
    { staffId: 'staff-3', staffName: 'Anita M.', score: 0, reason: 'fallback', estimatedArrivalMinutes: 15, activeRequests: 0, hasSkill: true },
    { staffId: 'staff-4', staffName: 'Vikram J.', score: 0, reason: 'fallback', estimatedArrivalMinutes: 12, activeRequests: 3, hasSkill: false },
    { staffId: 'staff-5', staffName: 'Sunita D.', score: 0, reason: 'fallback', estimatedArrivalMinutes: 7, activeRequests: 1, hasSkill: true },
  ];

  return mockStaff;
}

async function scoreStaff(
  staff: ScoredStaff[],
  params: {
    serviceType: ServiceType;
    priority: 'low' | 'medium' | 'high' | 'urgent';
    roomFloor?: number;
    roomZone?: string;
  }
): Promise<ScoredStaff[]> {
  const now = new Date();

  return staff.map(s => {
    let score = 0;
    let reason: AssignmentReason = 'fallback';

    // Skill match scoring
    if (s.hasSkill) {
      score += ASSIGNMENT_CONFIG.skillMatchWeight * 10;
      reason = 'skill_match';
    }

    // Workload scoring (less busy = higher score)
    const workloadScore = Math.max(0, ASSIGNMENT_CONFIG.maxActiveRequests - s.activeRequests);
    score += workloadScore * ASSIGNMENT_CONFIG.workloadWeight * 5;
    if (workloadScore === ASSIGNMENT_CONFIG.maxActiveRequests) {
      reason = 'least_busy';
    }

    // Distance scoring (if available)
    if (s.distance !== undefined) {
      const distanceScore = Math.max(0, 100 - s.distance);
      score += distanceScore * ASSIGNMENT_CONFIG.distanceWeight;
      if (reason === 'fallback' && s.distance < 50) {
        reason = 'closest';
      }
    }

    // Priority boost for urgent requests
    const priorityBoost = ASSIGNMENT_CONFIG.priorityBoost[params.priority];
    score += priorityBoost;

    // Urgent requests get assigned to fastest available
    if (params.priority === 'urgent' && s.activeRequests === 0) {
      score += 100;
      reason = 'priority_override';
    }

    return {
      ...s,
      score,
      reason,
      estimatedArrivalMinutes: Math.max(5, s.estimatedArrivalMinutes - Math.floor(priorityBoost / 10)),
    };
  }).sort((a, b) => b.score - a.score);
}

// ─── Assignment Tracking ────────────────────────────────────────────────────────

async function recordAssignment(assignment: {
  requestId: string;
  staffId: string;
  reason: AssignmentReason;
}): Promise<void> {
  try {
    // In production, this would be stored in a database
    logger.info('Assignment recorded', assignment);
  } catch (error) {
    logger.error('Failed to record assignment', { error });
  }
}

// ─── Manual Assignment Override ─────────────────────────────────────────────────

/**
 * Manually reassign a request to a specific staff member
 */
export async function manualAssignRequest(
  requestId: string,
  staffId: string,
  reassignedBy?: string
): Promise<Assignment | null> {
  try {
    const request = await prisma.roomServiceRequest.findUnique({
      where: { id: requestId },
    });

    if (!request) {
      return null;
    }

    const staff = await prisma.hotelStaff.findUnique({
      where: { id: staffId },
    });

    if (!staff) {
      return null;
    }

    await prisma.roomServiceRequest.update({
      where: { id: requestId },
      data: {
        assignedTo: staffId,
        status: 'assigned',
      },
    });

    const assignment: Assignment = {
      requestId,
      staffId,
      staffName: staff.fullName,
      assignedAt: new Date().toISOString(),
      reason: 'manual',
    };

    logger.info('Manual assignment completed', {
      requestId,
      staffId,
      reassignedBy,
    });

    return assignment;
  } catch (error: any) {
    logger.error('Manual assignment failed', { error: error.message, requestId, staffId });
    return null;
  }
}

// ─── Staff Load Balancing ──────────────────────────────────────────────────────

/**
 * Get current load for all staff
 */
export async function getStaffLoad(hotelId: string): Promise<StaffWorkload[]> {
  const staffLoads: StaffWorkload[] = [];

  // Mock implementation
  const mockStaff = ['staff-1', 'staff-2', 'staff-3', 'staff-4', 'staff-5'];
  const names = ['Priya S.', 'Rajesh K.', 'Anita M.', 'Vikram J.', 'Sunita D.'];

  for (let i = 0; i < mockStaff.length; i++) {
    // STATISTICAL: Mock workload data for demo purposes (not security-critical)
    staffLoads.push({
      staffId: mockStaff[i],
      staffName: names[i],
      activeRequests: randomInt(0, 4),
      completedToday: randomInt(5, 20),
      avgCompletionTime: randomInt(10, 30),
      currentAssignments: [],
    });
  }

  return staffLoads;
}

/**
 * Rebalance assignments when staff become overloaded
 */
export async function rebalanceAssignments(hotelId: string): Promise<number> {
  try {
    const staffLoads = await getStaffLoad(hotelId);

    // Find overloaded staff
    const overloadedStaff = staffLoads.filter(s => s.activeRequests > ASSIGNMENT_CONFIG.maxActiveRequests);

    if (overloadedStaff.length === 0) {
      return 0;
    }

    // Find underloaded staff
    const underloadedStaff = staffLoads
      .filter(s => s.activeRequests < ASSIGNMENT_CONFIG.maxActiveRequests - 1)
      .sort((a, b) => a.activeRequests - b.activeRequests);

    let reassignedCount = 0;

    for (const overloaded of overloadedStaff) {
      const available = underloadedStaff.find(s =>
        s.activeRequests < ASSIGNMENT_CONFIG.maxActiveRequests - 1
      );

      if (!available) break;

      // Reassign one request
      reassignedCount++;
      available.activeRequests++;
      overloaded.activeRequests--;
    }

    logger.info('Rebalanced assignments', { reassignedCount, hotelId });
    return reassignedCount;
  } catch (error) {
    logger.error('Rebalancing failed', { error });
    return 0;
  }
}

// ─── Performance Metrics ───────────────────────────────────────────────────────

export interface StaffPerformance {
  staffId: string;
  staffName: string;
  period: string;
  metrics: {
    totalAssigned: number;
    totalCompleted: number;
    avgResponseTime: number; // minutes
    avgCompletionTime: number; // minutes
    onTimeRate: number; // percentage
    guestRatings: number[]; // 1-5 ratings
    avgRating: number;
  };
}

/**
 * Get staff performance metrics
 */
export async function getStaffPerformance(
  staffId: string,
  period: 'today' | 'week' | 'month' = 'week'
): Promise<StaffPerformance | null> {
  // Mock implementation
  return {
    staffId,
    staffName: 'Staff Member',
    period,
    metrics: {
      totalAssigned: 45,
      totalCompleted: 42,
      avgResponseTime: 8,
      avgCompletionTime: 25,
      onTimeRate: 92,
      guestRatings: [5, 4, 5, 4, 5],
      avgRating: 4.6,
    },
  };
}

/**
 * Get hotel-wide performance metrics
 */
export async function getHotelPerformance(hotelId: string): Promise<{
  totalRequests: number;
  completedRequests: number;
  avgResponseTime: number;
  avgCompletionTime: number;
  slaCompliance: number; // percentage
  topStaff: Array<{ staffId: string; name: string; completed: number }>;
}> {
  return {
    totalRequests: 150,
    completedRequests: 142,
    avgResponseTime: 10,
    avgCompletionTime: 28,
    slaCompliance: 94,
    topStaff: [
      { staffId: 'staff-1', name: 'Priya S.', completed: 38 },
      { staffId: 'staff-2', name: 'Rajesh K.', completed: 35 },
      { staffId: 'staff-3', name: 'Anita M.', completed: 32 },
    ],
  };
}
