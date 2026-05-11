import React, { useState, useMemo, useCallback } from 'react';
import { useQuery, useMutation, useQueryClient, keepPreviousData } from '@tanstack/react-query';
import {
  Users,
  Calendar,
  MapPin,
  Clock,
  AlertTriangle,
  CheckCircle,
  Eye,
  Shield,
  Search,
  RefreshCw,
  ChevronLeft,
  ChevronRight,
  Info,
  Flag,
  Activity,
  X,
} from 'lucide-react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import { LoadingSpinner } from '../../components/LoadingSpinner';
import { useProperty } from '../../context/PropertyContext';
import { useAuth } from '../../context/AuthContext';
import { api } from '../../services/api';
import {
  meetUpRequestService,
  MeetUpRequest,
  AdminInsights,
} from '../../services/meetUpRequestService';
import { formatDate } from '../../utils/formatters';
import { cn } from '../../utils/cn';
import { withErrorBoundary } from '../../components/ErrorBoundary';

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

type MeetUpStatus = 'all' | 'pending' | 'accepted' | 'declined' | 'cancelled' | 'completed';
type ActiveTab = 'all-meetups' | 'upcoming' | 'details' | 'safety-concerns' | 'insights';

interface SafetyConcernForm {
  meetUpId: string;
  meetUpTitle: string;
  reason: string;
  details: string;
}

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function getStatusBadge(status: string) {
  const map: Record<string, { label: string; className: string }> = {
    pending: { label: 'Pending', className: 'bg-yellow-100 text-yellow-800' },
    accepted: { label: 'Accepted', className: 'bg-green-100 text-green-800' },
    declined: { label: 'Declined', className: 'bg-red-100 text-red-800' },
    cancelled: { label: 'Cancelled', className: 'bg-gray-100 text-gray-800' },
    completed: { label: 'Completed', className: 'bg-blue-100 text-blue-800' },
  };
  return map[status] ?? { label: status, className: 'bg-gray-100 text-gray-800' };
}

function getTypeBadge(type: string) {
  const map: Record<string, { label: string; className: string }> = {
    casual: { label: 'Casual', className: 'bg-blue-100 text-blue-800' },
    business: { label: 'Business', className: 'bg-slate-100 text-slate-800' },
    social: { label: 'Social', className: 'bg-purple-100 text-purple-800' },
    networking: { label: 'Networking', className: 'bg-emerald-100 text-emerald-800' },
    activity: { label: 'Activity', className: 'bg-orange-100 text-orange-800' },
  };
  return map[type] ?? { label: type, className: 'bg-gray-100 text-gray-800' };
}

function getLocationLabel(type: string) {
  const map: Record<string, string> = {
    hotel_lobby: 'Hotel Lobby',
    restaurant: 'Restaurant',
    bar: 'Bar',
    meeting_room: 'Meeting Room',
    outdoor: 'Outdoor',
    other: 'Other',
  };
  return map[type] ?? type;
}

function isToday(dateStr: string): boolean {
  const d = new Date(dateStr);
  const now = new Date();
  return (
    d.getFullYear() === now.getFullYear() &&
    d.getMonth() === now.getMonth() &&
    d.getDate() === now.getDate()
  );
}

// ---------------------------------------------------------------------------
// Component
// ---------------------------------------------------------------------------

function FrontDeskMeetUp() {
  const { user } = useAuth();
  const { selectedProperty, selectedPropertyId } = useProperty();
  const queryClient = useQueryClient();

  const hotelId = useMemo(() => {
    if (selectedPropertyId) return selectedPropertyId;
    if (!user?.hotelId) return undefined;
    return typeof user.hotelId === 'string'
      ? user.hotelId
      : (user.hotelId as { _id: string })._id;
  }, [selectedPropertyId, user?.hotelId]);

  // UI state
  const [activeTab, setActiveTab] = useState<ActiveTab>('all-meetups');
  const [statusFilter, setStatusFilter] = useState<MeetUpStatus>('all');
  const [searchTerm, setSearchTerm] = useState('');
  const [currentPage, setCurrentPage] = useState(1);
  const [upcomingPage, setUpcomingPage] = useState(1);
  const [selectedMeetUp, setSelectedMeetUp] = useState<MeetUpRequest | null>(null);
  const [showConcernModal, setShowConcernModal] = useState(false);
  const [concernForm, setConcernForm] = useState<SafetyConcernForm>({
    meetUpId: '',
    meetUpTitle: '',
    reason: 'safety',
    details: '',
  });
  const [refreshing, setRefreshing] = useState(false);

  const PAGE_SIZE = 20;

  // -----------------------------------------------------------------------
  // Queries
  // -----------------------------------------------------------------------

  // All meet-ups (paginated, filtered)
  const {
    data: meetUpsData,
    isLoading: meetUpsLoading,
    error: meetUpsError,
  } = useQuery({
    queryKey: [
      'frontdesk-meetups-all',
      hotelId,
      currentPage,
      statusFilter,
      searchTerm,
    ],
    queryFn: () =>
      meetUpRequestService.getAdminAllMeetUps({
        hotelId,
        page: currentPage,
        limit: PAGE_SIZE,
        status: statusFilter === 'all' ? undefined : statusFilter,
        search: searchTerm || undefined,
      }),
    enabled: !!hotelId,
    placeholderData: keepPreviousData,
    refetchInterval: 30_000,
  });

  // Upcoming meet-ups (today + future accepted)
  const {
    data: upcomingData,
    isLoading: upcomingLoading,
  } = useQuery({
    queryKey: ['frontdesk-meetups-upcoming', hotelId, upcomingPage],
    queryFn: () =>
      meetUpRequestService.getAdminAllMeetUps({
        hotelId,
        page: upcomingPage,
        limit: PAGE_SIZE,
        status: 'accepted',
      }),
    enabled: !!hotelId && activeTab === 'upcoming',
    placeholderData: keepPreviousData,
    refetchInterval: 30_000,
  });

  // Insights / stats
  const {
    data: insightsData,
    isLoading: insightsLoading,
  } = useQuery({
    queryKey: ['frontdesk-meetup-insights', hotelId],
    queryFn: () => meetUpRequestService.getAdminInsights({ hotelId }),
    enabled: !!hotelId,
    staleTime: 60_000,
  });

  // Quick stats: counts per status for this hotel
  const {
    data: quickStatsData,
  } = useQuery({
    queryKey: ['frontdesk-meetup-quick-stats', hotelId],
    queryFn: async () => {
      // Fetch small pages to get counts
      const [allRes, pendingRes, acceptedRes, completedTodayRes] = await Promise.all([
        meetUpRequestService.getAdminAllMeetUps({ hotelId, page: 1, limit: 1 }),
        meetUpRequestService.getAdminAllMeetUps({ hotelId, page: 1, limit: 1, status: 'pending' }),
        meetUpRequestService.getAdminAllMeetUps({ hotelId, page: 1, limit: 1, status: 'accepted' }),
        meetUpRequestService.getAdminAllMeetUps({
          hotelId,
          page: 1,
          limit: 1,
          status: 'completed',
          dateFrom: new Date().toISOString().split('T')[0],
          dateTo: new Date().toISOString().split('T')[0],
        }),
      ]);
      return {
        total: allRes.pagination?.totalItems ?? 0,
        pending: pendingRes.pagination?.totalItems ?? 0,
        active: acceptedRes.pagination?.totalItems ?? 0,
        completedToday: completedTodayRes.pagination?.totalItems ?? 0,
        requireSupervision: insightsData?.safetyInsights?.hotelStaffPresent ?? 0,
      };
    },
    enabled: !!hotelId,
    staleTime: 30_000,
  });

  // -----------------------------------------------------------------------
  // Mutations
  // -----------------------------------------------------------------------

  const reportConcernMutation = useMutation({
    mutationFn: async (form: SafetyConcernForm) => {
      // Use the admin/all endpoint data to find the meet-up, then report via the report endpoint.
      // The report endpoint requires a reportedUserId. We'll send the meet-up's requester.
      const meetUp = meetUpsData?.meetUps?.find((m) => m._id === form.meetUpId);
      if (!meetUp) throw new Error('Meet-up not found');

      // We report to the admin safety concern flow.
      // Since the /report endpoint expects a guest-to-guest report,
      // we'll use a direct API call to flag the safety concern via staff alert.
      const response = await api.post('/staff-alerts', {
        hotelId,
        type: 'safety',
        title: `Safety Concern: ${form.meetUpTitle}`,
        message: `Reason: ${form.reason}. Details: ${form.details}. Meet-up ID: ${form.meetUpId}`,
        priority: 'high',
        metadata: {
          category: 'meetup_safety',
          meetUpId: form.meetUpId,
        },
      });
      return response.data;
    },
    onSuccess: () => {
      setShowConcernModal(false);
      setConcernForm({ meetUpId: '', meetUpTitle: '', reason: 'safety', details: '' });
      queryClient.invalidateQueries({ queryKey: ['frontdesk-meetups-all'] });
    },
  });

  // -----------------------------------------------------------------------
  // Handlers
  // -----------------------------------------------------------------------

  const handleRefresh = useCallback(() => {
    setRefreshing(true);
    Promise.all([
      queryClient.invalidateQueries({ queryKey: ['frontdesk-meetups-all'] }),
      queryClient.invalidateQueries({ queryKey: ['frontdesk-meetups-upcoming'] }),
      queryClient.invalidateQueries({ queryKey: ['frontdesk-meetup-insights'] }),
      queryClient.invalidateQueries({ queryKey: ['frontdesk-meetup-quick-stats'] }),
    ]).finally(() => setTimeout(() => setRefreshing(false), 500));
  }, [queryClient]);

  const handleViewDetails = (meetUp: MeetUpRequest) => {
    setSelectedMeetUp(meetUp);
    setActiveTab('details');
  };

  const handleBackToList = () => {
    setSelectedMeetUp(null);
    setActiveTab('all-meetups');
  };

  const handleOpenConcernModal = (meetUp: MeetUpRequest) => {
    setConcernForm({
      meetUpId: meetUp._id,
      meetUpTitle: meetUp.title,
      reason: 'safety',
      details: '',
    });
    setShowConcernModal(true);
  };

  const handleSubmitConcern = () => {
    if (!concernForm.details.trim()) return;
    reportConcernMutation.mutate(concernForm);
  };

  const handleTabChange = (tab: ActiveTab) => {
    setActiveTab(tab);
    if (tab === 'all-meetups') setCurrentPage(1);
    if (tab === 'upcoming') setUpcomingPage(1);
  };

  // -----------------------------------------------------------------------
  // No property guard
  // -----------------------------------------------------------------------

  if (!selectedProperty && !hotelId) {
    return (
      <div className="space-y-6">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Meet-Up Management</h1>
          <p className="mt-1 text-gray-600">
            Monitor and manage guest meet-ups at the property
          </p>
        </div>
        <div className="bg-yellow-50 border-l-4 border-yellow-400 p-4 rounded-lg">
          <div className="flex items-center">
            <AlertTriangle className="h-5 w-5 text-yellow-400 mr-3" />
            <p className="text-sm font-medium text-yellow-800">
              Please select a property to view meet-up data.
            </p>
          </div>
        </div>
      </div>
    );
  }

  // -----------------------------------------------------------------------
  // Derived data
  // -----------------------------------------------------------------------

  const meetUps = meetUpsData?.meetUps ?? [];
  const pagination = meetUpsData?.pagination;
  const upcomingMeetUps = upcomingData?.meetUps ?? [];
  const upcomingPagination = upcomingData?.pagination;
  const todayMeetUps = upcomingMeetUps.filter((m) => isToday(m.proposedDate));

  const stats = quickStatsData ?? {
    total: 0,
    pending: 0,
    active: 0,
    completedToday: 0,
    requireSupervision: 0,
  };

  // -----------------------------------------------------------------------
  // Tab definitions
  // -----------------------------------------------------------------------

  const tabs: Array<{ id: ActiveTab; label: string; count?: number }> = [
    { id: 'all-meetups', label: 'All Meet-ups', count: stats.total },
    { id: 'upcoming', label: 'Upcoming / Today', count: stats.active },
    { id: 'safety-concerns', label: 'Safety Insights' },
    { id: 'insights', label: 'Analytics' },
  ];

  // -----------------------------------------------------------------------
  // Render
  // -----------------------------------------------------------------------

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex justify-between items-center">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Meet-Up Management</h1>
          <p className="text-gray-600">
            Monitor guest meet-ups at {selectedProperty?.name ?? 'the property'}
          </p>
        </div>
        <Button
          onClick={handleRefresh}
          disabled={refreshing}
          variant="outline"
          className="flex items-center"
        >
          <RefreshCw className={cn('w-4 h-4 mr-2', refreshing && 'animate-spin')} />
          Refresh
        </Button>
      </div>

      {/* Info Notice */}
      <div className="bg-blue-50 border border-blue-200 rounded-lg p-4">
        <p className="text-sm text-blue-800 flex items-start gap-2">
          <Info className="w-4 h-4 mt-0.5 flex-shrink-0" />
          <span>
            <strong>Front Desk Access:</strong> You can view all meet-ups, see safety details, and
            flag safety concerns. Administrative actions such as force-cancelling or managing
            meet-up policies are restricted to administrators.
          </span>
        </p>
      </div>

      {/* Quick Stats */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-5 gap-4">
        <Card>
          <CardContent className="p-4">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-gray-500">Total Meet-ups</p>
                <p className="text-2xl font-bold text-gray-900">{stats.total}</p>
              </div>
              <Users className="w-8 h-8 text-blue-500 opacity-70" />
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardContent className="p-4">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-gray-500">Pending</p>
                <p className="text-2xl font-bold text-yellow-600">{stats.pending}</p>
              </div>
              <Clock className="w-8 h-8 text-yellow-500 opacity-70" />
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardContent className="p-4">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-gray-500">Active (Accepted)</p>
                <p className="text-2xl font-bold text-green-600">{stats.active}</p>
              </div>
              <Activity className="w-8 h-8 text-green-500 opacity-70" />
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardContent className="p-4">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-gray-500">Require Supervision</p>
                <p className="text-2xl font-bold text-red-600">{stats.requireSupervision}</p>
              </div>
              <Shield className="w-8 h-8 text-red-500 opacity-70" />
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardContent className="p-4">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-gray-500">Completed Today</p>
                <p className="text-2xl font-bold text-blue-600">{stats.completedToday}</p>
              </div>
              <CheckCircle className="w-8 h-8 text-blue-500 opacity-70" />
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Tabs */}
      {activeTab !== 'details' && (
        <div className="border-b border-gray-200">
          <nav className="-mb-px flex space-x-8">
            {tabs.map((tab) => (
              <button
                key={tab.id}
                onClick={() => handleTabChange(tab.id)}
                className={cn(
                  'py-2 px-1 border-b-2 font-medium text-sm whitespace-nowrap',
                  activeTab === tab.id
                    ? 'border-blue-500 text-blue-600'
                    : 'border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300'
                )}
              >
                {tab.label}
                {tab.count != null && tab.count > 0 && (
                  <span className="ml-2 bg-gray-100 text-gray-900 py-0.5 px-2.5 rounded-full text-xs">
                    {tab.count}
                  </span>
                )}
              </button>
            ))}
          </nav>
        </div>
      )}

      {/* ================================================================= */}
      {/* TAB: All Meet-ups                                                 */}
      {/* ================================================================= */}
      {activeTab === 'all-meetups' && (
        <>
          {/* Filters */}
          <Card>
            <CardContent className="p-4">
              <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                <div className="relative">
                  <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400 h-4 w-4" />
                  <Input
                    type="text"
                    placeholder="Search by title or description..."
                    value={searchTerm}
                    onChange={(e) => {
                      setSearchTerm(e.target.value);
                      setCurrentPage(1);
                    }}
                    className="pl-10"
                  />
                </div>

                <select
                  value={statusFilter}
                  onChange={(e) => {
                    setStatusFilter(e.target.value as MeetUpStatus);
                    setCurrentPage(1);
                  }}
                  className="block w-full rounded-md border border-gray-300 bg-white px-3 py-2 text-sm shadow-sm focus:border-blue-500 focus:ring-blue-500"
                >
                  <option value="all">All Statuses</option>
                  <option value="pending">Pending</option>
                  <option value="accepted">Accepted</option>
                  <option value="declined">Declined</option>
                  <option value="cancelled">Cancelled</option>
                  <option value="completed">Completed</option>
                </select>

                <Button
                  variant="outline"
                  onClick={() => {
                    setSearchTerm('');
                    setStatusFilter('all');
                    setCurrentPage(1);
                  }}
                  className="flex items-center gap-2"
                >
                  <X className="w-4 h-4" />
                  Clear Filters
                </Button>
              </div>
            </CardContent>
          </Card>

          {/* List */}
          {meetUpsLoading ? (
            <div className="flex justify-center py-12">
              <LoadingSpinner size="lg" />
            </div>
          ) : meetUpsError ? (
            <div className="text-center py-12">
              <AlertTriangle className="mx-auto h-12 w-12 text-red-500 mb-4" />
              <h3 className="text-lg font-medium text-gray-900 mb-2">
                Failed to load meet-ups
              </h3>
              <p className="text-gray-500 mb-4">
                There was an error loading the meet-up data.
              </p>
              <Button onClick={() => queryClient.invalidateQueries({ queryKey: ['frontdesk-meetups-all'] })}>
                Try Again
              </Button>
            </div>
          ) : meetUps.length === 0 ? (
            <Card className="p-12 text-center">
              <Users className="h-16 w-16 mx-auto mb-4 text-gray-300" />
              <h3 className="text-xl font-semibold text-gray-600 mb-2">No Meet-ups Found</h3>
              <p className="text-gray-500">
                {searchTerm || statusFilter !== 'all'
                  ? 'No meet-ups match your current filters.'
                  : 'There are no meet-ups at this property yet.'}
              </p>
            </Card>
          ) : (
            <div className="space-y-3">
              {meetUps.map((meetUp) => (
                <MeetUpCard
                  key={meetUp._id}
                  meetUp={meetUp}
                  onViewDetails={handleViewDetails}
                  onFlagConcern={handleOpenConcernModal}
                />
              ))}
            </div>
          )}

          {/* Pagination */}
          {pagination && pagination.totalPages > 1 && (
            <PaginationControls
              currentPage={pagination.currentPage}
              totalPages={pagination.totalPages}
              totalItems={pagination.totalItems}
              hasNext={pagination.hasNext}
              hasPrev={pagination.hasPrev}
              onPageChange={setCurrentPage}
            />
          )}
        </>
      )}

      {/* ================================================================= */}
      {/* TAB: Upcoming / Today                                             */}
      {/* ================================================================= */}
      {activeTab === 'upcoming' && (
        <>
          {upcomingLoading ? (
            <div className="flex justify-center py-12">
              <LoadingSpinner size="lg" />
            </div>
          ) : upcomingMeetUps.length === 0 ? (
            <Card className="p-12 text-center">
              <Calendar className="h-16 w-16 mx-auto mb-4 text-gray-300" />
              <h3 className="text-xl font-semibold text-gray-600 mb-2">No Upcoming Meet-ups</h3>
              <p className="text-gray-500">
                There are no accepted meet-ups scheduled.
              </p>
            </Card>
          ) : (
            <>
              {/* Today's meet-ups section */}
              {todayMeetUps.length > 0 && (
                <Card>
                  <CardHeader>
                    <CardTitle className="text-lg flex items-center gap-2">
                      <Calendar className="w-5 h-5 text-blue-500" />
                      Today's Schedule ({todayMeetUps.length})
                    </CardTitle>
                  </CardHeader>
                  <CardContent>
                    <div className="space-y-3">
                      {todayMeetUps.map((meetUp) => (
                        <MeetUpCard
                          key={meetUp._id}
                          meetUp={meetUp}
                          onViewDetails={handleViewDetails}
                          onFlagConcern={handleOpenConcernModal}
                          compact
                        />
                      ))}
                    </div>
                  </CardContent>
                </Card>
              )}

              {/* All upcoming */}
              <Card>
                <CardHeader>
                  <CardTitle className="text-lg flex items-center gap-2">
                    <Clock className="w-5 h-5 text-green-500" />
                    All Upcoming Accepted Meet-ups
                  </CardTitle>
                </CardHeader>
                <CardContent>
                  <div className="space-y-3">
                    {upcomingMeetUps.map((meetUp) => (
                      <MeetUpCard
                        key={meetUp._id}
                        meetUp={meetUp}
                        onViewDetails={handleViewDetails}
                        onFlagConcern={handleOpenConcernModal}
                        compact
                      />
                    ))}
                  </div>
                </CardContent>
              </Card>

              {upcomingPagination && upcomingPagination.totalPages > 1 && (
                <PaginationControls
                  currentPage={upcomingPagination.currentPage}
                  totalPages={upcomingPagination.totalPages}
                  totalItems={upcomingPagination.totalItems}
                  hasNext={upcomingPagination.hasNext}
                  hasPrev={upcomingPagination.hasPrev}
                  onPageChange={setUpcomingPage}
                />
              )}
            </>
          )}
        </>
      )}

      {/* ================================================================= */}
      {/* TAB: Meet-up Details                                              */}
      {/* ================================================================= */}
      {activeTab === 'details' && selectedMeetUp && (
        <MeetUpDetailsPanel
          meetUp={selectedMeetUp}
          onBack={handleBackToList}
          onFlagConcern={handleOpenConcernModal}
        />
      )}

      {/* ================================================================= */}
      {/* TAB: Safety Insights                                              */}
      {/* ================================================================= */}
      {activeTab === 'safety-concerns' && (
        <SafetyInsightsPanel insights={insightsData} loading={insightsLoading} />
      )}

      {/* ================================================================= */}
      {/* TAB: Analytics / Insights                                         */}
      {/* ================================================================= */}
      {activeTab === 'insights' && (
        <AnalyticsPanel insights={insightsData} loading={insightsLoading} />
      )}

      {/* ================================================================= */}
      {/* Modal: Flag Safety Concern                                        */}
      {/* ================================================================= */}
      {showConcernModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50">
          <div className="bg-white rounded-lg shadow-xl max-w-lg w-full mx-4 p-6">
            <div className="flex items-center justify-between mb-4">
              <h3 className="text-lg font-semibold text-gray-900">Flag Safety Concern</h3>
              <button
                onClick={() => setShowConcernModal(false)}
                className="text-gray-400 hover:text-gray-600"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <p className="text-sm text-gray-600 mb-4">
              Meet-up: <strong>{concernForm.meetUpTitle}</strong>
            </p>

            <div className="space-y-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Concern Type
                </label>
                <select
                  value={concernForm.reason}
                  onChange={(e) =>
                    setConcernForm((prev) => ({ ...prev, reason: e.target.value }))
                  }
                  className="block w-full rounded-md border border-gray-300 bg-white px-3 py-2 text-sm shadow-sm focus:border-blue-500 focus:ring-blue-500"
                >
                  <option value="safety">General Safety Concern</option>
                  <option value="harassment">Harassment Report</option>
                  <option value="inappropriate">Inappropriate Behavior</option>
                  <option value="suspicious">Suspicious Activity</option>
                  <option value="noise">Noise / Disturbance</option>
                  <option value="other">Other</option>
                </select>
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Details <span className="text-red-500">*</span>
                </label>
                <textarea
                  value={concernForm.details}
                  onChange={(e) =>
                    setConcernForm((prev) => ({ ...prev, details: e.target.value }))
                  }
                  placeholder="Describe the safety concern in detail..."
                  rows={4}
                  className="block w-full rounded-md border border-gray-300 px-3 py-2 text-sm shadow-sm focus:border-blue-500 focus:ring-blue-500"
                />
              </div>

              {reportConcernMutation.isError && (
                <div className="bg-red-50 border border-red-200 rounded p-3 text-sm text-red-700">
                  {(reportConcernMutation.error as Error)?.message || 'Failed to submit concern'}
                </div>
              )}
            </div>

            <div className="flex justify-end gap-3 mt-6">
              <Button variant="outline" onClick={() => setShowConcernModal(false)}>
                Cancel
              </Button>
              <Button
                onClick={handleSubmitConcern}
                disabled={
                  !concernForm.details.trim() || reportConcernMutation.isPending
                }
                className="bg-red-600 hover:bg-red-700 text-white"
              >
                {reportConcernMutation.isPending ? (
                  <LoadingSpinner size="sm" className="mr-2" />
                ) : (
                  <Flag className="w-4 h-4 mr-2" />
                )}
                Submit Concern
              </Button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

// ===========================================================================
// Sub-components
// ===========================================================================

// ---------------------------------------------------------------------------
// MeetUpCard
// ---------------------------------------------------------------------------

function MeetUpCard({
  meetUp,
  onViewDetails,
  onFlagConcern,
  compact = false,
}: {
  meetUp: MeetUpRequest;
  onViewDetails: (m: MeetUpRequest) => void;
  onFlagConcern: (m: MeetUpRequest) => void;
  compact?: boolean;
}) {
  const statusBadge = getStatusBadge(meetUp.status);
  const typeBadge = getTypeBadge(meetUp.type);
  const needsSupervision = meetUp.safety?.hotelStaffPresent === true;

  return (
    <div
      className={cn(
        'flex items-start justify-between p-4 bg-white rounded-lg border border-gray-200 hover:border-gray-300 transition-colors',
        needsSupervision && 'border-l-4 border-l-red-400'
      )}
    >
      <div className="flex-1 min-w-0">
        <div className="flex items-center gap-2 mb-2 flex-wrap">
          <h4 className={cn('font-semibold text-gray-900', compact ? 'text-sm' : 'text-base')}>
            {meetUp.title}
          </h4>
          <Badge className={cn('text-xs', typeBadge.className)}>{typeBadge.label}</Badge>
          <Badge className={cn('text-xs', statusBadge.className)}>{statusBadge.label}</Badge>
          {needsSupervision && (
            <Badge className="text-xs bg-red-100 text-red-800">Staff Required</Badge>
          )}
          {isToday(meetUp.proposedDate) && meetUp.status === 'accepted' && (
            <Badge className="text-xs bg-indigo-100 text-indigo-800">Today</Badge>
          )}
        </div>

        {!compact && meetUp.description && (
          <p className="text-sm text-gray-600 mb-2 line-clamp-2">{meetUp.description}</p>
        )}

        <div className={cn('flex flex-wrap gap-4 text-sm text-gray-500', compact ? 'gap-3' : 'gap-4')}>
          <span className="flex items-center gap-1">
            <Users className="w-3.5 h-3.5" />
            {meetUp.requesterId?.name ?? 'Unknown'} → {meetUp.targetUserId?.name ?? 'Unknown'}
          </span>
          <span className="flex items-center gap-1">
            <Calendar className="w-3.5 h-3.5" />
            {formatDate(meetUp.proposedDate)}
          </span>
          <span className="flex items-center gap-1">
            <Clock className="w-3.5 h-3.5" />
            {meetUp.proposedTime?.start ?? '--:--'} - {meetUp.proposedTime?.end ?? '--:--'}
          </span>
          <span className="flex items-center gap-1">
            <MapPin className="w-3.5 h-3.5" />
            {meetUp.location?.name || getLocationLabel(meetUp.location?.type) || 'Not specified'}
          </span>
        </div>
      </div>

      <div className="flex items-center gap-2 ml-4 flex-shrink-0">
        <Button variant="outline" size="sm" onClick={() => onViewDetails(meetUp)}>
          <Eye className="w-4 h-4 mr-1" />
          Details
        </Button>
        {(meetUp.status === 'accepted' || meetUp.status === 'pending') && (
          <Button
            variant="outline"
            size="sm"
            onClick={() => onFlagConcern(meetUp)}
            className="text-red-600 hover:text-red-700 hover:bg-red-50 border-red-200"
          >
            <Flag className="w-4 h-4" />
          </Button>
        )}
      </div>
    </div>
  );
}

// ---------------------------------------------------------------------------
// MeetUpDetailsPanel
// ---------------------------------------------------------------------------

function MeetUpDetailsPanel({
  meetUp,
  onBack,
  onFlagConcern,
}: {
  meetUp: MeetUpRequest;
  onBack: () => void;
  onFlagConcern: (m: MeetUpRequest) => void;
}) {
  const statusBadge = getStatusBadge(meetUp.status);
  const typeBadge = getTypeBadge(meetUp.type);

  return (
    <div className="space-y-6">
      {/* Back button */}
      <Button variant="outline" onClick={onBack} className="flex items-center gap-2">
        <ChevronLeft className="w-4 h-4" />
        Back to list
      </Button>

      {/* Title & badges */}
      <div className="flex items-start justify-between">
        <div>
          <h2 className="text-xl font-bold text-gray-900 mb-2">{meetUp.title}</h2>
          <div className="flex items-center gap-2 flex-wrap">
            <Badge className={cn('text-xs', typeBadge.className)}>{typeBadge.label}</Badge>
            <Badge className={cn('text-xs', statusBadge.className)}>{statusBadge.label}</Badge>
            {meetUp.safety?.hotelStaffPresent && (
              <Badge className="text-xs bg-red-100 text-red-800">Staff Presence Required</Badge>
            )}
            {meetUp.safety?.verifiedOnly && (
              <Badge className="text-xs bg-blue-100 text-blue-800">Verified Only</Badge>
            )}
            {meetUp.safety?.publicLocation && (
              <Badge className="text-xs bg-green-100 text-green-800">Public Location</Badge>
            )}
          </div>
        </div>
        {(meetUp.status === 'accepted' || meetUp.status === 'pending') && (
          <Button
            variant="outline"
            onClick={() => onFlagConcern(meetUp)}
            className="text-red-600 hover:text-red-700 hover:bg-red-50 border-red-200"
          >
            <Flag className="w-4 h-4 mr-2" />
            Flag Concern
          </Button>
        )}
      </div>

      {/* Description */}
      {meetUp.description && (
        <Card>
          <CardHeader>
            <CardTitle className="text-base">Description</CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-sm text-gray-700 whitespace-pre-wrap">{meetUp.description}</p>
          </CardContent>
        </Card>
      )}

      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        {/* Participants */}
        <Card>
          <CardHeader>
            <CardTitle className="text-base flex items-center gap-2">
              <Users className="w-4 h-4" />
              Participants
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-3">
            <div className="flex items-center justify-between p-3 bg-gray-50 rounded-lg">
              <div>
                <p className="text-sm font-medium text-gray-900">
                  {meetUp.requesterId?.name ?? 'Unknown'}
                </p>
                <p className="text-xs text-gray-500">{meetUp.requesterId?.email ?? ''}</p>
              </div>
              <Badge className="text-xs bg-blue-100 text-blue-800">Requester</Badge>
            </div>
            <div className="flex items-center justify-between p-3 bg-gray-50 rounded-lg">
              <div>
                <p className="text-sm font-medium text-gray-900">
                  {meetUp.targetUserId?.name ?? 'Unknown'}
                </p>
                <p className="text-xs text-gray-500">{meetUp.targetUserId?.email ?? ''}</p>
              </div>
              <Badge className="text-xs bg-purple-100 text-purple-800">Invitee</Badge>
            </div>
            {meetUp.participants?.confirmedParticipants?.length > 0 && (
              <>
                <p className="text-xs font-medium text-gray-500 mt-2">Additional Participants</p>
                {meetUp.participants.confirmedParticipants.map((p, i) => (
                  <div
                    key={i}
                    className="flex items-center justify-between p-3 bg-gray-50 rounded-lg"
                  >
                    <div>
                      <p className="text-sm font-medium text-gray-900">{p.name}</p>
                      <p className="text-xs text-gray-500">{p.email}</p>
                    </div>
                    <Badge className="text-xs bg-gray-100 text-gray-800">Participant</Badge>
                  </div>
                ))}
              </>
            )}
            <div className="text-xs text-gray-500 mt-2">
              {meetUp.participantCount ?? 0} / {meetUp.participants?.maxParticipants ?? 2} spots
              filled
            </div>
          </CardContent>
        </Card>

        {/* Schedule & Location */}
        <Card>
          <CardHeader>
            <CardTitle className="text-base flex items-center gap-2">
              <Calendar className="w-4 h-4" />
              Schedule & Location
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <div>
              <p className="text-xs font-medium text-gray-500 mb-1">Date</p>
              <p className="text-sm text-gray-900">{formatDate(meetUp.proposedDate, 'long')}</p>
            </div>
            <div>
              <p className="text-xs font-medium text-gray-500 mb-1">Time</p>
              <p className="text-sm text-gray-900">
                {meetUp.proposedTime?.start ?? '--:--'} - {meetUp.proposedTime?.end ?? '--:--'}
              </p>
            </div>
            <div>
              <p className="text-xs font-medium text-gray-500 mb-1">Location</p>
              <p className="text-sm text-gray-900">
                {meetUp.location?.name || getLocationLabel(meetUp.location?.type) || 'Not specified'}
              </p>
              {meetUp.location?.details && (
                <p className="text-xs text-gray-500 mt-1">{meetUp.location.details}</p>
              )}
            </div>
            {meetUp.meetingRoomBooking?.roomId && (
              <div>
                <p className="text-xs font-medium text-gray-500 mb-1">Meeting Room</p>
                <p className="text-sm text-gray-900">
                  Room {meetUp.meetingRoomBooking.roomId.number} (
                  {meetUp.meetingRoomBooking.roomId.type})
                </p>
              </div>
            )}
            {meetUp.activity && (
              <div>
                <p className="text-xs font-medium text-gray-500 mb-1">Activity</p>
                <p className="text-sm text-gray-900 capitalize">{meetUp.activity.type}</p>
                {meetUp.activity.duration > 0 && (
                  <p className="text-xs text-gray-500">
                    Duration: {meetUp.activity.duration} min
                    {meetUp.activity.cost > 0 && ` | Cost: $${meetUp.activity.cost}`}
                    {meetUp.activity.costSharing && ' (shared)'}
                  </p>
                )}
              </div>
            )}
          </CardContent>
        </Card>
      </div>

      {/* Safety & Supervision Details */}
      <Card>
        <CardHeader>
          <CardTitle className="text-base flex items-center gap-2">
            <Shield className="w-4 h-4" />
            Safety & Supervision
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            <div className="bg-gray-50 rounded-lg p-4 text-center">
              <p className="text-sm text-gray-600 font-medium mb-1">Verified Only</p>
              <p className="text-lg font-semibold">
                {meetUp.safety?.verifiedOnly ? (
                  <span className="text-green-600">Yes</span>
                ) : (
                  <span className="text-gray-400">No</span>
                )}
              </p>
            </div>
            <div className="bg-gray-50 rounded-lg p-4 text-center">
              <p className="text-sm text-gray-600 font-medium mb-1">Public Location</p>
              <p className="text-lg font-semibold">
                {meetUp.safety?.publicLocation ? (
                  <span className="text-green-600">Yes</span>
                ) : (
                  <span className="text-gray-400">No</span>
                )}
              </p>
            </div>
            <div className="bg-gray-50 rounded-lg p-4 text-center">
              <p className="text-sm text-gray-600 font-medium mb-1">Staff Presence</p>
              <p className="text-lg font-semibold">
                {meetUp.safety?.hotelStaffPresent ? (
                  <span className="text-red-600">Required</span>
                ) : (
                  <span className="text-gray-400">Not Required</span>
                )}
              </p>
            </div>
          </div>

          {meetUp.response && (
            <div className="mt-4 bg-blue-50 rounded-lg p-4">
              <p className="text-xs font-medium text-blue-600 mb-1">Response</p>
              <p className="text-sm text-blue-800">
                Status: {meetUp.response.status}
                {meetUp.response.message && ` - ${meetUp.response.message}`}
              </p>
              {meetUp.response.respondedAt && (
                <p className="text-xs text-blue-600 mt-1">
                  Responded: {formatDate(meetUp.response.respondedAt)}
                </p>
              )}
            </div>
          )}
        </CardContent>
      </Card>

      {/* Metadata */}
      {meetUp.metadata && (
        <Card>
          <CardHeader>
            <CardTitle className="text-base">Additional Details</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="flex flex-wrap gap-4">
              {meetUp.metadata.category && (
                <div>
                  <p className="text-xs font-medium text-gray-500">Category</p>
                  <p className="text-sm text-gray-900 capitalize">{meetUp.metadata.category}</p>
                </div>
              )}
              {meetUp.metadata.difficulty && (
                <div>
                  <p className="text-xs font-medium text-gray-500">Difficulty</p>
                  <p className="text-sm text-gray-900 capitalize">{meetUp.metadata.difficulty}</p>
                </div>
              )}
              {meetUp.metadata.tags && meetUp.metadata.tags.length > 0 && (
                <div>
                  <p className="text-xs font-medium text-gray-500 mb-1">Tags</p>
                  <div className="flex flex-wrap gap-1">
                    {meetUp.metadata.tags.map((tag, i) => (
                      <Badge key={i} className="text-xs bg-gray-100 text-gray-700">
                        {tag}
                      </Badge>
                    ))}
                  </div>
                </div>
              )}
            </div>
          </CardContent>
        </Card>
      )}

      {/* Timestamps */}
      <div className="text-xs text-gray-400 flex gap-6">
        <span>Created: {formatDate(meetUp.createdAt)}</span>
        <span>Updated: {formatDate(meetUp.updatedAt)}</span>
      </div>
    </div>
  );
}

// ---------------------------------------------------------------------------
// SafetyInsightsPanel
// ---------------------------------------------------------------------------

function SafetyInsightsPanel({
  insights,
  loading,
}: {
  insights?: AdminInsights;
  loading: boolean;
}) {
  if (loading) {
    return (
      <div className="flex justify-center py-12">
        <LoadingSpinner size="lg" />
      </div>
    );
  }

  if (!insights) {
    return (
      <Card className="p-12 text-center">
        <Shield className="h-16 w-16 mx-auto mb-4 text-gray-300" />
        <h3 className="text-xl font-semibold text-gray-600 mb-2">No Safety Data</h3>
        <p className="text-gray-500">Safety insights are not available at this time.</p>
      </Card>
    );
  }

  const safety = insights.safetyInsights;
  const risk = insights.riskAssessment;

  return (
    <div className="space-y-6">
      {/* Safety Preferences Overview */}
      <Card>
        <CardHeader>
          <CardTitle className="text-lg flex items-center gap-2">
            <Shield className="w-5 h-5 text-green-500" />
            Safety Preferences Overview
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
            <div className="bg-gray-50 rounded-lg p-4 text-center">
              <p className="text-sm text-gray-600 font-medium">Total Requests</p>
              <p className="text-2xl font-bold text-gray-900">{safety.totalRequests}</p>
            </div>
            <div className="bg-blue-50 rounded-lg p-4 text-center">
              <p className="text-sm text-blue-600 font-medium">Verified Only</p>
              <p className="text-2xl font-bold text-blue-800">{safety.verifiedOnly}</p>
              {safety.totalRequests > 0 && (
                <p className="text-xs text-blue-500">
                  {((safety.verifiedOnly / safety.totalRequests) * 100).toFixed(1)}%
                </p>
              )}
            </div>
            <div className="bg-green-50 rounded-lg p-4 text-center">
              <p className="text-sm text-green-600 font-medium">Public Location</p>
              <p className="text-2xl font-bold text-green-800">{safety.publicLocation}</p>
              {safety.totalRequests > 0 && (
                <p className="text-xs text-green-500">
                  {((safety.publicLocation / safety.totalRequests) * 100).toFixed(1)}%
                </p>
              )}
            </div>
            <div className="bg-red-50 rounded-lg p-4 text-center">
              <p className="text-sm text-red-600 font-medium">Staff Presence Required</p>
              <p className="text-2xl font-bold text-red-800">{safety.hotelStaffPresent}</p>
              {safety.totalRequests > 0 && (
                <p className="text-xs text-red-500">
                  {((safety.hotelStaffPresent / safety.totalRequests) * 100).toFixed(1)}%
                </p>
              )}
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Risk Assessment */}
      <Card>
        <CardHeader>
          <CardTitle className="text-lg flex items-center gap-2">
            <AlertTriangle className="w-5 h-5 text-orange-500" />
            Risk Assessment
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mb-6">
            <div className="bg-orange-50 rounded-lg p-4">
              <p className="text-sm text-orange-600 font-medium">Potentially Risky Meet-ups</p>
              <p className="text-2xl font-bold text-orange-800">
                {risk.potentiallyRiskyMeetUps}
              </p>
              <p className="text-xs text-orange-500 mt-1">
                Declined or missing safety preferences
              </p>
            </div>
            <div className="bg-amber-50 rounded-lg p-4">
              <p className="text-sm text-amber-600 font-medium">Frequent Requesters</p>
              <p className="text-2xl font-bold text-amber-800">
                {risk.frequentRequesters}
              </p>
              <p className="text-xs text-amber-500 mt-1">
                Users with more than 10 requests
              </p>
            </div>
          </div>

          {risk.riskyMeetUpDetails && risk.riskyMeetUpDetails.length > 0 && (
            <div>
              <h4 className="text-sm font-medium text-gray-700 mb-3">
                Recent Risk Flagged Meet-ups (up to 10)
              </h4>
              <div className="space-y-2">
                {risk.riskyMeetUpDetails.slice(0, 10).map((m) => {
                  const sBadge = getStatusBadge(m.status);
                  return (
                    <div
                      key={m._id}
                      className="flex items-center justify-between p-3 bg-gray-50 rounded border border-gray-100"
                    >
                      <div className="flex-1 min-w-0">
                        <p className="text-sm font-medium text-gray-900 truncate">{m.title}</p>
                        <p className="text-xs text-gray-500">
                          {m.requesterId?.name ?? 'Unknown'} → {m.targetUserId?.name ?? 'Unknown'}
                          {' | '}
                          {formatDate(m.proposedDate)}
                        </p>
                      </div>
                      <Badge className={cn('text-xs ml-2', sBadge.className)}>
                        {sBadge.label}
                      </Badge>
                    </div>
                  );
                })}
              </div>
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}

// ---------------------------------------------------------------------------
// AnalyticsPanel
// ---------------------------------------------------------------------------

function AnalyticsPanel({
  insights,
  loading,
}: {
  insights?: AdminInsights;
  loading: boolean;
}) {
  if (loading) {
    return (
      <div className="flex justify-center py-12">
        <LoadingSpinner size="lg" />
      </div>
    );
  }

  if (!insights) {
    return (
      <Card className="p-12 text-center">
        <Activity className="h-16 w-16 mx-auto mb-4 text-gray-300" />
        <h3 className="text-xl font-semibold text-gray-600 mb-2">No Analytics Available</h3>
        <p className="text-gray-500">Analytics data is not available at this time.</p>
      </Card>
    );
  }

  const engagement = insights.userEngagement;
  const hotelPerf = insights.hotelPerformance;

  return (
    <div className="space-y-6">
      {/* User Engagement */}
      <Card>
        <CardHeader>
          <CardTitle className="text-lg flex items-center gap-2">
            <Users className="w-5 h-5 text-blue-500" />
            User Engagement
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            <div className="bg-blue-50 rounded-lg p-4 text-center">
              <p className="text-sm text-blue-600 font-medium">Total Users</p>
              <p className="text-2xl font-bold text-blue-800">{engagement.totalUsers}</p>
              <p className="text-xs text-blue-500">Have used meet-up feature</p>
            </div>
            <div className="bg-green-50 rounded-lg p-4 text-center">
              <p className="text-sm text-green-600 font-medium">Active (Last 30d)</p>
              <p className="text-2xl font-bold text-green-800">{engagement.activeUsers}</p>
            </div>
            <div className="bg-purple-50 rounded-lg p-4 text-center">
              <p className="text-sm text-purple-600 font-medium">Engagement Rate</p>
              <p className="text-2xl font-bold text-purple-800">
                {engagement.engagementRate.toFixed(1)}%
              </p>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Under-performing Hotels */}
      {hotelPerf.underperformingHotels && hotelPerf.underperformingHotels.length > 0 && (
        <Card>
          <CardHeader>
            <CardTitle className="text-lg flex items-center gap-2">
              <AlertTriangle className="w-5 h-5 text-amber-500" />
              Low Acceptance Rate Properties
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="space-y-2">
              {hotelPerf.underperformingHotels.map((h) => (
                <div
                  key={h._id}
                  className="flex items-center justify-between p-3 bg-gray-50 rounded border border-gray-100"
                >
                  <p className="text-sm font-medium text-gray-900">
                    {h.hotelName ?? 'Unknown Hotel'}
                  </p>
                  <div className="flex items-center gap-3 text-sm">
                    <span className="text-gray-500">{h.total} total</span>
                    <Badge
                      className={cn(
                        'text-xs',
                        h.acceptanceRate < 0.3
                          ? 'bg-red-100 text-red-800'
                          : 'bg-yellow-100 text-yellow-800'
                      )}
                    >
                      {(h.acceptanceRate * 100).toFixed(0)}% acceptance
                    </Badge>
                  </div>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>
      )}
    </div>
  );
}

// ---------------------------------------------------------------------------
// PaginationControls
// ---------------------------------------------------------------------------

function PaginationControls({
  currentPage,
  totalPages,
  totalItems,
  hasNext,
  hasPrev,
  onPageChange,
}: {
  currentPage: number;
  totalPages: number;
  totalItems: number;
  hasNext: boolean;
  hasPrev: boolean;
  onPageChange: (page: number) => void;
}) {
  return (
    <div className="flex items-center justify-between bg-white px-4 py-3 rounded-lg border border-gray-200">
      <p className="text-sm text-gray-500">
        Page {currentPage} of {totalPages} ({totalItems} total)
      </p>
      <div className="flex items-center gap-2">
        <Button
          variant="outline"
          size="sm"
          disabled={!hasPrev}
          onClick={() => onPageChange(currentPage - 1)}
        >
          <ChevronLeft className="w-4 h-4" />
          Previous
        </Button>
        <Button
          variant="outline"
          size="sm"
          disabled={!hasNext}
          onClick={() => onPageChange(currentPage + 1)}
        >
          Next
          <ChevronRight className="w-4 h-4" />
        </Button>
      </div>
    </div>
  );
}

export default withErrorBoundary(FrontDeskMeetUp);
