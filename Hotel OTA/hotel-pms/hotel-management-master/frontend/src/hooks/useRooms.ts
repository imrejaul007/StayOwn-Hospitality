import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { roomsService, Room, RoomMetrics, RoomsResponse } from '../services/roomsService';

// Query keys
export const roomsKeys = {
  all: ['rooms'] as const,
  lists: () => [...roomsKeys.all, 'list'] as const,
  list: (filters: Record<string, unknown>) => [...roomsKeys.lists(), filters] as const,
  details: () => [...roomsKeys.all, 'detail'] as const,
  detail: (id: string) => [...roomsKeys.details(), id] as const,
  metrics: (hotelId: string) => [...roomsKeys.all, 'metrics', hotelId] as const,
} as const;

// Hooks
export const useRooms = (params?: {
  hotelId?: string;
  page?: number;
  limit?: number;
  type?: string;
  status?: string;
  floor?: number;
  enabled?: boolean;
  refetchInterval?: number | false;
  staleTime?: number;
}) => {
  const { enabled = true, refetchInterval, staleTime = 2 * 60 * 1000, ...filters } = params || {};
  
  return useQuery({
    queryKey: roomsKeys.list(filters),
    queryFn: () => roomsService.getRooms(filters),
    enabled: enabled && !!filters.hotelId,
    refetchInterval,
    staleTime,
  });
};

export const useAdminRooms = (params?: {
  hotelId?: string;
  page?: number;
  limit?: number;
  type?: string;
  status?: string;
  floor?: number;
  enabled?: boolean;
  refetchInterval?: number | false;
  staleTime?: number;
}) => {
  const { enabled = true, refetchInterval, staleTime = 15 * 1000, ...filters } = params || {};
  
  return useQuery({
    queryKey: [...roomsKeys.list(filters), 'admin'],
    queryFn: () => roomsService.getAdminRooms(filters),
    enabled: enabled && !!filters.hotelId,
    refetchInterval,
    staleTime,
  });
};

export const useRoom = (id: string, options?: { enabled?: boolean }) => {
  return useQuery({
    queryKey: roomsKeys.detail(id),
    queryFn: () => roomsService.getRoomById(id),
    enabled: (options?.enabled ?? true) && !!id,
    staleTime: 5 * 60 * 1000, // 5 minutes
  });
};

export const useRoomMetrics = (hotelId: string, options?: { enabled?: boolean; refetchInterval?: number | false }) => {
  const { enabled = true, refetchInterval = 30000 } = options || {};
  
  return useQuery({
    queryKey: roomsKeys.metrics(hotelId),
    queryFn: () => roomsService.getRoomMetrics(hotelId),
    enabled: enabled && !!hotelId,
    refetchInterval,
    staleTime: 15000, // Consider stale after 15 seconds
  });
};

// Mutations
export const useUpdateRoom = () => {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: ({ id, updates }: { id: string; updates: Partial<Room> }) =>
      roomsService.updateRoom(id, updates),
    onSuccess: (data) => {
      // Update the room detail cache
      queryClient.setQueryData(roomsKeys.detail(data._id), data);
      // Invalidate rooms list to refetch
      queryClient.invalidateQueries({ queryKey: roomsKeys.lists() });
      // Invalidate metrics to refetch
      queryClient.invalidateQueries({ queryKey: roomsKeys.metrics(data.hotelId) });
    },
  });
};

export const useUpdateRoomStatus = () => {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: ({ id, status, maintenanceNotes }: { id: string; status: Room['status']; maintenanceNotes?: string }) =>
      roomsService.updateRoom(id, { status, ...(maintenanceNotes ? { maintenanceNotes } : {}) } as Partial<Room>),
    onSuccess: (data) => {
      const room = (data as { room?: Room })?.room || data;
      const roomId = (room as Room)?._id;
      const hotelId = (room as Room)?.hotelId;
      // Update the room detail cache
      if (roomId) queryClient.setQueryData(roomsKeys.detail(roomId), data);
      // Invalidate rooms list to refetch
      queryClient.invalidateQueries({ queryKey: roomsKeys.lists() });
      // Invalidate metrics to refetch
      if (hotelId) queryClient.invalidateQueries({ queryKey: roomsKeys.metrics(hotelId) });
    },
  });
};

export const useBulkUpdateStatus = () => {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: ({ roomIds, status }: { roomIds: string[]; status: Room['status'] }) =>
      roomsService.bulkUpdateStatus(roomIds, status),
    onSuccess: (data) => {
      // Invalidate all room-related queries
      queryClient.invalidateQueries({ queryKey: roomsKeys.all });
    },
  });
};

// Hook to get bookings for a specific room
export const useRoomBookings = (roomId: string, params?: {
  status?: string;
  timeFilter?: 'past' | 'future' | 'current' | 'all';
  page?: number;
  limit?: number;
  enabled?: boolean;
}) => {
  const { enabled = true, ...filters } = params || {};
  
  return useQuery({
    queryKey: ['room-bookings', roomId, filters],
    queryFn: async () => {
      const { bookingService } = await import('../services/bookingService');
      return bookingService.getRoomBookings(roomId, filters);
    },
    enabled: enabled && !!roomId,
    staleTime: 2 * 60 * 1000, // 2 minutes
  });
};