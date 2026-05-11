import React, { useState, useEffect } from 'react';
import { toast } from 'react-hot-toast';
import {
  Clock,
  AlertTriangle,
  CheckCircle,
  XCircle,
  Bell,
  Timer,
  Target,
  Zap,
  Activity,
  TrendingUp,
  Filter,
  Eye,
  Settings,
  AlertCircle
} from 'lucide-react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Progress } from '@/components/ui/progress';
import { serviceTypeService, ServiceType } from '../../services/serviceTypeService';
import { useAuth } from '../../context/AuthContext';
import { api } from '@/services/api';

interface SLAAlert {
  id: string;
  serviceId: string;
  serviceType: string;
  customerName: string;
  roomNumber: string;
  alertType: 'response_warning' | 'response_breach' | 'completion_warning' | 'completion_breach';
  timeRemaining: number; // in minutes
  timeElapsed: number; // in minutes
  slaLimit: number; // in minutes
  severity: 'low' | 'medium' | 'high' | 'critical';
  message: string;
  createdAt: Date;
}

interface SLAMetrics {
  responseTimeSLA: {
    met: number;
    breached: number;
    percentage: number;
  };
  completionTimeSLA: {
    met: number;
    breached: number;
    percentage: number;
  };
  escalatedRequests: number;
  activeAlerts: number;
  averageResponseTime: number;
  averageCompletionTime: number;
}

interface ServiceRequest {
  id: string;
  serviceType: string;
  customerName: string;
  roomNumber: string;
  status: 'pending' | 'in_progress' | 'completed' | 'escalated';
  createdAt: Date;
  responseTime?: number;
  completionTime?: number;
  slaSettings: {
    responseTime: number;
    completionTime: number;
    escalationTime: number;
  };
}

interface SLATrackerProps {
  hotelId?: string;
}

const SLATracker: React.FC<SLATrackerProps> = ({ hotelId: propHotelId }) => {
  const { user } = useAuth();
  const [serviceTypes, setServiceTypes] = useState<ServiceType[]>([]);
  const [alerts, setAlerts] = useState<SLAAlert[]>([]);
  const [metrics, setMetrics] = useState<SLAMetrics | null>(null);
  const [activeRequests, setActiveRequests] = useState<ServiceRequest[]>([]);
  const [loading, setLoading] = useState(true);
  const [selectedFilter, setSelectedFilter] = useState<'all' | 'critical' | 'high' | 'medium' | 'low'>('all');

  // Use prop hotelId (from property context) or fall back to user's hotelId
  const resolvedHotelId = (() => {
    if (propHotelId) return propHotelId;
    const raw = user?.hotelId;
    if (!raw) return undefined;
    if (typeof raw === 'string') return raw;
    if (typeof raw === 'object' && raw !== null && '_id' in raw) return String((raw as { _id: string })._id);
    return String(raw);
  })();

  useEffect(() => {
    if (resolvedHotelId) {
      fetchSLAData();
      // Set up real-time monitoring — don't show loading spinner on polls
      const interval = setInterval(() => fetchSLAData(false), 30000);
      return () => clearInterval(interval);
    }
  }, [resolvedHotelId]);

  const fetchSLAData = async (showLoading = true) => {
    try {
      if (showLoading) setLoading(true);

      // Fetch service types to get SLA settings
      const serviceTypesResponse = await serviceTypeService.getServiceTypes({
        hotelId: resolvedHotelId,
        activeOnly: true
      });
      setServiceTypes(serviceTypesResponse.serviceTypes);

      // Fetch real active service requests from the guest-services API
      const [activeResponse, statsResponse] = await Promise.all([
        api.get('/guest-services', {
          params: { status: 'pending', limit: 20, hotelId: resolvedHotelId }
        }).catch(() => null),
        api.get('/guest-services/stats', {
          params: { hotelId: resolvedHotelId }
        }).catch(() => null)
      ]);

      // Also fetch in-progress requests
      const inProgressResponse = await api.get('/guest-services', {
        params: { status: 'in_progress', limit: 20, hotelId: resolvedHotelId }
      }).catch(() => null);

      const pendingRequests = activeResponse?.data?.data?.serviceRequests || [];
      const inProgressRequests = inProgressResponse?.data?.data?.serviceRequests || [];
      const allActiveRequests = [...pendingRequests, ...inProgressRequests];

      // Map real service requests to the ServiceRequest interface
      const mappedRequests: ServiceRequest[] = allActiveRequests.map((req: Record<string, unknown>) => {
        const booking = req.bookingId as Record<string, unknown> | null;
        const rooms = (booking?.rooms as Array<Record<string, unknown>>) || [];
        const roomNumber = rooms.length > 0
          ? ((rooms[0].roomId as Record<string, unknown>)?.roomNumber as string || 'N/A')
          : 'N/A';
        const reqUser = req.userId as Record<string, unknown> | null;

        return {
          id: req._id as string,
          serviceType: req.serviceType as string,
          customerName: (reqUser?.name as string) || 'Guest',
          roomNumber,
          status: req.status as ServiceRequest['status'],
          createdAt: new Date(req.createdAt as string),
          responseTime: req.responseTime as number | undefined,
          completionTime: req.completionTime as number | undefined,
          slaSettings: {
            responseTime: 15,
            completionTime: 60,
            escalationTime: 30
          }
        };
      });

      // Calculate SLA metrics from real stats
      const overall = statsResponse?.data?.data?.overall || {};
      const totalRequests = overall.totalRequests || 0;
      const completedCount = overall.completedCount || 0;
      const pendingCount = overall.pendingCount || 0;

      const completionPercentage = totalRequests > 0
        ? Math.round((completedCount / totalRequests) * 100 * 10) / 10
        : 0;

      const calculatedMetrics: SLAMetrics = {
        responseTimeSLA: {
          met: completedCount,
          breached: pendingCount,
          percentage: completionPercentage
        },
        completionTimeSLA: {
          met: completedCount,
          breached: totalRequests - completedCount,
          percentage: completionPercentage
        },
        escalatedRequests: mappedRequests.filter(r => r.status === 'escalated').length,
        activeAlerts: 0,
        averageResponseTime: overall.avgResponseTime || 0,
        averageCompletionTime: overall.avgCompletionTime || 0
      };

      // Generate alerts based on active requests
      const generatedAlerts = generateAlertsFromRequests(mappedRequests);
      calculatedMetrics.activeAlerts = generatedAlerts.length;

      setMetrics(calculatedMetrics);
      setActiveRequests(mappedRequests);
      setAlerts(generatedAlerts);

    } catch (error) {
      toast.error('Failed to load SLA data');
    } finally {
      setLoading(false);
    }
  };

  const generateAlertsFromRequests = (requests: ServiceRequest[]): SLAAlert[] => {
    const alerts: SLAAlert[] = [];

    requests.forEach(request => {
      const timeElapsed = Math.floor((Date.now() - request.createdAt.getTime()) / (1000 * 60));

      // Check response time alerts
      if (request.status === 'pending') {
        const responseTimeRemaining = request.slaSettings.responseTime - timeElapsed;

        if (responseTimeRemaining <= 0) {
          alerts.push({
            id: `${request.id}-response-breach`,
            serviceId: request.id,
            serviceType: request.serviceType,
            customerName: request.customerName,
            roomNumber: request.roomNumber,
            alertType: 'response_breach',
            timeRemaining: responseTimeRemaining,
            timeElapsed,
            slaLimit: request.slaSettings.responseTime,
            severity: 'critical',
            message: `Response time SLA breached by ${Math.abs(responseTimeRemaining)} minutes`,
            createdAt: new Date()
          });
        } else if (responseTimeRemaining <= 5) {
          alerts.push({
            id: `${request.id}-response-warning`,
            serviceId: request.id,
            serviceType: request.serviceType,
            customerName: request.customerName,
            roomNumber: request.roomNumber,
            alertType: 'response_warning',
            timeRemaining: responseTimeRemaining,
            timeElapsed,
            slaLimit: request.slaSettings.responseTime,
            severity: responseTimeRemaining <= 2 ? 'high' : 'medium',
            message: `Response time SLA warning: ${responseTimeRemaining} minutes remaining`,
            createdAt: new Date()
          });
        }
      }

      // Check completion time alerts
      if (request.status === 'in_progress') {
        const completionTimeRemaining = request.slaSettings.completionTime - timeElapsed;

        if (completionTimeRemaining <= 0) {
          alerts.push({
            id: `${request.id}-completion-breach`,
            serviceId: request.id,
            serviceType: request.serviceType,
            customerName: request.customerName,
            roomNumber: request.roomNumber,
            alertType: 'completion_breach',
            timeRemaining: completionTimeRemaining,
            timeElapsed,
            slaLimit: request.slaSettings.completionTime,
            severity: 'critical',
            message: `Completion time SLA breached by ${Math.abs(completionTimeRemaining)} minutes`,
            createdAt: new Date()
          });
        } else if (completionTimeRemaining <= 15) {
          alerts.push({
            id: `${request.id}-completion-warning`,
            serviceId: request.id,
            serviceType: request.serviceType,
            customerName: request.customerName,
            roomNumber: request.roomNumber,
            alertType: 'completion_warning',
            timeRemaining: completionTimeRemaining,
            timeElapsed,
            slaLimit: request.slaSettings.completionTime,
            severity: completionTimeRemaining <= 5 ? 'high' : 'medium',
            message: `Completion time SLA warning: ${completionTimeRemaining} minutes remaining`,
            createdAt: new Date()
          });
        }
      }
    });

    return alerts;
  };

  const getSeverityColor = (severity: string) => {
    switch (severity) {
      case 'critical': return 'bg-red-100 text-red-800 border-red-200';
      case 'high': return 'bg-orange-100 text-orange-800 border-orange-200';
      case 'medium': return 'bg-yellow-100 text-yellow-800 border-yellow-200';
      case 'low': return 'bg-blue-100 text-blue-800 border-blue-200';
      default: return 'bg-gray-100 text-gray-800 border-gray-200';
    }
  };

  const getSeverityIcon = (severity: string) => {
    switch (severity) {
      case 'critical': return <XCircle className="w-4 h-4" />;
      case 'high': return <AlertTriangle className="w-4 h-4" />;
      case 'medium': return <Clock className="w-4 h-4" />;
      case 'low': return <AlertCircle className="w-4 h-4" />;
      default: return <AlertCircle className="w-4 h-4" />;
    }
  };

  const formatServiceTypeName = (type: string): string => {
    return type.replace('_', ' ').replace(/\b\w/g, l => l.toUpperCase());
  };

  const filteredAlerts = alerts.filter(alert =>
    selectedFilter === 'all' || alert.severity === selectedFilter
  );

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600"></div>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
        <div>
          <h2 className="text-2xl font-bold text-gray-900">SLA Tracking & Alerts</h2>
          <p className="text-gray-600">Monitor service level agreements and response times</p>
        </div>

        <div className="flex items-center gap-3">
          <Button className="bg-blue-600 hover:bg-blue-700" onClick={() => {
            toast('SLA configuration is managed via Service Types. Go to Service Management tab to set response and completion times per service type.', { icon: 'ℹ️' });
          }}>
            <Settings className="w-4 h-4 mr-2" />
            Configure SLAs
          </Button>
        </div>
      </div>

      {/* SLA Metrics Overview */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Response Time SLA</CardTitle>
            <Timer className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{(metrics?.responseTimeSLA?.percentage ?? 0).toFixed(1)}%</div>
            <p className="text-xs text-muted-foreground">
              {metrics?.responseTimeSLA?.met ?? 0} met, {metrics?.responseTimeSLA?.breached ?? 0} breached
            </p>
            <div className="mt-2">
              <Progress
                value={metrics?.responseTimeSLA.percentage || 0}
                className="h-2"
              />
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Completion Time SLA</CardTitle>
            <Target className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{(metrics?.completionTimeSLA?.percentage ?? 0).toFixed(1)}%</div>
            <p className="text-xs text-muted-foreground">
              {metrics?.completionTimeSLA?.met ?? 0} met, {metrics?.completionTimeSLA?.breached ?? 0} breached
            </p>
            <div className="mt-2">
              <Progress
                value={metrics?.completionTimeSLA.percentage || 0}
                className="h-2"
              />
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Active Alerts</CardTitle>
            <Bell className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-red-600">{alerts.length}</div>
            <p className="text-xs text-muted-foreground">
              {alerts.filter(a => a.severity === 'critical').length} critical
            </p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Escalated Requests</CardTitle>
            <TrendingUp className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{metrics?.escalatedRequests}</div>
            <p className="text-xs text-muted-foreground">
              Require immediate attention
            </p>
          </CardContent>
        </Card>
      </div>

      {/* Active Alerts */}
      <Card>
        <CardHeader>
          <div className="flex justify-between items-center">
            <CardTitle className="flex items-center gap-2">
              <AlertTriangle className="w-5 h-5 text-red-500" />
              Active SLA Alerts
            </CardTitle>
            <div className="flex items-center gap-2">
              <Filter className="w-4 h-4 text-gray-500" />
              <select
                value={selectedFilter}
                onChange={(e) => setSelectedFilter(e.target.value as unknown)}
                className="border border-gray-300 rounded-md px-3 py-1 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
              >
                <option value="all">All Alerts</option>
                <option value="critical">Critical</option>
                <option value="high">High</option>
                <option value="medium">Medium</option>
                <option value="low">Low</option>
              </select>
            </div>
          </div>
        </CardHeader>
        <CardContent>
          {filteredAlerts.length === 0 ? (
            <div className="text-center py-8">
              <CheckCircle className="w-12 h-12 text-green-500 mx-auto mb-4" />
              <p className="text-gray-500">No active alerts</p>
            </div>
          ) : (
            <div className="space-y-3">
              {filteredAlerts.map((alert) => (
                <div
                  key={alert.id}
                  className={`p-4 rounded-lg border ${getSeverityColor(alert.severity)}`}
                >
                  <div className="flex items-start justify-between">
                    <div className="flex items-start gap-3">
                      {getSeverityIcon(alert.severity)}
                      <div className="flex-1">
                        <div className="flex items-center gap-2">
                          <span className="font-medium">
                            {formatServiceTypeName(alert.serviceType)}
                          </span>
                          <Badge variant="outline" className="text-xs">
                            Room {alert.roomNumber}
                          </Badge>
                          <Badge variant="outline" className="text-xs">
                            {alert.customerName}
                          </Badge>
                        </div>
                        <p className="text-sm mt-1">{alert.message}</p>
                        <div className="flex items-center gap-4 text-xs text-gray-600 mt-2">
                          <span>Elapsed: {alert.timeElapsed}m</span>
                          <span>SLA: {alert.slaLimit}m</span>
                          {alert.timeRemaining > 0 && (
                            <span>Remaining: {alert.timeRemaining}m</span>
                          )}
                        </div>
                      </div>
                    </div>
                    <div className="flex gap-2">
                      <Button size="sm" variant="outline">
                        <Eye className="w-4 h-4" />
                      </Button>
                      <Button size="sm" className="bg-blue-600 hover:bg-blue-700">
                        <Zap className="w-4 h-4" />
                      </Button>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          )}
        </CardContent>
      </Card>

      {/* Active Service Requests with SLA Status */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Activity className="w-5 h-5" />
            Active Service Requests
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b">
                  <th className="text-left py-3 px-4">Service</th>
                  <th className="text-left py-3 px-4">Customer</th>
                  <th className="text-left py-3 px-4">Room</th>
                  <th className="text-left py-3 px-4">Status</th>
                  <th className="text-left py-3 px-4">Response SLA</th>
                  <th className="text-left py-3 px-4">Completion SLA</th>
                  <th className="text-left py-3 px-4">Actions</th>
                </tr>
              </thead>
              <tbody>
                {activeRequests.length === 0 && (
                  <tr>
                    <td colSpan={7} className="px-6 py-8 text-center text-gray-500">
                      <p className="text-sm">No active service requests at this time</p>
                    </td>
                  </tr>
                )}
                {activeRequests.map((request) => {
                  const timeElapsed = Math.floor((Date.now() - request.createdAt.getTime()) / (1000 * 60));
                  const responseProgress = Math.min((timeElapsed / request.slaSettings.responseTime) * 100, 100);
                  const completionProgress = Math.min((timeElapsed / request.slaSettings.completionTime) * 100, 100);

                  return (
                    <tr key={request.id} className="border-b hover:bg-gray-50">
                      <td className="py-3 px-4">
                        <div>
                          <div className="font-medium">{formatServiceTypeName(request.serviceType)}</div>
                          <div className="text-xs text-gray-500">
                            {timeElapsed}m elapsed
                          </div>
                        </div>
                      </td>
                      <td className="py-3 px-4">{request.customerName}</td>
                      <td className="py-3 px-4">
                        <Badge variant="outline">{request.roomNumber}</Badge>
                      </td>
                      <td className="py-3 px-4">
                        <Badge
                          className={
                            request.status === 'completed' ? 'bg-green-100 text-green-800' :
                            request.status === 'escalated' ? 'bg-red-100 text-red-800' :
                            request.status === 'in_progress' ? 'bg-blue-100 text-blue-800' :
                            'bg-yellow-100 text-yellow-800'
                          }
                        >
                          {request.status.replace('_', ' ')}
                        </Badge>
                      </td>
                      <td className="py-3 px-4">
                        <div className="space-y-1">
                          <div className="flex items-center gap-2">
                            <div className="w-16 bg-gray-200 rounded-full h-2">
                              <div
                                className={`h-2 rounded-full ${
                                  responseProgress >= 100 ? 'bg-red-500' :
                                  responseProgress >= 80 ? 'bg-orange-500' :
                                  'bg-green-500'
                                }`}
                                style={{ width: `${Math.min(responseProgress, 100)}%` }}
                              ></div>
                            </div>
                            <span className="text-xs">
                              {request.slaSettings.responseTime}m
                            </span>
                          </div>
                        </div>
                      </td>
                      <td className="py-3 px-4">
                        <div className="space-y-1">
                          <div className="flex items-center gap-2">
                            <div className="w-16 bg-gray-200 rounded-full h-2">
                              <div
                                className={`h-2 rounded-full ${
                                  completionProgress >= 100 ? 'bg-red-500' :
                                  completionProgress >= 80 ? 'bg-orange-500' :
                                  'bg-green-500'
                                }`}
                                style={{ width: `${Math.min(completionProgress, 100)}%` }}
                              ></div>
                            </div>
                            <span className="text-xs">
                              {request.slaSettings.completionTime}m
                            </span>
                          </div>
                        </div>
                      </td>
                      <td className="py-3 px-4">
                        <div className="flex gap-1">
                          <Button size="sm" variant="outline">
                            <Eye className="w-4 h-4" />
                          </Button>
                          {request.status !== 'completed' && (
                            <Button size="sm" className="bg-blue-600 hover:bg-blue-700">
                              <Zap className="w-4 h-4" />
                            </Button>
                          )}
                        </div>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </CardContent>
      </Card>
    </div>
  );
};

export default SLATracker;