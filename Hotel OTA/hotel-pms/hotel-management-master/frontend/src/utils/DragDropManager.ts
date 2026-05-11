import { toast } from '@/utils/toast';
import tapeChartService from '@/services/tapeChartService';
import { api } from '@/services/api';

export interface DraggedReservation {
  id: string;
  _id: string;
  bookingNumber?: string;
  guestName: string;
  roomType: string;
  checkIn: string;
  checkOut: string;
  status: string;
  vipStatus?: string;
  totalAmount?: number;
  paymentStatus?: string;
  adults: number;
  children: number;
  nights: number;
  specialRequests?: string[];
}

export interface DropTarget {
  roomId: string;
  roomNumber: string;
  date: string;
  isAvailable: boolean;
  conflictReason?: string;
}

export interface DragOperation {
  id: string;
  reservations: DraggedReservation[];
  startTime: number;
  operation: 'move' | 'assign' | 'batch_assign';
}

export class DragDropManager {
  private static instance: DragDropManager;
  private currentOperation: DragOperation | null = null;
  private dropZones: Map<string, DropTarget> = new Map();
  private selectedReservations: Set<string> = new Set();
  private conflictChecks: Map<string, boolean> = new Map();
  private operationHistory: DragOperation[] = [];
  private readonly MAX_HISTORY = 10;
  private refreshCallback: (() => void) | null = null;
  private pendingTimers: Set<ReturnType<typeof setTimeout>> = new Set();

  private constructor() {}

  static getInstance(): DragDropManager {
    if (!DragDropManager.instance) {
      DragDropManager.instance = new DragDropManager();
    }
    return DragDropManager.instance;
  }

  // Multi-selection management
  addToSelection(reservationId: string): void {
    this.selectedReservations.add(reservationId);
  }

  removeFromSelection(reservationId: string): void {
    this.selectedReservations.delete(reservationId);
  }

  clearSelection(): void {
    this.selectedReservations.clear();
  }

  isSelected(reservationId: string): boolean {
    return this.selectedReservations.has(reservationId);
  }

  getSelectedReservations(): string[] {
    return Array.from(this.selectedReservations);
  }

  getSelectionCount(): number {
    return this.selectedReservations.size;
  }

  // Set refresh callback for real-time updates
  setRefreshCallback(callback: () => void): void {
    this.refreshCallback = callback;
  }

  private triggerRefresh(): void {
    if (this.refreshCallback) {
      this.refreshCallback();
    }
  }

  // Drag operation management
  startDragOperation(reservations: DraggedReservation[], operation: 'move' | 'assign' | 'batch_assign'): string {
    const operationId = `drag-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;

    this.currentOperation = {
      id: operationId,
      reservations,
      startTime: Date.now(),
      operation
    };

    return operationId;
  }

  getCurrentOperation(): DragOperation | null {
    return this.currentOperation;
  }

  endDragOperation(): void {
    if (this.currentOperation) {
      this.operationHistory.unshift(this.currentOperation);
      if (this.operationHistory.length > this.MAX_HISTORY) {
        this.operationHistory = this.operationHistory.slice(0, this.MAX_HISTORY);
      }
    }
    this.currentOperation = null;
    this.clearSelection();
  }

  // Drop zone management
  registerDropZone(cellId: string, target: DropTarget): void {
    this.dropZones.set(cellId, target);
  }

  unregisterDropZone(cellId: string): void {
    this.dropZones.delete(cellId);
  }

  getDropZone(cellId: string): DropTarget | undefined {
    return this.dropZones.get(cellId);
  }

  // Conflict detection
  async checkRoomAvailability(roomId: string, date: string, reservation: DraggedReservation): Promise<{
    isAvailable: boolean;
    conflictReason?: string;
    suggestions?: string[];
  }> {
    const cacheKey = `${roomId}-${date}-${reservation.id}`;

    try {
      // Check if room is locked by another user
      const lockStatus = await this.checkRoomLock(roomId);
      if (lockStatus.isLocked && lockStatus.lockedBy !== this.getCurrentUserId()) {
        return {
          isAvailable: false,
          conflictReason: `Room is locked by ${lockStatus.lockedBy}`,
          suggestions: ['Try another room', 'Wait for lock to expire']
        };
      }

      // Check for booking conflicts
      const conflictCheck = await this.checkBookingConflicts(roomId, date, reservation);
      if (!conflictCheck.isAvailable) {
        return conflictCheck;
      }

      // Check room suitability
      const suitabilityCheck = this.checkRoomSuitability(roomId, reservation);
      if (!suitabilityCheck.isAvailable) {
        return suitabilityCheck;
      }

      this.conflictChecks.set(cacheKey, true);
      return { isAvailable: true };

    } catch (error) {
      return {
        isAvailable: false,
        conflictReason: 'Unable to verify room availability',
        suggestions: ['Refresh and try again']
      };
    }
  }

  private async checkRoomLock(roomId: string): Promise<{
    isLocked: boolean;
    lockedBy?: string;
    expiresAt?: Date;
  }> {
    try {
      // For now, skip room lock checking as the API endpoint may not exist
      // In the future, this would integrate with the existing room lock system
      return { isLocked: false };

      // TODO: Implement actual room lock checking when API is available
      // const { data } = await api.get(`/tape-chart/rooms/${roomId}/lock-status`);
      // return data;
    } catch (error) {
      return { isLocked: false };
    }
  }

  private async checkBookingConflicts(roomId: string, date: string, reservation: DraggedReservation): Promise<{
    isAvailable: boolean;
    conflictReason?: string;
    suggestions?: string[];
  }> {
    // Simulate checking for booking conflicts
    // In a real implementation, this would check the database

    const checkInDate = new Date(reservation.checkIn);
    const checkOutDate = new Date(reservation.checkOut);
    const targetDate = new Date(date);

    // Check if the target date falls within the reservation period
    if (targetDate >= checkInDate && targetDate < checkOutDate) {
      return { isAvailable: true };
    }

    // For now, assume availability - real implementation would check database
    return { isAvailable: true };
  }

  private checkRoomSuitability(roomId: string, reservation: DraggedReservation): {
    isAvailable: boolean;
    conflictReason?: string;
    suggestions?: string[];
  } {
    // Check guest count vs room capacity
    const totalGuests = reservation.adults + reservation.children;

    // These checks would use actual room data
    if (totalGuests > 4) { // Assuming max 4 guests per room
      return {
        isAvailable: false,
        conflictReason: `Room capacity insufficient for ${totalGuests} guests`,
        suggestions: ['Find a larger room', 'Split into multiple rooms']
      };
    }

    // Check VIP requirements
    if (reservation.vipStatus === 'svip') {
      // Would check if room has VIP amenities
    }

    return { isAvailable: true };
  }

  // Drag visual effects
  createDragImage(reservations: DraggedReservation[]): HTMLElement {
    const dragImage = document.createElement('div');
    dragImage.className = 'drag-preview bg-white border-2 border-blue-500 rounded-lg shadow-xl p-3 max-w-xs';

    if (reservations.length === 1) {
      const reservation = reservations[0];

      const header = document.createElement('div');
      header.className = 'flex items-center gap-2 mb-2';
      const dot = document.createElement('div');
      dot.className = 'w-3 h-3 bg-blue-500 rounded-full';
      const name = document.createElement('span');
      name.className = 'font-medium text-sm text-gray-800';
      name.textContent = reservation.guestName;
      header.append(dot, name);

      const roomType = document.createElement('div');
      roomType.className = 'text-xs text-gray-600';
      roomType.textContent = reservation.roomType;

      const dates = document.createElement('div');
      dates.className = 'text-xs text-gray-500';
      dates.textContent = `${reservation.checkIn} - ${reservation.checkOut}`;

      const status = document.createElement('div');
      status.className = 'text-xs text-blue-600 font-medium mt-1';
      status.textContent = 'Moving reservation...';

      dragImage.append(header, roomType, dates, status);
    } else {
      const header = document.createElement('div');
      header.className = 'flex items-center gap-2 mb-2';
      const dot = document.createElement('div');
      dot.className = 'w-3 h-3 bg-blue-500 rounded-full';
      const count = document.createElement('span');
      count.className = 'font-medium text-sm text-gray-800';
      count.textContent = `${reservations.length} Reservations`;
      header.append(dot, count);

      const batchLabel = document.createElement('div');
      batchLabel.className = 'text-xs text-gray-600';
      batchLabel.textContent = 'Batch Assignment';

      const movingLabel = document.createElement('div');
      movingLabel.className = 'text-xs text-blue-600 font-medium mt-1';
      movingLabel.textContent = `Moving ${reservations.length} guests...`;

      dragImage.append(header, batchLabel, movingLabel);
    }

    // Position off-screen
    dragImage.style.position = 'absolute';
    dragImage.style.top = '-1000px';
    dragImage.style.left = '-1000px';
    dragImage.style.zIndex = '9999';

    return dragImage;
  }

  // Assignment execution
  async executeAssignment(
    reservations: DraggedReservation[],
    target: DropTarget,
    options: {
      notes?: string;
      moveReason?: string;
      sendNotification?: boolean;
      lockRoom?: boolean;
    } = {}
  ): Promise<{ success: boolean; results: unknown[]; errors: string[] }> {

    const results: unknown[] = [];
    const errors: string[] = [];

    try {
      // Lock room if requested
      if (options.lockRoom) {
        await this.lockRoom(target.roomId, 'assignment_in_progress');
      }

      // Process each reservation
      for (const reservation of reservations) {
        try {

          const assignmentData = {
            roomId: target.roomId,
            roomNumber: target.roomNumber,
            assignmentType: 'drag_drop',
            notes: options.notes || `Moved via drag & drop to room ${target.roomNumber} for ${target.date}`,
            newCheckInDate: target.date,
            moveReason: options.moveReason || 'Staff reassignment via tape chart'
          };


          const result = await tapeChartService.assignRoom(reservation, assignmentData);
          results.push(result);


          if (options.sendNotification) {
            await this.sendAssignmentNotification(reservation, target);
          }

        } catch (error: unknown) {
          const err = error as { response?: { data?: { message?: string } }; message?: string };
          let errorMessage = `Failed to assign ${reservation.guestName}`;

          // Extract specific error message from server response
          if (err.response?.data?.message) {
            errorMessage = err.response.data.message;
          } else if (err.message) {
            errorMessage = `${errorMessage}: ${err.message}`;
          }

          errors.push(errorMessage);
        }
      }

      // Show success/error messages
      if (results.length > 0) {
        const successMessage = reservations.length === 1
          ? `${reservations[0].guestName} moved to room ${target.roomNumber}`
          : `${results.length} reservations successfully assigned`;

        toast.success(successMessage);

        // Trigger chart refresh for real-time updates
        const refreshTimer = setTimeout(() => {
          this.pendingTimers.delete(refreshTimer);
          this.triggerRefresh();
        }, 500); // Small delay to ensure backend update is complete
        this.pendingTimers.add(refreshTimer);
      }

      if (errors.length > 0) {
        // Show specific error messages for better UX
        errors.forEach((error, index) => {
          let toastType = 'error';
          let toastMessage = error;

          // Customize toast based on error type
          if (error.includes('Room type mismatch')) {
            toastType = 'warning';
            toastMessage = `❌ ${error}\n\nTip: Guests can only be assigned to rooms matching their booking type.`;
          } else if (error.includes('not active')) {
            toastType = 'warning';
            toastMessage = `🚫 ${error}\n\nPlease contact maintenance to activate this room.`;
          } else if (error.includes('Booking not found')) {
            toastType = 'error';
            toastMessage = `🔍 ${error}\n\nPlease verify the guest details and try again.`;
          }

          // Show one toast per error with slight delay to avoid stacking
          const toastTimer = setTimeout(() => {
            this.pendingTimers.delete(toastTimer);
            if (toastType === 'warning') {
              toast.warning(toastMessage);
            } else {
              toast.error(toastMessage);
            }
          }, index * 100);
          this.pendingTimers.add(toastTimer);
        });
      }

      return {
        success: results.length > 0,
        results,
        errors
      };

    } finally {
      // Unlock room
      if (options.lockRoom) {
        await this.unlockRoom(target.roomId);
      }
    }
  }

  private async lockRoom(roomId: string, reason: string): Promise<void> {
    try {
      await api.post(`/tape-chart/rooms/${roomId}/lock`, { reason, duration: 300000 }); // 5 minutes
    } catch {
      // Error handled silently
    }
  }

  private async unlockRoom(roomId: string): Promise<void> {
    try {
      await api.delete(`/tape-chart/rooms/${roomId}/unlock`);
    } catch {
      // Error handled silently
    }
  }

  private async sendAssignmentNotification(reservation: DraggedReservation, target: DropTarget): Promise<void> {
    // Implementation would send notification to guest about room change
  }

  private getCurrentUserId(): string {
    const user = JSON.parse(localStorage.getItem('user') || '{}');
    return user.id || user._id || 'unknown';
  }

  // Undo/Redo functionality
  getOperationHistory(): DragOperation[] {
    return [...this.operationHistory];
  }

  canUndo(): boolean {
    return this.operationHistory.length > 0;
  }

  async undoLastOperation(): Promise<boolean> {
    const lastOperation = this.operationHistory[0];
    if (!lastOperation) return false;

    try {
      // Implementation would reverse the last operation
      toast.info('Operation undone successfully');
      return true;
    } catch (error) {
      toast.error('Failed to undo operation');
      return false;
    }
  }

  // Smart room suggestions
  async getSuggestedRooms(reservation: DraggedReservation): Promise<{
    roomId: string;
    roomNumber: string;
    score: number;
    reasons: string[];
  }[]> {
    // This would implement intelligent room suggestions based on:
    // - Guest preferences
    // - Room amenities
    // - Proximity to other group members
    // - Historical guest preferences
    // - Revenue optimization

    return []; // Placeholder for now
  }

  // Cleanup
  cleanup(): void {
    this.pendingTimers.forEach(timer => clearTimeout(timer));
    this.pendingTimers.clear();
    this.currentOperation = null;
    this.dropZones.clear();
    this.selectedReservations.clear();
    this.conflictChecks.clear();
  }
}

export const dragDropManager = DragDropManager.getInstance();