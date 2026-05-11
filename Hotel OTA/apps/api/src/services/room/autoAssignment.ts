/**
 * Auto-Assignment Service for Hotel Staff Dashboard
 * Automatically assigns room service requests to the best available staff member
 */

import { prisma } from '../../config/database';
import { logger } from '../../config/logger';

// Types
export interface RoomServiceRequest {
  id: string;
  roomId: string;
  roomNumber: string;
  serviceType: string;
  priority: 'low' | 'medium' | 'high' | 'urgent';
  bookingId: string;
  hotelId: string;
}

export interface StaffMember {
  id: string;
  name: string;
  department: string;
  skills: string[];
  currentLoad: number;
  location?: {
    floor: number;
    zone: string;
  };
  isAvailable: boolean;
}

export interface AssignmentResult {
  staffId: string;
  staffName: string;
  reason: 'closest' | 'least_busy' | 'skill_match' | 'combined';
  estimatedWait: number;
  score: number;
}

// Service type to department mapping
const SERVICE_TO_DEPARTMENT: Record<string, string[]> = {
  housekeeping: ['housekeeping'],
  room_service: ['room_service', 'food_beverage'],
  spa: ['spa', 'wellness'],
  laundry: ['laundry'],
  maintenance: ['maintenance', 'engineering'],
  concierge: ['concierge'],
  transport: ['concierge', 'transport'],
  minibar: ['room_service'],
};

// Priority weights for scoring
const PRIORITY_WEIGHTS: Record<string, number> = {
  urgent: 4,
  high: 3,
  medium: 2,
  low: 1,
};

// SLA targets in minutes (for wait time estimation)
const SLA_TARGETS: Record<string, number> = {
  housekeeping: 30,
  room_service: 20,
  spa: 60,
  laundry: 120,
  maintenance: 45,
  concierge: 15,
  transport: 30,
  minibar: 15,
};

/**
 * Main auto-assignment function
 * Finds the best staff member for a given request
 */
export async function autoAssign(request: RoomServiceRequest): Promise<AssignmentResult> {
  try {
    const hotelId = request.hotelId;
    const serviceType = request.serviceType;
    const targetDepartments = SERVICE_TO_DEPARTMENT[serviceType] || [serviceType];

    // 1. Get available staff for the service type
    const availableStaff = await getAvailableStaff(hotelId, targetDepartments);

    if (availableStaff.length === 0) {
      // No available staff - return null or queue request
      logger.warn('No available staff for assignment', { requestId: request.id, serviceType });
      throw new Error('No available staff members for this service type');
    }

    // 2. Calculate scores for each staff member
    const staffScores = await Promise.all(
      availableStaff.map(async (staff) => {
        const score = await calculateStaffScore(staff, request);
        return { staff, score };
      })
    );

    // 3. Sort by score (highest first)
    staffScores.sort((a, b) => b.score.total - a.score.total);

    // 4. Select best match
    const bestMatch = staffScores[0];

    if (!bestMatch) {
      throw new Error('Failed to find suitable staff member');
    }

    // 5. Estimate wait time
    const estimatedWait = estimateWaitTime(bestMatch.staff, request);

    // 6. Log assignment
    logger.info('Auto-assignment completed', {
      requestId: request.id,
      staffId: bestMatch.staff.id,
      staffName: bestMatch.staff.name,
      reason: bestMatch.score.reason,
      score: bestMatch.score.total,
    });

    return {
      staffId: bestMatch.staff.id,
      staffName: bestMatch.staff.name,
      reason: bestMatch.score.reason,
      estimatedWait,
      score: bestMatch.score.total,
    };
  } catch (error) {
    logger.error('Auto-assignment failed', { requestId: request.id, error });
    throw error;
  }
}

/**
 * Get available staff members for specific departments
 */
async function getAvailableStaff(hotelId: string, departments: string[]): Promise<StaffMember[]> {
  // In a real implementation, this would query the database for staff
  // with matching departments and check their current availability status

  // Mock data for demonstration
  const mockStaff: StaffMember[] = [
    {
      id: 'staff-1',
      name: 'John Housekeeping',
      department: 'housekeeping',
      skills: ['cleaning', 'linen', 'turndown'],
      currentLoad: 2,
      location: { floor: 1, zone: 'north' },
      isAvailable: true,
    },
    {
      id: 'staff-2',
      name: 'Sarah Housekeeping',
      department: 'housekeeping',
      skills: ['cleaning', 'special_requests'],
      currentLoad: 1,
      location: { floor: 2, zone: 'south' },
      isAvailable: true,
    },
    {
      id: 'staff-3',
      name: 'Mike Room Service',
      department: 'room_service',
      skills: ['food', 'beverage', 'minibar'],
      currentLoad: 3,
      location: { floor: 1, zone: 'center' },
      isAvailable: true,
    },
    {
      id: 'staff-4',
      name: 'Lisa Room Service',
      department: 'room_service',
      skills: ['food', 'beverage'],
      currentLoad: 1,
      location: { floor: 2, zone: 'center' },
      isAvailable: true,
    },
    {
      id: 'staff-5',
      name: 'Tom Maintenance',
      department: 'maintenance',
      skills: ['electrical', 'plumbing', 'hvac'],
      currentLoad: 0,
      location: { floor: 1, zone: 'utility' },
      isAvailable: true,
    },
  ];

  // Filter by department
  return mockStaff.filter(
    (staff) => departments.includes(staff.department) && staff.isAvailable
  );
}

/**
 * Calculate assignment score for a staff member
 */
async function calculateStaffScore(
  staff: StaffMember,
  request: RoomServiceRequest
): Promise<{
  total: number;
  loadScore: number;
  locationScore: number;
  skillScore: number;
  reason: 'closest' | 'least_busy' | 'skill_match' | 'combined';
}> {
  const loadScore = calculateLoadScore(staff);
  const locationScore = await calculateLocationScore(staff, request);
  const skillScore = calculateSkillScore(staff, request);

  // Weighted total score
  const total = loadScore * 0.4 + locationScore * 0.3 + skillScore * 0.3;

  // Determine primary reason
  let reason: 'closest' | 'least_busy' | 'skill_match' | 'combined' = 'combined';
  const maxScore = Math.max(loadScore, locationScore, skillScore);
  if (maxScore === loadScore) reason = 'least_busy';
  else if (maxScore === locationScore) reason = 'closest';
  else if (maxScore === skillScore) reason = 'skill_match';

  return {
    total,
    loadScore,
    locationScore,
    skillScore,
    reason,
  };
}

/**
 * Calculate load-based score (lower load = higher score)
 * Score range: 0-100
 */
function calculateLoadScore(staff: StaffMember): number {
  // Fewer tasks = higher score
  // Max comfortable load is around 5 tasks
  const maxLoad = 5;
  const normalizedLoad = Math.min(staff.currentLoad / maxLoad, 1);
  return (1 - normalizedLoad) * 100;
}

/**
 * Calculate location-based score (closer location = higher score)
 * Score range: 0-100
 */
async function calculateLocationScore(
  staff: StaffMember,
  request: RoomServiceRequest
): Promise<number> {
  if (!staff.location) {
    return 50; // Default middle score if no location data
  }

  // Extract floor from room number (assuming room 101 = floor 1)
  const requestFloor = Math.floor(parseInt(request.roomNumber) / 100);

  // Calculate floor distance
  const floorDistance = Math.abs(staff.location.floor - requestFloor);

  // Score decreases with distance
  // Same floor = 100, 1 floor away = 75, 2 floors away = 50, etc.
  const score = Math.max(100 - floorDistance * 25, 0);

  return score;
}

/**
 * Calculate skill match score
 * Score range: 0-100
 */
function calculateSkillScore(staff: StaffMember, request: RoomServiceRequest): number {
  // Check if staff has relevant skills for this service type
  const hasExactMatch = staff.skills.some(
    (skill) => skill.toLowerCase() === request.serviceType.toLowerCase()
  );

  if (hasExactMatch) return 100;

  // Check partial match
  const hasPartialMatch = staff.skills.some((skill) =>
    request.serviceType.toLowerCase().includes(skill.toLowerCase()) ||
    skill.toLowerCase().includes(request.serviceType.toLowerCase())
  );

  if (hasPartialMatch) return 75;

  // Same department = moderate score
  return 50;
}

/**
 * Estimate wait time based on staff location and current load
 */
function estimateWaitTime(staff: StaffMember, request: RoomServiceRequest): number {
  const baseTime = SLA_TARGETS[request.serviceType] || 30;

  // Add time based on current load (5 minutes per task)
  const loadTime = staff.currentLoad * 5;

  // Add time based on floor distance
  const floorDistance = staff.location
    ? Math.abs(staff.location.floor - Math.floor(parseInt(request.roomNumber) / 100))
    : 0;
  const travelTime = floorDistance * 2; // 2 minutes per floor

  // Priority adjustment
  const priorityMultiplier = 1 - (PRIORITY_WEIGHTS[request.priority] - 1) * 0.1;

  return Math.round((baseTime + loadTime + travelTime) * priorityMultiplier);
}

/**
 * Re-balance assignments when a staff member becomes unavailable
 */
export async function rebalanceAssignments(staffId: string, hotelId: string): Promise<AssignmentResult[]> {
  try {
    // Get all pending/assigned requests for this staff member
    const pendingRequests = await prisma.roomServiceRequest.findMany({
      where: {
        hotelId,
        assignedTo: staffId,
        status: { in: ['pending', 'assigned'] },
      },
    });

    // Re-assign each request
    const reassignments: AssignmentResult[] = [];

    for (const request of pendingRequests) {
      try {
        const result = await autoAssign({
          id: request.id,
          roomId: request.roomId || '',
          roomNumber: request.roomNumber,
          serviceType: request.serviceType,
          priority: request.priority as 'low' | 'medium' | 'high' | 'urgent',
          bookingId: request.bookingId || '',
          hotelId,
        });

        // Update the request with new assignment
        await prisma.roomServiceRequest.update({
          where: { id: request.id },
          data: {
            assignedTo: result.staffId,
            assignedToName: result.staffName,
            status: 'assigned',
          },
        });

        reassignments.push(result);
      } catch (error) {
        logger.error('Failed to re-assign request during rebalancing', {
          requestId: request.id,
          originalStaffId: staffId,
        });
      }
    }

    logger.info('Assignment rebalancing completed', {
      staffId,
      reassignedCount: reassignments.length,
    });

    return reassignments;
  } catch (error) {
    logger.error('Rebalancing failed', { staffId, error });
    throw error;
  }
}

/**
 * Get current load for a staff member
 */
export async function getStaffLoad(staffId: string): Promise<{
  activeRequests: number;
  avgCompletionTime: number;
  pendingRequests: RoomServiceRequest[];
}> {
  // Get active (in-progress) requests
  const activeRequests = await prisma.roomServiceRequest.count({
    where: {
      assignedTo: staffId,
      status: 'in_progress',
    },
  });

  // Get pending requests
  const pendingRequests = await prisma.roomServiceRequest.findMany({
    where: {
      assignedTo: staffId,
      status: { in: ['pending', 'assigned'] },
    },
    orderBy: { createdAt: 'asc' },
  });

  // Calculate average completion time from recent completed requests
  const recentCompleted = await prisma.roomServiceRequest.findMany({
    where: {
      assignedTo: staffId,
      status: 'completed',
      completedAt: {
        gte: new Date(Date.now() - 7 * 24 * 60 * 60 * 1000), // Last 7 days
      },
    },
    select: {
      createdAt: true,
      completedAt: true,
    },
  });

  const avgCompletionTime =
    recentCompleted.length > 0
      ? recentCompleted.reduce((sum, req) => {
          const duration = (req.completedAt?.getTime() || 0) - req.createdAt.getTime();
          return sum + duration / 60000; // Convert to minutes
        }, 0) / recentCompleted.length
      : 0;

  return {
    activeRequests,
    avgCompletionTime: Math.round(avgCompletionTime),
    pendingRequests: pendingRequests.map((r) => ({
      id: r.id,
      roomId: r.roomId || '',
      roomNumber: r.roomNumber,
      serviceType: r.serviceType,
      priority: r.priority as 'low' | 'medium' | 'high' | 'urgent',
      bookingId: r.bookingId || '',
      hotelId: r.hotelId,
    })),
  };
}

/**
 * Get optimal staff distribution across floors/zones
 */
export async function getStaffDistribution(hotelId: string): Promise<{
  floor: number;
  zone: string;
  staffCount: number;
  activeRequests: number;
}[]> {
  // This would query staff locations and active assignments
  // For now, return mock data
  return [
    { floor: 1, zone: 'north', staffCount: 2, activeRequests: 3 },
    { floor: 1, zone: 'south', staffCount: 1, activeRequests: 2 },
    { floor: 2, zone: 'center', staffCount: 2, activeRequests: 4 },
    { floor: 3, zone: 'north', staffCount: 1, activeRequests: 1 },
  ];
}

export default {
  autoAssign,
  rebalanceAssignments,
  getStaffLoad,
  getStaffDistribution,
};
