import React, { useState, useEffect } from 'react';
import { api } from '../../services/api';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '../ui/card';
import { Button } from '../ui/button';
import { Badge } from '../ui/badge';
import { Input } from '../ui/input';
import { Label } from '../ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '../ui/select';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '../ui/tabs';
import { Progress } from '../ui/progress';
import { Skeleton } from '../ui/skeleton';
import { toast } from 'sonner';
import {
  BarChart, Bar, LineChart, Line, PieChart, Pie, Cell, RadarChart, Radar,
  XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer, PolarGrid,
  PolarAngleAxis, PolarRadiusAxis, Area, AreaChart
} from 'recharts';
import {
  TrendingUp, TrendingDown, Users, Clock, CheckCircle, AlertTriangle,
  Activity, Award, Target, Calendar, Filter, Download, RefreshCw,
  UserCheck, Timer, User, BarChart3, PieChart as PieChartIcon,
  AlertCircle, ChevronUp, ChevronDown, Star, Zap
} from 'lucide-react';
import { format, subDays, startOfMonth, endOfMonth } from 'date-fns';

interface StaffMetrics {
  _id: string;
  staffName: string;
  totalTasks: number;
  totalCompleted: number;
  overallCompletionRate: number;
  avgCompletionTime: number;
  avgQualityScore: number;
  efficiencyScore: number;
  totalRoomsServiced: number;
  dailyMetrics: Array<{
    date: string;
    totalTasks: number;
    completedTasks: number;
    completionRate: number;
    averageCompletionTime: number;
    roomsServiced: number;
    averageQualityScore: number;
  }>;
}

interface BookingMetrics {
  byCreator: Array<{
    _id: string;
    staffName: string;
    bookingsCreated: number;
    averageBookingValue: number;
    corporateBookings: number;
    walkInBookings: number;
    onlineBookings: number;
  }>;
  byCheckInHandler: Array<{
    _id: string;
    staffName: string;
    checkInsHandled: number;
    averageCheckInTime: number;
    earlyCheckIns: number;
    lateCheckIns: number;
    averageProcessingTime: number;
  }>;
  byCheckOutHandler: Array<{
    _id: string;
    staffName: string;
    checkOutsHandled: number;
    averageCheckOutTime: number;
    earlyCheckOuts: number;
    lateCheckOuts: number;
  }>;
}

interface GuestServiceMetrics {
  _id: string;
  staffName: string;
  totalRequests: number;
  completedRequests: number;
  completionRate: number;
  averageResponseTime: number;
  averageResolutionTime: number;
  guestSatisfactionRating: number;
  urgentRequests: number;
  serviceScore: number;
}

interface TaskCompletionData {
  categoryMetrics: Array<{
    _id: string;
    totalTasksInCategory: number;
    totalCompletedInCategory: number;
    avgCompletionRate: number;
    avgOverdueRate: number;
    taskTypes: Array<{
      taskType: string;
      date: string;
      totalTasks: number;
      completedTasks: number;
      completionRate: number;
      overdueRate: number;
      averageTimeToComplete: number;
    }>;
  }>;
  staffPerformance: Array<{
    _id: string;
    staffName: string;
    department: string;
    totalTasks: number;
    completedTasks: number;
    completionRate: number;
    averageTimeToComplete: number;
  }>;
}

interface SchedulingData {
  workloadAnalysis: Array<{
    _id: string;
    hourlyDistribution: Array<{
      hour: number;
      dayOfWeek: number;
      taskCount: number;
      averageUrgency: number;
    }>;
    peakHours: number;
    totalTasks: number;
  }>;
  staffDemandAnalysis: Array<{
    _id: string;
    staffCount: number;
    totalTasksHandled: number;
    avgTasksPerStaff: number;
    avgTasksPerDay: number;
    staffDetails: Array<{
      name: string;
      tasksAssigned: number;
      tasksCompleted: number;
      dailyAverage: number;
    }>;
  }>;
  recommendations: Array<{
    department: string;
    peakHours: number[];
    recommendation: string;
    urgencyLevel: number;
  }>;
}

interface ProductivityData {
  housekeeping: {
    staffMetrics: StaffMetrics[];
    departmentSummary: {
      totalStaff: number;
      averageCompletionRate: number;
      averageEfficiencyScore: number;
      totalTasksHandled: number;
      totalRoomsServiced: number;
    };
  };
  frontDesk: {
    bookingMetrics: BookingMetrics;
    guestServiceMetrics: GuestServiceMetrics[];
  };
  taskCompletion: TaskCompletionData;
  scheduling: SchedulingData;
}

const COLORS = ['#3B82F6', '#10B981', '#F59E0B', '#EF4444', '#8B5CF6', '#EC4899', '#06B6D4', '#84CC16'];

const StaffProductivityDashboard: React.FC = () => {
  const [data, setData] = useState<ProductivityData | null>(null);
  const [loading, setLoading] = useState(true);
  const [filters, setFilters] = useState({
    startDate: format(subDays(new Date(), 30), 'yyyy-MM-dd'),
    endDate: format(new Date(), 'yyyy-MM-dd'),
    department: '',
    staffId: ''
  });
  const [selectedTab, setSelectedTab] = useState('overview');

  useEffect(() => {
    fetchProductivityData();
  }, []);

  const fetchProductivityData = async () => {
    try {
      setLoading(true);
      const { data: result } = await api.post('/analytics/staff-productivity', filters);
      if (result.success) {
        setData(result.data);
      } else {
        throw new Error(result.error || 'Failed to fetch data');
      }
    } catch (error) {
      toast.error('Failed to load staff productivity data');
    } finally {
      setLoading(false);
    }
  };

  const handleFilterChange = (key: string, value: string) => {
    setFilters(prev => ({
      ...prev,
      [key]: value
    }));
  };

  const applyFilters = () => {
    fetchProductivityData();
  };

  const exportReport = async (format: 'pdf' | 'xlsx') => {
    try {
      const response = await api.post('/analytics/staff-productivity/export', { ...filters, format }, { responseType: 'blob' });

      const blob = new Blob([response.data]);
      const url = URL.createObjectURL(blob);
      const link = document.createElement('a');
      link.href = url;
      link.download = `staff-productivity-report.${format}`;
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
      URL.revokeObjectURL(url);

      toast.success(`Report exported as ${format.toUpperCase()}`);
    } catch (error) {
      toast.error('Failed to export report');
    }
  };

  const getEfficiencyColor = (score: number) => {
    if (score >= 80) return 'bg-green-100 text-green-800';
    if (score >= 60) return 'bg-yellow-100 text-yellow-800';
    return 'bg-red-100 text-red-800';
  };

  const getStatusColor = (score: number) => {
    if (score >= 80) return 'text-green-600';
    if (score >= 60) return 'text-yellow-600';
    return 'text-red-600';
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-[400px]">
        <div className="flex items-center space-x-2">
          <RefreshCw className="w-6 h-6 animate-spin text-blue-600" />
          <span className="text-lg">Loading staff productivity data...</span>
        </div>
      </div>
    );
  }

  if (!data) {
    return (
      <div className="flex items-center justify-center min-h-[400px]">
        <div className="text-center">
          <AlertTriangle className="w-12 h-12 text-yellow-600 mx-auto mb-4" />
          <h3 className="text-lg font-semibold">No Data Available</h3>
          <p className="text-gray-600">Unable to load staff productivity data.</p>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-3xl font-bold text-gray-900">Staff Productivity Dashboard</h2>
          <p className="text-gray-600">Monitor staff performance and efficiency metrics</p>
        </div>
        <div className="flex items-center space-x-2">
          <Button variant="outline" onClick={() => exportReport('xlsx')} className="flex items-center space-x-2">
            <Download className="w-4 h-4" />
            <span>Excel</span>
          </Button>
          <Button variant="outline" onClick={() => exportReport('pdf')} className="flex items-center space-x-2">
            <Download className="w-4 h-4" />
            <span>PDF</span>
          </Button>
          <Button onClick={fetchProductivityData} className="flex items-center space-x-2">
            <RefreshCw className="w-4 h-4" />
            <span>Refresh</span>
          </Button>
        </div>
      </div>

      {/* Filters */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center space-x-2">
            <Filter className="w-5 h-5" />
            <span>Filters</span>
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
            <div>
              <Label htmlFor="startDate">Start Date</Label>
              <Input
                id="startDate"
                type="date"
                value={filters.startDate}
                onChange={(e) => handleFilterChange('startDate', e.target.value)}
              />
            </div>
            <div>
              <Label htmlFor="endDate">End Date</Label>
              <Input
                id="endDate"
                type="date"
                value={filters.endDate}
                onChange={(e) => handleFilterChange('endDate', e.target.value)}
              />
            </div>
            <div>
              <Label htmlFor="department">Department</Label>
              <Select value={filters.department} onValueChange={(value) => handleFilterChange('department', value)}>
                <SelectTrigger>
                  <SelectValue placeholder="All Departments" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="">All Departments</SelectItem>
                  <SelectItem value="housekeeping">Housekeeping</SelectItem>
                  <SelectItem value="front_desk">Front Desk</SelectItem>
                  <SelectItem value="maintenance">Maintenance</SelectItem>
                  <SelectItem value="guest_service">Guest Service</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div className="flex items-end">
              <Button onClick={applyFilters} className="w-full">Apply Filters</Button>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Overview Cards */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
        <Card>
          <CardContent className="p-6">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm font-medium text-gray-600">Total Staff</p>
                <p className="text-2xl font-bold text-gray-900">
                  {data.housekeeping.departmentSummary.totalStaff}
                </p>
              </div>
              <div className="p-3 bg-blue-100 rounded-lg">
                <Users className="w-6 h-6 text-blue-600" />
              </div>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardContent className="p-6">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm font-medium text-gray-600">Avg Completion Rate</p>
                <p className="text-2xl font-bold text-gray-900">
                  {data.housekeeping.departmentSummary.averageCompletionRate.toFixed(1)}%
                </p>
              </div>
              <div className="p-3 bg-green-100 rounded-lg">
                <CheckCircle className="w-6 h-6 text-green-600" />
              </div>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardContent className="p-6">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm font-medium text-gray-600">Avg Efficiency Score</p>
                <p className="text-2xl font-bold text-gray-900">
                  {data.housekeeping.departmentSummary.averageEfficiencyScore.toFixed(1)}
                </p>
              </div>
              <div className="p-3 bg-purple-100 rounded-lg">
                <Award className="w-6 h-6 text-purple-600" />
              </div>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardContent className="p-6">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm font-medium text-gray-600">Tasks Handled</p>
                <p className="text-2xl font-bold text-gray-900">
                  {data.housekeeping.departmentSummary.totalTasksHandled.toLocaleString()}
                </p>
              </div>
              <div className="p-3 bg-orange-100 rounded-lg">
                <Target className="w-6 h-6 text-orange-600" />
              </div>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Main Content Tabs */}
      <Tabs value={selectedTab} onValueChange={setSelectedTab}>
        <TabsList className="grid w-full grid-cols-4">
          <TabsTrigger value="overview">Overview</TabsTrigger>
          <TabsTrigger value="housekeeping">Housekeeping</TabsTrigger>
          <TabsTrigger value="frontdesk">Front Desk</TabsTrigger>
          <TabsTrigger value="scheduling">Scheduling</TabsTrigger>
        </TabsList>

        <TabsContent value="overview" className="space-y-6">
          {/* Department Comparison */}
          <Card>
            <CardHeader>
              <CardTitle>Department Performance Comparison</CardTitle>
            </CardHeader>
            <CardContent>
              <ResponsiveContainer width="100%" height={300}>
                <BarChart data={data.taskCompletion.categoryMetrics}>
                  <CartesianGrid strokeDasharray="3 3" />
                  <XAxis dataKey="_id" />
                  <YAxis />
                  <Tooltip />
                  <Legend />
                  <Bar dataKey="avgCompletionRate" fill="#8884d8" name="Completion Rate %" />
                  <Bar dataKey="avgOverdueRate" fill="#ff7c7c" name="Overdue Rate %" />
                </BarChart>
              </ResponsiveContainer>
            </CardContent>
          </Card>

          {/* Top Performers */}
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
            <Card>
              <CardHeader>
                <CardTitle>Top Performing Staff</CardTitle>
              </CardHeader>
              <CardContent>
                <div className="space-y-4">
                  {data.taskCompletion.staffPerformance.slice(0, 5).map((staff, index) => (
                    <div key={staff._id} className="flex items-center justify-between p-3 bg-gray-50 rounded-lg">
                      <div className="flex items-center space-x-3">
                        <div className="flex items-center justify-center w-8 h-8 bg-blue-100 rounded-full text-sm font-bold text-blue-600">
                          {index + 1}
                        </div>
                        <div>
                          <p className="font-medium">{staff.staffName}</p>
                          <p className="text-sm text-gray-600">{staff.department}</p>
                        </div>
                      </div>
                      <div className="text-right">
                        <p className="font-semibold text-green-600">{staff.completionRate.toFixed(1)}%</p>
                        <p className="text-xs text-gray-500">{staff.completedTasks}/{staff.totalTasks} tasks</p>
                      </div>
                    </div>
                  ))}
                </div>
              </CardContent>
            </Card>

            {/* Scheduling Recommendations */}
            <Card>
              <CardHeader>
                <CardTitle>Scheduling Recommendations</CardTitle>
              </CardHeader>
              <CardContent>
                <div className="space-y-4">
                  {data.scheduling.recommendations.slice(0, 5).map((rec, index) => (
                    <div key={`rec-${index}`} className="p-3 border rounded-lg">
                      <div className="flex items-center justify-between mb-2">
                        <Badge variant="outline">{rec.department}</Badge>
                        <div className="flex">
                          {Array.from({ length: rec.urgencyLevel }).map((_, i) => (
                            <Star key={i} className="w-3 h-3 fill-yellow-400 text-yellow-400" />
                          ))}
                        </div>
                      </div>
                      <p className="text-sm text-gray-700">{rec.recommendation}</p>
                      <div className="flex items-center space-x-2 mt-2">
                        <Clock className="w-4 h-4 text-gray-400" />
                        <span className="text-xs text-gray-500">
                          Peak hours: {rec.peakHours.join(', ')}
                        </span>
                      </div>
                    </div>
                  ))}
                </div>
              </CardContent>
            </Card>
          </div>
        </TabsContent>

        <TabsContent value="housekeeping" className="space-y-6">
          {/* Housekeeping Staff Performance */}
          <Card>
            <CardHeader>
              <CardTitle>Housekeeping Staff Efficiency</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="overflow-x-auto">
                <table className="w-full">
                  <thead>
                    <tr className="border-b">
                      <th className="text-left p-2">Staff Name</th>
                      <th className="text-center p-2">Tasks</th>
                      <th className="text-center p-2">Completion Rate</th>
                      <th className="text-center p-2">Avg Time (min)</th>
                      <th className="text-center p-2">Quality Score</th>
                      <th className="text-center p-2">Efficiency Score</th>
                      <th className="text-center p-2">Rooms Serviced</th>
                    </tr>
                  </thead>
                  <tbody>
                    {data.housekeeping.staffMetrics.map((staff) => (
                      <tr key={staff._id} className="border-b hover:bg-gray-50">
                        <td className="p-2">
                          <div className="flex items-center space-x-2">
                            <User className="w-4 h-4 text-gray-400" />
                            <span className="font-medium">{staff.staffName}</span>
                          </div>
                        </td>
                        <td className="text-center p-2">
                          {staff.totalCompleted}/{staff.totalTasks}
                        </td>
                        <td className="text-center p-2">
                          <Badge className={getEfficiencyColor(staff.overallCompletionRate)}>
                            {staff.overallCompletionRate.toFixed(1)}%
                          </Badge>
                        </td>
                        <td className="text-center p-2">
                          {staff.avgCompletionTime?.toFixed(0) || 'N/A'}
                        </td>
                        <td className="text-center p-2">
                          <div className="flex items-center justify-center">
                            <Star className="w-4 h-4 fill-yellow-400 text-yellow-400 mr-1" />
                            {staff.avgQualityScore?.toFixed(1) || 'N/A'}
                          </div>
                        </td>
                        <td className="text-center p-2">
                          <Badge className={getEfficiencyColor(staff.efficiencyScore)}>
                            {staff.efficiencyScore.toFixed(0)}
                          </Badge>
                        </td>
                        <td className="text-center p-2">
                          {staff.totalRoomsServiced}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </CardContent>
          </Card>

          {/* Efficiency Trends */}
          {data.housekeeping.staffMetrics.length > 0 && data.housekeeping.staffMetrics[0].dailyMetrics && (
            <Card>
              <CardHeader>
                <CardTitle>Efficiency Trends</CardTitle>
              </CardHeader>
              <CardContent>
                <ResponsiveContainer width="100%" height={300}>
                  <LineChart data={data.housekeeping.staffMetrics[0].dailyMetrics}>
                    <CartesianGrid strokeDasharray="3 3" />
                    <XAxis dataKey="date" />
                    <YAxis />
                    <Tooltip />
                    <Legend />
                    <Line 
                      type="monotone" 
                      dataKey="completionRate" 
                      stroke="#8884d8" 
                      name="Completion Rate %" 
                    />
                    <Line 
                      type="monotone" 
                      dataKey="averageQualityScore" 
                      stroke="#82ca9d" 
                      name="Quality Score" 
                    />
                  </LineChart>
                </ResponsiveContainer>
              </CardContent>
            </Card>
          )}
        </TabsContent>

        <TabsContent value="frontdesk" className="space-y-6">
          {/* Front Desk Metrics */}
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
            {/* Booking Performance */}
            <Card>
              <CardHeader>
                <CardTitle>Booking Creation Performance</CardTitle>
              </CardHeader>
              <CardContent>
                <div className="space-y-4">
                  {data.frontDesk.bookingMetrics?.byCreator?.map((staff) => (
                    <div key={staff._id} className="flex items-center justify-between p-3 bg-gray-50 rounded-lg">
                      <div>
                        <p className="font-medium">{staff.staffName}</p>
                        <p className="text-sm text-gray-600">{staff.bookingsCreated} bookings</p>
                      </div>
                      <div className="text-right">
                        <p className="text-sm font-medium">${staff.averageBookingValue?.toFixed(0) || 0}</p>
                        <div className="flex space-x-2 text-xs">
                          <span className="text-blue-600">{staff.corporateBookings} corp</span>
                          <span className="text-green-600">{staff.walkInBookings} walk</span>
                          <span className="text-purple-600">{staff.onlineBookings} online</span>
                        </div>
                      </div>
                    </div>
                  )) || <p className="text-gray-500">No booking data available</p>}
                </div>
              </CardContent>
            </Card>

            {/* Guest Service Performance */}
            <Card>
              <CardHeader>
                <CardTitle>Guest Service Performance</CardTitle>
              </CardHeader>
              <CardContent>
                <div className="space-y-4">
                  {data.frontDesk.guestServiceMetrics.slice(0, 5).map((staff) => (
                    <div key={staff._id} className="flex items-center justify-between p-3 bg-gray-50 rounded-lg">
                      <div>
                        <p className="font-medium">{staff.staffName}</p>
                        <p className="text-sm text-gray-600">
                          {staff.completedRequests}/{staff.totalRequests} requests
                        </p>
                      </div>
                      <div className="text-right">
                        <div className="flex items-center space-x-2">
                          <Badge className={getEfficiencyColor(staff.serviceScore)}>
                            {staff.serviceScore.toFixed(0)}
                          </Badge>
                          <div className="flex items-center">
                            <Star className="w-3 h-3 fill-yellow-400 text-yellow-400" />
                            <span className="text-xs ml-1">
                              {staff.guestSatisfactionRating?.toFixed(1) || 'N/A'}
                            </span>
                          </div>
                        </div>
                        <div className="flex items-center space-x-2 text-xs text-gray-500 mt-1">
                          <Timer className="w-3 h-3" />
                          <span>{staff.averageResponseTime?.toFixed(0) || 0}m response</span>
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              </CardContent>
            </Card>
          </div>

          {/* Check-in/Check-out Performance */}
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
            <Card>
              <CardHeader>
                <CardTitle>Check-in Performance</CardTitle>
              </CardHeader>
              <CardContent>
                <ResponsiveContainer width="100%" height={250}>
                  <BarChart data={data.frontDesk.bookingMetrics?.byCheckInHandler || []}>
                    <CartesianGrid strokeDasharray="3 3" />
                    <XAxis dataKey="staffName" />
                    <YAxis />
                    <Tooltip />
                    <Bar dataKey="checkInsHandled" fill="#8884d8" name="Check-ins Handled" />
                  </BarChart>
                </ResponsiveContainer>
              </CardContent>
            </Card>

            <Card>
              <CardHeader>
                <CardTitle>Check-out Performance</CardTitle>
              </CardHeader>
              <CardContent>
                <ResponsiveContainer width="100%" height={250}>
                  <BarChart data={data.frontDesk.bookingMetrics?.byCheckOutHandler || []}>
                    <CartesianGrid strokeDasharray="3 3" />
                    <XAxis dataKey="staffName" />
                    <YAxis />
                    <Tooltip />
                    <Bar dataKey="checkOutsHandled" fill="#82ca9d" name="Check-outs Handled" />
                  </BarChart>
                </ResponsiveContainer>
              </CardContent>
            </Card>
          </div>
        </TabsContent>

        <TabsContent value="scheduling" className="space-y-6">
          {/* Workload Analysis */}
          <Card>
            <CardHeader>
              <CardTitle>Staff Workload Analysis</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
                {data.scheduling.staffDemandAnalysis.map((dept) => (
                  <div key={dept._id} className="p-4 border rounded-lg">
                    <div className="flex items-center justify-between mb-4">
                      <h4 className="font-semibold capitalize">{dept._id}</h4>
                      <Badge variant="outline">{dept.staffCount} staff</Badge>
                    </div>
                    <div className="space-y-2">
                      <div className="flex justify-between">
                        <span className="text-sm text-gray-600">Total Tasks:</span>
                        <span className="font-medium">{dept.totalTasksHandled}</span>
                      </div>
                      <div className="flex justify-between">
                        <span className="text-sm text-gray-600">Avg per Staff:</span>
                        <span className="font-medium">{dept.avgTasksPerStaff.toFixed(1)}</span>
                      </div>
                      <div className="flex justify-between">
                        <span className="text-sm text-gray-600">Daily Average:</span>
                        <span className="font-medium">{dept.avgTasksPerDay.toFixed(1)}</span>
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            </CardContent>
          </Card>

          {/* Peak Hours Analysis */}
          <Card>
            <CardHeader>
              <CardTitle>Peak Hours Analysis</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
                {data.scheduling.workloadAnalysis.slice(0, 2).map((dept) => (
                  <div key={dept._id}>
                    <h4 className="font-semibold capitalize mb-4">{dept._id} Department</h4>
                    <ResponsiveContainer width="100%" height={200}>
                      <BarChart data={dept.hourlyDistribution.slice(0, 12)}>
                        <CartesianGrid strokeDasharray="3 3" />
                        <XAxis dataKey="hour" />
                        <YAxis />
                        <Tooltip />
                        <Bar dataKey="taskCount" fill="#8884d8" />
                      </BarChart>
                    </ResponsiveContainer>
                  </div>
                ))}
              </div>
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>
    </div>
  );
};

export default StaffProductivityDashboard;