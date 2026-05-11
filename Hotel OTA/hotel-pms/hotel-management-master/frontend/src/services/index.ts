// OTA-Ready Service Exports
// This file provides easy access to all the new OTA-ready services

// Phase 4: Real-Time Language Detection & Auto-Translation Services
export { default as languageDetectionService } from './languageDetectionService';
export { default as autoTranslationService } from './autoTranslationService';

// Core OTA Services
export { roomTypeService, type RoomType, type RoomTypeOption, type CreateRoomTypeData } from './roomTypeService';
export { availabilityService, type AvailabilityCheck, type AvailabilityResult, type AvailabilityResultV2 } from './availabilityService';
export { inventoryService, type InventoryRecord, type InventoryUpdate, type BulkInventoryUpdate } from './inventoryService';
export { enhancedBookingService, type EnhancedBooking, type CreateEnhancedBookingRequest } from './enhancedBookingService';

// Integration and Coordination
export { otaIntegrationService, type BookingFlowParams, type BookingFlowResult, type HotelDashboardData } from './otaIntegrationService';

// Legacy Services (maintained for compatibility)
export { bookingService } from './bookingService';
export { api } from './api';

// Utility function to help migrate from legacy to OTA-ready services
export const serviceUtils = {
  /**
   * Check if hotel is using OTA-ready system
   */
  async isOTAReady(hotelId: string): Promise<boolean> {
    try {
      const roomTypes = await roomTypeService.getRoomTypes(hotelId);
      return roomTypes.length > 0;
    } catch (error) {
      return false;
    }
  },

  /**
   * Get appropriate booking service based on hotel's OTA readiness
   */
  async getBookingService(hotelId: string) {
    const isReady = await this.isOTAReady(hotelId);
    return isReady ? enhancedBookingService : bookingService;
  },

  /**
   * Smart availability checking that automatically chooses V1 or V2
   */
  async checkAvailabilitySmart(params: {
    hotelId: string;
    checkIn: string;
    checkOut: string;
    roomType?: string;
    roomTypeId?: string;
    guestCount?: number;
  }) {
    try {
      // Try V2 first if we have room type ID or can resolve it
      return await availabilityService.checkAvailabilitySmart(params);
    } catch (error) {
      // Fallback to basic availability if V2 fails
      throw error;
    }
  },

  /**
   * Migrate hotel to OTA-ready system
   */
  async migrateToOTAReady(hotelId: string) {
    return await otaIntegrationService.migrationHelper(hotelId);
  }
};

// Export commonly used types for easy access
export type {
  // Room Type related
  RoomType,
  RoomTypeOption,
  CreateRoomTypeData,
  
  // Availability related
  AvailabilityCheck,
  AvailabilityResult,
  AvailabilityResultV2,
  
  // Inventory related
  InventoryRecord,
  InventoryUpdate,
  BulkInventoryUpdate,
  
  // Booking related
  EnhancedBooking,
  CreateEnhancedBookingRequest,
  
  // Integration related
  BookingFlowParams,
  BookingFlowResult,
  HotelDashboardData
} from './roomTypeService';

// Default export for the main integration service
export default otaIntegrationService;