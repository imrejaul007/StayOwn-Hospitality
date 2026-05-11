import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { workflowService, BulkCheckInRequest, BulkCheckOutRequest, HousekeepingRequest, MaintenanceRequest, RoomStatusUpdate } from '../services/workflowService';

// Hook for bulk check-in operations
export const useBulkCheckIn = () => {
  const queryClient = useQueryClient();
  
  return useMutation({
    mutationFn: (request: BulkCheckInRequest) => workflowService.bulkCheckIn(request),
    onSuccess: () => {
      // Invalidate and refetch room data
      queryClient.invalidateQueries({ queryKey: ['admin-rooms'] });
      queryClient.invalidateQueries({ queryKey: ['room-metrics'] });
      queryClient.invalidateQueries({ queryKey: ['dashboard-overview'] });
    },
  });
};

// Hook for bulk check-out operations
export const useBulkCheckOut = () => {
  const queryClient = useQueryClient();
  
  return useMutation({
    mutationFn: (request: BulkCheckOutRequest) => workflowService.bulkCheckOut(request),
    onSuccess: () => {
      // Invalidate and refetch room data
      queryClient.invalidateQueries({ queryKey: ['admin-rooms'] });
      queryClient.invalidateQueries({ queryKey: ['room-metrics'] });
      queryClient.invalidateQueries({ queryKey: ['dashboard-overview'] });
    },
  });
};

// Hook for housekeeping operations
export const useScheduleHousekeeping = () => {
  const queryClient = useQueryClient();
  
  return useMutation({
    mutationFn: (request: HousekeepingRequest) => workflowService.scheduleHousekeeping(request),
    onSuccess: () => {
      // Invalidate housekeeping and room data
      queryClient.invalidateQueries({ queryKey: ['admin-rooms'] });
      queryClient.invalidateQueries({ queryKey: ['housekeeping'] });
    },
  });
};

// Hook for maintenance operations
export const useRequestMaintenance = () => {
  const queryClient = useQueryClient();
  
  return useMutation({
    mutationFn: (request: MaintenanceRequest) => workflowService.requestMaintenance(request),
    onSuccess: () => {
      // Invalidate maintenance and room data
      queryClient.invalidateQueries({ queryKey: ['admin-rooms'] });
      queryClient.invalidateQueries({ queryKey: ['maintenance'] });
    },
  });
};

// Hook for room status updates
export const useUpdateRoomStatus = () => {
  const queryClient = useQueryClient();
  
  return useMutation({
    mutationFn: (request: RoomStatusUpdate) => workflowService.updateRoomStatus(request),
    onSuccess: () => {
      // Invalidate room data
      queryClient.invalidateQueries({ queryKey: ['admin-rooms'] });
      queryClient.invalidateQueries({ queryKey: ['room-metrics'] });
    },
  });
};

// Hook for getting workflow actions
export const useWorkflowActions = (filters?: {
  type?: string;
  status?: string;
  floorId?: number;
  dateFrom?: string;
  dateTo?: string;
}) => {
  return useQuery({
    queryKey: ['workflow-actions', filters],
    queryFn: () => workflowService.getWorkflowActions(filters),
    staleTime: 30 * 1000, // 30 seconds
  });
};

// Hook for floor analytics
export const useFloorAnalytics = (floorId: number, options?: { enabled?: boolean }) => {
  const { enabled = true } = options || {};
  return useQuery({
    queryKey: ['floor-analytics', floorId],
    queryFn: () => workflowService.getFloorAnalytics(floorId),
    enabled: enabled && !!floorId,
    staleTime: 5 * 60 * 1000, // 5 minutes
  });
};

// Hook for predictive analytics
export const usePredictiveAnalytics = (period: '7d' | '30d' | '90d' = '30d') => {
  return useQuery({
    queryKey: ['predictive-analytics', period],
    queryFn: () => workflowService.getPredictiveAnalytics(period),
    staleTime: 10 * 60 * 1000, // 10 minutes
  });
};
