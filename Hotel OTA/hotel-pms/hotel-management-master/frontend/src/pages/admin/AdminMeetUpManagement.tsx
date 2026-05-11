import React, { useState, useEffect, useRef } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import {
  Users,
  Search,
  Filter,
  Eye,
  Ban,
  Clock,
  BarChart3,
  Download,
  MapPin,
  Building,
  User,
  X,
  RefreshCw,
  AlertTriangle,
  CheckCircle,
  XCircle,
  TrendingUp,
  Activity,
  FileText
} from 'lucide-react';
import { useProperty } from '../../context/PropertyContext';
import { PropertyBreadcrumb } from '../../components/common/PropertyBreadcrumb';
import { useRealTime } from '../../services/realTimeService';
import {
  meetUpRequestService,
  MeetUpRequest,
  MeetUpRequestsResponse,
  AdminAnalytics,
  AdminInsights,
  GuestMeetUpReportRow
} from '../../services/meetUpRequestService';
import { Card } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { LoadingSpinner } from '../../components/LoadingSpinner';
import { formatDate } from '../../utils/formatters';
import { format } from 'date-fns';
import toast from 'react-hot-toast';
import { withErrorBoundary } from '../../components/ErrorBoundary';

interface AdminMeetUpManagementProps {}

function AdminMeetUpManagement({}: AdminMeetUpManagementProps) {
  const { selectedPropertyId, selectedProperty, viewMode } = useProperty();
  const [activeTab, setActiveTab] = useState<'all-meetups' | 'analytics' | 'insights' | 'guest-reports'>('all-meetups');
  const [reportPage, setReportPage] = useState(1);
  const [reportStatusFilter, setReportStatusFilter] = useState('');
  const [searchTerm, setSearchTerm] = useState('');
  const [statusFilter, setStatusFilter] = useState('');
  const [typeFilter, setTypeFilter] = useState('');
  const [dateFromFilter, setDateFromFilter] = useState('');
  const [dateToFilter, setDateToFilter] = useState('');
  const [currentPage, setCurrentPage] = useState(1);
  const [selectedMeetUp, setSelectedMeetUp] = useState<MeetUpRequest | null>(null);
  const [showDetailsModal, setShowDetailsModal] = useState(false);
  const [showCancelModal, setShowCancelModal] = useState(false);
  const [timeRange, setTimeRange] = useState('30d');
  const [isExporting, setIsExporting] = useState(false);
  const [showExportDropdown, setShowExportDropdown] = useState(false);
  const exportDropdownRef = useRef<HTMLDivElement>(null);

  const queryClient = useQueryClient();
  const { on, off } = useRealTime();

  // Real-time: listen for meetup events to refresh data immediately
  useEffect(() => {
    const handleMeetUpEvent = () => {
      queryClient.invalidateQueries({ queryKey: ['admin-meetups'] });
      queryClient.invalidateQueries({ queryKey: ['admin-meetup-analytics'] });
      queryClient.invalidateQueries({ queryKey: ['admin-meetup-insights'] });
      queryClient.invalidateQueries({ queryKey: ['admin-guest-meetup-reports'] });
    };
    on('meetup:updated', handleMeetUpEvent);
    on('meetup:supervision-updated', handleMeetUpEvent);
    return () => {
      off('meetup:updated', handleMeetUpEvent);
      off('meetup:supervision-updated', handleMeetUpEvent);
    };
  }, [on, off, queryClient]);

  // Fetch all meet-up requests (admin view)
  const { data: meetUpsData, isLoading: meetUpsLoading, isError: meetUpsError } = useQuery({
    queryKey: ['admin-meetups', selectedPropertyId, currentPage, statusFilter, typeFilter, searchTerm, dateFromFilter, dateToFilter],
    queryFn: () => meetUpRequestService.getAdminAllMeetUps({
      page: currentPage,
      limit: 20,
      status: statusFilter || undefined,
      type: typeFilter || undefined,
      hotelId: selectedPropertyId || undefined,
      search: searchTerm || undefined,
      dateFrom: dateFromFilter || undefined,
      dateTo: dateToFilter || undefined
    }),
    enabled: !!selectedPropertyId,
    staleTime: 30 * 1000
  });

  // Fetch analytics data
  const { data: analytics, isLoading: analyticsLoading } = useQuery({
    queryKey: ['admin-meetup-analytics', selectedPropertyId, timeRange],
    queryFn: () => meetUpRequestService.getAdminAnalytics({
      period: timeRange,
      hotelId: selectedPropertyId || undefined
    }),
    enabled: activeTab === 'analytics' && !!selectedPropertyId,
    staleTime: 5 * 60 * 1000
  });

  // Fetch insights data
  const { data: insights, isLoading: insightsLoading } = useQuery({
    queryKey: ['admin-meetup-insights', selectedPropertyId],
    queryFn: () => meetUpRequestService.getAdminInsights({
      hotelId: selectedPropertyId || undefined
    }),
    enabled: activeTab === 'insights' && !!selectedPropertyId,
    staleTime: 5 * 60 * 1000
  });

  const { data: guestReportsData, isLoading: guestReportsLoading } = useQuery({
    queryKey: ['admin-guest-meetup-reports', selectedPropertyId, reportPage, reportStatusFilter],
    queryFn: () =>
      meetUpRequestService.getAdminGuestMeetupReports({
        hotelId: selectedPropertyId || undefined,
        page: reportPage,
        limit: 20,
        status: reportStatusFilter || undefined
      }),
    enabled: activeTab === 'guest-reports' && !!selectedPropertyId,
    staleTime: 30 * 1000
  });

  // Force cancel mutation
  const forceCancelMutation = useMutation({
    mutationFn: ({ requestId, reason }: { requestId: string; reason?: string }) => 
      meetUpRequestService.adminForceCancel(requestId, reason),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['admin-meetups'] });
      queryClient.invalidateQueries({ queryKey: ['admin-meetup-analytics'] });
      queryClient.invalidateQueries({ queryKey: ['admin-meetup-insights'] });
      setShowCancelModal(false);
      setSelectedMeetUp(null);
      toast.success('Meet-up request cancelled successfully!');
    },
    onError: (error: unknown) => {
      const axiosError = error as { response?: { data?: { message?: string } } };
      toast.error(axiosError.response?.data?.message || 'Failed to cancel meet-up request');
    }
  });

  const handleViewDetails = (meetUp: MeetUpRequest) => {
    setSelectedMeetUp(meetUp);
    setShowDetailsModal(true);
  };

  const handleForceCancel = (meetUp: MeetUpRequest) => {
    setSelectedMeetUp(meetUp);
    setShowCancelModal(true);
  };

  const handleClearFilters = () => {
    setSearchTerm('');
    setStatusFilter('');
    setTypeFilter('');
    setDateFromFilter('');
    setDateToFilter('');
    setCurrentPage(1);
  };

  // Close dropdown when clicking outside
  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (exportDropdownRef.current && !exportDropdownRef.current.contains(event.target as Node)) {
        setShowExportDropdown(false);
      }
    };

    document.addEventListener('mousedown', handleClickOutside);
    return () => {
      document.removeEventListener('mousedown', handleClickOutside);
    };
  }, []);

  if (!selectedPropertyId && viewMode === 'single') {
    return <div className="p-6">Please select a property</div>;
  }

  const exportToCSV = async () => {
    if (!meetUpsData || meetUpsData.meetUps.length === 0) {
      toast.error('No meet-up data to export');
      return;
    }

    setIsExporting(true);
    try {
      // Prepare CSV headers
      const headers = [
        'ID',
        'Title',
        'Description',
        'Type',
        'Status',
        'Requester Name',
        'Requester Email',
        'Target User Name',
        'Target User Email',
        'Hotel',
        'Proposed Date',
        'Proposed Time',
        'Location Type',
        'Location Name',
        'Location Details',
        'Activity Type',
        'Activity Duration (min)',
        'Activity Cost',
        'Cost Sharing',
        'Max Participants',
        'Confirmed Participants',
        'Safety - Verified Only',
        'Safety - Public Location',
        'Safety - Hotel Staff Present',
        'Response Status',
        'Response Message',
        'Response Date',
        'Created Date',
        'Updated Date'
      ];

      // Prepare CSV data
      const csvData = meetUpsData.meetUps.map(meetUp => [
        meetUp._id,
        meetUp.title,
        (meetUp.description || '').replace(/"/g, '""'), // Escape quotes
        meetUp.type,
        meetUp.status,
        meetUp.requesterId?.name || 'Unknown',
        meetUp.requesterId?.email || '',
        meetUp.targetUserId?.name || 'Unknown',
        meetUp.targetUserId?.email || '',
        meetUp.hotelId?.name || 'Unknown Hotel',
        formatDate(meetUp.proposedDate),
        `${meetUp.proposedTime?.start || ''} - ${meetUp.proposedTime?.end || ''}`,
        meetUp.location?.type || '',
        meetUp.location?.name || '',
        meetUp.location?.details || '',
        meetUp.activity?.type || 'N/A',
        meetUp.activity?.duration || 0,
        meetUp.activity?.cost || 0,
        meetUp.activity?.costSharing ? 'Yes' : 'No',
        meetUp.participants.maxParticipants,
        meetUp.participantCount,
        meetUp.safety?.verifiedOnly ? 'Yes' : 'No',
        meetUp.safety?.publicLocation ? 'Yes' : 'No',
        meetUp.safety?.hotelStaffPresent ? 'Yes' : 'No',
        meetUp.response?.status || 'pending',
        meetUp.response?.message || '',
        meetUp.response?.respondedAt ? new Date(meetUp.response.respondedAt).toLocaleString() : '',
        new Date(meetUp.createdAt).toLocaleString(),
        new Date(meetUp.updatedAt).toLocaleString()
      ]);

      // Generate CSV content
      const csvContent = [headers, ...csvData]
        .map(row => row.map(field => `"${field.toString().replace(/"/g, '""')}"`).join(','))
        .join('\n');

      // Create and download file
      const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
      const link = document.createElement('a');
      const url = URL.createObjectURL(blob);
      link.setAttribute('href', url);

      // Generate filename with current filters and date
      const filterSuffix = [
        statusFilter && `status-${statusFilter}`,
        typeFilter && `type-${typeFilter}`,
        dateFromFilter && `from-${dateFromFilter}`,
        dateToFilter && `to-${dateToFilter}`
      ].filter(Boolean).join('_');

      const filename = `meetup-requests${filterSuffix ? `_${filterSuffix}` : ''}_${format(new Date(), 'yyyy-MM-dd')}.csv`;
      link.setAttribute('download', filename);

      link.style.visibility = 'hidden';
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);

      toast.success(`Exported ${meetUpsData.meetUps.length} meet-up requests (current page only)`);
    } catch (error) {
      toast.error('Failed to export meet-up data');
    } finally {
      setIsExporting(false);
      setShowExportDropdown(false);
    }
  };

  const exportToJSON = async () => {
    if (!meetUpsData || meetUpsData.meetUps.length === 0) {
      toast.error('No meet-up data to export');
      return;
    }

    setIsExporting(true);
    try {
      const exportData = {
        metadata: {
          exportDate: new Date().toISOString(),
          totalRecords: meetUpsData.meetUps.length,
          filters: {
            status: statusFilter || 'all',
            type: typeFilter || 'all',
            property: selectedProperty?.name || 'all',
            dateFrom: dateFromFilter || null,
            dateTo: dateToFilter || null,
            search: searchTerm || null
          }
        },
        meetUps: meetUpsData.meetUps
      };

      const jsonContent = JSON.stringify(exportData, null, 2);
      const blob = new Blob([jsonContent], { type: 'application/json;charset=utf-8;' });
      const link = document.createElement('a');
      const url = URL.createObjectURL(blob);
      link.setAttribute('href', url);

      const filterSuffix = [
        statusFilter && `status-${statusFilter}`,
        typeFilter && `type-${typeFilter}`,
        dateFromFilter && `from-${dateFromFilter}`,
        dateToFilter && `to-${dateToFilter}`
      ].filter(Boolean).join('_');

      const filename = `meetup-requests${filterSuffix ? `_${filterSuffix}` : ''}_${format(new Date(), 'yyyy-MM-dd')}.json`;
      link.setAttribute('download', filename);

      link.style.visibility = 'hidden';
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);

      toast.success(`Exported ${meetUpsData.meetUps.length} meet-up requests (current page only)`);
    } catch (error) {
      toast.error('Failed to export meet-up data');
    } finally {
      setIsExporting(false);
      setShowExportDropdown(false);
    }
  };

  const exportSummaryReport = async () => {
    if (!meetUpsData || meetUpsData.meetUps.length === 0) {
      toast.error('No meet-up data to export');
      return;
    }

    setIsExporting(true);
    try {
      // Generate summary statistics
      const statusCounts = meetUpsData.meetUps.reduce((acc: Record<string, number>, meetUp) => {
        acc[meetUp.status] = (acc[meetUp.status] || 0) + 1;
        return acc;
      }, {});

      const typeCounts = meetUpsData.meetUps.reduce((acc: Record<string, number>, meetUp) => {
        acc[meetUp.type] = (acc[meetUp.type] || 0) + 1;
        return acc;
      }, {});

      const hotelCounts = meetUpsData.meetUps.reduce((acc: Record<string, number>, meetUp) => {
        const hotelName = meetUp.hotelId?.name || 'Unknown Hotel';
        acc[hotelName] = (acc[hotelName] || 0) + 1;
        return acc;
      }, {});

      const headers = [
        'Summary Report - Meet-Up Requests',
        `Generated: ${new Date().toLocaleString()}`,
        `Total Records: ${meetUpsData.meetUps.length}`,
        '',
        'Status Breakdown:',
        ...Object.entries(statusCounts).map(([status, count]) => `  ${status}: ${count}`),
        '',
        'Type Breakdown:',
        ...Object.entries(typeCounts).map(([type, count]) => `  ${type}: ${count}`),
        '',
        'Hotel Breakdown:',
        ...Object.entries(hotelCounts).map(([hotel, count]) => `  ${hotel}: ${count}`),
        '',
        'Applied Filters:',
        statusFilter ? `  Status: ${statusFilter}` : '  Status: All',
        typeFilter ? `  Type: ${typeFilter}` : '  Type: All',
        selectedProperty ? `  Property: ${selectedProperty.name}` : '  Property: All',
        dateFromFilter ? `  Date From: ${dateFromFilter}` : '',
        dateToFilter ? `  Date To: ${dateToFilter}` : '',
        searchTerm ? `  Search: ${searchTerm}` : ''
      ].filter(Boolean);

      const reportContent = headers.join('\n');
      const blob = new Blob([reportContent], { type: 'text/plain;charset=utf-8;' });
      const link = document.createElement('a');
      const url = URL.createObjectURL(blob);
      link.setAttribute('href', url);

      const filename = `meetup-summary-report_${format(new Date(), 'yyyy-MM-dd')}.txt`;
      link.setAttribute('download', filename);

      link.style.visibility = 'hidden';
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);

      toast.success('Summary report exported successfully');
    } catch (error) {
      toast.error('Failed to export summary report');
    } finally {
      setIsExporting(false);
      setShowExportDropdown(false);
    }
  };

  return (
    <div className="space-y-6">
      <PropertyBreadcrumb items={['Meet-Up Management']} />

      {/* Clean Header */}
      <div className="bg-white rounded-xl shadow-lg border border-gray-200 p-4 sm:p-6">
        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
          <div className="flex items-center gap-4">
            <div className="p-3 bg-gradient-to-br from-purple-500 to-pink-600 rounded-xl shadow-md">
              <Users className="h-6 w-6 text-white" />
            </div>
            <div>
              <h1 className="text-2xl sm:text-3xl font-bold text-gray-900">
                Meet-Up Management
              </h1>
              <p className="text-gray-600 mt-1 text-sm sm:text-base">
                Manage all guest meet-up requests and analyze community engagement
              </p>
            </div>
          </div>

          <div className="flex flex-col sm:flex-row items-stretch sm:items-center gap-3">
            <div className="relative" ref={exportDropdownRef}>
              <Button
                variant="outline"
                onClick={() => setShowExportDropdown(!showExportDropdown)}
                disabled={isExporting || !meetUpsData || meetUpsData.meetUps.length === 0}
                className="flex items-center gap-2 w-full sm:w-auto border-gray-300 hover:bg-gray-50 hover:border-gray-400 transition-all duration-200 shadow-sm hover:shadow-md"
              >
                {isExporting ? (
                  <>
                    <RefreshCw className="w-4 h-4 animate-spin" />
                    Exporting...
                  </>
                ) : (
                  <>
                    <Download className="w-4 h-4" />
                    Export Data
                  </>
                )}
              </Button>

              {showExportDropdown && !isExporting && (
                <div className="absolute right-0 mt-2 w-56 bg-white rounded-lg shadow-lg border border-gray-200 z-50">
                  <div className="py-1">
                    <button
                      onClick={exportToCSV}
                      className="flex items-center gap-3 w-full px-4 py-2 text-sm text-gray-700 hover:bg-gray-50"
                    >
                      <FileText className="w-4 h-4" />
                      <div className="text-left">
                        <div className="font-medium">Export as CSV</div>
                        <div className="text-xs text-gray-500">Spreadsheet format</div>
                      </div>
                    </button>
                    <button
                      onClick={exportToJSON}
                      className="flex items-center gap-3 w-full px-4 py-2 text-sm text-gray-700 hover:bg-gray-50"
                    >
                      <FileText className="w-4 h-4" />
                      <div className="text-left">
                        <div className="font-medium">Export as JSON</div>
                        <div className="text-xs text-gray-500">Developer format</div>
                      </div>
                    </button>
                    <button
                      onClick={exportSummaryReport}
                      className="flex items-center gap-3 w-full px-4 py-2 text-sm text-gray-700 hover:bg-gray-50"
                    >
                      <BarChart3 className="w-4 h-4" />
                      <div className="text-left">
                        <div className="font-medium">Summary Report</div>
                        <div className="text-xs text-gray-500">Statistics & overview</div>
                      </div>
                    </button>
                  </div>
                </div>
              )}
            </div>
            <Button
              onClick={() => {
                queryClient.invalidateQueries({ queryKey: ['admin-meetups'] });
                queryClient.invalidateQueries({ queryKey: ['admin-meetup-analytics'] });
                queryClient.invalidateQueries({ queryKey: ['admin-meetup-insights'] });
                queryClient.invalidateQueries({ queryKey: ['admin-guest-meetup-reports'] });
              }}
              className="flex items-center gap-2 bg-blue-600 hover:bg-blue-700 w-full sm:w-auto"
            >
              <RefreshCw className="w-4 h-4" />
              Refresh
            </Button>
          </div>
        </div>
      </div>

      {/* Clean Tabs */}
      <div className="bg-white rounded-xl shadow-lg border border-gray-200 p-4 sm:p-6">
        <div className="flex items-center mb-4">
          <div className="p-2 bg-gradient-to-br from-indigo-500 to-purple-600 rounded-lg shadow-md">
            <Activity className="h-4 w-4 text-white" />
          </div>
          <h2 className="text-lg font-bold text-gray-900 ml-3">Meet-Up Dashboard</h2>
        </div>
        
        <nav className="flex space-x-1 bg-gray-100 p-1 rounded-lg">
          {[
            { id: 'all-meetups', label: 'All Meet-ups', count: meetUpsData?.pagination.totalItems || 0 },
            { id: 'guest-reports', label: 'Guest reports', count: guestReportsData?.pagination.totalItems },
            { id: 'analytics', label: 'Analytics' },
            { id: 'insights', label: 'Insights' }
          ].map((tab) => (
            <button
              key={tab.id}
              onClick={() => {
                setActiveTab(tab.id as typeof activeTab);
                if (tab.id === 'guest-reports') setReportPage(1);
              }}
              className={`flex-1 py-2 px-4 rounded-md font-medium text-sm transition-colors duration-200 ${
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

      {/* All Meet-ups Tab */}
      {activeTab === 'all-meetups' && (
        <div className="space-y-6">
          {/* Filters */}
          <Card className="bg-white rounded-xl shadow-lg border border-gray-200 p-4 sm:p-6">
            <div className="flex items-center mb-4">
              <div className="p-2 bg-gradient-to-br from-blue-500 to-purple-600 rounded-lg shadow-md">
                <Filter className="h-4 w-4 text-white" />
              </div>
              <h3 className="text-lg font-bold text-gray-900 ml-3">Filter Meet-ups</h3>
            </div>
            
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-6 gap-4">
              {/* Search */}
              <div className="relative">
                <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400 h-4 w-4" />
                <Input
                  placeholder="Search meet-ups..."
                  value={searchTerm}
                  onChange={(e) => setSearchTerm(e.target.value)}
                  className="pl-10 border-gray-300 focus:border-blue-500 focus:ring-blue-500"
                />
              </div>

              {/* Status Filter */}
              <select
                value={statusFilter}
                onChange={(e) => setStatusFilter(e.target.value)}
                className="border border-gray-300 rounded-lg px-3 py-2 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
              >
                <option value="">All Status</option>
                <option value="pending">Pending</option>
                <option value="accepted">Accepted</option>
                <option value="declined">Declined</option>
                <option value="cancelled">Cancelled</option>
                <option value="completed">Completed</option>
              </select>

              {/* Type Filter */}
              <select
                value={typeFilter}
                onChange={(e) => setTypeFilter(e.target.value)}
                className="border border-gray-300 rounded-lg px-3 py-2 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
              >
                <option value="">All Types</option>
                <option value="casual">Casual</option>
                <option value="business">Business</option>
                <option value="social">Social</option>
                <option value="networking">Networking</option>
                <option value="activity">Activity</option>
              </select>


              {/* Date From */}
              <Input
                type="date"
                value={dateFromFilter}
                onChange={(e) => setDateFromFilter(e.target.value)}
                className="border border-gray-300 rounded-lg px-3 py-2 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
              />

              {/* Date To */}
              <Input
                type="date"
                value={dateToFilter}
                onChange={(e) => setDateToFilter(e.target.value)}
                className="border border-gray-300 rounded-lg px-3 py-2 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
              />
            </div>

            {/* Clear Filters */}
            {(searchTerm || statusFilter || typeFilter || dateFromFilter || dateToFilter) && (
              <div className="mt-4">
                <Button variant="outline" onClick={handleClearFilters}>
                  Clear All Filters
                </Button>
              </div>
            )}
          </Card>

          {/* Meet-ups List */}
          {meetUpsLoading ? (
            <div className="flex justify-center py-12">
              <LoadingSpinner />
            </div>
          ) : meetUpsError ? (
            <Card className="p-12 text-center">
              <AlertTriangle className="w-16 h-16 text-red-400 mx-auto mb-4" />
              <h3 className="text-xl font-semibold text-gray-900 mb-2">Failed to load meet-up requests</h3>
              <p className="text-gray-600 mb-4">Something went wrong. Please try again.</p>
              <Button onClick={() => queryClient.invalidateQueries({ queryKey: ['admin-meetups'] })}>
                Retry
              </Button>
            </Card>
          ) : (
            <div className="space-y-4">
              {meetUpsData?.meetUps.length === 0 ? (
                <Card className="p-12 text-center">
                  <Users className="w-16 h-16 text-gray-300 mx-auto mb-4" />
                  <h3 className="text-xl font-semibold text-gray-900 mb-2">No meet-up requests found</h3>
                  <p className="text-gray-600 mb-6">
                    {searchTerm || statusFilter || typeFilter || dateFromFilter || dateToFilter
                      ? 'Try adjusting your search or filters'
                      : 'No meet-up requests have been created yet'
                    }
                  </p>
                </Card>
              ) : (
                meetUpsData?.meetUps.map((meetUp) => (
                  <AdminMeetUpCard
                    key={meetUp._id}
                    meetUp={meetUp}
                    onViewDetails={() => handleViewDetails(meetUp)}
                    onForceCancel={() => handleForceCancel(meetUp)}
                  />
                ))
              )}
            </div>
          )}

          {/* Pagination */}
          {meetUpsData && meetUpsData.pagination.totalPages > 1 && (
            <div className="flex justify-center items-center gap-2">
              <Button
                variant="outline"
                onClick={() => setCurrentPage(prev => Math.max(1, prev - 1))}
                disabled={!meetUpsData.pagination.hasPrev}
              >
                Previous
              </Button>
              <span className="text-sm text-gray-600">
                Page {meetUpsData.pagination.currentPage} of {meetUpsData.pagination.totalPages}
              </span>
              <Button
                variant="outline"
                onClick={() => setCurrentPage(prev => prev + 1)}
                disabled={!meetUpsData.pagination.hasNext}
              >
                Next
              </Button>
            </div>
          )}
        </div>
      )}

      {activeTab === 'guest-reports' && (
        <div className="space-y-6">
          <Card className="bg-white rounded-xl shadow-lg border border-gray-200 p-4 sm:p-6">
            <div className="flex flex-col sm:flex-row sm:items-end gap-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Status</label>
                <select
                  value={reportStatusFilter}
                  onChange={(e) => {
                    setReportStatusFilter(e.target.value);
                    setReportPage(1);
                  }}
                  className="border border-gray-300 rounded-lg px-3 py-2 focus:outline-none focus:ring-2 focus:ring-blue-500 min-w-[180px]"
                >
                  <option value="">All</option>
                  <option value="pending">Pending</option>
                  <option value="reviewed">Reviewed</option>
                  <option value="dismissed">Dismissed</option>
                </select>
              </div>
              <p className="text-sm text-gray-600 flex-1">
                Guest-submitted safety reports for meet-ups. Staff are also notified in-app when a report is filed.
              </p>
            </div>
          </Card>

          {guestReportsLoading ? (
            <div className="flex justify-center py-12">
              <LoadingSpinner />
            </div>
          ) : (
            <div className="space-y-3">
              {(guestReportsData?.reports?.length ?? 0) === 0 ? (
                <Card className="p-12 text-center text-gray-600">No guest reports match this filter.</Card>
              ) : (
                guestReportsData?.reports?.map((r: GuestMeetUpReportRow) => (
                  <Card key={r._id} className="p-4 border border-gray-200">
                    <div className="flex flex-wrap justify-between gap-2 mb-2">
                      <Badge variant="outline" className="capitalize">
                        {r.reason}
                      </Badge>
                      <span className="text-xs text-gray-500">{format(new Date(r.createdAt), 'PPp')}</span>
                    </div>
                    <p className="text-sm text-gray-800 mb-2">
                      <span className="font-medium">Reporter:</span>{' '}
                      {r.reporterId?.name || r.reporterId?.email || '—'} ·{' '}
                      <span className="font-medium">Reported:</span>{' '}
                      {r.reportedUserId?.name || r.reportedUserId?.email || '—'}
                    </p>
                    {r.meetUpRequestId && typeof r.meetUpRequestId === 'object' && (
                      <p className="text-xs text-gray-600 mb-1">
                        Meet-up: {(r.meetUpRequestId as { title?: string }).title || '—'} (
                        {(r.meetUpRequestId as { status?: string }).status || '—'})
                      </p>
                    )}
                    {r.details ? <p className="text-sm text-gray-700 whitespace-pre-wrap">{r.details}</p> : null}
                    <p className="text-xs text-gray-500 mt-2 capitalize">Status: {r.status}</p>
                  </Card>
                ))
              )}
            </div>
          )}

          {guestReportsData && guestReportsData.pagination.totalPages > 1 && (
            <div className="flex justify-center items-center gap-2">
              <Button
                variant="outline"
                onClick={() => setReportPage((p) => Math.max(1, p - 1))}
                disabled={!guestReportsData.pagination.hasPrev}
              >
                Previous
              </Button>
              <span className="text-sm text-gray-600">
                Page {guestReportsData.pagination.currentPage} of {guestReportsData.pagination.totalPages}
              </span>
              <Button
                variant="outline"
                onClick={() => setReportPage((p) => p + 1)}
                disabled={!guestReportsData.pagination.hasNext}
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
              {/* Time Range Filter */}
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
                  <option value="365d">Last year</option>
                </select>
              </div>

              {/* Summary Cards */}
              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-5 gap-4">
                <StatsCard
                  title="Total Requests"
                  value={analytics.summary?.totalRequests ?? 0}
                  icon={Users}
                  color="bg-blue-100 text-blue-600"
                />
                <StatsCard
                  title="Acceptance Rate"
                  value={`${analytics.summary?.acceptanceRate ?? 0}%`}
                  icon={CheckCircle}
                  color="bg-green-100 text-green-600"
                />
                <StatsCard
                  title="Decline Rate"
                  value={`${analytics.summary?.declineRate ?? 0}%`}
                  icon={XCircle}
                  color="bg-red-100 text-red-600"
                />
                <StatsCard
                  title="Completion Rate"
                  value={`${analytics.summary?.completionRate ?? 0}%`}
                  icon={Activity}
                  color="bg-purple-100 text-purple-600"
                />
                <StatsCard
                  title="Avg Response Time"
                  value={`${(analytics.summary?.avgResponseTime ?? 0).toFixed(1)}h`}
                  icon={Clock}
                  color="bg-orange-100 text-orange-600"
                />
              </div>

              {/* Breakdown Charts */}
              <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
                {/* Status Breakdown */}
                <Card className="p-6">
                  <h3 className="text-lg font-semibold text-gray-900 mb-4">Status Breakdown</h3>
                  <div className="space-y-3">
                    {(analytics.breakdown.status?.length ?? 0) === 0 ? (
                      <p className="text-sm text-gray-500 text-center py-4">No status data available for the selected period</p>
                    ) : (
                      analytics.breakdown.status.map((status) => (
                        <div key={status._id} className="flex items-center justify-between">
                          <div className="flex items-center gap-3">
                            <div className={`w-4 h-4 rounded ${
                              status._id === 'pending' ? 'bg-yellow-500' :
                              status._id === 'accepted' ? 'bg-green-500' :
                              status._id === 'declined' ? 'bg-red-500' :
                              status._id === 'cancelled' ? 'bg-gray-500' :
                              status._id === 'completed' ? 'bg-blue-500' : 'bg-gray-300'
                            }`} />
                            <span className="capitalize font-medium">{status._id}</span>
                          </div>
                          <span className="text-gray-600">{status.count}</span>
                        </div>
                      ))
                    )}
                  </div>
                </Card>

                {/* Type Breakdown */}
                <Card className="p-6">
                  <h3 className="text-lg font-semibold text-gray-900 mb-4">Type Breakdown</h3>
                  <div className="space-y-3">
                    {(analytics.breakdown.type?.length ?? 0) === 0 ? (
                      <p className="text-sm text-gray-500 text-center py-4">No type data available for the selected period</p>
                    ) : (
                      analytics.breakdown.type.map((type, index) => (
                        <div key={type._id} className="flex items-center justify-between">
                          <div className="flex items-center gap-3">
                            <div className={`w-4 h-4 rounded ${
                              index % 5 === 0 ? 'bg-blue-500' :
                              index % 5 === 1 ? 'bg-green-500' :
                              index % 5 === 2 ? 'bg-purple-500' :
                              index % 5 === 3 ? 'bg-orange-500' : 'bg-pink-500'
                            }`} />
                            <span className="capitalize font-medium">{type._id}</span>
                          </div>
                          <span className="text-gray-600">{type.count}</span>
                        </div>
                      ))
                    )}
                  </div>
                </Card>

                {/* Hotel Performance */}
                <Card className="p-6">
                  <h3 className="text-lg font-semibold text-gray-900 mb-4">Hotel Performance</h3>
                  <div className="space-y-3">
                    {(analytics.breakdown.hotels?.length ?? 0) === 0 ? (
                      <p className="text-sm text-gray-500 text-center py-4">No hotel performance data available for the selected period</p>
                    ) : (
                      analytics.breakdown.hotels.map((hotel, index) => (
                        <div key={`analytics-breakdown-hotels-${index}`} className="flex items-center justify-between">
                          <div className="flex items-center gap-3">
                            <Building className="w-4 h-4 text-gray-400" />
                            <span className="font-medium">{hotel.hotelName || 'Unknown Hotel'}</span>
                          </div>
                          <span className="text-gray-600">{hotel.count}</span>
                        </div>
                      ))
                    )}
                  </div>
                </Card>

                {/* Popular Locations */}
                <Card className="p-6">
                  <h3 className="text-lg font-semibold text-gray-900 mb-4">Popular Locations</h3>
                  <div className="space-y-3">
                    {(analytics.breakdown.locations?.length ?? 0) === 0 ? (
                      <p className="text-sm text-gray-500 text-center py-4">No location data available for the selected period</p>
                    ) : (
                      analytics.breakdown.locations.map((location) => (
                        <div key={location._id} className="flex items-center justify-between">
                          <div className="flex items-center gap-3">
                            <MapPin className="w-4 h-4 text-gray-400" />
                            <span className="capitalize font-medium">{location._id.replace('_', ' ')}</span>
                          </div>
                          <span className="text-gray-600">{location.count}</span>
                        </div>
                      ))
                    )}
                  </div>
                </Card>
              </div>

              {/* Top Requesters */}
              <Card className="p-6">
                <h3 className="text-lg font-semibold text-gray-900 mb-4">Top Requesters</h3>
                <div className="space-y-3">
                  {(analytics.users.topRequesters?.length ?? 0) === 0 ? (
                    <p className="text-sm text-gray-500 text-center py-4">No requester data available for the selected period</p>
                  ) : (
                    analytics.users.topRequesters.map((user, index) => (
                      <div key={`analytics-users-topRequesters-${index}-${user._id}`} className="flex items-center justify-between p-3 bg-gray-50 rounded-lg">
                        <div className="flex items-center gap-3">
                          <div className="w-8 h-8 bg-blue-100 rounded-full flex items-center justify-center">
                            <User className="w-4 h-4 text-blue-600" />
                          </div>
                          <div>
                            <p className="font-medium text-gray-900">{user.userName || 'Unknown User'}</p>
                            <p className="text-xs text-gray-600">Top requester #{index + 1}</p>
                          </div>
                        </div>
                        <div className="text-right">
                          <p className="font-semibold text-gray-900">{user.requestsSent}</p>
                          <p className="text-xs text-gray-600">requests</p>
                        </div>
                      </div>
                    ))
                  )}
                </div>
              </Card>
            </>
          ) : (
            <Card className="p-12 text-center">
              <BarChart3 className="w-16 h-16 text-gray-300 mx-auto mb-4" />
              <h3 className="text-xl font-semibold text-gray-900 mb-2">No analytics data available</h3>
              <p className="text-gray-600">Analytics data will appear here once meet-up requests are created.</p>
            </Card>
          )}
        </div>
      )}

      {/* Insights Tab */}
      {activeTab === 'insights' && (
        <div className="space-y-6">
          {insightsLoading ? (
            <div className="flex justify-center py-12">
              <LoadingSpinner />
            </div>
          ) : insights ? (
            <>
              {/* Header */}
              <div className="flex items-center justify-between">
                <h2 className="text-xl font-semibold text-gray-900">System Insights</h2>
              </div>

              {/* Engagement Metrics */}
              <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                <StatsCard
                  title="Total Users"
                  value={insights.userEngagement?.totalUsers ?? 0}
                  icon={Users}
                  color="bg-blue-100 text-blue-600"
                />
                <StatsCard
                  title="Active Users"
                  value={insights.userEngagement?.activeUsers ?? 0}
                  icon={TrendingUp}
                  color="bg-green-100 text-green-600"
                />
                <StatsCard
                  title="Engagement Rate"
                  value={`${(insights.userEngagement?.engagementRate ?? 0).toFixed(1)}%`}
                  icon={Activity}
                  color="bg-purple-100 text-purple-600"
                />
              </div>

              {/* Risk Assessment & Safety */}
              <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
                <Card className="p-6">
                  <h3 className="text-lg font-semibold text-gray-900 mb-4">Risk Assessment</h3>
                  <div className="space-y-4">
                    <div className="flex items-center justify-between">
                      <span className="text-gray-600">Potentially Risky Meet-ups</span>
                      <span className="font-semibold text-red-600">{insights.riskAssessment?.potentiallyRiskyMeetUps ?? 0}</span>
                    </div>
                    <div className="flex items-center justify-between">
                      <span className="text-gray-600">Frequent Requesters (&gt;10 requests)</span>
                      <span className="font-semibold text-orange-600">{insights.riskAssessment?.frequentRequesters ?? 0}</span>
                    </div>
                  </div>
                  
                  {(insights.riskAssessment?.riskyMeetUpDetails?.length ?? 0) > 0 && (
                    <div className="mt-4">
                      <h4 className="text-sm font-medium text-gray-700 mb-2">Recent Risk Alerts</h4>
                      <div className="space-y-2">
                        {insights.riskAssessment.riskyMeetUpDetails?.slice(0, 3).map((meetup, index) => (
                          <div key={`-${index}-${meetup.title}`} className="p-2 bg-red-50 border border-red-200 rounded text-xs">
                            <p className="font-medium text-red-800">{meetup.title}</p>
                            <p className="text-red-600">
                              {meetup.requesterId?.name || 'Unknown'} → {meetup.targetUserId?.name || 'Unknown'}
                            </p>
                          </div>
                        ))}
                      </div>
                    </div>
                  )}
                </Card>

                <Card className="p-6">
                  <h3 className="text-lg font-semibold text-gray-900 mb-4">Safety Insights</h3>
                  <div className="space-y-4">
                    <div>
                      <div className="flex justify-between mb-2">
                        <span className="text-gray-600">Public Location Preference</span>
                        <span className="font-semibold">
                          {(insights.safetyInsights?.totalRequests ?? 0) > 0 
                            ? Math.round(((insights.safetyInsights?.publicLocation ?? 0) / (insights.safetyInsights?.totalRequests ?? 0)) * 100)
                            : 0}%
                        </span>
                      </div>
                      <div className="w-full bg-gray-200 rounded-full h-2">
                        <div 
                          className="bg-green-500 h-2 rounded-full" 
                          style={{ 
                            width: `${(insights.safetyInsights?.totalRequests ?? 0) > 0 
                              ? ((insights.safetyInsights?.publicLocation ?? 0) / (insights.safetyInsights?.totalRequests ?? 0)) * 100
                              : 0}%` 
                          }}
                        />
                      </div>
                    </div>

                    <div>
                      <div className="flex justify-between mb-2">
                        <span className="text-gray-600">Hotel Staff Present</span>
                        <span className="font-semibold">
                          {(insights.safetyInsights?.totalRequests ?? 0) > 0 
                            ? Math.round(((insights.safetyInsights?.hotelStaffPresent ?? 0) / (insights.safetyInsights?.totalRequests ?? 0)) * 100)
                            : 0}%
                        </span>
                      </div>
                      <div className="w-full bg-gray-200 rounded-full h-2">
                        <div 
                          className="bg-blue-500 h-2 rounded-full" 
                          style={{ 
                            width: `${(insights.safetyInsights?.totalRequests ?? 0) > 0 
                              ? ((insights.safetyInsights?.hotelStaffPresent ?? 0) / (insights.safetyInsights?.totalRequests ?? 0)) * 100
                              : 0}%` 
                          }}
                        />
                      </div>
                    </div>

                    <div>
                      <div className="flex justify-between mb-2">
                        <span className="text-gray-600">Verified Users Only</span>
                        <span className="font-semibold">
                          {(insights.safetyInsights?.totalRequests ?? 0) > 0 
                            ? Math.round(((insights.safetyInsights?.verifiedOnly ?? 0) / (insights.safetyInsights?.totalRequests ?? 0)) * 100)
                            : 0}%
                        </span>
                      </div>
                      <div className="w-full bg-gray-200 rounded-full h-2">
                        <div 
                          className="bg-purple-500 h-2 rounded-full" 
                          style={{ 
                            width: `${(insights.safetyInsights?.totalRequests ?? 0) > 0 
                              ? ((insights.safetyInsights?.verifiedOnly ?? 0) / (insights.safetyInsights?.totalRequests ?? 0)) * 100
                              : 0}%` 
                          }}
                        />
                      </div>
                    </div>
                  </div>
                </Card>
              </div>

              {/* Hotel Performance Issues */}
              {(insights.hotelPerformance?.underperformingHotels?.length ?? 0) > 0 && (
                <Card className="p-6">
                  <h3 className="text-lg font-semibold text-gray-900 mb-4">Hotels Needing Attention</h3>
                  <div className="space-y-3">
                    {insights.hotelPerformance.underperformingHotels.map((hotel, index) => (
                      <div key={`insights-hotelPerformance-underperformingHotels-${index}`} className="flex items-center justify-between p-3 bg-yellow-50 border border-yellow-200 rounded-lg">
                        <div className="flex items-center gap-3">
                          <AlertTriangle className="w-5 h-5 text-yellow-600" />
                          <div>
                            <p className="font-medium text-yellow-900">{hotel.hotelName}</p>
                            <p className="text-xs text-yellow-700">Low acceptance rate - needs attention</p>
                          </div>
                        </div>
                        <div className="text-right">
                          <p className="font-semibold text-yellow-900">{Math.round(hotel.acceptanceRate * 100)}%</p>
                          <p className="text-xs text-yellow-700">{hotel.total} total requests</p>
                        </div>
                      </div>
                    ))}
                  </div>
                </Card>
              )}
            </>
          ) : (
            <Card className="p-12 text-center">
              <Activity className="w-16 h-16 text-gray-300 mx-auto mb-4" />
              <h3 className="text-xl font-semibold text-gray-900 mb-2">No insights data available</h3>
              <p className="text-gray-600">Insights will appear here once there is sufficient meet-up activity.</p>
            </Card>
          )}
        </div>
      )}

      {/* Details Modal */}
      {showDetailsModal && selectedMeetUp && (
        <MeetUpDetailsModal
          meetUp={selectedMeetUp}
          onClose={() => setShowDetailsModal(false)}
        />
      )}

      {/* Force Cancel Modal */}
      {showCancelModal && selectedMeetUp && (
        <ForceCancelModal
          meetUp={selectedMeetUp}
          onClose={() => setShowCancelModal(false)}
          onConfirm={(reason) => forceCancelMutation.mutate({ requestId: selectedMeetUp._id, reason })}
          isLoading={forceCancelMutation.isPending}
        />
      )}
    </div>
  );
}

// Admin Meet-Up Card Component
interface AdminMeetUpCardProps {
  meetUp: MeetUpRequest;
  onViewDetails: () => void;
  onForceCancel: () => void;
}

const AdminMeetUpCard = React.memo(function AdminMeetUpCard({ meetUp, onViewDetails, onForceCancel }: AdminMeetUpCardProps) {
  const typeInfo = meetUpRequestService.getMeetUpTypeInfo(meetUp.type);
  const statusInfo = meetUpRequestService.getStatusInfo(meetUp.status);
  const locationInfo = meetUpRequestService.getLocationTypeInfo(meetUp.location.type);
  const safetyLevel = meetUpRequestService.getSafetyLevel(meetUp);

  return (
    <Card className="bg-white rounded-xl shadow-lg border border-gray-200 p-4 sm:p-6 hover:shadow-xl transition-all duration-300 transform hover:-translate-y-1">
      <div className="flex flex-col lg:flex-row lg:items-center lg:justify-between gap-4">
        <div className="flex items-start gap-3 md:gap-4 flex-1">
          {/* Type Icon */}
          <div className="p-3 bg-gradient-to-br from-purple-500 to-pink-500 rounded-xl shadow-md flex-shrink-0">
            <div className="text-white text-lg">{typeInfo.icon}</div>
          </div>

          {/* Meet-up Info */}
          <div className="flex-1 min-w-0">
            <div className="flex flex-col sm:flex-row sm:items-center gap-2 sm:gap-3 mb-3">
              <h3 className="text-lg font-bold text-gray-900 truncate">{meetUp.title}</h3>
              <div className="flex flex-wrap gap-2">
                <span className={`px-3 py-1 rounded-full text-xs font-semibold ${typeInfo.color}`}>
                  {typeInfo.label}
                </span>
                <span className={`px-3 py-1 rounded-full text-xs font-semibold ${statusInfo.color}`}>
                  {statusInfo.label}
                </span>
                <span className={`px-3 py-1 rounded-full text-xs font-semibold ${safetyLevel.color}`}>
                  {safetyLevel.level} safety
                </span>
              </div>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3 md:gap-4 text-sm">
              <div>
                <span className="text-gray-500">From:</span>
                <p className="font-medium">{meetUp.requesterId?.name || 'Unknown'}</p>
              </div>
              <div>
                <span className="text-gray-500">To:</span>
                <p className="font-medium">{meetUp.targetUserId?.name || 'Unknown'}</p>
              </div>
              <div>
                <span className="text-gray-500">Hotel:</span>
                <p className="font-medium">{meetUp.hotelId?.name || 'Unknown Hotel'}</p>
              </div>
              <div>
                <span className="text-gray-500">Date:</span>
                <p className="font-medium">
                  {formatDate(meetUp.proposedDate)} at {meetUp.proposedTime?.start || ''}
                </p>
              </div>
              <div>
                <span className="text-gray-500">Location:</span>
                <p className="font-medium">{locationInfo.label}</p>
              </div>
              <div>
                <span className="text-gray-500">Participants:</span>
                <p className="font-medium">
                  {meetUp.participantCount ?? meetUp.participants?.confirmedParticipants?.length ?? 0}/{meetUp.participants?.maxParticipants ?? 0}
                </p>
              </div>
              <div>
                <span className="text-gray-500">Created:</span>
                <p className="font-medium">{formatDate(meetUp.createdAt)}</p>
              </div>
              <div>
                <span className="text-gray-500">Activity:</span>
                <p className="font-medium">{meetUp.activity?.type || 'N/A'}</p>
              </div>
            </div>
          </div>
        </div>

        {/* Actions */}
        <div className="flex flex-col sm:flex-row lg:flex-col xl:flex-row gap-2 lg:min-w-[140px]">
          <Button
            variant="outline"
            size="sm"
            onClick={onViewDetails}
            className="flex items-center gap-2 w-full sm:w-auto border-gray-300 hover:bg-gray-50 hover:border-gray-400 transition-all duration-200"
          >
            <Eye className="w-4 h-4" />
            <span className="hidden sm:inline">Details</span>
            <span className="sm:hidden">View</span>
          </Button>
          {meetUp.status !== 'cancelled' && meetUp.status !== 'completed' && (
            <Button
              variant="outline"
              size="sm"
              onClick={onForceCancel}
              className="flex items-center gap-2 text-red-600 hover:text-red-700 border-red-200 hover:border-red-300 w-full sm:w-auto transition-all duration-200"
            >
              <Ban className="w-4 h-4" />
              Cancel
            </Button>
          )}
        </div>
      </div>
    </Card>
  );
});
AdminMeetUpCard.displayName = 'AdminMeetUpCard';

// Stats Card Component
interface StatsCardProps {
  title: string;
  value: number | string;
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

// Meet-Up Details Modal
interface MeetUpDetailsModalProps {
  meetUp: MeetUpRequest;
  onClose: () => void;
}

function MeetUpDetailsModal({ meetUp, onClose }: MeetUpDetailsModalProps) {
  const typeInfo = meetUpRequestService.getMeetUpTypeInfo(meetUp.type);
  const statusInfo = meetUpRequestService.getStatusInfo(meetUp.status);
  const locationInfo = meetUpRequestService.getLocationTypeInfo(meetUp.location.type);
  const safetyLevel = meetUpRequestService.getSafetyLevel(meetUp);

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
      <Card className="w-full max-w-4xl max-h-[90vh] overflow-y-auto p-4 md:p-6">
        <div className="flex justify-between items-center mb-6">
          <h2 className="text-xl font-semibold text-gray-900">Meet-Up Request Details</h2>
          <Button variant="ghost" size="sm" onClick={onClose}>
            <X className="w-5 h-5" />
          </Button>
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          {/* Basic Information */}
          <div className="space-y-6">
            <div>
              <h3 className="text-lg font-semibold text-gray-900 mb-4">Basic Information</h3>
              <div className="space-y-3">
                <div>
                  <label className="text-sm text-gray-500">Title</label>
                  <p className="font-medium text-gray-900">{meetUp.title}</p>
                </div>
                <div>
                  <label className="text-sm text-gray-500">Description</label>
                  <p className="font-medium text-gray-900">{meetUp.description}</p>
                </div>
                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <label className="text-sm text-gray-500">Type</label>
                    <div className="flex items-center gap-2">
                      <span>{typeInfo.icon}</span>
                      <span className={`px-2 py-1 rounded-full text-xs font-medium ${typeInfo.color}`}>
                        {typeInfo.label}
                      </span>
                    </div>
                  </div>
                  <div>
                    <label className="text-sm text-gray-500">Status</label>
                    <span className={`inline-flex px-2 py-1 rounded-full text-xs font-medium ${statusInfo.color}`}>
                      {statusInfo.label}
                    </span>
                  </div>
                </div>
              </div>
            </div>

            {/* Users */}
            <div>
              <h3 className="text-lg font-semibold text-gray-900 mb-4">Participants</h3>
              <div className="space-y-3">
                <div className="flex items-center gap-3 p-3 bg-gray-50 rounded-lg">
                  <User className="w-8 h-8 text-blue-600" />
                  <div>
                    <p className="font-medium text-gray-900">{meetUp.requesterId?.name || 'Unknown'}</p>
                    <p className="text-sm text-gray-600">{meetUp.requesterId?.email || ''}</p>
                    <span className="text-xs bg-blue-100 text-blue-800 px-2 py-1 rounded">Requester</span>
                  </div>
                </div>
                <div className="flex items-center gap-3 p-3 bg-gray-50 rounded-lg">
                  <User className="w-8 h-8 text-green-600" />
                  <div>
                    <p className="font-medium text-gray-900">{meetUp.targetUserId?.name || 'Unknown'}</p>
                    <p className="text-sm text-gray-600">{meetUp.targetUserId?.email || ''}</p>
                    <span className="text-xs bg-green-100 text-green-800 px-2 py-1 rounded">Target</span>
                  </div>
                </div>
              </div>
            </div>
          </div>

          {/* Logistics & Safety */}
          <div className="space-y-6">
            <div>
              <h3 className="text-lg font-semibold text-gray-900 mb-4">Logistics</h3>
              <div className="space-y-3">
                <div>
                  <label className="text-sm text-gray-500">Date & Time</label>
                  <p className="font-medium text-gray-900">
                    {meetUpRequestService.formatDateTime(meetUp.proposedDate, meetUp.proposedTime)}
                  </p>
                </div>
                <div>
                  <label className="text-sm text-gray-500">Location</label>
                  <div className="flex items-center gap-2">
                    <span>{locationInfo.icon}</span>
                    <span>{meetUp.location.name}</span>
                    <span className={`px-2 py-1 rounded-full text-xs font-medium ${locationInfo.color}`}>
                      {locationInfo.label}
                    </span>
                  </div>
                  {meetUp.location.details && (
                    <p className="text-sm text-gray-600 mt-1">{meetUp.location.details}</p>
                  )}
                </div>
                <div>
                  <label className="text-sm text-gray-500">Hotel</label>
                  <p className="font-medium text-gray-900">{meetUp.hotelId?.name || 'Unknown Hotel'}</p>
                </div>
              </div>
            </div>

            {/* Safety Settings */}
            <div>
              <h3 className="text-lg font-semibold text-gray-900 mb-4">Safety & Preferences</h3>
              <div className="space-y-3">
                <div>
                  <label className="text-sm text-gray-500">Safety Level</label>
                  <span className={`inline-flex px-2 py-1 rounded-full text-xs font-medium ${safetyLevel.color}`}>
                    {safetyLevel.description}
                  </span>
                </div>
                
                {meetUp.safety && (
                  <div className="grid grid-cols-3 gap-2 text-sm">
                    <div className="text-center">
                      <p className="text-gray-500">Public Location</p>
                      <p className={`font-medium ${meetUp.safety.publicLocation ? 'text-green-600' : 'text-red-600'}`}>
                        {meetUp.safety.publicLocation ? 'Yes' : 'No'}
                      </p>
                    </div>
                    <div className="text-center">
                      <p className="text-gray-500">Staff Present</p>
                      <p className={`font-medium ${meetUp.safety.hotelStaffPresent ? 'text-green-600' : 'text-red-600'}`}>
                        {meetUp.safety.hotelStaffPresent ? 'Yes' : 'No'}
                      </p>
                    </div>
                    <div className="text-center">
                      <p className="text-gray-500">Verified Only</p>
                      <p className={`font-medium ${meetUp.safety.verifiedOnly ? 'text-green-600' : 'text-red-600'}`}>
                        {meetUp.safety.verifiedOnly ? 'Yes' : 'No'}
                      </p>
                    </div>
                  </div>
                )}

                {meetUp.preferences && (
                  <div>
                    <label className="text-sm text-gray-500">Preferences</label>
                    <div className="text-sm text-gray-700">
                      {meetUp.preferences.interests && (
                        <p><strong>Interests:</strong> {meetUp.preferences.interests.join(', ')}</p>
                      )}
                      {meetUp.preferences.languages && (
                        <p><strong>Languages:</strong> {meetUp.preferences.languages.join(', ')}</p>
                      )}
                      {meetUp.preferences.ageGroup && (
                        <p><strong>Age Group:</strong> {meetUp.preferences.ageGroup}</p>
                      )}
                    </div>
                  </div>
                )}
              </div>
            </div>

            {/* Response & Activity */}
            {meetUp.response && (
              <div>
                <h3 className="text-lg font-semibold text-gray-900 mb-4">Response</h3>
                <div className="p-3 bg-gray-50 rounded-lg">
                  <div className="flex justify-between items-start mb-2">
                    <span className={`px-2 py-1 rounded-full text-xs font-medium ${
                      meetUp.response.status === 'accepted' ? 'bg-green-100 text-green-800' :
                      meetUp.response.status === 'declined' ? 'bg-red-100 text-red-800' :
                      'bg-yellow-100 text-yellow-800'
                    }`}>
                      {meetUp.response.status}
                    </span>
                    {meetUp.response.respondedAt && (
                      <span className="text-xs text-gray-500">
                        {formatDate(meetUp.response.respondedAt)}
                      </span>
                    )}
                  </div>
                  {meetUp.response.message && (
                    <p className="text-sm text-gray-700">{meetUp.response.message}</p>
                  )}
                </div>
              </div>
            )}

            {/* Timestamps */}
            <div>
              <h3 className="text-lg font-semibold text-gray-900 mb-4">Timeline</h3>
              <div className="space-y-2 text-sm">
                <div className="flex justify-between">
                  <span className="text-gray-500">Created:</span>
                  <span className="font-medium">{new Date(meetUp.createdAt).toLocaleString()}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-gray-500">Updated:</span>
                  <span className="font-medium">{new Date(meetUp.updatedAt).toLocaleString()}</span>
                </div>
              </div>
            </div>
          </div>
        </div>
      </Card>
    </div>
  );
}

// Force Cancel Modal
interface ForceCancelModalProps {
  meetUp: MeetUpRequest;
  onClose: () => void;
  onConfirm: (reason?: string) => void;
  isLoading: boolean;
}

function ForceCancelModal({ meetUp, onClose, onConfirm, isLoading }: ForceCancelModalProps) {
  const [reason, setReason] = useState('');

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    onConfirm(reason || 'Cancelled by administrator');
  };

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
      <Card className="w-full max-w-lg p-6">
        <div className="flex justify-between items-center mb-4">
          <h2 className="text-xl font-semibold text-gray-900">Force Cancel Meet-Up</h2>
          <Button variant="ghost" size="sm" onClick={onClose}>
            <X className="w-4 h-4" />
          </Button>
        </div>

        <div className="mb-4 p-3 bg-yellow-50 border border-yellow-200 rounded">
          <p className="text-yellow-800 text-sm">
            You are about to forcefully cancel the meet-up request "{meetUp.title}" between {meetUp.requesterId?.name || 'Unknown'} and {meetUp.targetUserId?.name || 'Unknown'}.
          </p>
        </div>

        <form onSubmit={handleSubmit} className="space-y-4">
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              Reason for cancellation (optional)
            </label>
            <textarea
              value={reason}
              onChange={(e) => setReason(e.target.value)}
              rows={3}
              className="w-full border border-gray-300 rounded-lg px-3 py-2 focus:outline-none focus:ring-2 focus:ring-blue-500"
              placeholder="Enter reason for cancellation..."
            />
          </div>

          <div className="flex justify-end gap-3">
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
              className="bg-red-600 hover:bg-red-700"
            >
              {isLoading ? (
                <>
                  <RefreshCw className="w-4 h-4 mr-2 animate-spin" />
                  Cancelling...
                </>
              ) : (
                <>
                  <Ban className="w-4 h-4 mr-2" />
                  Force Cancel
                </>
              )}
            </Button>
          </div>
        </form>
      </Card>
    </div>
  );
}

export default withErrorBoundary(AdminMeetUpManagement, { level: 'page' });