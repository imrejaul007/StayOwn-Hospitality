import React, { useState, useEffect } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import { Label } from '@/components/ui/label';
import {
  Key,
  Globe,
  Shield,
  BarChart3,
  Activity,
  Copy,
  Eye,
  EyeOff,
  RefreshCw,
  Plus,
  Trash2,
  Play,
  Pause,
  AlertTriangle,
  CheckCircle,
  XCircle,
  Clock,
  TrendingUp,
  TrendingDown,
  Download,
  Webhook,
  FileText,
  Filter,
  Search
} from 'lucide-react';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { toast } from '@/components/ui/use-toast';
import { apiManagementApi } from '../../services/api';
import { APIKeyCreationForm } from './APIKeyCreationForm';
import { WebhookCreationForm } from './WebhookCreationForm';
import { withErrorBoundary } from '../ErrorBoundary';

interface APIEndpoint {
  _id?: string;
  id?: string;
  name: string;
  method: 'GET' | 'POST' | 'PUT' | 'DELETE' | 'PATCH';
  path: string;
  description: string;
  category: string;
  version: string;
  status: 'active' | 'deprecated' | 'beta' | 'maintenance';
  authRequired: boolean;
  rateLimit: number;
  usage?: {
    requests: number;
    errors: number;
    avgResponseTime: number;
  };
  lastUsed?: string;
}

interface APIKey {
  _id: string;
  name: string;
  keyId?: string;
  type: 'read' | 'write' | 'admin';
  permissions: Array<string | { resource: string; actions: string[] }>;
  expiresAt?: string;
  isActive: boolean;
  usage?: {
    totalRequests?: number;
    requests?: number;
    lastUsed?: string;
  };
  createdBy?: { name?: string; email?: string } | string;
  createdAt: string;
}

interface WebhookEndpoint {
  _id: string;
  name: string;
  url: string;
  events: string[];
  isActive: boolean;
  secret?: string;
  createdAt?: string;
  retryPolicy?: {
    maxRetries: number;
    backoffMultiplier: number;
  };
  stats?: {
    totalDeliveries: number;
    successfulDeliveries: number;
    failedDeliveries: number;
    lastDelivery?: string;
  };
}

interface APIMetrics {
  totalRequests: number;
  requestsToday: number;
  avgResponseTime: number;
  errorRate: number;
  topEndpoints: Array<{
    endpoint: string;
    requests: number;
    errors: number;
  }>;
  statusCodes: {
    [key: string]: number;
  };
}

export const ComprehensiveAPIAccess: React.FC = () => {
  const [activeTab, setActiveTab] = useState('overview');
  const [apiEndpoints, setApiEndpoints] = useState<APIEndpoint[]>([]);
  const [apiKeys, setApiKeys] = useState<APIKey[]>([]);
  const [webhooks, setWebhooks] = useState<WebhookEndpoint[]>([]);
  const [apiMetrics, setApiMetrics] = useState<APIMetrics | null>(null);
  const [selectedEndpoint, setSelectedEndpoint] = useState<APIEndpoint | null>(null);
  const [showKeyCreator, setShowKeyCreator] = useState(false);
  const [showWebhookCreator, setShowWebhookCreator] = useState(false);
  const [showDocumentation, setShowDocumentation] = useState(false);
  const [documentation, setDocumentation] = useState<Record<string, unknown> | null>(null);
  const [searchTerm, setSearchTerm] = useState('');
  const [categoryFilter, setCategoryFilter] = useState('all');
  const [statusFilter, setStatusFilter] = useState('all');
  const [methodFilter, setMethodFilter] = useState('all');
  const [dateFromFilter, setDateFromFilter] = useState('');
  const [dateToFilter, setDateToFilter] = useState('');
  const [sortBy, setSortBy] = useState('name');
  const [sortOrder, setSortOrder] = useState<'asc' | 'desc'>('asc');
  const [showSecrets, setShowSecrets] = useState<{ [key: string]: boolean }>({});
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    loadData();

    // Set up polling for real-time updates (every 45 seconds for better performance)
    const interval = setInterval(() => {
      loadData(true); // Silent reload without loading state
    }, 45000);

    return () => clearInterval(interval);
  }, []);

  const loadData = async (silent = false) => {
    try {
      if (!silent) {
        setLoading(true);
        setError(null);
      }

      // Optimize API calls for better performance
      const [keysResponse, webhooksResponse, metricsResponse, endpointsResponse] = await Promise.allSettled([
        apiManagementApi.getAPIKeys({ includeUsage: 'false', limit: 100 }),
        apiManagementApi.getWebhooks({ limit: 100 }),
        apiManagementApi.getMetrics(),
        apiManagementApi.getAllEndpoints({ includeUsage: 'false' })
      ]);

      if (keysResponse.status === 'fulfilled') {
        setApiKeys(keysResponse.value.data?.data?.apiKeys || []);
      } else {
        if (!silent) setApiKeys([]);
      }

      if (webhooksResponse.status === 'fulfilled') {
        setWebhooks(webhooksResponse.value.data?.data?.webhooks || []);
      } else {
        if (!silent) setWebhooks([]);
      }

      if (metricsResponse.status === 'fulfilled') {
        const rawMetrics = metricsResponse.value.data?.data;
        if (rawMetrics) {
          // Transform the API response to match the expected interface
          const transformedMetrics = {
            totalRequests: rawMetrics.totalRequests || 0,
            requestsToday: rawMetrics.requestsToday || 0,
            avgResponseTime: rawMetrics.averageResponseTime || 0,
            errorRate: parseFloat(rawMetrics.errorRate) || 0,
            topEndpoints: rawMetrics.topEndpoints || [],
            statusCodes: rawMetrics.statusCodes || {}
          };
          setApiMetrics(transformedMetrics);
        } else {
          setApiMetrics(null);
        }
      } else {
        if (!silent) setApiMetrics(null);
      }

      if (endpointsResponse.status === 'fulfilled') {
        setApiEndpoints(endpointsResponse.value.data?.data || []);
      } else {
        if (!silent) setApiEndpoints([]);
      }

    } catch (error) {
      if (!silent) {
        setError('API management not configured. Contact your administrator to set up API access.');

        // Set empty data on error
        setApiEndpoints([]);
        setApiKeys([]);
        setWebhooks([]);
        setApiMetrics(null);
      }
    } finally {
      if (!silent) {
        setLoading(false);
      }
    }
  };

  const loadDocumentation = async () => {
    try {
      const response = await apiManagementApi.getAPIDocumentation();
      setDocumentation(response.data.data);
      setShowDocumentation(true);
    } catch (error) {
      toast({
        title: "Error",
        description: "Failed to load API documentation",
        variant: "destructive"
      });
    }
  };

  // Ensure apiEndpoints is always an array to prevent filter errors
  const safeApiEndpoints = Array.isArray(apiEndpoints) ? apiEndpoints : [];
  
  // Wrap filter operation in try-catch to prevent any crashes
  let filteredEndpoints: APIEndpoint[] = [];
  try {
    filteredEndpoints = safeApiEndpoints.filter(endpoint => {
      // Add comprehensive null checks to prevent undefined errors
      if (!endpoint || typeof endpoint !== 'object') return false;

      const name = (endpoint.name && typeof endpoint.name === 'string') ? endpoint.name : '';
      const path = (endpoint.path && typeof endpoint.path === 'string') ? endpoint.path : '';
      const category = (endpoint.category && typeof endpoint.category === 'string') ? endpoint.category : '';
      const method = (endpoint.method && typeof endpoint.method === 'string') ? endpoint.method : '';
      const status = (endpoint.status && typeof endpoint.status === 'string') ? endpoint.status : '';
      const lastUsed = endpoint.lastUsed ? new Date(endpoint.lastUsed) : null;

      const searchTermLower = (searchTerm && typeof searchTerm === 'string') ? searchTerm.toLowerCase() : '';

      const matchesSearch = name.toLowerCase().includes(searchTermLower) ||
                           path.toLowerCase().includes(searchTermLower) ||
                           method.toLowerCase().includes(searchTermLower);

      const matchesCategory = categoryFilter === 'all' || category === categoryFilter;
      const matchesStatus = statusFilter === 'all' || status === statusFilter;
      const matchesMethod = methodFilter === 'all' || method === methodFilter;

      const matchesDateFrom = !dateFromFilter || !lastUsed || lastUsed >= new Date(dateFromFilter);
      const matchesDateTo = !dateToFilter || !lastUsed || lastUsed <= new Date(dateToFilter + 'T23:59:59');

      return matchesSearch && matchesCategory && matchesStatus && matchesMethod && matchesDateFrom && matchesDateTo;
    });

    // Apply sorting
    filteredEndpoints.sort((a, b) => {
      let valueA: unknown, valueB: unknown;

      switch (sortBy) {
        case 'name':
          valueA = a.name || '';
          valueB = b.name || '';
          break;
        case 'method':
          valueA = a.method || '';
          valueB = b.method || '';
          break;
        case 'requests':
          valueA = a.usage?.requests || 0;
          valueB = b.usage?.requests || 0;
          break;
        case 'errors':
          valueA = a.usage?.errors || 0;
          valueB = b.usage?.errors || 0;
          break;
        case 'response_time':
          valueA = a.usage?.avgResponseTime || 0;
          valueB = b.usage?.avgResponseTime || 0;
          break;
        case 'last_used':
          valueA = a.lastUsed ? new Date(a.lastUsed) : new Date(0);
          valueB = b.lastUsed ? new Date(b.lastUsed) : new Date(0);
          break;
        default:
          valueA = a.name || '';
          valueB = b.name || '';
      }

      if (typeof valueA === 'string') {
        valueA = valueA.toLowerCase();
        valueB = (valueB || '').toLowerCase();
      }

      if (sortOrder === 'asc') {
        return valueA < valueB ? -1 : valueA > valueB ? 1 : 0;
      } else {
        return valueA > valueB ? -1 : valueA < valueB ? 1 : 0;
      }
    });
  } catch (error) {
    // Return empty array as fallback
    filteredEndpoints = [];
  }

  const toggleKeyStatus = async (keyId: string) => {
    try {
      const key = Array.isArray(apiKeys) ? apiKeys.find(k => k._id === keyId) : null;
      if (!key) return;

      await apiManagementApi.toggleAPIKeyStatus(keyId);

      setApiKeys(prev => (prev || []).map(k =>
        k._id === keyId ? { ...k, isActive: !k.isActive } : k
      ));

      toast({
        title: "API Key Updated",
        description: `${key.name} has been ${!key.isActive ? 'activated' : 'deactivated'}`
      });
    } catch {
      toast({
        title: "Error",
        description: "Failed to update API key status. Please try again."
      });
    }
  };

  const toggleWebhookStatus = async (webhookId: string) => {
    try {
      const webhook = (webhooks || []).find(w => w._id === webhookId);
      if (!webhook) return;

      await apiManagementApi.updateWebhook(webhookId, { isActive: !webhook.isActive });

      setWebhooks(prev => (prev || []).map(w =>
        w._id === webhookId ? { ...w, isActive: !w.isActive } : w
      ));

      toast({
        title: "Webhook Updated",
        description: `${webhook.name} has been ${!webhook.isActive ? 'activated' : 'deactivated'}`
      });
    } catch {
      toast({
        title: "Error",
        description: "Failed to update webhook status. Please try again."
      });
    }
  };

  const copyToClipboard = (text: string, label: string) => {
    navigator.clipboard.writeText(text).then(() => {
      toast({ title: "Copied", description: `${label} copied to clipboard` });
    }).catch(() => {
      toast({ title: "Error", description: "Failed to copy to clipboard", variant: "destructive" });
    });
  };

  const deleteAPIKey = async (keyId: string) => {
    try {
      const key = (apiKeys || []).find(k => k._id === keyId);
      if (!key) return;
      await apiManagementApi.deleteAPIKey(keyId);
      setApiKeys(prev => (prev || []).filter(k => k._id !== keyId));
      toast({ title: "API Key Deleted", description: `${key.name} has been deleted` });
    } catch {
      toast({ title: "Error", description: "Failed to delete API key", variant: "destructive" });
    }
  };

  const deleteWebhook = async (webhookId: string) => {
    try {
      const webhook = (webhooks || []).find(w => w._id === webhookId);
      if (!webhook) return;
      await apiManagementApi.deleteWebhook(webhookId);
      setWebhooks(prev => (prev || []).filter(w => w._id !== webhookId));
      toast({ title: "Webhook Deleted", description: `${webhook.name} has been deleted` });
    } catch {
      toast({ title: "Error", description: "Failed to delete webhook", variant: "destructive" });
    }
  };

  const handleExportLogs = async () => {
    try {
      const now = new Date();
      const thirtyDaysAgo = new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000);
      const response = await apiManagementApi.exportLogs({
        startDate: thirtyDaysAgo.toISOString(),
        endDate: now.toISOString(),
        format: 'json'
      });
      const blob = new Blob([response.data], { type: 'application/json' });
      const url = window.URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `api-logs-${now.toISOString().split('T')[0]}.json`;
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      window.URL.revokeObjectURL(url);
      toast({ title: "Logs exported successfully" });
    } catch {
      toast({ title: "Failed to export logs", variant: "destructive" });
    }
  };

  const toggleSecretVisibility = (id: string) => {
    setShowSecrets(prev => ({ ...prev, [id]: !prev[id] }));
  };

  const getMethodColor = (method: string) => {
    switch (method) {
      case 'GET': return 'bg-blue-500';
      case 'POST': return 'bg-green-500';
      case 'PUT': return 'bg-yellow-500';
      case 'DELETE': return 'bg-red-500';
      case 'PATCH': return 'bg-purple-500';
      default: return 'bg-gray-500';
    }
  };

  const getStatusColor = (status: string) => {
    switch (status) {
      case 'active': return 'default';
      case 'deprecated': return 'destructive';
      case 'beta': return 'secondary';
      case 'maintenance': return 'outline';
      default: return 'secondary';
    }
  };

  const renderOverview = () => (
    <div className="space-y-6">
      {/* API Metrics */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
        <Card>
          <CardContent className="p-6">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm font-medium text-muted-foreground">Total Requests</p>
                <p className="text-2xl font-bold">{(apiMetrics?.totalRequests || 0).toLocaleString()}</p>
              </div>
              <BarChart3 className="h-8 w-8 text-blue-500" />
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardContent className="p-6">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm font-medium text-muted-foreground">Requests Today</p>
                <p className="text-2xl font-bold">{(apiMetrics?.requestsToday || 0).toLocaleString()}</p>
              </div>
              <Activity className="h-8 w-8 text-green-500" />
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardContent className="p-6">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm font-medium text-muted-foreground">Avg Response Time</p>
                <p className="text-2xl font-bold">{apiMetrics?.avgResponseTime ?? 0}ms</p>
              </div>
              <Clock className="h-8 w-8 text-yellow-500" />
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardContent className="p-6">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm font-medium text-muted-foreground">Error Rate</p>
                <p className="text-2xl font-bold">{apiMetrics?.errorRate ?? 0}%</p>
              </div>
              <AlertTriangle className="h-8 w-8 text-red-500" />
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Top Endpoints */}
      <Card>
        <CardHeader>
          <CardTitle>Top API Endpoints</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="space-y-4">
            {(apiMetrics?.topEndpoints || []).length > 0 ? (apiMetrics?.topEndpoints || []).map((endpoint, index) => (
              <div key={endpoint.endpoint} className="flex items-center justify-between p-3 border rounded-lg">
                <div className="flex items-center space-x-3">
                  <div className="w-8 h-8 bg-blue-500 rounded-lg flex items-center justify-center text-white font-bold">
                    {index + 1}
                  </div>
                  <div>
                    <div className="font-medium">{endpoint.endpoint}</div>
                    <div className="text-sm text-muted-foreground">
                      {(endpoint.requests || 0).toLocaleString()} requests
                    </div>
                  </div>
                </div>
                <div className="text-right">
                  <div className="font-bold">{(endpoint.requests || 0).toLocaleString()}</div>
                  <div className="text-sm text-red-500">{endpoint.errors || 0} errors</div>
                </div>
              </div>
            )) : (
              <div className="text-center py-6 text-muted-foreground">No endpoint data available yet</div>
            )}
          </div>
        </CardContent>
      </Card>

      {/* Status Codes */}
      <Card>
        <CardHeader>
          <CardTitle>Response Status Codes</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-6 gap-4">
            {Object.entries(apiMetrics?.statusCodes || {}).length > 0 ? Object.entries(apiMetrics?.statusCodes || {}).map(([code, count]) => (
              <div key={code} className="text-center p-4 border rounded-lg">
                <div className={`text-2xl font-bold ${
                  code.startsWith('2') ? 'text-green-600' :
                  code.startsWith('4') ? 'text-yellow-600' :
                  code.startsWith('5') ? 'text-red-600' : 'text-gray-600'
                }`}>
                  {(count || 0).toLocaleString()}
                </div>
                <div className="text-sm text-muted-foreground">{code}</div>
              </div>
            )) : (
              <div className="col-span-full text-center py-6 text-muted-foreground">No status code data available yet</div>
            )}
          </div>
        </CardContent>
      </Card>

      {/* API Health Status */}
      <Card>
        <CardHeader>
          <CardTitle>API Health Status</CardTitle>
        </CardHeader>
        <CardContent>
          {(() => {
            const errorRate = apiMetrics?.errorRate ?? 0;
            const isHealthy = errorRate < 5;
            const isWarning = errorRate >= 5 && errorRate < 15;
            return (
              <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                <div className={`flex items-center space-x-3 p-4 border rounded-lg ${
                  isHealthy ? 'bg-green-50 border-green-200' : isWarning ? 'bg-yellow-50 border-yellow-200' : 'bg-red-50 border-red-200'
                }`}>
                  {isHealthy ? <CheckCircle className="h-8 w-8 text-green-600" /> :
                   isWarning ? <AlertTriangle className="h-8 w-8 text-yellow-600" /> :
                   <XCircle className="h-8 w-8 text-red-600" />}
                  <div>
                    <div className="font-medium">{isHealthy ? 'Systems Operational' : isWarning ? 'Degraded Performance' : 'Issues Detected'}</div>
                    <div className="text-sm text-muted-foreground">Error rate: {errorRate}%</div>
                  </div>
                </div>
                <div className="flex items-center space-x-3 p-4 bg-blue-50 border border-blue-200 rounded-lg">
                  <Shield className="h-8 w-8 text-blue-600" />
                  <div>
                    <div className="font-medium">Active API Keys</div>
                    <div className="text-sm text-muted-foreground">{(apiKeys || []).filter(k => k.isActive).length} of {(apiKeys || []).length} keys active</div>
                  </div>
                </div>
                <div className="flex items-center space-x-3 p-4 bg-purple-50 border border-purple-200 rounded-lg">
                  <Webhook className="h-8 w-8 text-purple-600" />
                  <div>
                    <div className="font-medium">Active Webhooks</div>
                    <div className="text-sm text-muted-foreground">{(webhooks || []).filter(w => w.isActive).length} of {(webhooks || []).length} webhooks active</div>
                  </div>
                </div>
              </div>
            );
          })()}
        </CardContent>
      </Card>
    </div>
  );

  const renderEndpoints = () => (
    <div className="space-y-6">
      {/* Enhanced Filters */}
      <Card>
        <CardContent className="p-4">
          <div className="space-y-4">
            {/* Primary Search and Actions */}
            <div className="flex items-center space-x-4">
              <div className="relative flex-1">
                <Search className="absolute left-3 top-3 h-4 w-4 text-muted-foreground" />
                <Input
                  placeholder="Search endpoints, methods, or paths..."
                  value={searchTerm}
                  onChange={(e) => setSearchTerm(e.target.value)}
                  className="pl-10"
                />
              </div>
              <Badge variant="secondary" className="text-sm">
                Auto-scanned from routes
              </Badge>
            </div>

            {/* Advanced Filters Row */}
            <div className="grid grid-cols-2 md:grid-cols-4 lg:grid-cols-6 gap-3">
              <Select value={categoryFilter} onValueChange={setCategoryFilter}>
                <SelectTrigger>
                  <SelectValue placeholder="Category" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">All Categories</SelectItem>
                  <SelectItem value="Authentication">Authentication</SelectItem>
                  <SelectItem value="Bookings">Bookings</SelectItem>
                  <SelectItem value="Room Management">Room Management</SelectItem>
                  <SelectItem value="Guest Management">Guest Management</SelectItem>
                  <SelectItem value="Analytics">Analytics</SelectItem>
                  <SelectItem value="API Management">API Management</SelectItem>
                </SelectContent>
              </Select>

              <Select value={methodFilter} onValueChange={setMethodFilter}>
                <SelectTrigger>
                  <SelectValue placeholder="Method" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">All Methods</SelectItem>
                  <SelectItem value="GET">GET</SelectItem>
                  <SelectItem value="POST">POST</SelectItem>
                  <SelectItem value="PUT">PUT</SelectItem>
                  <SelectItem value="DELETE">DELETE</SelectItem>
                  <SelectItem value="PATCH">PATCH</SelectItem>
                </SelectContent>
              </Select>

              <Select value={statusFilter} onValueChange={setStatusFilter}>
                <SelectTrigger>
                  <SelectValue placeholder="Status" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">All Status</SelectItem>
                  <SelectItem value="active">Active</SelectItem>
                  <SelectItem value="deprecated">Deprecated</SelectItem>
                  <SelectItem value="beta">Beta</SelectItem>
                  <SelectItem value="maintenance">Maintenance</SelectItem>
                </SelectContent>
              </Select>

              <Select value={sortBy} onValueChange={setSortBy}>
                <SelectTrigger>
                  <SelectValue placeholder="Sort by" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="name">Name</SelectItem>
                  <SelectItem value="method">Method</SelectItem>
                  <SelectItem value="requests">Requests</SelectItem>
                  <SelectItem value="errors">Errors</SelectItem>
                  <SelectItem value="response_time">Response Time</SelectItem>
                  <SelectItem value="last_used">Last Used</SelectItem>
                </SelectContent>
              </Select>

              <Button
                variant="outline"
                onClick={() => setSortOrder(sortOrder === 'asc' ? 'desc' : 'asc')}
                className="w-full"
              >
                {sortOrder === 'asc' ? 'A→Z' : 'Z→A'}
                {sortOrder === 'asc' ? <TrendingUp className="ml-2 h-4 w-4" /> : <TrendingDown className="ml-2 h-4 w-4" />}
              </Button>

              <Button
                variant="outline"
                onClick={() => {
                  setSearchTerm('');
                  setCategoryFilter('all');
                  setMethodFilter('all');
                  setStatusFilter('all');
                  setDateFromFilter('');
                  setDateToFilter('');
                  setSortBy('name');
                  setSortOrder('asc');
                }}
                className="w-full"
              >
                <Filter className="mr-2 h-4 w-4" />
                Clear
              </Button>
            </div>

            {/* Date Range Filters */}
            <div className="flex items-center space-x-4 pt-2 border-t">
              <Label className="text-sm font-medium whitespace-nowrap">Last Used:</Label>
              <div className="flex items-center space-x-2">
                <Input
                  type="date"
                  value={dateFromFilter}
                  onChange={(e) => setDateFromFilter(e.target.value)}
                  className="w-40"
                  placeholder="From"
                />
                <span className="text-muted-foreground">to</span>
                <Input
                  type="date"
                  value={dateToFilter}
                  onChange={(e) => setDateToFilter(e.target.value)}
                  className="w-40"
                  placeholder="To"
                />
              </div>
              <div className="flex-1" />
              <Badge variant="secondary" className="ml-auto">
                {filteredEndpoints.length} endpoints
              </Badge>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Endpoints List */}
      <div className="space-y-4">
        {filteredEndpoints.length === 0 ? (
          <Card>
            <CardContent className="p-8 text-center text-muted-foreground">
              {searchTerm || categoryFilter !== 'all' || methodFilter !== 'all' || statusFilter !== 'all'
                ? 'No endpoints match your filters'
                : 'No API endpoints registered yet'}
            </CardContent>
          </Card>
        ) : filteredEndpoints.map((endpoint, index) => (
          <Card key={`${endpoint.method}-${endpoint.path}-${index}`} className="cursor-pointer hover:shadow-lg transition-shadow"
                onClick={() => setSelectedEndpoint(endpoint)}>
            <CardContent className="p-4">
              <div className="flex items-center justify-between">
                <div className="flex items-center space-x-4 flex-1">
                  <div className="flex items-center space-x-2">
                    <div className={`px-2 py-1 text-xs font-bold text-white rounded ${getMethodColor(endpoint.method)}`}>
                      {endpoint.method}
                    </div>
                    <Badge variant={getStatusColor(endpoint.status) as 'default' | 'secondary' | 'destructive' | 'outline'}>
                      {endpoint.status}
                    </Badge>
                  </div>
                  <div className="flex-1">
                    <div className="font-medium">{endpoint.name}</div>
                    <div className="text-sm text-muted-foreground font-mono">{endpoint.path}</div>
                    <div className="text-sm text-muted-foreground mt-1">{endpoint.description}</div>
                  </div>
                </div>
                <div className="grid grid-cols-3 gap-6 text-right">
                  <div>
                    <div className="text-lg font-bold">{(endpoint.usage?.requests || 0).toLocaleString()}</div>
                    <div className="text-xs text-muted-foreground">Requests</div>
                  </div>
                  <div>
                    <div className={`text-lg font-bold ${(endpoint.usage?.errors || 0) > 50 ? 'text-red-600' : 'text-green-600'}`}>
                      {endpoint.usage?.errors || 0}
                    </div>
                    <div className="text-xs text-muted-foreground">Errors</div>
                  </div>
                  <div>
                    <div className="text-lg font-bold">{endpoint.usage?.avgResponseTime || 0}ms</div>
                    <div className="text-xs text-muted-foreground">Avg Response</div>
                  </div>
                </div>
              </div>
            </CardContent>
          </Card>
        ))}
      </div>
    </div>
  );

  const renderAPIKeys = () => (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <h3 className="text-lg font-semibold">API Keys</h3>
        <Button onClick={() => setShowKeyCreator(true)}>
          <Plus className="mr-2 h-4 w-4" />
          Create API Key
        </Button>
      </div>

      <div className="space-y-4">
        {Array.isArray(apiKeys) && apiKeys.length > 0 ? apiKeys.map(apiKey => (
          <Card key={apiKey._id}>
            <CardContent className="p-6">
              <div className="flex items-start justify-between">
                <div className="flex-1">
                  <div className="flex items-center space-x-3 mb-3">
                    <h4 className="font-medium">{apiKey.name}</h4>
                    <Badge variant={apiKey.type === 'admin' ? 'destructive' : 'secondary'}>
                      {apiKey.type}
                    </Badge>
                    <Badge variant={apiKey.isActive ? 'default' : 'outline'}>
                      {apiKey.isActive ? 'Active' : 'Inactive'}
                    </Badge>
                  </div>

                  <div className="space-y-2">
                    <div className="flex items-center space-x-2">
                      <span className="text-sm font-medium">Key:</span>
                      <code className="bg-muted px-2 py-1 rounded text-sm font-mono">
                        {showSecrets[apiKey._id] ? (apiKey.keyId || '••••••••') : '•'.repeat(20)}
                      </code>
                      <Button
                        variant="ghost"
                        size="sm"
                        onClick={() => toggleSecretVisibility(apiKey._id)}
                      >
                        {showSecrets[apiKey._id] ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                      </Button>
                      {apiKey.keyId && (
                        <Button
                          variant="ghost"
                          size="sm"
                          onClick={() => copyToClipboard(apiKey.keyId!, 'API Key')}
                        >
                          <Copy className="h-4 w-4" />
                        </Button>
                      )}
                    </div>

                    <div className="text-sm text-muted-foreground">
                      <div>Created by {typeof apiKey.createdBy === 'object' ? apiKey.createdBy?.name || 'Unknown' : 'Unknown'} on {new Date(apiKey.createdAt).toLocaleDateString()}</div>
                      {apiKey.expiresAt && (
                        <div>Expires: {new Date(apiKey.expiresAt).toLocaleDateString()}</div>
                      )}
                      {apiKey.usage?.lastUsed && (
                        <div>Last used: {new Date(apiKey.usage.lastUsed).toLocaleString()}</div>
                      )}
                    </div>

                    <div className="flex flex-wrap gap-1 mt-2">
                      {(apiKey.permissions || []).slice(0, 3).map((permission, index) => (
                        <Badge key={`permission-${index}`} variant="outline" className="text-xs">
                          {permission.resource ? `${permission.resource}:${permission.actions.join(',')}` : permission}
                        </Badge>
                      ))}
                      {(apiKey.permissions || []).length > 3 && (
                        <Badge variant="outline" className="text-xs">
                          +{(apiKey.permissions || []).length - 3} more
                        </Badge>
                      )}
                    </div>
                  </div>
                </div>

                <div className="text-right space-y-2">
                  <div>
                    <div className="text-lg font-bold">{(apiKey.usage?.totalRequests || apiKey.usage?.requests || 0).toLocaleString()}</div>
                    <div className="text-xs text-muted-foreground">Total Requests</div>
                  </div>
                  <div className="flex space-x-2">
                    <Button
                      variant={apiKey.isActive ? 'outline' : 'default'}
                      size="sm"
                      onClick={() => toggleKeyStatus(apiKey._id)}
                    >
                      {apiKey.isActive ? <Pause className="h-3 w-3" /> : <Play className="h-3 w-3" />}
                    </Button>
                    <Button
                      variant="ghost"
                      size="sm"
                      onClick={() => deleteAPIKey(apiKey._id)}
                      className="text-red-500 hover:text-red-700"
                    >
                      <Trash2 className="h-3 w-3" />
                    </Button>
                  </div>
                </div>
              </div>
            </CardContent>
          </Card>
        )) : (
          <div className="text-center py-8 text-gray-500">
            No API keys found
          </div>
        )}
      </div>
    </div>
  );

  const renderWebhooks = () => (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <h3 className="text-lg font-semibold">Webhook Endpoints</h3>
        <Button onClick={() => setShowWebhookCreator(true)}>
          <Plus className="mr-2 h-4 w-4" />
          Add Webhook
        </Button>
      </div>

      <div className="space-y-4">
        {Array.isArray(webhooks) && webhooks.length > 0 ? webhooks.map(webhook =>
          <Card key={webhook._id}>
            <CardContent className="p-6">
              <div className="flex items-start justify-between">
                <div className="flex-1">
                  <div className="flex items-center space-x-3 mb-3">
                    <h4 className="font-medium">{webhook.name}</h4>
                    <Badge variant={webhook.isActive ? 'default' : 'outline'}>
                      {webhook.isActive ? 'Active' : 'Inactive'}
                    </Badge>
                  </div>

                  <div className="space-y-2">
                    <div className="flex items-center space-x-2">
                      <span className="text-sm font-medium">URL:</span>
                      <code className="bg-muted px-2 py-1 rounded text-sm font-mono">
                        {webhook.url}
                      </code>
                      <Button
                        variant="ghost"
                        size="sm"
                        onClick={() => copyToClipboard(webhook.url, 'Webhook URL')}
                      >
                        <Copy className="h-4 w-4" />
                      </Button>
                    </div>

                    {webhook.createdAt && (
                      <div className="flex items-center space-x-2">
                        <span className="text-sm font-medium">Created:</span>
                        <div className="text-sm text-muted-foreground">
                          {new Date(webhook.createdAt).toLocaleDateString()}
                        </div>
                      </div>
                    )}

                    <div className="flex flex-wrap gap-1 mt-2">
                      {(webhook.events || []).map(event => (
                        <Badge key={event} variant="secondary" className="text-xs">
                          {event}
                        </Badge>
                      ))}
                    </div>
                  </div>
                </div>

                <div className="text-right space-y-2">
                  <div>
                    <div className="text-lg font-bold">{webhook.stats?.totalDeliveries || 0}</div>
                    <div className="text-xs text-muted-foreground">Total Deliveries</div>
                  </div>
                  <div>
                    <div className="text-sm text-green-600">{webhook.stats?.successfulDeliveries || 0}</div>
                    <div className="text-xs text-muted-foreground">Successful</div>
                  </div>
                  <div>
                    <div className="text-sm text-red-600">{webhook.stats?.failedDeliveries || 0}</div>
                    <div className="text-xs text-muted-foreground">Failed</div>
                  </div>
                  <div className="flex space-x-2">
                    <Button
                      variant={webhook.isActive ? 'outline' : 'default'}
                      size="sm"
                      onClick={() => toggleWebhookStatus(webhook._id)}
                    >
                      {webhook.isActive ? <Pause className="h-3 w-3" /> : <Play className="h-3 w-3" />}
                    </Button>
                    <Button
                      variant="ghost"
                      size="sm"
                      onClick={() => deleteWebhook(webhook._id)}
                      className="text-red-500 hover:text-red-700"
                    >
                      <Trash2 className="h-3 w-3" />
                    </Button>
                  </div>
                </div>
              </div>
            </CardContent>
          </Card>
        ) : (
          <div className="text-center py-8 text-gray-500">
            No webhooks found
          </div>
        )}
      </div>
    </div>
  );

  const tabs = [
    { id: 'overview', name: 'Overview', icon: BarChart3 },
    { id: 'endpoints', name: 'API Endpoints', icon: Globe },
    { id: 'keys', name: 'API Keys', icon: Key },
    { id: 'webhooks', name: 'Webhooks', icon: Webhook }
  ];

  if (loading) {
    return (
      <div className="space-y-6 p-6">
        <div className="flex items-center justify-center min-h-64">
          <div className="flex items-center space-x-2">
            <RefreshCw className="h-4 w-4 animate-spin" />
            <span>Loading API Management data...</span>
          </div>
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="space-y-6 p-6">
        <div className="flex items-center justify-center min-h-64">
          <Card className="w-full max-w-md">
            <CardContent className="p-6 text-center">
              <AlertTriangle className="h-8 w-8 text-red-500 mx-auto mb-4" />
              <h3 className="text-lg font-semibold mb-2">Error Loading Data</h3>
              <p className="text-muted-foreground mb-4">{error}</p>
              <Button onClick={() => loadData()}>
                <RefreshCw className="mr-2 h-4 w-4" />
                Retry
              </Button>
            </CardContent>
          </Card>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-6 p-6">
      <div className="flex items-center justify-between">
        <div className="flex items-center space-x-3">
          <h2 className="text-3xl font-bold tracking-tight">API Management</h2>
          <Badge variant="outline" className="flex items-center space-x-1">
            <div className="w-2 h-2 bg-green-500 rounded-full animate-pulse"></div>
            <span className="text-xs">Live Data</span>
          </Badge>
        </div>
        <div className="flex space-x-2">
          <Button variant="outline" onClick={loadDocumentation}>
            <FileText className="mr-2 h-4 w-4" />
            API Documentation
          </Button>
          <Button variant="outline" onClick={handleExportLogs}>
            <Download className="mr-2 h-4 w-4" />
            Export Logs
          </Button>
        </div>
      </div>

      {/* Navigation Tabs */}
      <Card>
        <CardContent className="p-0">
          <div className="flex space-x-0 border-b">
            {tabs.map(tab => {
              const Icon = tab.icon;
              return (
                <button
                  key={tab.id}
                  onClick={() => setActiveTab(tab.id)}
                  className={`flex items-center px-6 py-4 text-sm font-medium border-b-2 transition-colors ${
                    activeTab === tab.id
                      ? 'border-blue-500 text-blue-600 bg-blue-50'
                      : 'border-transparent text-muted-foreground hover:text-foreground hover:border-gray-300'
                  }`}
                >
                  <Icon className="mr-2 h-4 w-4" />
                  {tab.name}
                </button>
              );
            })}
          </div>
        </CardContent>
      </Card>

      {/* Content */}
      {activeTab === 'overview' && renderOverview()}
      {activeTab === 'endpoints' && renderEndpoints()}
      {activeTab === 'keys' && renderAPIKeys()}
      {activeTab === 'webhooks' && renderWebhooks()}

      {/* Endpoint Details Modal */}
      {selectedEndpoint && (
        <div
          className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center p-4 z-50"
          onClick={(e) => { if (e.target === e.currentTarget) setSelectedEndpoint(null); }}
          onKeyDown={(e) => { if (e.key === 'Escape') setSelectedEndpoint(null); }}
          role="dialog"
          aria-modal="true"
          tabIndex={-1}
        >
          <Card className="w-full max-w-3xl max-h-[90vh] overflow-y-auto">
            <CardHeader>
              <div className="flex items-center justify-between">
                <CardTitle className="flex items-center">
                  <div className={`px-2 py-1 text-xs font-bold text-white rounded mr-3 ${getMethodColor(selectedEndpoint.method)}`}>
                    {selectedEndpoint.method}
                  </div>
                  {selectedEndpoint.name}
                </CardTitle>
                <Button variant="outline" onClick={() => setSelectedEndpoint(null)}>
                  <XCircle className="h-4 w-4" />
                </Button>
              </div>
            </CardHeader>
            <CardContent className="space-y-6">
              <div className="grid grid-cols-2 gap-6">
                <div>
                  <label className="text-sm font-medium text-muted-foreground">Endpoint Path</label>
                  <div className="flex items-center gap-2 mt-1">
                    <code className="flex-1 bg-muted p-2 rounded font-mono text-sm">
                      {selectedEndpoint.path}
                    </code>
                    <Button variant="ghost" size="sm" onClick={() => copyToClipboard(selectedEndpoint.path, 'Endpoint path')}>
                      <Copy className="h-3 w-3" />
                    </Button>
                  </div>
                </div>
                <div>
                  <label className="text-sm font-medium text-muted-foreground">Rate Limit</label>
                  <div className="text-lg font-semibold">{selectedEndpoint.rateLimit || 'N/A'} requests/hour</div>
                </div>
              </div>

              <div>
                <label className="text-sm font-medium text-muted-foreground">Description</label>
                <p className="text-sm mt-1">{selectedEndpoint.description || 'No description available'}</p>
              </div>

              <div className="grid grid-cols-3 gap-4">
                <div className="text-center p-4 border rounded-lg">
                  <div className="text-2xl font-bold">{(selectedEndpoint?.usage?.requests || 0).toLocaleString()}</div>
                  <div className="text-sm text-muted-foreground">Total Requests</div>
                </div>
                <div className="text-center p-4 border rounded-lg">
                  <div className="text-2xl font-bold text-red-600">{selectedEndpoint?.usage?.errors || 0}</div>
                  <div className="text-sm text-muted-foreground">Errors</div>
                </div>
                <div className="text-center p-4 border rounded-lg">
                  <div className="text-2xl font-bold">{selectedEndpoint?.usage?.avgResponseTime || 0}ms</div>
                  <div className="text-sm text-muted-foreground">Avg Response Time</div>
                </div>
              </div>

              <div className="flex items-center space-x-2">
                <Badge variant={getStatusColor(selectedEndpoint.status) as 'default' | 'secondary' | 'destructive' | 'outline'}>
                  {selectedEndpoint.status}
                </Badge>
                {selectedEndpoint.version && <Badge variant="outline">{selectedEndpoint.version}</Badge>}
                {selectedEndpoint.category && <Badge variant="outline">{selectedEndpoint.category}</Badge>}
                {selectedEndpoint.authRequired && (
                  <Badge variant="secondary">
                    <Shield className="mr-1 h-3 w-3" />
                    Auth Required
                  </Badge>
                )}
              </div>
            </CardContent>
          </Card>
        </div>
      )}

      {/* API Key Creation Modal */}
      {showKeyCreator && (
        <div
          className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center p-4 z-50"
          onClick={(e) => { if (e.target === e.currentTarget) setShowKeyCreator(false); }}
          onKeyDown={(e) => { if (e.key === 'Escape') setShowKeyCreator(false); }}
          role="dialog"
          aria-modal="true"
          tabIndex={-1}
        >
          <Card className="w-full max-w-2xl max-h-[90vh] overflow-y-auto">
            <CardHeader>
              <div className="flex items-center justify-between">
                <CardTitle className="flex items-center">
                  <Key className="mr-3 h-5 w-5" />
                  Create API Key
                </CardTitle>
                <Button variant="outline" onClick={() => setShowKeyCreator(false)}>
                  <XCircle className="h-4 w-4" />
                </Button>
              </div>
            </CardHeader>
            <CardContent className="space-y-6">
              <APIKeyCreationForm onClose={() => setShowKeyCreator(false)} onSuccess={() => {
                setShowKeyCreator(false);
                loadData();
              }} />
            </CardContent>
          </Card>
        </div>
      )}

      {/* Webhook Creation Modal */}
      {showWebhookCreator && (
        <div
          className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center p-4 z-50"
          onClick={(e) => { if (e.target === e.currentTarget) setShowWebhookCreator(false); }}
          onKeyDown={(e) => { if (e.key === 'Escape') setShowWebhookCreator(false); }}
          role="dialog"
          aria-modal="true"
          tabIndex={-1}
        >
          <Card className="w-full max-w-2xl max-h-[90vh] overflow-y-auto">
            <CardHeader>
              <div className="flex items-center justify-between">
                <CardTitle className="flex items-center">
                  <Webhook className="mr-3 h-5 w-5" />
                  Add Webhook
                </CardTitle>
                <Button variant="outline" onClick={() => setShowWebhookCreator(false)}>
                  <XCircle className="h-4 w-4" />
                </Button>
              </div>
            </CardHeader>
            <CardContent className="space-y-6">
              <WebhookCreationForm onClose={() => setShowWebhookCreator(false)} onSuccess={() => {
                setShowWebhookCreator(false);
                loadData();
              }} />
            </CardContent>
          </Card>
        </div>
      )}

      {/* API Documentation Modal */}
      {showDocumentation && documentation && (
        <div
          className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center p-4 z-50"
          onClick={(e) => { if (e.target === e.currentTarget) setShowDocumentation(false); }}
          onKeyDown={(e) => { if (e.key === 'Escape') setShowDocumentation(false); }}
          role="dialog"
          aria-modal="true"
          tabIndex={-1}
        >
          <Card className="w-full max-w-6xl max-h-[90vh] overflow-y-auto">
            <CardHeader>
              <div className="flex items-center justify-between">
                <CardTitle className="flex items-center">
                  <FileText className="mr-3 h-5 w-5" />
                  {(documentation?.info as Record<string, unknown>)?.title as string || 'API Documentation'}
                </CardTitle>
                <Button variant="outline" onClick={() => setShowDocumentation(false)}>
                  <XCircle className="h-4 w-4" />
                </Button>
              </div>
            </CardHeader>
            <CardContent className="space-y-6">
              {/* API Information */}
              <div className="space-y-4">
                <h3 className="text-lg font-semibold">API Information</h3>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <div>
                    <Label>Version</Label>
                    <div className="text-sm text-muted-foreground">{(documentation?.info as Record<string, unknown>)?.version as string}</div>
                  </div>
                  <div>
                    <Label>Contact</Label>
                    <div className="text-sm text-muted-foreground">{((documentation?.info as Record<string, unknown>)?.contact as Record<string, unknown>)?.email as string}</div>
                  </div>
                </div>
                <div>
                  <Label>Description</Label>
                  <div className="text-sm text-muted-foreground">{(documentation?.info as Record<string, unknown>)?.description as string}</div>
                </div>
              </div>

              {/* Server URLs */}
              <div className="space-y-4">
                <h3 className="text-lg font-semibold">Servers</h3>
                <div className="space-y-2">
                  {(documentation?.servers as Array<Record<string, unknown>> || []).map((server, index) => (
                    <div key={`item-${index}`} className="flex items-center justify-between p-3 border rounded-lg">
                      <div>
                        <code className="font-mono text-sm">{server.url as string}</code>
                        <div className="text-xs text-muted-foreground">{server.description as string}</div>
                      </div>
                      <Button
                        variant="outline"
                        size="sm"
                        onClick={() => copyToClipboard(String(server.url), 'Server URL')}
                      >
                        <Copy className="h-3 w-3" />
                      </Button>
                    </div>
                  ))}
                </div>
              </div>

              {/* Authentication */}
              <div className="space-y-4">
                <h3 className="text-lg font-semibold">Authentication</h3>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <Card>
                    <CardContent className="p-4">
                      <div className="flex items-center gap-2 mb-2">
                        <Shield className="h-4 w-4" />
                        <span className="font-medium">Bearer Token (JWT)</span>
                      </div>
                      <div className="text-sm text-muted-foreground">
                        Use JWT token in Authorization header
                      </div>
                      <code className="block bg-muted p-2 rounded mt-2 text-xs">
                        Authorization: Bearer eyJhbGciOiJIUzI1NiIs...
                      </code>
                    </CardContent>
                  </Card>
                  <Card>
                    <CardContent className="p-4">
                      <div className="flex items-center gap-2 mb-2">
                        <Key className="h-4 w-4" />
                        <span className="font-medium">API Key</span>
                      </div>
                      <div className="text-sm text-muted-foreground">
                        Use API key in x-api-key header
                      </div>
                      <code className="block bg-muted p-2 rounded mt-2 text-xs">
                        x-api-key: rk_test_abcd1234...
                      </code>
                    </CardContent>
                  </Card>
                </div>
              </div>

              {/* Rate Limits */}
              <div className="space-y-4">
                <h3 className="text-lg font-semibold">Rate Limits</h3>
                <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                  {Object.entries(((documentation?.rateLimit as Record<string, unknown>)?.limits as Record<string, unknown>) || {}).map(([type, limit]) => (
                    <Card key={type}>
                      <CardContent className="p-4 text-center">
                        <div className="font-medium capitalize">{type}</div>
                        <div className="text-2xl font-bold text-blue-600">{limit}</div>
                        <div className="text-xs text-muted-foreground">requests</div>
                      </CardContent>
                    </Card>
                  ))}
                </div>
              </div>

              {/* API Endpoints by Category */}
              <div className="space-y-4">
                <h3 className="text-lg font-semibold">API Endpoints</h3>
                <div className="space-y-6">
                  {(documentation?.endpoints as Array<Record<string, unknown>> || []).map((categoryGroup, index) => (
                    <div key={`item-${index}`}>
                      <h4 className="font-medium text-lg mb-3">{categoryGroup.category as string}</h4>
                      <div className="space-y-3">
                        {(categoryGroup.endpoints as Array<Record<string, unknown>> || []).map((endpoint, endpointIndex) => (
                          <Card key={endpointIndex}>
                            <CardContent className="p-4">
                              <div className="flex items-start justify-between mb-3">
                                <div className="flex items-center gap-3">
                                  <Badge className={`${getMethodColor(String(endpoint.method))} text-white`}>
                                    {endpoint.method as string}
                                  </Badge>
                                  <code className="font-mono text-sm">{endpoint.path as string}</code>
                                </div>
                              </div>
                              <div className="text-sm font-medium mb-1">{endpoint.summary as string}</div>
                              <div className="text-sm text-muted-foreground">{endpoint.description as string}</div>

                              {endpoint.parameters && (endpoint.parameters as Array<Record<string, unknown>>).length > 0 && (
                                <div className="mt-3">
                                  <div className="text-sm font-medium mb-2">Parameters:</div>
                                  <div className="grid grid-cols-1 gap-2">
                                    {(endpoint.parameters as Array<Record<string, unknown>>).map((param, paramIndex) => (
                                      <div key={paramIndex} className="flex items-center gap-2 text-xs">
                                        <code className="bg-muted px-1 rounded">{param.name as string}</code>
                                        <span className="text-muted-foreground">({param.in as string})</span>
                                        {param.required && <Badge variant="destructive" className="text-xs">required</Badge>}
                                        <span className="text-muted-foreground">- {param.description as string}</span>
                                      </div>
                                    ))}
                                  </div>
                                </div>
                              )}
                            </CardContent>
                          </Card>
                        ))}
                      </div>
                    </div>
                  ))}
                </div>
              </div>

              {/* Code Examples */}
              <div className="space-y-4">
                <h3 className="text-lg font-semibold">Code Examples</h3>
                <div className="space-y-4">
                  {Object.entries((documentation?.examples as Record<string, Record<string, unknown>>) || {}).map(([key, example]) => (
                    <Card key={key}>
                      <CardContent className="p-4">
                        <div className="font-medium mb-2 capitalize">{key.replace(/([A-Z])/g, ' $1').trim()}</div>
                        <div className="text-sm text-muted-foreground mb-3">{example.description as string}</div>
                        <pre className="bg-muted p-3 rounded text-xs overflow-x-auto">
                          <code>{example.code as string}</code>
                        </pre>
                      </CardContent>
                    </Card>
                  ))}
                </div>
              </div>

              {/* Error Codes */}
              <div className="space-y-4">
                <h3 className="text-lg font-semibold">Error Codes</h3>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                  {Object.entries((documentation?.errorCodes as Record<string, string>) || {}).map(([code, description]) => (
                    <div key={code} className="flex items-start gap-3 p-3 border rounded-lg">
                      <Badge variant={code.startsWith('2') ? 'default' : code.startsWith('4') ? 'secondary' : 'destructive'}>
                        {code}
                      </Badge>
                      <div className="text-sm text-muted-foreground">{description}</div>
                    </div>
                  ))}
                </div>
              </div>
            </CardContent>
          </Card>
        </div>
      )}
    </div>
  );
};

export default withErrorBoundary(ComprehensiveAPIAccess, { level: 'component' });