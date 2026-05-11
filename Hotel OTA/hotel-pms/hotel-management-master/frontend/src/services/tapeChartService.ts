import { api as apiClient } from './api';

export interface RoomConfiguration {
  _id: string;
  configId: string;
  roomNumber: string;
  roomType: string;
  floor: number;
  building?: string;
  wing?: string;
  position: {
    row?: number;
    column?: number;
    x?: number;
    y?: number;
  };
  displaySettings: {
    color: string;
    width: number;
    height: number;
    showRoomNumber: boolean;
    showGuestName: boolean;
    showRoomType: boolean;
  };
  isActive: boolean;
  sortOrder: number;
}

export interface RoomStatusHistory {
  _id: string;
  historyId: string;
  roomId: string;
  date: string;
  status: string;
  previousStatus?: string;
  bookingId?: string;
  guestName?: string;
  checkIn?: string;
  checkOut?: string;
  notes?: string;
  changedBy: string;
  changeReason?: string;
  duration?: number;
  priority: string;
}

export interface RoomBlock {
  _id: string;
  blockId: string;
  blockName: string;
  groupName: string;
  corporateId?: string;
  eventType: string;
  startDate: string;
  endDate: string;
  rooms: Array<{
    roomId: string;
    roomNumber: string;
    roomType: string;
    rate?: number;
    status: string;
    guestName?: string;
    specialRequests?: string;
  }>;
  totalRooms: number;
  roomsBooked: number;
  roomsReleased: number;
  blockRate?: number;
  currency: string;
  cutOffDate?: string;
  autoReleaseDate?: string;
  status: string;
  contactPerson: {
    name?: string;
    email?: string;
    phone?: string;
    title?: string;
  };
  billingInstructions: string;
  specialInstructions?: string;
  amenities: string[];
  cateringRequirements?: string;
  createdBy: string;
}

export interface AdvancedReservation {
  _id: string;
  reservationId: string;
  bookingId: string;
  reservationType: string;
  priority: string;
  roomPreferences: {
    preferredRooms?: string[];
    preferredFloor?: number;
    preferredView?: string;
    adjacentRooms?: boolean;
    connectingRooms?: boolean;
    accessibleRoom?: boolean;
    smokingPreference: string;
  };
  guestProfile: {
    vipStatus: string;
    loyaltyNumber?: string;
    preferences: {
      bedType?: string;
      pillowType?: string;
      roomTemperature?: number;
      newspaper?: string;
      wakeUpCall?: boolean;
      turndownService?: boolean;
    };
    allergies: string[];
    specialNeeds: string[];
    dietaryRestrictions: string[];
  };
  roomAssignments: Array<{
    roomId: string;
    roomNumber: string;
    assignedDate: string;
    assignmentType: string;
    assignedBy: string;
    notes?: string;
  }>;
  upgrades: Array<{
    fromRoomType: string;
    toRoomType: string;
    upgradeType: string;
    upgradeReason?: string;
    additionalCharge: number;
    approvedBy: string;
    upgradeDate: string;
  }>;
  specialRequests: Array<{
    type: string;
    description?: string;
    priority: string;
    status: string;
    assignedTo?: string;
    dueDate?: string;
    cost?: number;
    notes?: string;
  }>;
  reservationFlags: Array<{
    flag: string;
    severity: string;
    description?: string;
    createdBy: string;
    expiryDate?: string;
  }>;
  waitlistInfo?: {
    waitlistPosition?: number;
    waitlistDate?: string;
    preferredRoomTypes?: string[];
    maxRate?: number;
    flexibleDates?: {
      checkInRange?: {
        start: string;
        end: string;
      };
      checkOutRange?: {
        start: string;
        end: string;
      };
    };
    notificationPreferences?: {
      email?: boolean;
      sms?: boolean;
      phone?: boolean;
    };
    autoConfirm?: boolean;
  };
}

export interface TapeChartView {
  _id: string;
  viewId: string;
  viewName: string;
  viewType: string;
  dateRange: {
    startDate?: string;
    endDate?: string;
    defaultDays: number;
  };
  displaySettings: {
    showWeekends: boolean;
    colorCoding: {
      available: string;
      occupied: string;
      reserved: string;
      maintenance: string;
      out_of_order: string;
      dirty: string;
      clean: string;
    };
    roomSorting: string;
    showGuestNames: boolean;
    showRoomTypes: boolean;
    showRates: boolean;
    compactView: boolean;
  };
  filters: {
    floors?: number[];
    roomTypes?: string[];
    statuses?: string[];
    buildings?: string[];
    wings?: string[];
  };
  isSystemDefault: boolean;
  createdBy: string;
}

export interface RoomAssignmentRule {
  _id: string;
  ruleId: string;
  ruleName: string;
  priority: number;
  isActive: boolean;
  conditions: {
    guestType?: string[];
    reservationType?: string[];
    roomTypes?: string[];
    lengthOfStay?: {
      min?: number;
      max?: number;
    };
    advanceBooking?: {
      min?: number;
      max?: number;
    };
    seasonality?: string[];
    occupancyLevel?: {
      min?: number;
      max?: number;
    };
  };
  actions: {
    preferredFloors?: number[];
    preferredRoomNumbers?: string[];
    avoidRoomNumbers?: string[];
    upgradeEligible?: boolean;
    upgradeFromTypes?: string[];
    upgradeToTypes?: string[];
    amenityPackages?: string[];
    specialServices?: string[];
    rateOverrides?: {
      discountPercentage?: number;
      fixedRate?: number;
    };
  };
  restrictions: {
    maxUpgrades?: number;
    blockoutDates?: Array<{
      startDate: string;
      endDate: string;
      reason?: string;
    }>;
    minimumRevenue?: number;
    requiredApproval: string;
  };
  createdBy: string;
  lastModifiedBy: string;
}

export interface TapeChartData {
  view: TapeChartView;
  dateRange: {
    startDate: string;
    endDate: string;
  };
  rooms: Array<{
    config: RoomConfiguration;
    room: unknown;
    timeline: Array<{
      date: string;
      status: string;
      guestName?: string;
      bookingId?: string;
      rate?: number;
    }>;
    currentStatus: string;
    bookings: unknown[];
    blocks: unknown[];
  }>;
  summary: {
    totalRooms: number;
    occupiedRooms: number;
    availableRooms: number;
    reservedRooms: number;
    maintenanceRooms: number;
    blockedRooms: number;
    occupancyRate: number;
  };
}

class TapeChartService {
  // Room Configuration
  async getRoomConfigurations(filters?: { floor?: number; building?: string; wing?: string; isActive?: boolean }) {
    const params = new URLSearchParams();
    if (filters?.floor) params.append('floor', filters.floor.toString());
    if (filters?.building) params.append('building', filters.building);
    if (filters?.wing) params.append('wing', filters.wing);
    if (filters?.isActive !== undefined) params.append('isActive', filters.isActive.toString());
    
    const response = await apiClient.get(`/tape-chart/room-config?${params}`);
    return response.data;
  }

  async createRoomConfiguration(configData: Partial<RoomConfiguration>) {
    const response = await apiClient.post('/tape-chart/room-config', configData);
    return response.data;
  }

  async updateRoomConfiguration(id: string, configData: Partial<RoomConfiguration>) {
    const response = await apiClient.put(`/tape-chart/room-config/${id}`, configData);
    return response.data;
  }

  async deleteRoomConfiguration(id: string) {
    const response = await apiClient.delete(`/tape-chart/room-config/${id}`);
    return response.data;
  }

  // Room Status Management
  async updateRoomStatus(roomId: string, statusData: {
    status: string;
    bookingId?: string;
    guestName?: string;
    checkIn?: string;
    checkOut?: string;
    notes?: string;
    changeReason?: string;
    priority?: string;
  }) {
    const response = await apiClient.put(`/tape-chart/rooms/${roomId}/status`, statusData);
    return response.data;
  }

  async getRoomStatusHistory(roomId: string, dateRange?: { startDate?: string; endDate?: string }) {
    const params = new URLSearchParams();
    if (dateRange?.startDate) params.append('startDate', dateRange.startDate);
    if (dateRange?.endDate) params.append('endDate', dateRange.endDate);

    const response = await apiClient.get(`/tape-chart/rooms/${roomId}/status-history?${params}`);
    return response.data;
  }

  async getAvailableRooms(filters?: {
    checkIn?: string;
    checkOut?: string;
    roomType?: string;
    floor?: number;
    guestCount?: number;
  }) {
    const params = new URLSearchParams();
    if (filters?.checkIn) params.append('checkIn', filters.checkIn);
    if (filters?.checkOut) params.append('checkOut', filters.checkOut);
    if (filters?.roomType) params.append('roomType', filters.roomType);
    if (filters?.floor) params.append('floor', filters.floor.toString());
    if (filters?.guestCount) params.append('guestCount', filters.guestCount.toString());

    const response = await apiClient.get(`/tape-chart/rooms/available?${params}`);
    return response.data.data || response.data;
  }

  // Room Blocks
  async getRoomBlocks(filters?: { status?: string; eventType?: string; startDate?: string; endDate?: string }) {
    const params = new URLSearchParams();
    if (filters?.status) params.append('status', filters.status);
    if (filters?.eventType) params.append('eventType', filters.eventType);
    if (filters?.startDate) params.append('startDate', filters.startDate);
    if (filters?.endDate) params.append('endDate', filters.endDate);
    
    const response = await apiClient.get(`/tape-chart/room-blocks?${params}`);
    return response.data;
  }

  async createRoomBlock(blockData: Partial<RoomBlock>) {
    const response = await apiClient.post('/tape-chart/room-blocks', blockData);
    return response.data;
  }

  async updateRoomBlock(id: string, blockData: Partial<RoomBlock>) {
    const response = await apiClient.put(`/tape-chart/room-blocks/${id}`, blockData);
    return response.data;
  }

  async releaseRoomBlock(id: string) {
    const response = await apiClient.post(`/tape-chart/room-blocks/${id}/release`);
    return response.data;
  }

  // Advanced Reservations
  async getAdvancedReservations(filters?: { reservationType?: string; priority?: string; vipStatus?: string }) {
    const params = new URLSearchParams();
    if (filters?.reservationType) params.append('reservationType', filters.reservationType);
    if (filters?.priority) params.append('priority', filters.priority);
    if (filters?.vipStatus) params.append('vipStatus', filters.vipStatus);
    
    const response = await apiClient.get(`/tape-chart/reservations?${params}`);
    return response.data;
  }

  async createAdvancedReservation(reservationData: Partial<AdvancedReservation>) {
    const response = await apiClient.post('/tape-chart/reservations', reservationData);
    return response.data;
  }

  async assignRoom(draggedItemData: Record<string, unknown>, assignmentData: {
    roomId: string;
    roomNumber: string;
    assignmentType?: string;
    notes?: string;
    newCheckInDate?: string;
    moveReason?: string;
  }) {

    const requestPayload = {
      // Include booking ID if available for more reliable lookup
      bookingId: draggedItemData._id || draggedItemData.id || draggedItemData.bookingId,
      guestName: draggedItemData.guestName,
      checkIn: draggedItemData.checkIn,
      checkOut: draggedItemData.checkOut,
      newRoomId: assignmentData.roomId,
      newRoomNumber: assignmentData.roomNumber,
      newCheckInDate: assignmentData.newCheckInDate, // Pass the target date for validation
      reason: assignmentData.notes || 'Room assignment via tape chart drag & drop'
    };


    // Always use the change-room-by-guest endpoint which handles room assignments properly
    const response = await apiClient.post('/bookings/change-room-by-guest', requestPayload);

    return response.data.data || response.data;
  }

  async autoAssignRooms(reservationId: string) {
    const response = await apiClient.post(`/tape-chart/reservations/${reservationId}/auto-assign`);
    return response.data;
  }

  async processUpgrade(reservationId: string, upgradeData: {
    fromRoomType: string;
    toRoomType: string;
    upgradeType: string;
    upgradeReason?: string;
    additionalCharge?: number;
    newRoomId?: string;
    newRoomNumber?: string;
  }) {
    const response = await apiClient.post(`/tape-chart/reservations/${reservationId}/upgrade`, upgradeData);
    return response.data;
  }

  // Tape Chart Views
  async getTapeChartViews(hotelId?: string) {
    const params = new URLSearchParams();
    if (hotelId) params.append('hotelId', hotelId);
    const response = await apiClient.get(`/tape-chart/views?${params}`);
    return response.data;
  }

  async createTapeChartView(viewData: Partial<TapeChartView>) {
    const response = await apiClient.post('/tape-chart/views', viewData);
    return response.data;
  }

  async updateTapeChartView(id: string, viewData: Partial<TapeChartView>) {
    const response = await apiClient.put(`/tape-chart/views/${id}`, viewData);
    return response.data;
  }

  async deleteTapeChartView(id: string) {
    const response = await apiClient.delete(`/tape-chart/views/${id}`);
    return response.data;
  }

  // Generate Tape Chart Data
  async generateTapeChartData(viewId: string, dateRange: { startDate: string; endDate: string }, hotelId?: string) {
    const params = new URLSearchParams();
    params.append('viewId', viewId);
    params.append('startDate', dateRange.startDate);
    params.append('endDate', dateRange.endDate);
    if (hotelId) params.append('hotelId', hotelId);

    const response = await apiClient.get(`/tape-chart/chart-data?${params}`);
    return response.data.data;
  }

  // Room Assignment Rules
  async getAssignmentRules(filters?: { isActive?: boolean }) {
    const params = new URLSearchParams();
    if (filters?.isActive !== undefined) params.append('isActive', filters.isActive.toString());
    
    const response = await apiClient.get(`/tape-chart/assignment-rules?${params}`);
    return response.data;
  }

  async createAssignmentRule(ruleData: Partial<RoomAssignmentRule>) {
    const response = await apiClient.post('/tape-chart/assignment-rules', ruleData);
    return response.data;
  }

  async updateAssignmentRule(id: string, ruleData: Partial<RoomAssignmentRule>) {
    const response = await apiClient.put(`/tape-chart/assignment-rules/${id}`, ruleData);
    return response.data;
  }

  async deleteAssignmentRule(id: string) {
    const response = await apiClient.delete(`/tape-chart/assignment-rules/${id}`);
    return response.data;
  }

  // Waitlist
  async addToWaitlist(reservationId: string, waitlistData: Record<string, unknown>) {
    const response = await apiClient.post(`/tape-chart/reservations/${reservationId}/waitlist`, waitlistData);
    return response.data;
  }

  async processWaitlist() {
    const response = await apiClient.post('/tape-chart/waitlist/process');
    return response.data;
  }

  async getWaitlist() {
    const response = await apiClient.get('/tape-chart/waitlist');
    return response.data;
  }

  // Reports
  async getOccupancyReport(dateRange: { startDate: string; endDate: string }, groupBy?: string) {
    const params = new URLSearchParams();
    params.append('startDate', dateRange.startDate);
    params.append('endDate', dateRange.endDate);
    if (groupBy) params.append('groupBy', groupBy);
    
    const response = await apiClient.get(`/tape-chart/reports/occupancy?${params}`);
    return response.data;
  }

  async getRoomUtilizationStats(dateRange?: { startDate?: string; endDate?: string }) {
    const params = new URLSearchParams();
    if (dateRange?.startDate) params.append('startDate', dateRange.startDate);
    if (dateRange?.endDate) params.append('endDate', dateRange.endDate);
    
    const response = await apiClient.get(`/tape-chart/reports/room-utilization?${params}`);
    return response.data;
  }

  async getRevenueByRoomType(dateRange?: { startDate?: string; endDate?: string }) {
    const params = new URLSearchParams();
    if (dateRange?.startDate) params.append('startDate', dateRange.startDate);
    if (dateRange?.endDate) params.append('endDate', dateRange.endDate);
    
    const response = await apiClient.get(`/tape-chart/reports/revenue-by-room-type?${params}`);
    return response.data;
  }

  // Dashboard
  async getTapeChartDashboard() {
    const response = await apiClient.get('/tape-chart/dashboard');
    return response.data.data;
  }

  // Real-time Updates
  async getRoomStatusUpdates(since?: string) {
    const params = new URLSearchParams();
    if (since) params.append('since', since);
    
    const response = await apiClient.get(`/tape-chart/room-status-updates?${params}`);
    return response.data;
  }

  // Bulk Operations
  async bulkUpdateRoomStatus(updates: Array<{
    roomId: string;
    status: string;
    notes?: string;
    changeReason?: string;
  }>) {
    const response = await apiClient.post('/tape-chart/bulk/room-status', { updates });
    return response.data;
  }

  async bulkRoomAssignment(assignments: Array<{
    reservationId: string;
    roomId: string;
    roomNumber: string;
    assignmentType?: string;
    notes?: string;
  }>) {
    const response = await apiClient.post('/tape-chart/bulk/room-assignment', { assignments });
    return response.data;
  }
}

export default new TapeChartService();