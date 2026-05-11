import React, { useState, useEffect } from 'react';
import { api } from '../../services/api';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '../ui/card';
import { Button } from '../ui/button';
import { Badge } from '../ui/badge';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '../ui/select';
// Alert component - using div with alert styling
import { Progress } from '../ui/progress';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '../ui/tabs';
import { 
  Users, 
  MousePointer, 
  Eye, 
  Clock, 
  TrendingUp,
  TrendingDown,
  BarChart3,
  Activity,
  Target,
  Zap,
  AlertTriangle,
  CheckCircle,
  RefreshCw,
  Download,
  Settings,
  Play,
  Pause,
  Square
} from 'lucide-react';

interface UserSession {
  sessionId: string;
  userId?: string;
  startTime: string;
  endTime?: string;
  duration: number;
  pageViews: number;
  events: number;
  device: string;
  browser: string;
  location: string;
  referrer?: string;
  exitPage: string;
  bounce: boolean;
}

interface PageView {
  url: string;
  title: string;
  views: number;
  uniqueViews: number;
  avgTimeOnPage: number;
  bounceRate: number;
  exitRate: number;
}

interface UserEvent {
  event: string;
  category: string;
  action: string;
  label?: string;
  value?: number;
  count: number;
  uniqueUsers: number;
  avgPerSession: number;
}

interface ScrollDepth {
  page: string;
  depth25: number;
  depth50: number;
  depth75: number;
  depth100: number;
  avgDepth: number;
}

interface FormAbandonment {
  formName: string;
  url: string;
  starts: number;
  completions: number;
  abandonmentRate: number;
  avgTimeToAbandon: number;
  commonAbandonmentFields: string[];
}

const UserBehaviorTracker: React.FC = () => {
  const [activeTab, setActiveTab] = useState('overview');
  const [timeRange, setTimeRange] = useState('24h');
  const [isTracking, setIsTracking] = useState(false);
  const [sessions, setSessions] = useState<UserSession[]>([]);
  const [pageViews, setPageViews] = useState<PageView[]>([]);
  const [userEvents, setUserEvents] = useState<UserEvent[]>([]);
  const [scrollDepths, setScrollDepths] = useState<ScrollDepth[]>([]);
  const [formAbandonments, setFormAbandonments] = useState<FormAbandonment[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetchBehaviorData();
    const interval = setInterval(fetchBehaviorData, 10000); // Refresh every 10 seconds
    return () => clearInterval(interval);
  }, [timeRange]);

  const fetchBehaviorData = async () => {
    try {
      setLoading(true);
      const hotelId = localStorage.getItem('hotelId');

      if (!hotelId) return;

      // Fetch user sessions
      const { data: sessionsData } = await api.get(`/web-optimization/${hotelId}/user-sessions`, { params: { timeRange } });
      setSessions(sessionsData.data || []);

      // Fetch page views
      const { data: pagesData } = await api.get(`/web-optimization/${hotelId}/page-views`, { params: { timeRange } });
      setPageViews(pagesData.data || []);

      // Fetch user events
      const { data: eventsData } = await api.get(`/web-optimization/${hotelId}/user-events`, { params: { timeRange } });
      setUserEvents(eventsData.data || []);

      // Fetch scroll depths
      const { data: scrollData } = await api.get(`/web-optimization/${hotelId}/scroll-depths`, { params: { timeRange } });
      setScrollDepths(scrollData.data || []);

      // Fetch form abandonments
      const { data: formsData } = await api.get(`/web-optimization/${hotelId}/form-abandonments`, { params: { timeRange } });
      setFormAbandonments(formsData.data || []);
    } catch {
      // Error handled silently
    } finally {
      setLoading(false);
    }
  };

  const toggleTracking = async () => {
    try {
      const hotelId = localStorage.getItem('hotelId');

      if (!hotelId) return;

      const action = isTracking ? 'stop' : 'start';
      await api.post(`/web-optimization/${hotelId}/tracking/${action}`);
      setIsTracking(!isTracking);
    } catch {
      // Error handled silently
    }
  };

  const getDeviceIcon = (device: string) => {
    switch (device.toLowerCase()) {
      case 'desktop': return '🖥️';
      case 'mobile': return '📱';
      case 'tablet': return '📱';
      default: return '💻';
    }
  };

  const getBrowserIcon = (browser: string) => {
    switch (browser.toLowerCase()) {
      case 'chrome': return '🌐';
      case 'firefox': return '🦊';
      case 'safari': return '🧭';
      case 'edge': return '🌊';
      default: return '🌐';
    }
  };

  const formatDuration = (seconds: number) => {
    if (seconds < 60) return `${seconds}s`;
    const minutes = Math.floor(seconds / 60);
    const remainingSeconds = seconds % 60;
    return `${minutes}m ${remainingSeconds}s`;
  };

  if (loading) {
    return (
      <div className="flex justify-center items-center min-h-96">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600"></div>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div className="flex justify-between items-center">
        <div>
          <h2 className="text-2xl font-bold text-gray-900">User Behavior Tracker</h2>
          <p className="text-gray-600 mt-1">
            Track and analyze user interactions and behavior patterns
          </p>
        </div>
        <div className="flex gap-2">
          <Select value={timeRange} onValueChange={setTimeRange}>
            <SelectTrigger className="w-32">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="1h">Last Hour</SelectItem>
              <SelectItem value="24h">Last 24h</SelectItem>
              <SelectItem value="7d">Last 7 days</SelectItem>
              <SelectItem value="30d">Last 30 days</SelectItem>
            </SelectContent>
          </Select>
          <Button 
            variant={isTracking ? "destructive" : "default"}
            onClick={toggleTracking}
          >
            {isTracking ? (
              <>
                <Pause className="h-4 w-4 mr-2" />
                Stop Tracking
              </>
            ) : (
              <>
                <Play className="h-4 w-4 mr-2" />
                Start Tracking
              </>
            )}
          </Button>
          <Button variant="outline" onClick={fetchBehaviorData}>
            <RefreshCw className="h-4 w-4 mr-2" />
            Refresh
          </Button>
          <Button variant="outline">
            <Download className="h-4 w-4 mr-2" />
            Export
          </Button>
        </div>
      </div>

      {/* Tracking Status */}
      <div className="flex items-center p-4 bg-blue-50 border border-blue-200 rounded-lg">
        <Activity className="h-4 w-4 text-blue-600 mr-3" />
        <div className="text-sm text-blue-800">
          User behavior tracking is currently <strong>{isTracking ? 'active' : 'inactive'}</strong>.
          {isTracking ? ' Collecting real-time user interaction data.' : ' Start tracking to begin collecting user behavior data.'}
        </div>
      </div>

      <Tabs value={activeTab} onValueChange={setActiveTab}>
        <TabsList className="grid w-full grid-cols-5">
          <TabsTrigger value="overview">Overview</TabsTrigger>
          <TabsTrigger value="sessions">Sessions</TabsTrigger>
          <TabsTrigger value="pages">Pages</TabsTrigger>
          <TabsTrigger value="events">Events</TabsTrigger>
          <TabsTrigger value="forms">Forms</TabsTrigger>
        </TabsList>

        <TabsContent value="overview" className="space-y-6">
          {/* Key Metrics */}
          <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
            <Card>
              <CardContent className="p-4 text-center">
                <Users className="h-8 w-8 mx-auto mb-2 text-blue-600" />
                <p className="text-2xl font-bold">{sessions.length}</p>
                <p className="text-sm text-gray-600">Total Sessions</p>
              </CardContent>
            </Card>
            <Card>
              <CardContent className="p-4 text-center">
                <Eye className="h-8 w-8 mx-auto mb-2 text-green-600" />
                <p className="text-2xl font-bold">
                  {pageViews.reduce((sum, page) => sum + page.views, 0).toLocaleString()}
                </p>
                <p className="text-sm text-gray-600">Page Views</p>
              </CardContent>
            </Card>
            <Card>
              <CardContent className="p-4 text-center">
                <MousePointer className="h-8 w-8 mx-auto mb-2 text-purple-600" />
                <p className="text-2xl font-bold">
                  {userEvents.reduce((sum, event) => sum + event.count, 0).toLocaleString()}
                </p>
                <p className="text-sm text-gray-600">User Events</p>
              </CardContent>
            </Card>
            <Card>
              <CardContent className="p-4 text-center">
                <Clock className="h-8 w-8 mx-auto mb-2 text-orange-600" />
                <p className="text-2xl font-bold">
                  {sessions.length > 0 ? formatDuration(sessions.reduce((sum, session) => sum + session.duration, 0) / sessions.length) : '0s'}
                </p>
                <p className="text-sm text-gray-600">Avg Session Duration</p>
              </CardContent>
            </Card>
          </div>

          {/* Recent Sessions */}
          <Card>
            <CardHeader>
              <CardTitle>Recent User Sessions</CardTitle>
              <CardDescription>
                Latest user activity and behavior patterns
              </CardDescription>
            </CardHeader>
            <CardContent>
              <div className="space-y-4">
                {sessions.slice(0, 10).map((session) => (
                  <div key={session.sessionId} className="flex items-center justify-between p-3 bg-gray-50 rounded-lg">
                    <div className="flex items-center gap-3">
                      <div className="text-2xl">{getDeviceIcon(session.device)}</div>
                      <div>
                        <p className="font-medium">
                          {session.userId ? `User ${session.userId}` : 'Anonymous User'}
                        </p>
                        <p className="text-sm text-gray-500">
                          {session.pageViews} pages • {session.events} events • {formatDuration(session.duration)}
                        </p>
                      </div>
                    </div>
                    <div className="flex items-center gap-2">
                      <Badge variant={session.bounce ? "destructive" : "default"}>
                        {session.bounce ? 'Bounced' : 'Engaged'}
                      </Badge>
                      <span className="text-sm text-gray-500">{session.location}</span>
                    </div>
                  </div>
                ))}
              </div>
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="sessions" className="space-y-6">
          <h3 className="text-lg font-semibold">User Sessions</h3>
          
          <div className="space-y-4">
            {sessions.map((session) => (
              <Card key={session.sessionId}>
                <CardContent className="p-4">
                  <div className="flex justify-between items-start mb-4">
                    <div className="flex items-center gap-3">
                      <div className="text-2xl">{getDeviceIcon(session.device)}</div>
                      <div>
                        <h4 className="font-medium">
                          {session.userId ? `User ${session.userId}` : 'Anonymous User'}
                        </h4>
                        <p className="text-sm text-gray-500">
                          {new Date(session.startTime).toLocaleString()}
                        </p>
                      </div>
                    </div>
                    <div className="flex items-center gap-2">
                      <Badge variant={session.bounce ? "destructive" : "default"}>
                        {session.bounce ? 'Bounced' : 'Engaged'}
                      </Badge>
                      <span className="text-sm text-gray-500">{session.location}</span>
                    </div>
                  </div>
                  
                  <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                    <div>
                      <p className="text-sm text-gray-600">Duration</p>
                      <p className="font-medium">{formatDuration(session.duration)}</p>
                    </div>
                    <div>
                      <p className="text-sm text-gray-600">Page Views</p>
                      <p className="font-medium">{session.pageViews}</p>
                    </div>
                    <div>
                      <p className="text-sm text-gray-600">Events</p>
                      <p className="font-medium">{session.events}</p>
                    </div>
                    <div>
                      <p className="text-sm text-gray-600">Exit Page</p>
                      <p className="font-medium text-sm truncate">{session.exitPage}</p>
                    </div>
                  </div>
                  
                  <div className="mt-4 pt-4 border-t">
                    <div className="flex items-center gap-4 text-sm text-gray-500">
                      <span>{getBrowserIcon(session.browser)} {session.browser}</span>
                      {session.referrer && (
                        <span>From: {session.referrer}</span>
                      )}
                    </div>
                  </div>
                </CardContent>
              </Card>
            ))}
          </div>
        </TabsContent>

        <TabsContent value="pages" className="space-y-6">
          <h3 className="text-lg font-semibold">Page Performance</h3>
          
          <div className="space-y-4">
            {pageViews.map((page, index) => (
              <Card key={`pageViews-${index}-${page.title}`}>
                <CardContent className="p-4">
                  <div className="flex justify-between items-start mb-4">
                    <div>
                      <h4 className="font-medium">{page.title}</h4>
                      <p className="text-sm text-gray-500">{page.url}</p>
                    </div>
                    <div className="text-right">
                      <p className="text-2xl font-bold">{page.views.toLocaleString()}</p>
                      <p className="text-sm text-gray-500">Total Views</p>
                    </div>
                  </div>
                  
                  <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                    <div>
                      <p className="text-sm text-gray-600">Unique Views</p>
                      <p className="font-medium">{page.uniqueViews.toLocaleString()}</p>
                    </div>
                    <div>
                      <p className="text-sm text-gray-600">Avg Time</p>
                      <p className="font-medium">{formatDuration(page.avgTimeOnPage)}</p>
                    </div>
                    <div>
                      <p className="text-sm text-gray-600">Bounce Rate</p>
                      <p className="font-medium">{page.bounceRate.toFixed(1)}%</p>
                    </div>
                    <div>
                      <p className="text-sm text-gray-600">Exit Rate</p>
                      <p className="font-medium">{page.exitRate.toFixed(1)}%</p>
                    </div>
                  </div>
                </CardContent>
              </Card>
            ))}
          </div>
        </TabsContent>

        <TabsContent value="events" className="space-y-6">
          <h3 className="text-lg font-semibold">User Events</h3>
          
          <div className="space-y-4">
            {userEvents.map((event, index) => (
              <Card key={`userEvents-${index}-${event.label}`}>
                <CardContent className="p-4">
                  <div className="flex justify-between items-start mb-4">
                    <div>
                      <h4 className="font-medium">{event.event}</h4>
                      <p className="text-sm text-gray-500">
                        {event.category} • {event.action}
                        {event.label && ` • ${event.label}`}
                      </p>
                    </div>
                    <div className="text-right">
                      <p className="text-2xl font-bold">{event.count.toLocaleString()}</p>
                      <p className="text-sm text-gray-500">Total Events</p>
                    </div>
                  </div>
                  
                  <div className="grid grid-cols-2 md:grid-cols-3 gap-4">
                    <div>
                      <p className="text-sm text-gray-600">Unique Users</p>
                      <p className="font-medium">{event.uniqueUsers.toLocaleString()}</p>
                    </div>
                    <div>
                      <p className="text-sm text-gray-600">Avg per Session</p>
                      <p className="font-medium">{event.avgPerSession.toFixed(2)}</p>
                    </div>
                    {event.value && (
                      <div>
                        <p className="text-sm text-gray-600">Total Value</p>
                        <p className="font-medium">{event.value.toLocaleString()}</p>
                      </div>
                    )}
                  </div>
                </CardContent>
              </Card>
            ))}
          </div>
        </TabsContent>

        <TabsContent value="forms" className="space-y-6">
          <h3 className="text-lg font-semibold">Form Abandonment Analysis</h3>
          
          <div className="space-y-4">
            {formAbandonments.map((form, index) => (
              <Card key={`formAbandonments-${index}`}>
                <CardContent className="p-4">
                  <div className="flex justify-between items-start mb-4">
                    <div>
                      <h4 className="font-medium">{form.formName}</h4>
                      <p className="text-sm text-gray-500">{form.url}</p>
                    </div>
                    <div className="text-right">
                      <p className="text-2xl font-bold text-red-600">{form.abandonmentRate.toFixed(1)}%</p>
                      <p className="text-sm text-gray-500">Abandonment Rate</p>
                    </div>
                  </div>
                  
                  <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-4">
                    <div>
                      <p className="text-sm text-gray-600">Form Starts</p>
                      <p className="font-medium">{form.starts.toLocaleString()}</p>
                    </div>
                    <div>
                      <p className="text-sm text-gray-600">Completions</p>
                      <p className="font-medium">{form.completions.toLocaleString()}</p>
                    </div>
                    <div>
                      <p className="text-sm text-gray-600">Abandonments</p>
                      <p className="font-medium text-red-600">{(form.starts - form.completions).toLocaleString()}</p>
                    </div>
                    <div>
                      <p className="text-sm text-gray-600">Avg Time to Abandon</p>
                      <p className="font-medium">{formatDuration(form.avgTimeToAbandon)}</p>
                    </div>
                  </div>
                  
                  {form.commonAbandonmentFields.length > 0 && (
                    <div>
                      <p className="text-sm text-gray-600 mb-2">Common Abandonment Fields:</p>
                      <div className="flex flex-wrap gap-2">
                        {form.commonAbandonmentFields.map((field, fieldIndex) => (
                          <Badge key={fieldIndex} variant="outline">
                            {field}
                          </Badge>
                        ))}
                      </div>
                    </div>
                  )}
                </CardContent>
              </Card>
            ))}
          </div>
        </TabsContent>
      </Tabs>
    </div>
  );
};

export default UserBehaviorTracker;
