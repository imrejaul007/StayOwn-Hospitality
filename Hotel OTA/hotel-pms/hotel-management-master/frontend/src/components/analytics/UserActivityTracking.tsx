import React, { useState, useEffect, useMemo, useCallback } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '../ui/card';
import { Button } from '../ui/button';
import { Input } from '../ui/input';
import { Label } from '../ui/label';
import { Badge } from '../ui/badge';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '../ui/select';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '../ui/tabs';
import { Progress } from '../ui/progress';
import { ScrollArea } from '../ui/scroll-area';
import { Pagination } from '../ui/Pagination';
import OptimizedSearch from '../ui/OptimizedSearch';
import {
  User,
  Activity,
  Clock,
  Eye,
  Mouse,
  Smartphone,
  Monitor,
  Globe,
  MapPin,
  TrendingUp,
  TrendingDown,
  BarChart3,
  PieChart,
  Calendar,
  Download,
  RefreshCw,
  Filter,
  Users,
  Timer,
  MousePointer
} from 'lucide-react';
import { format, subDays, startOfDay, endOfDay } from 'date-fns';
import { withErrorBoundary } from '../ErrorBoundary';
import { api } from '../../services/api';

interface UserSession {
  id: string;
  userId: string;
  userName: string;
  userEmail: string;
  userRole: string;
  startTime: Date;
  endTime?: Date;
  duration: number; // in minutes
  ipAddress: string;
  userAgent: string;
  device: {
    type: 'desktop' | 'mobile' | 'tablet';
    os: string;
    browser: string;
  };
  location: {
    country: string;
    city: string;
    timezone: string;
  };
  activities: UserActivity[];
  pages: PageVisit[];
  status: 'active' | 'ended' | 'timeout';
}

interface UserActivity {
  id: string;
  timestamp: Date;
  type: 'page_view' | 'click' | 'form_submit' | 'api_call' | 'download' | 'search';
  target: string;
  details: Record<string, unknown>;
  duration?: number;
}

interface PageVisit {
  id: string;
  path: string;
  title: string;
  timestamp: Date;
  duration: number; // in seconds
  exitType: 'navigation' | 'close' | 'timeout' | 'refresh';
}

interface UserMetrics {
  totalUsers: number;
  activeUsers: number;
  newUsers: number;
  returningUsers: number;
  averageSessionDuration: number;
  bounceRate: number;
  pageViews: number;
  uniquePageViews: number;
  topPages: { path: string; title: string; views: number; }[];
  topDevices: { type: string; count: number; percentage: number; }[];
  topCountries: { country: string; count: number; percentage: number; }[];
}

interface UserActivityTrackingProps {
  propertyGroupId?: string;
  dateRange?: { start: Date; end: Date };
  onExportReport?: (data: Record<string, unknown>, format: string) => void;
}

const emptyMetrics: UserMetrics = {
  totalUsers: 0,
  activeUsers: 0,
  newUsers: 0,
  returningUsers: 0,
  averageSessionDuration: 0,
  bounceRate: 0,
  pageViews: 0,
  uniquePageViews: 0,
  topPages: [],
  topDevices: [],
  topCountries: []
};

const getDeviceIcon = (deviceType: string) => {
  switch (deviceType.toLowerCase()) {
    case 'mobile': return <Smartphone className="h-4 w-4" />;
    case 'tablet': return <Smartphone className="h-4 w-4" />;
    case 'desktop': return <Monitor className="h-4 w-4" />;
    default: return <Monitor className="h-4 w-4" />;
  }
};

const getActivityIcon = (activityType: string) => {
  switch (activityType) {
    case 'page_view': return <Eye className="h-3 w-3" />;
    case 'click': return <MousePointer className="h-3 w-3" />;
    case 'form_submit': return <Activity className="h-3 w-3" />;
    case 'api_call': return <Globe className="h-3 w-3" />;
    case 'download': return <Download className="h-3 w-3" />;
    case 'search': return <Filter className="h-3 w-3" />;
    default: return <Activity className="h-3 w-3" />;
  }
};

const getStatusColor = (status: string) => {
  switch (status) {
    case 'active': return 'text-green-600 bg-green-50 border-green-200';
    case 'ended': return 'text-blue-600 bg-blue-50 border-blue-200';
    case 'timeout': return 'text-yellow-600 bg-yellow-50 border-yellow-200';
    default: return 'text-gray-600 bg-gray-50 border-gray-200';
  }
};

const UserActivityTracking: React.FC<UserActivityTrackingProps> = ({
  propertyGroupId,
  dateRange,
  onExportReport
}) => {
  const [searchTerm, setSearchTerm] = useState('');
  const [roleFilter, setRoleFilter] = useState('all');
  const [deviceFilter, setDeviceFilter] = useState('all');
  const [statusFilter, setStatusFilter] = useState('all');
  const [selectedSession, setSelectedSession] = useState<UserSession | null>(null);
  const [currentPage, setCurrentPage] = useState(1);
  const [itemsPerPage, setItemsPerPage] = useState(10);
  const [dateFrom, setDateFrom] = useState('');
  const [dateTo, setDateTo] = useState('');

  const [sessions, setSessions] = useState<UserSession[]>([]);
  const [userMetrics, setUserMetrics] = useState<UserMetrics>(emptyMetrics);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const fetchData = useCallback(async () => {
    try {
      setLoading(true);
      setError(null);

      const [analyticsRes, sessionsRes] = await Promise.allSettled([
        api.get('/login-activity/analytics'),
        api.get('/login-activity/sessions/active')
      ]);

      // Process analytics data
      if (analyticsRes.status === 'fulfilled' && analyticsRes.value.data?.data) {
        const data = analyticsRes.value.data.data;
        setUserMetrics({
          totalUsers: data.totalUsers || 0,
          activeUsers: data.activeUsers || 0,
          newUsers: data.newUsers || 0,
          returningUsers: data.returningUsers || 0,
          averageSessionDuration: data.averageSessionDuration || 0,
          bounceRate: data.bounceRate || 0,
          pageViews: data.pageViews || 0,
          uniquePageViews: data.uniquePageViews || 0,
          topPages: data.topPages || [],
          topDevices: data.topDevices || [],
          topCountries: data.topCountries || []
        });
      } else {
        setUserMetrics(emptyMetrics);
      }

      // Process sessions data
      if (sessionsRes.status === 'fulfilled' && sessionsRes.value.data?.data) {
        const rawSessions = Array.isArray(sessionsRes.value.data.data)
          ? sessionsRes.value.data.data
          : sessionsRes.value.data.data.sessions || [];

        const mappedSessions: UserSession[] = rawSessions.map((s: Record<string, unknown>, idx: number) => ({
          id: (s._id as string) || (s.id as string) || `session-${idx}`,
          userId: (s.userId as string) || '',
          userName: (s.userName as string) || (s.user as Record<string, unknown>)?.name as string || 'Unknown',
          userEmail: (s.userEmail as string) || (s.user as Record<string, unknown>)?.email as string || '',
          userRole: (s.userRole as string) || (s.role as string) || 'unknown',
          startTime: s.startTime ? new Date(s.startTime as string) : new Date(s.createdAt as string || Date.now()),
          endTime: s.endTime ? new Date(s.endTime as string) : undefined,
          duration: (s.duration as number) || 0,
          ipAddress: (s.ipAddress as string) || (s.ip as string) || '',
          userAgent: (s.userAgent as string) || '',
          device: (s.device as UserSession['device']) || { type: 'desktop', os: 'Unknown', browser: 'Unknown' },
          location: (s.location as UserSession['location']) || { country: 'Unknown', city: 'Unknown', timezone: '' },
          activities: (s.activities as UserActivity[]) || [],
          pages: (s.pages as PageVisit[]) || [],
          status: (s.status as UserSession['status']) || 'active'
        }));

        setSessions(mappedSessions);
      } else {
        setSessions([]);
      }
    } catch (err) {
      setError('Failed to load activity data');
      setSessions([]);
      setUserMetrics(emptyMetrics);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchData();
  }, [fetchData]);

  // Filter sessions based on criteria
  const filteredSessions = useMemo(() => {
    return sessions.filter(session => {
      const matchesSearch = !searchTerm ||
        session.userName.toLowerCase().includes(searchTerm.toLowerCase()) ||
        session.userEmail.toLowerCase().includes(searchTerm.toLowerCase()) ||
        session.ipAddress.includes(searchTerm);

      const matchesRole = roleFilter === 'all' || session.userRole === roleFilter;
      const matchesDevice = deviceFilter === 'all' || session.device.type === deviceFilter;
      const matchesStatus = statusFilter === 'all' || session.status === statusFilter;

      const matchesDateFrom = !dateFrom || session.startTime >= new Date(dateFrom);
      const matchesDateTo = !dateTo || session.startTime <= endOfDay(new Date(dateTo));

      return matchesSearch && matchesRole && matchesDevice && matchesStatus &&
             matchesDateFrom && matchesDateTo;
    });
  }, [sessions, searchTerm, roleFilter, deviceFilter, statusFilter, dateFrom, dateTo]);

  // Paginate results
  const paginatedSessions = useMemo(() => {
    const startIndex = (currentPage - 1) * itemsPerPage;
    return filteredSessions.slice(startIndex, startIndex + itemsPerPage);
  }, [filteredSessions, currentPage, itemsPerPage]);

  const totalPages = Math.ceil(filteredSessions.length / itemsPerPage);

  const handleExportReport = (exportFormat: string) => {
    const reportData = {
      sessions: filteredSessions,
      metrics: userMetrics,
      filters: {
        searchTerm,
        roleFilter,
        deviceFilter,
        statusFilter,
        dateFrom,
        dateTo
      },
      generatedAt: new Date(),
      propertyGroupId
    };

    if (onExportReport) {
      onExportReport(reportData, exportFormat);
    }
  };

  if (loading) {
    return (
      <div className="space-y-6">
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
          {[1, 2, 3, 4].map(i => (
            <Card key={i}>
              <CardContent className="p-4 text-center">
                <div className="h-8 w-16 bg-gray-200 rounded animate-pulse mx-auto mb-2" />
                <div className="h-4 w-20 bg-gray-100 rounded animate-pulse mx-auto" />
              </CardContent>
            </Card>
          ))}
        </div>
      </div>
    );
  }

  if (error && sessions.length === 0) {
    return (
      <Card>
        <CardContent className="p-8 text-center">
          <Activity className="h-12 w-12 text-gray-300 mx-auto mb-4" />
          <h3 className="text-lg font-medium text-gray-900 mb-2">No activity data available</h3>
          <p className="text-sm text-gray-500 mb-4">
            Unable to load user activity data. This may be due to permissions or the service being unavailable.
          </p>
          <Button variant="outline" onClick={fetchData}>
            <RefreshCw className="h-4 w-4 mr-2" />
            Retry
          </Button>
        </CardContent>
      </Card>
    );
  }

  return (
    <div className="space-y-6">
      {/* Metrics Overview */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        <Card>
          <CardContent className="p-4 text-center">
            <div className="text-2xl font-bold text-blue-600">{userMetrics.totalUsers}</div>
            <div className="text-sm text-muted-foreground">Total Users</div>
          </CardContent>
        </Card>

        <Card>
          <CardContent className="p-4 text-center">
            <div className="text-2xl font-bold text-green-600">{userMetrics.activeUsers}</div>
            <div className="text-sm text-muted-foreground">Active Now</div>
          </CardContent>
        </Card>

        <Card>
          <CardContent className="p-4 text-center">
            <div className="text-2xl font-bold text-orange-600">{userMetrics.averageSessionDuration}m</div>
            <div className="text-sm text-muted-foreground">Avg Session</div>
          </CardContent>
        </Card>

        <Card>
          <CardContent className="p-4 text-center">
            <div className="text-2xl font-bold text-purple-600">{userMetrics.pageViews}</div>
            <div className="text-sm text-muted-foreground">Page Views</div>
          </CardContent>
        </Card>
      </div>

      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Activity className="h-5 w-5" />
            User Activity Tracking
            <Badge variant="secondary" className="ml-2">
              {filteredSessions.length} sessions
            </Badge>
          </CardTitle>
        </CardHeader>
        <CardContent>
          <Tabs defaultValue="sessions" className="space-y-4">
            <TabsList>
              <TabsTrigger value="sessions">User Sessions</TabsTrigger>
              <TabsTrigger value="analytics">Analytics</TabsTrigger>
              <TabsTrigger value="real-time">Real-time Activity</TabsTrigger>
            </TabsList>

            <TabsContent value="sessions" className="space-y-4">
              {/* Filters and Search */}
              <div className="flex flex-col lg:flex-row gap-4">
                <div className="flex-1">
                  <OptimizedSearch
                    placeholder="Search by user, email, or IP address..."
                    onSearch={setSearchTerm}
                    initialValue={searchTerm}
                  />
                </div>

                <div className="flex gap-2">
                  <Button variant="outline" onClick={() => handleExportReport('csv')}>
                    <Download className="h-4 w-4 mr-2" />
                    Export CSV
                  </Button>
                  <Button variant="outline" onClick={() => handleExportReport('pdf')}>
                    <Download className="h-4 w-4 mr-2" />
                    Export PDF
                  </Button>
                  <Button variant="outline" onClick={fetchData}>
                    <RefreshCw className="h-4 w-4 mr-2" />
                    Refresh
                  </Button>
                </div>
              </div>

              {/* Quick Filters */}
              <div className="flex flex-wrap gap-2">
                <Select value={roleFilter} onValueChange={setRoleFilter}>
                  <SelectTrigger className="w-32">
                    <SelectValue placeholder="Role" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="all">All Roles</SelectItem>
                    <SelectItem value="admin">Admin</SelectItem>
                    <SelectItem value="staff">Staff</SelectItem>
                    <SelectItem value="manager">Manager</SelectItem>
                    <SelectItem value="guest">Guest</SelectItem>
                  </SelectContent>
                </Select>

                <Select value={deviceFilter} onValueChange={setDeviceFilter}>
                  <SelectTrigger className="w-32">
                    <SelectValue placeholder="Device" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="all">All Devices</SelectItem>
                    <SelectItem value="desktop">Desktop</SelectItem>
                    <SelectItem value="mobile">Mobile</SelectItem>
                    <SelectItem value="tablet">Tablet</SelectItem>
                  </SelectContent>
                </Select>

                <Select value={statusFilter} onValueChange={setStatusFilter}>
                  <SelectTrigger className="w-32">
                    <SelectValue placeholder="Status" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="all">All Status</SelectItem>
                    <SelectItem value="active">Active</SelectItem>
                    <SelectItem value="ended">Ended</SelectItem>
                    <SelectItem value="timeout">Timeout</SelectItem>
                  </SelectContent>
                </Select>

                <Input
                  type="date"
                  placeholder="From Date"
                  value={dateFrom}
                  onChange={(e) => setDateFrom(e.target.value)}
                  className="w-40"
                />

                <Input
                  type="date"
                  placeholder="To Date"
                  value={dateTo}
                  onChange={(e) => setDateTo(e.target.value)}
                  className="w-40"
                />
              </div>

              {/* User Sessions List */}
              <div className="space-y-2">
                {paginatedSessions.length === 0 ? (
                  <Card>
                    <CardContent className="p-8 text-center">
                      <Users className="h-10 w-10 text-gray-300 mx-auto mb-3" />
                      <h3 className="text-base font-medium text-gray-700">No active sessions</h3>
                      <p className="text-sm text-gray-500 mt-1">
                        There are no user sessions matching your filters.
                      </p>
                    </CardContent>
                  </Card>
                ) : (
                  paginatedSessions.map((session) => (
                    <Card key={session.id} className="hover:shadow-md transition-shadow cursor-pointer"
                          onClick={() => setSelectedSession(session)}>
                      <CardContent className="p-4">
                        <div className="flex items-start justify-between">
                          <div className="flex items-start gap-3 flex-1">
                            <div className="flex flex-col items-center gap-1">
                              {getDeviceIcon(session.device.type)}
                              <Badge className={`${getStatusColor(session.status)} border text-xs px-2 py-0.5`}>
                                {session.status}
                              </Badge>
                            </div>

                            <div className="flex-1 min-w-0">
                              <div className="flex items-center gap-2 mb-1">
                                <span className="font-medium">{session.userName}</span>
                                <Badge variant="outline">{session.userRole}</Badge>
                              </div>

                              <p className="text-sm text-muted-foreground mb-2">
                                {session.userEmail} {session.location.city !== 'Unknown' && `\u2022 ${session.location.city}, ${session.location.country}`}
                              </p>

                              <div className="grid grid-cols-2 md:grid-cols-4 gap-4 text-xs text-muted-foreground">
                                <div className="flex items-center gap-1">
                                  <Clock className="h-3 w-3" />
                                  {format(session.startTime, 'MMM dd, HH:mm')}
                                </div>
                                <div className="flex items-center gap-1">
                                  <Timer className="h-3 w-3" />
                                  {session.duration}m
                                </div>
                                <div className="flex items-center gap-1">
                                  <Eye className="h-3 w-3" />
                                  {session.pages.length} pages
                                </div>
                                <div className="flex items-center gap-1">
                                  <Activity className="h-3 w-3" />
                                  {session.activities.length} actions
                                </div>
                              </div>

                              <div className="flex items-center gap-4 mt-2 text-xs text-muted-foreground">
                                {session.ipAddress && <span>IP: {session.ipAddress}</span>}
                                <span>{session.device.os} {session.device.browser && `\u2022 ${session.device.browser}`}</span>
                              </div>
                            </div>
                          </div>

                          <Button variant="ghost" size="sm">
                            <Eye className="h-4 w-4" />
                          </Button>
                        </div>
                      </CardContent>
                    </Card>
                  ))
                )}
              </div>

              {/* Pagination */}
              {totalPages > 1 && (
                <Pagination
                  currentPage={currentPage}
                  totalPages={totalPages}
                  totalItems={filteredSessions.length}
                  itemsPerPage={itemsPerPage}
                  onPageChange={setCurrentPage}
                  onItemsPerPageChange={setItemsPerPage}
                />
              )}
            </TabsContent>

            <TabsContent value="analytics" className="space-y-6">
              {userMetrics.topPages.length === 0 && userMetrics.topDevices.length === 0 ? (
                <Card>
                  <CardContent className="p-8 text-center">
                    <BarChart3 className="h-10 w-10 text-gray-300 mx-auto mb-3" />
                    <h3 className="text-base font-medium text-gray-700">No analytics data available</h3>
                    <p className="text-sm text-gray-500 mt-1">
                      Analytics data will appear once there is sufficient user activity.
                    </p>
                  </CardContent>
                </Card>
              ) : (
                <>
                  {/* Top Pages */}
                  <Card>
                    <CardHeader>
                      <CardTitle className="flex items-center gap-2">
                        <BarChart3 className="h-5 w-5" />
                        Top Pages
                      </CardTitle>
                    </CardHeader>
                    <CardContent>
                      <div className="space-y-3">
                        {userMetrics.topPages.map((page) => (
                          <div key={page.path} className="flex items-center justify-between">
                            <div className="flex-1">
                              <div className="font-medium text-sm">{page.title}</div>
                              <div className="text-xs text-muted-foreground">{page.path}</div>
                            </div>
                            <div className="flex items-center gap-3">
                              <div className="text-sm font-medium">{page.views} views</div>
                              <div className="w-20">
                                <Progress value={userMetrics.topPages[0] ? (page.views / userMetrics.topPages[0].views) * 100 : 0} />
                              </div>
                            </div>
                          </div>
                        ))}
                      </div>
                    </CardContent>
                  </Card>

                  {/* Device Distribution */}
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                    <Card>
                      <CardHeader>
                        <CardTitle className="flex items-center gap-2">
                          <PieChart className="h-5 w-5" />
                          Device Types
                        </CardTitle>
                      </CardHeader>
                      <CardContent>
                        <div className="space-y-3">
                          {userMetrics.topDevices.map((device) => (
                            <div key={device.type} className="flex items-center justify-between">
                              <div className="flex items-center gap-2">
                                {getDeviceIcon(device.type)}
                                <span className="text-sm">{device.type}</span>
                              </div>
                              <div className="flex items-center gap-3">
                                <span className="text-sm font-medium">{device.percentage}%</span>
                                <div className="w-16">
                                  <Progress value={device.percentage} />
                                </div>
                              </div>
                            </div>
                          ))}
                        </div>
                      </CardContent>
                    </Card>

                    <Card>
                      <CardHeader>
                        <CardTitle className="flex items-center gap-2">
                          <MapPin className="h-5 w-5" />
                          Top Countries
                        </CardTitle>
                      </CardHeader>
                      <CardContent>
                        <div className="space-y-3">
                          {userMetrics.topCountries.map((country) => (
                            <div key={country.country} className="flex items-center justify-between">
                              <span className="text-sm">{country.country}</span>
                              <div className="flex items-center gap-3">
                                <span className="text-sm font-medium">{country.percentage}%</span>
                                <div className="w-16">
                                  <Progress value={country.percentage} />
                                </div>
                              </div>
                            </div>
                          ))}
                        </div>
                      </CardContent>
                    </Card>
                  </div>

                  {/* Additional Metrics */}
                  <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                    <Card>
                      <CardContent className="p-4 text-center">
                        <div className="text-lg font-bold text-green-600">{userMetrics.newUsers}</div>
                        <div className="text-sm text-muted-foreground">New Users</div>
                      </CardContent>
                    </Card>

                    <Card>
                      <CardContent className="p-4 text-center">
                        <div className="text-lg font-bold text-blue-600">{userMetrics.returningUsers}</div>
                        <div className="text-sm text-muted-foreground">Returning Users</div>
                      </CardContent>
                    </Card>

                    <Card>
                      <CardContent className="p-4 text-center">
                        <div className="text-lg font-bold text-orange-600">{userMetrics.bounceRate}%</div>
                        <div className="text-sm text-muted-foreground">Bounce Rate</div>
                      </CardContent>
                    </Card>

                    <Card>
                      <CardContent className="p-4 text-center">
                        <div className="text-lg font-bold text-purple-600">{userMetrics.uniquePageViews}</div>
                        <div className="text-sm text-muted-foreground">Unique Page Views</div>
                      </CardContent>
                    </Card>
                  </div>
                </>
              )}
            </TabsContent>

            <TabsContent value="real-time" className="space-y-4">
              <Card>
                <CardHeader>
                  <CardTitle className="flex items-center gap-2">
                    <Activity className="h-5 w-5" />
                    Real-time Activity Feed
                    <Badge variant="secondary">{userMetrics.activeUsers} active</Badge>
                  </CardTitle>
                </CardHeader>
                <CardContent>
                  <ScrollArea className="h-96">
                    {sessions.filter(session => session.status === 'active').length === 0 ? (
                      <div className="text-center py-12">
                        <Activity className="h-10 w-10 text-gray-300 mx-auto mb-3" />
                        <p className="text-sm text-gray-500">No active sessions at the moment.</p>
                      </div>
                    ) : (
                      <div className="space-y-2">
                        {sessions
                          .filter(session => session.status === 'active')
                          .flatMap(session =>
                            session.activities.length > 0
                              ? session.activities.map(activity => ({
                                  ...activity,
                                  session
                                }))
                              : [{
                                  id: `session-active-${session.id}`,
                                  timestamp: session.startTime,
                                  type: 'page_view' as const,
                                  target: 'Session active',
                                  details: {},
                                  session
                                }]
                          )
                          .sort((a, b) => new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime())
                          .slice(0, 20)
                          .map((activity, index) => (
                            <div key={`${activity.id}-${index}`} className="flex items-center gap-3 p-2 rounded border">
                              {getActivityIcon(activity.type)}
                              <div className="flex-1">
                                <div className="text-sm">
                                  <strong>{activity.session.userName}</strong> performed <strong>{activity.type.replace('_', ' ')}</strong>
                                  {activity.target && ` on ${activity.target}`}
                                </div>
                                <div className="text-xs text-muted-foreground">
                                  {format(new Date(activity.timestamp), 'HH:mm:ss')} {activity.session.device?.type && `\u2022 ${activity.session.device.type}`}
                                </div>
                              </div>
                            </div>
                          ))}
                      </div>
                    )}
                  </ScrollArea>
                </CardContent>
              </Card>
            </TabsContent>
          </Tabs>
        </CardContent>
      </Card>

      {/* Session Details Modal */}
      {selectedSession && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center p-4 z-50">
          <Card className="w-full max-w-4xl max-h-[80vh] overflow-y-auto">
            <CardHeader>
              <CardTitle className="flex items-center justify-between">
                <span>Session Details - {selectedSession.userName}</span>
                <Button variant="ghost" size="sm" onClick={() => setSelectedSession(null)}>
                  x
                </Button>
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-6">
              {/* Session Overview */}
              <div className="grid grid-cols-2 md:grid-cols-4 gap-4 text-sm">
                <div>
                  <Label>User</Label>
                  <div>{selectedSession.userName}</div>
                  <div className="text-muted-foreground">{selectedSession.userEmail}</div>
                </div>
                <div>
                  <Label>Duration</Label>
                  <div>{selectedSession.duration} minutes</div>
                </div>
                <div>
                  <Label>Device</Label>
                  <div className="flex items-center gap-1">
                    {getDeviceIcon(selectedSession.device.type)}
                    {selectedSession.device.type}
                  </div>
                </div>
                <div>
                  <Label>Location</Label>
                  <div>{selectedSession.location.city}, {selectedSession.location.country}</div>
                </div>
              </div>

              {/* Page Visits */}
              {selectedSession.pages.length > 0 && (
                <div>
                  <Label>Page Visits ({selectedSession.pages.length})</Label>
                  <div className="space-y-2 mt-2">
                    {selectedSession.pages.map((page) => (
                      <Card key={page.id}>
                        <CardContent className="p-3">
                          <div className="flex items-center justify-between">
                            <div>
                              <div className="font-medium">{page.title}</div>
                              <div className="text-sm text-muted-foreground">{page.path}</div>
                            </div>
                            <div className="text-right text-sm">
                              <div>{format(new Date(page.timestamp), 'HH:mm:ss')}</div>
                              <div className="text-muted-foreground">{page.duration}s</div>
                            </div>
                          </div>
                        </CardContent>
                      </Card>
                    ))}
                  </div>
                </div>
              )}

              {/* Activities */}
              {selectedSession.activities.length > 0 && (
                <div>
                  <Label>Activities ({selectedSession.activities.length})</Label>
                  <div className="space-y-2 mt-2">
                    {selectedSession.activities.map((activity) => (
                      <div key={activity.id} className="flex items-center gap-3 p-2 rounded border">
                        {getActivityIcon(activity.type)}
                        <div className="flex-1">
                          <div className="text-sm font-medium">{activity.type.replace('_', ' ').toUpperCase()}</div>
                          <div className="text-sm text-muted-foreground">
                            Target: {activity.target} {activity.timestamp && `\u2022 ${format(new Date(activity.timestamp), 'HH:mm:ss')}`}
                          </div>
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              )}

              {selectedSession.pages.length === 0 && selectedSession.activities.length === 0 && (
                <div className="text-center py-6 text-sm text-gray-500">
                  No detailed activity data available for this session.
                </div>
              )}
            </CardContent>
          </Card>
        </div>
      )}
    </div>
  );
};

export default withErrorBoundary(UserActivityTracking, { level: 'component' });
