import React, { useState } from 'react';
import { cn } from '../../../utils/cn';
import {
  MetricCard,
  ChartCard,
  DataTable,
  FilterBar,
  ExportButton,
  LineChart,
  BarChart,
  PieChart,
  AreaChart,
} from '../../../components/dashboard';
import { Button } from '@/components/ui/button';
import { Card, CardHeader, CardTitle, CardContent } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Input } from '@/components/ui/input';
import { Modal } from '@/components/ui/Modal';
import { useReports } from '../../../hooks/useDashboard';
import { useProperty } from '../../../context/PropertyContext';
import { formatCurrency, formatRelativeTime, generateExportFilename } from '../../../utils/dashboardUtils';
import { withErrorBoundary } from '../../../components/ErrorBoundary';

interface ReportTemplate {
  id: string;
  name: string;
  description: string;
  type: 'financial' | 'operational' | 'guest_analytics' | 'staff_performance' | 'marketing' | 'comprehensive';
  category: string;
  fields: string[];
  filters: unknown;
  charts: string[];
  lastUsed?: string;
}

const REPORT_TEMPLATES: ReportTemplate[] = [
  {
    id: 'financial_summary',
    name: 'Financial Summary Report',
    description: 'Comprehensive financial overview with revenue, expenses, and profitability analysis',
    type: 'financial',
    category: 'Finance',
    fields: ['revenue', 'expenses', 'profit', 'bookings', 'average_rate'],
    filters: { dateRange: true, hotelId: true },
    charts: ['revenue_trends', 'profit_margins', 'booking_sources'],
  },
  {
    id: 'occupancy_analysis',
    name: 'Occupancy Analysis Report',
    description: 'Detailed room occupancy patterns, availability, and utilization metrics',
    type: 'operational',
    category: 'Operations',
    fields: ['occupancy_rate', 'available_rooms', 'room_nights', 'adr'],
    filters: { dateRange: true, roomType: true, floor: true },
    charts: ['occupancy_trends', 'room_type_performance', 'seasonal_patterns'],
  },
  {
    id: 'guest_satisfaction',
    name: 'Guest Satisfaction Report',
    description: 'Guest feedback analysis including ratings, reviews, and sentiment trends',
    type: 'guest_analytics',
    category: 'Guest Experience',
    fields: ['average_rating', 'review_count', 'sentiment_score', 'category_ratings'],
    filters: { dateRange: true, rating: true, category: true },
    charts: ['rating_trends', 'sentiment_analysis', 'category_performance'],
  },
  {
    id: 'staff_productivity',
    name: 'Staff Productivity Report',
    description: 'Employee performance metrics, task completion rates, and efficiency analysis',
    type: 'staff_performance',
    category: 'Human Resources',
    fields: ['task_completion', 'response_time', 'productivity_score', 'department_performance'],
    filters: { dateRange: true, department: true, staffId: true },
    charts: ['productivity_trends', 'department_comparison', 'task_distribution'],
  },
  {
    id: 'marketing_performance',
    name: 'Marketing Performance Report',
    description: 'Campaign effectiveness, channel performance, and ROI analysis',
    type: 'marketing',
    category: 'Marketing',
    fields: ['campaign_performance', 'channel_effectiveness', 'roi', 'conversion_rates'],
    filters: { dateRange: true, campaignType: true, channel: true },
    charts: ['campaign_roi', 'channel_performance', 'conversion_funnel'],
  },
  {
    id: 'executive_dashboard',
    name: 'Executive Dashboard Report',
    description: 'High-level overview combining all key metrics for executive decision making',
    type: 'comprehensive',
    category: 'Executive',
    fields: ['kpis', 'trends', 'forecasts', 'alerts'],
    filters: { dateRange: true, hotelId: true },
    charts: ['kpi_overview', 'trend_analysis', 'performance_summary'],
  },
];

function ReportBuilder() {
  const { selectedPropertyId } = useProperty();
  const [selectedTemplate, setSelectedTemplate] = useState<ReportTemplate | null>(null);
  const [customReport, setCustomReport] = useState({
    name: '',
    type: 'financial' as ReportTemplate['type'],
    fields: [] as string[],
    filters: {},
    charts: [] as string[],
  });

  const [reportFilters, setReportFilters] = useState({
    hotelId: '',
    startDate: '',
    endDate: '',
    groupBy: 'day' as 'day' | 'week' | 'month',
    format: 'json' as 'json' | 'csv' | 'excel' | 'pdf',
    includeCharts: true,
  });

  const [showTemplateModal, setShowTemplateModal] = useState(false);
  const [showCustomReportModal, setShowCustomReportModal] = useState(false);

  const reportsQuery = useReports(
    reportFilters.hotelId || selectedPropertyId || '',
    selectedTemplate?.type || 'comprehensive',
    {
      startDate: reportFilters.startDate,
      endDate: reportFilters.endDate,
      groupBy: reportFilters.groupBy,
      format: reportFilters.format,
      includeCharts: reportFilters.includeCharts,
    },
    { enabled: false }
  );

  const handleTemplateSelect = (template: ReportTemplate) => {
    setSelectedTemplate(template);
    setShowTemplateModal(false);
  };

  const handleGenerateReport = async () => {
    if (!selectedTemplate) return;
    await reportsQuery.refetch();
  };

  const handleFilterChange = (key: string, value: unknown) => {
    setReportFilters(prev => ({ ...prev, [key]: value }));
  };

  const data = reportsQuery.data?.data;

  return (
    <div className="p-6 space-y-6 max-w-7xl mx-auto">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold text-gray-900">Advanced Reporting</h1>
          <p className="text-gray-600 mt-1">Create comprehensive reports with customizable analytics</p>
        </div>
        <div className="flex items-center space-x-3">
          <Button
            variant="secondary"
            onClick={() => setShowCustomReportModal(true)}
          >
            Custom Report
          </Button>
          <Button
            variant="primary"
            onClick={() => setShowTemplateModal(true)}
          >
            Select Template
          </Button>
        </div>
      </div>

      {/* Report Templates Grid */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
        {REPORT_TEMPLATES.map((template) => (
          <Card
            key={template.id}
            className={cn(
              'cursor-pointer transition-all duration-200 hover:shadow-lg',
              selectedTemplate?.id === template.id && 'ring-2 ring-blue-500 bg-blue-50'
            )}
            onClick={() => setSelectedTemplate(template)}
          >
            <CardHeader>
              <div className="flex items-start justify-between">
                <div>
                  <CardTitle className="text-base">{template.name}</CardTitle>
                  <Badge variant="secondary" className="mt-2">
                    {template.category}
                  </Badge>
                </div>
                {template.lastUsed && (
                  <span className="text-xs text-gray-500">
                    {formatRelativeTime(template.lastUsed)}
                  </span>
                )}
              </div>
            </CardHeader>
            <CardContent>
              <p className="text-sm text-gray-600 mb-4">{template.description}</p>
              <div className="space-y-2">
                <div className="text-xs text-gray-500">
                  <span className="font-medium">Fields:</span> {template.fields.length} metrics
                </div>
                <div className="text-xs text-gray-500">
                  <span className="font-medium">Charts:</span> {template.charts.length} visualizations
                </div>
              </div>
            </CardContent>
          </Card>
        ))}
      </div>

      {/* Selected Template Configuration */}
      {selectedTemplate && (
        <Card>
          <CardHeader>
            <CardTitle className="flex justify-between items-center">
              <span>Report Configuration: {selectedTemplate.name}</span>
              <div className="flex space-x-2">
                <Button
                  variant="secondary"
                  onClick={handleGenerateReport}
                  loading={reportsQuery.isLoading}
                >
                  Generate Report
                </Button>
                <ExportButton
                  endpoint="reports"
                  params={{
                    reportType: selectedTemplate.type,
                    hotelId: reportFilters.hotelId,
                    startDate: reportFilters.startDate,
                    endDate: reportFilters.endDate,
                    format: reportFilters.format,
                  }}
                  filename={generateExportFilename(
                    selectedTemplate.name.toLowerCase().replace(/\s+/g, '-'),
                    reportFilters.hotelId,
                    reportFilters.startDate && reportFilters.endDate 
                      ? { start: reportFilters.startDate, end: reportFilters.endDate }
                      : undefined
                  )}
                />
              </div>
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
              {/* Report Filters */}
              <div>
                <h3 className="text-lg font-medium text-gray-900 mb-4">Report Parameters</h3>
                <FilterBar
                  filters={[
                    {
                      key: 'hotelId',
                      label: 'Hotel',
                      type: 'select',
                      options: [
                        { value: '', label: 'All Hotels' },
                        { value: 'hotel1', label: 'Grand Hotel' },
                        { value: 'hotel2', label: 'Business Center' },
                      ],
                    },
                    {
                      key: 'startDate',
                      label: 'Start Date',
                      type: 'date',
                    },
                    {
                      key: 'endDate',
                      label: 'End Date',
                      type: 'date',
                    },
                    {
                      key: 'groupBy',
                      label: 'Group By',
                      type: 'select',
                      options: [
                        { value: 'day', label: 'Daily' },
                        { value: 'week', label: 'Weekly' },
                        { value: 'month', label: 'Monthly' },
                      ],
                    },
                    {
                      key: 'format',
                      label: 'Export Format',
                      type: 'select',
                      options: [
                        { value: 'json', label: 'JSON' },
                        { value: 'csv', label: 'CSV' },
                        { value: 'excel', label: 'Excel' },
                        { value: 'pdf', label: 'PDF' },
                      ],
                    },
                    {
                      key: 'includeCharts',
                      label: 'Include Charts',
                      type: 'toggle',
                    },
                  ]}
                  values={reportFilters}
                  onChange={handleFilterChange}
                />
              </div>

              {/* Report Preview */}
              <div>
                <h3 className="text-lg font-medium text-gray-900 mb-4">Report Preview</h3>
                <div className="bg-gray-50 rounded-lg p-4 space-y-4">
                  <div>
                    <h4 className="font-medium text-gray-900 mb-2">Included Metrics</h4>
                    <div className="flex flex-wrap gap-2">
                      {selectedTemplate.fields.map((field) => (
                        <Badge key={field} variant="secondary">
                          {field.replace('_', ' ')}
                        </Badge>
                      ))}
                    </div>
                  </div>
                  
                  <div>
                    <h4 className="font-medium text-gray-900 mb-2">Visualizations</h4>
                    <div className="flex flex-wrap gap-2">
                      {selectedTemplate.charts.map((chart) => (
                        <Badge key={chart} variant="secondary" className="bg-blue-100 text-blue-800">
                          {chart.replace('_', ' ')}
                        </Badge>
                      ))}
                    </div>
                  </div>

                  {data && (
                    <div>
                      <h4 className="font-medium text-gray-900 mb-2">Report Summary</h4>
                      <div className="grid grid-cols-2 gap-2 text-sm">
                        <div>
                          <span className="text-gray-600">Generated:</span>
                          <span className="ml-1 font-medium">{formatRelativeTime(data.generatedAt)}</span>
                        </div>
                        <div>
                          <span className="text-gray-600">Records:</span>
                          <span className="ml-1 font-medium">{data.summary.totalRecords}</span>
                        </div>
                      </div>
                    </div>
                  )}
                </div>
              </div>
            </div>
          </CardContent>
        </Card>
      )}

      {/* Generated Report Results */}
      {data && (
        <div className="space-y-6">
          {/* Report Summary */}
          <Card>
            <CardHeader>
              <CardTitle>Report Summary</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
                <div>
                  <div className="text-2xl font-bold text-gray-900">
                    {data.summary.totalRecords.toLocaleString()}
                  </div>
                  <div className="text-sm text-gray-600">Total Records</div>
                </div>
                <div>
                  <div className="text-2xl font-bold text-gray-900">
                    {data.summary.dateRange.start} - {data.summary.dateRange.end}
                  </div>
                  <div className="text-sm text-gray-600">Date Range</div>
                </div>
                <div>
                  <div className="text-2xl font-bold text-gray-900">
                    {formatRelativeTime(data.generatedAt)}
                  </div>
                  <div className="text-sm text-gray-600">Generated</div>
                </div>
              </div>

              {/* Key Metrics */}
              {data.summary.keyMetrics && (
                <div className="mt-6 pt-6 border-t border-gray-200">
                  <h3 className="text-lg font-medium text-gray-900 mb-4">Key Metrics</h3>
                  <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                    {Object.entries(data.summary.keyMetrics).map(([key, value]) => (
                      <div key={key} className="text-center p-3 bg-gray-50 rounded-lg">
                        <div className="text-lg font-bold text-gray-900">
                          {typeof value === 'number' && key.toLowerCase().includes('revenue') 
                            ? formatCurrency(value as number)
                            : value?.toString()
                          }
                        </div>
                        <div className="text-xs text-gray-600 capitalize">
                          {key.replace('_', ' ')}
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              )}
            </CardContent>
          </Card>

          {/* Report Charts */}
          {data.charts && data.charts.length > 0 && (
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
              {data.charts.map((chart, index) => (
                <ChartCard
                  key={`data-charts-${index}-${chart.title}`}
                  title={chart.title}
                  subtitle={`Generated from ${selectedTemplate?.name} report`}
                  height="400px"
                >
                  {chart.type === 'line' && (
                    <LineChart
                      data={chart.data}
                      xDataKey="x"
                      lines={[{ dataKey: 'y', name: 'Value', color: '#3b82f6' }]}
                      height={350}
                    />
                  )}
                  {chart.type === 'bar' && (
                    <BarChart
                      data={chart.data}
                      xDataKey="x"
                      bars={[{ dataKey: 'y', name: 'Value', color: '#10b981' }]}
                      height={350}
                    />
                  )}
                  {chart.type === 'pie' && (
                    <PieChart
                      data={chart.data.map((item: Record<string, unknown>) => ({
                        name: item.x,
                        value: item.y,
                      }))}
                      height={350}
                    />
                  )}
                </ChartCard>
              ))}
            </div>
          )}

          {/* Report Data Table */}
          {Array.isArray(data.data) && (
            <DataTable
              title="Report Data"
              data={data.data}
              columns={
                data.data.length > 0
                  ? Object.keys(data.data[0]).map((key) => ({
                      key,
                      header: key.charAt(0).toUpperCase() + key.slice(1).replace('_', ' '),
                      sortable: true,
                    }))
                  : []
              }
              searchable={true}
              pagination={true}
              pageSize={20}
              actions={
                <ExportButton
                  endpoint="reports"
                  params={{
                    reportType: selectedTemplate?.type || 'comprehensive',
                    hotelId: reportFilters.hotelId,
                    format: 'detailed',
                  }}
                  formats={['csv', 'excel']}
                  size="sm"
                />
              }
            />
          )}
        </div>
      )}

      {/* Template Selection Modal */}
      <Modal
        isOpen={showTemplateModal}
        onClose={() => setShowTemplateModal(false)}
        title="Select Report Template"
      >
        <div className="space-y-4 max-h-96 overflow-y-auto">
          {REPORT_TEMPLATES.map((template) => (
            <div role="button" tabIndex={0}
              key={template.id}
              className="p-4 border border-gray-200 rounded-lg cursor-pointer hover:border-blue-300 hover:bg-blue-50"
              onClick={() => handleTemplateSelect(template)}
             onKeyDown={(e: React.KeyboardEvent) => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); const clickHandler = () => handleTemplateSelect(template); if (typeof clickHandler === 'function') { clickHandler(e as any); } } }}>
              <div className="flex justify-between items-start mb-2">
                <h3 className="font-medium text-gray-900">{template.name}</h3>
                <Badge variant="secondary">{template.category}</Badge>
              </div>
              <p className="text-sm text-gray-600 mb-3">{template.description}</p>
              <div className="flex justify-between text-xs text-gray-500">
                <span>{template.fields.length} metrics</span>
                <span>{template.charts.length} charts</span>
              </div>
            </div>
          ))}
        </div>
      </Modal>

      {/* Custom Report Modal */}
      <Modal
        isOpen={showCustomReportModal}
        onClose={() => setShowCustomReportModal(false)}
        title="Create Custom Report"
      >
        <div className="space-y-4">
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">
              Report Name
            </label>
            <Input
              value={customReport.name}
              onChange={(e) => setCustomReport(prev => ({ ...prev, name: e.target.value }))}
              placeholder="Enter report name"
            />
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">
              Report Type
            </label>
            <select
              value={customReport.type}
              onChange={(e) => setCustomReport(prev => ({ ...prev, type: e.target.value as ReportTemplate['type'] }))}
              className="block w-full px-3 py-2 border border-gray-300 rounded-md shadow-sm focus:ring-blue-500 focus:border-blue-500"
            >
              <option value="financial">Financial</option>
              <option value="operational">Operational</option>
              <option value="guest_analytics">Guest Analytics</option>
              <option value="staff_performance">Staff Performance</option>
              <option value="marketing">Marketing</option>
              <option value="comprehensive">Comprehensive</option>
            </select>
          </div>

          <div className="flex justify-end space-x-3 pt-4 border-t border-gray-200">
            <Button variant="secondary" onClick={() => setShowCustomReportModal(false)}>
              Cancel
            </Button>
            <Button variant="primary" onClick={() => {
              // TODO: Handle custom report creation
              setShowCustomReportModal(false);
            }}>
              Create Report
            </Button>
          </div>
        </div>
      </Modal>
    </div>
  );
}

export default withErrorBoundary(ReportBuilder);
