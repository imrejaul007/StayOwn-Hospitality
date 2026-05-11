import React, { useState, useEffect, useRef} from 'react';
import { withErrorBoundary } from '../ErrorBoundary';
import {
  FileText,
  Download,
  Calendar,
  Filter,
  TrendingUp,
  BarChart3,
  PieChart,
  Users,
  DollarSign,
  Package,
  AlertTriangle,
  Clock,
  RefreshCw,
  Eye,
  Mail,
  Printer,
  Share2,
  Settings,
  ChevronDown,
  CheckCircle,
  XCircle
} from 'lucide-react';

interface ReportTemplate {
  id: string;
  name: string;
  description: string;
  type: 'inventory_valuation' | 'stock_movement' | 'vendor_performance' | 'cost_analysis' |
        'consumption_pattern' | 'reorder_forecast' | 'budget_variance' | 'waste_analysis' | 'custom';
  category: 'operational' | 'financial' | 'compliance' | 'strategic';
  frequency: 'on_demand' | 'daily' | 'weekly' | 'monthly' | 'quarterly' | 'annually';
  format: 'pdf' | 'excel' | 'csv' | 'json';
  parameters: ReportParameter[];
  lastGenerated?: string;
  isScheduled: boolean;
  scheduleConfig?: {
    frequency: string;
    dayOfWeek?: number;
    dayOfMonth?: number;
    time: string;
    recipients: string[];
  };
}

interface ReportParameter {
  name: string;
  type: 'date' | 'daterange' | 'select' | 'multiselect' | 'number' | 'text' | 'boolean';
  label: string;
  required: boolean;
  defaultValue?: unknown;
  options?: Array<{ value: string; label: string }>;
  validation?: {
    min?: number;
    max?: number;
    pattern?: string;
  };
}

interface GeneratedReport {
  id: string;
  templateId: string;
  templateName: string;
  generatedAt: string;
  generatedBy: string;
  parameters: Record<string, unknown>;
  status: 'generating' | 'completed' | 'failed' | 'expired';
  downloadUrl?: string;
  fileSize?: number;
  expiresAt: string;
  format: string;
  error?: string;
}

const InventoryReports: React.FC = () => {
  const [templates, setTemplates] = useState<ReportTemplate[]>([]);
  const [reports, setReports] = useState<GeneratedReport[]>([]);
  const [loading, setLoading] = useState(true);
  const [activeTab, setActiveTab] = useState<'templates' | 'generated' | 'scheduled'>('templates');
  const [selectedTemplate, setSelectedTemplate] = useState<ReportTemplate | null>(null);
  const [showGenerateModal, setShowGenerateModal] = useState(false);
  const [showScheduleModal, setShowScheduleModal] = useState(false);
  const [generatingReports, setGeneratingReports] = useState<Set<string>>(new Set());
  const [filterCategory, setFilterCategory] = useState<string>('all');
  const [searchTerm, setSearchTerm] = useState('');
  const [reportParameters, setReportParameters] = useState<Record<string, unknown>>({});

  const generateTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => {
    return () => {
      if (generateTimerRef.current) clearTimeout(generateTimerRef.current);
    };
  }, []);

  useEffect(() => {
    fetchReportTemplates();
    fetchGeneratedReports();
  }, []);

  const fetchReportTemplates = async () => {
    try {
      setLoading(true);
      // Built-in report template definitions (configuration, not mock data)
      const builtInTemplates: ReportTemplate[] = [
        {
          id: '1',
          name: 'Monthly Inventory Valuation',
          description: 'Complete valuation of all inventory items with cost analysis and depreciation',
          type: 'inventory_valuation',
          category: 'financial',
          frequency: 'monthly',
          format: 'pdf',
          isScheduled: true,
          scheduleConfig: {
            frequency: 'monthly',
            dayOfMonth: 1,
            time: '09:00',
            recipients: ['manager@hotel.com', 'finance@hotel.com']
          },
          parameters: [
            { name: 'dateRange', type: 'daterange', label: 'Date Range', required: true },
            { name: 'category', type: 'multiselect', label: 'Categories', required: false,
              options: [
                { value: 'linens', label: 'Linens' },
                { value: 'cleaning', label: 'Cleaning Supplies' },
                { value: 'toiletries', label: 'Toiletries' },
                { value: 'electronics', label: 'Electronics' }
              ]
            },
            { name: 'includeDepreciation', type: 'boolean', label: 'Include Depreciation', required: false, defaultValue: true }
          ],
          lastGenerated: '2024-01-01T09:00:00Z'
        },
        {
          id: '2',
          name: 'Stock Movement Analysis',
          description: 'Detailed analysis of stock movements, consumption patterns, and velocity tracking',
          type: 'stock_movement',
          category: 'operational',
          frequency: 'weekly',
          format: 'excel',
          isScheduled: false,
          parameters: [
            { name: 'period', type: 'select', label: 'Period', required: true,
              options: [
                { value: '7d', label: 'Last 7 Days' },
                { value: '30d', label: 'Last 30 Days' },
                { value: '90d', label: 'Last 90 Days' },
                { value: 'custom', label: 'Custom Range' }
              ]
            },
            { name: 'movementType', type: 'select', label: 'Movement Type', required: false,
              options: [
                { value: 'all', label: 'All Movements' },
                { value: 'in', label: 'Stock In Only' },
                { value: 'out', label: 'Stock Out Only' },
                { value: 'adjustment', label: 'Adjustments Only' }
              ]
            },
            { name: 'minValue', type: 'number', label: 'Minimum Value', required: false }
          ]
        },
        {
          id: '3',
          name: 'Vendor Performance Scorecard',
          description: 'Comprehensive vendor evaluation including delivery, quality, and cost metrics',
          type: 'vendor_performance',
          category: 'strategic',
          frequency: 'quarterly',
          format: 'pdf',
          isScheduled: true,
          scheduleConfig: {
            frequency: 'quarterly',
            dayOfMonth: 15,
            time: '14:00',
            recipients: ['procurement@hotel.com', 'manager@hotel.com']
          },
          parameters: [
            { name: 'quarter', type: 'select', label: 'Quarter', required: true,
              options: [
                { value: 'q1', label: 'Q1' },
                { value: 'q2', label: 'Q2' },
                { value: 'q3', label: 'Q3' },
                { value: 'q4', label: 'Q4' }
              ]
            },
            { name: 'includeRatings', type: 'boolean', label: 'Include Performance Ratings', required: false, defaultValue: true },
            { name: 'vendorCategory', type: 'multiselect', label: 'Vendor Categories', required: false,
              options: [
                { value: 'linens', label: 'Linen Suppliers' },
                { value: 'cleaning', label: 'Cleaning Suppliers' },
                { value: 'maintenance', label: 'Maintenance Suppliers' }
              ]
            }
          ]
        },
        {
          id: '4',
          name: 'Cost Analysis & Budget Variance',
          description: 'Detailed cost breakdown with budget comparisons and variance analysis',
          type: 'cost_analysis',
          category: 'financial',
          frequency: 'monthly',
          format: 'excel',
          isScheduled: true,
          scheduleConfig: {
            frequency: 'monthly',
            dayOfMonth: 3,
            time: '10:00',
            recipients: ['cfo@hotel.com', 'operations@hotel.com']
          },
          parameters: [
            { name: 'month', type: 'select', label: 'Month', required: true,
              options: [
                { value: 'current', label: 'Current Month' },
                { value: 'previous', label: 'Previous Month' },
                { value: 'custom', label: 'Custom Month' }
              ]
            },
            { name: 'compareWithBudget', type: 'boolean', label: 'Compare with Budget', required: false, defaultValue: true },
            { name: 'includeForecast', type: 'boolean', label: 'Include Forecast', required: false, defaultValue: false }
          ]
        },
        {
          id: '5',
          name: 'Reorder Forecast & Planning',
          description: 'Predictive analysis for inventory reordering with seasonal adjustments',
          type: 'reorder_forecast',
          category: 'operational',
          frequency: 'weekly',
          format: 'pdf',
          isScheduled: false,
          parameters: [
            { name: 'forecastPeriod', type: 'select', label: 'Forecast Period', required: true,
              options: [
                { value: '30d', label: '30 Days' },
                { value: '60d', label: '60 Days' },
                { value: '90d', label: '90 Days' }
              ]
            },
            { name: 'includeSeasonality', type: 'boolean', label: 'Include Seasonal Factors', required: false, defaultValue: true },
            { name: 'urgencyOnly', type: 'boolean', label: 'Urgent Items Only', required: false, defaultValue: false }
          ]
        },
        {
          id: '6',
          name: 'Compliance & Audit Report',
          description: 'Regulatory compliance report with audit trail and documentation',
          type: 'custom',
          category: 'compliance',
          frequency: 'quarterly',
          format: 'pdf',
          isScheduled: true,
          scheduleConfig: {
            frequency: 'quarterly',
            dayOfMonth: 20,
            time: '16:00',
            recipients: ['compliance@hotel.com', 'audit@hotel.com']
          },
          parameters: [
            { name: 'auditPeriod', type: 'daterange', label: 'Audit Period', required: true },
            { name: 'includePhotos', type: 'boolean', label: 'Include Photo Documentation', required: false, defaultValue: false },
            { name: 'complianceStandard', type: 'select', label: 'Compliance Standard', required: true,
              options: [
                { value: 'iso', label: 'ISO Standards' },
                { value: 'haccp', label: 'HACCP' },
                { value: 'local', label: 'Local Regulations' }
              ]
            }
          ]
        }
      ];

      setTemplates(builtInTemplates);
    } catch {
      // Error handled silently
    } finally {
      setLoading(false);
    }
  };

  const fetchGeneratedReports = async () => {
    try {
      // No previously generated reports - reports are generated on-demand
      setReports([]);
    } catch {
      // Error handled silently
    }
  };

  const handleGenerateReport = async (template: ReportTemplate, parameters: Record<string, unknown>) => {
    try {
      setGeneratingReports(prev => new Set(prev).add(template.id));

      // Simulate report generation (real backend call would replace this)
      if (generateTimerRef.current) clearTimeout(generateTimerRef.current);
      generateTimerRef.current = setTimeout(() => {
        const newReport: GeneratedReport = {
          id: `report_${Date.now()}`,
          templateId: template.id,
          templateName: template.name,
          generatedAt: new Date().toISOString(),
          generatedBy: 'Current User',
          parameters,
          status: 'completed',
          downloadUrl: `/reports/${template.type}_${Date.now()}.${template.format}`,
          fileSize: JSON.stringify(parameters).length * 100,
          expiresAt: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000).toISOString(),
          format: template.format
        };

        setReports(prev => [newReport, ...prev]);
        setGeneratingReports(prev => {
          const newSet = new Set(prev);
          newSet.delete(template.id);
          return newSet;
        });
        setShowGenerateModal(false);
        setSelectedTemplate(null);
        setReportParameters({});
      }, 3000);

    } catch (error) {
      setGeneratingReports(prev => {
        const newSet = new Set(prev);
        newSet.delete(template.id);
        return newSet;
      });
    }
  };

  const handleScheduleReport = async (template: ReportTemplate, scheduleConfig: Record<string, unknown>) => {
    try {

      // Update template with schedule config
      setTemplates(prev => prev.map(t =>
        t.id === template.id
          ? { ...t, isScheduled: true, scheduleConfig }
          : t
      ));

      setShowScheduleModal(false);
      setSelectedTemplate(null);
    } catch {
      // Error handled silently
    }
  };

  const handleDownloadReport = (report: GeneratedReport) => {
    if (report.downloadUrl) {
      // In a real app, this would trigger the download
      window.open(report.downloadUrl, '_blank');
    }
  };

  const formatFileSize = (bytes: number) => {
    const sizes = ['Bytes', 'KB', 'MB', 'GB'];
    if (bytes === 0) return '0 Bytes';
    const i = Math.floor(Math.log(bytes) / Math.log(1024));
    return Math.round(bytes / Math.pow(1024, i) * 100) / 100 + ' ' + sizes[i];
  };

  const formatDate = (dateString: string) => {
    return new Date(dateString).toLocaleDateString('en-IN', {
      day: '2-digit',
      month: 'short',
      year: 'numeric',
      hour: '2-digit',
      minute: '2-digit'
    });
  };

  const getCategoryColor = (category: string) => {
    switch (category) {
      case 'operational': return 'bg-blue-100 text-blue-800';
      case 'financial': return 'bg-green-100 text-green-800';
      case 'compliance': return 'bg-purple-100 text-purple-800';
      case 'strategic': return 'bg-orange-100 text-orange-800';
      default: return 'bg-gray-100 text-gray-800';
    }
  };

  const getStatusColor = (status: string) => {
    switch (status) {
      case 'completed': return 'text-green-600 bg-green-100';
      case 'generating': return 'text-blue-600 bg-blue-100';
      case 'failed': return 'text-red-600 bg-red-100';
      case 'expired': return 'text-gray-600 bg-gray-100';
      default: return 'text-gray-600 bg-gray-100';
    }
  };

  const getStatusIcon = (status: string) => {
    switch (status) {
      case 'completed': return <CheckCircle className="w-4 h-4" />;
      case 'generating': return <RefreshCw className="w-4 h-4 animate-spin" />;
      case 'failed': return <XCircle className="w-4 h-4" />;
      case 'expired': return <Clock className="w-4 h-4" />;
      default: return <Clock className="w-4 h-4" />;
    }
  };

  const filteredTemplates = templates.filter(template => {
    if (filterCategory !== 'all' && template.category !== filterCategory) return false;
    if (searchTerm && !template.name.toLowerCase().includes(searchTerm.toLowerCase()) &&
        !template.description.toLowerCase().includes(searchTerm.toLowerCase())) return false;
    return true;
  });

  const filteredReports = reports.filter(report => {
    if (searchTerm && !report.templateName.toLowerCase().includes(searchTerm.toLowerCase())) return false;
    return true;
  });

  const scheduledReports = templates.filter(t => t.isScheduled);

  if (loading) {
    return (
      <div className="bg-white rounded-lg shadow-sm p-6">
        <div className="animate-pulse space-y-4">
          <div className="h-6 bg-gray-300 rounded w-1/3"></div>
          <div className="space-y-3">
            {[...Array(3)].map((_, i) => (
              <div key={i} className="h-20 bg-gray-200 rounded"></div>
            ))}
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="bg-white rounded-lg shadow-sm">
      {/* Header */}
      <div className="border-b border-gray-200 px-6 py-4">
        <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center">
          <div>
            <h2 className="text-xl font-semibold text-gray-900 flex items-center">
              <FileText className="w-6 h-6 mr-2" />
              Inventory Reports
            </h2>
            <p className="text-sm text-gray-600 mt-1">
              Generate, schedule, and manage comprehensive inventory reports
            </p>
          </div>
          <div className="flex items-center space-x-3 mt-4 sm:mt-0">
            <button className="flex items-center px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors">
              <Settings className="w-4 h-4 mr-2" />
              Report Settings
            </button>
          </div>
        </div>
      </div>

      {/* Filters */}
      <div className="border-b border-gray-200 px-6 py-4">
        <div className="flex flex-col sm:flex-row items-center space-y-3 sm:space-y-0 sm:space-x-4">
          <div className="relative flex-1">
            <input
              type="text"
              placeholder="Search reports..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="w-full pl-4 pr-4 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
            />
          </div>
          <select
            value={filterCategory}
            onChange={(e) => setFilterCategory(e.target.value)}
            className="px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
          >
            <option value="all">All Categories</option>
            <option value="operational">Operational</option>
            <option value="financial">Financial</option>
            <option value="compliance">Compliance</option>
            <option value="strategic">Strategic</option>
          </select>
        </div>
      </div>

      {/* Tabs */}
      <div className="border-b border-gray-200">
        <nav className="-mb-px flex px-6">
          {[
            { id: 'templates', label: 'Report Templates', count: templates.length },
            { id: 'generated', label: 'Generated Reports', count: reports.length },
            { id: 'scheduled', label: 'Scheduled Reports', count: scheduledReports.length }
          ].map(({ id, label, count }) => (
            <button
              key={id}
              onClick={() => setActiveTab(id as unknown)}
              className={`${
                activeTab === id
                  ? 'border-blue-500 text-blue-600'
                  : 'border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300'
              } whitespace-nowrap py-4 px-1 border-b-2 font-medium text-sm mr-8`}
            >
              {label} ({count})
            </button>
          ))}
        </nav>
      </div>

      {/* Content */}
      <div className="p-6">
        {activeTab === 'templates' && (
          <div className="space-y-4">
            {filteredTemplates.map((template) => (
              <div key={template.id} className="border border-gray-200 rounded-lg p-4 hover:border-blue-300 transition-colors">
                <div className="flex items-start justify-between">
                  <div className="flex-1">
                    <div className="flex items-center space-x-3 mb-2">
                      <h3 className="font-medium text-gray-900">{template.name}</h3>
                      <span className={`px-2 py-1 text-xs font-medium rounded-full ${getCategoryColor(template.category)}`}>
                        {template.category}
                      </span>
                      {template.isScheduled && (
                        <span className="px-2 py-1 text-xs font-medium rounded-full bg-green-100 text-green-800">
                          Scheduled
                        </span>
                      )}
                    </div>
                    <p className="text-sm text-gray-600 mb-3">{template.description}</p>
                    <div className="flex items-center space-x-4 text-sm text-gray-500">
                      <span className="flex items-center">
                        <Calendar className="w-4 h-4 mr-1" />
                        {template.frequency}
                      </span>
                      <span className="flex items-center">
                        <Download className="w-4 h-4 mr-1" />
                        {template.format.toUpperCase()}
                      </span>
                      {template.lastGenerated && (
                        <span className="flex items-center">
                          <Clock className="w-4 h-4 mr-1" />
                          Last: {formatDate(template.lastGenerated)}
                        </span>
                      )}
                    </div>
                  </div>
                  <div className="flex items-center space-x-2 ml-4">
                    <button
                      onClick={() => {
                        setSelectedTemplate(template);
                        setShowGenerateModal(true);
                      }}
                      disabled={generatingReports.has(template.id)}
                      className="flex items-center px-3 py-2 bg-blue-600 text-white text-sm rounded-lg hover:bg-blue-700 disabled:opacity-50 transition-colors"
                    >
                      {generatingReports.has(template.id) ? (
                        <RefreshCw className="w-4 h-4 animate-spin" />
                      ) : (
                        <Download className="w-4 h-4 mr-1" />
                      )}
                      Generate
                    </button>
                    <button
                      onClick={() => {
                        setSelectedTemplate(template);
                        setShowScheduleModal(true);
                      }}
                      className="flex items-center px-3 py-2 bg-green-600 text-white text-sm rounded-lg hover:bg-green-700 transition-colors"
                    >
                      <Calendar className="w-4 h-4 mr-1" />
                      Schedule
                    </button>
                    <button aria-label="View" className="p-2 text-gray-600 hover:bg-gray-100 rounded transition-colors">
                      <Eye className="w-4 h-4" />
                    </button>
                  </div>
                </div>
              </div>
            ))}
          </div>
        )}

        {activeTab === 'generated' && (
          <div className="space-y-4">
            {filteredReports.map((report) => (
              <div key={report.id} className="border border-gray-200 rounded-lg p-4">
                <div className="flex items-start justify-between">
                  <div className="flex-1">
                    <div className="flex items-center space-x-3 mb-2">
                      <h3 className="font-medium text-gray-900">{report.templateName}</h3>
                      <span className={`flex items-center px-2 py-1 text-xs font-medium rounded-full ${getStatusColor(report.status)}`}>
                        {getStatusIcon(report.status)}
                        <span className="ml-1">{report.status}</span>
                      </span>
                    </div>
                    <div className="text-sm text-gray-600 mb-2">
                      Generated by {report.generatedBy} on {formatDate(report.generatedAt)}
                    </div>
                    <div className="flex items-center space-x-4 text-sm text-gray-500">
                      <span>Format: {report.format.toUpperCase()}</span>
                      {report.fileSize && (
                        <span>Size: {formatFileSize(report.fileSize)}</span>
                      )}
                      <span>Expires: {formatDate(report.expiresAt)}</span>
                    </div>
                    {Object.keys(report.parameters).length > 0 && (
                      <div className="mt-2">
                        <details className="text-sm">
                          <summary className="text-gray-600 cursor-pointer hover:text-gray-800">
                            View Parameters
                          </summary>
                          <div className="mt-1 pl-4 border-l-2 border-gray-200">
                            {Object.entries(report.parameters).map(([key, value]) => (
                              <div key={key} className="text-gray-500">
                                <span className="font-medium">{key}:</span> {Array.isArray(value) ? value.join(', ') : value}
                              </div>
                            ))}
                          </div>
                        </details>
                      </div>
                    )}
                  </div>
                  <div className="flex items-center space-x-2 ml-4">
                    {report.status === 'completed' && report.downloadUrl && (
                      <>
                        <button
                          onClick={() => handleDownloadReport(report)}
                          className="flex items-center px-3 py-2 bg-blue-600 text-white text-sm rounded-lg hover:bg-blue-700 transition-colors"
                        >
                          <Download className="w-4 h-4 mr-1" />
                          Download
                        </button>
                        <button aria-label="Close" className="p-2 text-gray-600 hover:bg-gray-100 rounded transition-colors">
                          <Mail className="w-4 h-4" />
                        </button>
                        <button aria-label="Close" className="p-2 text-gray-600 hover:bg-gray-100 rounded transition-colors">
                          <Share2 className="w-4 h-4" />
                        </button>
                      </>
                    )}
                  </div>
                </div>
              </div>
            ))}
          </div>
        )}

        {activeTab === 'scheduled' && (
          <div className="space-y-4">
            {scheduledReports.map((template) => (
              <div key={template.id} className="border border-gray-200 rounded-lg p-4">
                <div className="flex items-start justify-between">
                  <div className="flex-1">
                    <div className="flex items-center space-x-3 mb-2">
                      <h3 className="font-medium text-gray-900">{template.name}</h3>
                      <span className={`px-2 py-1 text-xs font-medium rounded-full ${getCategoryColor(template.category)}`}>
                        {template.category}
                      </span>
                      <span className="px-2 py-1 text-xs font-medium rounded-full bg-green-100 text-green-800">
                        Active
                      </span>
                    </div>
                    {template.scheduleConfig && (
                      <div className="text-sm text-gray-600 mb-2">
                        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                          <div>
                            <span className="font-medium">Schedule:</span> {template.scheduleConfig.frequency}
                            {template.scheduleConfig.dayOfMonth && ` on day ${template.scheduleConfig.dayOfMonth}`}
                            {template.scheduleConfig.dayOfWeek && ` on ${['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'][template.scheduleConfig.dayOfWeek]}`}
                            {' at '}{template.scheduleConfig.time}
                          </div>
                          <div>
                            <span className="font-medium">Recipients:</span> {template.scheduleConfig.recipients.join(', ')}
                          </div>
                        </div>
                      </div>
                    )}
                    <div className="flex items-center space-x-4 text-sm text-gray-500">
                      <span>Format: {template.format.toUpperCase()}</span>
                      {template.lastGenerated && (
                        <span>Last Generated: {formatDate(template.lastGenerated)}</span>
                      )}
                    </div>
                  </div>
                  <div className="flex items-center space-x-2 ml-4">
                    <button className="flex items-center px-3 py-2 bg-yellow-600 text-white text-sm rounded-lg hover:bg-yellow-700 transition-colors">
                      <Settings className="w-4 h-4 mr-1" />
                      Edit Schedule
                    </button>
                    <button className="flex items-center px-3 py-2 bg-red-600 text-white text-sm rounded-lg hover:bg-red-700 transition-colors">
                      <XCircle className="w-4 h-4 mr-1" />
                      Disable
                    </button>
                  </div>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* Generate Report Modal */}
      {showGenerateModal && selectedTemplate && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
          <div className="bg-white rounded-lg shadow-xl max-w-2xl w-full m-4 max-h-[90vh] overflow-y-auto">
            <div className="border-b border-gray-200 px-6 py-4">
              <div className="flex items-center justify-between">
                <h2 className="text-xl font-semibold text-gray-900">Generate Report</h2>
                <button aria-label="Close"
                  onClick={() => {
                    setShowGenerateModal(false);
                    setSelectedTemplate(null);
                    setReportParameters({});
                  }}
                  className="p-2 text-gray-400 hover:text-gray-600 rounded transition-colors"
                >
                  <XCircle className="w-6 h-6" />
                </button>
              </div>
            </div>
            <div className="p-6">
              <div className="mb-4">
                <h3 className="font-medium text-gray-900 mb-1">{selectedTemplate.name}</h3>
                <p className="text-sm text-gray-600">{selectedTemplate.description}</p>
              </div>

              <div className="space-y-4">
                {selectedTemplate.parameters.map((param) => (
                  <div key={param.name}>
                    <label className="block text-sm font-medium text-gray-700 mb-1">
                      {param.label}
                      {param.required && <span className="text-red-500 ml-1">*</span>}
                    </label>

                    {param.type === 'text' && (
                      <input
                        type="text"
                        value={reportParameters[param.name] || ''}
                        onChange={(e) => setReportParameters(prev => ({ ...prev, [param.name]: e.target.value }))}
                        className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
                      />
                    )}

                    {param.type === 'select' && (
                      <select
                        value={reportParameters[param.name] || ''}
                        onChange={(e) => setReportParameters(prev => ({ ...prev, [param.name]: e.target.value }))}
                        className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
                      >
                        <option value="">Select...</option>
                        {param.options?.map((option) => (
                          <option key={option.value} value={option.value}>
                            {option.label}
                          </option>
                        ))}
                      </select>
                    )}

                    {param.type === 'boolean' && (
                      <div className="flex items-center">
                        <input
                          type="checkbox"
                          checked={reportParameters[param.name] || param.defaultValue || false}
                          onChange={(e) => setReportParameters(prev => ({ ...prev, [param.name]: e.target.checked }))}
                          className="w-4 h-4 text-blue-600 rounded focus:ring-blue-500"
                        />
                        <span className="ml-2 text-sm text-gray-600">{param.label}</span>
                      </div>
                    )}

                    {param.type === 'daterange' && (
                      <div className="grid grid-cols-2 gap-2">
                        <input
                          type="date"
                          placeholder="Start Date"
                          className="px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
                        />
                        <input
                          type="date"
                          placeholder="End Date"
                          className="px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
                        />
                      </div>
                    )}
                  </div>
                ))}
              </div>

              <div className="mt-6 flex justify-end space-x-3">
                <button
                  onClick={() => {
                    setShowGenerateModal(false);
                    setSelectedTemplate(null);
                    setReportParameters({});
                  }}
                  className="px-4 py-2 text-gray-700 bg-gray-100 rounded-lg hover:bg-gray-200 transition-colors"
                >
                  Cancel
                </button>
                <button
                  onClick={() => handleGenerateReport(selectedTemplate, reportParameters)}
                  className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors"
                >
                  Generate Report
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default withErrorBoundary(InventoryReports, { level: 'component' });