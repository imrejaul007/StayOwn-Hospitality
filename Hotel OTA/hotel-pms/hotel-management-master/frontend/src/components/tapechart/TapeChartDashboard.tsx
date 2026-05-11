import React, { useEffect, useState } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Skeleton } from '@/components/ui/skeleton';
import { Calendar, Users, Bed, Clock, TrendingUp, AlertTriangle, Settings, Filter } from 'lucide-react';
import tapeChartService from '@/services/tapeChartService';
import { formatCurrency } from '@/utils/currencyUtils';
import ProfitabilityDashboard from '@/components/analytics/ProfitabilityDashboard';

interface DashboardData {
  summary: {
    totalRooms: number;
    availableRooms: number;
    occupiedRooms: number;
    reservedRooms: number;
    maintenanceRooms: number;
    dirtyRooms: number;
    occupancyRate: number;
    adr: number;
    revpar: number;
  };
  roomBlocks: {
    activeBlocks: number;
    blockedRooms: number;
    upcomingReleases: number;
  };
  reservations: {
    totalReservations: number;
    vipReservations: number;
    upgradesAvailable: number;
    specialRequests: number;
  };
  waitlist: {
    totalOnWaitlist: number;
    availableMatches: number;
  };
  alerts: Array<{
    type: string;
    message: string;
    severity: 'info' | 'warning' | 'error';
    count?: number;
  }>;
  recentActivity: Array<{
    time: string;
    action: string;
    details: string;
    user: string;
  }>;
}

const TapeChartDashboard: React.FC = () => {
  const [dashboardData, setDashboardData] = useState<DashboardData | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [lastUpdate, setLastUpdate] = useState<Date>(new Date());

  useEffect(() => {
    fetchDashboardData();
    const interval = setInterval(fetchDashboardData, 30000); // Update every 30 seconds
    return () => clearInterval(interval);
  }, []);

  const fetchDashboardData = async () => {
    try {
      setLoading(true);
      const response = await tapeChartService.getTapeChartDashboard();
      setDashboardData(response);
      setLastUpdate(new Date());
      setError(null);
    } catch (err: unknown) {
      setError(err.message || 'Failed to fetch dashboard data');
    } finally {
      setLoading(false);
    }
  };

  const getStatusColor = (status: string) => {
    switch (status) {
      case 'available': return 'bg-green-500';
      case 'occupied': return 'bg-red-500';
      case 'reserved': return 'bg-yellow-500';
      case 'maintenance': return 'bg-purple-500';
      case 'dirty': return 'bg-orange-500';
      default: return 'bg-gray-500';
    }
  };

  const getAlertIcon = (severity: string) => {
    switch (severity) {
      case 'error': return <AlertTriangle className="w-4 h-4 text-red-500" />;
      case 'warning': return <AlertTriangle className="w-4 h-4 text-yellow-500" />;
      default: return <AlertTriangle className="w-4 h-4 text-blue-500" />;
    }
  };

  if (loading && !dashboardData) {
    return (
      <div className="p-6 space-y-6">
        <div className="flex justify-between items-center">
          <Skeleton className="h-8 w-64" />
          <Skeleton className="h-10 w-32" />
        </div>
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
          {Array.from({ length: 8 }).map((_, i) => (
            <Card key={i}>
              <CardHeader className="pb-2">
                <Skeleton className="h-4 w-20" />
                <Skeleton className="h-8 w-24" />
              </CardHeader>
              <CardContent>
                <Skeleton className="h-4 w-16" />
              </CardContent>
            </Card>
          ))}
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="p-6">
        <Card>
          <CardContent className="p-6">
            <div className="text-center">
              <AlertTriangle className="w-12 h-12 text-red-500 mx-auto mb-4" />
              <p className="text-red-600 mb-4">{error}</p>
              <Button onClick={fetchDashboardData}>Retry</Button>
            </div>
          </CardContent>
        </Card>
      </div>
    );
  }

  if (!dashboardData || !dashboardData.summary || !dashboardData.alerts || !dashboardData.roomBlocks || !dashboardData.reservations || !dashboardData.waitlist || !dashboardData.recentActivity) {
    return <div className="p-6"><div className="text-center">Loading dashboard data...</div></div>;
  }

  return (
    <div className="p-4 sm:p-6 space-y-4 sm:space-y-6">
      {/* Header - Mobile Responsive */}
      <div className="flex flex-col sm:flex-row sm:justify-between sm:items-center gap-4">
        <div>
          <h1 className="text-2xl sm:text-3xl font-bold">Tape Chart Dashboard</h1>
          <p className="text-gray-600 text-sm sm:text-base">
            Real-time room management overview • Last updated: {lastUpdate.toLocaleTimeString()}
          </p>
        </div>
        <div className="flex flex-col sm:flex-row gap-2">
          <Button variant="outline" size="sm" onClick={fetchDashboardData} className="w-full sm:w-auto">
            <Settings className="w-4 h-4 mr-2" />
            Refresh
          </Button>
          <Button variant="outline" size="sm" className="w-full sm:w-auto">
            <Filter className="w-4 h-4 mr-2" />
            Filters
          </Button>
        </div>
      </div>

      {/* Alerts */}
      {dashboardData?.alerts?.length > 0 && (
        <Card className="border-l-4 border-l-yellow-500">
          <CardHeader>
            <CardTitle className="flex items-center text-lg">
              <AlertTriangle className="w-5 h-5 mr-2 text-yellow-500" />
              Active Alerts
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="space-y-3">
              {dashboardData.alerts.map((alert, index) => (
                <div key={`dashboardData-alerts-${index}`} className="flex items-center justify-between p-3 bg-gray-50 rounded-lg">
                  <div className="flex items-center">
                    {getAlertIcon(alert.severity)}
                    <span className="ml-2">{alert.message}</span>
                  </div>
                  {alert.count && (
                    <Badge variant={alert.severity === 'error' ? 'destructive' : 'secondary'}>
                      {alert.count}
                    </Badge>
                  )}
                </div>
              ))}
            </div>
          </CardContent>
        </Card>
      )}

      {/* Room Status Overview - Mobile Responsive */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4 sm:gap-6">
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Total Rooms</CardTitle>
            <Bed className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{dashboardData.summary.totalRooms}</div>
            <div className="flex items-center space-x-2 mt-2">
              <div className="flex space-x-1">
                <div className={`w-3 h-3 rounded-full ${getStatusColor('available')}`} title="Available"></div>
                <span className="text-xs">{dashboardData.summary.availableRooms}</span>
              </div>
              <div className="flex space-x-1">
                <div className={`w-3 h-3 rounded-full ${getStatusColor('occupied')}`} title="Occupied"></div>
                <span className="text-xs">{dashboardData.summary.occupiedRooms}</span>
              </div>
              <div className="flex space-x-1">
                <div className={`w-3 h-3 rounded-full ${getStatusColor('reserved')}`} title="Reserved"></div>
                <span className="text-xs">{dashboardData.summary.reservedRooms}</span>
              </div>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Occupancy Rate</CardTitle>
            <TrendingUp className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{dashboardData.summary.occupancyRate.toFixed(1)}%</div>
            <div className="text-xs text-muted-foreground">
              {dashboardData.summary.occupiedRooms + dashboardData.summary.reservedRooms} of {dashboardData.summary.totalRooms - dashboardData.summary.maintenanceRooms} available
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">ADR</CardTitle>
            <TrendingUp className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{formatCurrency(dashboardData.summary.adr)}</div>
            <div className="text-xs text-muted-foreground">Average Daily Rate</div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">RevPAR</CardTitle>
            <TrendingUp className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{formatCurrency(dashboardData.summary.revpar)}</div>
            <div className="text-xs text-muted-foreground">Revenue Per Available Room</div>
          </CardContent>
        </Card>
      </div>

      {/* Room Blocks & Reservations */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center">
              <Users className="w-5 h-5 mr-2" />
              Room Blocks
            </CardTitle>
            <CardDescription>Group booking management</CardDescription>
          </CardHeader>
          <CardContent className="space-y-3">
            <div className="flex justify-between">
              <span>Active Blocks</span>
              <Badge variant="default">{dashboardData.roomBlocks.activeBlocks}</Badge>
            </div>
            <div className="flex justify-between">
              <span>Blocked Rooms</span>
              <span className="font-medium">{dashboardData.roomBlocks.blockedRooms}</span>
            </div>
            <div className="flex justify-between">
              <span>Upcoming Releases</span>
              <Badge variant="outline">{dashboardData.roomBlocks.upcomingReleases}</Badge>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle className="flex items-center">
              <Calendar className="w-5 h-5 mr-2" />
              Reservations
            </CardTitle>
            <CardDescription>Advanced reservation management</CardDescription>
          </CardHeader>
          <CardContent className="space-y-3">
            <div className="flex justify-between">
              <span>Total Reservations</span>
              <span className="font-medium">{dashboardData.reservations.totalReservations}</span>
            </div>
            <div className="flex justify-between">
              <span>VIP Reservations</span>
              <Badge variant="default">{dashboardData.reservations.vipReservations}</Badge>
            </div>
            <div className="flex justify-between">
              <span>Upgrade Opportunities</span>
              <Badge variant="secondary">{dashboardData.reservations.upgradesAvailable}</Badge>
            </div>
            <div className="flex justify-between">
              <span>Special Requests</span>
              <Badge variant="outline">{dashboardData.reservations.specialRequests}</Badge>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle className="flex items-center">
              <Clock className="w-5 h-5 mr-2" />
              Waitlist
            </CardTitle>
            <CardDescription>Guest waitlist management</CardDescription>
          </CardHeader>
          <CardContent className="space-y-3">
            <div className="flex justify-between">
              <span>Guests on Waitlist</span>
              <span className="font-medium">{dashboardData.waitlist.totalOnWaitlist}</span>
            </div>
            <div className="flex justify-between">
              <span>Available Matches</span>
              <Badge variant={dashboardData.waitlist.availableMatches > 0 ? "default" : "secondary"}>
                {dashboardData.waitlist.availableMatches}
              </Badge>
            </div>
            {dashboardData.waitlist.availableMatches > 0 && (
              <Button size="sm" className="w-full">
                Process Waitlist
              </Button>
            )}
          </CardContent>
        </Card>
      </div>

      {/* Recent Activity */}
      <Card>
        <CardHeader>
          <CardTitle>Recent Activity</CardTitle>
          <CardDescription>Latest room status changes and assignments</CardDescription>
        </CardHeader>
        <CardContent>
          {dashboardData.recentActivity.length > 0 ? (
            <div className="space-y-3">
              {dashboardData.recentActivity.slice(0, 5).map((activity, index) => (
                <div key={`activity-${index}`} className="flex items-center justify-between p-3 bg-gray-50 rounded-lg">
                  <div>
                    <span className="font-medium">{activity.action}</span>
                    <p className="text-sm text-gray-600">{activity.details}</p>
                  </div>
                  <div className="text-right">
                    <div className="text-sm font-medium">{activity.user}</div>
                    <div className="text-xs text-gray-500">{activity.time}</div>
                  </div>
                </div>
              ))}
            </div>
          ) : (
            <p className="text-gray-500">No recent activity</p>
          )}
        </CardContent>
      </Card>

      {/* Room Status Distribution */}
      <Card>
        <CardHeader>
          <CardTitle>Room Status Distribution</CardTitle>
          <CardDescription>Current room status breakdown</CardDescription>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-2 md:grid-cols-6 gap-4">
            <div className="text-center">
              <div className={`w-12 h-12 rounded-full ${getStatusColor('available')} mx-auto mb-2 flex items-center justify-center text-white font-bold`}>
                {dashboardData.summary.availableRooms}
              </div>
              <div className="text-sm font-medium">Available</div>
              <div className="text-xs text-gray-500">
                {((dashboardData.summary.availableRooms / dashboardData.summary.totalRooms) * 100).toFixed(1)}%
              </div>
            </div>
            
            <div className="text-center">
              <div className={`w-12 h-12 rounded-full ${getStatusColor('occupied')} mx-auto mb-2 flex items-center justify-center text-white font-bold`}>
                {dashboardData.summary.occupiedRooms}
              </div>
              <div className="text-sm font-medium">Occupied</div>
              <div className="text-xs text-gray-500">
                {((dashboardData.summary.occupiedRooms / dashboardData.summary.totalRooms) * 100).toFixed(1)}%
              </div>
            </div>
            
            <div className="text-center">
              <div className={`w-12 h-12 rounded-full ${getStatusColor('reserved')} mx-auto mb-2 flex items-center justify-center text-white font-bold`}>
                {dashboardData.summary.reservedRooms}
              </div>
              <div className="text-sm font-medium">Reserved</div>
              <div className="text-xs text-gray-500">
                {((dashboardData.summary.reservedRooms / dashboardData.summary.totalRooms) * 100).toFixed(1)}%
              </div>
            </div>
            
            <div className="text-center">
              <div className={`w-12 h-12 rounded-full ${getStatusColor('maintenance')} mx-auto mb-2 flex items-center justify-center text-white font-bold`}>
                {dashboardData.summary.maintenanceRooms}
              </div>
              <div className="text-sm font-medium">Maintenance</div>
              <div className="text-xs text-gray-500">
                {((dashboardData.summary.maintenanceRooms / dashboardData.summary.totalRooms) * 100).toFixed(1)}%
              </div>
            </div>
            
            <div className="text-center">
              <div className={`w-12 h-12 rounded-full ${getStatusColor('dirty')} mx-auto mb-2 flex items-center justify-center text-white font-bold`}>
                {dashboardData.summary.dirtyRooms}
              </div>
              <div className="text-sm font-medium">Dirty</div>
              <div className="text-xs text-gray-500">
                {((dashboardData.summary.dirtyRooms / dashboardData.summary.totalRooms) * 100).toFixed(1)}%
              </div>
            </div>

            <div className="text-center">
              <div className="w-12 h-12 rounded-full bg-gray-200 mx-auto mb-2 flex items-center justify-center font-bold">
                {dashboardData.roomBlocks.blockedRooms}
              </div>
              <div className="text-sm font-medium">Blocked</div>
              <div className="text-xs text-gray-500">Group Blocks</div>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Profitability Analytics */}
      <ProfitabilityDashboard />
    </div>
  );
};

export default TapeChartDashboard;