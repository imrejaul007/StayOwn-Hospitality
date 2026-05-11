import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { api, propertyGroupsApi } from '../services/api';
import { useToast } from '../components/ui/use-toast';

// Query keys for better cache management
export const QUERY_KEYS = {
  properties: ['properties'] as const,
  propertyGroups: ['property-groups'] as const,
  propertyGroupsPaginated: (page: number, limit: number, filters?: Record<string, unknown>) =>
    ['property-groups', 'paginated', page, limit, filters] as const,
  propertyGroup: (id: string) => ['property-groups', id] as const,
  hotelMetrics: ['hotel-metrics'] as const,
} as const;

// Transform hotel data to property format with real metrics
const transformHotelToProperty = async (hotel: Record<string, unknown>) => {
  const hotelIdStr = hotel._id != null ? String(hotel._id) : '';
  const realMetrics = await fetchHotelMetrics(hotelIdStr);

  return {
    id: hotelIdStr,
    name: hotel.name || 'Unknown Hotel',
    brand: hotel.brand || 'Independent',
    type: hotel.type || 'hotel',
    location: {
      address: hotel.address?.street || 'Address not provided',
      city: hotel.address?.city || 'Unknown City',
      country: hotel.address?.country || 'Unknown Country',
      coordinates: {
        lat: hotel.address?.coordinates?.latitude || 0,
        lng: hotel.address?.coordinates?.longitude || 0
      }
    },
    contact: {
      phone: hotel.contact?.phone || 'N/A',
      email: hotel.contact?.email || 'N/A',
      manager: hotel.contact?.manager || hotel.ownerId?.name || 'Not assigned'
    },
    rooms: {
      total: realMetrics.totalRooms || hotel.roomCount || 0,
      occupied: realMetrics.occupiedRooms || 0,
      available: realMetrics.availableRooms || (realMetrics.totalRooms || hotel.roomCount || 0),
      outOfOrder: realMetrics.oooRooms || 0
    },
    performance: {
      occupancyRate: realMetrics.occupancyRate || 0,
      adr: realMetrics.averageDailyRate || 0,
      revpar: realMetrics.revenuePerAvailableRoom || 0,
      revenue: realMetrics.totalRevenue || 0,
      lastMonth: {
        occupancyRate: realMetrics.lastMonth?.occupancyRate || 0,
        adr: realMetrics.lastMonth?.averageDailyRate || 0,
        revpar: realMetrics.lastMonth?.revenuePerAvailableRoom || 0,
        revenue: realMetrics.lastMonth?.totalRevenue || 0
      }
    },
    amenities: hotel.amenities || [],
    rating: typeof hotel.rating === 'number' && !Number.isNaN(hotel.rating) ? hotel.rating : 0,
    status: hotel.isActive ? 'active' : 'inactive',
    features: {
      pms: true,
      pos: hotel.features?.pos || false,
      spa: hotel.features?.spa || false,
      restaurant: hotel.features?.restaurant || false,
      parking: hotel.features?.parking || false,
      wifi: true,
      fitness: hotel.features?.fitness || false,
      pool: hotel.features?.pool || false
    },
    operationalHours: {
      checkIn: hotel.policies?.checkInTime || '15:00',
      checkOut: hotel.policies?.checkOutTime || '11:00',
      frontDesk: '24/7'
    },
    originalHotel: hotel // Store original hotel data for editing
  };
};

const emptyHotelMetrics = {
  occupiedRooms: 0,
  availableRooms: 0,
  oooRooms: 0,
  totalRooms: 0,
  occupancyRate: 0,
  averageDailyRate: 0,
  revenuePerAvailableRoom: 0,
  totalRevenue: 0,
  lastMonth: {
    occupancyRate: 0,
    averageDailyRate: 0,
    revenuePerAvailableRoom: 0,
    totalRevenue: 0,
  },
};

/** Occupancy + revenue APIs — no hardcoded ADR/RevPAR (those caused identical cards across hotels). */
const fetchHotelMetrics = async (hotelId: string) => {
  const hid = (hotelId || '').trim();
  if (!hid || hid === 'undefined' || hid === 'null') {
    return emptyHotelMetrics;
  }
  try {
    const [occRes, revRes] = await Promise.all([
      api.get(`/admin-dashboard/occupancy?hotelId=${encodeURIComponent(hid)}`),
      api.get(`/admin-dashboard/revenue?hotelId=${encodeURIComponent(hid)}&period=month`).catch(() => null),
    ]);

    const data = occRes.data?.data;
    const ov = data?.overallMetrics;
    const revPayload = revRes?.data?.data;
    const overview = revPayload?.overview;
    const charts = revPayload?.charts;
    const comparison = revPayload?.insights?.revenueComparison;

    if (!ov) {
      const analyticsResponse = await api.get(`/analytics/hotel/${hid}/metrics`).catch(() => null);
      const alt = analyticsResponse?.data?.data;
      if (alt && typeof alt === 'object') {
        return { ...emptyHotelMetrics, ...alt };
      }
      return emptyHotelMetrics;
    }

    const totalRooms = ov.totalRooms || 0;
    const occupiedRooms = ov.occupiedRooms || 0;
    const availableRooms = ov.availableRooms || 0;
    const maintenanceRooms = ov.maintenanceRooms || 0;
    const outOfOrderRooms = ov.outOfOrderRooms || 0;
    const occupancyRate =
      typeof ov.occupancyRate === 'number'
        ? ov.occupancyRate
        : totalRooms > 0
          ? Math.round((occupiedRooms / totalRooms) * 100)
          : 0;

    const roomRevenue = overview?.roomRevenue ?? 0;
    const totalRevenue = overview?.totalRevenue ?? 0;
    const period = overview?.period as { start?: string; end?: string } | undefined;
    let days = 30;
    if (period?.start && period?.end) {
      const a = new Date(period.start).getTime();
      const b = new Date(period.end).getTime();
      days = Math.max(1, Math.ceil((b - a) / 86400000));
    }

    const totalNights =
      charts?.revenueByRoomType?.reduce(
        (s: number, t: { totalNights?: number }) => s + (t.totalNights || 0),
        0
      ) ?? 0;
    const adr = totalNights > 0 ? Math.round(roomRevenue / totalNights) : 0;
    const revpar =
      totalRooms > 0 && days > 0 ? Math.round(totalRevenue / (totalRooms * days)) : 0;

    const prevRevenue = typeof comparison?.previous === 'number' ? comparison.previous : 0;

    return {
      occupiedRooms,
      availableRooms,
      oooRooms: outOfOrderRooms + maintenanceRooms,
      totalRooms,
      occupancyRate,
      averageDailyRate: adr,
      revenuePerAvailableRoom: revpar,
      totalRevenue,
      lastMonth: {
        occupancyRate: 0,
        averageDailyRate: 0,
        revenuePerAvailableRoom: 0,
        totalRevenue: prevRevenue,
      },
    };
  } catch {
    return emptyHotelMetrics;
  }
};

// Properties hooks
export const useProperties = () => {
  return useQuery({
    queryKey: QUERY_KEYS.properties,
    queryFn: async () => {
      const response = await api.get('/admin/hotels');
      const hotels = response.data.data?.hotels || [];

      // Transform each hotel to property format with real metrics (async)
      const properties = await Promise.all(
        hotels.map(async (hotel: Record<string, unknown>, index: number) => {

          const property = await transformHotelToProperty(hotel);
          return property;
        })
      );

      const totalRooms = properties.reduce((sum, p) => sum + (p.rooms?.total || 0), 0);

      return properties;
    },
    staleTime: 2 * 60 * 1000,  // 2 minutes
    cacheTime: 5 * 60 * 1000,  // 5 minutes
  });
};

// Transform property group data to match frontend interface
const transformPropertyGroup = (group: Record<string, unknown>) => {
  return {
    id: group._id,
    _id: group._id, // Keep original _id for API calls
    name: group.name || 'Unnamed Group',
    description: group.description || '',
    properties: group.properties || [],
    manager: group.manager || 'Not assigned',
    budget: group.budget || 0,
    groupType: group.groupType,
    isActive: group.status === 'active',
    status: group.status,
    createdAt: group.createdAt,
    updatedAt: group.updatedAt,
    performance: {
      totalRevenue: group.metrics?.totalRevenue || 0,
      avgOccupancy: group.metrics?.averageOccupancyRate || 0,
      avgADR: group.metrics?.totalRevenue && group.metrics?.totalRooms
        ? Math.floor(group.metrics.totalRevenue / group.metrics.totalRooms)
        : 0,
      totalRooms: group.metrics?.totalRooms || 0,
    },
    metrics: group.metrics || {
      totalProperties: 0,
      totalRooms: 0,
      averageOccupancyRate: 0,
      totalRevenue: 0,
      activeUsers: 0
    }
  };
};

// Property Groups hooks
export const usePropertyGroups = (options?: {
  page?: number;
  limit?: number;
  status?: string;
  search?: string;
}) => {
  const { page = 1, limit = 20, status, search } = options || {};

  return useQuery({
    queryKey: QUERY_KEYS.propertyGroupsPaginated(page, limit, { status, search }),
    queryFn: async () => {
      const params = {
        page,
        limit,
        ...(status !== 'all' && status && { status }),
        ...(search && { search }),
      };

      const response = await propertyGroupsApi.getGroups(params);

      // Transform the data to match frontend expectations
      const transformedData = {
        ...response.data,
        data: response.data.data?.map(transformPropertyGroup) || []
      };

      return transformedData;
    },
    staleTime: 2 * 60 * 1000, // 2 minutes
    keepPreviousData: true, // Keep previous data while loading new page
  });
};

export const usePropertyGroup = (id: string, enabled = true) => {
  return useQuery({
    queryKey: QUERY_KEYS.propertyGroup(id),
    queryFn: async () => {
      const response = await propertyGroupsApi.getGroupById(id);
      return response.data.data;
    },
    enabled: !!id && enabled,
    staleTime: 5 * 60 * 1000, // 5 minutes
  });
};

// Mutations with optimistic updates
export const useCreatePropertyGroup = () => {
  const queryClient = useQueryClient();
  const { toast } = useToast();

  return useMutation({
    mutationFn: async (groupData: Record<string, unknown>) => {
      const response = await propertyGroupsApi.createGroup(groupData);
      return response.data;
    },
    onSuccess: () => {
      // Invalidate and refetch property groups
      queryClient.invalidateQueries({ queryKey: QUERY_KEYS.propertyGroups });
      toast({
        title: "Success",
        description: "Property group created successfully"
      });
    },
    onError: (error: unknown) => {
      const err = error as { response?: { data?: { message?: string } } };
      toast({
        variant: "destructive",
        title: "Error",
        description: err.response?.data?.message || "Failed to create property group"
      });
    },
  });
};

export const useUpdatePropertyGroup = () => {
  const queryClient = useQueryClient();
  const { toast } = useToast();

  return useMutation({
    mutationFn: async ({ id, data }: { id: string; data: Record<string, unknown> }) => {
      const response = await propertyGroupsApi.updateGroup(id, data);
      return response.data;
    },
    onSuccess: (_, variables) => {
      // Update the cache for the specific group
      queryClient.invalidateQueries({ queryKey: QUERY_KEYS.propertyGroup(variables.id) });
      // Invalidate the groups list to refetch
      queryClient.invalidateQueries({ queryKey: QUERY_KEYS.propertyGroups });
      toast({
        title: "Success",
        description: "Property group updated successfully"
      });
    },
    onError: (error: unknown) => {
      const err = error as { response?: { data?: { message?: string } } };
      toast({
        variant: "destructive",
        title: "Error",
        description: err.response?.data?.message || "Failed to update property group"
      });
    },
  });
};

export const useDeletePropertyGroup = () => {
  const queryClient = useQueryClient();
  const { toast } = useToast();

  return useMutation({
    mutationFn: async (id: string) => {
      await propertyGroupsApi.deleteGroup(id);
      return id;
    },
    onSuccess: (deletedId) => {
      // Remove from cache
      queryClient.removeQueries({ queryKey: QUERY_KEYS.propertyGroup(deletedId) });
      // Invalidate the groups list
      queryClient.invalidateQueries({ queryKey: QUERY_KEYS.propertyGroups });
      toast({
        title: "Success",
        description: "Property group deleted successfully"
      });
    },
    onError: (error: unknown) => {
      const err = error as { response?: { data?: { message?: string } } };
      toast({
        variant: "destructive",
        title: "Error",
        description: err.response?.data?.message || "Failed to delete property group"
      });
    },
  });
};

export const useSyncGroupSettings = () => {
  const queryClient = useQueryClient();
  const { toast } = useToast();

  return useMutation({
    mutationFn: async (id: string) => {
      const response = await propertyGroupsApi.syncGroupSettings(id);
      return response.data;
    },
    onSuccess: (_, groupId) => {
      // Invalidate related queries
      queryClient.invalidateQueries({ queryKey: QUERY_KEYS.propertyGroup(groupId) });
      queryClient.invalidateQueries({ queryKey: QUERY_KEYS.propertyGroups });
      toast({
        title: "Success",
        description: "Group settings synced successfully"
      });
    },
    onError: (error: unknown) => {
      const err = error as { response?: { data?: { message?: string } } };
      toast({
        variant: "destructive",
        title: "Error",
        description: err.response?.data?.message || "Failed to sync group settings"
      });
    },
  });
};

export const useAddPropertiesToGroup = () => {
  const queryClient = useQueryClient();
  const { toast } = useToast();

  return useMutation({
    mutationFn: async ({ groupId, propertyIds }: { groupId: string; propertyIds: string[] }) => {
      const response = await propertyGroupsApi.addPropertiesToGroup(groupId, { propertyIds });
      return response.data;
    },
    onSuccess: (_, variables) => {
      // Invalidate related queries
      queryClient.invalidateQueries({ queryKey: QUERY_KEYS.propertyGroup(variables.groupId) });
      queryClient.invalidateQueries({ queryKey: QUERY_KEYS.propertyGroups });
      queryClient.invalidateQueries({ queryKey: QUERY_KEYS.properties });
      toast({
        title: "Success",
        description: `Added ${variables.propertyIds.length} property(ies) to group successfully`
      });
    },
    onError: (error: unknown) => {
      const err = error as { response?: { data?: { message?: string } } };
      toast({
        variant: "destructive",
        title: "Error",
        description: err.response?.data?.message || "Failed to add properties to group"
      });
    },
  });
};

export const useRemovePropertiesFromGroup = () => {
  const queryClient = useQueryClient();
  const { toast } = useToast();

  return useMutation({
    mutationFn: async ({ groupId, propertyIds }: { groupId: string; propertyIds: string[] }) => {
      const response = await propertyGroupsApi.removePropertiesFromGroup(groupId, { propertyIds });
      return response.data;
    },
    onSuccess: (_, variables) => {
      // Invalidate related queries
      queryClient.invalidateQueries({ queryKey: QUERY_KEYS.propertyGroup(variables.groupId) });
      queryClient.invalidateQueries({ queryKey: QUERY_KEYS.propertyGroups });
      queryClient.invalidateQueries({ queryKey: QUERY_KEYS.properties });
      toast({
        title: "Success",
        description: `Removed ${variables.propertyIds.length} property(ies) from group successfully`
      });
    },
    onError: (error: unknown) => {
      const err = error as { response?: { data?: { message?: string } } };
      toast({
        variant: "destructive",
        title: "Error",
        description: err.response?.data?.message || "Failed to remove properties from group"
      });
    },
  });
};

// Utility hook for prefetching data
export const usePrefetchPropertyGroup = () => {
  const queryClient = useQueryClient();

  return (id: string) => {
    queryClient.prefetchQuery({
      queryKey: QUERY_KEYS.propertyGroup(id),
      queryFn: async () => {
        const response = await propertyGroupsApi.getGroupById(id);
        return response.data.data;
      },
      staleTime: 5 * 60 * 1000,
    });
  };
};