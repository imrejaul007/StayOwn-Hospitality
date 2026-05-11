import React, { useState, useMemo } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '../ui/card';
import { Button } from '../ui/button';
import { Input } from '../ui/input';
import { Label } from '../ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '../ui/select';
import { Checkbox } from '../ui/checkbox';
import { Badge } from '../ui/badge';
import { Separator } from '../ui/separator';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '../ui/tabs';
import { ScrollArea } from '../ui/scroll-area';
import {
  Download,
  Settings,
  BarChart3,
  FileText,
  Filter,
  Plus,
  X,
  GripVertical,
  Eye
} from 'lucide-react';
import { format } from 'date-fns';

interface Property {
  id: string;
  name: string;
  location: string;
  status: 'active' | 'inactive';
  rooms: {
    total: number;
    occupied: number;
    available: number;
    maintenance: number;
  };
  performance: {
    occupancyRate: number;
    adr: number;
    revpar: number;
    revenue: number;
    lastMonth: {
      occupancyRate: number;
      adr: number;
      revpar: number;
      revenue: number;
    };
  };
}

interface ReportMetric {
  id: string;
  name: string;
  description: string;
  category: 'financial' | 'operational' | 'guest' | 'staff';
  type: 'number' | 'percentage' | 'currency' | 'text';
  aggregation: 'sum' | 'average' | 'count' | 'max' | 'min';
}

interface ReportFilter {
  id: string;
  field: string;
  operator: 'equals' | 'contains' | 'greater_than' | 'less_than' | 'between' | 'in';
  value: unknown;
  label: string;
}

interface ReportConfig {
  name: string;
  description: string;
  selectedMetrics: string[];
  filters: ReportFilter[];
  dateRange: {
    start: Date;
    end: Date;
  };
  groupBy: string;
  sortBy: string;
  sortOrder: 'asc' | 'desc';
  exportFormat: 'csv' | 'excel' | 'pdf';
  schedule?: {
    enabled: boolean;
    frequency: 'daily' | 'weekly' | 'monthly';
    time: string;
    recipients: string[];
  };
}

interface CustomReportBuilderProps {
  properties?: Property[];
  selectedProperty?: Property | null;
  onSaveReport?: (config: ReportConfig) => void;
  onGenerateReport?: (config: ReportConfig) => void;
}

const availableMetrics: ReportMetric[] = [
  // Financial Metrics
  { id: 'revenue', name: 'Total Revenue', description: 'Total revenue generated', category: 'financial', type: 'currency', aggregation: 'sum' },
  { id: 'adr', name: 'Average Daily Rate', description: 'Average room rate per day', category: 'financial', type: 'currency', aggregation: 'average' },
  { id: 'revpar', name: 'Revenue Per Available Room', description: 'Revenue divided by available rooms', category: 'financial', type: 'currency', aggregation: 'average' },
  { id: 'gross_profit', name: 'Gross Profit', description: 'Revenue minus direct costs', category: 'financial', type: 'currency', aggregation: 'sum' },

  // Operational Metrics
  { id: 'occupancy_rate', name: 'Occupancy Rate', description: 'Percentage of rooms occupied', category: 'operational', type: 'percentage', aggregation: 'average' },
  { id: 'rooms_sold', name: 'Rooms Sold', description: 'Number of rooms sold', category: 'operational', type: 'number', aggregation: 'sum' },
  { id: 'available_rooms', name: 'Available Rooms', description: 'Number of available rooms', category: 'operational', type: 'number', aggregation: 'average' },
  { id: 'maintenance_rooms', name: 'Rooms in Maintenance', description: 'Number of rooms under maintenance', category: 'operational', type: 'number', aggregation: 'average' },

  // Guest Metrics
  { id: 'guest_satisfaction', name: 'Guest Satisfaction Score', description: 'Average guest satisfaction rating', category: 'guest', type: 'number', aggregation: 'average' },
  { id: 'repeat_guests', name: 'Repeat Guests', description: 'Number of returning guests', category: 'guest', type: 'number', aggregation: 'count' },
  { id: 'avg_stay_length', name: 'Average Stay Length', description: 'Average number of nights per booking', category: 'guest', type: 'number', aggregation: 'average' },

  // Staff Metrics
  { id: 'staff_efficiency', name: 'Staff Efficiency Score', description: 'Staff performance metrics', category: 'staff', type: 'percentage', aggregation: 'average' },
  { id: 'task_completion_rate', name: 'Task Completion Rate', description: 'Percentage of tasks completed on time', category: 'staff', type: 'percentage', aggregation: 'average' },
];

const filterOperators = [
  { value: 'equals', label: 'Equals' },
  { value: 'contains', label: 'Contains' },
  { value: 'greater_than', label: 'Greater Than' },
  { value: 'less_than', label: 'Less Than' },
  { value: 'between', label: 'Between' },
  { value: 'in', label: 'In' },
];

const groupByOptions = [
  { value: 'property', label: 'Property' },
  { value: 'day', label: 'Day' },
  { value: 'week', label: 'Week' },
  { value: 'month', label: 'Month' },
  { value: 'quarter', label: 'Quarter' },
  { value: 'year', label: 'Year' },
];

export const CustomReportBuilder: React.FC<CustomReportBuilderProps> = ({
  properties = [],
  selectedProperty,
  onSaveReport,
  onGenerateReport
}) => {
  const [reportConfig, setReportConfig] = useState<ReportConfig>({
    name: '',
    description: '',
    selectedMetrics: [],
    filters: [],
    dateRange: {
      start: new Date(Date.now() - 30 * 24 * 60 * 60 * 1000), // 30 days ago
      end: new Date(),
    },
    groupBy: 'property',
    sortBy: 'revenue',
    sortOrder: 'desc',
    exportFormat: 'excel',
  });

  const [activeTab, setActiveTab] = useState<string>('metrics');
  const [previewData, setPreviewData] = useState<unknown[]>([]);
  const [showPreview, setShowPreview] = useState(false);

  const selectedMetricsData = useMemo(() => {
    return availableMetrics.filter(metric => reportConfig.selectedMetrics.includes(metric.id));
  }, [reportConfig.selectedMetrics]);

  const metricsByCategory = useMemo(() => {
    return availableMetrics.reduce((acc, metric) => {
      if (!acc[metric.category]) {
        acc[metric.category] = [];
      }
      acc[metric.category].push(metric);
      return acc;
    }, {} as Record<string, ReportMetric[]>);
  }, []);

  const handleMetricToggle = (metricId: string) => {
    setReportConfig(prev => ({
      ...prev,
      selectedMetrics: prev.selectedMetrics.includes(metricId)
        ? prev.selectedMetrics.filter(id => id !== metricId)
        : [...prev.selectedMetrics, metricId]
    }));
  };

  const handleAddFilter = () => {
    const newFilter: ReportFilter = {
      id: Date.now().toString(),
      field: 'property',
      operator: 'equals',
      value: '',
      label: 'New Filter'
    };
    setReportConfig(prev => ({
      ...prev,
      filters: [...prev.filters, newFilter]
    }));
  };

  const handleRemoveFilter = (filterId: string) => {
    setReportConfig(prev => ({
      ...prev,
      filters: prev.filters.filter(filter => filter.id !== filterId)
    }));
  };

  const handleUpdateFilter = (filterId: string, updates: Partial<ReportFilter>) => {
    setReportConfig(prev => ({
      ...prev,
      filters: prev.filters.map(filter =>
        filter.id === filterId ? { ...filter, ...updates } : filter
      )
    }));
  };

  const generatePreviewData = () => {
    // Generate sample preview data based on selected metrics
    const sampleData = properties.slice(0, 5).map(property => {
      const data: Record<string, unknown> = {
        property: property.name,
        id: property.id,
      };

      selectedMetricsData.forEach(metric => {
        switch (metric.id) {
          case 'revenue':
            data[metric.id] = property.performance.revenue;
            break;
          case 'adr':
            data[metric.id] = property.performance.adr;
            break;
          case 'revpar':
            data[metric.id] = property.performance.revpar;
            break;
          case 'occupancy_rate':
            data[metric.id] = property.performance.occupancyRate;
            break;
          case 'rooms_sold':
            data[metric.id] = property.rooms.occupied;
            break;
          case 'available_rooms':
            data[metric.id] = property.rooms.available;
            break;
          case 'maintenance_rooms':
            data[metric.id] = property.rooms?.outOfOrder || 0;
            break;
          case 'guest_satisfaction':
            data[metric.id] = property.rating || 0;
            break;
          case 'gross_profit':
            data[metric.id] = property.performance?.revenue || 0;
            break;
          default:
            data[metric.id] = 0;
        }
      });

      return data;
    });

    setPreviewData(sampleData);
    setShowPreview(true);
  };

  const handleSaveReport = () => {
    if (onSaveReport) {
      onSaveReport(reportConfig);
    }
  };

  const handleGenerateReport = () => {
    if (onGenerateReport) {
      onGenerateReport(reportConfig);
    }
  };

  return (
    <Card className="w-full">
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <FileText className="h-5 w-5" />
          Custom Report Builder
        </CardTitle>
      </CardHeader>
      <CardContent>
        <div className="space-y-6">
          {/* Report Basic Info */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div>
              <Label htmlFor="reportName">Report Name</Label>
              <Input
                id="reportName"
                value={reportConfig.name}
                onChange={(e) => setReportConfig(prev => ({ ...prev, name: e.target.value }))}
                placeholder="Enter report name"
              />
            </div>
            <div>
              <Label htmlFor="reportDescription">Description</Label>
              <Input
                id="reportDescription"
                value={reportConfig.description}
                onChange={(e) => setReportConfig(prev => ({ ...prev, description: e.target.value }))}
                placeholder="Brief description of the report"
              />
            </div>
          </div>

          <Separator />

          {/* Report Configuration Tabs */}
          <Tabs value={activeTab} onValueChange={setActiveTab}>
            <TabsList className="grid w-full grid-cols-4">
              <TabsTrigger value="metrics">Metrics</TabsTrigger>
              <TabsTrigger value="filters">Filters</TabsTrigger>
              <TabsTrigger value="grouping">Grouping</TabsTrigger>
              <TabsTrigger value="export">Export</TabsTrigger>
            </TabsList>

            {/* Metrics Selection */}
            <TabsContent value="metrics" className="space-y-4">
              <div className="flex items-center justify-between">
                <h3 className="text-lg font-medium">Select Metrics</h3>
                <Badge variant="secondary">
                  {reportConfig.selectedMetrics.length} selected
                </Badge>
              </div>

              <ScrollArea className="h-96 border rounded-lg p-4">
                {Object.entries(metricsByCategory).map(([category, metrics]) => (
                  <div key={category} className="mb-6">
                    <h4 className="font-medium text-sm uppercase tracking-wide text-muted-foreground mb-3">
                      {category.charAt(0).toUpperCase() + category.slice(1)} Metrics
                    </h4>
                    <div className="space-y-3">
                      {metrics.map((metric) => (
                        <div key={metric.id} className="flex items-start space-x-3">
                          <Checkbox
                            id={metric.id}
                            checked={reportConfig.selectedMetrics.includes(metric.id)}
                            onCheckedChange={() => handleMetricToggle(metric.id)}
                          />
                          <div className="flex-1">
                            <Label htmlFor={metric.id} className="font-medium">
                              {metric.name}
                            </Label>
                            <p className="text-sm text-muted-foreground">
                              {metric.description}
                            </p>
                            <div className="flex items-center gap-2 mt-1">
                              <Badge variant="outline" className="text-xs">
                                {metric.type}
                              </Badge>
                              <Badge variant="outline" className="text-xs">
                                {metric.aggregation}
                              </Badge>
                            </div>
                          </div>
                        </div>
                      ))}
                    </div>
                  </div>
                ))}
              </ScrollArea>

              {/* Selected Metrics Summary */}
              {reportConfig.selectedMetrics.length > 0 && (
                <div className="p-4 bg-muted rounded-lg">
                  <h4 className="font-medium mb-2">Selected Metrics:</h4>
                  <div className="flex flex-wrap gap-2">
                    {selectedMetricsData.map((metric) => (
                      <Badge key={metric.id} variant="default" className="gap-1">
                        {metric.name}
                        <X
                          className="h-3 w-3 cursor-pointer"
                          onClick={() => handleMetricToggle(metric.id)}
                        />
                      </Badge>
                    ))}
                  </div>
                </div>
              )}
            </TabsContent>

            {/* Filters */}
            <TabsContent value="filters" className="space-y-4">
              <div className="flex items-center justify-between">
                <h3 className="text-lg font-medium">Filters</h3>
                <Button onClick={handleAddFilter} size="sm">
                  <Plus className="h-4 w-4 mr-2" />
                  Add Filter
                </Button>
              </div>

              <ScrollArea className="h-96">
                <div className="space-y-4">
                  {reportConfig.filters.map((filter) => (
                    <Card key={filter.id} className="p-4">
                      <div className="flex items-start justify-between mb-3">
                        <div className="flex items-center gap-2">
                          <GripVertical className="h-4 w-4 text-muted-foreground" />
                          <span className="font-medium">Filter</span>
                        </div>
                        <Button
                          variant="ghost"
                          size="sm"
                          onClick={() => handleRemoveFilter(filter.id)}
                        >
                          <X className="h-4 w-4" />
                        </Button>
                      </div>

                      <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
                        <div>
                          <Label>Field</Label>
                          <Select
                            value={filter.field}
                            onValueChange={(value) => handleUpdateFilter(filter.id, { field: value })}
                          >
                            <SelectTrigger>
                              <SelectValue />
                            </SelectTrigger>
                            <SelectContent>
                              <SelectItem value="property">Property</SelectItem>
                              <SelectItem value="location">Location</SelectItem>
                              <SelectItem value="status">Status</SelectItem>
                              <SelectItem value="occupancy_rate">Occupancy Rate</SelectItem>
                              <SelectItem value="revenue">Revenue</SelectItem>
                            </SelectContent>
                          </Select>
                        </div>

                        <div>
                          <Label>Operator</Label>
                          <Select
                            value={filter.operator}
                            onValueChange={(value) => handleUpdateFilter(filter.id, { operator: value as string })}
                          >
                            <SelectTrigger>
                              <SelectValue />
                            </SelectTrigger>
                            <SelectContent>
                              {filterOperators.map((op) => (
                                <SelectItem key={op.value} value={op.value}>
                                  {op.label}
                                </SelectItem>
                              ))}
                            </SelectContent>
                          </Select>
                        </div>

                        <div>
                          <Label>Value</Label>
                          <Input
                            value={filter.value}
                            onChange={(e) => handleUpdateFilter(filter.id, { value: e.target.value })}
                            placeholder="Enter value"
                          />
                        </div>
                      </div>
                    </Card>
                  ))}

                  {reportConfig.filters.length === 0 && (
                    <div className="text-center py-8 text-muted-foreground">
                      <Filter className="h-8 w-8 mx-auto mb-2 opacity-50" />
                      <p>No filters added yet</p>
                      <p className="text-sm">Click "Add Filter" to start filtering your data</p>
                    </div>
                  )}
                </div>
              </ScrollArea>
            </TabsContent>

            {/* Grouping and Sorting */}
            <TabsContent value="grouping" className="space-y-4">
              <h3 className="text-lg font-medium">Grouping & Sorting</h3>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div>
                  <Label>Group By</Label>
                  <Select
                    value={reportConfig.groupBy}
                    onValueChange={(value) => setReportConfig(prev => ({ ...prev, groupBy: value }))}
                  >
                    <SelectTrigger>
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      {groupByOptions.map((option) => (
                        <SelectItem key={option.value} value={option.value}>
                          {option.label}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>

                <div>
                  <Label>Sort By</Label>
                  <Select
                    value={reportConfig.sortBy}
                    onValueChange={(value) => setReportConfig(prev => ({ ...prev, sortBy: value }))}
                  >
                    <SelectTrigger>
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      {selectedMetricsData.map((metric) => (
                        <SelectItem key={metric.id} value={metric.id}>
                          {metric.name}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
              </div>

              <div>
                <Label>Sort Order</Label>
                <Select
                  value={reportConfig.sortOrder}
                  onValueChange={(value) => setReportConfig(prev => ({ ...prev, sortOrder: value as 'asc' | 'desc' }))}
                >
                  <SelectTrigger className="w-48">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="asc">Ascending</SelectItem>
                    <SelectItem value="desc">Descending</SelectItem>
                  </SelectContent>
                </Select>
              </div>

              {/* Date Range */}
              <div>
                <Label>Date Range</Label>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-3 mt-2">
                  <div>
                    <Label className="text-sm text-muted-foreground">Start Date</Label>
                    <Input
                      type="date"
                      value={format(reportConfig.dateRange.start, 'yyyy-MM-dd')}
                      max={format(reportConfig.dateRange.end, 'yyyy-MM-dd')}
                      onChange={(e) => {
                        if (!e.target.value) return;
                        const newStart = new Date(e.target.value);
                        setReportConfig(prev => ({
                          ...prev,
                          dateRange: { ...prev.dateRange, start: newStart > prev.dateRange.end ? prev.dateRange.end : newStart }
                        }));
                      }}
                    />
                  </div>
                  <div>
                    <Label className="text-sm text-muted-foreground">End Date</Label>
                    <Input
                      type="date"
                      value={format(reportConfig.dateRange.end, 'yyyy-MM-dd')}
                      min={format(reportConfig.dateRange.start, 'yyyy-MM-dd')}
                      max={format(new Date(), 'yyyy-MM-dd')}
                      onChange={(e) => {
                        if (!e.target.value) return;
                        const newEnd = new Date(e.target.value);
                        setReportConfig(prev => ({
                          ...prev,
                          dateRange: { ...prev.dateRange, end: newEnd < prev.dateRange.start ? prev.dateRange.start : newEnd }
                        }));
                      }}
                    />
                  </div>
                </div>
              </div>
            </TabsContent>

            {/* Export Options */}
            <TabsContent value="export" className="space-y-4">
              <h3 className="text-lg font-medium">Export Options</h3>

              <div>
                <Label>Export Format</Label>
                <Select
                  value={reportConfig.exportFormat}
                  onValueChange={(value) => setReportConfig(prev => ({ ...prev, exportFormat: value as string }))}
                >
                  <SelectTrigger className="w-48">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="csv">CSV</SelectItem>
                    <SelectItem value="excel">Excel</SelectItem>
                    <SelectItem value="pdf">PDF</SelectItem>
                  </SelectContent>
                </Select>
              </div>

              {/* Preview Section */}
              <div className="space-y-3">
                <div className="flex items-center justify-between">
                  <Label>Preview</Label>
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={generatePreviewData}
                    disabled={reportConfig.selectedMetrics.length === 0}
                  >
                    <Eye className="h-4 w-4 mr-2" />
                    Generate Preview
                  </Button>
                </div>

                {showPreview && previewData.length > 0 && (
                  <Card className="p-4">
                    <ScrollArea className="h-64">
                      <div className="overflow-x-auto">
                        <table className="w-full text-sm">
                          <thead>
                            <tr className="border-b">
                              <th className="text-left p-2">Property</th>
                              {selectedMetricsData.map((metric) => (
                                <th key={metric.id} className="text-left p-2">
                                  {metric.name}
                                </th>
                              ))}
                            </tr>
                          </thead>
                          <tbody>
                            {previewData.map((row, index) => (
                              <tr key={`previewData-${index}`} className="border-b">
                                <td className="p-2 font-medium">{row.property}</td>
                                {selectedMetricsData.map((metric) => (
                                  <td key={metric.id} className="p-2">
                                    {metric.type === 'currency' ? `$${row[metric.id]?.toLocaleString()}` :
                                     metric.type === 'percentage' ? `${row[metric.id]}%` :
                                     row[metric.id]?.toLocaleString()}
                                  </td>
                                ))}
                              </tr>
                            ))}
                          </tbody>
                        </table>
                      </div>
                    </ScrollArea>
                  </Card>
                )}
              </div>
            </TabsContent>
          </Tabs>

          <Separator />

          {/* Action Buttons */}
          <div className="flex items-center justify-between">
            <div className="text-sm text-muted-foreground">
              {reportConfig.selectedMetrics.length} metrics selected • {reportConfig.filters.length} filters applied
            </div>

            <div className="flex items-center gap-3">
              <Button
                variant="outline"
                onClick={handleSaveReport}
                disabled={!reportConfig.name || reportConfig.selectedMetrics.length === 0}
              >
                <Settings className="h-4 w-4 mr-2" />
                Save Template
              </Button>

              <Button
                onClick={handleGenerateReport}
                disabled={reportConfig.selectedMetrics.length === 0}
              >
                <Download className="h-4 w-4 mr-2" />
                Generate Report
              </Button>
            </div>
          </div>
        </div>
      </CardContent>
    </Card>
  );
};