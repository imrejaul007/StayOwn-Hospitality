import React, { useState, useEffect } from 'react';
import {
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  Legend,
  ResponsiveContainer,
  LineChart,
  Line,
  PieChart,
  Pie,
  Cell,
  AreaChart,
  Area
} from 'recharts';
import {
  Shield,
  AlertTriangle,
  CheckCircle,
  Clock,
  FileText,
  Users,
  Calendar,
  Award,
  AlertCircle,
  Download,
  RefreshCw,
  Plus,
  Eye,
  Settings,
  BookOpen,
  Target,
  Zap,
  Activity
} from 'lucide-react';
import { api } from '../../services/api';
import { withErrorBoundary } from '../ErrorBoundary';

interface ComplianceAlert {
  type: string;
  severity: 'low' | 'medium' | 'high' | 'critical';
  count: number;
  items: unknown[];
  action: string;
}

interface ComplianceMonitoring {
  hotelId: string;
  timestamp: string;
  status: string;
  alerts: ComplianceAlert[];
  preventiveActions: unknown[];
  summary: {
    overallStatus: string;
    totalAlerts: number;
    criticalAlerts: number;
    highAlerts: number;
    preventiveActionsCount: number;
  };
}

interface ComplianceReport {
  _id: string;
  reportType: string;
  reportDate: string;
  status: 'compliant' | 'non_compliant' | 'pending_review' | 'needs_attention';
  overallScore: number;
}

interface ComplianceDeadline {
  type: 'inspection' | 'certification';
  reportType: string;
  date: string;
  description: string;
}

interface CorrectiveAction {
  reportType: string;
  area: string;
  description: string;
  deadline: string;
  assignedTo: unknown;
  daysOverdue: number;
}

interface ComplianceDashboard {
  hotelId: string;
  generatedAt: string;
  period: number;
  summary: {
    totalReports: number;
    averageScore: number;
    compliantReports: number;
    nonCompliantReports: number;
    complianceRate: number;
  };
  alerts: ComplianceAlert[];
  recentReports: ComplianceReport[];
  upcomingDeadlines: ComplianceDeadline[];
  trends: {
    trend: string;
    changePercent: number;
  };
  recommendations: Array<{
    type: string;
    priority: string;
    description: string;
    action: string;
  }>;
}

const COLORS = {
  primary: '#3B82F6',
  secondary: '#8B5CF6',
  success: '#10B981',
  warning: '#F59E0B',
  danger: '#EF4444',
  gray: '#6B7280'
};

const CHART_COLORS = [
  '#3B82F6', '#8B5CF6', '#10B981', '#F59E0B',
  '#EF4444', '#06B6D4', '#84CC16', '#F97316'
];

const ComplianceCenter: React.FC = () => {
  const [dashboardData, setDashboardData] = useState<ComplianceDashboard | null>(null);
  const [monitoring, setMonitoring] = useState<ComplianceMonitoring | null>(null);
  const [correctiveActions, setCorrectiveActions] = useState<CorrectiveAction[]>([]);
  const [loading, setLoading] = useState(true);
  const [selectedPeriod, setSelectedPeriod] = useState('90');
  const [activeTab, setActiveTab] = useState<'dashboard' | 'monitoring' | 'reports' | 'actions'>('dashboard');
  const [selectedReportType, setSelectedReportType] = useState<string>('');

  const reportTypes = [
    'fda', 'health_department', 'fire_safety', 'environmental', 'osha', 'general'
  ];

  useEffect(() => {
    fetchComplianceDashboard();
    fetchComplianceMonitoring();
    fetchCorrectiveActions();
  }, [selectedPeriod]);

  const fetchComplianceDashboard = async () => {
    try {
      setLoading(true);
      const params = new URLSearchParams({
        period: selectedPeriod,
        includeForecasting: 'true',
        includeBenchmarking: 'false'
      });

      const { data } = await api.get(`/inventory/analytics/compliance?${params}`);
      setDashboardData(data.data);
    } catch {
      // Error handled silently
    } finally {
      setLoading(false);
    }
  };

  const fetchComplianceMonitoring = async () => {
    try {
      const params = new URLSearchParams({
        alertThreshold: 'medium',
        includePreventive: 'true',
        scope: 'all'
      });

      const { data } = await api.get(`/inventory/analytics/compliance/monitor?${params}`);
      setMonitoring(data.data);
    } catch {
      // Error handled silently
    }
  };

  const fetchCorrectiveActions = async () => {
    try {
      const params = new URLSearchParams({
        includeOverdue: 'true',
        includePending: 'true',
        includeCompleted: 'false',
        timeframe: selectedPeriod
      });

      const { data } = await api.get(`/inventory/analytics/compliance/corrective-actions?${params}`);
      setCorrectiveActions([
          ...data.data.actions.overdue,
          ...data.data.actions.pending,
          ...data.data.actions.inProgress
        ]);
    } catch {
      // Error handled silently
    }
  };

  const generateComplianceReport = async () => {
    if (!selectedReportType) return;

    try {
      await api.post('/inventory/analytics/compliance/generate-report', {
        reportType: selectedReportType,
        includePreviousPeriod: true,
        includeRecommendations: true,
        autoScheduleFollowUp: true
      });

      alert(`${selectedReportType} compliance report generated successfully!`);
      fetchComplianceDashboard();
    } catch (error) {
      alert('Failed to generate compliance report');
    }
  };

  const performComplianceAudit = async () => {
    try {
      await api.post('/inventory/analytics/compliance/audit', {
        auditType: 'comprehensive',
        includeEvidence: true,
        generateActionPlan: true,
        assessRisk: true
      });

      alert('Comprehensive compliance audit completed successfully!');
      fetchComplianceDashboard();
      fetchCorrectiveActions();
    } catch (error) {
      alert('Failed to perform compliance audit');
    }
  };

  const formatDate = (dateString: string) => {
    return new Date(dateString).toLocaleDateString('en-US', {
      year: 'numeric',
      month: 'short',
      day: 'numeric'
    });
  };

  const formatPercentage = (value: number) => {
    return `${value.toFixed(1)}%`;
  };

  const getStatusColor = (status: string) => {
    switch (status) {
      case 'compliant':
        return 'text-green-600 bg-green-100';
      case 'non_compliant':
        return 'text-red-600 bg-red-100';
      case 'needs_attention':
        return 'text-orange-600 bg-orange-100';
      default:
        return 'text-gray-600 bg-gray-100';
    }
  };

  const getSeverityColor = (severity: string) => {
    switch (severity) {
      case 'critical':
        return 'text-red-600 bg-red-100';
      case 'high':
        return 'text-orange-600 bg-orange-100';
      case 'medium':
        return 'text-yellow-600 bg-yellow-100';
      default:
        return 'text-blue-600 bg-blue-100';
    }
  };

  const exportData = () => {
    const dataToExport = {
      dashboardData,
      monitoring,
      correctiveActions,
      exportDate: new Date().toISOString()
    };

    const blob = new Blob([JSON.stringify(dataToExport, null, 2)], {
      type: 'application/json'
    });

    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `compliance-analysis-${new Date().toISOString().split('T')[0]}.json`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
  };

  if (loading || !dashboardData) {
    return (
      <div className="bg-white rounded-lg shadow-sm p-6">
        <div className="flex items-center justify-center h-64">
          <RefreshCw className="w-8 h-8 animate-spin text-blue-500" />
          <span className="ml-2 text-gray-600">Loading compliance data...</span>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="bg-white rounded-lg shadow-sm p-6">
        <div className="flex items-center justify-between mb-6">
          <div>
            <h2 className="text-2xl font-bold text-gray-900">Compliance Center</h2>
            <p className="text-gray-600 mt-1">
              Monitor regulatory compliance, track certifications, and manage corrective actions
            </p>
          </div>
          <div className="flex space-x-3">
            <button
              onClick={fetchComplianceDashboard}
              className="flex items-center px-4 py-2 text-blue-600 bg-blue-50 rounded-lg hover:bg-blue-100 transition-colors"
            >
              <RefreshCw className="w-4 h-4 mr-2" />
              Refresh
            </button>
            <button
              onClick={exportData}
              className="flex items-center px-4 py-2 text-gray-600 bg-gray-50 rounded-lg hover:bg-gray-100 transition-colors"
            >
              <Download className="w-4 h-4 mr-2" />
              Export
            </button>
          </div>
        </div>

        {/* Period Selector */}
        <div className="flex items-center space-x-4 mb-6">
          <label className="text-sm font-medium text-gray-700">Analysis Period:</label>
          <select
            value={selectedPeriod}
            onChange={(e) => setSelectedPeriod(e.target.value)}
            className="px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
          >
            <option value="30">Last 30 days</option>
            <option value="60">Last 60 days</option>
            <option value="90">Last 90 days</option>
            <option value="180">Last 6 months</option>
            <option value="365">Last year</option>
          </select>
        </div>

        {/* Tab Navigation */}
        <div className="flex space-x-1 bg-gray-100 rounded-lg p-1">
          {['dashboard', 'monitoring', 'reports', 'actions'].map((tab) => (
            <button aria-label="Close"
              key={tab}
              onClick={() => setActiveTab(tab as typeof activeTab)}
              className={`flex-1 px-4 py-2 text-sm font-medium rounded-md transition-colors ${
                activeTab === tab
                  ? 'bg-white text-blue-600 shadow-sm'
                  : 'text-gray-600 hover:text-gray-900'
              }`}
            >
              {tab.charAt(0).toUpperCase() + tab.slice(1)}
            </button>
          ))}
        </div>
      </div>

      {/* Dashboard Tab */}
      {activeTab === 'dashboard' && (
        <div className="space-y-6">
          {/* Summary Cards */}
          <div className="grid grid-cols-1 md:grid-cols-4 gap-6">
            <div className="bg-white rounded-lg shadow-sm p-6">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm text-gray-600">Compliance Rate</p>
                  <p className="text-2xl font-bold text-green-600">
                    {formatPercentage(dashboardData.summary.complianceRate)}
                  </p>
                  <p className="text-sm text-gray-500 mt-1">
                    {dashboardData.summary.compliantReports}/{dashboardData.summary.totalReports} reports
                  </p>
                </div>
                <CheckCircle className="w-8 h-8 text-green-500" />
              </div>
            </div>

            <div className="bg-white rounded-lg shadow-sm p-6">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm text-gray-600">Average Score</p>
                  <p className="text-2xl font-bold text-blue-600">
                    {dashboardData.summary.averageScore.toFixed(1)}
                  </p>
                  <p className="text-sm text-gray-500 mt-1">
                    Out of 100
                  </p>
                </div>
                <Award className="w-8 h-8 text-blue-500" />
              </div>
            </div>

            <div className="bg-white rounded-lg shadow-sm p-6">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm text-gray-600">Active Alerts</p>
                  <p className="text-2xl font-bold text-orange-600">
                    {monitoring?.summary.totalAlerts || 0}
                  </p>
                  <p className="text-sm text-gray-500 mt-1">
                    {monitoring?.summary.criticalAlerts || 0} critical
                  </p>
                </div>
                <AlertTriangle className="w-8 h-8 text-orange-500" />
              </div>
            </div>

            <div className="bg-white rounded-lg shadow-sm p-6">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm text-gray-600">Upcoming Deadlines</p>
                  <p className="text-2xl font-bold text-purple-600">
                    {dashboardData.upcomingDeadlines.length}
                  </p>
                  <p className="text-sm text-gray-500 mt-1">
                    Next 60 days
                  </p>
                </div>
                <Calendar className="w-8 h-8 text-purple-500" />
              </div>
            </div>
          </div>

          {/* Compliance Score Trend */}
          <div className="bg-white rounded-lg shadow-sm p-6">
            <h3 className="text-lg font-semibold text-gray-900 mb-4">Compliance Trend</h3>
            <div className="flex items-center justify-between mb-4">
              <div className="flex items-center space-x-4">
                <div className={`flex items-center px-3 py-1 rounded-full text-sm font-medium ${
                  dashboardData.trends.trend === 'improving' ? 'text-green-600 bg-green-100' : 'text-red-600 bg-red-100'
                }`}>
                  {dashboardData.trends.trend === 'improving' ? (
                    <CheckCircle className="w-4 h-4 mr-1" />
                  ) : (
                    <AlertTriangle className="w-4 h-4 mr-1" />
                  )}
                  {dashboardData.trends.trend === 'improving' ? 'Improving' : 'Declining'}
                </div>
                <span className="text-sm text-gray-600">
                  {Math.abs(dashboardData.trends.changePercent).toFixed(1)}% change
                </span>
              </div>
            </div>

            <div className="h-64">
              <ResponsiveContainer width="100%" height="100%">
                <AreaChart data={dashboardData.recentReports}>
                  <CartesianGrid strokeDasharray="3 3" />
                  <XAxis
                    dataKey="reportDate"
                    tickFormatter={(value) => formatDate(value)}
                  />
                  <YAxis domain={[0, 100]} />
                  <Tooltip
                    labelFormatter={(value) => formatDate(value)}
                    formatter={(value) => [`${value}%`, 'Compliance Score']}
                  />
                  <Area
                    type="monotone"
                    dataKey="overallScore"
                    stroke={COLORS.primary}
                    fill={COLORS.primary}
                    fillOpacity={0.3}
                  />
                </AreaChart>
              </ResponsiveContainer>
            </div>
          </div>

          {/* Recent Reports */}
          <div className="bg-white rounded-lg shadow-sm p-6">
            <h3 className="text-lg font-semibold text-gray-900 mb-4">Recent Compliance Reports</h3>

            <div className="space-y-3">
              {dashboardData.recentReports.map((report) => (
                <div
                  key={report._id}
                  className="flex items-center justify-between p-4 border border-gray-200 rounded-lg hover:bg-gray-50 transition-colors"
                >
                  <div className="flex items-center space-x-3">
                    <FileText className="w-5 h-5 text-gray-400" />
                    <div>
                      <h4 className="font-medium text-gray-900 capitalize">
                        {report.reportType.replace('_', ' ')} Report
                      </h4>
                      <p className="text-sm text-gray-600">{formatDate(report.reportDate)}</p>
                    </div>
                  </div>
                  <div className="flex items-center space-x-3">
                    <span className="text-sm font-medium text-gray-900">
                      {report.overallScore}%
                    </span>
                    <span className={`px-2 py-1 rounded-full text-xs font-medium ${getStatusColor(report.status)}`}>
                      {report.status.replace('_', ' ').toUpperCase()}
                    </span>
                  </div>
                </div>
              ))}

              {dashboardData.recentReports.length === 0 && (
                <div className="text-center py-8">
                  <FileText className="w-12 h-12 text-gray-400 mx-auto mb-3" />
                  <p className="text-gray-600">No recent compliance reports</p>
                </div>
              )}
            </div>
          </div>

          {/* Upcoming Deadlines */}
          <div className="bg-white rounded-lg shadow-sm p-6">
            <h3 className="text-lg font-semibold text-gray-900 mb-4">Upcoming Deadlines</h3>

            <div className="space-y-3">
              {dashboardData.upcomingDeadlines.map((deadline, index) => (
                <div
                  key={`dashboardData-upcomingDeadlines-${index}-${deadline.date}`}
                  className="flex items-center justify-between p-4 border border-gray-200 rounded-lg"
                >
                  <div className="flex items-center space-x-3">
                    {deadline.type === 'inspection' ? (
                      <Eye className="w-5 h-5 text-blue-500" />
                    ) : (
                      <Award className="w-5 h-5 text-green-500" />
                    )}
                    <div>
                      <h4 className="font-medium text-gray-900">{deadline.description}</h4>
                      <p className="text-sm text-gray-600 capitalize">
                        {deadline.reportType.replace('_', ' ')}
                      </p>
                    </div>
                  </div>
                  <div className="text-right">
                    <p className="text-sm font-medium text-gray-900">{formatDate(deadline.date)}</p>
                    <p className="text-xs text-gray-500 capitalize">{deadline.type}</p>
                  </div>
                </div>
              ))}

              {dashboardData.upcomingDeadlines.length === 0 && (
                <div className="text-center py-8">
                  <Calendar className="w-12 h-12 text-gray-400 mx-auto mb-3" />
                  <p className="text-gray-600">No upcoming deadlines</p>
                </div>
              )}
            </div>
          </div>
        </div>
      )}

      {/* Monitoring Tab */}
      {activeTab === 'monitoring' && monitoring && (
        <div className="space-y-6">
          {/* Status Overview */}
          <div className="bg-white rounded-lg shadow-sm p-6">
            <div className="flex items-center justify-between mb-6">
              <h3 className="text-lg font-semibold text-gray-900">Real-time Compliance Monitoring</h3>
              <div className={`flex items-center px-3 py-1 rounded-full text-sm font-medium ${
                monitoring.summary.overallStatus === 'good' ? 'text-green-600 bg-green-100' :
                monitoring.summary.overallStatus === 'critical' ? 'text-red-600 bg-red-100' :
                'text-orange-600 bg-orange-100'
              }`}>
                <Shield className="w-4 h-4 mr-1" />
                {monitoring.summary.overallStatus.toUpperCase()}
              </div>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-4 gap-6 mb-6">
              <div className="text-center">
                <p className="text-2xl font-bold text-gray-900">{monitoring.summary.totalAlerts}</p>
                <p className="text-sm text-gray-600">Total Alerts</p>
              </div>
              <div className="text-center">
                <p className="text-2xl font-bold text-red-600">{monitoring.summary.criticalAlerts}</p>
                <p className="text-sm text-gray-600">Critical</p>
              </div>
              <div className="text-center">
                <p className="text-2xl font-bold text-orange-600">{monitoring.summary.highAlerts}</p>
                <p className="text-sm text-gray-600">High Priority</p>
              </div>
              <div className="text-center">
                <p className="text-2xl font-bold text-blue-600">{monitoring.summary.preventiveActionsCount}</p>
                <p className="text-sm text-gray-600">Preventive Actions</p>
              </div>
            </div>

            {/* Active Alerts */}
            <div className="space-y-4">
              <h4 className="text-md font-medium text-gray-900">Active Alerts</h4>
              {monitoring.alerts.map((alert, index) => (
                <div
                  key={`monitoring-alerts-${index}-${alert.type}`}
                  className="border border-gray-200 rounded-lg p-4"
                >
                  <div className="flex items-center justify-between">
                    <div className="flex items-center space-x-3">
                      <AlertTriangle className={`w-5 h-5 ${
                        alert.severity === 'critical' ? 'text-red-500' :
                        alert.severity === 'high' ? 'text-orange-500' :
                        alert.severity === 'medium' ? 'text-yellow-500' : 'text-blue-500'
                      }`} />
                      <div>
                        <h5 className="font-medium text-gray-900 capitalize">
                          {alert.type.replace('_', ' ')}
                        </h5>
                        <p className="text-sm text-gray-600">{alert.action}</p>
                      </div>
                    </div>
                    <div className="flex items-center space-x-3">
                      <span className={`px-2 py-1 rounded-full text-xs font-medium ${getSeverityColor(alert.severity)}`}>
                        {alert.severity.toUpperCase()}
                      </span>
                      <span className="text-sm font-medium text-gray-900">
                        {alert.count} items
                      </span>
                    </div>
                  </div>
                </div>
              ))}

              {monitoring.alerts.length === 0 && (
                <div className="text-center py-8">
                  <CheckCircle className="w-12 h-12 text-green-400 mx-auto mb-3" />
                  <p className="text-gray-600">No active compliance alerts</p>
                  <p className="text-sm text-gray-500 mt-1">All systems are operating within compliance parameters</p>
                </div>
              )}
            </div>
          </div>
        </div>
      )}

      {/* Reports Tab */}
      {activeTab === 'reports' && (
        <div className="space-y-6">
          <div className="bg-white rounded-lg shadow-sm p-6">
            <div className="flex items-center justify-between mb-6">
              <h3 className="text-lg font-semibold text-gray-900">Generate Compliance Reports</h3>
              <div className="flex space-x-3">
                <select
                  value={selectedReportType}
                  onChange={(e) => setSelectedReportType(e.target.value)}
                  className="px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                >
                  <option value="">Select Report Type</option>
                  {reportTypes.map(type => (
                    <option key={type} value={type}>
                      {type.toUpperCase().replace('_', ' ')}
                    </option>
                  ))}
                </select>
                <button
                  onClick={generateComplianceReport}
                  disabled={!selectedReportType}
                  className="flex items-center px-4 py-2 text-white bg-blue-600 rounded-lg hover:bg-blue-700 disabled:bg-gray-400 disabled:cursor-not-allowed transition-colors"
                >
                  <Plus className="w-4 h-4 mr-2" />
                  Generate Report
                </button>
              </div>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
              {reportTypes.map(type => (
                <div key={type} className="border border-gray-200 rounded-lg p-4 hover:bg-gray-50 transition-colors">
                  <div className="flex items-center justify-between mb-3">
                    <FileText className="w-6 h-6 text-blue-500" />
                    <button
                      onClick={() => {
                        setSelectedReportType(type);
                        generateComplianceReport();
                      }}
                      className="text-sm text-blue-600 hover:text-blue-800 transition-colors"
                    >
                      Generate
                    </button>
                  </div>
                  <h4 className="font-medium text-gray-900 mb-1 capitalize">
                    {type.replace('_', ' ')} Report
                  </h4>
                  <p className="text-sm text-gray-600">
                    {type === 'fda' && 'Food and Drug Administration compliance'}
                    {type === 'health_department' && 'Local health department requirements'}
                    {type === 'fire_safety' && 'Fire safety systems and procedures'}
                    {type === 'environmental' && 'Environmental regulations compliance'}
                    {type === 'osha' && 'Occupational Safety and Health Administration'}
                    {type === 'general' && 'General hotel compliance requirements'}
                  </p>
                </div>
              ))}
            </div>

            <div className="mt-8 p-4 bg-blue-50 rounded-lg">
              <div className="flex items-center justify-between">
                <div className="flex items-center space-x-3">
                  <Settings className="w-5 h-5 text-blue-600" />
                  <div>
                    <h4 className="font-medium text-blue-900">Comprehensive Audit</h4>
                    <p className="text-sm text-blue-700">
                      Perform a complete compliance audit across all areas
                    </p>
                  </div>
                </div>
                <button
                  onClick={performComplianceAudit}
                  className="flex items-center px-4 py-2 text-blue-600 bg-white border border-blue-300 rounded-lg hover:bg-blue-50 transition-colors"
                >
                  <Activity className="w-4 h-4 mr-2" />
                  Start Audit
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Actions Tab */}
      {activeTab === 'actions' && (
        <div className="space-y-6">
          <div className="bg-white rounded-lg shadow-sm p-6">
            <h3 className="text-lg font-semibold text-gray-900 mb-4">Corrective Actions Tracking</h3>

            <div className="space-y-4">
              {correctiveActions.map((action, index) => (
                <div
                  key={`correctiveActions-${index}`}
                  className="border border-gray-200 rounded-lg p-4"
                >
                  <div className="flex items-center justify-between">
                    <div className="flex-1">
                      <div className="flex items-center space-x-3 mb-2">
                        <h4 className="font-medium text-gray-900">{action.description}</h4>
                        {action.daysOverdue > 0 && (
                          <span className="px-2 py-1 rounded-full text-xs font-medium text-red-600 bg-red-100">
                            {action.daysOverdue} DAYS OVERDUE
                          </span>
                        )}
                      </div>
                      <div className="flex items-center space-x-4 text-sm text-gray-600">
                        <span>Area: {action.area}</span>
                        <span>Report: {action.reportType.replace('_', ' ')}</span>
                        <span>Due: {formatDate(action.deadline)}</span>
                      </div>
                      {action.assignedTo && (
                        <p className="text-sm text-gray-600 mt-1">
                          Assigned to: {action.assignedTo.name || 'Unassigned'}
                        </p>
                      )}
                    </div>
                    <div className="flex items-center space-x-2">
                      {action.daysOverdue > 0 ? (
                        <AlertTriangle className="w-5 h-5 text-red-500" />
                      ) : (
                        <Clock className="w-5 h-5 text-yellow-500" />
                      )}
                    </div>
                  </div>
                </div>
              ))}

              {correctiveActions.length === 0 && (
                <div className="text-center py-8">
                  <CheckCircle className="w-12 h-12 text-green-400 mx-auto mb-3" />
                  <p className="text-gray-600">No pending corrective actions</p>
                  <p className="text-sm text-gray-500 mt-1">
                    All compliance requirements are up to date
                  </p>
                </div>
              )}
            </div>
          </div>

          {/* Recommendations */}
          <div className="bg-white rounded-lg shadow-sm p-6">
            <h3 className="text-lg font-semibold text-gray-900 mb-4">Compliance Recommendations</h3>

            <div className="space-y-4">
              {dashboardData.recommendations.map((recommendation, index) => (
                <div
                  key={`dashboardData-recommendations-${index}-${recommendation.type}`}
                  className="border border-gray-200 rounded-lg p-4"
                >
                  <div className="flex items-start justify-between">
                    <div className="flex-1">
                      <div className="flex items-center space-x-3 mb-2">
                        <span className={`px-2 py-1 rounded-full text-xs font-medium ${
                          recommendation.priority === 'critical' ? 'text-red-600 bg-red-100' :
                          recommendation.priority === 'high' ? 'text-orange-600 bg-orange-100' :
                          'text-blue-600 bg-blue-100'
                        }`}>
                          {recommendation.priority.toUpperCase()}
                        </span>
                        <span className="px-2 py-1 rounded-full text-xs font-medium text-gray-600 bg-gray-100">
                          {recommendation.type.replace('_', ' ').toUpperCase()}
                        </span>
                      </div>
                      <h4 className="font-medium text-gray-900 mb-1">{recommendation.description}</h4>
                      <p className="text-sm text-gray-600">{recommendation.action}</p>
                    </div>
                    <div className="flex items-center">
                      {recommendation.priority === 'critical' ? (
                        <AlertTriangle className="w-5 h-5 text-red-500" />
                      ) : (
                        <Target className="w-5 h-5 text-blue-500" />
                      )}
                    </div>
                  </div>
                </div>
              ))}

              {dashboardData.recommendations.length === 0 && (
                <div className="text-center py-8">
                  <Award className="w-12 h-12 text-blue-400 mx-auto mb-3" />
                  <p className="text-gray-600">No specific recommendations at this time</p>
                  <p className="text-sm text-gray-500 mt-1">
                    Your compliance management is on track
                  </p>
                </div>
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default withErrorBoundary(ComplianceCenter, { level: 'component' });