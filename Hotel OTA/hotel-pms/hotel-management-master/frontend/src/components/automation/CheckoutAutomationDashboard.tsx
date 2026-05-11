import React, { useState, useEffect } from 'react';
import { api } from '../../services/api';
import { Card, CardContent, CardHeader, CardTitle } from '../../ui/card';
import { Button } from '../../ui/button';
import { Badge } from '../../ui/Badge';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '../../ui/Tabs';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '../../ui/table';
import { Progress } from '../../ui/Progress';
import { Alert, AlertDescription } from '../../ui/Alert';
import {
  Zap,
  Clock,
  CheckCircle,
  AlertTriangle,
  RefreshCw,
  Settings,
  BarChart3,
  Activity,
  TrendingUp,
  Users,
  Package,
  ClipboardList,
  WashingMachine,
  Home,
  Eye,
  Play,
  Pause,
  RotateCcw
} from 'lucide-react';
import { toast } from '../../utils/toast';

interface AutomationStatus {
  isEnabled: boolean;
  lastProcessed: string;
  totalProcessed: number;
  successRate: number;
  averageProcessingTime: number;
}

interface AutomationLog {
  id: string;
  bookingId: string;
  roomId: string;
  status: 'completed' | 'in_progress' | 'failed' | 'partial_success';
  timestamp: string;
  processingTime: number;
  steps: {
    laundry: boolean;
    inventory: boolean;
    housekeeping: boolean;
  };
  details: {
    laundryItems: number;
    inventoryScore: number;
    housekeepingTasks: number;
  };
}

interface AutomationStats {
  today: {
    processed: number;
    success: number;
    failed: number;
    averageTime: number;
  };
  thisWeek: {
    processed: number;
    success: number;
    failed: number;
    averageTime: number;
  };
  thisMonth: {
    processed: number;
    success: number;
    failed: number;
    averageTime: number;
  };
}

const CheckoutAutomationDashboard: React.FC = () => {
  const [automationStatus, setAutomationStatus] = useState<AutomationStatus | null>(null);
  const [recentLogs, setRecentLogs] = useState<AutomationLog[]>([]);
  const [stats, setStats] = useState<AutomationStats | null>(null);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);

  useEffect(() => {
    fetchAutomationData();
  }, []);

  const fetchAutomationData = async () => {
    try {
      setLoading(true);
      const [statusResponse, logsResponse, statsResponse] = await Promise.all([
        api.get('/checkout-automation/status'),
        api.get('/checkout-automation/logs', { params: { limit: 10 } }),
        api.get('/checkout-automation/statistics')
      ]);

      setAutomationStatus(statusResponse.data.data);
      setRecentLogs(logsResponse.data.data.logs);
      setStats(statsResponse.data.data);
    } catch (error) {
      toast.error('Failed to fetch automation data');
    } finally {
      setLoading(false);
    }
  };

  const handleRefresh = async () => {
    setRefreshing(true);
    await fetchAutomationData();
    setRefreshing(false);
    toast.success('Data refreshed successfully');
  };

  const toggleAutomation = async () => {
    try {
      await api.put('/checkout-automation/config', { isEnabled: !automationStatus?.isEnabled });
      await fetchAutomationData();
      toast.success(`Automation ${automationStatus?.isEnabled ? 'disabled' : 'enabled'} successfully`);
    } catch (error) {
      toast.error('Failed to toggle automation');
    }
  };

  const getStatusColor = (status: string) => {
    switch (status) {
      case 'completed': return 'bg-green-100 text-green-800';
      case 'in_progress': return 'bg-blue-100 text-blue-800';
      case 'failed': return 'bg-red-100 text-red-800';
      case 'partial_success': return 'bg-yellow-100 text-yellow-800';
      default: return 'bg-gray-100 text-gray-800';
    }
  };

  const getStatusIcon = (status: string) => {
    switch (status) {
      case 'completed': return <CheckCircle className="h-4 w-4" />;
      case 'in_progress': return <Clock className="h-4 w-4" />;
      case 'failed': return <AlertTriangle className="h-4 w-4" />;
      case 'partial_success': return <AlertTriangle className="h-4 w-4" />;
      default: return <Clock className="h-4 w-4" />;
    }
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <RefreshCw className="h-8 w-8 animate-spin" />
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold">Checkout Automation</h1>
          <p className="text-gray-600">Automated laundry, inventory, and housekeeping processing</p>
        </div>
        <div className="flex gap-2">
          <Button
            variant="outline"
            onClick={handleRefresh}
            disabled={refreshing}
          >
            <RefreshCw className={`h-4 w-4 mr-2 ${refreshing ? 'animate-spin' : ''}`} />
            Refresh
          </Button>
          <Button
            onClick={toggleAutomation}
            variant={automationStatus?.isEnabled ? "destructive" : "default"}
          >
            {automationStatus?.isEnabled ? (
              <>
                <Pause className="h-4 w-4 mr-2" />
                Disable
              </>
            ) : (
              <>
                <Play className="h-4 w-4 mr-2" />
                Enable
              </>
            )}
          </Button>
        </div>
      </div>

      {/* Status Overview */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
        <Card>
          <CardContent className="p-6">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm font-medium text-gray-600">Status</p>
                <p className="text-2xl font-bold">
                  {automationStatus?.isEnabled ? 'Active' : 'Inactive'}
                </p>
              </div>
              <div className={`p-2 rounded-full ${automationStatus?.isEnabled ? 'bg-green-100' : 'bg-gray-100'}`}>
                <Zap className={`h-6 w-6 ${automationStatus?.isEnabled ? 'text-green-600' : 'text-gray-400'}`} />
              </div>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardContent className="p-6">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm font-medium text-gray-600">Total Processed</p>
                <p className="text-2xl font-bold">{automationStatus?.totalProcessed || 0}</p>
              </div>
              <div className="p-2 rounded-full bg-blue-100">
                <Activity className="h-6 w-6 text-blue-600" />
              </div>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardContent className="p-6">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm font-medium text-gray-600">Success Rate</p>
                <p className="text-2xl font-bold">{automationStatus?.successRate || 0}%</p>
              </div>
              <div className="p-2 rounded-full bg-green-100">
                <TrendingUp className="h-6 w-6 text-green-600" />
              </div>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardContent className="p-6">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm font-medium text-gray-600">Avg. Time</p>
                <p className="text-2xl font-bold">{automationStatus?.averageProcessingTime || 0}s</p>
              </div>
              <div className="p-2 rounded-full bg-purple-100">
                <Clock className="h-6 w-6 text-purple-600" />
              </div>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Main Content */}
      <Tabs defaultValue="overview" className="space-y-4">
        <TabsList>
          <TabsTrigger value="overview">Overview</TabsTrigger>
          <TabsTrigger value="logs">Recent Activity</TabsTrigger>
          <TabsTrigger value="statistics">Statistics</TabsTrigger>
          <TabsTrigger value="settings">Settings</TabsTrigger>
        </TabsList>

        <TabsContent value="overview" className="space-y-4">
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
            {/* Automation Steps */}
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <Zap className="h-5 w-5" />
                  Automation Steps
                </CardTitle>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="flex items-center gap-3">
                  <div className="p-2 rounded-full bg-blue-100">
                    <WashingMachine className="h-5 w-5 text-blue-600" />
                  </div>
                  <div className="flex-1">
                    <p className="font-medium">Laundry Processing</p>
                    <p className="text-sm text-gray-600">Template-based intelligent detection</p>
                  </div>
                  <Badge variant="secondary">Active</Badge>
                </div>

                <div className="flex items-center gap-3">
                  <div className="p-2 rounded-full bg-green-100">
                    <Package className="h-5 w-5 text-green-600" />
                  </div>
                  <div className="flex-1">
                    <p className="font-medium">Inventory Assessment</p>
                    <p className="text-sm text-gray-600">Comprehensive room evaluation</p>
                  </div>
                  <Badge variant="secondary">Active</Badge>
                </div>

                <div className="flex items-center gap-3">
                  <div className="p-2 rounded-full bg-purple-100">
                    <ClipboardList className="h-5 w-5 text-purple-600" />
                  </div>
                  <div className="flex-1">
                    <p className="font-medium">Housekeeping Tasks</p>
                    <p className="text-sm text-gray-600">Smart task creation and assignment</p>
                  </div>
                  <Badge variant="secondary">Active</Badge>
                </div>
              </CardContent>
            </Card>

            {/* Recent Activity Summary */}
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <Activity className="h-5 w-5" />
                  Recent Activity
                </CardTitle>
              </CardHeader>
              <CardContent>
                {recentLogs.length > 0 ? (
                  <div className="space-y-3">
                    {recentLogs.slice(0, 5).map((log) => (
                      <div key={log.id} className="flex items-center justify-between p-3 bg-gray-50 rounded-lg">
                        <div className="flex items-center gap-3">
                          {getStatusIcon(log.status)}
                          <div>
                            <p className="font-medium">Booking {log.bookingId}</p>
                            <p className="text-sm text-gray-600">Room {log.roomId}</p>
                          </div>
                        </div>
                        <Badge className={getStatusColor(log.status)}>
                          {log.status.replace('_', ' ')}
                        </Badge>
                      </div>
                    ))}
                  </div>
                ) : (
                  <p className="text-gray-500 text-center py-4">No recent activity</p>
                )}
              </CardContent>
            </Card>
          </div>
        </TabsContent>

        <TabsContent value="logs" className="space-y-4">
          <Card>
            <CardHeader>
              <CardTitle>Recent Automation Logs</CardTitle>
            </CardHeader>
            <CardContent>
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Booking</TableHead>
                    <TableHead>Room</TableHead>
                    <TableHead>Status</TableHead>
                    <TableHead>Steps</TableHead>
                    <TableHead>Time</TableHead>
                    <TableHead>Details</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {recentLogs.map((log) => (
                    <TableRow key={log.id}>
                      <TableCell className="font-medium">{log.bookingId}</TableCell>
                      <TableCell>{log.roomId}</TableCell>
                      <TableCell>
                        <Badge className={getStatusColor(log.status)}>
                          {getStatusIcon(log.status)}
                          <span className="ml-1">{log.status.replace('_', ' ')}</span>
                        </Badge>
                      </TableCell>
                      <TableCell>
                        <div className="flex gap-1">
                          {log.steps.laundry && <Badge variant="outline" className="text-xs">L</Badge>}
                          {log.steps.inventory && <Badge variant="outline" className="text-xs">I</Badge>}
                          {log.steps.housekeeping && <Badge variant="outline" className="text-xs">H</Badge>}
                        </div>
                      </TableCell>
                      <TableCell>{log.processingTime}s</TableCell>
                      <TableCell>
                        <Button variant="ghost" size="sm">
                          <Eye className="h-4 w-4" />
                        </Button>
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="statistics" className="space-y-4">
          {stats && (
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
              <Card>
                <CardHeader>
                  <CardTitle>Today</CardTitle>
                </CardHeader>
                <CardContent>
                  <div className="space-y-2">
                    <div className="flex justify-between">
                      <span>Processed:</span>
                      <span className="font-medium">{stats.today.processed}</span>
                    </div>
                    <div className="flex justify-between">
                      <span>Success:</span>
                      <span className="font-medium text-green-600">{stats.today.success}</span>
                    </div>
                    <div className="flex justify-between">
                      <span>Failed:</span>
                      <span className="font-medium text-red-600">{stats.today.failed}</span>
                    </div>
                    <div className="flex justify-between">
                      <span>Avg. Time:</span>
                      <span className="font-medium">{stats.today.averageTime}s</span>
                    </div>
                  </div>
                </CardContent>
              </Card>

              <Card>
                <CardHeader>
                  <CardTitle>This Week</CardTitle>
                </CardHeader>
                <CardContent>
                  <div className="space-y-2">
                    <div className="flex justify-between">
                      <span>Processed:</span>
                      <span className="font-medium">{stats.thisWeek.processed}</span>
                    </div>
                    <div className="flex justify-between">
                      <span>Success:</span>
                      <span className="font-medium text-green-600">{stats.thisWeek.success}</span>
                    </div>
                    <div className="flex justify-between">
                      <span>Failed:</span>
                      <span className="font-medium text-red-600">{stats.thisWeek.failed}</span>
                    </div>
                    <div className="flex justify-between">
                      <span>Avg. Time:</span>
                      <span className="font-medium">{stats.thisWeek.averageTime}s</span>
                    </div>
                  </div>
                </CardContent>
              </Card>

              <Card>
                <CardHeader>
                  <CardTitle>This Month</CardTitle>
                </CardHeader>
                <CardContent>
                  <div className="space-y-2">
                    <div className="flex justify-between">
                      <span>Processed:</span>
                      <span className="font-medium">{stats.thisMonth.processed}</span>
                    </div>
                    <div className="flex justify-between">
                      <span>Success:</span>
                      <span className="font-medium text-green-600">{stats.thisMonth.success}</span>
                    </div>
                    <div className="flex justify-between">
                      <span>Failed:</span>
                      <span className="font-medium text-red-600">{stats.thisMonth.failed}</span>
                    </div>
                    <div className="flex justify-between">
                      <span>Avg. Time:</span>
                      <span className="font-medium">{stats.thisMonth.averageTime}s</span>
                    </div>
                  </div>
                </CardContent>
              </Card>
            </div>
          )}
        </TabsContent>

        <TabsContent value="settings" className="space-y-4">
          <Card>
            <CardHeader>
              <CardTitle>Automation Settings</CardTitle>
            </CardHeader>
            <CardContent>
              <Alert>
                <Settings className="h-4 w-4" />
                <AlertDescription>
                  Automation settings can be configured through the main automation configuration page.
                  <Button variant="link" className="p-0 h-auto ml-2">
                    Go to Settings
                  </Button>
                </AlertDescription>
              </Alert>
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>
    </div>
  );
};

export default CheckoutAutomationDashboard;
