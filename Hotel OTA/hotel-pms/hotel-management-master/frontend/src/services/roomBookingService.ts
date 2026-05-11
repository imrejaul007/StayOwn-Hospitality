import { api } from './api';

export interface RoomAvailabilityRequest {
  hotelId: string;
  date: string;
  timeSlot: {
    start: string;
    end: string;
  };
  capacity: number;
  roomType?: string;
}

export interface Room {
  _id: string;
  roomNumber: string;
  type: string;
  capacity: number;
  amenities: string[];
  description?: string;
  baseRate: number;
}

export interface Equipment {
  id: string;
  name: string;
  description: string;
  costPerHour: number;
  available: boolean;
}

export interface Service {
  id: string;
  name: string;
  description: string;
  costPerPerson?: number;
  costPerHour?: number;
  available: boolean;
  minPeople?: number;
  minDuration?: number;
}

export interface RoomAvailabilityResponse {
  available: boolean;
  recommendedRoom?: Room;
  allAvailableRooms?: Room[];
  reason?: string;
  alternatives?: unknown[];
  alternativeTimeSlots?: unknown[];
  conflictingSlots?: unknown[];
}

export interface BookingCost {
  baseRoom: number;
  equipment: number;
  services: number;
  subtotal: number;
  tax: number;
  total: number;
  currency: string;
  breakdown: {
    room: {
      cost: number;
      duration: number;
    };
    equipment: Array<{
      id: string;
      name: string;
      cost: number;
    }>;
    services: Array<{
      id: string;
      name: string;
      cost: number;
    }>;
  };
}

export interface RoomBookingRequest {
  meetUpId: string;
  roomId: string;
  equipment?: string[];
  services?: string[];
}

export interface BookingDetails {
  hasBooking: boolean;
  booking?: unknown;
  room?: Room;
  serviceBooking?: unknown;
  message?: string;
}

export interface RoomSchedule {
  date: string;
  schedule: Array<{
    room: Room;
    bookings: Array<{
      meetUpId: string;
      title: string;
      timeSlot: {
        start: string;
        end: string;
      };
      participants: unknown[];
      status: string;
    }>;
  }>;
  totalBookings: number;
}

class RoomBookingService {
  private baseURL = '/meetup-resources';

  /**
   * Check room availability for a meet-up
   */
  async checkRoomAvailability(request: RoomAvailabilityRequest): Promise<RoomAvailabilityResponse> {
    try {
      const response = await api.post(`${this.baseURL}/room-availability`, request);
      return response.data.data;
    } catch (error: unknown) {
      const axiosErr = error as { response?: { data?: { message?: string }; status?: number }; config?: unknown };
      throw new Error(axiosErr.response?.data?.message || 'Failed to check room availability');
    }
  }

  /**
   * Get available meeting rooms for a hotel
   */
  async getAvailableRooms(hotelId: string, capacity?: number, type?: string): Promise<Room[]> {
    try {
      const params = new URLSearchParams();
      if (capacity) params.append('capacity', capacity.toString());
      if (type) params.append('type', type);

      const response = await api.get(`${this.baseURL}/rooms/${hotelId}?${params.toString()}`);
      return response.data.data.rooms;
    } catch (error: unknown) {
      const axiosErr = error as { response?: { data?: { message?: string }; status?: number }; config?: unknown };
      throw new Error(axiosErr.response?.data?.message || 'Failed to fetch available rooms');
    }
  }

  /**
   * Get available equipment for a hotel
   */
  async getAvailableEquipment(hotelId: string): Promise<Equipment[]> {
    try {
      const response = await api.get(`${this.baseURL}/equipment/${hotelId}`);
      return response.data.data.equipment;
    } catch (error: unknown) {
      const axiosErr = error as { response?: { data?: { message?: string }; status?: number }; config?: unknown };
      throw new Error(axiosErr.response?.data?.message || 'Failed to fetch available equipment');
    }
  }

  /**
   * Get available services for a hotel
   */
  async getAvailableServices(hotelId: string): Promise<Service[]> {
    try {
      const response = await api.get(`${this.baseURL}/services/${hotelId}`);
      return response.data.data.services;
    } catch (error: unknown) {
      const axiosErr = error as { response?: { data?: { message?: string }; status?: number }; config?: unknown };
      throw new Error(axiosErr.response?.data?.message || 'Failed to fetch available services');
    }
  }

  /**
   * Book a room for a meet-up
   */
  async bookRoom(request: RoomBookingRequest): Promise<unknown> {
    try {
      const response = await api.post(`${this.baseURL}/book-room`, request);
      return response.data.data;
    } catch (error: unknown) {
      const axiosErr = error as { response?: { data?: { message?: string }; status?: number }; config?: unknown };
      throw new Error(axiosErr.response?.data?.message || 'Failed to book room');
    }
  }

  /**
   * Calculate booking cost estimate
   */
  async calculateBookingCost(
    hotelId: string,
    duration: number,
    equipment: string[] = [],
    services: string[] = [],
    participants: number = 2
  ): Promise<BookingCost> {
    try {
      const request = {
        hotelId,
        duration,
        equipment,
        services,
        participants
      };

      const response = await api.post(`${this.baseURL}/booking-cost`, request);
      return response.data.data.cost;
    } catch (error: unknown) {
      const axiosErr = error as { response?: { data?: { message?: string }; status?: number }; config?: unknown };
      throw new Error(axiosErr.response?.data?.message || 'Failed to calculate booking cost');
    }
  }

  /**
   * Cancel room booking for a meet-up
   */
  async cancelRoomBooking(meetUpId: string, reason?: string): Promise<{ refundEligible: boolean }> {
    try {
      const response = await api.delete(`${this.baseURL}/cancel-booking/${meetUpId}`, {
        data: { reason }
      });
      return response.data.data;
    } catch (error: unknown) {
      const axiosErr = error as { response?: { data?: { message?: string }; status?: number }; config?: unknown };
      throw new Error(axiosErr.response?.data?.message || 'Failed to cancel booking');
    }
  }

  /**
   * Get room booking details for a meet-up
   */
  async getBookingDetails(meetUpId: string): Promise<BookingDetails> {
    try {
      const response = await api.get(`${this.baseURL}/booking-details/${meetUpId}`);
      return response.data.data;
    } catch (error: unknown) {
      const axiosErr = error as { response?: { data?: { message?: string }; status?: number }; config?: unknown };
      throw new Error(axiosErr.response?.data?.message || 'Failed to fetch booking details');
    }
  }

  /**
   * Get room booking schedule for a hotel
   */
  async getRoomSchedule(hotelId: string, date?: string, roomId?: string): Promise<RoomSchedule> {
    try {
      const params = new URLSearchParams();
      if (date) params.append('date', date);
      if (roomId) params.append('roomId', roomId);

      const response = await api.get(`${this.baseURL}/room-schedule/${hotelId}?${params.toString()}`);
      return response.data.data;
    } catch (error: unknown) {
      const axiosErr = error as { response?: { data?: { message?: string }; status?: number }; config?: unknown };
      throw new Error(axiosErr.response?.data?.message || 'Failed to fetch room schedule');
    }
  }

  /**
   * Helper function to format time duration
   */
  formatDuration(minutes: number): string {
    const hours = Math.floor(minutes / 60);
    const mins = minutes % 60;

    if (hours === 0) {
      return `${mins} minutes`;
    } else if (mins === 0) {
      return `${hours} hour${hours !== 1 ? 's' : ''}`;
    } else {
      return `${hours}h ${mins}m`;
    }
  }

  /**
   * Helper function to calculate duration between times
   */
  calculateDuration(startTime: string, endTime: string): number {
    const [startHours, startMinutes] = startTime.split(':').map(Number);
    const [endHours, endMinutes] = endTime.split(':').map(Number);

    const startTotalMinutes = startHours * 60 + startMinutes;
    const endTotalMinutes = endHours * 60 + endMinutes;

    return endTotalMinutes - startTotalMinutes;
  }

  /**
   * Helper function to format currency
   */
  formatCurrency(amount: number, currency: string = 'INR'): string {
    return new Intl.NumberFormat('en-IN', {
      style: 'currency',
      currency: currency,
      minimumFractionDigits: 0,
      maximumFractionDigits: 0
    }).format(amount);
  }

  /**
   * Helper function to get equipment icon
   */
  getEquipmentIcon(equipmentId: string): string {
    const icons: { [key: string]: string } = {
      'projector': '📽️',
      'whiteboard': '📋',
      'flipchart': '📊',
      'sound_system': '🔊',
      'video_conference': '📹',
      'laptop': '💻'
    };
    return icons[equipmentId] || '🔧';
  }

  /**
   * Helper function to get service icon
   */
  getServiceIcon(serviceId: string): string {
    const icons: { [key: string]: string } = {
      'basic_refreshments': '☕',
      'business_lunch': '🍽️',
      'welcome_drinks': '🥤',
      'stationery_kit': '📝',
      'photographer': '📸',
      'concierge_support': '🤵'
    };
    return icons[serviceId] || '🛎️';
  }

  /**
   * Helper function to validate time slot
   */
  validateTimeSlot(startTime: string, endTime: string): { valid: boolean; error?: string } {
    const timeRegex = /^([01]?[0-9]|2[0-3]):[0-5][0-9]$/;

    if (!timeRegex.test(startTime)) {
      return { valid: false, error: 'Start time must be in HH:MM format' };
    }

    if (!timeRegex.test(endTime)) {
      return { valid: false, error: 'End time must be in HH:MM format' };
    }

    const duration = this.calculateDuration(startTime, endTime);

    if (duration <= 0) {
      return { valid: false, error: 'End time must be after start time' };
    }

    if (duration < 30) {
      return { valid: false, error: 'Minimum booking duration is 30 minutes' };
    }

    if (duration > 720) { // 12 hours
      return { valid: false, error: 'Maximum booking duration is 12 hours' };
    }

    return { valid: true };
  }

  /**
   * Helper function to check if booking is within business hours
   */
  isWithinBusinessHours(startTime: string, endTime: string): boolean {
    const businessStart = 6; // 6 AM
    const businessEnd = 23; // 11 PM

    const [startHours] = startTime.split(':').map(Number);
    const [endHours] = endTime.split(':').map(Number);

    return startHours >= businessStart && endHours <= businessEnd;
  }
}

export default new RoomBookingService();