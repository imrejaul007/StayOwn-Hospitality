import React, { useState, useEffect, useRef } from 'react';
import { useQuery, useMutation, useQueryClient, keepPreviousData } from '@tanstack/react-query';
import {
  Key,
  Plus,
  Search,
  Filter,
  Eye,
  Trash2,
  Ban,
  Clock,
  Users,
  Shield,
  BarChart3,
  Download,
  Share2,
  AlertTriangle,
  CheckCircle,
  XCircle,
  Calendar,
  MapPin,
  Building,
  User,
  X,
  RefreshCw
} from 'lucide-react';
import { digitalKeyService, DigitalKey, GenerateKeyRequest, AdminAnalytics } from '../../services/digitalKeyService';
import { bookingService } from '../../services/bookingService';
import { Booking } from '../../types/booking';
import { Card } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { LoadingSpinner } from '../../components/LoadingSpinner';
import { formatDate } from '../../utils/formatters';
import toast from 'react-hot-toast';
import { QRCodeSVG as QRCode } from 'qrcode.react';
import { useProperty } from '../../context/PropertyContext';
import { PropertyBreadcrumb } from '../../components/common/PropertyBreadcrumb';
import { withErrorBoundary } from '../../components/ErrorBoundary';
import { useRealTime } from '../../services/realTimeService';

interface AdminDigitalKeyManagementProps {}

function AdminDigitalKeyManagement({}: AdminDigitalKeyManagementProps) {
  const { selectedPropertyId, selectedProperty, primaryTenantHotelId } = useProperty();
  const propertyScopeId = selectedPropertyId || primaryTenantHotelId || '';
  const [activeTab, setActiveTab] = useState<'all-keys' | 'analytics' | 'logs'>('all-keys');
  const [searchTerm, setSearchTerm] = useState('');
  // Debounced search term — only triggers API calls after user stops typing for 400ms
  const [debouncedSearchTerm, setDebouncedSearchTerm] = useState('');
  const [statusFilter, setStatusFilter] = useState('');
  const [typeFilter, setTypeFilter] = useState('');
  const [currentPage, setCurrentPage] = useState(1);
  const [selectedKey, setSelectedKey] = useState<DigitalKey | null>(null);
  const [showGenerateModal, setShowGenerateModal] = useState(false);
  const [showDetailsModal, setShowDetailsModal] = useState(false);
  const [timeRange, setTimeRange] = useState('30d');

  const queryClient = useQueryClient();
  const { on, off } = useRealTime();

  // Real-time WebSocket listeners for digital key events
  useEffect(() => {
    const handleDigitalKeyEvent = () => {
      queryClient.invalidateQueries({ queryKey: ['admin-digital-keys'] });
      queryClient.invalidateQueries({ queryKey: ['admin-key-analytics'] });
      queryClient.invalidateQueries({ queryKey: ['admin-activity-logs'] });
    };
    on('digital-key:created', handleDigitalKeyEvent);
    on('digital-key:updated', handleDigitalKeyEvent);
    on('digital-key:shared', handleDigitalKeyEvent);
    on('digital-key:share-revoked', handleDigitalKeyEvent);
    return () => {
      off('digital-key:created', handleDigitalKeyEvent);
      off('digital-key:updated', handleDigitalKeyEvent);
      off('digital-key:shared', handleDigitalKeyEvent);
      off('digital-key:share-revoked', handleDigitalKeyEvent);
    };
  }, [on, off, queryClient]);

  // Debounce search input to avoid firing API request on every keystroke
  const debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  useEffect(() => {
    if (debounceRef.current) clearTimeout(debounceRef.current);
    debounceRef.current = setTimeout(() => {
      setDebouncedSearchTerm(searchTerm);
      setCurrentPage(1); // reset to first page on new search
    }, 400);
    return () => {
      if (debounceRef.current) clearTimeout(debounceRef.current);
    };
  }, [searchTerm]);

  // Fetch all digital keys (admin view)
  const { data: keysData, isLoading: keysLoading } = useQuery({
    queryKey: ['admin-digital-keys', propertyScopeId, currentPage, statusFilter, typeFilter, debouncedSearchTerm],
    queryFn: () => digitalKeyService.getAdminKeys({
      page: currentPage,
      status: statusFilter || undefined,
      type: typeFilter || undefined,
      hotel: propertyScopeId || undefined,
      search: debouncedSearchTerm || undefined
    }),
    enabled: !!propertyScopeId,
    placeholderData: keepPreviousData, // Keep prior page data visible while fetching next page
    staleTime: 30 * 1000 // 30 seconds
  });

  // Fetch analytics data
  const { data: analytics, isLoading: analyticsLoading } = useQuery({
    queryKey: ['admin-key-analytics', propertyScopeId, timeRange],
    queryFn: () => digitalKeyService.getAdminAnalytics(timeRange, propertyScopeId || undefined),
    enabled: activeTab === 'analytics' && !!propertyScopeId,
    staleTime: 5 * 60 * 1000
  });

  // Generate key mutation
  const generateKeyMutation = useMutation({
    mutationFn: (request: GenerateKeyRequest) =>
      digitalKeyService.generateKeyAsPropertyStaff({
        ...request,
        hotel: propertyScopeId || undefined
      }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['admin-digital-keys'] });
      queryClient.invalidateQueries({ queryKey: ['admin-key-analytics'] });
      queryClient.invalidateQueries({ queryKey: ['admin-activity-logs'] });
      queryClient.invalidateQueries({ queryKey: ['admin-eligible-bookings-for-keys'] });
      setShowGenerateModal(false);
      toast.success('Digital key generated successfully!');
    },
    onError: (error: unknown) => {
      const msg =
        error && typeof error === 'object' && 'response' in error
          ? (error as { response?: { data?: { message?: string } } }).response?.data?.message
          : undefined;
      toast.error(msg || 'Failed to generate key');
    }
  });

  // Revoke key mutation
  const revokeKeyMutation = useMutation({
    mutationFn: (keyId: string) =>
      digitalKeyService.revokeKeyAsPropertyStaff(keyId, propertyScopeId || undefined),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['admin-digital-keys'] });
      queryClient.invalidateQueries({ queryKey: ['admin-key-analytics'] });
      queryClient.invalidateQueries({ queryKey: ['admin-activity-logs'] });
      toast.success('Key revoked successfully!');
    },
    onError: (error: unknown) => {
      const msg =
        error && typeof error === 'object' && 'response' in error
          ? (error as { response?: { data?: { message?: string } } }).response?.data?.message
          : undefined;
      toast.error(msg || 'Failed to revoke key');
    }
  });

  // Search is handled server-side (passed as `search` param in the query).
  // Do not re-filter the current page client-side — that would incorrectly
  // reduce visible results when paginating.
  const filteredKeys = keysData?.keys || [];

  const handleGenerateKey = (formData: GenerateKeyRequest) => {
    generateKeyMutation.mutate(formData);
  };

  const handleRevokeKey = (keyId: string) => {
    if (window.confirm('Are you sure you want to revoke this key? This action cannot be undone.')) {
      revokeKeyMutation.mutate(keyId);
    }
  };

  const handleViewDetails = (key: DigitalKey) => {
    setSelectedKey(key);
    setShowDetailsModal(true);
  };

  const exportKeysData = async () => {
    if (!propertyScopeId) {
      toast.error('Please select a property first');
      return;
    }

    try {
      toast.loading('Preparing export...');

      const blob = await digitalKeyService.exportAdminKeys({
        status: statusFilter || undefined,
        type: typeFilter || undefined,
        hotel: propertyScopeId,
        format: 'csv'
      });

      // Create download link
      const url = window.URL.createObjectURL(blob);
      const link = document.createElement('a');
      link.href = url;
      link.download = `digital-keys-export-${new Date().toISOString().split('T')[0]}.csv`;
      document.body.appendChild(link);
      link.click();
      link.remove();
      window.URL.revokeObjectURL(url);

      toast.dismiss();
      toast.success('Export completed successfully!');
    } catch (error) {
      toast.dismiss();
      toast.error('Failed to export data. Please try again.');
    }
  };

  if (!propertyScopeId) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-gray-50 to-gray-100 flex items-center justify-center">
        <div className="text-center max-w-md px-4">
          <div className="text-6xl mb-4">🏨</div>
          <h2 className="text-2xl font-bold text-gray-900 mb-2">Property unavailable</h2>
          <p className="text-gray-600">
            Your account needs a hotel assignment or property selection. Open the property switcher in the header, or refresh after logging in.
          </p>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Breadcrumb */}
      <PropertyBreadcrumb items={['Digital Key Management']} />

      {/* Page Header */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <h1 className="text-2xl sm:text-3xl font-bold text-gray-900">Digital Key Management</h1>
          <p className="text-gray-600 mt-1 text-sm sm:text-base">Manage all digital room keys for {selectedProperty?.name || 'selected property'}</p>
        </div>
        <div className="flex flex-col sm:flex-row items-stretch sm:items-center gap-2 sm:gap-3">
          <Button
            variant="outline"
            onClick={exportKeysData}
            size="sm"
            className="flex items-center gap-2"
          >
            <Download className="w-4 h-4" />
            Export Data
          </Button>
          <Button
            onClick={() => setShowGenerateModal(true)}
            size="sm"
            className="flex items-center gap-2 bg-blue-600 hover:bg-blue-700 text-white"
          >
            <Plus className="w-4 h-4" />
            Generate New Key
          </Button>
        </div>
      </div>

      {/* Tabs */}
      <Card className="bg-white rounded-xl shadow-lg border border-gray-200">
        <div className="p-4 sm:p-6">
          <div className="flex items-center mb-4">
            <div className="p-2 sm:p-3 bg-gradient-to-br from-purple-500 to-indigo-600 rounded-xl shadow-md">
              <Key className="h-4 w-4 sm:h-5 sm:w-5 text-white" />
            </div>
            <h2 className="text-lg sm:text-xl font-bold text-gray-900 ml-3">Digital Key Management</h2>
          </div>
          
          <nav className="flex space-x-1 bg-gray-100 p-1 rounded-lg">
            {[
              { id: 'all-keys', label: 'All Keys', count: keysData?.pagination.totalItems || 0 },
              { id: 'analytics', label: 'Analytics' },
              { id: 'logs', label: 'Activity Logs' }
            ].map((tab) => (
              <button
                key={tab.id}
                onClick={() => setActiveTab(tab.id as 'all-keys' | 'analytics' | 'logs')}
                className={`flex-1 py-2 px-4 rounded-md font-medium text-sm transition-all duration-200 ${
                  activeTab === tab.id
                    ? 'bg-white text-blue-600 shadow-sm'
                    : 'text-gray-600 hover:text-gray-900 hover:bg-gray-50'
                }`}
              >
                <div className="flex items-center justify-center">
                  {tab.label}
                  {'count' in tab && tab.count > 0 && (
                    <span className="ml-2 bg-blue-100 text-blue-600 py-0.5 px-2 rounded-full text-xs">
                      {tab.count}
                    </span>
                  )}
                </div>
              </button>
            ))}
          </nav>
        </div>
      </Card>

      {/* All Keys Tab */}
      {activeTab === 'all-keys' && (
        <div className="space-y-6">
          {/* Filters */}
          <Card className="bg-white rounded-xl shadow-lg border border-gray-200 p-4 sm:p-6">
            <div className="flex items-center mb-4">
              <div className="p-2 sm:p-3 bg-gradient-to-br from-blue-500 to-purple-600 rounded-xl shadow-md">
                <Filter className="h-4 w-4 sm:h-5 sm:w-5 text-white" />
              </div>
              <h3 className="text-lg font-bold text-gray-900 ml-3">Filter Keys</h3>
            </div>
            
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
              {/* Search */}
              <div className="relative">
                <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400 h-4 w-4" />
                <Input
                  placeholder="Search keys, rooms..."
                  value={searchTerm}
                  onChange={(e) => setSearchTerm(e.target.value)}
                  className="pl-10 border-gray-300 focus:border-blue-500 focus:ring-blue-500"
                />
              </div>

              {/* Status Filter */}
              <select
                value={statusFilter}
                onChange={(e) => setStatusFilter(e.target.value)}
                className="border border-gray-300 rounded-lg px-3 py-2 focus:outline-none focus:ring-2 focus:ring-blue-500"
              >
                <option value="">All Status</option>
                <option value="active">Active</option>
                <option value="expired">Expired</option>
                <option value="revoked">Revoked</option>
                <option value="used">Used</option>
              </select>

              {/* Type Filter */}
              <select
                value={typeFilter}
                onChange={(e) => setTypeFilter(e.target.value)}
                className="border border-gray-300 rounded-lg px-3 py-2 focus:outline-none focus:ring-2 focus:ring-blue-500"
              >
                <option value="">All Types</option>
                <option value="primary">Primary</option>
                <option value="temporary">Temporary</option>
                <option value="emergency">Emergency</option>
              </select>

              {/* Clear Filters */}
              {(searchTerm || statusFilter || typeFilter) && (
                <Button
                  variant="outline"
                  onClick={() => {
                    setSearchTerm('');
                    setStatusFilter('');
                    setTypeFilter('');
                  }}
                >
                  Clear Filters
                </Button>
              )}
            </div>
          </Card>

          {/* Keys List */}
          {keysLoading ? (
            <div className="flex justify-center py-12">
              <LoadingSpinner />
            </div>
          ) : (
            <div className="space-y-4">
              {filteredKeys.length === 0 ? (
                <Card className="p-12 text-center">
                  <Key className="w-16 h-16 text-gray-300 mx-auto mb-4" />
                  <h3 className="text-xl font-semibold text-gray-900 mb-2">No digital keys found</h3>
                  <p className="text-gray-600 mb-6">
                    {searchTerm || statusFilter || typeFilter
                      ? 'Try adjusting your search or filters'
                      : 'Generate your first digital key to get started'
                    }
                  </p>
                  <Button onClick={() => setShowGenerateModal(true)}>
                    <Plus className="w-4 h-4 mr-2" />
                    Generate Key
                  </Button>
                </Card>
              ) : (
                filteredKeys.map((key) => (
                  <AdminKeyCard
                    key={key._id}
                    digitalKey={key}
                    onViewDetails={() => handleViewDetails(key)}
                    onRevoke={() => handleRevokeKey(key._id)}
                  />
                ))
              )}
            </div>
          )}

          {/* Pagination */}
          {keysData && keysData.pagination.totalPages > 1 && (
            <div className="flex justify-center items-center gap-2">
              <Button
                variant="outline"
                onClick={() => setCurrentPage(prev => Math.max(1, prev - 1))}
                disabled={!keysData.pagination.hasPrev}
              >
                Previous
              </Button>
              <span className="text-sm text-gray-600">
                Page {keysData.pagination.currentPage} of {keysData.pagination.totalPages}
              </span>
              <Button
                variant="outline"
                onClick={() => setCurrentPage(prev => prev + 1)}
                disabled={!keysData.pagination.hasNext}
              >
                Next
              </Button>
            </div>
          )}
        </div>
      )}

      {/* Analytics Tab */}
      {activeTab === 'analytics' && (
        <div className="space-y-6">
          {analyticsLoading ? (
            <div className="flex justify-center py-12">
              <LoadingSpinner />
            </div>
          ) : analytics ? (
            <>
              {/* Time Range Selector */}
              <div className="flex items-center justify-between">
                <h2 className="text-xl font-semibold text-gray-900">Analytics Dashboard</h2>
                <select
                  value={timeRange}
                  onChange={(e) => setTimeRange(e.target.value)}
                  className="border border-gray-300 rounded-lg px-3 py-2 focus:outline-none focus:ring-2 focus:ring-blue-500"
                >
                  <option value="7d">Last 7 days</option>
                  <option value="30d">Last 30 days</option>
                  <option value="90d">Last 90 days</option>
                  <option value="1y">Last year</option>
                </select>
              </div>

              {/* Overview Stats Cards */}
              <div className="grid grid-cols-1 md:grid-cols-3 lg:grid-cols-6 gap-4">
                <StatsCard
                  title="Total Keys"
                  value={analytics.overview.totalKeys}
                  icon={Key}
                  color="bg-blue-100 text-blue-600"
                />
                <StatsCard
                  title="Active Keys"
                  value={analytics.overview.activeKeys}
                  icon={CheckCircle}
                  color="bg-green-100 text-green-600"
                />
                <StatsCard
                  title="Expired Keys"
                  value={analytics.overview.expiredKeys}
                  icon={XCircle}
                  color="bg-red-100 text-red-600"
                />
                <StatsCard
                  title="Revoked Keys"
                  value={analytics.overview.revokedKeys}
                  icon={Ban}
                  color="bg-orange-100 text-orange-600"
                />
                <StatsCard
                  title="Total Uses"
                  value={analytics.overview.totalUses}
                  icon={BarChart3}
                  color="bg-purple-100 text-purple-600"
                />
                <StatsCard
                  title="Unique Users"
                  value={analytics.overview.uniqueUsers}
                  icon={Users}
                  color="bg-indigo-100 text-indigo-600"
                />
              </div>

              {/* Breakdown Charts */}
              <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
                {/* Keys by Type */}
                <Card className="p-6">
                  <h3 className="text-lg font-semibold text-gray-900 mb-4">Keys by Type</h3>
                  <div className="space-y-3">
                    {analytics.breakdowns.byType.map((type, index) => (
                      <div key={type._id} className="flex items-center justify-between">
                        <div className="flex items-center gap-3">
                          <div className="w-4 h-4 bg-blue-500 rounded" />
                          <span className="capitalize font-medium">{type._id}</span>
                        </div>
                        <span className="text-gray-600">{type.count}</span>
                      </div>
                    ))}
                  </div>
                </Card>

                {/* Keys by Hotel */}
                <Card className="p-6">
                  <h3 className="text-lg font-semibold text-gray-900 mb-4">Keys by Hotel</h3>
                  <div className="space-y-3">
                    {analytics.breakdowns.byHotel.map((hotel, index) => (
                      <div key={`analytics-breakdowns-byHotel-${index}`} className="flex items-center justify-between">
                        <div className="flex items-center gap-3">
                          <Building className="w-4 h-4 text-gray-400" />
                          <span className="font-medium">{hotel.hotelName}</span>
                        </div>
                        <span className="text-gray-600">{hotel.count}</span>
                      </div>
                    ))}
                  </div>
                </Card>
              </div>

              {/* Recent Activity & Top Users */}
              <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
                {/* Recent Activity */}
                <Card className="p-6">
                  <h3 className="text-lg font-semibold text-gray-900 mb-4">Recent Activity</h3>
                  <div className="space-y-3">
                    {analytics.activity.recent?.map((activity, index) => (
                      <div key={`activity-${index}`} className="flex items-center justify-between p-3 bg-gray-50 rounded-lg">
                        <div className="flex items-center gap-3">
                          <div className="w-8 h-8 bg-blue-100 rounded-full flex items-center justify-center">
                            <Key className="w-4 h-4 text-blue-600" />
                          </div>
                          <div>
                            <p className="font-medium text-gray-900">{activity.action}</p>
                            <p className="text-xs text-gray-600">
                              {activity.user.name} • {activity.hotel}
                            </p>
                          </div>
                        </div>
                        <span className="text-xs text-gray-500">
                          {digitalKeyService.formatTimeAgo(activity.timestamp)}
                        </span>
                      </div>
                    )) || (
                      <p className="text-gray-500 text-center py-8">No recent activity</p>
                    )}
                  </div>
                </Card>

                {/* Top Users */}
                <Card className="p-6">
                  <h3 className="text-lg font-semibold text-gray-900 mb-4">Top Users</h3>
                  <div className="space-y-3">
                    {analytics.activity.topUsers?.map((user, index) => (
                      <div key={`-${index}-${user.name}`} className="flex items-center justify-between p-3 bg-gray-50 rounded-lg">
                        <div className="flex items-center gap-3">
                          <div className="w-8 h-8 bg-green-100 rounded-full flex items-center justify-center">
                            <User className="w-4 h-4 text-green-600" />
                          </div>
                          <div>
                            <p className="font-medium text-gray-900">{user.name}</p>
                            <p className="text-xs text-gray-600">{user.email}</p>
                          </div>
                        </div>
                        <div className="text-right">
                          <p className="font-semibold text-gray-900">{user.keyCount} keys</p>
                          <p className="text-xs text-gray-600">{user.totalUses} uses</p>
                        </div>
                      </div>
                    )) || (
                      <p className="text-gray-500 text-center py-8">No user data</p>
                    )}
                  </div>
                </Card>
              </div>
            </>
          ) : null}
        </div>
      )}

      {/* Activity Logs Tab */}
      {activeTab === 'logs' && (
        <ActivityLogsTab
          timeRange={timeRange}
          setTimeRange={setTimeRange}
          hotelId={propertyScopeId}
        />
      )}

      {/* Generate Key Modal */}
      {showGenerateModal && (
        <AdminGenerateKeyModal
          hotelId={propertyScopeId}
          onClose={() => setShowGenerateModal(false)}
          onSubmit={handleGenerateKey}
          isLoading={generateKeyMutation.isPending}
        />
      )}

      {/* Key Details Modal */}
      {showDetailsModal && selectedKey && (
        <KeyDetailsModal
          digitalKey={selectedKey}
          onClose={() => setShowDetailsModal(false)}
        />
      )}
    </div>
  );
}

// Admin Key Card Component
interface AdminKeyCardProps {
  digitalKey: DigitalKey;
  onViewDetails: () => void;
  onRevoke: () => void;
}

function AdminKeyCard({ digitalKey, onViewDetails, onRevoke }: AdminKeyCardProps) {
  const typeInfo = digitalKeyService.getKeyTypeInfo(digitalKey.type);
  const statusInfo = digitalKeyService.getStatusInfo(digitalKey.status);
  const expirationStatus = digitalKeyService.getExpirationStatus(digitalKey);

  return (
    <Card className="p-6">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-4">
          {/* QR Code */}
          <div className="w-16 h-16">
            <QRCode
              value={digitalKey.qrCode}
              size={64}
              level="M"
              includeMargin={false}
            />
          </div>

          {/* Key Info */}
          <div>
            <div className="flex items-center gap-3 mb-2">
              <h3 className="text-lg font-semibold text-gray-900">
                Room {digitalKey.roomId.number}
              </h3>
              <span className={`px-2 py-1 rounded-full text-xs font-medium ${typeInfo.color}`}>
                {typeInfo.label}
              </span>
              <span className={`px-2 py-1 rounded-full text-xs font-medium ${statusInfo.color}`}>
                {statusInfo.label}
              </span>
              {expirationStatus === 'expiring' && (
                <span className="px-2 py-1 rounded-full text-xs font-medium bg-yellow-100 text-yellow-800">
                  Expiring Soon
                </span>
              )}
            </div>

            <div className="grid grid-cols-2 md:grid-cols-4 gap-4 text-sm">
              <div>
                <span className="text-gray-500">Hotel:</span>
                <p className="font-medium">{digitalKey.hotelId.name}</p>
              </div>
              <div>
                <span className="text-gray-500">Key Code:</span>
                <p className="font-mono font-medium">{digitalKey.keyCode}</p>
              </div>
              <div>
                <span className="text-gray-500">Booking:</span>
                <p className="font-medium">{digitalKey.bookingId?.bookingNumber || 'N/A'}</p>
              </div>
              <div>
                <span className="text-gray-500">Uses:</span>
                <p className="font-medium">
                  {digitalKey.currentUses} / {digitalKeyService.formatRemainingUses(digitalKey.remainingUses)}
                </p>
              </div>
            </div>
          </div>
        </div>

        {/* Actions */}
        <div className="flex items-center gap-2">
          <Button
            variant="outline"
            size="sm"
            onClick={onViewDetails}
            className="flex items-center gap-2"
          >
            <Eye className="w-4 h-4" />
            Details
          </Button>
          {digitalKeyService.canRevokeKey(digitalKey) && (
            <Button
              variant="outline"
              size="sm"
              onClick={onRevoke}
              className="flex items-center gap-2 text-red-600 hover:text-red-700 border-red-200 hover:border-red-300"
            >
              <Ban className="w-4 h-4" />
              Revoke
            </Button>
          )}
        </div>
      </div>
    </Card>
  );
}

// Stats Card Component
interface StatsCardProps {
  title: string;
  value: number;
  icon: React.ComponentType<{ className?: string }>;
  color: string;
}

function StatsCard({ title, value, icon: Icon, color }: StatsCardProps) {
  return (
    <Card className="p-6">
      <div className="flex items-center justify-between">
        <div>
          <p className="text-sm font-medium text-gray-600">{title}</p>
          <p className="text-3xl font-bold text-gray-900">{value}</p>
        </div>
        <div className={`p-3 rounded-full ${color}`}>
          <Icon className="w-6 h-6" />
        </div>
      </div>
    </Card>
  );
}

// Admin Generate Key Modal
interface AdminGenerateKeyModalProps {
  hotelId: string;
  onClose: () => void;
  onSubmit: (data: GenerateKeyRequest) => void;
  isLoading: boolean;
}

function AdminGenerateKeyModal({ hotelId, onClose, onSubmit, isLoading }: AdminGenerateKeyModalProps) {
  const [formData, setFormData] = useState<GenerateKeyRequest>({
    bookingId: '',
    type: 'primary',
    maxUses: -1,
    securitySettings: {
      requirePin: false,
      allowSharing: true,
      maxSharedUsers: 5,
      requireApproval: false
    }
  });

  const [selectedBooking, setSelectedBooking] = useState<Booking | null>(null);

  // For admin, fetch all eligible bookings (admin has access to all bookings)
  const { data: bookingsData, isLoading: bookingsLoading } = useQuery({
    queryKey: ['admin-eligible-bookings-for-keys', hotelId],
    queryFn: async () => {
      const response = await bookingService.getBookings({
        status: 'confirmed,checked_in',
        limit: 100,
        page: 1,
        hotelId
      });
      const bookingsData = response.data?.bookings || response.data || [];
      // Filter for eligible bookings (confirmed/checked-in and not expired)
      return Array.isArray(bookingsData) ? bookingsData.filter((booking: Booking) => 
        ['confirmed', 'checked_in'].includes(booking.status) && 
        new Date(booking.checkOut) > new Date()
      ) : [];
    },
    enabled: !!hotelId,
    staleTime: 5 * 60 * 1000
  });

  const handleBookingSelect = (bookingId: string) => {
    const booking = bookingsData?.find((b: Booking) => b._id === bookingId);
    setSelectedBooking(booking || null);
    setFormData(prev => ({ ...prev, bookingId }));
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!formData.bookingId) {
      toast.error('Please select a booking');
      return;
    }
    onSubmit(formData);
  };

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
      <Card className="w-full max-w-2xl p-6 max-h-[90vh] overflow-y-auto">
        <div className="flex justify-between items-center mb-4">
          <h2 className="text-xl font-semibold text-gray-900">Generate Digital Key</h2>
          <Button variant="ghost" size="sm" onClick={onClose}>
            <X className="w-4 h-4" />
          </Button>
        </div>

        <form onSubmit={handleSubmit} className="space-y-4">
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              Select Booking *
            </label>
            {bookingsLoading ? (
              <div className="flex items-center justify-center py-4">
                <LoadingSpinner />
              </div>
            ) : bookingsData && bookingsData.length > 0 ? (
              <select
                value={formData.bookingId}
                onChange={(e) => handleBookingSelect(e.target.value)}
                className="w-full border border-gray-300 rounded-md px-3 py-2"
                required
              >
                <option value="">Select a booking...</option>
                {bookingsData.map((booking: Booking) => (
                  <option key={booking._id} value={booking._id}>
                    {booking.bookingNumber} - Room {booking.rooms[0]?.roomId?.roomNumber || 'N/A'} 
                    ({booking.guestDetails.firstName} {booking.guestDetails.lastName})
                    - {formatDate(booking.checkIn)} to {formatDate(booking.checkOut)}
                  </option>
                ))}
              </select>
            ) : (
              <div className="text-center py-4 text-gray-500">
                <p>No eligible bookings found</p>
                <p className="text-xs mt-1">No confirmed bookings available for digital key generation</p>
              </div>
            )}
            <p className="text-xs text-gray-500 mt-1">
              Select from confirmed bookings that are eligible for digital key generation
            </p>
          </div>

          {/* Show selected booking details */}
          {selectedBooking && (
            <div className="bg-blue-50 border border-blue-200 rounded-lg p-4">
              <h4 className="font-medium text-blue-900 mb-2">Selected Booking Details</h4>
              <div className="text-sm text-blue-800 space-y-1">
                <div className="grid grid-cols-2 gap-2">
                  <p><strong>Booking:</strong> {selectedBooking.bookingNumber}</p>
                  <p><strong>Status:</strong> <span className="capitalize">{selectedBooking.status}</span></p>
                  <p><strong>Guest:</strong> {selectedBooking.guestDetails.firstName} {selectedBooking.guestDetails.lastName}</p>
                  <p><strong>Email:</strong> {selectedBooking.guestDetails.email}</p>
                  <p><strong>Room:</strong> {selectedBooking.rooms[0]?.roomId?.roomNumber || 'N/A'} - {selectedBooking.rooms[0]?.roomId?.type || 'Standard'}</p>
                  <p><strong>Dates:</strong> {formatDate(selectedBooking.checkIn)} to {formatDate(selectedBooking.checkOut)}</p>
                </div>
              </div>
            </div>
          )}

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              Key Type
            </label>
            <select
              value={formData.type}
              onChange={(e) => setFormData(prev => ({ ...prev, type: e.target.value as string }))}
              className="w-full border border-gray-300 rounded-lg px-3 py-2 focus:outline-none focus:ring-2 focus:ring-blue-500"
            >
              <option value="primary">Primary Key</option>
              <option value="temporary">Temporary Key</option>
              <option value="emergency">Emergency Key</option>
            </select>
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              Max Uses
            </label>
            <Input
              type="number"
              value={formData.maxUses}
              onChange={(e) => setFormData(prev => ({ ...prev, maxUses: parseInt(e.target.value) }))}
              min="-1"
            />
            <p className="text-xs text-gray-500 mt-1">
              -1 for unlimited uses, or specify a positive number
            </p>
          </div>

          <div className="space-y-3">
            <h3 className="text-sm font-medium text-gray-700">Security Settings</h3>
            
            <label className="flex items-center space-x-2">
              <input
                type="checkbox"
                checked={formData.securitySettings?.allowSharing || false}
                onChange={(e) => setFormData(prev => ({
                  ...prev,
                  securitySettings: {
                    ...prev.securitySettings,
                    allowSharing: e.target.checked
                  }
                }))}
                className="rounded"
              />
              <span className="text-sm text-gray-700">Allow sharing with other users</span>
            </label>

            <label className="flex items-center space-x-2">
              <input
                type="checkbox"
                checked={formData.securitySettings?.requireApproval || false}
                onChange={(e) => setFormData(prev => ({
                  ...prev,
                  securitySettings: {
                    ...prev.securitySettings,
                    requireApproval: e.target.checked
                  }
                }))}
                className="rounded"
              />
              <span className="text-sm text-gray-700">Require admin approval for sharing</span>
            </label>
          </div>

          <div className="flex justify-end gap-3 pt-4">
            <Button
              type="button"
              variant="outline"
              onClick={onClose}
              disabled={isLoading}
            >
              Cancel
            </Button>
            <Button
              type="submit"
              disabled={isLoading}
              className="bg-blue-600 hover:bg-blue-700"
            >
              {isLoading ? (
                <>
                  <RefreshCw className="w-4 h-4 mr-2 animate-spin" />
                  Generating...
                </>
              ) : (
                'Generate Key'
              )}
            </Button>
          </div>
        </form>
      </Card>
    </div>
  );
}

// Key Details Modal
interface KeyDetailsModalProps {
  digitalKey: DigitalKey;
  onClose: () => void;
}

function KeyDetailsModal({ digitalKey, onClose }: KeyDetailsModalProps) {
  const typeInfo = digitalKeyService.getKeyTypeInfo(digitalKey.type);
  const statusInfo = digitalKeyService.getStatusInfo(digitalKey.status);

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
      <Card className="w-full max-w-4xl max-h-[90vh] overflow-y-auto p-6">
        <div className="flex justify-between items-center mb-6">
          <h2 className="text-xl font-semibold text-gray-900">Digital Key Details</h2>
          <Button variant="ghost" size="sm" onClick={onClose}>
            <X className="w-5 h-5" />
          </Button>
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          {/* Key Information */}
          <div className="lg:col-span-2 space-y-6">
            {/* Basic Info */}
            <div>
              <h3 className="text-lg font-semibold text-gray-900 mb-4">Basic Information</h3>
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="text-sm text-gray-500">Room Number</label>
                  <p className="font-medium text-gray-900">{digitalKey.roomId.number}</p>
                </div>
                <div>
                  <label className="text-sm text-gray-500">Hotel</label>
                  <p className="font-medium text-gray-900">{digitalKey.hotelId.name}</p>
                </div>
                <div>
                  <label className="text-sm text-gray-500">Key Code</label>
                  <p className="font-mono font-medium text-gray-900">{digitalKey.keyCode}</p>
                </div>
                <div>
                  <label className="text-sm text-gray-500">Booking Number</label>
                  <p className="font-medium text-gray-900">{digitalKey.bookingId?.bookingNumber || 'N/A'}</p>
                </div>
              </div>
            </div>

            {/* Status & Validity */}
            <div>
              <h3 className="text-lg font-semibold text-gray-900 mb-4">Status & Validity</h3>
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="text-sm text-gray-500">Type</label>
                  <span className={`inline-flex px-2 py-1 rounded-full text-xs font-medium ${typeInfo.color}`}>
                    {typeInfo.label}
                  </span>
                </div>
                <div>
                  <label className="text-sm text-gray-500">Status</label>
                  <span className={`inline-flex px-2 py-1 rounded-full text-xs font-medium ${statusInfo.color}`}>
                    {statusInfo.label}
                  </span>
                </div>
                <div>
                  <label className="text-sm text-gray-500">Valid From</label>
                  <p className="font-medium text-gray-900">
                    {new Date(digitalKey.validFrom).toLocaleString()}
                  </p>
                </div>
                <div>
                  <label className="text-sm text-gray-500">Valid Until</label>
                  <p className="font-medium text-gray-900">
                    {new Date(digitalKey.validUntil).toLocaleString()}
                  </p>
                </div>
              </div>
            </div>

            {/* Usage Information */}
            <div>
              <h3 className="text-lg font-semibold text-gray-900 mb-4">Usage Information</h3>
              <div className="grid grid-cols-3 gap-4">
                <div>
                  <label className="text-sm text-gray-500">Current Uses</label>
                  <p className="font-medium text-gray-900">{digitalKey.currentUses}</p>
                </div>
                <div>
                  <label className="text-sm text-gray-500">Max Uses</label>
                  <p className="font-medium text-gray-900">
                    {digitalKeyService.formatRemainingUses(digitalKey.maxUses === -1 ? 'unlimited' : digitalKey.maxUses)}
                  </p>
                </div>
                <div>
                  <label className="text-sm text-gray-500">Last Used</label>
                  <p className="font-medium text-gray-900">
                    {digitalKey.lastUsedAt 
                      ? digitalKeyService.formatTimeAgo(digitalKey.lastUsedAt)
                      : 'Never'
                    }
                  </p>
                </div>
              </div>
            </div>

            {/* Shared Users */}
            {digitalKey.sharedWith && digitalKey.sharedWith.length > 0 && (
              <div>
                <h3 className="text-lg font-semibold text-gray-900 mb-4">Shared With</h3>
                <div className="space-y-2">
                  {digitalKey.sharedWith.map((share, index) => (
                    <div key={`digitalKey-sharedWith-${index}-${share.name}`} className="flex justify-between items-center p-3 bg-gray-50 rounded-lg">
                      <div>
                        <p className="font-medium text-gray-900">{share.name}</p>
                        <p className="text-sm text-gray-600">{share.email}</p>
                      </div>
                      <div className="text-right">
                        <p className="text-sm text-gray-500">
                          Shared {digitalKeyService.formatTimeAgo(share.sharedAt)}
                        </p>
                        {share.expiresAt && (
                          <p className="text-sm text-gray-500">
                            Expires {new Date(share.expiresAt).toLocaleDateString()}
                          </p>
                        )}
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            )}
          </div>

          {/* QR Code & Actions */}
          <div className="space-y-6">
            {/* QR Code */}
            <div className="text-center">
              <h3 className="text-lg font-semibold text-gray-900 mb-4">QR Code</h3>
              <div className="bg-white p-4 rounded-lg border inline-block">
                <QRCode
                  value={digitalKey.qrCode}
                  size={200}
                  level="M"
                  includeMargin={true}
                />
              </div>
            </div>

            {/* Security Settings */}
            <div>
              <h3 className="text-lg font-semibold text-gray-900 mb-4">Security Settings</h3>
              <div className="space-y-2">
                <div className="flex justify-between">
                  <span className="text-sm text-gray-600">Sharing Allowed</span>
                  <span className="text-sm font-medium">
                    {digitalKey.securitySettings?.allowSharing ? 'Yes' : 'No'}
                  </span>
                </div>
                <div className="flex justify-between">
                  <span className="text-sm text-gray-600">PIN Required</span>
                  <span className="text-sm font-medium">
                    {digitalKey.securitySettings?.requirePin ? 'Yes' : 'No'}
                  </span>
                </div>
                <div className="flex justify-between">
                  <span className="text-sm text-gray-600">Approval Required</span>
                  <span className="text-sm font-medium">
                    {digitalKey.securitySettings?.requireApproval ? 'Yes' : 'No'}
                  </span>
                </div>
              </div>
            </div>

            {/* Metadata */}
            <div>
              <h3 className="text-lg font-semibold text-gray-900 mb-4">Metadata</h3>
              <div className="space-y-2 text-sm">
                <div>
                  <span className="text-gray-600">Created:</span>
                  <p className="font-medium">{new Date(digitalKey.createdAt).toLocaleString()}</p>
                </div>
                <div>
                  <span className="text-gray-600">Updated:</span>
                  <p className="font-medium">{new Date(digitalKey.updatedAt).toLocaleString()}</p>
                </div>
                {digitalKey.metadata?.generatedBy && (
                  <div>
                    <span className="text-gray-600">Generated By:</span>
                    <p className="font-medium">{digitalKey.metadata.generatedBy}</p>
                  </div>
                )}
              </div>
            </div>
          </div>
        </div>
      </Card>
    </div>
  );
}

// Activity Logs Tab Component
interface ActivityLogsTabProps {
  timeRange: string;
  setTimeRange: (range: string) => void;
  hotelId?: string;
}

function ActivityLogsTab({ timeRange, setTimeRange, hotelId }: ActivityLogsTabProps) {
  const [actionFilter, setActionFilter] = useState('');
  const [userFilter, setUserFilter] = useState('');
  const [currentPage, setCurrentPage] = useState(1);

  const { data: logsData, isLoading } = useQuery({
    queryKey: ['admin-activity-logs', hotelId, currentPage, actionFilter, userFilter, timeRange],
    queryFn: () => digitalKeyService.getAdminActivityLogs({
      page: currentPage,
      limit: 20,
      action: actionFilter || undefined,
      userId: userFilter || undefined,
      timeRange,
      hotelId: hotelId || undefined
    }),
    enabled: !!hotelId,
    staleTime: 30 * 1000
  });

  const getActionIcon = (action: string) => {
    switch (action) {
      case 'generated':
        return <Plus className="w-4 h-4 text-green-600" />;
      case 'accessed':
        return <Key className="w-4 h-4 text-blue-600" />;
      case 'shared':
        return <Share2 className="w-4 h-4 text-purple-600" />;
      case 'revoked':
        return <Ban className="w-4 h-4 text-red-600" />;
      case 'expired':
        return <Clock className="w-4 h-4 text-orange-600" />;
      default:
        return <AlertTriangle className="w-4 h-4 text-gray-600" />;
    }
  };

  const getActionColor = (action: string) => {
    switch (action) {
      case 'generated':
        return 'bg-green-100 text-green-800';
      case 'accessed':
        return 'bg-blue-100 text-blue-800';
      case 'shared':
        return 'bg-purple-100 text-purple-800';
      case 'revoked':
        return 'bg-red-100 text-red-800';
      case 'expired':
        return 'bg-orange-100 text-orange-800';
      default:
        return 'bg-gray-100 text-gray-800';
    }
  };

  return (
    <Card className="p-6">
      <div className="flex justify-between items-center mb-6">
        <h3 className="text-lg font-semibold text-gray-900">System Activity Logs</h3>
        <div className="flex items-center gap-4">
          {/* Time Range Filter */}
          <select
            value={timeRange}
            onChange={(e) => setTimeRange(e.target.value)}
            className="px-3 py-1.5 border border-gray-300 rounded-md text-sm"
          >
            <option value="1d">Last 24 Hours</option>
            <option value="7d">Last 7 Days</option>
            <option value="30d">Last 30 Days</option>
            <option value="90d">Last 90 Days</option>
          </select>

          {/* Action Filter */}
          <select
            value={actionFilter}
            onChange={(e) => setActionFilter(e.target.value)}
            className="px-3 py-1.5 border border-gray-300 rounded-md text-sm"
          >
            <option value="">All Actions</option>
            <option value="generated">Generated</option>
            <option value="accessed">Accessed</option>
            <option value="shared">Shared</option>
            <option value="revoked">Revoked</option>
            <option value="expired">Expired</option>
          </select>
        </div>
      </div>

      {isLoading ? (
        <div className="flex justify-center py-8">
          <LoadingSpinner size="lg" />
        </div>
      ) : logsData?.logs.length ? (
        <div className="space-y-4">
          {/* Activity Log Items */}
          {logsData.logs.map((log: Record<string, unknown>) => (
            <div key={log._id} className="border border-gray-200 rounded-lg p-4 hover:bg-gray-50">
              <div className="flex items-start justify-between">
                <div className="flex items-start gap-3">
                  <div className="flex-shrink-0 mt-1">
                    {getActionIcon(log.action)}
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 mb-1">
                      <span className={`px-2 py-1 text-xs font-medium rounded-full ${getActionColor(log.action)}`}>
                        {log.action.charAt(0).toUpperCase() + log.action.slice(1)}
                      </span>
                      <span className="text-sm text-gray-600">
                        {formatDate(log.timestamp)}
                      </span>
                    </div>

                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4 text-sm">
                      <div>
                        <p className="text-gray-900">
                          <span className="font-medium">Key:</span> {log.keyCode}
                          <span className="ml-2 text-gray-500">({log.keyType})</span>
                        </p>
                        {log.actor && (
                          <p className="text-gray-600">
                            <span className="font-medium">Actor:</span> {log.actor.name} ({log.actor.email})
                            <span className="ml-1 px-1.5 py-0.5 text-xs bg-gray-200 text-gray-700 rounded">
                              {log.actor.role}
                            </span>
                          </p>
                        )}
                        {log.keyOwner && (
                          <p className="text-gray-600">
                            <span className="font-medium">Key Owner:</span> {log.keyOwner.name}
                          </p>
                        )}
                      </div>

                      <div>
                        {log.room && (
                          <p className="text-gray-600">
                            <span className="font-medium">Room:</span> {log.room.roomNumber}
                            {log.room.floor && ` (Floor ${log.room.floor})`}
                          </p>
                        )}
                        {log.hotel && (
                          <p className="text-gray-600">
                            <span className="font-medium">Hotel:</span> {log.hotel.name}
                          </p>
                        )}
                        {log.deviceInfo && (
                          <div className="text-xs text-gray-500 mt-1">
                            <p>
                              <span className="font-medium">Device:</span> {log.deviceInfo.userAgent}
                            </p>
                            {log.deviceInfo.location && (
                              <p>
                                <MapPin className="w-3 h-3 inline mr-1" />
                                {log.deviceInfo.location}
                              </p>
                            )}
                          </div>
                        )}
                      </div>
                    </div>
                  </div>
                </div>
              </div>
            </div>
          ))}

          {/* Pagination */}
          {logsData.pagination.totalPages > 1 && (
            <div className="flex justify-between items-center pt-4 border-t border-gray-200">
              <p className="text-sm text-gray-600">
                Showing {((currentPage - 1) * 20) + 1} to {Math.min(currentPage * 20, logsData.pagination.totalItems)} of {logsData.pagination.totalItems} activities
              </p>
              <div className="flex gap-2">
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => setCurrentPage(currentPage - 1)}
                  disabled={!logsData.pagination.hasPrev}
                >
                  Previous
                </Button>
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => setCurrentPage(currentPage + 1)}
                  disabled={!logsData.pagination.hasNext}
                >
                  Next
                </Button>
              </div>
            </div>
          )}
        </div>
      ) : (
        <div className="text-center py-8">
          <Clock className="w-12 h-12 text-gray-400 mx-auto mb-3" />
          <p className="text-gray-600">No activity logs found for the selected filters.</p>
        </div>
      )}
    </Card>
  );
}

export default withErrorBoundary(AdminDigitalKeyManagement, { level: 'page' });