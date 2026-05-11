import React, { useState, useEffect } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Switch } from '@/components/ui/switch';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog';
import { toast } from '@/utils/toast';
import { channelManagerService, type Channel, type SyncLog, type ChannelMetrics } from '@/services/channelManagerService';
import {
  Globe,
  Wifi,
  WifiOff,
  RefreshCw,
  Settings,
  Plus,
  Edit,
  Trash2,
  Eye,
  AlertTriangle,
  CheckCircle,
  Clock,
  TrendingUp,
  TrendingDown,
  IndianRupee,
  Users,
  Calendar,
  Building,
  Smartphone,
  Monitor,
  Activity,
  Zap,
  AlertCircle,
  PlayCircle,
  PauseCircle
} from 'lucide-react';
import { formatCurrency } from '@/utils/currencyUtils';

// Use the Channel interface from the service
interface TransformedChannel {
  id: string;
  name: string;
  type: 'ota' | 'gds' | 'direct' | 'corporate' | 'wholesaler' | 'metasearch';
  logo: string;
  isActive: boolean;
  isConnected: boolean;
  connectionStatus: 'connected' | 'disconnected' | 'syncing' | 'error';
  lastSync: Date;
  commission: number;
  bookings: number;
  revenue: number;
  availability: number;
  rateParity: boolean;
  autoSync: boolean;
  syncInterval: number; // minutes
  errorCount: number;
  settings: {
    roomMapping: { [key: string]: string };
    rateMapping: { [key: string]: string };
    inventoryPool: string;
    restrictions: string[];
  };
}

// Use SyncLog and ChannelMetrics interfaces from the service
interface TransformedSyncLog {
  id: string;
  channelId: string;
  channelName: string;
  type: 'inventory' | 'rates' | 'bookings' | 'availability';
  status: 'success' | 'error' | 'warning';
  message: string;
  timestamp: Date;
  details?: unknown;
}

const ChannelDistributionHub: React.FC = () => {
  const [channels, setChannels] = useState<TransformedChannel[]>([]);
  const [syncLogs, setSyncLogs] = useState<TransformedSyncLog[]>([]);
  const [metrics, setMetrics] = useState<ChannelMetrics | null>(null);
  const [selectedChannel, setSelectedChannel] = useState<TransformedChannel | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [autoRefresh, setAutoRefresh] = useState(true);
  const [editDialogOpen, setEditDialogOpen] = useState(false);

  // Fetch channel data on mount and auto-refresh
  useEffect(() => {
    fetchChannelData();
    
    // Set up auto-refresh
    let interval: NodeJS.Timeout;
    if (autoRefresh) {
      interval = setInterval(fetchChannelData, 30000); // Every 30 seconds
    }
    
    return () => {
      if (interval) clearInterval(interval);
    };
  }, [autoRefresh]);

  const fetchChannelData = async () => {
    setIsLoading(true);
    try {
      // Fetch real data from API
      const [channelsResponse, syncLogsResponse] = await Promise.all([
        channelManagerService.getChannels(),
        channelManagerService.getSyncHistory()
      ]);

      if (channelsResponse.success && syncLogsResponse.success) {
        // Transform backend data to match frontend expectations
        const transformedChannels = channelManagerService.transformChannelData(channelsResponse.data);
        const transformedSyncLogs = channelManagerService.transformSyncLogs(syncLogsResponse.data);
        const calculatedMetrics = channelManagerService.transformChannelMetrics(channelsResponse.data, syncLogsResponse.data);

        setChannels(transformedChannels);
        setSyncLogs(transformedSyncLogs);
        setMetrics(calculatedMetrics);
      } else {
        throw new Error('Failed to fetch channel data');
      }
    } catch (error) {
      toast.error('Failed to load channel data');

      // Fallback to empty data instead of mock data
      setChannels([]);
      setSyncLogs([]);
      setMetrics({
        totalBookings: 0,
        totalRevenue: 0,
        averageCommission: 0,
        conversionRate: 0,
        responseTime: 0,
        errorRate: 0
      });
    } finally {
      setIsLoading(false);
    }
  };

  const toggleChannel = async (channelId: string, active: boolean) => {
    try {
      // Update channel status via API
      await channelManagerService.updateChannel(channelId, { isActive: active });

      setChannels(prev => prev.map(channel =>
        channel.id === channelId
          ? { ...channel, isActive: active, isConnected: active }
          : channel
      ));

      toast.success(`Channel ${active ? 'activated' : 'deactivated'} successfully`);
    } catch (error) {
      toast.error('Failed to update channel status');
    }
  };

  const syncChannel = async (channelId: string) => {
    try {
      setChannels(prev => prev.map(channel =>
        channel.id === channelId
          ? { ...channel, connectionStatus: 'syncing' }
          : channel
      ));

      // Calculate sync date range (last 7 days)
      const endDate = new Date();
      const startDate = new Date();
      startDate.setDate(startDate.getDate() - 7);

      // Sync channel with real API call
      await channelManagerService.syncToChannel(channelId, {
        startDate: startDate.toISOString().split('T')[0],
        endDate: endDate.toISOString().split('T')[0]
      });

      setChannels(prev => prev.map(channel =>
        channel.id === channelId
          ? {
              ...channel,
              connectionStatus: 'connected',
              lastSync: new Date(),
              errorCount: 0
            }
          : channel
      ));

      toast.success('Channel synchronized successfully');

      // Refresh data to show latest sync logs
      fetchChannelData();
    } catch (error) {
      setChannels(prev => prev.map(channel =>
        channel.id === channelId
          ? { ...channel, connectionStatus: 'error', errorCount: channel.errorCount + 1 }
          : channel
      ));
      toast.error('Channel synchronization failed');
    }
  };

  const getConnectionStatusIcon = (status: string, isActive: boolean) => {
    if (!isActive) return <PauseCircle className="w-4 h-4 text-gray-400" />;
    
    switch (status) {
      case 'connected': return <CheckCircle className="w-4 h-4 text-green-500" />;
      case 'syncing': return <RefreshCw className="w-4 h-4 text-blue-500 animate-spin" />;
      case 'error': return <AlertTriangle className="w-4 h-4 text-red-500" />;
      case 'disconnected': return <WifiOff className="w-4 h-4 text-red-500" />;
      default: return <Clock className="w-4 h-4 text-yellow-500" />;
    }
  };

  const getConnectionStatusColor = (status: string, isActive: boolean) => {
    if (!isActive) return 'bg-gray-100 text-gray-600';
    
    switch (status) {
      case 'connected': return 'bg-green-100 text-green-700';
      case 'syncing': return 'bg-blue-100 text-blue-700';
      case 'error': return 'bg-red-100 text-red-700';
      case 'disconnected': return 'bg-red-100 text-red-700';
      default: return 'bg-yellow-100 text-yellow-700';
    }
  };

  const getSyncStatusIcon = (status: string) => {
    switch (status) {
      case 'success': return <CheckCircle className="w-4 h-4 text-green-500" />;
      case 'error': return <AlertTriangle className="w-4 h-4 text-red-500" />;
      case 'warning': return <AlertCircle className="w-4 h-4 text-yellow-500" />;
      default: return <Clock className="w-4 h-4 text-gray-500" />;
    }
  };

  const getChannelIcon = (type: string) => {
    switch (type) {
      case 'ota': return <Globe className="w-4 h-4" />;
      case 'gds': return <Building className="w-4 h-4" />;
      case 'direct': return <Monitor className="w-4 h-4" />;
      case 'metasearch': return <Activity className="w-4 h-4" />;
      case 'corporate': return <Users className="w-4 h-4" />;
      case 'wholesaler': return <Smartphone className="w-4 h-4" />;
      default: return <Globe className="w-4 h-4" />;
    }
  };

  return (
    <div className="p-6 space-y-6">
      {/* Header */}
      <div className="flex justify-between items-center">
        <div>
          <h1 className="text-2xl font-bold">Channel Distribution Hub</h1>
          <p className="text-gray-600">Manage all your distribution channels from one centralized platform</p>
        </div>
        
        <div className="flex items-center gap-3">
          <div className="flex items-center gap-2">
            <Label htmlFor="auto-refresh">Auto Refresh</Label>
            <Switch
              id="auto-refresh"
              checked={autoRefresh}
              onCheckedChange={setAutoRefresh}
            />
          </div>
          
          <Button variant="outline" onClick={fetchChannelData} disabled={isLoading}>
            <RefreshCw className={`w-4 h-4 mr-2 ${isLoading ? 'animate-spin' : ''}`} />
            Refresh All
          </Button>
          
          <Button>
            <Plus className="w-4 h-4 mr-2" />
            Add Channel
          </Button>
        </div>
      </div>

      {/* Key Metrics */}
      {metrics && (
        <div className="grid grid-cols-6 gap-4">
          <Card>
            <CardContent className="p-4">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm text-gray-600">Total Bookings</p>
                  <p className="text-2xl font-bold">{metrics.totalBookings}</p>
                </div>
                <Calendar className="w-6 h-6 text-blue-500" />
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardContent className="p-4">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm text-gray-600">Total Revenue</p>
                  <p className="text-2xl font-bold">{formatCurrency(metrics.totalRevenue)}</p>
                </div>
                <IndianRupee className="w-6 h-6 text-green-500" />
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardContent className="p-4">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm text-gray-600">Avg Commission</p>
                  <p className="text-2xl font-bold">{metrics.averageCommission}%</p>
                </div>
                <TrendingDown className="w-6 h-6 text-orange-500" />
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardContent className="p-4">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm text-gray-600">Conversion Rate</p>
                  <p className="text-2xl font-bold">{metrics.conversionRate}%</p>
                </div>
                <TrendingUp className="w-6 h-6 text-purple-500" />
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardContent className="p-4">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm text-gray-600">Response Time</p>
                  <p className="text-2xl font-bold">{metrics.responseTime}ms</p>
                </div>
                <Zap className="w-6 h-6 text-cyan-500" />
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardContent className="p-4">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm text-gray-600">Error Rate</p>
                  <p className="text-2xl font-bold">{metrics.errorRate}%</p>
                </div>
                <AlertTriangle className="w-6 h-6 text-red-500" />
              </div>
            </CardContent>
          </Card>
        </div>
      )}

      <Tabs defaultValue="channels" className="space-y-4">
        <TabsList>
          <TabsTrigger value="channels">Channels Overview</TabsTrigger>
          <TabsTrigger value="sync-logs">Sync Logs</TabsTrigger>
          <TabsTrigger value="rate-parity">Rate Parity</TabsTrigger>
          <TabsTrigger value="analytics">Analytics</TabsTrigger>
        </TabsList>

        <TabsContent value="channels">
          <div className="grid grid-cols-1 lg:grid-cols-2 xl:grid-cols-3 gap-4">
            {channels.map(channel => (
              <Card key={channel.id} className={`relative ${!channel.isActive ? 'opacity-60' : ''}`}>
                <CardHeader className="pb-3">
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-3">
                      {getChannelIcon(channel.type)}
                      <div>
                        <CardTitle className="text-base">{channel.name}</CardTitle>
                        <p className="text-sm text-gray-500 capitalize">{channel.type}</p>
                      </div>
                    </div>
                    
                    <div className="flex items-center gap-2">
                      <Badge className={getConnectionStatusColor(channel.connectionStatus, channel.isActive)}>
                        <div className="flex items-center gap-1">
                          {getConnectionStatusIcon(channel.connectionStatus, channel.isActive)}
                          <span className="text-xs">
                            {!channel.isActive ? 'Inactive' : channel.connectionStatus}
                          </span>
                        </div>
                      </Badge>
                    </div>
                  </div>
                </CardHeader>
                
                <CardContent className="space-y-4">
                  {/* Channel Metrics */}
                  <div className="grid grid-cols-2 gap-3 text-sm">
                    <div>
                      <p className="text-gray-500">Bookings</p>
                      <p className="font-medium">{channel.bookings}</p>
                    </div>
                    <div>
                      <p className="text-gray-500">Revenue</p>
                      <p className="font-medium">{formatCurrency(channel.revenue)}</p>
                    </div>
                    <div>
                      <p className="text-gray-500">Commission</p>
                      <p className="font-medium">{channel.commission}%</p>
                    </div>
                    <div>
                      <p className="text-gray-500">Availability</p>
                      <p className="font-medium">{channel.availability}%</p>
                    </div>
                  </div>

                  {/* Rate Parity Warning */}
                  {!channel.rateParity && channel.isActive && (
                    <div className="p-2 bg-yellow-50 border border-yellow-200 rounded text-yellow-800 text-xs">
                      ⚠️ Rate parity violation detected
                    </div>
                  )}

                  {/* Error Count */}
                  {channel.errorCount > 0 && (
                    <div className="p-2 bg-red-50 border border-red-200 rounded text-red-800 text-xs">
                      🚨 {channel.errorCount} recent errors
                    </div>
                  )}

                  {/* Last Sync */}
                  <div className="text-xs text-gray-500">
                    Last sync: {channel.lastSync.toLocaleString()}
                  </div>

                  {/* Actions */}
                  <div className="flex items-center justify-between pt-2">
                    <div className="flex items-center gap-2">
                      <Switch
                        checked={channel.isActive}
                        onCheckedChange={(checked) => toggleChannel(channel.id, checked)}
                        size="sm"
                      />
                      <span className="text-xs text-gray-600">
                        {channel.isActive ? 'Active' : 'Inactive'}
                      </span>
                    </div>

                    <div className="flex gap-1">
                      {channel.isActive && (
                        <Button
                          size="sm"
                          variant="outline"
                          onClick={() => syncChannel(channel.id)}
                          disabled={channel.connectionStatus === 'syncing'}
                        >
                          <RefreshCw className={`w-3 h-3 ${channel.connectionStatus === 'syncing' ? 'animate-spin' : ''}`} />
                        </Button>
                      )}
                      
                      <Button
                        size="sm"
                        variant="outline"
                        onClick={() => {
                          setSelectedChannel(channel);
                          setEditDialogOpen(true);
                        }}
                      >
                        <Settings className="w-3 h-3" />
                      </Button>
                    </div>
                  </div>
                </CardContent>
              </Card>
            ))}
          </div>
        </TabsContent>

        <TabsContent value="sync-logs">
          <Card>
            <CardHeader>
              <CardTitle>Synchronization Logs</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="space-y-3">
                {syncLogs.map(log => (
                  <div key={log.id} className="flex items-start gap-3 p-3 border rounded-lg">
                    {getSyncStatusIcon(log.status)}
                    
                    <div className="flex-1">
                      <div className="flex items-center gap-2 mb-1">
                        <span className="font-medium">{log.channelName}</span>
                        <Badge variant="outline" className="text-xs">
                          {log.type}
                        </Badge>
                        <Badge className={
                          log.status === 'success' ? 'bg-green-100 text-green-700' :
                          log.status === 'error' ? 'bg-red-100 text-red-700' :
                          'bg-yellow-100 text-yellow-700'
                        }>
                          {log.status}
                        </Badge>
                      </div>
                      
                      <p className="text-sm text-gray-700">{log.message}</p>
                      <p className="text-xs text-gray-500 mt-1">
                        {log.timestamp.toLocaleString()}
                      </p>
                    </div>
                  </div>
                ))}
              </div>
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="rate-parity">
          <Card>
            <CardHeader>
              <CardTitle>Rate Parity Monitor</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="space-y-4">
                {channels.filter(c => c.isActive).map(channel => (
                  <div key={channel.id} className="flex items-center justify-between p-3 border rounded">
                    <div className="flex items-center gap-3">
                      {getChannelIcon(channel.type)}
                      <span className="font-medium">{channel.name}</span>
                    </div>
                    
                    <div className="flex items-center gap-3">
                      <div className={`px-2 py-1 rounded text-xs ${
                        channel.rateParity 
                          ? 'bg-green-100 text-green-700' 
                          : 'bg-red-100 text-red-700'
                      }`}>
                        {channel.rateParity ? 'In Parity' : 'Violation'}
                      </div>
                      
                      <Button size="sm" variant="outline">
                        <Eye className="w-3 h-3 mr-1" />
                        View Details
                      </Button>
                    </div>
                  </div>
                ))}
              </div>
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="analytics">
          <div className="space-y-6">
            <Card>
              <CardHeader>
                <CardTitle>Channel Performance Analytics</CardTitle>
              </CardHeader>
              <CardContent>
                <div className="grid grid-cols-2 gap-6">
                  <div>
                    <h4 className="font-medium mb-3">Revenue by Channel</h4>
                    <div className="space-y-2">
                      {channels.filter(c => c.revenue > 0).map(channel => (
                        <div key={channel.id} className="flex items-center justify-between">
                          <div className="flex items-center gap-2">
                            {getChannelIcon(channel.type)}
                            <span className="text-sm">{channel.name}</span>
                          </div>
                          <span className="font-medium">{formatCurrency(channel.revenue)}</span>
                        </div>
                      ))}
                    </div>
                  </div>
                  
                  <div>
                    <h4 className="font-medium mb-3">Commission Analysis</h4>
                    <div className="space-y-2">
                      {channels.filter(c => c.commission > 0).map(channel => (
                        <div key={channel.id} className="flex items-center justify-between">
                          <div className="flex items-center gap-2">
                            {getChannelIcon(channel.type)}
                            <span className="text-sm">{channel.name}</span>
                          </div>
                          <div className="text-right">
                            <div className="font-medium">{channel.commission}%</div>
                            <div className="text-xs text-gray-500">
                              {formatCurrency(channel.revenue * channel.commission / 100)}
                            </div>
                          </div>
                        </div>
                      ))}
                    </div>
                  </div>
                </div>
              </CardContent>
            </Card>
          </div>
        </TabsContent>
      </Tabs>

      {/* Channel Settings Dialog */}
      <Dialog open={editDialogOpen} onOpenChange={setEditDialogOpen}>
        <DialogContent className="max-w-2xl">
          <DialogHeader>
            <DialogTitle>
              {selectedChannel && `${selectedChannel.name} Settings`}
            </DialogTitle>
            <DialogDescription>
              Configure channel-specific settings and mappings
            </DialogDescription>
          </DialogHeader>
          
          {selectedChannel && (
            <div className="space-y-6">
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <Label>Commission Rate (%)</Label>
                  <Input
                    type="number"
                    value={selectedChannel.commission}
                    onChange={(e) => {
                      const updated = { ...selectedChannel, commission: parseFloat(e.target.value) };
                      setSelectedChannel(updated);
                    }}
                  />
                </div>
                <div>
                  <Label>Sync Interval (minutes)</Label>
                  <Input
                    type="number"
                    value={selectedChannel.syncInterval}
                    onChange={(e) => {
                      const updated = { ...selectedChannel, syncInterval: parseInt(e.target.value) };
                      setSelectedChannel(updated);
                    }}
                  />
                </div>
              </div>

              <div className="flex items-center gap-2">
                <Switch
                  checked={selectedChannel.autoSync}
                  onCheckedChange={(checked) => {
                    const updated = { ...selectedChannel, autoSync: checked };
                    setSelectedChannel(updated);
                  }}
                />
                <Label>Enable Auto Sync</Label>
              </div>

              <div>
                <Label>Inventory Pool</Label>
                <Select
                  value={selectedChannel.settings.inventoryPool}
                  onValueChange={(value) => {
                    const updated = {
                      ...selectedChannel,
                      settings: { ...selectedChannel.settings, inventoryPool: value }
                    };
                    setSelectedChannel(updated);
                  }}
                >
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="main">Main Pool</SelectItem>
                    <SelectItem value="ota">OTA Pool</SelectItem>
                    <SelectItem value="gds">GDS Pool</SelectItem>
                    <SelectItem value="direct">Direct Pool</SelectItem>
                  </SelectContent>
                </Select>
              </div>

              <div className="flex gap-3 pt-4">
                <Button
                  onClick={async () => {
                    try {
                      await channelManagerService.updateChannel(selectedChannel.id, {
                        commission: selectedChannel.commission,
                        syncInterval: selectedChannel.syncInterval,
                        autoSync: selectedChannel.autoSync,
                        settings: selectedChannel.settings,
                      });
                      setChannels(prev => prev.map(c =>
                        c.id === selectedChannel.id ? selectedChannel : c
                      ));
                      setEditDialogOpen(false);
                      toast.success('Channel settings updated');
                    } catch (error) {
                      toast.error('Failed to save channel settings');
                    }
                  }}
                >
                  Save Changes
                </Button>
                <Button variant="outline" onClick={() => setEditDialogOpen(false)}>
                  Cancel
                </Button>
              </div>
            </div>
          )}
        </DialogContent>
      </Dialog>
    </div>
  );
};

export default ChannelDistributionHub;