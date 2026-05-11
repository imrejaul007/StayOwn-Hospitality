import React, { useMemo, useState, useEffect, useCallback } from 'react';
import { useQuery, useMutation, useQueryClient, keepPreviousData } from '@tanstack/react-query';
import {
  Users,
  Calendar,
  MapPin,
  Clock,
  AlertTriangle,
  CheckCircle,
  XCircle,
  Eye,
  Bell,
  Shield,
  Filter,
  Search,
  RefreshCw,
  ChevronLeft,
  ChevronRight,
  UserCheck,
  Activity
} from 'lucide-react';
import { Card } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import {
  staffMeetUpSupervisionService,
  SupervisionMeetUp,
  UpdateSupervisionStatusRequest
} from '../../services/staffMeetUpSupervisionService';
import { meetUpRequestService, GuestMeetUpReportRow } from '../../services/meetUpRequestService';
import { formatDate } from '../../utils/formatters';
import { format } from 'date-fns';
import { LoadingSpinner } from '../../components/LoadingSpinner';
import { useAuth } from '../../context/AuthContext';
import { realTimeService } from '../../services/realTimeService';
import { withErrorBoundary } from '../../components/ErrorBoundary';

function StaffMeetUpSupervision() {
  const { user } = useAuth();
  const staffHotelId = useMemo(() => {
    if (!user?.hotelId) return undefined;
    return typeof user.hotelId === 'string' ? user.hotelId : (user.hotelId as { _id: string })._id;
  }, [user?.hotelId]);

  const [activeTab, setActiveTab] = useState('requiring-supervision');
  const [searchTerm, setSearchTerm] = useState('');
  const [statusFilter, setStatusFilter] = useState('');
  const [safetyFilter, setSafetyFilter] = useState('');
  const [currentPage, setCurrentPage] = useState(1);
  const [reportPage, setReportPage] = useState(1);
  const [reportStatusFilter, setReportStatusFilter] = useState('');
  const [selectedMeetUp, setSelectedMeetUp] = useState<SupervisionMeetUp | null>(null);
  const [showDetailsModal, setShowDetailsModal] = useState(false);
  const [supervisionStatusInput, setSupervisionStatusInput] = useState<UpdateSupervisionStatusRequest['supervisionStatus']>('assigned');
  const [supervisionNotesInput, setSupervisionNotesInput] = useState('');
  const [actionError, setActionError] = useState<string | null>(null);

  const queryClient = useQueryClient();

  // Real-time: invalidate supervision queries when a supervision update or new
  // alert arrives so all connected staff clients stay in sync without waiting
  // for the 30-second polling interval.
  const handleSupervisionUpdated = useCallback(() => {
    queryClient.invalidateQueries({ queryKey: ['staff-supervision-meetups'] });
    queryClient.invalidateQueries({ queryKey: ['staff-supervision-stats'] });
  }, [queryClient]);

  const handleNewAlert = useCallback(() => {
    queryClient.invalidateQueries({ queryKey: ['staff-supervision-meetups'] });
    queryClient.invalidateQueries({ queryKey: ['staff-supervision-stats'] });
  }, [queryClient]);

  useEffect(() => {
    realTimeService.on('meetup:supervision-updated', handleSupervisionUpdated);
    realTimeService.on('staff-alert:new', handleNewAlert);
    return () => {
      realTimeService.off('meetup:supervision-updated', handleSupervisionUpdated);
      realTimeService.off('staff-alert:new', handleNewAlert);
    };
  }, [handleSupervisionUpdated, handleNewAlert]);

  // Fetch meet-ups requiring supervision via staff supervision endpoint
  const { data: meetUpsData, isLoading, error } = useQuery({
    queryKey: ['staff-supervision-meetups', currentPage, searchTerm, statusFilter, safetyFilter],
    queryFn: () => staffMeetUpSupervisionService.getSupervisionMeetUps({
      page: currentPage,
      limit: 20,
      status: statusFilter || undefined,
      priority: safetyFilter === 'high-risk' ? 'high' : undefined,
      safetyLevel: undefined,
    }),
    placeholderData: keepPreviousData,
    refetchInterval: 30000, // Refresh every 30 seconds
  });

  // Get supervision statistics via staff supervision endpoint
  const { data: supervisionStats, isLoading: statsLoading } = useQuery({
    queryKey: ['staff-supervision-stats'],
    queryFn: () => staffMeetUpSupervisionService.getSupervisionStats('7d'),
    refetchInterval: 60000, // Refresh every minute
  });

  const { data: guestReportsData, isLoading: guestReportsLoading } = useQuery({
    queryKey: ['staff-guest-meetup-reports', staffHotelId, reportPage, reportStatusFilter],
    queryFn: () =>
      meetUpRequestService.getAdminGuestMeetupReports({
        hotelId: staffHotelId,
        page: reportPage,
        limit: 20,
        status: reportStatusFilter || undefined
      }),
    enabled: activeTab === 'guest-reports' && !!staffHotelId,
    staleTime: 30_000,
    placeholderData: keepPreviousData,
  });

  // Mutation: update supervision status
  const updateStatusMutation = useMutation({
    mutationFn: ({ meetUpId, data }: { meetUpId: string; data: UpdateSupervisionStatusRequest }) =>
      staffMeetUpSupervisionService.updateSupervisionStatus(meetUpId, data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['staff-supervision-meetups'] });
      queryClient.invalidateQueries({ queryKey: ['staff-supervision-stats'] });
      setActionError(null);
      setShowDetailsModal(false);
    },
    onError: (err: Error) => {
      setActionError(err.message || 'Failed to update supervision status');
    }
  });

  const handleViewDetails = (meetUp: SupervisionMeetUp) => {
    setSelectedMeetUp(meetUp);
    setSupervisionStatusInput(meetUp.supervisionStatus ?? 'assigned');
    setSupervisionNotesInput(meetUp.supervisionNotes || '');
    setActionError(null);
    setShowDetailsModal(true);
  };

  const handleUpdateSupervisionStatus = () => {
    if (!selectedMeetUp) return;
    updateStatusMutation.mutate({
      meetUpId: selectedMeetUp._id,
      data: {
        supervisionStatus: supervisionStatusInput,
        supervisionNotes: supervisionNotesInput || undefined
      }
    });
  };

  const handleClearFilters = () => {
    setSearchTerm('');
    setStatusFilter('');
    setSafetyFilter('');
    setCurrentPage(1);
  };

  const filteredMeetUps = meetUpsData?.meetUps?.filter(meetUp => {
    const q = searchTerm.trim().toLowerCase();
    const matchesSearch = !q || (
      meetUp.title?.toLowerCase().includes(q) ||
      meetUp.description?.toLowerCase().includes(q) ||
      meetUp.requesterId?.name?.toLowerCase().includes(q) ||
      meetUp.targetUserId?.name?.toLowerCase().includes(q) ||
      meetUp.location?.name?.toLowerCase().includes(q)
    );
    if (!matchesSearch) return false;

    if (safetyFilter === 'staff-required') {
      return meetUp.safety?.hotelStaffPresent === true;
    }
    return true;
  }) || [];

  const tabs: Array<{ id: string; label: string; count?: number }> = [
    // Use server-wide pending supervision count when available; page-local as fallback
    {
      id: 'requiring-supervision',
      label: 'Supervision Required',
      count: supervisionStats?.summary?.pendingSupervision
        ?? filteredMeetUps.filter(m => m.supervision?.priority?.priority !== 'low').length
    },
    { id: 'all-meetups', label: 'All Meet-ups', count: meetUpsData?.pagination?.totalItems },
    // Safety alerts count: server high-risk count when available
    {
      id: 'safety-alerts',
      label: 'Safety Alerts',
      count: supervisionStats?.summary?.highRiskMeetUps
        ?? filteredMeetUps.filter(m => m.supervision?.safetyLevel?.level === 'low').length
    },
    {
      id: 'guest-reports',
      label: 'Guest reports',
      count: guestReportsData?.pagination?.totalItems
    },
    { id: 'statistics', label: 'Statistics' }
  ];

  if (isLoading) {
    return (
      <div className="flex items-center justify-center h-64">
        <LoadingSpinner size="lg" />
      </div>
    );
  }

  if (error) {
    return (
      <div className="p-6">
        <div className="bg-red-50 border border-red-200 rounded-md p-4">
          <div className="flex">
            <AlertTriangle className="h-5 w-5 text-red-400" />
            <div className="ml-3">
              <h3 className="text-sm font-medium text-red-800">Error loading meet-up supervision data</h3>
              <p className="mt-2 text-sm text-red-700">Please try refreshing the page.</p>
            </div>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="p-6 space-y-6">
      {/* Header */}
      <div className="flex justify-between items-center">
        <div>
          <h1 className="text-3xl font-bold text-gray-900">Meet-Up Supervision</h1>
          <p className="text-gray-600 mt-2">Monitor and supervise guest meet-up activities for safety and quality assurance</p>
        </div>
        <div className="flex gap-3">
          <Button
            onClick={() => {
              queryClient.invalidateQueries({ queryKey: ['staff-supervision-meetups'] });
              queryClient.invalidateQueries({ queryKey: ['staff-supervision-stats'] });
              queryClient.invalidateQueries({ queryKey: ['staff-guest-meetup-reports'] });
            }}
            className="flex items-center gap-2 bg-blue-600 hover:bg-blue-700"
          >
            <RefreshCw className="w-4 h-4" />
            Refresh
          </Button>
        </div>
      </div>

      {/* Quick Stats */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-6">
        <Card className="p-6">
          <div className="flex items-center">
            <div className="flex-shrink-0">
              <Users className="h-8 w-8 text-blue-600" />
            </div>
            <div className="ml-5 w-0 flex-1">
              <dl>
                <dt className="text-sm font-medium text-gray-500 truncate">Active Meet-ups</dt>
                <dd className="text-lg font-medium text-gray-900">
                  {/* Use server total when available; fall back to page-local count */}
                  {supervisionStats?.summary?.totalMeetUps ?? meetUpsData?.pagination?.totalItems ?? 0}
                </dd>
              </dl>
            </div>
          </div>
        </Card>

        <Card className="p-6">
          <div className="flex items-center">
            <div className="flex-shrink-0">
              <AlertTriangle className="h-8 w-8 text-red-600" />
            </div>
            <div className="ml-5 w-0 flex-1">
              <dl>
                <dt className="text-sm font-medium text-gray-500 truncate">High Priority</dt>
                <dd className="text-lg font-medium text-gray-900">
                  {supervisionStats?.summary?.highRiskMeetUps ?? filteredMeetUps.filter(m => m.supervision?.priority?.priority === 'high').length}
                </dd>
              </dl>
            </div>
          </div>
        </Card>

        <Card className="p-6">
          <div className="flex items-center">
            <div className="flex-shrink-0">
              <Shield className="h-8 w-8 text-green-600" />
            </div>
            <div className="ml-5 w-0 flex-1">
              <dl>
                <dt className="text-sm font-medium text-gray-500 truncate">Staff Required</dt>
                <dd className="text-lg font-medium text-gray-900">
                  {supervisionStats?.summary?.staffRequiredMeetUps ?? filteredMeetUps.filter(m => m.safety?.hotelStaffPresent).length}
                </dd>
              </dl>
            </div>
          </div>
        </Card>

        <Card className="p-6">
          <div className="flex items-center">
            <div className="flex-shrink-0">
              <CheckCircle className="h-8 w-8 text-purple-600" />
            </div>
            <div className="ml-5 w-0 flex-1">
              <dl>
                <dt className="text-sm font-medium text-gray-500 truncate">Completed Supervision</dt>
                <dd className="text-lg font-medium text-gray-900">
                  {supervisionStats?.summary?.completedSupervision ?? 0}
                </dd>
              </dl>
            </div>
          </div>
        </Card>
      </div>

      {/* Navigation Tabs */}
      <div className="border-b border-gray-200">
        <nav className="-mb-px flex space-x-8">
          {tabs.map((tab) => (
            <button
              key={tab.id}
              onClick={() => {
                setActiveTab(tab.id);
                // Reset pagination when switching tabs to avoid stale page offsets
                if (tab.id === 'guest-reports') {
                  setReportPage(1);
                } else {
                  setCurrentPage(1);
                }
              }}
              className={`py-2 px-1 border-b-2 font-medium text-sm whitespace-nowrap ${
                activeTab === tab.id
                  ? 'border-blue-500 text-blue-600'
                  : 'border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300'
              }`}
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

      {/* Filters */}
      {(activeTab === 'requiring-supervision' || activeTab === 'all-meetups' || activeTab === 'safety-alerts') && (
        <Card className="p-6">
          <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
            {/* Search */}
            <div className="relative">
              <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400 h-4 w-4" />
              <Input
                type="text"
                placeholder="Search meet-ups..."
                value={searchTerm}
                onChange={(e) => {
                  setSearchTerm(e.target.value);
                  setCurrentPage(1);
                }}
                className="pl-10"
              />
            </div>

            {/* Status Filter */}
            <select
              value={statusFilter}
              onChange={(e) => {
                setStatusFilter(e.target.value);
                setCurrentPage(1);
              }}
              className="block w-full rounded-md border-gray-300 shadow-sm focus:border-blue-500 focus:ring-blue-500"
            >
              <option value="">All Statuses</option>
              <option value="pending">Pending</option>
              <option value="accepted">Accepted</option>
              <option value="declined">Declined</option>
              <option value="completed">Completed</option>
              <option value="cancelled">Cancelled</option>
            </select>

            {/* Safety Filter */}
            <select
              value={safetyFilter}
              onChange={(e) => {
                setSafetyFilter(e.target.value);
                setCurrentPage(1);
              }}
              className="block w-full rounded-md border-gray-300 shadow-sm focus:border-blue-500 focus:ring-blue-500"
            >
              <option value="">All Safety Levels</option>
              <option value="high-risk">High Risk</option>
              <option value="staff-required">Staff Required</option>
            </select>

            {/* Clear Filters */}
            <Button
              variant="outline"
              onClick={handleClearFilters}
              className="flex items-center gap-2"
            >
              <Filter className="w-4 h-4" />
              Clear Filters
            </Button>
          </div>
        </Card>
      )}

      {/* Meet-ups List */}
      {(activeTab === 'requiring-supervision' || activeTab === 'all-meetups' || activeTab === 'safety-alerts') && (
        <div className="space-y-4">
          {(() => {
            const tabFilteredMeetUps = filteredMeetUps.filter(meetUp => {
              if (activeTab === 'requiring-supervision') {
                return meetUp.supervision?.priority?.priority !== 'low';
              }
              if (activeTab === 'safety-alerts') {
                return meetUp.supervision?.safetyLevel?.level === 'low';
              }
              return true;
            });
            if (tabFilteredMeetUps.length === 0) {
              return (
                <Card className="p-12 text-center">
                  <Users className="h-16 w-16 mx-auto mb-4 text-gray-400" />
                  <h3 className="text-xl font-semibold text-gray-600 mb-2">No Meet-ups Found</h3>
                  <p className="text-gray-500">There are no meet-ups matching your current filters.</p>
                </Card>
              );
            }
            return tabFilteredMeetUps.map((meetUp) => {
              const safetyLevel = meetUp.supervision?.safetyLevel;
              const priority = meetUp.supervision?.priority;
              const typeInfo = meetUpRequestService.getMeetUpTypeInfo(meetUp.type);
              const statusInfo = meetUpRequestService.getStatusInfo(meetUp.status);
              const supervisionStatusColor = staffMeetUpSupervisionService.getSupervisionStatusColor(meetUp.supervisionStatus);
              const supervisionStatusLabel = staffMeetUpSupervisionService.getSupervisionStatusLabel(meetUp.supervisionStatus);
              const urgency = staffMeetUpSupervisionService.getUrgencyIndicator(meetUp);
              const timeUntil = staffMeetUpSupervisionService.getTimeUntil(meetUp.proposedDate);
              const isUpcoming = staffMeetUpSupervisionService.isUpcoming(meetUp.proposedDate);

              return (
                <Card key={meetUp._id} className={`p-6 ${urgency.level === 'urgent' ? 'border-red-400 border-2' : ''}`}>
                  <div className="flex items-center justify-between">
                    <div className="flex-1">
                      <div className="flex items-center gap-3 mb-3 flex-wrap">
                        <h3 className="text-lg font-semibold text-gray-900">{meetUp.title}</h3>
                        <Badge className={typeInfo.color}>{typeInfo.label}</Badge>
                        <Badge className={statusInfo.color}>{statusInfo.label}</Badge>
                        {priority && <Badge className={priority.color}>{priority.label}</Badge>}
                        <Badge className={supervisionStatusColor}>{supervisionStatusLabel}</Badge>
                        {isUpcoming && (
                          <Badge className={urgency.color} title={`${timeUntil} until meet-up`}>
                            {urgency.label}
                            {timeUntil !== 'Now' && ` · ${timeUntil}`}
                          </Badge>
                        )}
                      </div>

                      <p className="text-gray-600 text-sm mb-4">{meetUp.description}</p>

                      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4 text-sm">
                        <div className="flex items-center gap-2">
                          <Users className="w-4 h-4 text-gray-500" />
                          <span className="text-gray-700">
                            {meetUp.requesterId?.name || 'Unknown'} → {meetUp.targetUserId?.name || 'Unknown'}
                          </span>
                        </div>

                        <div className="flex items-center gap-2">
                          <Calendar className="w-4 h-4 text-gray-500" />
                          <span className="text-gray-700">{formatDate(meetUp.proposedDate)}</span>
                        </div>

                        <div className="flex items-center gap-2">
                          <Clock className="w-4 h-4 text-gray-500" />
                          <span className="text-gray-700">
                            {meetUp.proposedTime?.start || '--:--'} - {meetUp.proposedTime?.end || '--:--'}
                          </span>
                        </div>

                        <div className="flex items-center gap-2">
                          <MapPin className="w-4 h-4 text-gray-500" />
                          <span className="text-gray-700">{meetUp.location?.name || 'Not specified'}</span>
                        </div>
                      </div>

                      <div className="flex items-center gap-4 mt-4 flex-wrap">
                        {safetyLevel && (
                          <div className="flex items-center gap-2">
                            <Shield className="w-4 h-4 text-gray-500" />
                            <Badge className={safetyLevel.color}>{safetyLevel.label}</Badge>
                          </div>
                        )}

                        {meetUp.safety?.hotelStaffPresent && (
                          <div className="flex items-center gap-2">
                            <Bell className="w-4 h-4 text-blue-500" />
                            <span className="text-sm text-blue-600 font-medium">Staff Presence Required</span>
                          </div>
                        )}

                        {(meetUp.participants?.maxParticipants ?? 0) > 4 && (
                          <div className="flex items-center gap-2">
                            <Users className="w-4 h-4 text-orange-500" />
                            <span className="text-sm text-orange-600 font-medium">Large Group ({meetUp.participants?.maxParticipants})</span>
                          </div>
                        )}

                        {meetUp.assignedStaff && (
                          <div className="flex items-center gap-2">
                            <UserCheck className="w-4 h-4 text-green-500" />
                            <span className="text-sm text-green-600 font-medium">
                              Assigned: {meetUp.assignedStaff.name}
                            </span>
                          </div>
                        )}

                        {priority?.factors && priority.factors.length > 0 && (
                          <div className="flex items-center gap-2">
                            <Activity className="w-4 h-4 text-gray-400" />
                            <span className="text-xs text-gray-500">
                              {staffMeetUpSupervisionService.formatRiskFactors(priority.factors)}
                            </span>
                          </div>
                        )}
                      </div>
                    </div>

                    <div className="flex items-center gap-3 ml-6">
                      <Button
                        variant="outline"
                        size="sm"
                        onClick={() => handleViewDetails(meetUp)}
                        className="flex items-center gap-2"
                      >
                        <Eye className="w-4 h-4" />
                        Details
                      </Button>
                    </div>
                  </div>
                </Card>
              );
            });
          })()}

          {/* Pagination Controls */}
          {meetUpsData?.pagination && meetUpsData.pagination.totalPages > 1 && (
            <div className="flex items-center justify-between border-t border-gray-200 pt-4">
              <p className="text-sm text-gray-600">
                Page {meetUpsData.pagination.currentPage} of {meetUpsData.pagination.totalPages} ({meetUpsData.pagination.totalItems} total)
              </p>
              <div className="flex items-center gap-2">
                <Button
                  variant="outline"
                  size="sm"
                  disabled={!meetUpsData.pagination.hasPrev}
                  onClick={() => setCurrentPage(prev => Math.max(1, prev - 1))}
                  className="flex items-center gap-1"
                >
                  <ChevronLeft className="w-4 h-4" />
                  Previous
                </Button>
                <Button
                  variant="outline"
                  size="sm"
                  disabled={!meetUpsData.pagination.hasNext}
                  onClick={() => setCurrentPage(prev => prev + 1)}
                  className="flex items-center gap-1"
                >
                  Next
                  <ChevronRight className="w-4 h-4" />
                </Button>
              </div>
            </div>
          )}
        </div>
      )}

      {activeTab === 'guest-reports' && (
        <div className="space-y-6">
          {!staffHotelId ? (
            <Card className="p-8 text-center text-gray-600">
              <AlertTriangle className="h-10 w-10 text-amber-500 mx-auto mb-3" />
              <p className="font-medium text-gray-900 mb-1">No property on your account</p>
              <p className="text-sm">
                Guest meet-up reports are loaded for your assigned hotel. Ask an administrator to link your staff user to
                a property, or open Meet-Up Management from the admin area with a property selected.
              </p>
            </Card>
          ) : guestReportsLoading ? (
            <div className="flex justify-center py-12">
              <LoadingSpinner size="lg" />
            </div>
          ) : (
            <>
              <Card className="p-4">
                <div className="flex flex-col sm:flex-row sm:items-end gap-4">
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">Status</label>
                    <select
                      value={reportStatusFilter}
                      onChange={(e) => {
                        setReportStatusFilter(e.target.value);
                        setReportPage(1);
                      }}
                      className="block rounded-md border-gray-300 shadow-sm focus:border-blue-500 focus:ring-blue-500 min-w-[180px]"
                    >
                      <option value="">All</option>
                      <option value="pending">Pending</option>
                      <option value="reviewed">Reviewed</option>
                      <option value="dismissed">Dismissed</option>
                    </select>
                  </div>
                  <p className="text-sm text-gray-600 flex-1">
                    Submissions from guests about other guests (same property, active stay). You were also notified in-app
                    when each report was filed.
                  </p>
                </div>
              </Card>

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
                        <span className="text-xs text-gray-500">{r.createdAt && !isNaN(new Date(r.createdAt).getTime()) ? format(new Date(r.createdAt), 'PPp') : '—'}</span>
                      </div>
                      <p className="text-sm text-gray-800 mb-2">
                        <span className="font-medium">Reporter:</span>{' '}
                        {r.reporterId?.name || r.reporterId?.email || '—'} ·{' '}
                        <span className="font-medium">Reported:</span>{' '}
                        {r.reportedUserId?.name || r.reportedUserId?.email || '—'}
                      </p>
                      {r.meetUpRequestId && (
                        <p className="text-xs text-gray-600 mb-1">
                          Meet-up: {r.meetUpRequestId.title || '—'} ({r.meetUpRequestId.status || '—'})
                        </p>
                      )}
                      {r.details ? <p className="text-sm text-gray-700 whitespace-pre-wrap">{r.details}</p> : null}
                      <p className="text-xs text-gray-500 mt-2 capitalize">Status: {r.status}</p>
                    </Card>
                  ))
                )}
              </div>

              {guestReportsData && guestReportsData.pagination.totalPages > 1 && (
                <div className="flex justify-center items-center gap-2 pt-2">
                  <Button
                    variant="outline"
                    size="sm"
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
                    size="sm"
                    onClick={() => setReportPage((p) => p + 1)}
                    disabled={!guestReportsData.pagination.hasNext}
                  >
                    Next
                  </Button>
                </div>
              )}
            </>
          )}
        </div>
      )}

      {/* Statistics Tab */}
      {activeTab === 'statistics' && (
        <div className="space-y-6">
          {statsLoading ? (
            <div className="flex justify-center py-12">
              <LoadingSpinner size="lg" />
            </div>
          ) : !supervisionStats ? (
            <Card className="p-12 text-center text-gray-500">
              <Activity className="h-12 w-12 mx-auto mb-4 text-gray-300" />
              <p>No statistics available yet.</p>
            </Card>
          ) : (
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
              <Card className="p-6">
                <h3 className="text-lg font-semibold text-gray-900 mb-4">Supervision Summary</h3>
                <div className="space-y-3">
                  <div className="flex justify-between">
                    <span className="text-gray-600">Total Meet-ups:</span>
                    <span className="font-medium">{supervisionStats.summary?.totalMeetUps ?? 0}</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-gray-600">Pending Supervision:</span>
                    <span className="font-medium text-yellow-600">{supervisionStats.summary?.pendingSupervision ?? 0}</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-gray-600">Completed Supervision:</span>
                    <span className="font-medium text-green-600">{supervisionStats.summary?.completedSupervision ?? 0}</span>
                  </div>
                </div>
              </Card>

              <Card className="p-6">
                <h3 className="text-lg font-semibold text-gray-900 mb-4">Risk Overview</h3>
                <div className="space-y-3">
                  <div className="flex justify-between">
                    <span className="text-gray-600">High Risk Meet-ups:</span>
                    <span className="font-medium text-red-600">{supervisionStats.summary?.highRiskMeetUps ?? 0}</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-gray-600">Staff Required:</span>
                    <span className="font-medium text-blue-600">{supervisionStats.summary?.staffRequiredMeetUps ?? 0}</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-gray-600">Upcoming Supervised:</span>
                    <span className="font-medium">{supervisionStats.summary?.upcomingSupervised ?? 0}</span>
                  </div>
                </div>
              </Card>

              <Card className="p-6">
                <h3 className="text-lg font-semibold text-gray-900 mb-4">Status Breakdown</h3>
                <div className="space-y-3">
                  {(supervisionStats.statusBreakdown?.length ?? 0) === 0 ? (
                    <p className="text-sm text-gray-500 text-center py-4">No status data available</p>
                  ) : (
                    supervisionStats.statusBreakdown?.map((status: { _id: string; count: number }) => (
                      <div key={status._id} className="flex justify-between">
                        <span className="text-gray-600 capitalize">{status._id}:</span>
                        <span className="font-medium">{status.count}</span>
                      </div>
                    ))
                  )}
                </div>
              </Card>
            </div>
          )}
        </div>
      )}

      {/* Details Modal */}
      {showDetailsModal && selectedMeetUp && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
          <div className="bg-white rounded-lg max-w-2xl w-full max-h-[90vh] overflow-y-auto">
            <div className="p-6 border-b border-gray-200">
              <div className="flex justify-between items-center">
                <h2 className="text-xl font-semibold text-gray-900">Meet-up Details</h2>
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={() => setShowDetailsModal(false)}
                >
                  <XCircle className="w-5 h-5" />
                </Button>
              </div>
            </div>

            <div className="p-6 space-y-6">
              <div>
                <h3 className="text-lg font-medium text-gray-900 mb-2">{selectedMeetUp.title}</h3>
                <p className="text-gray-600">{selectedMeetUp.description}</p>
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div>
                  <h4 className="font-medium text-gray-900 mb-2">Meet-up Details</h4>
                  <div className="space-y-2 text-sm">
                    <div><span className="text-gray-500">Type:</span> {meetUpRequestService.getMeetUpTypeInfo(selectedMeetUp.type).label}</div>
                    <div><span className="text-gray-500">Status:</span> {meetUpRequestService.getStatusInfo(selectedMeetUp.status).label}</div>
                    <div><span className="text-gray-500">Date:</span> {formatDate(selectedMeetUp.proposedDate)}</div>
                    <div><span className="text-gray-500">Time:</span> {selectedMeetUp.proposedTime?.start || '--:--'} - {selectedMeetUp.proposedTime?.end || '--:--'}</div>
                    <div><span className="text-gray-500">Location:</span> {selectedMeetUp.location?.name || 'Not specified'}</div>
                    <div><span className="text-gray-500">Max Participants:</span> {selectedMeetUp.participants?.maxParticipants ?? 2}</div>
                  </div>
                </div>

                <div>
                  <h4 className="font-medium text-gray-900 mb-2">Safety Information</h4>
                  <div className="space-y-2 text-sm">
                    {selectedMeetUp.supervision?.safetyLevel && (
                      <div>
                        <span className="text-gray-500">Safety Level:</span>{' '}
                        <Badge className={selectedMeetUp.supervision.safetyLevel.color}>{selectedMeetUp.supervision.safetyLevel.label}</Badge>
                      </div>
                    )}
                    {selectedMeetUp.supervision?.priority && (
                      <div>
                        <span className="text-gray-500">Supervision Priority:</span>{' '}
                        <Badge className={selectedMeetUp.supervision.priority.color}>{selectedMeetUp.supervision.priority.label}</Badge>
                      </div>
                    )}
                    <div><span className="text-gray-500">Verified Only:</span> {selectedMeetUp.safety?.verifiedOnly ? 'Yes' : 'No'}</div>
                    <div><span className="text-gray-500">Public Location:</span> {selectedMeetUp.safety?.publicLocation ? 'Yes' : 'No'}</div>
                    <div><span className="text-gray-500">Staff Present:</span> {selectedMeetUp.safety?.hotelStaffPresent ? 'Yes' : 'No'}</div>
                    {selectedMeetUp.supervision?.riskFactors && selectedMeetUp.supervision.riskFactors.length > 0 && (
                      <div>
                        <span className="text-gray-500">Risk Factors:</span>
                        <ul className="mt-1 list-disc list-inside text-red-700">
                          {selectedMeetUp.supervision.riskFactors.map((f) => <li key={f}>{f}</li>)}
                        </ul>
                      </div>
                    )}
                  </div>
                </div>
              </div>

              <div>
                <h4 className="font-medium text-gray-900 mb-2">Participants</h4>
                <div className="space-y-2 text-sm">
                  <div><span className="text-gray-500">Requester:</span> {selectedMeetUp.requesterId?.name || 'Unknown'} ({selectedMeetUp.requesterId?.email || ''})</div>
                  <div><span className="text-gray-500">Target User:</span> {selectedMeetUp.targetUserId?.name || 'Unknown'} ({selectedMeetUp.targetUserId?.email || ''})</div>
                  <div><span className="text-gray-500">Hotel:</span> {selectedMeetUp.hotelId?.name || 'Unknown Hotel'}</div>
                </div>
              </div>

              {/* Supervision assignment section */}
              <div className="border-t border-gray-100 pt-4">
                <h4 className="font-medium text-gray-900 mb-3">Supervision Management</h4>
                <div className="space-y-3">
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">
                      Assigned Staff
                    </label>
                    <p className="text-sm text-gray-600">
                      {selectedMeetUp.assignedStaff
                        ? `${selectedMeetUp.assignedStaff.name} (${selectedMeetUp.assignedStaff.email})`
                        : 'Not assigned'}
                    </p>
                  </div>

                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">
                      Update Supervision Status
                    </label>
                    <select
                      value={supervisionStatusInput}
                      onChange={(e) => setSupervisionStatusInput(e.target.value as UpdateSupervisionStatusRequest['supervisionStatus'])}
                      className="block w-full rounded-md border-gray-300 shadow-sm focus:border-blue-500 focus:ring-blue-500 text-sm"
                    >
                      <option value="not_required">Not Required</option>
                      <option value="assigned">Assigned</option>
                      <option value="in_progress">In Progress</option>
                      <option value="completed">Completed</option>
                    </select>
                  </div>

                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">
                      Supervision Notes
                    </label>
                    <textarea
                      value={supervisionNotesInput}
                      onChange={(e) => setSupervisionNotesInput(e.target.value)}
                      maxLength={500}
                      rows={3}
                      placeholder="Add supervision notes (optional)..."
                      className="block w-full rounded-md border-gray-300 shadow-sm focus:border-blue-500 focus:ring-blue-500 text-sm resize-none"
                    />
                    <p className="text-xs text-gray-400 mt-1">{supervisionNotesInput.length}/500</p>
                  </div>

                  {actionError && (
                    <div className="bg-red-50 border border-red-200 rounded p-3 text-sm text-red-700 flex items-center gap-2">
                      <AlertTriangle className="w-4 h-4 flex-shrink-0" />
                      {actionError}
                    </div>
                  )}
                </div>
              </div>
            </div>

            <div className="p-6 border-t border-gray-200 flex justify-end gap-3">
              <Button
                variant="outline"
                onClick={() => setShowDetailsModal(false)}
              >
                Cancel
              </Button>
              <Button
                onClick={handleUpdateSupervisionStatus}
                disabled={updateStatusMutation.isPending}
                className="bg-blue-600 hover:bg-blue-700 flex items-center gap-2"
              >
                {updateStatusMutation.isPending ? (
                  <>
                    <LoadingSpinner size="sm" />
                    Saving...
                  </>
                ) : (
                  <>
                    <CheckCircle className="w-4 h-4" />
                    Update Status
                  </>
                )}
              </Button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

export default withErrorBoundary(StaffMeetUpSupervision);
