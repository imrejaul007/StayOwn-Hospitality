import { availabilityService, type AvailabilityCheck } from './availabilityService';
import { roomTypeService, type RoomType } from './roomTypeService';
import { inventoryService, type InventoryRecord } from './inventoryService';
import { enhancedBookingService, type CreateEnhancedBookingRequest, type EnhancedBooking } from './enhancedBookingService';

/**
 * OTA Integration Service - Unified interface for OTA-ready booking operations
 * 
 * This service coordinates between all the different OTA-ready services to provide
 * a unified interface for complex booking operations that involve multiple systems.
 */

export interface BookingFlowParams {
  hotelId: string;
  checkIn: string;
  checkOut: string;
  guestDetails: {
    adults: number;
    children?: number;
    specialRequests?: string;
  };
  
  // Room selection (supports both approaches)
  roomTypeId?: string;  // Preferred: New OTA-ready approach
  roomType?: string;    // Legacy: For backward compatibility
  roomsNeeded?: number;
  
  // Booking preferences
  ratePlan?: string;
  promoCode?: string;
  channel?: string;
  source?: 'direct' | 'booking_com' | 'expedia' | 'airbnb';
}

export interface BookingFlowResult {
  success: boolean;
  step: 'availability_check' | 'room_selection' | 'booking_creation' | 'inventory_update' | 'completed';
  data?: {
    availableRoomTypes?: Array<{
      roomType: RoomType;
      available: boolean;
      availableRooms: number;
      basePrice: number;
      inventory: InventoryRecord[];
    }>;
    selectedRoomType?: RoomType;
    booking?: EnhancedBooking;
    reservedInventory?: unknown[];
  };
  error?: string;
  nextSteps?: string[];
}

export interface HotelDashboardData {
  hotelId: string;
  period: string;
  overview: {
    totalRoomTypes: number;
    totalRooms: number;
    totalBookings: number;
    totalRevenue: number;
    averageOccupancy: number;
    averageRate: number;
  };
  roomTypePerformance: Array<{
    roomType: RoomType;
    bookings: number;
    revenue: number;
    occupancyRate: number;
    averageRate: number;
  }>;
  channelPerformance: Array<{
    channel: string;
    bookings: number;
    revenue: number;
    percentage: number;
  }>;
  inventoryStatus: Array<{
    roomType: RoomType;
    totalRooms: number;
    availableRooms: number;
    blockedRooms: number;
    soldRooms: number;
    occupancyRate: number;
  }>;
  upcomingArrivals: EnhancedBooking[];
  recentActivity: unknown[];
}

class OTAIntegrationService {
  /**
   * Complete booking flow with availability check, room selection, and booking creation
   */
  async executeBookingFlow(params: BookingFlowParams): Promise<BookingFlowResult> {
    try {
      // Step 1: Check availability
      const availabilityResult: BookingFlowResult = {
        success: false,
        step: 'availability_check'
      };

      let roomTypeId = params.roomTypeId;
      let selectedRoomType: RoomType | undefined;

      // Resolve room type if needed
      if (!roomTypeId && params.roomType) {
        try {
          selectedRoomType = await roomTypeService.getRoomTypeByLegacy(params.hotelId, params.roomType);
          roomTypeId = selectedRoomType._id;
        } catch (error) {
          return {
            success: false,
            step: 'availability_check',
            error: `Could not resolve room type: ${params.roomType}`
          };
        }
      } else if (roomTypeId) {
        selectedRoomType = await roomTypeService.getRoomType(roomTypeId);
      }

      // If no specific room type, get all available room types
      if (!roomTypeId) {
        const availableRoomTypes = await enhancedBookingService.getAvailableRoomTypes({
          hotelId: params.hotelId,
          checkIn: params.checkIn,
          checkOut: params.checkOut
        });

        if (availableRoomTypes.length === 0) {
          return {
            success: false,
            step: 'availability_check',
            error: 'No rooms available for selected dates',
            data: { availableRoomTypes: [] }
          };
        }

        return {
          success: true,
          step: 'room_selection',
          data: {
            availableRoomTypes: availableRoomTypes.map(art => ({
              roomType: art.roomType,
              available: true,
              availableRooms: art.availability.availableRooms,
              basePrice: art.roomType.basePrice,
              inventory: []
            }))
          },
          nextSteps: ['Select a room type to continue with booking']
        };
      }

      // Check availability for specific room type
      const availability = await availabilityService.checkAvailabilityV2({
        hotelId: params.hotelId,
        roomTypeId: roomTypeId,
        checkIn: params.checkIn,
        checkOut: params.checkOut,
        roomsRequested: params.roomsNeeded || 1
      });

      if (!availability.available) {
        return {
          success: false,
          step: 'availability_check',
          error: 'Selected room type not available for chosen dates',
          data: {
            selectedRoomType,
            availableRoomTypes: []
          }
        };
      }

      // Step 2: Create booking
      const bookingData: CreateEnhancedBookingRequest = {
        hotelId: params.hotelId,
        checkIn: params.checkIn,
        checkOut: params.checkOut,
        guestDetails: params.guestDetails,
        roomTypeId: roomTypeId,
        roomRequests: params.roomsNeeded || 1,
        channel: params.channel,
        source: params.source || 'direct'
      };

      const bookingResult = await enhancedBookingService.createBooking(bookingData);

      return {
        success: true,
        step: 'completed',
        data: {
          selectedRoomType,
          booking: bookingResult.data.booking,
          reservedInventory: bookingResult.data.reservedRooms
        },
        nextSteps: ['Booking created successfully', 'Send confirmation to guest', 'Update PMS if needed']
      };

    } catch (error: unknown) {
      return {
        success: false,
        step: 'availability_check',
        error: error instanceof Error ? error.message : 'Unknown error occurred during booking flow'
      };
    }
  }

  /**
   * Get comprehensive hotel dashboard data
   */
  async getHotelDashboard(params: {
    hotelId: string;
    period?: string;
    startDate?: string;
    endDate?: string;
  }): Promise<HotelDashboardData> {
    try {
      const period = params.period || '30d';
      const endDate = params.endDate || new Date().toISOString().split('T')[0];
      const startDate = params.startDate || this.calculateStartDate(endDate, period);

      // Get basic hotel data
      const [roomTypes, bookingDashboard, inventorySummary] = await Promise.all([
        roomTypeService.getRoomTypesWithStats(params.hotelId),
        enhancedBookingService.getBookingDashboard({ hotelId: params.hotelId, period }),
        inventoryService.getInventorySummary({
          hotelId: params.hotelId,
          startDate,
          endDate
        })
      ]);

      // Calculate room type performance
      const roomTypePerformance = await Promise.all(
        roomTypes.map(async (roomType) => {
          const analytics = await enhancedBookingService.getBookingAnalytics({
            hotelId: params.hotelId,
            startDate,
            endDate,
            groupBy: 'roomType'
          });

          const rtData = analytics.data.analytics.find(a => 
            a._id.roomTypeName === roomType.name
          ) || { totalBookings: 0, totalRevenue: 0, averageRate: 0 };

          return {
            roomType,
            bookings: rtData.totalBookings,
            revenue: rtData.totalRevenue,
            occupancyRate: 0, // Calculate based on inventory
            averageRate: rtData.averageRate
          };
        })
      );

      // Get current inventory status
      const inventoryStatus = await Promise.all(
        roomTypes.map(async (roomType) => {
          const today = new Date().toISOString().split('T')[0];
          const inventory = await inventoryService.getInventoryStatus({
            hotelId: params.hotelId,
            roomTypeId: roomType._id,
            date: today
          });

          return {
            roomType,
            totalRooms: inventory?.totalRooms || 0,
            availableRooms: inventory?.availableRooms || 0,
            blockedRooms: inventory?.blockedRooms || 0,
            soldRooms: inventory?.soldRooms || 0,
            occupancyRate: inventory && inventory.totalRooms > 0
              ? ((inventory.soldRooms + inventory.blockedRooms) / inventory.totalRooms * 100) : 0
          };
        })
      );

      return {
        hotelId: params.hotelId,
        period,
        overview: {
          totalRoomTypes: roomTypes.length,
          totalRooms: inventoryStatus.reduce((sum, rt) => sum + rt.totalRooms, 0),
          totalBookings: bookingDashboard.data.totalBookings,
          totalRevenue: bookingDashboard.data.totalRevenue,
          averageOccupancy: bookingDashboard.data.occupancyRate,
          averageRate: bookingDashboard.data.averageRate
        },
        roomTypePerformance,
        channelPerformance: Object.entries(bookingDashboard.data.channelBreakdown).map(([channel, data]) => ({
          channel,
          bookings: data.bookings,
          revenue: data.revenue,
          percentage: data.percentage
        })),
        inventoryStatus,
        upcomingArrivals: bookingDashboard.data.recentBookings.filter(b => 
          new Date(b.checkIn) >= new Date() && b.status === 'confirmed'
        ),
        recentActivity: [] // TODO: Add audit log integration
      };

    } catch (error: unknown) {
      const axiosErr = error as { response?: { data?: { message?: string }; status?: number }; config?: unknown };
      throw new Error(axiosErr.response?.data?.message || 'Failed to fetch hotel dashboard');
    }
  }

  /**
   * Batch operations for inventory management
   */
  async batchInventoryOperations(operations: Array<{
    type: 'update_rates' | 'set_availability' | 'stop_sell' | 'update_restrictions';
    hotelId: string;
    roomTypeId: string;
    startDate: string;
    endDate: string;
    data: unknown;
  }>): Promise<{
    successful: number;
    failed: number;
    results: Array<{
      operation: unknown;
      success: boolean;
      error?: string;
    }>;
  }> {
    const results = [];
    let successful = 0;
    let failed = 0;

    for (const operation of operations) {
      try {
        let result;
        
        switch (operation.type) {
          case 'update_rates':
            result = await inventoryService.updateRatesForDateRange({
              hotelId: operation.hotelId,
              roomTypeId: operation.roomTypeId,
              startDate: operation.startDate,
              endDate: operation.endDate,
              ...operation.data
            });
            break;
            
          case 'stop_sell':
            result = await inventoryService.setStopSell({
              hotelId: operation.hotelId,
              roomTypeId: operation.roomTypeId,
              startDate: operation.startDate,
              endDate: operation.endDate,
              ...operation.data
            });
            break;
            
          default:
            throw new Error(`Unsupported operation type: ${operation.type}`);
        }

        results.push({
          operation,
          success: true
        });
        successful++;

      } catch (error: unknown) {
        results.push({
          operation,
          success: false,
          error: (error instanceof Error ? error.message : "Unknown error")
        });
        failed++;
      }
    }

    return { successful, failed, results };
  }

  /**
   * Migration utility - help transition from legacy to OTA-ready system
   */
  async migrationHelper(hotelId: string): Promise<{
    currentStatus: {
      hasRoomTypes: boolean;
      hasInventoryRecords: boolean;
      roomsWithoutRoomTypes: number;
    };
    migrationSteps: Array<{
      step: string;
      completed: boolean;
      action: string;
    }>;
    nextActions: string[];
  }> {
    try {
      // Check current state
      const [roomTypes, bookings] = await Promise.all([
        roomTypeService.getRoomTypes(hotelId),
        enhancedBookingService.getBookings({ hotelId, limit: 1 })
      ]);

      const hasRoomTypes = roomTypes.length > 0;
      const hasInventoryRecords = hasRoomTypes; // Assume if room types exist, inventory exists

      const migrationSteps = [
        {
          step: 'Create Room Types',
          completed: hasRoomTypes,
          action: hasRoomTypes ? 'Completed' : 'Run migration script to create room types from existing rooms'
        },
        {
          step: 'Create Inventory Records',
          completed: hasInventoryRecords,
          action: hasInventoryRecords ? 'Completed' : 'Generate inventory records for room types'
        },
        {
          step: 'Update Frontend Services',
          completed: true, // Assume completed since we're running this
          action: 'Frontend services updated to use OTA-ready APIs'
        }
      ];

      const nextActions = [];
      if (!hasRoomTypes) {
        nextActions.push('Run the OTA migration script: node src/scripts/migrateToOTAReady.js');
      }
      if (hasRoomTypes && !hasInventoryRecords) {
        nextActions.push('Create initial inventory records for all room types');
      }
      if (hasRoomTypes && hasInventoryRecords) {
        nextActions.push('System is ready for OTA integration');
        nextActions.push('Consider setting up channel mappings');
        nextActions.push('Test booking flows with new system');
      }

      return {
        currentStatus: {
          hasRoomTypes,
          hasInventoryRecords,
          roomsWithoutRoomTypes: 0 // Would need to query Room collection
        },
        migrationSteps,
        nextActions
      };

    } catch (error: unknown) {
      throw new Error('Failed to analyze migration status');
    }
  }

  /**
   * Health check for all OTA services
   */
  async healthCheck(hotelId: string): Promise<{
    overall: 'healthy' | 'warning' | 'critical';
    services: {
      roomTypes: 'healthy' | 'error';
      inventory: 'healthy' | 'error'; 
      availability: 'healthy' | 'error';
      bookings: 'healthy' | 'error';
    };
    issues: string[];
    recommendations: string[];
  }> {
    const issues = [];
    const recommendations = [];
    const services = {
      roomTypes: 'error' as 'healthy' | 'error',
      inventory: 'error' as 'healthy' | 'error',
      availability: 'error' as 'healthy' | 'error',
      bookings: 'error' as 'healthy' | 'error'
    };

    try {
      // Test room types service
      const roomTypes = await roomTypeService.getRoomTypes(hotelId);
      services.roomTypes = 'healthy';
      
      if (roomTypes.length === 0) {
        issues.push('No room types configured');
        recommendations.push('Create room types for the hotel');
      }
    } catch (error) {
      issues.push('Room Types service unavailable');
    }

    try {
      // Test inventory service
      const today = new Date().toISOString().split('T')[0];
      await inventoryService.getInventory({
        hotelId,
        startDate: today,
        endDate: today
      });
      services.inventory = 'healthy';
    } catch (error) {
      issues.push('Inventory service unavailable');
    }

    try {
      // Test availability service
      await availabilityService.getOccupancyRate({
        hotelId,
        startDate: new Date().toISOString().split('T')[0],
        endDate: new Date().toISOString().split('T')[0]
      });
      services.availability = 'healthy';
    } catch (error) {
      issues.push('Availability service unavailable');
    }

    try {
      // Test booking service
      await enhancedBookingService.getBookings({ hotelId, limit: 1 });
      services.bookings = 'healthy';
    } catch (error) {
      issues.push('Enhanced Booking service unavailable');
    }

    const healthyCount = Object.values(services).filter(s => s === 'healthy').length;
    const overall = healthyCount === 4 ? 'healthy' : 
                   healthyCount >= 2 ? 'warning' : 'critical';

    return {
      overall,
      services,
      issues,
      recommendations
    };
  }

  // Helper method to calculate start date based on period
  private calculateStartDate(endDate: string, period: string): string {
    const end = new Date(endDate);
    const days = period === '7d' ? 7 : period === '30d' ? 30 : period === '90d' ? 90 : 365;
    end.setDate(end.getDate() - days);
    return end.toISOString().split('T')[0];
  }
}

export const otaIntegrationService = new OTAIntegrationService();
export default otaIntegrationService;