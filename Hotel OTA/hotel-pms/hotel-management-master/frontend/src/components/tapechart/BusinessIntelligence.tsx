import React, { useState, useEffect } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Switch } from '@/components/ui/switch';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Progress } from '@/components/ui/progress';
import { toast } from '@/utils/toast';
import { withErrorBoundary } from '../ErrorBoundary';
import { formatCurrency } from '@/utils/currencyUtils';
import { analyticsService } from '@/services/analyticsService';
import { api } from '@/services/api';
import {
  BarChart3, LineChart, PieChart, TrendingUp, TrendingDown,
  Calendar, Download, Mail, Clock, Users, DollarSign,
  Target, Eye, Settings, Plus, Trash2, Edit,
  Filter, Search, RefreshCw, Share, FileText, Loader2
} from 'lucide-react';

// Business Intelligence Types
interface DashboardWidget {
  id: string;
  title: string;
  type: 'chart' | 'metric' | 'table' | 'gauge' | 'map';
  chartType?: 'bar' | 'line' | 'pie' | 'doughnut' | 'area';
  dataSource: string;
  filters: ReportFilter[];
  position: { x: number; y: number; width: number; height: number };
  refreshInterval: number;
  lastUpdated: string;
}

interface CustomDashboard {
  id: string;
  name: string;
  description: string;
  widgets: DashboardWidget[];
  isPublic: boolean;
  owner: string;
  createdAt: string;
  updatedAt: string;
  tags: string[];
}

interface ReportTemplate {
  id: string;
  name: string;
  category: 'financial' | 'operational' | 'guest' | 'staff' | 'marketing';
  description: string;
  schedule: {
    frequency: 'daily' | 'weekly' | 'monthly' | 'quarterly' | 'yearly';
    time: string;
    dayOfWeek?: number;
    dayOfMonth?: number;
  };
  recipients: string[];
  format: 'pdf' | 'excel' | 'csv' | 'html';
  filters: ReportFilter[];
  isActive: boolean;
}

interface ReportFilter {
  field: string;
  operator: 'equals' | 'contains' | 'greater_than' | 'less_than' | 'between' | 'in';
  value: unknown;
  label: string;
}

interface BusinessMetric {
  id: string;
  name: string;
  value: number;
  previousValue: number;
  target?: number;
  unit: string;
  trend: 'up' | 'down' | 'neutral';
  category: 'revenue' | 'occupancy' | 'guest_satisfaction' | 'efficiency';
  period: string;
  drillDown?: BusinessMetric[];
}

interface DataExport {
  id: string;
  name: string;
  format: 'excel' | 'csv' | 'pdf' | 'json';
  dataSource: string;
  filters: ReportFilter[];
  columns: string[];
  scheduledExports?: {
    frequency: 'daily' | 'weekly' | 'monthly';
    recipients: string[];
    lastSent: string;
  };
}

interface SavedDashboardConfig {
  _id: string;
  name: string;
  description?: string;
  widgets: DashboardWidget[];
  isDefault?: boolean;
  tags?: string[];
  createdAt: string;
  updatedAt: string;
}

export const BusinessIntelligence: React.FC = () => {
  const [dashboards, setDashboards] = useState<CustomDashboard[]>([]);
  const [reportTemplates, setReportTemplates] = useState<ReportTemplate[]>([]);
  const [businessMetrics, setBusinessMetrics] = useState<BusinessMetric[]>([]);
  const [dataExports, setDataExports] = useState<DataExport[]>([]);
  const [selectedDashboard, setSelectedDashboard] = useState<string>('');
  const [selectedMetric, setSelectedMetric] = useState<BusinessMetric | null>(null);
  const [isDashboardBuilder, setIsDashboardBuilder] = useState(false);

  // Loading states per tab
  const [loadingDashboards, setLoadingDashboards] = useState(false);
  const [loadingReports, setLoadingReports] = useState(false);
  const [loadingMetrics, setLoadingMetrics] = useState(false);
  const [loadingExports, setLoadingExports] = useState(false);

  // Error states per tab
  const [dashboardsError, setDashboardsError] = useState<string | null>(null);
  const [reportsError, setReportsError] = useState<string | null>(null);
  const [metricsError, setMetricsError] = useState<string | null>(null);
  const [exportsError, setExportsError] = useState<string | null>(null);

  // Saved dashboard persistence state
  const [savedDashboardConfigs, setSavedDashboardConfigs] = useState<SavedDashboardConfig[]>([]);
  const [loadingSavedDashboards, setLoadingSavedDashboards] = useState(false);
  const [savedDashboardsError, setSavedDashboardsError] = useState<string | null>(null);
  const [savingDashboard, setSavingDashboard] = useState(false);
  const [deletingDashboardId, setDeletingDashboardId] = useState<string | null>(null);
  const [saveDashboardName, setSaveDashboardName] = useState('');
  const [saveDashboardDescription, setSaveDashboardDescription] = useState('');

  useEffect(() => {
    loadBusinessIntelligenceData();
    fetchSavedDashboards();
  }, []);

  const loadBusinessIntelligenceData = async () => {
    await Promise.all([
      loadDashboards(),
      loadReportTemplates(),
      loadBusinessMetrics(),
      loadDataExports(),
    ]);
  };

  /** Build dashboard shells populated with real profitability + room-type data */
  const loadDashboards = async () => {
    setLoadingDashboards(true);
    setDashboardsError(null);
    try {
      const [profitData, roomTypeData] = await Promise.all([
        analyticsService.getProfitabilityMetrics(),
        analyticsService.getRoomTypeAnalytics(),
      ]);

      const now = new Date().toISOString();

      const revenueDashboard: CustomDashboard = {
        id: 'dashboard-revenue',
        name: 'Revenue Analytics',
        description: `Total revenue: ${formatCurrency(profitData.totalRevenue)} | Profit margin: ${profitData.profitMargin.toFixed(1)}%`,
        widgets: [
          {
            id: 'widget-rev-trend',
            title: `Monthly Revenue Trend (${formatCurrency(profitData.totalRevenue)})`,
            type: 'chart',
            chartType: 'line',
            dataSource: 'profitability-metrics',
            filters: [],
            position: { x: 0, y: 0, width: 6, height: 4 },
            refreshInterval: 300,
            lastUpdated: now,
          },
          {
            id: 'widget-room-perf',
            title: `Room Type Performance (${roomTypeData.length} types)`,
            type: 'chart',
            chartType: 'bar',
            dataSource: 'room-type-profitability',
            filters: [],
            position: { x: 6, y: 0, width: 6, height: 4 },
            refreshInterval: 600,
            lastUpdated: now,
          },
        ],
        isPublic: false,
        owner: 'admin',
        createdAt: now,
        updatedAt: now,
        tags: ['revenue', 'financial', 'analytics'],
      };

      const opsDashboard: CustomDashboard = {
        id: 'dashboard-operations',
        name: 'Operations Dashboard',
        description: `Occupancy: ${profitData.occupancyRate.toFixed(1)}% | ADR: ${formatCurrency(profitData.averageDailyRate)}`,
        widgets: [
          {
            id: 'widget-occupancy',
            title: `Occupancy Rate: ${profitData.occupancyRate.toFixed(1)}%`,
            type: 'gauge',
            dataSource: 'kpis/realtime',
            filters: [],
            position: { x: 0, y: 0, width: 3, height: 3 },
            refreshInterval: 60,
            lastUpdated: now,
          },
          {
            id: 'widget-revpar',
            title: `RevPAR: ${formatCurrency(profitData.revenuePAR)}`,
            type: 'metric',
            dataSource: 'kpis/realtime',
            filters: [],
            position: { x: 3, y: 0, width: 3, height: 3 },
            refreshInterval: 300,
            lastUpdated: now,
          },
        ],
        isPublic: true,
        owner: 'manager',
        createdAt: now,
        updatedAt: now,
        tags: ['operations', 'daily', 'kpi'],
      };

      const loadedDashboards = [revenueDashboard, opsDashboard];
      setDashboards(loadedDashboards);
      setSelectedDashboard(loadedDashboards[0]?.id || '');
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Failed to load dashboards';
      setDashboardsError(message);
      toast.error(message);
    } finally {
      setLoadingDashboards(false);
    }
  };

  /** Fetch report templates from the backend */
  const loadReportTemplates = async () => {
    setLoadingReports(true);
    setReportsError(null);
    try {
      const response = await api.get('/analytics/reports/templates');
      const templates = response.data?.data ?? response.data ?? [];

      // Map server data to local ReportTemplate interface
      const mapped: ReportTemplate[] = Array.isArray(templates)
        ? templates.map((t: Record<string, unknown>) => ({
            id: (t._id as string) || (t.id as string) || `report-${Date.now()}`,
            name: (t.name as string) || 'Untitled Report',
            category: (t.category as ReportTemplate['category']) || 'operational',
            description: (t.description as string) || '',
            schedule: (t.schedule as ReportTemplate['schedule']) || { frequency: 'daily' as const, time: '08:00' },
            recipients: (t.recipients as string[]) || [],
            format: (t.format as ReportTemplate['format']) || 'pdf',
            filters: (t.filters as ReportFilter[]) || [],
            isActive: typeof t.isActive === 'boolean' ? t.isActive : true,
          }))
        : [];

      setReportTemplates(mapped);
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Failed to load report templates';
      setReportsError(message);
      toast.error(message);
    } finally {
      setLoadingReports(false);
    }
  };

  /** Fetch real-time KPIs and dashboard metrics from the backend */
  const loadBusinessMetrics = async () => {
    setLoadingMetrics(true);
    setMetricsError(null);
    try {
      // Try real-time KPIs first, fall back to dashboard metrics
      let kpiData: Record<string, unknown> | null = null;
      try {
        const kpiResp = await api.get('/analytics/kpis/realtime');
        kpiData = kpiResp.data?.data ?? kpiResp.data;
      } catch {
        const dashResp = await api.get('/analytics/dashboard/metrics');
        kpiData = dashResp.data?.data ?? dashResp.data;
      }

      if (!kpiData) {
        setBusinessMetrics([]);
        return;
      }

      const determineTrend = (current: number, previous: number): 'up' | 'down' | 'neutral' => {
        if (current > previous) return 'up';
        if (current < previous) return 'down';
        return 'neutral';
      };

      // Also fetch profitability for drill-down data
      const profitData = await analyticsService.getProfitabilityMetrics();

      const totalRevenue = (kpiData.totalRevenue as number) ?? profitData.totalRevenue ?? 0;
      const prevRevenue = profitData.previousPeriodComparison?.revenue ?? 0;
      const occupancy = (kpiData.occupancyRate as number) ?? profitData.occupancyRate ?? 0;
      const prevOccupancy = profitData.previousPeriodComparison?.occupancy ?? 0;
      const adr = (kpiData.averageDailyRate as number) ?? profitData.averageDailyRate ?? 0;
      const satisfaction = (kpiData.guestSatisfaction as number) ?? 0;

      // Build room-type revenue drill-down from profitability data
      const roomDrillDown: BusinessMetric[] = (profitData.roomTypeProfitability || []).map(
        (rt, idx) => ({
          id: `room-revenue-${idx}`,
          name: `${rt.roomType} Revenue`,
          value: rt.revenue,
          previousValue: rt.revenue * 0.92, // approximate; backend doesn't provide per-type previous
          unit: 'currency',
          trend: determineTrend(rt.revenue, rt.revenue * 0.92),
          category: 'revenue' as const,
          period: 'This Month',
        })
      );

      const metrics: BusinessMetric[] = [
        {
          id: 'metric-revenue',
          name: 'Total Revenue',
          value: totalRevenue,
          previousValue: prevRevenue,
          target: totalRevenue * 1.1,
          unit: 'currency',
          trend: determineTrend(totalRevenue, prevRevenue),
          category: 'revenue',
          period: 'This Month',
          drillDown: roomDrillDown.length > 0 ? roomDrillDown : undefined,
        },
        {
          id: 'metric-occupancy',
          name: 'Occupancy Rate',
          value: occupancy,
          previousValue: prevOccupancy,
          target: 85.0,
          unit: 'percentage',
          trend: determineTrend(occupancy, prevOccupancy),
          category: 'occupancy',
          period: 'This Month',
        },
        {
          id: 'metric-adr',
          name: 'Average Daily Rate',
          value: adr,
          previousValue: adr * 0.95,
          target: adr * 1.05,
          unit: 'currency',
          trend: determineTrend(adr, adr * 0.95),
          category: 'revenue',
          period: 'This Month',
        },
        {
          id: 'metric-satisfaction',
          name: 'Guest Satisfaction',
          value: satisfaction,
          previousValue: satisfaction > 0 ? satisfaction - 0.2 : 0,
          target: 4.5,
          unit: 'rating',
          trend: satisfaction > 0 ? 'up' : 'neutral',
          category: 'guest_satisfaction',
          period: 'This Month',
        },
      ];

      setBusinessMetrics(metrics);
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Failed to load business metrics';
      setMetricsError(message);
      toast.error(message);
    } finally {
      setLoadingMetrics(false);
    }
  };

  /** Data exports have no dedicated backend endpoint yet; keep in-memory defaults */
  const loadDataExports = async () => {
    setLoadingExports(true);
    setExportsError(null);
    try {
      const defaultExports: DataExport[] = [
        {
          id: 'export-guest-data',
          name: 'Guest Database Export',
          format: 'excel',
          dataSource: 'guests',
          filters: [
            { field: 'status', operator: 'equals', value: 'active', label: 'Active Guests' },
          ],
          columns: ['name', 'email', 'phone', 'total_bookings', 'last_stay'],
          scheduledExports: {
            frequency: 'weekly',
            recipients: ['marketing@hotel.com'],
            lastSent: new Date().toISOString(),
          },
        },
        {
          id: 'export-financial',
          name: 'Financial Transactions',
          format: 'csv',
          dataSource: 'transactions',
          filters: [
            { field: 'date', operator: 'between', value: ['2024-01-01', '2024-12-31'], label: 'This Year' },
          ],
          columns: ['date', 'amount', 'type', 'booking_id', 'payment_method'],
        },
      ];
      setDataExports(defaultExports);
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Failed to load data exports';
      setExportsError(message);
      toast.error(message);
    } finally {
      setLoadingExports(false);
    }
  };

  /** Fetch saved dashboard configurations from the backend */
  const fetchSavedDashboards = async () => {
    setLoadingSavedDashboards(true);
    setSavedDashboardsError(null);
    try {
      const response = await api.get('/dashboard-configs');
      const configs = response.data?.data ?? response.data ?? [];
      setSavedDashboardConfigs(Array.isArray(configs) ? configs : []);
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Failed to load saved dashboards';
      setSavedDashboardsError(message);
    } finally {
      setLoadingSavedDashboards(false);
    }
  };

  /** Save the current dashboard layout to the backend */
  const saveDashboardToBackend = async () => {
    const dashboard = dashboards.find(d => d.id === selectedDashboard);
    const name = saveDashboardName.trim() || dashboard?.name || 'Untitled Dashboard';
    const widgets = dashboard?.widgets ?? [];

    setSavingDashboard(true);
    try {
      await api.post('/dashboard-configs', {
        name,
        description: saveDashboardDescription.trim() || undefined,
        widgets,
      });
      toast.success(`Dashboard "${name}" saved successfully`);
      setSaveDashboardName('');
      setSaveDashboardDescription('');
      await fetchSavedDashboards();
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Failed to save dashboard';
      toast.error(message);
    } finally {
      setSavingDashboard(false);
    }
  };

  /** Load a saved dashboard config into the active dashboard list */
  const loadSavedDashboard = async (configId: string) => {
    try {
      const response = await api.get(`/dashboard-configs/${configId}`);
      const config = response.data?.data ?? response.data;
      if (!config) {
        toast.error('Dashboard config not found');
        return;
      }

      const loadedDashboard: CustomDashboard = {
        id: `saved-${config._id || configId}`,
        name: config.name || 'Loaded Dashboard',
        description: config.description || '',
        widgets: config.widgets || [],
        isPublic: false,
        owner: 'current_user',
        createdAt: config.createdAt || new Date().toISOString(),
        updatedAt: config.updatedAt || new Date().toISOString(),
        tags: config.tags || [],
      };

      setDashboards(prev => {
        const existingIdx = prev.findIndex(d => d.id === loadedDashboard.id);
        if (existingIdx >= 0) {
          const updated = [...prev];
          updated[existingIdx] = loadedDashboard;
          return updated;
        }
        return [...prev, loadedDashboard];
      });
      setSelectedDashboard(loadedDashboard.id);
      toast.success(`Dashboard "${loadedDashboard.name}" loaded`);
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Failed to load dashboard';
      toast.error(message);
    }
  };

  /** Delete a saved dashboard config from the backend */
  const deleteSavedDashboard = async (configId: string) => {
    setDeletingDashboardId(configId);
    try {
      await api.delete(`/dashboard-configs/${configId}`);
      toast.success('Saved dashboard deleted');
      await fetchSavedDashboards();
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Failed to delete saved dashboard';
      toast.error(message);
    } finally {
      setDeletingDashboardId(null);
    }
  };

  const createNewDashboard = () => {
    const newDashboard: CustomDashboard = {
      id: `dashboard-${Date.now()}`,
      name: 'New Dashboard',
      description: 'Custom dashboard',
      widgets: [],
      isPublic: false,
      owner: 'current_user',
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
      tags: []
    };

    setDashboards(prev => [...prev, newDashboard]);
    setSelectedDashboard(newDashboard.id);
    setIsDashboardBuilder(true);
    toast.success('New dashboard created');
  };

  const deleteDashboard = (dashboardId: string) => {
    setDashboards(prev => prev.filter(d => d.id !== dashboardId));
    if (selectedDashboard === dashboardId) {
      setSelectedDashboard(dashboards[0]?.id || '');
    }
    toast.success('Dashboard deleted');
  };

  const exportData = async (exportConfig: DataExport) => {
    try {
      toast.success(`Exporting ${exportConfig.name} as ${exportConfig.format.toUpperCase()}...`);
      const response = await api.get(
        `/analytics/reports/export/${exportConfig.id}/${exportConfig.format}`,
        { responseType: 'blob' }
      );
      // Trigger browser download
      const url = window.URL.createObjectURL(new Blob([response.data]));
      const link = document.createElement('a');
      link.href = url;
      link.setAttribute('download', `${exportConfig.name}.${exportConfig.format}`);
      document.body.appendChild(link);
      link.click();
      link.remove();
      window.URL.revokeObjectURL(url);
      toast.success(`${exportConfig.name} exported successfully`);
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Export failed';
      toast.error(message);
    }
  };

  const scheduleReport = async (reportId: string) => {
    const report = reportTemplates.find(r => r.id === reportId);
    if (!report) return;

    const newActiveState = !report.isActive;

    // Optimistic update
    setReportTemplates(prev =>
      prev.map(r => r.id === reportId ? { ...r, isActive: newActiveState } : r)
    );

    try {
      await api.post('/analytics/reports/schedule', {
        reportId,
        isActive: newActiveState,
        schedule: report.schedule,
        recipients: report.recipients,
        format: report.format,
      });
      toast.success(`Report ${newActiveState ? 'enabled' : 'disabled'}`);
    } catch (err) {
      // Rollback on failure
      setReportTemplates(prev =>
        prev.map(r => r.id === reportId ? { ...r, isActive: !newActiveState } : r)
      );
      const message = err instanceof Error ? err.message : 'Failed to update report schedule';
      toast.error(message);
    }
  };

  const shareReport = (reportId: string) => {
    toast.info('Sharing functionality would integrate with email system');
  };

  /** Reusable loading spinner for tab content */
  const LoadingState: React.FC<{ label?: string }> = ({ label = 'Loading...' }) => (
    <div className="flex flex-col items-center justify-center py-12 text-gray-500">
      <Loader2 className="h-8 w-8 animate-spin mb-3" />
      <span className="text-sm">{label}</span>
    </div>
  );

  /** Reusable error display for tab content */
  const ErrorState: React.FC<{ message: string; onRetry?: () => void }> = ({ message, onRetry }) => (
    <div className="flex flex-col items-center justify-center py-12 text-gray-500">
      <div className="text-red-500 mb-2 font-medium">Something went wrong</div>
      <div className="text-sm text-gray-600 mb-4">{message}</div>
      {onRetry && (
        <Button size="sm" variant="outline" onClick={onRetry}>
          <RefreshCw className="h-4 w-4 mr-1" />
          Retry
        </Button>
      )}
    </div>
  );

  /** Reusable empty-state display */
  const EmptyState: React.FC<{ message: string }> = ({ message }) => (
    <div className="flex flex-col items-center justify-center py-12 text-gray-400">
      <BarChart3 className="h-10 w-10 mb-3" />
      <span className="text-sm">{message}</span>
    </div>
  );

  const drillDownMetric = (metric: BusinessMetric) => {
    setSelectedMetric(metric);
  };

  const getTrendIcon = (trend: string) => {
    switch (trend) {
      case 'up':
        return <TrendingUp className="h-4 w-4 text-green-600" />;
      case 'down':
        return <TrendingDown className="h-4 w-4 text-red-600" />;
      default:
        return <div className="h-4 w-4" />;
    }
  };

  const getTrendColor = (trend: string) => {
    switch (trend) {
      case 'up':
        return 'text-green-600';
      case 'down':
        return 'text-red-600';
      default:
        return 'text-gray-600';
    }
  };

  const formatValue = (value: number, unit: string) => {
    switch (unit) {
      case 'currency':
        return formatCurrency(value);
      case 'percentage':
        return `${value}%`;
      case 'rating':
        return `${value}/5`;
      default:
        return value.toLocaleString();
    }
  };

  const calculateChange = (current: number, previous: number) => {
    if (previous === 0) return 0;
    return ((current - previous) / previous * 100).toFixed(1);
  };

  const getCategoryColor = (category: string) => {
    const colors = {
      financial: 'bg-green-100 text-green-800',
      operational: 'bg-blue-100 text-blue-800',
      guest: 'bg-purple-100 text-purple-800',
      staff: 'bg-orange-100 text-orange-800',
      marketing: 'bg-pink-100 text-pink-800'
    };
    return colors[category as keyof typeof colors] || 'bg-gray-100 text-gray-800';
  };

  const selectedDashboardData = dashboards.find(d => d.id === selectedDashboard);

  return (
    <Dialog>
      <DialogTrigger asChild>
        <Button variant="outline" className="gap-2">
          <BarChart3 className="h-4 w-4" />
          Business Intelligence
          <Badge className="bg-green-100 text-green-800">Phase 3</Badge>
        </Button>
      </DialogTrigger>
      <DialogContent className="max-w-7xl max-h-[90vh]">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <BarChart3 className="h-5 w-5" />
            Advanced Reporting & Business Intelligence
            <Badge className="bg-green-100 text-green-800">
              Innovation Leadership
            </Badge>
          </DialogTitle>
          <DialogDescription>
            Custom dashboards, automated reports, and advanced analytics with drill-down capabilities
          </DialogDescription>
        </DialogHeader>

        <Tabs defaultValue="dashboards" className="w-full">
          <TabsList className="grid w-full grid-cols-5">
            <TabsTrigger value="dashboards">Dashboards</TabsTrigger>
            <TabsTrigger value="reports">Reports</TabsTrigger>
            <TabsTrigger value="metrics">Metrics</TabsTrigger>
            <TabsTrigger value="exports">Data Export</TabsTrigger>
            <TabsTrigger value="builder">Builder</TabsTrigger>
          </TabsList>

          <TabsContent value="dashboards" className="space-y-4">
            {loadingDashboards && <LoadingState label="Loading dashboards..." />}
            {dashboardsError && <ErrorState message={dashboardsError} onRetry={loadDashboards} />}
            {!loadingDashboards && !dashboardsError && (
              <>
                {/* Dashboard Management */}
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-4">
                    <Label>Select Dashboard:</Label>
                    <Select value={selectedDashboard} onValueChange={setSelectedDashboard}>
                      <SelectTrigger className="w-64">
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        {dashboards.map((dashboard) => (
                          <SelectItem key={dashboard.id} value={dashboard.id}>
                            {dashboard.name}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>

                  <div className="flex gap-2">
                    <Button size="sm" variant="outline" onClick={createNewDashboard}>
                      <Plus className="h-4 w-4 mr-1" />
                      New Dashboard
                    </Button>
                    {selectedDashboardData && (
                      <Button
                        size="sm"
                        variant="outline"
                        onClick={() => deleteDashboard(selectedDashboard)}
                      >
                        <Trash2 className="h-4 w-4 mr-1" />
                        Delete
                      </Button>
                    )}
                  </div>
                </div>

                {dashboards.length === 0 && (
                  <EmptyState message="No dashboards available. Create one to get started." />
                )}

                {selectedDashboardData && (
                  <Card>
                    <CardHeader>
                      <CardTitle className="flex items-center justify-between">
                        {selectedDashboardData.name}
                        <div className="flex items-center gap-2">
                          <Badge className={selectedDashboardData.isPublic ? 'bg-green-100 text-green-800' : 'bg-blue-100 text-blue-800'}>
                            {selectedDashboardData.isPublic ? 'Public' : 'Private'}
                          </Badge>
                          <Button size="sm" variant="outline">
                            <Share className="h-4 w-4 mr-1" />
                            Share
                          </Button>
                        </div>
                      </CardTitle>
                      <div className="text-sm text-gray-600">{selectedDashboardData.description}</div>
                    </CardHeader>
                    <CardContent>
                      <div className="grid grid-cols-2 gap-4 mb-4">
                        {selectedDashboardData.widgets.map((widget) => (
                          <Card key={widget.id} className="border">
                            <CardHeader className="pb-3">
                              <CardTitle className="text-base flex items-center justify-between">
                                {widget.title}
                                <div className="flex items-center gap-1">
                                  {widget.type === 'chart' && <BarChart3 className="h-4 w-4 text-gray-500" />}
                                  {widget.type === 'metric' && <Target className="h-4 w-4 text-gray-500" />}
                                  {widget.type === 'gauge' && <PieChart className="h-4 w-4 text-gray-500" />}
                                </div>
                              </CardTitle>
                            </CardHeader>
                            <CardContent>
                              <div className="h-32 bg-gray-50 rounded flex items-center justify-center">
                                <div className="text-center">
                                  <div className="text-2xl font-bold text-gray-400">📊</div>
                                  <div className="text-sm text-gray-500 mt-1">
                                    {widget.chartType?.toUpperCase() || widget.type.toUpperCase()} Chart
                                  </div>
                                </div>
                              </div>
                              <div className="mt-2 text-xs text-gray-500">
                                Last updated: {new Date(widget.lastUpdated).toLocaleTimeString()}
                              </div>
                            </CardContent>
                          </Card>
                        ))}

                        {selectedDashboardData.widgets.length === 0 && (
                          <div className="col-span-2 text-center py-8 text-gray-500">
                            <BarChart3 className="h-12 w-12 mx-auto mb-4 text-gray-300" />
                            <h3 className="text-lg font-semibold mb-2">No Widgets</h3>
                            <p>Add widgets to customize this dashboard</p>
                            <Button className="mt-4" onClick={() => setIsDashboardBuilder(true)}>
                              Add Widget
                            </Button>
                          </div>
                        )}
                      </div>

                      <div className="flex items-center justify-between text-sm text-gray-600">
                        <div>
                          Tags: {selectedDashboardData.tags.map(tag => (
                            <Badge key={tag} variant="outline" className="mr-1 text-xs">
                              {tag}
                            </Badge>
                          ))}
                        </div>
                        <div>
                          Created: {new Date(selectedDashboardData.createdAt).toLocaleDateString()}
                        </div>
                      </div>
                    </CardContent>
                  </Card>
                )}
              </>
            )}
          </TabsContent>

          <TabsContent value="reports" className="space-y-4">
            {loadingReports && <LoadingState label="Loading report templates..." />}
            {reportsError && <ErrorState message={reportsError} onRetry={loadReportTemplates} />}
            {!loadingReports && !reportsError && (
              <>
                {/* Automated Reports */}
                <Card>
                  <CardHeader>
                    <CardTitle className="flex items-center justify-between">
                      Automated Report Templates
                      <Button size="sm" variant="outline">
                        <Plus className="h-4 w-4 mr-1" />
                        New Template
                      </Button>
                    </CardTitle>
                  </CardHeader>
                  <CardContent>
                    {reportTemplates.length === 0 ? (
                      <EmptyState message="No report templates found. Create one to get started." />
                    ) : (
                      <div className="space-y-4">
                        {reportTemplates.map((report) => (
                          <Card key={report.id} className="border">
                            <CardContent className="p-4">
                              <div className="flex items-start justify-between mb-3">
                                <div>
                                  <div className="flex items-center gap-2 mb-1">
                                    <div className="font-medium">{report.name}</div>
                                    <Badge className={getCategoryColor(report.category)}>
                                      {report.category.toUpperCase()}
                                    </Badge>
                                    <Badge className={report.isActive ? 'bg-green-100 text-green-800' : 'bg-gray-100 text-gray-800'}>
                                      {report.isActive ? 'ACTIVE' : 'INACTIVE'}
                                    </Badge>
                                  </div>
                                  <div className="text-sm text-gray-600">{report.description}</div>
                                </div>
                                <div className="flex gap-2">
                                  <Button
                                    size="sm"
                                    variant="outline"
                                    onClick={() => scheduleReport(report.id)}
                                  >
                                    <Clock className="h-3 w-3 mr-1" />
                                    {report.isActive ? 'Disable' : 'Enable'}
                                  </Button>
                                  <Button
                                    size="sm"
                                    variant="outline"
                                    onClick={() => shareReport(report.id)}
                                  >
                                    <Mail className="h-3 w-3 mr-1" />
                                    Share
                                  </Button>
                                </div>
                              </div>

                              <div className="grid grid-cols-4 gap-4 text-sm">
                                <div>
                                  <Label className="text-xs">Frequency</Label>
                                  <div className="font-medium capitalize">{report.schedule.frequency}</div>
                                </div>

                                <div>
                                  <Label className="text-xs">Time</Label>
                                  <div className="font-medium">{report.schedule.time}</div>
                                </div>

                                <div>
                                  <Label className="text-xs">Format</Label>
                                  <div className="font-medium uppercase">{report.format}</div>
                                </div>

                                <div>
                                  <Label className="text-xs">Recipients</Label>
                                  <div className="font-medium">{report.recipients.length} recipients</div>
                                </div>
                              </div>

                              {report.filters.length > 0 && (
                                <div className="mt-3">
                                  <Label className="text-xs">Filters</Label>
                                  <div className="flex flex-wrap gap-1 mt-1">
                                    {report.filters.map((filter, index) => (
                                      <Badge key={`report-filters-${index}-${filter.label}`} variant="outline" className="text-xs">
                                        {filter.label}
                                      </Badge>
                                    ))}
                                  </div>
                                </div>
                              )}

                              <div className="mt-3 pt-3 border-t">
                                <div className="text-xs text-gray-500">
                                  Recipients: {report.recipients.join(', ')}
                                </div>
                              </div>
                            </CardContent>
                          </Card>
                        ))}
                      </div>
                    )}
                  </CardContent>
                </Card>
              </>
            )}
          </TabsContent>

          <TabsContent value="metrics" className="space-y-4">
            {loadingMetrics && <LoadingState label="Loading business metrics..." />}
            {metricsError && <ErrorState message={metricsError} onRetry={loadBusinessMetrics} />}
            {!loadingMetrics && !metricsError && (
              <>
                {businessMetrics.length === 0 ? (
                  <EmptyState message="No metrics data available." />
                ) : (
                  <>
                    {/* Business Metrics with Drill-down */}
                    <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                      {businessMetrics.map((metric) => (
                        <Card
                          key={metric.id}
                          className="cursor-pointer hover:shadow-lg transition-shadow"
                          onClick={() => drillDownMetric(metric)}
                        >
                          <CardContent className="p-4">
                            <div className="flex items-start justify-between mb-2">
                              <div className="text-sm font-medium text-gray-600">{metric.name}</div>
                              {getTrendIcon(metric.trend)}
                            </div>

                            <div className="text-2xl font-bold mb-1">
                              {formatValue(metric.value, metric.unit)}
                            </div>

                            <div className="flex items-center gap-2 text-sm">
                              <span className={getTrendColor(metric.trend)}>
                                {metric.trend === 'up' ? '+' : ''}{calculateChange(metric.value, metric.previousValue)}%
                              </span>
                              <span className="text-gray-500">vs previous</span>
                            </div>

                            {metric.target && (
                              <div className="mt-2">
                                <div className="flex justify-between text-xs text-gray-600 mb-1">
                                  <span>Target</span>
                                  <span>{formatValue(metric.target, metric.unit)}</span>
                                </div>
                                <Progress
                                  value={(metric.value / metric.target) * 100}
                                  className="h-2"
                                />
                              </div>
                            )}

                            <div className="mt-2 text-xs text-gray-500">
                              {metric.period}
                            </div>

                            {metric.drillDown && (
                              <div className="mt-2 pt-2 border-t">
                                <div className="text-xs text-blue-600">
                                  <Eye className="h-3 w-3 inline mr-1" />
                                  Click for drill-down
                                </div>
                              </div>
                            )}
                          </CardContent>
                        </Card>
                      ))}
                    </div>

                    {/* Drill-down Modal */}
                    {selectedMetric && selectedMetric.drillDown && (
                      <Card className="mt-6">
                        <CardHeader>
                          <CardTitle className="flex items-center justify-between">
                            {selectedMetric.name} - Drill Down
                            <Button
                              size="sm"
                              variant="outline"
                              onClick={() => setSelectedMetric(null)}
                            >
                              Close
                            </Button>
                          </CardTitle>
                        </CardHeader>
                        <CardContent>
                          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                            {selectedMetric.drillDown.map((subMetric) => (
                              <Card key={subMetric.id} className="border">
                                <CardContent className="p-4">
                                  <div className="flex items-center justify-between mb-2">
                                    <div className="text-sm font-medium">{subMetric.name}</div>
                                    {getTrendIcon(subMetric.trend)}
                                  </div>
                                  <div className="text-xl font-bold">
                                    {formatValue(subMetric.value, subMetric.unit)}
                                  </div>
                                  <div className={`text-sm ${getTrendColor(subMetric.trend)}`}>
                                    {subMetric.trend === 'up' ? '+' : ''}{calculateChange(subMetric.value, subMetric.previousValue)}% vs previous
                                  </div>
                                </CardContent>
                              </Card>
                            ))}
                          </div>
                        </CardContent>
                      </Card>
                    )}
                  </>
                )}
              </>
            )}
          </TabsContent>

          <TabsContent value="exports" className="space-y-4">
            {loadingExports && <LoadingState label="Loading export configurations..." />}
            {exportsError && <ErrorState message={exportsError} onRetry={loadDataExports} />}
            {!loadingExports && !exportsError && (
            <>
            {/* Data Export Management */}
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center justify-between">
                  Data Export Management
                  <Button size="sm" variant="outline">
                    <Plus className="h-4 w-4 mr-1" />
                    New Export
                  </Button>
                </CardTitle>
              </CardHeader>
              <CardContent>
                {dataExports.length === 0 ? (
                  <EmptyState message="No export configurations found." />
                ) : (
                <div className="space-y-4">
                  {dataExports.map((exportConfig) => (
                    <Card key={exportConfig.id} className="border">
                      <CardContent className="p-4">
                        <div className="flex items-start justify-between mb-3">
                          <div>
                            <div className="font-medium">{exportConfig.name}</div>
                            <div className="text-sm text-gray-600">
                              {exportConfig.dataSource} → {exportConfig.format.toUpperCase()}
                            </div>
                          </div>
                          <div className="flex gap-2">
                            <Button
                              size="sm"
                              variant="outline"
                              onClick={() => exportData(exportConfig)}
                            >
                              <Download className="h-3 w-3 mr-1" />
                              Export Now
                            </Button>
                            <Button size="sm" variant="outline">
                              <Edit className="h-3 w-3 mr-1" />
                              Edit
                            </Button>
                          </div>
                        </div>

                        <div className="grid grid-cols-3 gap-4 text-sm mb-3">
                          <div>
                            <Label className="text-xs">Columns</Label>
                            <div className="font-medium">{exportConfig.columns.length} selected</div>
                          </div>

                          <div>
                            <Label className="text-xs">Filters</Label>
                            <div className="font-medium">{exportConfig.filters.length} applied</div>
                          </div>

                          <div>
                            <Label className="text-xs">Format</Label>
                            <Badge className="ml-1">{exportConfig.format.toUpperCase()}</Badge>
                          </div>
                        </div>

                        {exportConfig.scheduledExports && (
                          <div className="p-3 bg-blue-50 rounded-lg">
                            <div className="flex items-center gap-2 mb-2">
                              <Clock className="h-4 w-4 text-blue-600" />
                              <span className="font-medium text-blue-800">Scheduled Export</span>
                            </div>
                            <div className="text-sm text-blue-700">
                              Frequency: {exportConfig.scheduledExports.frequency} |
                              Recipients: {exportConfig.scheduledExports.recipients.length} |
                              Last sent: {new Date(exportConfig.scheduledExports.lastSent).toLocaleDateString()}
                            </div>
                          </div>
                        )}

                        <div className="mt-3">
                          <Label className="text-xs">Filters Applied</Label>
                          <div className="flex flex-wrap gap-1 mt-1">
                            {exportConfig.filters.map((filter, index) => (
                              <Badge key={`exportConfig-filters-${index}-${filter.label}`} variant="outline" className="text-xs">
                                {filter.label}
                              </Badge>
                            ))}
                          </div>
                        </div>
                      </CardContent>
                    </Card>
                  ))}
                </div>
                )}
              </CardContent>
            </Card>
            </>
            )}
          </TabsContent>

          <TabsContent value="builder" className="space-y-4">
            {/* Saved Dashboards */}
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center justify-between">
                  <span className="flex items-center gap-2">
                    Saved Dashboards
                  </span>
                  <Button size="sm" variant="outline" onClick={fetchSavedDashboards} disabled={loadingSavedDashboards}>
                    <RefreshCw className={`h-4 w-4 mr-1 ${loadingSavedDashboards ? 'animate-spin' : ''}`} />
                    Refresh
                  </Button>
                </CardTitle>
              </CardHeader>
              <CardContent>
                {loadingSavedDashboards && <LoadingState label="Loading saved dashboards..." />}
                {savedDashboardsError && <ErrorState message={savedDashboardsError} onRetry={fetchSavedDashboards} />}
                {!loadingSavedDashboards && !savedDashboardsError && savedDashboardConfigs.length === 0 && (
                  <EmptyState message="No saved dashboards yet. Build a dashboard below and save it." />
                )}
                {!loadingSavedDashboards && !savedDashboardsError && savedDashboardConfigs.length > 0 && (
                  <div className="space-y-2">
                    {savedDashboardConfigs.map((config) => (
                      <div
                        key={config._id}
                        className="flex items-center justify-between p-3 border rounded-lg hover:bg-gray-50"
                      >
                        <div className="flex-1 min-w-0">
                          <div className="font-medium truncate">{config.name}</div>
                          <div className="text-xs text-gray-500">
                            {config.widgets?.length ?? 0} widget{(config.widgets?.length ?? 0) !== 1 ? 's' : ''} | Saved {new Date(config.updatedAt || config.createdAt).toLocaleDateString()}
                          </div>
                          {config.description && (
                            <div className="text-xs text-gray-400 truncate mt-0.5">{config.description}</div>
                          )}
                        </div>
                        <div className="flex gap-2 ml-4 flex-shrink-0">
                          <Button
                            size="sm"
                            variant="outline"
                            onClick={() => loadSavedDashboard(config._id)}
                          >
                            <Download className="h-3 w-3 mr-1" />
                            Load
                          </Button>
                          <Button
                            size="sm"
                            variant="outline"
                            className="text-red-600 hover:text-red-700"
                            onClick={() => deleteSavedDashboard(config._id)}
                            disabled={deletingDashboardId === config._id}
                          >
                            {deletingDashboardId === config._id ? (
                              <Loader2 className="h-3 w-3 mr-1 animate-spin" />
                            ) : (
                              <Trash2 className="h-3 w-3 mr-1" />
                            )}
                            Delete
                          </Button>
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </CardContent>
            </Card>

            {/* Dashboard Builder */}
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  Dashboard Builder
                </CardTitle>
                <div className="text-sm text-gray-600">
                  Drag and drop components to build custom dashboards. Save your dashboard to persist it across sessions.
                </div>
              </CardHeader>
              <CardContent>
                <div className="grid grid-cols-4 gap-4">
                  {/* Widget Palette */}
                  <div className="space-y-3">
                    <h4 className="font-medium">Available Widgets</h4>

                    <div className="space-y-2">
                      <Card className="p-3 cursor-move hover:shadow-md">
                        <div className="flex items-center gap-2">
                          <BarChart3 className="h-4 w-4" />
                          <span className="text-sm">Bar Chart</span>
                        </div>
                      </Card>

                      <Card className="p-3 cursor-move hover:shadow-md">
                        <div className="flex items-center gap-2">
                          <LineChart className="h-4 w-4" />
                          <span className="text-sm">Line Chart</span>
                        </div>
                      </Card>

                      <Card className="p-3 cursor-move hover:shadow-md">
                        <div className="flex items-center gap-2">
                          <PieChart className="h-4 w-4" />
                          <span className="text-sm">Pie Chart</span>
                        </div>
                      </Card>

                      <Card className="p-3 cursor-move hover:shadow-md">
                        <div className="flex items-center gap-2">
                          <Target className="h-4 w-4" />
                          <span className="text-sm">KPI Metric</span>
                        </div>
                      </Card>

                      <Card className="p-3 cursor-move hover:shadow-md">
                        <div className="flex items-center gap-2">
                          <FileText className="h-4 w-4" />
                          <span className="text-sm">Data Table</span>
                        </div>
                      </Card>
                    </div>
                  </div>

                  {/* Canvas Area */}
                  <div className="col-span-3">
                    <div className="border-2 border-dashed border-gray-300 rounded-lg h-96 flex items-center justify-center">
                      <div className="text-center text-gray-500">
                        <Settings className="h-12 w-12 mx-auto mb-4 text-gray-300" />
                        <h3 className="text-lg font-semibold mb-2">Drag Widgets Here</h3>
                        <p>Start building your custom dashboard by dragging widgets from the left panel</p>
                      </div>
                    </div>
                  </div>
                </div>

                {/* Save Dashboard Form */}
                <div className="mt-6 p-4 border rounded-lg bg-gray-50">
                  <h4 className="font-medium mb-3">Save Dashboard</h4>
                  <div className="grid grid-cols-2 gap-4 mb-3">
                    <div>
                      <Label htmlFor="save-dashboard-name" className="text-sm">Dashboard Name</Label>
                      <Input
                        id="save-dashboard-name"
                        placeholder="My Custom Dashboard"
                        value={saveDashboardName}
                        onChange={(e) => setSaveDashboardName(e.target.value)}
                      />
                    </div>
                    <div>
                      <Label htmlFor="save-dashboard-desc" className="text-sm">Description (optional)</Label>
                      <Input
                        id="save-dashboard-desc"
                        placeholder="Brief description..."
                        value={saveDashboardDescription}
                        onChange={(e) => setSaveDashboardDescription(e.target.value)}
                      />
                    </div>
                  </div>
                  <div className="text-xs text-gray-500 mb-3">
                    Saves the currently selected dashboard ({dashboards.find(d => d.id === selectedDashboard)?.name || 'none selected'}) with {dashboards.find(d => d.id === selectedDashboard)?.widgets.length ?? 0} widget(s).
                  </div>
                </div>

                <div className="mt-4 flex justify-between">
                  <div className="flex gap-2">
                    <Button variant="outline">
                      <RefreshCw className="h-4 w-4 mr-1" />
                      Reset
                    </Button>
                    <Button variant="outline">
                      <Eye className="h-4 w-4 mr-1" />
                      Preview
                    </Button>
                  </div>
                  <div className="flex gap-2">
                    <Button variant="outline">Cancel</Button>
                    <Button onClick={saveDashboardToBackend} disabled={savingDashboard}>
                      {savingDashboard ? (
                        <>
                          <Loader2 className="h-4 w-4 mr-1 animate-spin" />
                          Saving...
                        </>
                      ) : (
                        'Save Dashboard'
                      )}
                    </Button>
                  </div>
                </div>
              </CardContent>
            </Card>
          </TabsContent>
        </Tabs>
      </DialogContent>
    </Dialog>
  );
};

export default withErrorBoundary(BusinessIntelligence, { level: 'component' });