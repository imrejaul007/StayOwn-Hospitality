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
  Activity, 
  Clock, 
  Zap, 
  AlertTriangle, 
  CheckCircle,
  TrendingUp,
  TrendingDown,
  BarChart3,
  Globe,
  Smartphone,
  Monitor,
  Wifi,
  Database,
  Cpu,
  HardDrive,
  RefreshCw,
  Download,
  Settings
} from 'lucide-react';

interface PerformanceMetric {
  name: string;
  value: number;
  unit: string;
  status: 'good' | 'warning' | 'critical';
  trend: 'up' | 'down' | 'stable';
  change: number;
}

interface PagePerformance {
  url: string;
  loadTime: number;
  firstContentfulPaint: number;
  largestContentfulPaint: number;
  cumulativeLayoutShift: number;
  firstInputDelay: number;
  bounceRate: number;
  visitors: number;
}

interface DevicePerformance {
  device: string;
  loadTime: number;
  bounceRate: number;
  visitors: number;
  percentage: number;
}

interface CoreWebVitals {
  lcp: number; // Largest Contentful Paint
  fid: number; // First Input Delay
  cls: number; // Cumulative Layout Shift
  fcp: number; // First Contentful Paint
  ttfb: number; // Time to First Byte
}

const PerformanceMonitor: React.FC = () => {
  const [activeTab, setActiveTab] = useState('overview');
  const [timeRange, setTimeRange] = useState('24h');
  const [metrics, setMetrics] = useState<PerformanceMetric[]>([]);
  const [pagePerformance, setPagePerformance] = useState<PagePerformance[]>([]);
  const [devicePerformance, setDevicePerformance] = useState<DevicePerformance[]>([]);
  const [coreWebVitals, setCoreWebVitals] = useState<CoreWebVitals | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetchPerformanceData();
    const interval = setInterval(fetchPerformanceData, 30000); // Refresh every 30 seconds
    return () => clearInterval(interval);
  }, [timeRange]);

  const fetchPerformanceData = async () => {
    try {
      setLoading(true);
      const hotelId = localStorage.getItem('hotelId');

      if (!hotelId) return;

      // Fetch performance metrics
      const { data: metricsData } = await api.get(`/web-optimization/${hotelId}/performance-metrics`, { params: { timeRange } });
      setMetrics(metricsData.data || []);

      // Fetch page performance
      const { data: pagesData } = await api.get(`/web-optimization/${hotelId}/page-performance`, { params: { timeRange } });
      setPagePerformance(pagesData.data || []);

      // Fetch device performance
      const { data: devicesData } = await api.get(`/web-optimization/${hotelId}/device-performance`, { params: { timeRange } });
      setDevicePerformance(devicesData.data || []);

      // Fetch Core Web Vitals
      const { data: vitalsData } = await api.get(`/web-optimization/${hotelId}/core-web-vitals`, { params: { timeRange } });
      setCoreWebVitals(vitalsData.data || null);
    } catch {
      // Error handled silently
    } finally {
      setLoading(false);
    }
  };

  const getStatusColor = (status: string) => {
    switch (status) {
      case 'good': return 'text-green-600 bg-green-100';
      case 'warning': return 'text-yellow-600 bg-yellow-100';
      case 'critical': return 'text-red-600 bg-red-100';
      default: return 'text-gray-600 bg-gray-100';
    }
  };

  const getStatusIcon = (status: string) => {
    switch (status) {
      case 'good': return <CheckCircle className="h-4 w-4" />;
      case 'warning': return <AlertTriangle className="h-4 w-4" />;
      case 'critical': return <AlertTriangle className="h-4 w-4" />;
      default: return <Activity className="h-4 w-4" />;
    }
  };

  const getTrendIcon = (trend: string) => {
    switch (trend) {
      case 'up': return <TrendingUp className="h-4 w-4 text-green-600" />;
      case 'down': return <TrendingDown className="h-4 w-4 text-red-600" />;
      default: return <Activity className="h-4 w-4 text-gray-600" />;
    }
  };

  const getCoreWebVitalsStatus = (value: number, thresholds: { good: number; poor: number }) => {
    if (value <= thresholds.good) return 'good';
    if (value <= thresholds.poor) return 'warning';
    return 'critical';
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
          <h2 className="text-2xl font-bold text-gray-900">Performance Monitor</h2>
          <p className="text-gray-600 mt-1">
            Monitor your website's performance and Core Web Vitals
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
          <Button variant="outline" onClick={fetchPerformanceData}>
            <RefreshCw className="h-4 w-4 mr-2" />
            Refresh
          </Button>
          <Button variant="outline">
            <Download className="h-4 w-4 mr-2" />
            Export
          </Button>
        </div>
      </div>

      <Tabs value={activeTab} onValueChange={setActiveTab}>
        <TabsList className="grid w-full grid-cols-4">
          <TabsTrigger value="overview">Overview</TabsTrigger>
          <TabsTrigger value="pages">Pages</TabsTrigger>
          <TabsTrigger value="devices">Devices</TabsTrigger>
          <TabsTrigger value="vitals">Core Web Vitals</TabsTrigger>
        </TabsList>

        <TabsContent value="overview" className="space-y-6">
          {/* Key Performance Metrics */}
          <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
            {metrics.map((metric, index) => (
              <Card key={`metrics-${index}-${metric.name}`}>
                <CardContent className="p-4">
                  <div className="flex items-center justify-between mb-2">
                    <div className="flex items-center gap-2">
                      {getStatusIcon(metric.status)}
                      <span className="text-sm font-medium text-gray-600">{metric.name}</span>
                    </div>
                    {getTrendIcon(metric.trend)}
                  </div>
                  <div className="flex items-center justify-between">
                    <span className="text-2xl font-bold">{metric.value}{metric.unit}</span>
                    <span className={`text-sm ${metric.change > 0 ? 'text-green-600' : 'text-red-600'}`}>
                      {metric.change > 0 ? '+' : ''}{metric.change}%
                    </span>
                  </div>
                </CardContent>
              </Card>
            ))}
          </div>

          {/* Performance Alerts */}
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <AlertTriangle className="h-5 w-5" />
                Performance Alerts
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="space-y-3">
                {metrics.filter(m => m.status === 'critical' || m.status === 'warning').map((metric, index) => (
                  <div key={`-${index}-${metric.name}`} className="flex items-center p-4 bg-red-50 border border-red-200 rounded-lg">
                    <AlertTriangle className="h-4 w-4 text-red-600 mr-3" />
                    <div className="text-sm text-red-800">
                      <strong>{metric.name}</strong> is {metric.status === 'critical' ? 'critically' : 'below'} optimal at {metric.value}{metric.unit}
                      {metric.change !== 0 && (
                        <span className="ml-2">
                          ({metric.change > 0 ? 'increased' : 'decreased'} by {Math.abs(metric.change)}%)
                        </span>
                      )}
                    </div>
                  </div>
                ))}
                {metrics.filter(m => m.status === 'critical' || m.status === 'warning').length === 0 && (
                  <div className="text-center py-4">
                    <CheckCircle className="h-8 w-8 text-green-600 mx-auto mb-2" />
                    <p className="text-gray-600">All performance metrics are within optimal ranges</p>
                  </div>
                )}
              </div>
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="pages" className="space-y-6">
          <h3 className="text-lg font-semibold">Page Performance</h3>
          
          <div className="space-y-4">
            {pagePerformance.map((page, index) => (
              <Card key={`pagePerformance-${index}`}>
                <CardContent className="p-4">
                  <div className="flex justify-between items-start mb-4">
                    <div>
                      <h4 className="font-medium">{page.url}</h4>
                      <p className="text-sm text-gray-500">{page.visitors.toLocaleString()} visitors</p>
                    </div>
                    <div className="text-right">
                      <p className="text-2xl font-bold">{page.loadTime.toFixed(2)}s</p>
                      <p className="text-sm text-gray-500">Load Time</p>
                    </div>
                  </div>
                  
                  <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                    <div>
                      <p className="text-sm text-gray-600">First Contentful Paint</p>
                      <p className="font-medium">{page.firstContentfulPaint.toFixed(2)}s</p>
                    </div>
                    <div>
                      <p className="text-sm text-gray-600">Largest Contentful Paint</p>
                      <p className="font-medium">{page.largestContentfulPaint.toFixed(2)}s</p>
                    </div>
                    <div>
                      <p className="text-sm text-gray-600">Cumulative Layout Shift</p>
                      <p className="font-medium">{page.cumulativeLayoutShift.toFixed(3)}</p>
                    </div>
                    <div>
                      <p className="text-sm text-gray-600">Bounce Rate</p>
                      <p className="font-medium">{page.bounceRate.toFixed(1)}%</p>
                    </div>
                  </div>
                </CardContent>
              </Card>
            ))}
          </div>
        </TabsContent>

        <TabsContent value="devices" className="space-y-6">
          <h3 className="text-lg font-semibold">Device Performance</h3>
          
          <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
            {devicePerformance.map((device, index) => (
              <Card key={`devicePerformance-${index}`}>
                <CardContent className="p-4">
                  <div className="flex items-center gap-3 mb-4">
                    {device.device === 'desktop' && <Monitor className="h-6 w-6 text-blue-600" />}
                    {device.device === 'mobile' && <Smartphone className="h-6 w-6 text-green-600" />}
                    {device.device === 'tablet' && <Globe className="h-6 w-6 text-purple-600" />}
                    <div>
                      <h4 className="font-medium capitalize">{device.device}</h4>
                      <p className="text-sm text-gray-500">{device.percentage.toFixed(1)}% of traffic</p>
                    </div>
                  </div>
                  
                  <div className="space-y-3">
                    <div>
                      <div className="flex justify-between text-sm mb-1">
                        <span>Load Time</span>
                        <span>{device.loadTime.toFixed(2)}s</span>
                      </div>
                      <Progress value={Math.min((device.loadTime / 3) * 100, 100)} className="h-2" />
                    </div>
                    
                    <div>
                      <div className="flex justify-between text-sm mb-1">
                        <span>Bounce Rate</span>
                        <span>{device.bounceRate.toFixed(1)}%</span>
                      </div>
                      <Progress value={device.bounceRate} className="h-2" />
                    </div>
                    
                    <div className="pt-2 border-t">
                      <p className="text-sm text-gray-600">Visitors</p>
                      <p className="text-lg font-bold">{device.visitors.toLocaleString()}</p>
                    </div>
                  </div>
                </CardContent>
              </Card>
            ))}
          </div>
        </TabsContent>

        <TabsContent value="vitals" className="space-y-6">
          <h3 className="text-lg font-semibold">Core Web Vitals</h3>
          
          {coreWebVitals && (
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
              {/* Largest Contentful Paint */}
              <Card>
                <CardHeader>
                  <CardTitle className="flex items-center gap-2">
                    <Zap className="h-5 w-5" />
                    Largest Contentful Paint
                  </CardTitle>
                  <CardDescription>
                    Time for the largest content element to render
                  </CardDescription>
                </CardHeader>
                <CardContent>
                  <div className="text-center">
                    <p className="text-3xl font-bold mb-2">{coreWebVitals.lcp.toFixed(2)}s</p>
                    <Badge className={getStatusColor(getCoreWebVitalsStatus(coreWebVitals.lcp, { good: 2.5, poor: 4.0 }))}>
                      {getCoreWebVitalsStatus(coreWebVitals.lcp, { good: 2.5, poor: 4.0 })}
                    </Badge>
                    <div className="mt-4">
                      <div className="flex justify-between text-sm mb-1">
                        <span>Good: ≤2.5s</span>
                        <span>Poor: &gt;4.0s</span>
                      </div>
                      <Progress 
                        value={Math.min((coreWebVitals.lcp / 4) * 100, 100)} 
                        className="h-2" 
                      />
                    </div>
                  </div>
                </CardContent>
              </Card>

              {/* First Input Delay */}
              <Card>
                <CardHeader>
                  <CardTitle className="flex items-center gap-2">
                    <Clock className="h-5 w-5" />
                    First Input Delay
                  </CardTitle>
                  <CardDescription>
                    Time from first user interaction to browser response
                  </CardDescription>
                </CardHeader>
                <CardContent>
                  <div className="text-center">
                    <p className="text-3xl font-bold mb-2">{coreWebVitals.fid.toFixed(2)}ms</p>
                    <Badge className={getStatusColor(getCoreWebVitalsStatus(coreWebVitals.fid, { good: 100, poor: 300 }))}>
                      {getCoreWebVitalsStatus(coreWebVitals.fid, { good: 100, poor: 300 })}
                    </Badge>
                    <div className="mt-4">
                      <div className="flex justify-between text-sm mb-1">
                        <span>Good: ≤100ms</span>
                        <span>Poor: &gt;300ms</span>
                      </div>
                      <Progress 
                        value={Math.min((coreWebVitals.fid / 300) * 100, 100)} 
                        className="h-2" 
                      />
                    </div>
                  </div>
                </CardContent>
              </Card>

              {/* Cumulative Layout Shift */}
              <Card>
                <CardHeader>
                  <CardTitle className="flex items-center gap-2">
                    <BarChart3 className="h-5 w-5" />
                    Cumulative Layout Shift
                  </CardTitle>
                  <CardDescription>
                    Visual stability of page content
                  </CardDescription>
                </CardHeader>
                <CardContent>
                  <div className="text-center">
                    <p className="text-3xl font-bold mb-2">{coreWebVitals.cls.toFixed(3)}</p>
                    <Badge className={getStatusColor(getCoreWebVitalsStatus(coreWebVitals.cls, { good: 0.1, poor: 0.25 }))}>
                      {getCoreWebVitalsStatus(coreWebVitals.cls, { good: 0.1, poor: 0.25 })}
                    </Badge>
                    <div className="mt-4">
                      <div className="flex justify-between text-sm mb-1">
                        <span>Good: ≤0.1</span>
                        <span>Poor: &gt;0.25</span>
                      </div>
                      <Progress 
                        value={Math.min((coreWebVitals.cls / 0.25) * 100, 100)} 
                        className="h-2" 
                      />
                    </div>
                  </div>
                </CardContent>
              </Card>

              {/* First Contentful Paint */}
              <Card>
                <CardHeader>
                  <CardTitle className="flex items-center gap-2">
                    <Activity className="h-5 w-5" />
                    First Contentful Paint
                  </CardTitle>
                  <CardDescription>
                    Time for first content to render
                  </CardDescription>
                </CardHeader>
                <CardContent>
                  <div className="text-center">
                    <p className="text-3xl font-bold mb-2">{coreWebVitals.fcp.toFixed(2)}s</p>
                    <Badge className={getStatusColor(getCoreWebVitalsStatus(coreWebVitals.fcp, { good: 1.8, poor: 3.0 }))}>
                      {getCoreWebVitalsStatus(coreWebVitals.fcp, { good: 1.8, poor: 3.0 })}
                    </Badge>
                    <div className="mt-4">
                      <div className="flex justify-between text-sm mb-1">
                        <span>Good: ≤1.8s</span>
                        <span>Poor: &gt;3.0s</span>
                      </div>
                      <Progress 
                        value={Math.min((coreWebVitals.fcp / 3) * 100, 100)} 
                        className="h-2" 
                      />
                    </div>
                  </div>
                </CardContent>
              </Card>

              {/* Time to First Byte */}
              <Card>
                <CardHeader>
                  <CardTitle className="flex items-center gap-2">
                    <Database className="h-5 w-5" />
                    Time to First Byte
                  </CardTitle>
                  <CardDescription>
                    Server response time
                  </CardDescription>
                </CardHeader>
                <CardContent>
                  <div className="text-center">
                    <p className="text-3xl font-bold mb-2">{coreWebVitals.ttfb.toFixed(2)}s</p>
                    <Badge className={getStatusColor(getCoreWebVitalsStatus(coreWebVitals.ttfb, { good: 0.8, poor: 1.8 }))}>
                      {getCoreWebVitalsStatus(coreWebVitals.ttfb, { good: 0.8, poor: 1.8 })}
                    </Badge>
                    <div className="mt-4">
                      <div className="flex justify-between text-sm mb-1">
                        <span>Good: ≤0.8s</span>
                        <span>Poor: &gt;1.8s</span>
                      </div>
                      <Progress 
                        value={Math.min((coreWebVitals.ttfb / 1.8) * 100, 100)} 
                        className="h-2" 
                      />
                    </div>
                  </div>
                </CardContent>
              </Card>
            </div>
          )}
        </TabsContent>
      </Tabs>
    </div>
  );
};

export default PerformanceMonitor;
