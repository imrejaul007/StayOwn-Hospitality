import React, { useState, useEffect } from 'react';
import { useAuth } from '../../context/AuthContext';
import { useProperty } from '../../context/PropertyContext';
import { PropertyBreadcrumb } from '../../components/common/PropertyBreadcrumb';
import {
  FileText,
  TrendingUp,
  TrendingDown,
  Clock,
  CheckCircle,
  XCircle,
  AlertTriangle,
  RefreshCw,
  Users,
  UserCheck,
  Calendar,
  BarChart3,
  PieChart,
  Download,
  Filter,
  Eye,
  Shield,
  Award,
  Heart,
  Phone,
  CreditCard,
  PiggyBank,
  Briefcase,
  Building
} from 'lucide-react';
import { Card } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { LoadingSpinner } from '../../components/LoadingSpinner';
import { toast } from 'sonner';
import { api } from '../../services/api';
import { withErrorBoundary } from '../../components/ErrorBoundary';

interface AnalyticsData {
  overview: {
    totalDocuments: number;
    pendingVerification: number;
    verifiedDocuments: number;
    rejectedDocuments: number;
    expiredDocuments: number;
    renewalRequests: number;
    complianceRate: number;
    avgVerificationTime: number; // in hours
  };
  trends: {
    uploadsThisMonth: number;
    uploadsLastMonth: number;
    verificationsThisMonth: number;
    verificationsLastMonth: number;
    rejectionsThisMonth: number;
    rejectionsLastMonth: number;
  };
  byUserType: {
    guest: {
      total: number;
      pending: number;
      verified: number;
      rejected: number;
      expired: number;
    };
    staff: {
      total: number;
      pending: number;
      verified: number;
      rejected: number;
      expired: number;
    };
  };
  byCategory: Array<{
    category: string;
    userType: 'guest' | 'staff';
    total: number;
    pending: number;
    verified: number;
    rejected: number;
    expired: number;
    complianceRate: number;
  }>;
  expiringSoon: Array<{
    _id: string;
    originalName: string;
    category: string;
    userType: 'guest' | 'staff';
    userId: {
      firstName: string;
      lastName: string;
      email: string;
    };
    expiresAt: string;
    daysUntilExpiry: number;
  }>;
  recentActivity: Array<{
    _id: string;
    action: string;
    documentName: string;
    category: string;
    userType: 'guest' | 'staff';
    performedBy: {
      firstName: string;
      lastName: string;
    };
    timestamp: string;
  }>;
  departmentCompliance: Array<{
    departmentId: string;
    departmentName: string;
    totalStaff: number;
    compliantStaff: number;
    complianceRate: number;
    pendingDocuments: number;
    expiredDocuments: number;
  }>;
}

const guestDocumentCategories = {
  identity_proof: { icon: Shield, label: 'Identity Proof' },
  address_proof: { icon: Building, label: 'Address Proof' },
  travel_document: { icon: FileText, label: 'Travel Document' },
  visa: { icon: FileText, label: 'Visa' },
  certificate: { icon: Award, label: 'Certificate' },
  booking_related: { icon: Calendar, label: 'Booking Related' },
  payment_proof: { icon: CreditCard, label: 'Payment Proof' }
};

const staffDocumentCategories = {
  employment_verification: { icon: Briefcase, label: 'Employment Verification' },
  id_proof: { icon: Shield, label: 'Identity Proof' },
  training_certificate: { icon: Award, label: 'Training & Certification' },
  health_certificate: { icon: Heart, label: 'Health Certificate' },
  background_check: { icon: Shield, label: 'Background Check' },
  work_permit: { icon: Building, label: 'Work Permit & Visa' },
  emergency_contact: { icon: Phone, label: 'Emergency Contact' },
  tax_document: { icon: CreditCard, label: 'Tax Documents' },
  bank_details: { icon: PiggyBank, label: 'Banking Information' }
};

function AdminDocumentAnalytics() {
  const { user } = useAuth();
  const { selectedPropertyId, selectedProperty, viewMode } = useProperty();
  const [analytics, setAnalytics] = useState<AnalyticsData | null>(null);
  const [loading, setLoading] = useState(true);
  const [selectedPeriod, setSelectedPeriod] = useState<'7d' | '30d' | '90d' | '1y'>('30d');
  const [selectedUserType, setSelectedUserType] = useState<'all' | 'guest' | 'staff'>('all');

  useEffect(() => {
    if (selectedPropertyId) {
      fetchAnalytics();
    }
  }, [selectedPropertyId, selectedPeriod, selectedUserType]);

  const fetchAnalytics = async () => {
    try {
      setLoading(true);
      const { data } = await api.get('/documents/analytics', {
        params: { period: selectedPeriod, userType: selectedUserType, propertyId: selectedPropertyId }
      });
      setAnalytics(data.analytics);
    } catch (error) {
      toast.error('Error loading analytics');
    } finally {
      setLoading(false);
    }
  };

  const exportAnalytics = async () => {
    try {
      const response = await api.get('/documents/analytics/export', {
        params: { period: selectedPeriod, userType: selectedUserType, propertyId: selectedPropertyId },
        responseType: 'blob'
      });
      const blob = response.data;
      const url = window.URL.createObjectURL(blob);
      const link = document.createElement('a');
      link.href = url;
      link.download = `document-analytics-${selectedPeriod}-${new Date().toISOString().split('T')[0]}.csv`;
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
      window.URL.revokeObjectURL(url);
      toast.success('Analytics exported successfully');
    } catch (error) {
      toast.error('Error exporting analytics');
    }
  };

  const getTrendIcon = (current: number, previous: number) => {
    if (current > previous) {
      return <TrendingUp className="h-4 w-4 text-green-600" />;
    } else if (current < previous) {
      return <TrendingDown className="h-4 w-4 text-red-600" />;
    }
    return <TrendingUp className="h-4 w-4 text-gray-400" />;
  };

  const getTrendPercentage = (current: number, previous: number) => {
    if (previous === 0) return current > 0 ? '+100%' : '0%';
    const percentage = ((current - previous) / previous) * 100;
    return `${percentage > 0 ? '+' : ''}${percentage.toFixed(1)}%`;
  };

  const getComplianceColor = (rate: number) => {
    if (rate >= 90) return 'text-green-600 bg-green-100';
    if (rate >= 75) return 'text-yellow-600 bg-yellow-100';
    return 'text-red-600 bg-red-100';
  };

  const formatDate = (dateString: string) => {
    return new Date(dateString).toLocaleDateString('en-US', {
      year: 'numeric',
      month: 'short',
      day: 'numeric',
      hour: '2-digit',
      minute: '2-digit'
    });
  };

  const formatDuration = (hours: number) => {
    if (hours < 24) {
      return `${hours.toFixed(1)}h`;
    }
    const days = Math.floor(hours / 24);
    const remainingHours = hours % 24;
    return `${days}d ${remainingHours.toFixed(1)}h`;
  };

  if (!selectedPropertyId && viewMode === 'single') {
    return (
      <div className="p-6">
        <PropertyBreadcrumb items={['Compliance', 'Document Analytics']} />
        <div className="mt-8 text-center">
          <p className="text-gray-500">Please select a property to view document analytics</p>
        </div>
      </div>
    );
  }

  if (loading) {
    return (
      <div className="flex justify-center items-center h-64">
        <LoadingSpinner />
      </div>
    );
  }

  if (!analytics) {
    return (
      <div className="text-center py-8">
        <AlertTriangle className="h-12 w-12 text-yellow-400 mx-auto mb-4" />
        <p className="text-gray-600">Failed to load analytics data</p>
        <Button onClick={fetchAnalytics} className="mt-4">
          <RefreshCw className="h-4 w-4 mr-2" />
          Retry
        </Button>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Breadcrumb */}
      <PropertyBreadcrumb items={['Compliance', 'Document Analytics']} />

      {/* Header */}
      <div className="flex justify-between items-start">
        <div>
          <h1 className="text-3xl font-bold text-gray-900">Document Analytics</h1>
          <p className="text-gray-600 mt-1">Compliance tracking and document verification insights</p>
        </div>
        <div className="flex items-center gap-3">
          <select
            value={selectedPeriod}
            onChange={(e) => setSelectedPeriod(e.target.value as unknown)}
            className="px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
          >
            <option value="7d">Last 7 days</option>
            <option value="30d">Last 30 days</option>
            <option value="90d">Last 90 days</option>
            <option value="1y">Last year</option>
          </select>
          <select
            value={selectedUserType}
            onChange={(e) => setSelectedUserType(e.target.value as unknown)}
            className="px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
          >
            <option value="all">All Users</option>
            <option value="guest">Guests Only</option>
            <option value="staff">Staff Only</option>
          </select>
          <Button onClick={exportAnalytics} variant="outline">
            <Download className="h-4 w-4 mr-2" />
            Export
          </Button>
          <Button onClick={fetchAnalytics} variant="outline">
            <RefreshCw className="h-4 w-4" />
          </Button>
        </div>
      </div>

      {/* Overview Stats */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 xl:grid-cols-8 gap-4">
        <Card className="p-4">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm font-medium text-gray-600">Total Documents</p>
              <p className="text-2xl font-bold text-gray-900">{analytics.overview.totalDocuments.toLocaleString()}</p>
            </div>
            <FileText className="h-8 w-8 text-gray-400" />
          </div>
        </Card>

        <Card className="p-4">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm font-medium text-gray-600">Pending</p>
              <p className="text-2xl font-bold text-yellow-600">{analytics.overview.pendingVerification}</p>
            </div>
            <Clock className="h-8 w-8 text-yellow-400" />
          </div>
        </Card>

        <Card className="p-4">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm font-medium text-gray-600">Verified</p>
              <p className="text-2xl font-bold text-green-600">{analytics.overview.verifiedDocuments}</p>
            </div>
            <CheckCircle className="h-8 w-8 text-green-400" />
          </div>
        </Card>

        <Card className="p-4">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm font-medium text-gray-600">Rejected</p>
              <p className="text-2xl font-bold text-red-600">{analytics.overview.rejectedDocuments}</p>
            </div>
            <XCircle className="h-8 w-8 text-red-400" />
          </div>
        </Card>

        <Card className="p-4">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm font-medium text-gray-600">Expired</p>
              <p className="text-2xl font-bold text-orange-600">{analytics.overview.expiredDocuments}</p>
            </div>
            <AlertTriangle className="h-8 w-8 text-orange-400" />
          </div>
        </Card>

        <Card className="p-4">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm font-medium text-gray-600">Renewal Needed</p>
              <p className="text-2xl font-bold text-blue-600">{analytics.overview.renewalRequests}</p>
            </div>
            <RefreshCw className="h-8 w-8 text-blue-400" />
          </div>
        </Card>

        <Card className="p-4">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm font-medium text-gray-600">Compliance Rate</p>
              <p className={`text-2xl font-bold ${analytics.overview.complianceRate >= 90 ? 'text-green-600' : analytics.overview.complianceRate >= 75 ? 'text-yellow-600' : 'text-red-600'}`}>
                {analytics.overview.complianceRate.toFixed(1)}%
              </p>
            </div>
            <BarChart3 className="h-8 w-8 text-blue-400" />
          </div>
        </Card>

        <Card className="p-4">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm font-medium text-gray-600">Avg. Verification</p>
              <p className="text-2xl font-bold text-purple-600">{formatDuration(analytics.overview.avgVerificationTime)}</p>
            </div>
            <Clock className="h-8 w-8 text-purple-400" />
          </div>
        </Card>
      </div>

      {/* Trends and User Type Breakdown */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Trends */}
        <Card className="p-6">
          <h3 className="text-lg font-semibold mb-4">Monthly Trends</h3>
          <div className="space-y-4">
            <div className="flex items-center justify-between p-3 bg-gray-50 rounded-lg">
              <div>
                <p className="font-medium">Document Uploads</p>
                <p className="text-sm text-gray-600">This month vs last month</p>
              </div>
              <div className="flex items-center gap-2">
                <span className="font-bold">{analytics.trends.uploadsThisMonth}</span>
                {getTrendIcon(analytics.trends.uploadsThisMonth, analytics.trends.uploadsLastMonth)}
                <span className={`text-sm ${analytics.trends.uploadsThisMonth >= analytics.trends.uploadsLastMonth ? 'text-green-600' : 'text-red-600'}`}>
                  {getTrendPercentage(analytics.trends.uploadsThisMonth, analytics.trends.uploadsLastMonth)}
                </span>
              </div>
            </div>

            <div className="flex items-center justify-between p-3 bg-gray-50 rounded-lg">
              <div>
                <p className="font-medium">Verifications</p>
                <p className="text-sm text-gray-600">This month vs last month</p>
              </div>
              <div className="flex items-center gap-2">
                <span className="font-bold">{analytics.trends.verificationsThisMonth}</span>
                {getTrendIcon(analytics.trends.verificationsThisMonth, analytics.trends.verificationsLastMonth)}
                <span className={`text-sm ${analytics.trends.verificationsThisMonth >= analytics.trends.verificationsLastMonth ? 'text-green-600' : 'text-red-600'}`}>
                  {getTrendPercentage(analytics.trends.verificationsThisMonth, analytics.trends.verificationsLastMonth)}
                </span>
              </div>
            </div>

            <div className="flex items-center justify-between p-3 bg-gray-50 rounded-lg">
              <div>
                <p className="font-medium">Rejections</p>
                <p className="text-sm text-gray-600">This month vs last month</p>
              </div>
              <div className="flex items-center gap-2">
                <span className="font-bold">{analytics.trends.rejectionsThisMonth}</span>
                {getTrendIcon(analytics.trends.rejectionsThisMonth, analytics.trends.rejectionsLastMonth)}
                <span className={`text-sm ${analytics.trends.rejectionsThisMonth >= analytics.trends.rejectionsLastMonth ? 'text-red-600' : 'text-green-600'}`}>
                  {getTrendPercentage(analytics.trends.rejectionsThisMonth, analytics.trends.rejectionsLastMonth)}
                </span>
              </div>
            </div>
          </div>
        </Card>

        {/* User Type Breakdown */}
        <Card className="p-6">
          <h3 className="text-lg font-semibold mb-4">Documents by User Type</h3>
          <div className="space-y-4">
            <div className="p-4 border rounded-lg">
              <div className="flex items-center justify-between mb-2">
                <div className="flex items-center gap-2">
                  <Users className="h-5 w-5 text-blue-600" />
                  <h4 className="font-medium">Guest Documents</h4>
                </div>
                <span className="text-lg font-bold">{analytics.byUserType.guest.total}</span>
              </div>
              <div className="grid grid-cols-4 gap-2 text-sm">
                <div className="text-center">
                  <p className="text-yellow-600 font-semibold">{analytics.byUserType.guest.pending}</p>
                  <p className="text-gray-500">Pending</p>
                </div>
                <div className="text-center">
                  <p className="text-green-600 font-semibold">{analytics.byUserType.guest.verified}</p>
                  <p className="text-gray-500">Verified</p>
                </div>
                <div className="text-center">
                  <p className="text-red-600 font-semibold">{analytics.byUserType.guest.rejected}</p>
                  <p className="text-gray-500">Rejected</p>
                </div>
                <div className="text-center">
                  <p className="text-orange-600 font-semibold">{analytics.byUserType.guest.expired}</p>
                  <p className="text-gray-500">Expired</p>
                </div>
              </div>
            </div>

            <div className="p-4 border rounded-lg">
              <div className="flex items-center justify-between mb-2">
                <div className="flex items-center gap-2">
                  <UserCheck className="h-5 w-5 text-purple-600" />
                  <h4 className="font-medium">Staff Documents</h4>
                </div>
                <span className="text-lg font-bold">{analytics.byUserType.staff.total}</span>
              </div>
              <div className="grid grid-cols-4 gap-2 text-sm">
                <div className="text-center">
                  <p className="text-yellow-600 font-semibold">{analytics.byUserType.staff.pending}</p>
                  <p className="text-gray-500">Pending</p>
                </div>
                <div className="text-center">
                  <p className="text-green-600 font-semibold">{analytics.byUserType.staff.verified}</p>
                  <p className="text-gray-500">Verified</p>
                </div>
                <div className="text-center">
                  <p className="text-red-600 font-semibold">{analytics.byUserType.staff.rejected}</p>
                  <p className="text-gray-500">Rejected</p>
                </div>
                <div className="text-center">
                  <p className="text-orange-600 font-semibold">{analytics.byUserType.staff.expired}</p>
                  <p className="text-gray-500">Expired</p>
                </div>
              </div>
            </div>
          </div>
        </Card>
      </div>

      {/* Category Analysis */}
      <Card className="p-6">
        <h3 className="text-lg font-semibold mb-4">Document Categories Analysis</h3>
        <div className="overflow-x-auto">
          <table className="w-full">
            <thead>
              <tr className="border-b">
                <th className="text-left py-2">Category</th>
                <th className="text-left py-2">Type</th>
                <th className="text-center py-2">Total</th>
                <th className="text-center py-2">Pending</th>
                <th className="text-center py-2">Verified</th>
                <th className="text-center py-2">Rejected</th>
                <th className="text-center py-2">Expired</th>
                <th className="text-center py-2">Compliance</th>
              </tr>
            </thead>
            <tbody>
              {analytics.byCategory.map((category, index) => {
                const categoryInfo = category.userType === 'guest'
                  ? guestDocumentCategories[category.category]
                  : staffDocumentCategories[category.category];
                const Icon = categoryInfo?.icon || FileText;

                return (
                  <tr key={`analytics-byCategory-${index}-${category.category}`} className="border-b hover:bg-gray-50">
                    <td className="py-3">
                      <div className="flex items-center gap-2">
                        <Icon className="h-4 w-4 text-gray-600" />
                        <span className="font-medium">{categoryInfo?.label || category.category}</span>
                      </div>
                    </td>
                    <td className="py-3">
                      <Badge variant={category.userType === 'guest' ? 'default' : 'secondary'}>
                        {category.userType}
                      </Badge>
                    </td>
                    <td className="text-center py-3 font-semibold">{category.total}</td>
                    <td className="text-center py-3 text-yellow-600">{category.pending}</td>
                    <td className="text-center py-3 text-green-600">{category.verified}</td>
                    <td className="text-center py-3 text-red-600">{category.rejected}</td>
                    <td className="text-center py-3 text-orange-600">{category.expired}</td>
                    <td className="text-center py-3">
                      <Badge className={getComplianceColor(category.complianceRate)}>
                        {category.complianceRate.toFixed(1)}%
                      </Badge>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </Card>

      {/* Department Compliance (for staff documents) */}
      {analytics.departmentCompliance && analytics.departmentCompliance.length > 0 && (
        <Card className="p-6">
          <h3 className="text-lg font-semibold mb-4">Department Compliance</h3>
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
            {analytics.departmentCompliance.map((dept, index) => (
              <div key={`analytics-departmentCompliance-${index}`} className="p-4 border rounded-lg">
                <div className="flex items-center justify-between mb-2">
                  <h4 className="font-medium">{dept.departmentName}</h4>
                  <Badge className={getComplianceColor(dept.complianceRate)}>
                    {dept.complianceRate.toFixed(1)}%
                  </Badge>
                </div>
                <div className="space-y-1 text-sm">
                  <div className="flex justify-between">
                    <span>Total Staff:</span>
                    <span className="font-semibold">{dept.totalStaff}</span>
                  </div>
                  <div className="flex justify-between">
                    <span>Compliant:</span>
                    <span className="text-green-600 font-semibold">{dept.compliantStaff}</span>
                  </div>
                  <div className="flex justify-between">
                    <span>Pending:</span>
                    <span className="text-yellow-600 font-semibold">{dept.pendingDocuments}</span>
                  </div>
                  <div className="flex justify-between">
                    <span>Expired:</span>
                    <span className="text-red-600 font-semibold">{dept.expiredDocuments}</span>
                  </div>
                </div>
              </div>
            ))}
          </div>
        </Card>
      )}

      {/* Expiring Documents Alert */}
      {analytics.expiringSoon && analytics.expiringSoon.length > 0 && (
        <Card className="p-6 border-l-4 border-l-yellow-500">
          <div className="flex items-center gap-2 mb-4">
            <AlertTriangle className="h-5 w-5 text-yellow-600" />
            <h3 className="text-lg font-semibold text-yellow-800">Documents Expiring Soon</h3>
          </div>
          <div className="space-y-3">
            {analytics.expiringSoon.slice(0, 10).map((doc, index) => {
              const categoryInfo = doc.userType === 'guest'
                ? guestDocumentCategories[doc.category]
                : staffDocumentCategories[doc.category];
              const Icon = categoryInfo?.icon || FileText;

              return (
                <div key={`-${index}-${doc.category}`} className="flex items-center justify-between p-3 bg-yellow-50 rounded-lg">
                  <div className="flex items-center gap-3">
                    <Icon className="h-4 w-4 text-gray-600" />
                    <div>
                      <p className="font-medium">{doc.originalName}</p>
                      <p className="text-sm text-gray-600">
                        {doc.userId.firstName} {doc.userId.lastName} • {categoryInfo?.label}
                      </p>
                    </div>
                  </div>
                  <div className="text-right">
                    <p className={`font-semibold ${doc.daysUntilExpiry <= 3 ? 'text-red-600' : doc.daysUntilExpiry <= 7 ? 'text-orange-600' : 'text-yellow-600'}`}>
                      {doc.daysUntilExpiry} days
                    </p>
                    <p className="text-xs text-gray-500">
                      {formatDate(doc.expiresAt)}
                    </p>
                  </div>
                </div>
              );
            })}
            {analytics.expiringSoon.length > 10 && (
              <p className="text-sm text-gray-600 text-center">
                And {analytics.expiringSoon.length - 10} more documents expiring soon...
              </p>
            )}
          </div>
        </Card>
      )}

      {/* Recent Activity */}
      <Card className="p-6">
        <h3 className="text-lg font-semibold mb-4">Recent Activity</h3>
        <div className="space-y-3">
          {analytics.recentActivity.map((activity, index) => (
            <div key={`analytics-recentActivity-${index}`} className="flex items-center justify-between p-3 bg-gray-50 rounded-lg">
              <div className="flex items-center gap-3">
                <div className={`p-2 rounded-full ${
                  activity.action.includes('verified') ? 'bg-green-100' :
                  activity.action.includes('rejected') ? 'bg-red-100' :
                  activity.action.includes('uploaded') ? 'bg-blue-100' :
                  'bg-gray-100'
                }`}>
                  {activity.action.includes('verified') ? <CheckCircle className="h-4 w-4 text-green-600" /> :
                   activity.action.includes('rejected') ? <XCircle className="h-4 w-4 text-red-600" /> :
                   activity.action.includes('uploaded') ? <FileText className="h-4 w-4 text-blue-600" /> :
                   <RefreshCw className="h-4 w-4 text-gray-600" />}
                </div>
                <div>
                  <p className="font-medium">{activity.action}</p>
                  <p className="text-sm text-gray-600">
                    {activity.documentName} • by {activity.performedBy.firstName} {activity.performedBy.lastName}
                  </p>
                </div>
              </div>
              <div className="text-right">
                <Badge variant={activity.userType === 'guest' ? 'default' : 'secondary'}>
                  {activity.userType}
                </Badge>
                <p className="text-xs text-gray-500 mt-1">
                  {formatDate(activity.timestamp)}
                </p>
              </div>
            </div>
          ))}
        </div>
      </Card>
    </div>
  );
}

export default withErrorBoundary(AdminDocumentAnalytics, { level: 'page' });