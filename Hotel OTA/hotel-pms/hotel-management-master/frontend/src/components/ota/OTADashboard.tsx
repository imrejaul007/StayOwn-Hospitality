import React, { useState, useEffect } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { DateRangePicker } from '@/components/ui/DateRangePicker';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { MetricCard } from '@/components/dashboard/MetricCard';
import { ChartCard } from '@/components/dashboard/ChartCard';
import { RefreshButton } from '@/components/dashboard/RefreshButton';
import { ExportButton } from '@/components/dashboard/ExportButton';
import { toast } from '@/utils/toast';
import { useAuth } from '@/context/AuthContext';
import { useProperty } from '@/context/PropertyContext';
import { api } from '@/services/api';
import {
  TrendingUp,
  IndianRupee,
  Calendar,
  Globe,
  Target,
  AlertTriangle,
  CheckCircle,
  WifiOff,
  Loader2,
  RefreshCw,
  Settings,
  Info,
} from 'lucide-react';
import { format, subDays, startOfDay, endOfDay } from 'date-fns';
import { withErrorBoundary } from '../ErrorBoundary';

interface OTAStats {
  totalSyncs: number;
  successfulSyncs: number;
  failedSyncs: number;
  lastSync: string | null;
  averageSyncTime: number;
  providersActive: number;
  totalProviders: number;
  roomsSynced: number;
  bookingsReceived: {
    today: number;
    thisWeek: number;
    thisMonth: number;
  };
  syncFrequency: Record<string, string>;
}

interface OTADashboardProps {
  onConfigure?: () => void;
}

const OTADashboard: React.FC<OTADashboardProps> = ({ onConfigure }) => {
  const { user } = useAuth();
  const { selectedPropertyId } = useProperty();
  const hotelId = selectedPropertyId || (typeof user?.hotelId === 'string' ? user.hotelId : '') || '';

  // State
  const [dateRange, setDateRange] = useState({
    from: startOfDay(subDays(new Date(), 30)),
    to: endOfDay(new Date())
  });
  const [activeTab, setActiveTab] = useState('overview');
  const [loading, setLoading] = useState(true);
  const [otaStats, setOtaStats] = useState<OTAStats | null>(null);
  const [hasNoData, setHasNoData] = useState(false);
  const [refreshing, setRefreshing] = useState(false);

  // Load dashboard data
  useEffect(() => {
    if (!hotelId) {
      setLoading(false);
      setHasNoData(true);
      return;
    }

    let cancelled = false;

    const loadData = async () => {
      try {
        setLoading(true);
        setHasNoData(false);

        const response = await api.get(`/ota/stats/${hotelId}`);
        if (cancelled) return;

        const stats: OTAStats = response.data?.data?.stats;
        if (!stats || stats.providersActive === 0) {
          setHasNoData(true);
          setOtaStats(null);
        } else {
          setOtaStats(stats);
        }
      } catch (error: unknown) {
        if (cancelled) return;
        const status = (error as { response?: { status?: number } })?.response?.status;
        if (status === 404 || status === 503) {
          setHasNoData(true);
        } else {
          toast.error('Failed to load OTA dashboard data');
          setHasNoData(true);
        }
      } finally {
        if (!cancelled) {
          setLoading(false);
        }
      }
    };

    loadData();

    return () => { cancelled = true; };
  }, [dateRange, hotelId]);

  const handleRefresh = () => {
    // Trigger re-fetch by toggling dateRange (forces useEffect re-run)
    setRefreshing(true);
    setDateRange(prev => ({ ...prev, to: endOfDay(new Date()) }));
    setTimeout(() => setRefreshing(false), 1000);
  };

  const handleExportData = () => {
    toast.success('Exporting OTA analytics data...');
  };

  const getProviderStatusIcon = (frequency: string) => {
    if (frequency === 'disabled') {
      return <WifiOff className="w-4 h-4 text-gray-500" />;
    }
    return <CheckCircle className="w-4 h-4 text-green-500" />;
  };

  const formatNumber = (num: number) => {
    return new Intl.NumberFormat('en-IN').format(num);
  };

  if (loading && !otaStats) {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <div className="text-center">
          <Loader2 className="w-8 h-8 animate-spin mx-auto mb-4" />
          <p className="text-gray-600">Loading OTA dashboard...</p>
        </div>
      </div>
    );
  }

  if (hasNoData || !otaStats) {
    return (
      <div className="space-y-6 p-6">
        <div>
          <h1 className="text-2xl lg:text-3xl font-bold text-gray-900">OTA Analytics Dashboard</h1>
          <p className="text-gray-600">Monitor and optimize your online travel agency performance</p>
        </div>
        <Card>
          <CardContent className="flex flex-col items-center justify-center py-16">
            <Globe className="w-16 h-16 text-gray-300 mb-4" />
            <h3 className="text-lg font-semibold text-gray-700 mb-2">No OTA Channels Connected</h3>
            <p className="text-gray-500 text-center max-w-md mb-6">
              Connect your OTA channels to see performance data. Configure Booking.com, Expedia, or Airbnb integrations to start tracking bookings and revenue from online travel agencies.
            </p>
            <Button variant="outline" onClick={onConfigure}>
              <Settings className="w-4 h-4 mr-2" />
              Configure OTA Channels
            </Button>
          </CardContent>
        </Card>
      </div>
    );
  }

  const providerNames: Record<string, string> = {
    bookingCom: 'Booking.com',
    expedia: 'Expedia',
    airbnb: 'Airbnb',
  };

  return (
    <div className="space-y-6 p-6">
      {/* Header */}
      <div className="flex flex-col lg:flex-row lg:items-center lg:justify-between gap-4">
        <div>
          <h1 className="text-2xl lg:text-3xl font-bold text-gray-900">OTA Analytics Dashboard</h1>
          <p className="text-gray-600">Monitor and optimize your online travel agency performance</p>
        </div>

        <div className="flex items-center gap-2">
          <DateRangePicker
            value={dateRange}
            onChange={setDateRange}
            maxDate={new Date()}
          />
          <RefreshButton
            onRefresh={handleRefresh}
            loading={refreshing}
          />
          <ExportButton
            onExport={handleExportData}
            filename={`ota-analytics-${format(new Date(), 'yyyy-MM-dd')}.csv`}
          />
        </div>
      </div>

      {/* Key Metrics */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4 lg:gap-6">
        <MetricCard
          title="Active Providers"
          value={`${otaStats.providersActive}/${otaStats.totalProviders}`}
          icon={<Globe className="w-5 h-5" />}
          color="orange"
          loading={loading}
        />

        <MetricCard
          title="Bookings This Month"
          value={otaStats.bookingsReceived.thisMonth}
          type="number"
          icon={<Calendar className="w-5 h-5" />}
          color="blue"
          loading={loading}
        />

        <MetricCard
          title="Total Syncs"
          value={otaStats.totalSyncs}
          type="number"
          icon={<RefreshCw className="w-5 h-5" />}
          color="green"
          loading={loading}
        />

        <MetricCard
          title="Sync Success Rate"
          value={otaStats.totalSyncs > 0 ? Math.round((otaStats.successfulSyncs / otaStats.totalSyncs) * 100) : 0}
          type="percentage"
          suffix="%"
          icon={<Target className="w-5 h-5" />}
          color="purple"
          loading={loading}
        />
      </div>

      {/* Main Dashboard Tabs */}
      <Tabs value={activeTab} onValueChange={setActiveTab} className="space-y-6">
        <TabsList className="grid w-full grid-cols-2">
          <TabsTrigger value="overview">Overview</TabsTrigger>
          <TabsTrigger value="channels">Channels</TabsTrigger>
        </TabsList>

        {/* Overview Tab */}
        <TabsContent value="overview" className="space-y-6">
          <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
            <Card>
              <CardHeader>
                <CardTitle>Bookings Received</CardTitle>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="flex items-center justify-between">
                  <span className="text-sm text-gray-600">Today</span>
                  <span className="text-lg font-semibold">{formatNumber(otaStats.bookingsReceived.today)}</span>
                </div>
                <div className="flex items-center justify-between">
                  <span className="text-sm text-gray-600">This Week</span>
                  <span className="text-lg font-semibold">{formatNumber(otaStats.bookingsReceived.thisWeek)}</span>
                </div>
                <div className="flex items-center justify-between">
                  <span className="text-sm text-gray-600">This Month</span>
                  <span className="text-lg font-semibold">{formatNumber(otaStats.bookingsReceived.thisMonth)}</span>
                </div>
              </CardContent>
            </Card>

            <Card>
              <CardHeader>
                <CardTitle>Sync Statistics</CardTitle>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="flex items-center justify-between">
                  <span className="text-sm text-gray-600">Total Syncs</span>
                  <span className="text-lg font-semibold">{formatNumber(otaStats.totalSyncs)}</span>
                </div>
                <div className="flex items-center justify-between">
                  <span className="text-sm text-gray-600">Successful</span>
                  <span className="text-lg font-semibold text-green-600">{formatNumber(otaStats.successfulSyncs)}</span>
                </div>
                <div className="flex items-center justify-between">
                  <span className="text-sm text-gray-600">Failed</span>
                  <span className="text-lg font-semibold text-red-600">{formatNumber(otaStats.failedSyncs)}</span>
                </div>
                <div className="flex items-center justify-between">
                  <span className="text-sm text-gray-600">Avg Sync Time</span>
                  <span className="text-lg font-semibold">{otaStats.averageSyncTime}s</span>
                </div>
              </CardContent>
            </Card>

            <Card>
              <CardHeader>
                <CardTitle>Sync Status</CardTitle>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="flex items-center justify-between">
                  <span className="text-sm text-gray-600">Rooms Synced</span>
                  <span className="text-lg font-semibold">{formatNumber(otaStats.roomsSynced)}</span>
                </div>
                <div className="flex items-center justify-between">
                  <span className="text-sm text-gray-600">Last Sync</span>
                  <span className="text-sm font-medium">
                    {otaStats.lastSync ? format(new Date(otaStats.lastSync), 'MMM dd, HH:mm') : 'Never'}
                  </span>
                </div>
                {otaStats.failedSyncs > 0 && (
                  <div className="flex items-start gap-2 p-3 bg-red-50 rounded-lg mt-2">
                    <AlertTriangle className="w-4 h-4 text-red-500 mt-0.5" />
                    <span className="text-sm text-red-700">
                      {otaStats.failedSyncs} sync failure{otaStats.failedSyncs !== 1 ? 's' : ''} detected
                    </span>
                  </div>
                )}
              </CardContent>
            </Card>
          </div>
        </TabsContent>

        {/* Channels Tab */}
        <TabsContent value="channels" className="space-y-6">
          <div className="grid gap-4">
            {Object.entries(otaStats.syncFrequency).map(([provider, frequency]) => (
              <Card key={provider}>
                <CardContent className="flex items-center justify-between p-6">
                  <div className="flex items-center gap-3">
                    {getProviderStatusIcon(frequency)}
                    <div>
                      <h3 className="font-semibold">{providerNames[provider] || provider}</h3>
                      <p className="text-sm text-gray-600">
                        Sync frequency: {frequency}
                      </p>
                    </div>
                  </div>
                  <Badge variant={frequency === 'disabled' ? 'secondary' : 'default'}>
                    {frequency === 'disabled' ? 'Disabled' : 'Active'}
                  </Badge>
                </CardContent>
              </Card>
            ))}
          </div>

          <Card>
            <CardContent className="flex items-start gap-3 p-6">
              <Info className="w-5 h-5 text-blue-500 mt-0.5" />
              <div>
                <p className="text-sm text-gray-600">
                  Channel-level performance details (revenue, bookings, conversion rates) will be available once OTA channels report detailed analytics data. Currently showing sync-level statistics from connected providers.
                </p>
              </div>
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>
    </div>
  );
};

export default withErrorBoundary(OTADashboard, { level: 'component' });