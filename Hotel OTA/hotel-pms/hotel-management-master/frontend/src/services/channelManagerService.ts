import { api } from './api';

// Channel Types
export interface Channel {
  _id: string;
  channelId: string;
  name: string;
  type: 'ota' | 'gds' | 'direct' | 'metasearch' | 'wholesaler' | 'corporate';
  category: string;
  isActive: boolean;
  connectionStatus: 'connected' | 'disconnected' | 'error' | 'pending' | 'syncing';
  credentials: {
    apiKey?: string;
    apiSecret?: string;
    hotelId?: string;
    username?: string;
    password?: string;
    endpoint?: string;
    clientId?: string;
    accountId?: string;
  };
  settings: {
    autoSync: boolean;
    syncFrequency: number; // minutes
    enableRateSync: boolean;
    enableInventorySync: boolean;
    enableRestrictionSync: boolean;
    commission: number; // percentage
    currency: string;
    defaultLeadTime: number; // days
    maxLeadTime: number;
    minLengthOfStay: number;
    maxLengthOfStay: number;
  };
  roomMappings: Array<{
    hotelRoomTypeId: string;
    channelRoomTypeId: string;
    channelRoomTypeName: string;
    ratePlanMappings: Array<{
      hotelRatePlanId: string;
      channelRatePlanId: string;
      channelRatePlanName: string;
    }>;
  }>;
  rateParity: {
    enabled: boolean;
    variance: number; // percentage allowed variance
    baseChannel?: string;
  };
  restrictions: {
    closeToArrival: boolean;
    closeToDeparture: boolean;
    minAdvanceBooking: number;
    maxAdvanceBooking: number;
  };
  lastSync: {
    rates?: string;
    inventory?: string;
    restrictions?: string;
    reservations?: string;
  };
  metrics: {
    totalBookings: number;
    totalRevenue: number;
    averageRate: number;
    conversionRate: number;
  };
  createdAt: string;
  updatedAt: string;
}

export interface SyncLog {
  _id: string;
  syncId: string;
  channel: {
    _id: string;
    name: string;
    category: string;
  };
  roomType: {
    _id: string;
    name: string;
  };
  date: string;
  inventory: {
    available: number;
    sold: number;
    blocked: number;
    overbooking: number;
  };
  rates: {
    baseRate: number;
    sellingRate: number;
    currency: string;
  };
  restrictions: {
    closed: boolean;
    closeToArrival: boolean;
    closeToDeparture: boolean;
    minLengthOfStay: number;
    maxLengthOfStay: number;
  };
  syncStatus: 'pending' | 'success' | 'failed' | 'retry';
  syncAttempts: number;
  lastSyncAttempt?: string;
  errorMessage?: string;
  createdAt: string;
}

export interface ChannelPerformance {
  channel: string;
  date: string;
  metrics: {
    impressions: number;
    clicks: number;
    bookings: number;
    revenue: number;
    commission: number;
    netRevenue: number;
    averageRate: number;
    conversionRate: number;
    clickThroughRate: number;
  };
  roomTypeBreakdown: Array<{
    roomType: string;
    bookings: number;
    revenue: number;
    averageRate: number;
  }>;
}

export interface RateParityLog {
  _id: string;
  logId: string;
  roomType: {
    _id: string;
    name: string;
  };
  date: string;
  baseRate: number;
  channelRates: Array<{
    channel: {
      _id: string;
      name: string;
      category: string;
    };
    rate: number;
    variance: number; // percentage difference from base
    compliant: boolean;
  }>;
  violations: Array<{
    channel: {
      _id: string;
      name: string;
      category: string;
    };
    violationType: string;
    expectedRate: number;
    actualRate: number;
    variance: number;
  }>;
  overallCompliance: boolean;
  createdAt: string;
}

export interface ChannelMetrics {
  totalBookings: number;
  totalRevenue: number;
  averageCommission: number;
  conversionRate: number;
  responseTime: number;
  errorRate: number;
}

export interface DashboardStats {
  totalChannels: number;
  connectedChannels: number;
  connectionRate: number;
  todaysSyncs: number;
  syncSuccessRate: number;
  recentFailures: Array<{
    _id: string;
    channel: {
      name: string;
      category: string;
    };
    roomType: {
      name: string;
    };
    errorMessage: string;
    createdAt: string;
  }>;
}

export interface ChannelAnalytics {
  period: string;
  channels: Array<{
    _id: string;
    totalBookings: number;
    totalRevenue: number;
    totalCommission: number;
    avgConversionRate: number;
    avgClickThroughRate: number;
    channel: Array<Channel>;
  }>;
}

class ChannelManagerService {
  // Channel Management
  async getChannels(params?: { type?: string; isActive?: boolean }): Promise<{ success: boolean; data: Channel[] }> {
    try {
      const response = await api.get('/channel-manager/channels', { params });
      return response.data;
    } catch (error) {
      throw error;
    }
  }

  async getChannel(channelId: string): Promise<{ success: boolean; data: Channel }> {
    try {
      const response = await api.get(`/channel-manager/channels/${channelId}`);
      return response.data;
    } catch (error) {
      throw error;
    }
  }

  async createChannel(channelData: Partial<Channel>): Promise<{ success: boolean; data: Channel }> {
    try {
      const response = await api.post('/channel-manager/channels', channelData);
      return response.data;
    } catch (error) {
      throw error;
    }
  }

  async updateChannel(channelId: string, channelData: Partial<Channel>): Promise<{ success: boolean; data: Channel }> {
    try {
      const response = await api.put(`/channel-manager/channels/${channelId}`, channelData);
      return response.data;
    } catch (error) {
      throw error;
    }
  }

  async deleteChannel(channelId: string): Promise<{ success: boolean; message: string }> {
    try {
      const response = await api.delete(`/channel-manager/channels/${channelId}`);
      return response.data;
    } catch (error) {
      throw error;
    }
  }

  async testChannelConnection(channelId: string): Promise<{ success: boolean; data: unknown }> {
    try {
      const response = await api.post(`/channel-manager/channels/${channelId}/test-connection`);
      return response.data;
    } catch (error) {
      throw error;
    }
  }

  // Synchronization
  async syncToChannel(channelId: string, params: {
    roomTypeId?: string;
    startDate: string;
    endDate: string;
  }): Promise<{ success: boolean; data: unknown }> {
    try {
      const response = await api.post(`/channel-manager/sync/channel/${channelId}`, params);
      return response.data;
    } catch (error) {
      throw error;
    }
  }

  async syncToAllChannels(params: {
    roomTypeId?: string;
    startDate: string;
    endDate: string;
  }): Promise<{ success: boolean; data: unknown }> {
    try {
      const response = await api.post('/channel-manager/sync/all-channels', params);
      return response.data;
    } catch (error) {
      throw error;
    }
  }

  async getSyncHistory(params?: {
    channelId?: string;
    roomTypeId?: string;
    startDate?: string;
    endDate?: string;
    status?: string;
  }): Promise<{ success: boolean; data: SyncLog[] }> {
    try {
      const response = await api.get('/channel-manager/sync/history', { params });
      return response.data;
    } catch (error) {
      throw error;
    }
  }

  // Performance and Analytics
  async getChannelPerformance(channelId: string, params: {
    startDate: string;
    endDate: string;
  }): Promise<{ success: boolean; data: ChannelPerformance }> {
    try {
      const response = await api.get(`/channel-manager/performance/${channelId}`, { params });
      return response.data;
    } catch (error) {
      throw error;
    }
  }

  async getAllChannelsPerformance(params: {
    startDate: string;
    endDate: string;
  }): Promise<{ success: boolean; data: Array<{ channel: unknown; performance: ChannelPerformance }> }> {
    try {
      const response = await api.get('/channel-manager/performance', { params });
      return response.data;
    } catch (error) {
      throw error;
    }
  }

  // Rate Parity
  async monitorRateParity(params: {
    roomTypeId: string;
    startDate: string;
    endDate: string;
  }): Promise<{ success: boolean; data: unknown }> {
    try {
      const response = await api.post('/channel-manager/rate-parity/monitor', params);
      return response.data;
    } catch (error) {
      throw error;
    }
  }

  async getRateParityLogs(params?: {
    roomTypeId?: string;
    startDate?: string;
    endDate?: string;
    violationsOnly?: boolean;
  }): Promise<{ success: boolean; data: RateParityLog[] }> {
    try {
      const response = await api.get('/channel-manager/rate-parity/logs', { params });
      return response.data;
    } catch (error) {
      throw error;
    }
  }

  // Dashboard and Analytics
  async getDashboardStats(): Promise<{ success: boolean; data: DashboardStats }> {
    try {
      const response = await api.get('/channel-manager/dashboard/stats');
      return response.data;
    } catch (error) {
      throw error;
    }
  }

  async getChannelAnalytics(params?: {
    period?: '1d' | '7d' | '30d' | '90d';
  }): Promise<{ success: boolean; data: ChannelAnalytics }> {
    try {
      const response = await api.get('/channel-manager/analytics', { params });
      return response.data;
    } catch (error) {
      throw error;
    }
  }

  // Helper method to transform backend data to match frontend component expectations
  transformChannelData(backendChannels: Channel[]): Array<{
    id: string;
    name: string;
    type: string;
    logo: string;
    isActive: boolean;
    isConnected: boolean;
    connectionStatus: string;
    lastSync: Date;
    commission: number;
    bookings: number;
    revenue: number;
    availability: number;
    rateParity: boolean;
    autoSync: boolean;
    syncInterval: number;
    errorCount: number;
    settings: Record<string, unknown>;
  }> {
    return backendChannels.map(channel => ({
      id: channel._id,
      name: channel.name,
      type: channel.type,
      logo: `/logos/${channel.category.toLowerCase()}.png`, // Default logo path
      isActive: channel.isActive,
      isConnected: channel.connectionStatus === 'connected',
      connectionStatus: channel.connectionStatus,
      lastSync: new Date(channel.lastSync?.inventory || channel.updatedAt),
      commission: channel.settings.commission,
      bookings: channel.metrics.totalBookings,
      revenue: channel.metrics.totalRevenue,
      availability: 85, // This would need to be calculated from actual inventory
      rateParity: channel.rateParity.enabled,
      autoSync: channel.settings.autoSync,
      syncInterval: channel.settings.syncFrequency,
      errorCount: 0, // This would need to be calculated from sync logs
      settings: {
        roomMapping: channel.roomMappings.reduce((acc, mapping) => {
          acc[mapping.channelRoomTypeId] = mapping.hotelRoomTypeId;
          return acc;
        }, {} as { [key: string]: string }),
        rateMapping: {},
        inventoryPool: 'main',
        restrictions: []
      }
    }));
  }

  // Helper method to transform sync logs to match frontend expectations
  transformSyncLogs(backendLogs: SyncLog[]): Array<{
    id: string;
    channelId: string;
    channelName: string;
    type: string;
    status: string;
    message: string;
    timestamp: Date;
    details?: Record<string, unknown>;
  }> {
    return backendLogs.map(log => ({
      id: log._id,
      channelId: log.channel._id,
      channelName: log.channel.name,
      type: 'inventory', // Could be enhanced to detect type from sync data
      status: log.syncStatus === 'success' ? 'success' : log.syncStatus === 'failed' ? 'error' : 'warning',
      message: log.errorMessage || `${log.syncStatus === 'success' ? 'Successfully synced' : 'Failed to sync'} inventory for ${log.roomType.name}`,
      timestamp: new Date(log.createdAt),
      details: {
        inventory: log.inventory,
        rates: log.rates,
        restrictions: log.restrictions
      }
    }));
  }

  // Helper method to calculate aggregated metrics
  transformChannelMetrics(channels: Channel[], syncLogs: SyncLog[]): ChannelMetrics {
    const totalBookings = channels.reduce((sum, channel) => sum + channel.metrics.totalBookings, 0);
    const totalRevenue = channels.reduce((sum, channel) => sum + channel.metrics.totalRevenue, 0);
    const averageCommission = channels.length > 0
      ? channels.reduce((sum, channel) => sum + channel.settings.commission, 0) / channels.length
      : 0;
    const conversionRate = channels.length > 0
      ? channels.reduce((sum, channel) => sum + channel.metrics.conversionRate, 0) / channels.length
      : 0;

    const recentLogs = syncLogs.filter(log =>
      new Date(log.createdAt) > new Date(Date.now() - 24 * 60 * 60 * 1000)
    );
    const failedLogs = recentLogs.filter(log => log.syncStatus === 'failed');
    const errorRate = recentLogs.length > 0 ? (failedLogs.length / recentLogs.length) * 100 : 0;

    return {
      totalBookings,
      totalRevenue,
      averageCommission,
      conversionRate,
      responseTime: 850, // This would need to be measured from actual API calls
      errorRate
    };
  }
}

export const channelManagerService = new ChannelManagerService();
export default channelManagerService;