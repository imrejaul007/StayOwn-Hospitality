import React, { useState, useEffect, useCallback, useRef } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { Button } from '@/components/ui/button';
import { Card } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { LoadingSpinner } from '../../components/LoadingSpinner';
import { Users, Calendar, Clock, UserPlus, CheckCircle, XCircle, Plus, Ban, ChevronLeft, ChevronRight, AlertTriangle, Flag, ShieldOff } from 'lucide-react';
import { meetUpRequestService, MeetUpReportReason } from '../../services/meetUpRequestService';
import { useAuth } from '../../context/AuthContext';
import { toast } from 'react-hot-toast';
import { api } from '../../services/api';
import { useRealTime } from '../../services/realTimeService';
import { withErrorBoundary } from '../../components/ErrorBoundary';

function meetUpErrorMessage(error: unknown, fallback: string) {
  const ax = error as { response?: { data?: { error?: { message?: string; code?: string } } } };
  const code = ax.response?.data?.error?.code;
  const msg = ax.response?.data?.error?.message;
  if (code === 'MEETUPS_DISABLED') {
    return 'Meet-ups are turned off for this property.';
  }
  if (code === 'MEETUP_BLOCKED') {
    return msg || 'You cannot interact with this guest based on privacy settings.';
  }
  if (code === 'MEETUP_PENDING_CAP') {
    return msg || 'You have reached the limit of pending invites at this property.';
  }
  if (code === 'MEETUP_QUIET_HOURS') {
    return msg || 'New invites are paused during quiet hours at this property.';
  }
  if (code === 'MEETUP_CONTENT_BLOCKED') {
    return msg || 'That wording isn’t allowed. Please edit your title or description.';
  }
  return msg || (error instanceof Error ? error.message : fallback);
}

function MeetUpRequestsDashboard() {
  const { user } = useAuth();
  const queryClient = useQueryClient();
  const { connectionState, connect, on, off } = useRealTime();
  const [activeTab, setActiveTab] = useState('all');
  const [searchTerm, setSearchTerm] = useState('');
  const [debouncedSearch, setDebouncedSearch] = useState('');
  const [page, setPage] = useState(1);
  const [isCreateModalOpen, setIsCreateModalOpen] = useState(false);
  const [selectedMeetUp, setSelectedMeetUp] = useState<{ targetUserId?: string } | null>(null);
  const PAGE_LIMIT = 20;

  // Debounce search input
  const debounceTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const handleSearchChange = useCallback((value: string) => {
    setSearchTerm(value);
    if (debounceTimer.current) clearTimeout(debounceTimer.current);
    debounceTimer.current = setTimeout(() => {
      setDebouncedSearch(value);
      setPage(1);
    }, 400);
  }, []);

  // Reset page when switching tabs
  useEffect(() => {
    setPage(1);
  }, [activeTab]);

  useEffect(() => {
    connect().catch(() => {});
    return () => {};
  }, [connect]);

  useEffect(() => {
    if (connectionState !== 'connected') return;
    const refresh = () => {
      queryClient.invalidateQueries({ queryKey: ['meetUpRequests'] });
      queryClient.invalidateQueries({ queryKey: ['meetUpStats'] });
      queryClient.invalidateQueries({ queryKey: ['meetUpPartners'] });
    };
    on('meetup:updated', refresh);
    return () => off('meetup:updated', refresh);
  }, [connectionState, on, off, queryClient]);

  const { data: meetUpFeature } = useQuery({
    queryKey: ['meetUpGuestFeatureStatus'],
    queryFn: () => meetUpRequestService.getGuestFeatureStatus(),
    staleTime: 60_000
  });

  const guestMeetUpsLocked =
    meetUpFeature?.reason === 'disabled_by_property' || meetUpFeature?.meetUpsEnabled === false;

  // Queries
  const { data: meetUpsData, isLoading: meetUpsLoading, isError: meetUpsError } = useQuery({
    queryKey: ['meetUpRequests', activeTab, debouncedSearch, page],
    queryFn: () => {
      const params = { page, limit: PAGE_LIMIT };

      switch (activeTab) {
        case 'pending':
          return meetUpRequestService.getPendingRequests(params);
        case 'upcoming':
          return meetUpRequestService.getUpcomingMeetUps(params);
        default:
          return meetUpRequestService.getMeetUpRequests({
            ...params,
            ...(debouncedSearch ? { search: debouncedSearch } : {})
          });
      }
    },
    keepPreviousData: true,
    enabled: activeTab === 'all' || activeTab === 'pending' || activeTab === 'upcoming'
  });

  const { data: partnersData, isLoading: partnersLoading, isError: partnersError } = useQuery({
    queryKey: ['meetUpPartners'],
    queryFn: () => meetUpRequestService.searchPartners(),
    enabled: activeTab === 'partners' && !guestMeetUpsLocked
  });

  const { data: statsData, isLoading: statsLoading, isError: statsError } = useQuery({
    queryKey: ['meetUpStats'],
    queryFn: () => meetUpRequestService.getStats(),
    enabled: activeTab === 'stats'
  });

  // Mutations
  const createMutation = useMutation({
    mutationFn: meetUpRequestService.createMeetUpRequest,
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['meetUpRequests'] });
      queryClient.invalidateQueries({ queryKey: ['meetUpStats'] });
      queryClient.invalidateQueries({ queryKey: ['meetUpPartners'] });
      setIsCreateModalOpen(false);
      toast.success('Meet-up request created successfully!');
    },
    onError: (error) => {
      toast.error(meetUpErrorMessage(error, 'Failed to create meet-up request'));
    }
  });

  const acceptMutation = useMutation({
    mutationFn: ({ requestId, data }: { requestId: string; data: Record<string, unknown> }) => meetUpRequestService.acceptMeetUpRequest(requestId, data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['meetUpRequests'] });
      queryClient.invalidateQueries({ queryKey: ['meetUpStats'] });
      toast.success('Meet-up request accepted!');
    },
    onError: (error) => {
      toast.error(meetUpErrorMessage(error, 'Failed to accept meet-up request'));
    }
  });

  const declineMutation = useMutation({
    mutationFn: ({ requestId, data }: { requestId: string; data: Record<string, unknown> }) => meetUpRequestService.declineMeetUpRequest(requestId, data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['meetUpRequests'] });
      queryClient.invalidateQueries({ queryKey: ['meetUpStats'] });
      toast.success('Meet-up request declined');
    },
    onError: (error) => {
      toast.error(meetUpErrorMessage(error, 'Failed to decline meet-up request'));
    }
  });

  const cancelMutation = useMutation({
    mutationFn: (requestId: string) => meetUpRequestService.cancelMeetUpRequest(requestId),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['meetUpRequests'] });
      queryClient.invalidateQueries({ queryKey: ['meetUpStats'] });
      toast.success('Meet-up request cancelled');
    },
    onError: (error) => {
      toast.error(meetUpErrorMessage(error, 'Failed to cancel meet-up request'));
    }
  });

  const handleCreateMeetUp = (formData: Record<string, unknown>) => {
    createMutation.mutate(formData as Parameters<typeof meetUpRequestService.createMeetUpRequest>[0]);
  };

  const handleAcceptRequest = (requestId: string) => {
    acceptMutation.mutate({ requestId, data: { message: '' } });
  };

  const handleDeclineRequest = (requestId: string) => {
    declineMutation.mutate({ requestId, data: { message: '' } });
  };

  const [confirmCancelMeetUpId, setConfirmCancelMeetUpId] = useState<string | null>(null);
  const [reportOpen, setReportOpen] = useState<{
    reportedUserId: string;
    meetUpRequestId?: string;
    label?: string;
  } | null>(null);
  const [reportReason, setReportReason] = useState<MeetUpReportReason>('other');
  const [reportDetails, setReportDetails] = useState('');

  const blockMutation = useMutation({
    mutationFn: (targetUserId: string) => meetUpRequestService.blockMeetUpPeer(targetUserId),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['meetUpPartners'] });
      toast.success('You won’t see this guest in partner search anymore at this property.');
    },
    onError: (error) => {
      toast.error(meetUpErrorMessage(error, 'Could not update block'));
    }
  });

  const reportMutation = useMutation({
    mutationFn: meetUpRequestService.submitMeetUpReport,
    onSuccess: () => {
      setReportOpen(null);
      setReportDetails('');
      setReportReason('other');
      toast.success('Report submitted. Staff have been notified.');
    },
    onError: (error) => {
      toast.error(meetUpErrorMessage(error, 'Could not submit report'));
    }
  });

  const handleCancelRequest = (requestId: string) => {
    setConfirmCancelMeetUpId(requestId);
  };

  const confirmCancelMeetUp = () => {
    if (confirmCancelMeetUpId) {
      cancelMutation.mutate(confirmCancelMeetUpId);
      setConfirmCancelMeetUpId(null);
    }
  };

  if (meetUpsLoading && activeTab !== 'partners' && activeTab !== 'stats') {
    return (
      <div className="flex items-center justify-center h-64">
        <LoadingSpinner />
      </div>
    );
  }

  if (meetUpsError && activeTab !== 'partners' && activeTab !== 'stats') {
    return (
      <div className="flex flex-col items-center justify-center h-64 text-center">
        <AlertTriangle className="h-12 w-12 text-red-400 mb-4" />
        <h3 className="text-lg font-medium text-gray-900 mb-2">Failed to load meet-ups</h3>
        <p className="text-gray-600 mb-4">Something went wrong while fetching your meet-up requests.</p>
        <Button onClick={() => queryClient.invalidateQueries({ queryKey: ['meetUpRequests'] })}>
          Try Again
        </Button>
      </div>
    );
  }

  return (
    <div className="container mx-auto p-6 space-y-6">
      <div className="flex justify-between items-center">
        <div>
          <h1 className="text-3xl font-bold text-gray-900">Meet-Up Requests</h1>
          <p className="text-gray-600 mt-2">Connect with other guests and organize meet-ups</p>
        </div>
        <Button
          onClick={() => setIsCreateModalOpen(true)}
          className="flex items-center gap-2"
          disabled={guestMeetUpsLocked}
        >
          <Plus className="h-4 w-4" />
          Create Meet-Up
        </Button>
      </div>

      {guestMeetUpsLocked && (
        <div
          className="rounded-lg border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-900"
          role="status"
        >
          Guest meet-ups are turned off for this property. You can still view past requests. Contact the front desk if
          you need help.
        </div>
      )}

      {meetUpFeature?.reason === 'no_active_stay' && !guestMeetUpsLocked && (
        <div className="rounded-lg border border-gray-200 bg-gray-50 px-4 py-3 text-sm text-gray-700" role="status">
          An active reservation at this hotel is required to find partners and send new meet-up invites.
        </div>
      )}

      {/* Tabs */}
      <div className="border-b border-gray-200">
        <nav className="-mb-px flex space-x-8">
          {[
            { id: 'all', label: 'All Requests' },
            { id: 'pending', label: 'Pending' },
            { id: 'upcoming', label: 'Upcoming' },
            { id: 'partners', label: 'Find Partners' },
            { id: 'stats', label: 'Statistics' }
          ].map((tab) => (
            <button
              key={tab.id}
              aria-label={`View ${tab.label}`}
              onClick={() => setActiveTab(tab.id)}
              className={`py-2 px-1 border-b-2 font-medium text-sm ${
                activeTab === tab.id
                  ? 'border-blue-500 text-blue-600'
                  : 'border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300'
              }`}
            >
              {tab.label}
            </button>
          ))}
        </nav>
      </div>

      {/* Content */}
      {activeTab === 'all' && (
        <div className="space-y-6">
          <div className="flex gap-4 items-center">
            <Input
              placeholder="Search meet-ups..."
              value={searchTerm}
              onChange={(e) => handleSearchChange(e.target.value)}
              className="max-w-sm"
            />
          </div>

          <div className="grid gap-6 md:grid-cols-2 lg:grid-cols-3">
            {meetUpsData?.meetUps?.map((meetUp) => (
              <MeetUpCard
                key={meetUp._id}
                meetUp={meetUp}
                currentUserId={user?._id}
                onAccept={handleAcceptRequest}
                onDecline={handleDeclineRequest}
                onCancel={handleCancelRequest}
                onReport={(reportedUserId, meetUpRequestId, label) =>
                  setReportOpen({ reportedUserId, meetUpRequestId, label })
                }
                onBlock={(id) => blockMutation.mutate(id)}
                blockPending={blockMutation.isPending}
              />
            ))}
          </div>

          {meetUpsData?.meetUps?.length === 0 && (
            <div className="text-center py-12">
              <Users className="h-12 w-12 text-gray-400 mx-auto mb-4" />
              <h3 className="text-lg font-medium text-gray-900 mb-2">No meet-ups found</h3>
              <p className="text-gray-600">Create your first meet-up request to get started!</p>
            </div>
          )}

          {meetUpsData?.pagination && meetUpsData.pagination.totalPages > 1 && (
            <PaginationControls
              pagination={meetUpsData.pagination}
              page={page}
              onPageChange={setPage}
            />
          )}
        </div>
      )}

      {activeTab === 'pending' && (
        <div className="space-y-6">
          <div className="grid gap-6 md:grid-cols-2 lg:grid-cols-3">
            {meetUpsData?.meetUps?.map((meetUp) => (
              <MeetUpCard
                key={meetUp._id}
                meetUp={meetUp}
                currentUserId={user?._id}
                onAccept={handleAcceptRequest}
                onDecline={handleDeclineRequest}
                onCancel={handleCancelRequest}
              />
            ))}
          </div>

          {meetUpsData?.meetUps?.length === 0 && (
            <div className="text-center py-12">
              <Clock className="h-12 w-12 text-yellow-400 mx-auto mb-4" />
              <h3 className="text-lg font-medium text-gray-900 mb-2">No pending requests</h3>
              <p className="text-gray-600">You have no pending meet-up requests at this time.</p>
            </div>
          )}

          {meetUpsData?.pagination && meetUpsData.pagination.totalPages > 1 && (
            <PaginationControls
              pagination={meetUpsData.pagination}
              page={page}
              onPageChange={setPage}
            />
          )}
        </div>
      )}

      {activeTab === 'upcoming' && (
        <div className="space-y-6">
          <div className="grid gap-6 md:grid-cols-2 lg:grid-cols-3">
            {meetUpsData?.meetUps?.map((meetUp) => (
              <MeetUpCard
                key={meetUp._id}
                meetUp={meetUp}
                currentUserId={user?._id}
                onAccept={handleAcceptRequest}
                onDecline={handleDeclineRequest}
                onCancel={handleCancelRequest}
                onReport={(reportedUserId, meetUpRequestId, label) =>
                  setReportOpen({ reportedUserId, meetUpRequestId, label })
                }
                onBlock={(id) => blockMutation.mutate(id)}
                blockPending={blockMutation.isPending}
              />
            ))}
          </div>

          {meetUpsData?.meetUps?.length === 0 && (
            <div className="text-center py-12">
              <Calendar className="h-12 w-12 text-green-400 mx-auto mb-4" />
              <h3 className="text-lg font-medium text-gray-900 mb-2">No upcoming meet-ups</h3>
              <p className="text-gray-600">You have no confirmed upcoming meet-ups. Create one to get started!</p>
            </div>
          )}

          {meetUpsData?.pagination && meetUpsData.pagination.totalPages > 1 && (
            <PaginationControls
              pagination={meetUpsData.pagination}
              page={page}
              onPageChange={setPage}
            />
          )}
        </div>
      )}

      {activeTab === 'partners' && (
        <div className="space-y-6">
          {partnersLoading ? (
            <div className="flex items-center justify-center h-64">
              <LoadingSpinner />
            </div>
          ) : partnersError ? (
            <div className="flex flex-col items-center justify-center h-64 text-center">
              <AlertTriangle className="h-12 w-12 text-red-400 mb-4" />
              <h3 className="text-lg font-medium text-gray-900 mb-2">Failed to load partners</h3>
              <p className="text-gray-600 mb-4">Could not fetch potential meet-up partners.</p>
              <Button onClick={() => queryClient.invalidateQueries({ queryKey: ['meetUpPartners'] })}>
                Try Again
              </Button>
            </div>
          ) : (
            <>
              <div className="grid gap-6 md:grid-cols-2 lg:grid-cols-3">
                {partnersData?.users?.map((partner) => (
                  <PartnerCard
                    key={partner._id}
                    partner={partner}
                    onInvite={(partnerId) => {
                      setSelectedMeetUp({ targetUserId: partnerId });
                      setIsCreateModalOpen(true);
                    }}
                    onBlock={(partnerId) => blockMutation.mutate(partnerId)}
                    blockDisabled={guestMeetUpsLocked || blockMutation.isPending}
                  />
                ))}
              </div>
              {partnersData?.users?.length === 0 && (
                <div className="text-center py-12">
                  <UserPlus className="h-12 w-12 text-gray-400 mx-auto mb-4" />
                  <h3 className="text-lg font-medium text-gray-900 mb-2">No partners found</h3>
                  <p className="text-gray-600">No other guests are available for meet-ups right now.</p>
                </div>
              )}
            </>
          )}
        </div>
      )}

      {activeTab === 'stats' && (
        <div className="space-y-6">
          {statsLoading ? (
            <div className="flex items-center justify-center h-64">
              <LoadingSpinner />
            </div>
          ) : statsError ? (
            <div className="flex flex-col items-center justify-center h-64 text-center">
              <AlertTriangle className="h-12 w-12 text-red-400 mb-4" />
              <h3 className="text-lg font-medium text-gray-900 mb-2">Failed to load statistics</h3>
              <p className="text-gray-600 mb-4">Could not load meet-up statistics.</p>
              <Button onClick={() => queryClient.invalidateQueries({ queryKey: ['meetUpStats'] })}>
                Try Again
              </Button>
            </div>
          ) : (
            <div className="grid gap-6 md:grid-cols-2 lg:grid-cols-4">
              <StatCard
                title="Total Meet-ups"
                value={statsData?.totalRequests || 0}
                icon={Calendar}
                color="blue"
              />
              <StatCard
                title="Pending Requests"
                value={statsData?.pendingRequests || 0}
                icon={Clock}
                color="yellow"
              />
              <StatCard
                title="Upcoming Meet-ups"
                value={statsData?.upcomingMeetUps || 0}
                icon={Users}
                color="green"
              />
              <StatCard
                title="Completed Meet-ups"
                value={statsData?.completedRequests || 0}
                icon={CheckCircle}
                color="purple"
              />
            </div>
          )}
        </div>
      )}

      {/* Create Meet-Up Modal */}
      {isCreateModalOpen && (
        <CreateMeetUpModal
          onClose={() => setIsCreateModalOpen(false)}
          onSubmit={handleCreateMeetUp}
          targetUserId={selectedMeetUp?.targetUserId}
          isLoading={createMutation.isPending}
        />
      )}

      {/* Cancel Meet-Up Confirmation Dialog */}
      {confirmCancelMeetUpId && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4" role="dialog" aria-modal="true" aria-labelledby="cancel-meetup-title">
          <Card className="max-w-md w-full p-6">
            <h3 id="cancel-meetup-title" className="text-lg font-semibold text-gray-900 mb-2">Cancel Meet-Up Request</h3>
            <p className="text-gray-600 mb-6">Are you sure you want to cancel this meet-up request?</p>
            <div className="flex justify-end gap-3">
              <Button variant="secondary" onClick={() => setConfirmCancelMeetUpId(null)}>Keep Request</Button>
              <Button variant="secondary" className="text-red-600 hover:bg-red-50" onClick={confirmCancelMeetUp}>Cancel Meet-Up</Button>
            </div>
          </Card>
        </div>
      )}

      {reportOpen && (
        <div
          className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4"
          role="dialog"
          aria-modal="true"
          aria-labelledby="report-meetup-title"
        >
          <Card className="max-w-md w-full p-6 space-y-4">
            <h3 id="report-meetup-title" className="text-lg font-semibold text-gray-900">
              Report guest
            </h3>
            {reportOpen.label && (
              <p className="text-sm text-gray-600">Regarding: {reportOpen.label}</p>
            )}
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Reason</label>
              <select
                className="w-full border border-gray-300 rounded-md px-3 py-2 text-sm"
                value={reportReason}
                onChange={(e) => setReportReason(e.target.value as MeetUpReportReason)}
              >
                <option value="harassment">Harassment</option>
                <option value="spam">Spam</option>
                <option value="inappropriate">Inappropriate</option>
                <option value="safety">Safety concern</option>
                <option value="other">Other</option>
              </select>
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Details (optional)</label>
              <textarea
                className="w-full border border-gray-300 rounded-md px-3 py-2 text-sm min-h-[88px]"
                value={reportDetails}
                onChange={(e) => setReportDetails(e.target.value)}
                maxLength={2000}
                placeholder="What happened?"
              />
            </div>
            <div className="flex justify-end gap-3 pt-2">
              <Button
                variant="secondary"
                onClick={() => {
                  setReportOpen(null);
                  setReportDetails('');
                }}
              >
                Close
              </Button>
              <Button
                className="bg-red-600 hover:bg-red-700"
                disabled={reportMutation.isPending}
                onClick={() =>
                  reportMutation.mutate({
                    reportedUserId: reportOpen.reportedUserId,
                    meetUpRequestId: reportOpen.meetUpRequestId || undefined,
                    reason: reportReason,
                    details: reportDetails.trim() || undefined
                  })
                }
              >
                Submit report
              </Button>
            </div>
          </Card>
        </div>
      )}
    </div>
  );
}

// MeetUpCard Component
function MeetUpCard({ meetUp, currentUserId, onAccept, onDecline, onCancel, onReport, onBlock, blockPending }: {
  meetUp: { _id: string; type: string; status: string; title: string; description: string; proposedDate: string; proposedTime: { start: string; end: string }; location?: { name?: string }; requesterId?: { _id: string; name?: string }; targetUserId?: { _id: string; name?: string } };
  currentUserId?: string;
  onAccept: (id: string) => void;
  onDecline: (id: string) => void;
  onCancel: (id: string) => void;
  onReport: (reportedUserId: string, meetUpRequestId: string, peerLabel: string) => void;
  onBlock: (userId: string) => void;
  blockPending?: boolean;
}) {
  const typeInfo = meetUpRequestService.getMeetUpTypeInfo(meetUp.type);
  const statusInfo = meetUpRequestService.getStatusInfo(meetUp.status);
  const canCancel = meetUp.requesterId?._id === currentUserId &&
    (meetUp.status === 'pending' || meetUp.status === 'accepted');
  const isRequester = meetUp.requesterId?._id === currentUserId;
  const other = isRequester ? meetUp.targetUserId : meetUp.requesterId;
  const otherId = other?._id;
  const peerLabel = other?.name ? `${other.name}` : 'Guest';

  return (
    <Card className="p-6">
      <div className="flex items-start justify-between">
        <div className="flex-1">
          <div className="flex items-center gap-3 mb-4">
            <div className="flex-1 min-w-0">
              <h3 className="text-lg font-semibold text-gray-900 truncate">{meetUp.title}</h3>
              <p className="text-sm text-gray-600 line-clamp-2">{meetUp.description}</p>
            </div>
            <div className="flex gap-2 flex-shrink-0">
              <span className={`px-2 py-1 rounded-full text-xs font-medium ${typeInfo.color}`}>
                {typeInfo.label}
              </span>
              <span className={`px-2 py-1 rounded-full text-xs font-medium ${statusInfo.color}`}>
                {statusInfo.label}
              </span>
            </div>
          </div>

          <div className="grid grid-cols-2 gap-4 mb-4">
            <div>
              <p className="text-sm text-gray-500">Date & Time</p>
              <p className="text-sm font-medium">
                {meetUpRequestService.formatDateTime(meetUp.proposedDate, meetUp.proposedTime)}
              </p>
            </div>
            <div>
              <p className="text-sm text-gray-500">Location</p>
              <p className="text-sm font-medium">{meetUp.location?.name || 'Not specified'}</p>
            </div>
          </div>

          <div className="flex items-center gap-2 flex-wrap">
            {meetUp.status === 'pending' && meetUp.targetUserId?._id === currentUserId && (
              <>
                <Button
                  variant="secondary"
                  size="sm"
                  onClick={() => onAccept(meetUp._id)}
                  className="flex items-center gap-2 text-green-600 hover:text-green-700"
                >
                  <CheckCircle className="w-4 h-4" />
                  Accept
                </Button>
                <Button
                  variant="secondary"
                  size="sm"
                  onClick={() => onDecline(meetUp._id)}
                  className="flex items-center gap-2 text-red-600 hover:text-red-700"
                >
                  <XCircle className="w-4 h-4" />
                  Decline
                </Button>
              </>
            )}
            {canCancel && (
              <Button
                variant="secondary"
                size="sm"
                onClick={() => onCancel(meetUp._id)}
                className="flex items-center gap-2 text-gray-600 hover:text-red-600"
              >
                <Ban className="w-4 h-4" />
                Cancel
              </Button>
            )}
            {otherId && currentUserId && otherId !== currentUserId && (
              <>
                <Button
                  variant="secondary"
                  size="sm"
                  type="button"
                  onClick={() => onReport(otherId, meetUp._id, `${meetUp.title} · ${peerLabel}`)}
                  className="flex items-center gap-2 text-amber-700 hover:text-amber-900"
                >
                  <Flag className="w-4 h-4" />
                  Report
                </Button>
                <Button
                  variant="secondary"
                  size="sm"
                  type="button"
                  disabled={blockPending}
                  onClick={() => onBlock(otherId)}
                  className="flex items-center gap-2 text-gray-700 hover:text-red-700"
                >
                  <ShieldOff className="w-4 h-4" />
                  Block
                </Button>
              </>
            )}
          </div>
        </div>
      </div>
    </Card>
  );
}

// PaginationControls Component
function PaginationControls({ pagination, page, onPageChange }: {
  pagination: { currentPage: number; totalPages: number; totalItems: number; hasNext: boolean; hasPrev: boolean };
  page: number;
  onPageChange: (page: number) => void;
}) {
  return (
    <div className="flex items-center justify-between border-t border-gray-200 pt-4">
      <p className="text-sm text-gray-600">
        Page {pagination.currentPage} of {pagination.totalPages} ({pagination.totalItems} total)
      </p>
      <div className="flex items-center gap-2">
        <Button
          variant="secondary"
          size="sm"
          disabled={!pagination.hasPrev}
          onClick={() => onPageChange(page - 1)}
          className="flex items-center gap-1"
        >
          <ChevronLeft className="w-4 h-4" />
          Previous
        </Button>
        <Button
          variant="secondary"
          size="sm"
          disabled={!pagination.hasNext}
          onClick={() => onPageChange(page + 1)}
          className="flex items-center gap-1"
        >
          Next
          <ChevronRight className="w-4 h-4" />
        </Button>
      </div>
    </div>
  );
}

// PartnerCard Component
function PartnerCard({ partner, onInvite, onBlock, blockDisabled }: {
  partner: { _id: string; name: string; email: string };
  onInvite: (partnerId: string) => void;
  onBlock: (partnerId: string) => void;
  blockDisabled?: boolean;
}) {
  return (
    <Card className="p-6">
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div className="flex items-center gap-4">
          <div className="w-12 h-12 bg-gray-200 rounded-full flex items-center justify-center">
            <Users className="w-6 h-6 text-gray-600" />
          </div>
          <div>
            <h3 className="text-lg font-semibold text-gray-900">{partner.name}</h3>
            <p className="text-sm text-gray-600">{partner.email}</p>
          </div>
        </div>
        <div className="flex flex-wrap gap-2 justify-end">
          <Button
            variant="secondary"
            size="sm"
            onClick={() => onInvite(partner._id)}
            className="flex items-center gap-2"
          >
            <UserPlus className="w-4 h-4" />
            Invite
          </Button>
          <Button
            variant="secondary"
            size="sm"
            type="button"
            disabled={blockDisabled}
            onClick={() => onBlock(partner._id)}
            className="flex items-center gap-2 text-gray-700 hover:text-red-700"
          >
            <ShieldOff className="w-4 h-4" />
            Block
          </Button>
        </div>
      </div>
    </Card>
  );
}

// StatCard Component
function StatCard({ title, value, icon: Icon, color }: {
  title: string;
  value: number | string;
  icon: React.ComponentType<{ className?: string }>;
  color: string;
}) {
  const colorClasses = {
    blue: 'bg-blue-100 text-blue-600',
    yellow: 'bg-yellow-100 text-yellow-600',
    green: 'bg-green-100 text-green-600',
    purple: 'bg-purple-100 text-purple-600'
  };

  return (
    <Card className="p-6">
      <div className="flex items-center justify-between">
        <div>
          <p className="text-sm font-medium text-gray-600">{title}</p>
          <p className="text-2xl font-bold text-gray-900">{value}</p>
        </div>
        <div className={`p-3 rounded-full ${colorClasses[color]}`}>
          <Icon className="w-6 h-6" />
        </div>
      </div>
    </Card>
  );
}

// CreateMeetUpModal Component
function CreateMeetUpModal({ onClose, onSubmit, targetUserId, isLoading }: {
  onClose: () => void;
  onSubmit: (formData: Record<string, unknown>) => void;
  targetUserId?: string;
  isLoading: boolean;
}) {
  const [formData, setFormData] = useState({
    targetUserId: targetUserId || '',
    hotelId: '',
    type: 'casual',
    title: '',
    description: '',
    proposedDate: new Date().toISOString().split('T')[0], // Set to today's date
    proposedTime: {
      start: '',
      end: ''
    },
    location: {
      type: 'hotel_lobby',
      name: '',
      details: ''
    }
  });
  const [fetchingHotel, setFetchingHotel] = useState(true);
  const [users, setUsers] = useState<Array<{ _id?: string; id?: string; name: string; email: string }>>([]);
  const [loadingUsers, setLoadingUsers] = useState(true);

  useEffect(() => {
    if (targetUserId) {
      setFormData((prev) => ({ ...prev, targetUserId }));
    }
  }, [targetUserId]);

  // Fetch hotel and users when modal opens
  useEffect(() => {
    const fetchData = async () => {
      try {
        // Resolve active hotel from authenticated booking context
        const hotelResponse = await api.get('/bookings/current-hotel');
        const hotelId = hotelResponse.data?.data?.hotelId;
        if (hotelId) {
          setFormData(prev => ({ ...prev, hotelId }));
        }
      } catch (error) {
        toast.error('Failed to fetch hotel information');
      } finally {
        setFetchingHotel(false);
      }

      try {
        // Fetch users for dropdown
        const usersResponse = await api.get('/meet-up-requests/search/partners');
        const usersList = usersResponse.data.data?.users || [];
        setUsers(usersList);
      } catch (error) {
        toast.error('Failed to load users');
      } finally {
        setLoadingUsers(false);
      }
    };

    fetchData();
  }, []);

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();

    if (!formData.targetUserId) {
      toast.error('Please select a user to meet up with');
      return;
    }

    if (!formData.proposedTime.start || !formData.proposedTime.end) {
      toast.error('Please specify both start and end times');
      return;
    }

    if (formData.proposedTime.start >= formData.proposedTime.end) {
      toast.error('End time must be after start time');
      return;
    }

    const selectedDate = new Date(formData.proposedDate);
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    if (selectedDate < today) {
      toast.error('Please select a date in the future');
      return;
    }

    onSubmit(formData);
  };

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
      <Card className="w-full max-w-2xl p-6 max-h-[80vh] overflow-y-auto">
        <h2 className="text-xl font-semibold mb-4">Create Meet-Up Request</h2>
        
        {(fetchingHotel || loadingUsers) ? (
          <div className="flex items-center justify-center py-8">
            <LoadingSpinner />
            <span className="ml-2 text-gray-600">
              {fetchingHotel ? 'Loading hotel information...' : 'Loading users...'}
            </span>
          </div>
        ) : (
        <form onSubmit={handleSubmit} className="space-y-4">
          <p className="text-xs text-gray-500 leading-relaxed">
            Meet-ups are between guests; you arrange details at your own discretion. Only guests with an active stay at
            this hotel can be invited.
          </p>
          <div className="grid grid-cols-1 gap-4">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                Select User
              </label>
              <select
                value={formData.targetUserId}
                onChange={(e) => setFormData(prev => ({ ...prev, targetUserId: e.target.value }))}
                className="w-full border border-gray-300 rounded-md px-3 py-2"
                required
              >
                <option value="">Choose a user...</option>
                {users.map((user) => (
                  <option key={user._id || user.id} value={user._id || user.id}>
                    {user.name} ({user.email})
                  </option>
                ))}
              </select>
            </div>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                Type
              </label>
              <select
                value={formData.type}
                onChange={(e) => setFormData(prev => ({ ...prev, type: e.target.value }))}
                className="w-full border border-gray-300 rounded-md px-3 py-2"
              >
                <option value="casual">Casual</option>
                <option value="business">Business</option>
                <option value="social">Social</option>
                <option value="networking">Networking</option>
                <option value="activity">Activity</option>
              </select>
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                Title
              </label>
              <Input
                value={formData.title}
                onChange={(e) => setFormData(prev => ({ ...prev, title: e.target.value }))}
                placeholder="Enter meet-up title"
                maxLength={200}
                required
              />
            </div>
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              Description
            </label>
            <textarea
              value={formData.description}
              onChange={(e) => setFormData(prev => ({ ...prev, description: e.target.value }))}
              placeholder="Enter meet-up description"
              className="w-full border border-gray-300 rounded-md px-3 py-2"
              rows={3}
              maxLength={500}
              required
            />
          </div>

          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                Date
              </label>
              <Input
                type="date"
                value={formData.proposedDate}
                min={new Date().toISOString().split('T')[0]}
                onChange={(e) => setFormData(prev => ({ ...prev, proposedDate: e.target.value }))}
                required
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                Start Time
              </label>
              <Input
                type="time"
                value={formData.proposedTime.start}
                onChange={(e) => setFormData(prev => ({ 
                  ...prev, 
                  proposedTime: { ...prev.proposedTime, start: e.target.value }
                }))}
                required
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                End Time
              </label>
              <Input
                type="time"
                value={formData.proposedTime.end}
                onChange={(e) => setFormData(prev => ({ 
                  ...prev, 
                  proposedTime: { ...prev.proposedTime, end: e.target.value }
                }))}
                required
              />
            </div>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                Location Type
              </label>
              <select
                value={formData.location.type}
                onChange={(e) => setFormData(prev => ({ 
                  ...prev, 
                  location: { ...prev.location, type: e.target.value }
                }))}
                className="w-full border border-gray-300 rounded-md px-3 py-2"
              >
                <option value="hotel_lobby">Hotel Lobby</option>
                <option value="restaurant">Restaurant</option>
                <option value="bar">Bar</option>
                <option value="meeting_room">Meeting Room</option>
                <option value="outdoor">Outdoor</option>
                <option value="other">Other</option>
              </select>
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                Location Name
              </label>
              <Input
                value={formData.location.name}
                onChange={(e) => setFormData(prev => ({
                  ...prev,
                  location: { ...prev.location, name: e.target.value }
                }))}
                placeholder="Enter location name"
                maxLength={200}
                required
              />
            </div>
          </div>

          <div className="flex gap-4">
            <Button
              type="button"
              variant="secondary"
              onClick={onClose}
              disabled={isLoading}
            >
              Cancel
            </Button>
            <Button
              type="submit"
              disabled={isLoading}
            >
              {isLoading ? 'Creating...' : 'Create Meet-Up'}
            </Button>
          </div>
        </form>
        )}
      </Card>
    </div>
  );
}

export default withErrorBoundary(MeetUpRequestsDashboard);
