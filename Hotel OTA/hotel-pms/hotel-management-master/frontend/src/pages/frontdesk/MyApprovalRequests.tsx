import React, { useState, useEffect } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { toast } from 'react-hot-toast';
import approvalService, { ApprovalRequest } from '../../services/approvalService';
import ApprovalRequestCard from '../../components/approvals/ApprovalRequestCard';
import { realTimeService } from '../../services/realTimeService';
import { withErrorBoundary } from '../../components/ErrorBoundary';

type StatusFilter = 'all' | 'pending' | 'approved' | 'rejected';

const PAGE_SIZE = 20;

const MyApprovalRequests: React.FC = () => {
  const queryClient = useQueryClient();
  const [statusFilter, setStatusFilter] = useState<StatusFilter>('all');
  const [page, setPage] = useState(1);

  const { data, isLoading, isError, error } = useQuery({
    queryKey: ['myApprovalRequests', statusFilter, page],
    queryFn: () =>
      approvalService.getMyApprovalRequests({
        ...(statusFilter !== 'all' ? { status: statusFilter } : {}),
        page,
        limit: PAGE_SIZE,
        sortBy: 'createdAt',
        sortOrder: 'desc',
      }),
    keepPreviousData: true,
  });

  const requests = data?.data ?? [];
  const totalCount = data?.totalCount ?? 0;
  const totalPages = data?.totalPages ?? 1;

  // Fetch per-status total counts from the server to show accurate stats cards.
  // Each query fetches page 1 with limit 1 — we only care about totalCount, not the data.
  const { data: pendingData } = useQuery({
    queryKey: ['myApprovalRequests', 'pending', 'count'],
    queryFn: () =>
      approvalService.getMyApprovalRequests({ status: 'pending', page: 1, limit: 1 }),
    keepPreviousData: true,
  });
  const { data: approvedData } = useQuery({
    queryKey: ['myApprovalRequests', 'approved', 'count'],
    queryFn: () =>
      approvalService.getMyApprovalRequests({ status: 'approved', page: 1, limit: 1 }),
    keepPreviousData: true,
  });
  const { data: rejectedData } = useQuery({
    queryKey: ['myApprovalRequests', 'rejected', 'count'],
    queryFn: () =>
      approvalService.getMyApprovalRequests({ status: 'rejected', page: 1, limit: 1 }),
    keepPreviousData: true,
  });
  const { data: allData } = useQuery({
    queryKey: ['myApprovalRequests', 'all', 'count'],
    queryFn: () =>
      approvalService.getMyApprovalRequests({ page: 1, limit: 1 }),
    keepPreviousData: true,
  });

  // Ensure the real-time WebSocket singleton is connected so event listeners below can fire.
  // Do NOT disconnect on unmount — realTimeService is a singleton shared across components.
  useEffect(() => {
    realTimeService.connect().catch(() => { /* WebSocket unavailable -- page still works */ });
  }, []);

  // Real-time: listen for approval events so new guest-triggered requests appear immediately
  useEffect(() => {
    const handleApprovalEvent = () => {
      queryClient.invalidateQueries({ queryKey: ['myApprovalRequests'] });
    };

    realTimeService.on('approval:created', handleApprovalEvent);
    realTimeService.on('approval:updated', handleApprovalEvent);
    realTimeService.on('booking:modification_requested', handleApprovalEvent);

    return () => {
      realTimeService.off('approval:created', handleApprovalEvent);
      realTimeService.off('approval:updated', handleApprovalEvent);
      realTimeService.off('booking:modification_requested', handleApprovalEvent);
    };
  }, [queryClient]);

  const cancelMutation = useMutation({
    mutationFn: (id: string) => approvalService.cancelRequest(id),
    onSuccess: () => {
      toast.success('Request cancelled successfully');
      queryClient.invalidateQueries({ queryKey: ['myApprovalRequests'] });
      // Also refresh the header pending count badge
      queryClient.invalidateQueries({ queryKey: ['pending-approvals-count'] });
    },
    onError: (err: unknown) => {
      const axiosError = err as { response?: { data?: { message?: string } } };
      toast.error(
        axiosError?.response?.data?.message || 'Failed to cancel request'
      );
    },
  });

  const handleCancel = (request: ApprovalRequest) => {
    if (
      window.confirm(
        'Are you sure you want to cancel this request? This action cannot be undone.'
      )
    ) {
      cancelMutation.mutate(request._id);
    }
  };

  // Use server-provided total counts for accurate stats across all pages
  const statusCounts = {
    all: allData?.totalCount ?? totalCount,
    pending: pendingData?.totalCount ?? 0,
    approved: approvedData?.totalCount ?? 0,
    rejected: rejectedData?.totalCount ?? 0,
  };

  return (
    <div className="p-6 max-w-7xl mx-auto">
      {/* Header */}
      <div className="mb-6">
        <h1 className="text-2xl font-bold text-gray-900 mb-2">
          My Approval Requests
        </h1>
        <p className="text-gray-600">
          Track and manage your approval requests
        </p>
      </div>

      {/* Stats Cards */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-4 mb-6">
        <div className="bg-white border border-gray-200 rounded-lg p-4">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm text-gray-600">Total Requests</p>
              <p className="text-2xl font-bold text-gray-900">{statusCounts.all}</p>
            </div>
            <div className="w-12 h-12 bg-blue-100 rounded-full flex items-center justify-center text-blue-600">
              <svg xmlns="http://www.w3.org/2000/svg" className="h-6 w-6" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
              </svg>
            </div>
          </div>
        </div>

        <div className="bg-white border border-gray-200 rounded-lg p-4">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm text-gray-600">Pending</p>
              <p className="text-2xl font-bold text-yellow-600">
                {statusCounts.pending}
              </p>
            </div>
            <div className="w-12 h-12 bg-yellow-100 rounded-full flex items-center justify-center text-yellow-600">
              <svg xmlns="http://www.w3.org/2000/svg" className="h-6 w-6" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" />
              </svg>
            </div>
          </div>
        </div>

        <div className="bg-white border border-gray-200 rounded-lg p-4">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm text-gray-600">Approved</p>
              <p className="text-2xl font-bold text-green-600">
                {statusCounts.approved}
              </p>
            </div>
            <div className="w-12 h-12 bg-green-100 rounded-full flex items-center justify-center text-green-600">
              <svg xmlns="http://www.w3.org/2000/svg" className="h-6 w-6" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
              </svg>
            </div>
          </div>
        </div>

        <div className="bg-white border border-gray-200 rounded-lg p-4">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm text-gray-600">Rejected</p>
              <p className="text-2xl font-bold text-red-600">
                {statusCounts.rejected}
              </p>
            </div>
            <div className="w-12 h-12 bg-red-100 rounded-full flex items-center justify-center text-red-600">
              <svg xmlns="http://www.w3.org/2000/svg" className="h-6 w-6" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
              </svg>
            </div>
          </div>
        </div>
      </div>

      {/* Filters */}
      <div className="bg-white border border-gray-200 rounded-lg p-4 mb-6">
        <div className="flex items-center gap-2">
          <span className="text-sm font-medium text-gray-700">Filter:</span>
          <div className="flex gap-2">
            {(['all', 'pending', 'approved', 'rejected'] as StatusFilter[]).map(
              (status) => (
                <button
                  key={status}
                  onClick={() => {
                    setStatusFilter(status);
                    setPage(1);
                  }}
                  className={`px-4 py-2 rounded-lg font-medium text-sm transition-colors ${
                    statusFilter === status
                      ? 'bg-blue-600 text-white'
                      : 'bg-gray-100 text-gray-700 hover:bg-gray-200'
                  }`}
                >
                  {status.charAt(0).toUpperCase() + status.slice(1)}
                </button>
              )
            )}
          </div>
        </div>
      </div>

      {/* Error State */}
      {isError && (
        <div className="bg-red-50 border border-red-200 rounded-lg p-6 mb-6 text-center">
          <h3 className="text-lg font-semibold text-red-800 mb-2">
            Failed to load requests
          </h3>
          <p className="text-red-600 text-sm">
            {(error as Error)?.message || 'An unexpected error occurred. Please try again.'}
          </p>
          <button
            onClick={() => queryClient.invalidateQueries({ queryKey: ['myApprovalRequests'] })}
            className="mt-4 px-4 py-2 bg-red-600 text-white rounded-lg text-sm font-medium hover:bg-red-700 transition-colors"
          >
            Retry
          </button>
        </div>
      )}

      {/* Requests List */}
      {isLoading ? (
        <div className="bg-white border border-gray-200 rounded-lg p-12 text-center">
          <div className="inline-block animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600"></div>
          <p className="mt-4 text-gray-600">Loading requests...</p>
        </div>
      ) : !isError && requests.length === 0 ? (
        <div className="bg-white border border-gray-200 rounded-lg p-12 text-center">
          <svg xmlns="http://www.w3.org/2000/svg" className="h-16 w-16 mx-auto mb-4 text-gray-300" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M20 13V6a2 2 0 00-2-2H6a2 2 0 00-2 2v7m16 0v5a2 2 0 01-2 2H6a2 2 0 01-2-2v-5m16 0h-2.586a1 1 0 00-.707.293l-2.414 2.414a1 1 0 01-.707.293h-3.172a1 1 0 01-.707-.293l-2.414-2.414A1 1 0 006.586 13H4" />
          </svg>
          <h3 className="text-lg font-semibold text-gray-900 mb-2">
            No requests found
          </h3>
          <p className="text-gray-600">
            {statusFilter === 'all'
              ? "You haven't submitted any approval requests yet."
              : `You have no ${statusFilter} requests.`}
          </p>
        </div>
      ) : (
        <>
          <div className="space-y-4">
            {requests.map((request) => (
              <ApprovalRequestCard
                key={request._id}
                request={request}
                showActions={request.status === 'pending'}
                onCancel={handleCancel}
              />
            ))}
          </div>

          {/* Pagination Controls */}
          {totalPages > 1 && (
            <div className="mt-6 flex items-center justify-between bg-white border border-gray-200 rounded-lg px-4 py-3">
              <p className="text-sm text-gray-700">
                Page {page} of {totalPages} ({totalCount} total)
              </p>
              <div className="flex gap-2">
                <button
                  onClick={() => setPage((p) => Math.max(1, p - 1))}
                  disabled={page <= 1}
                  className="px-3 py-1.5 text-sm font-medium rounded-lg border border-gray-300 text-gray-700 hover:bg-gray-50 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
                >
                  Previous
                </button>
                <button
                  onClick={() => setPage((p) => Math.min(totalPages, p + 1))}
                  disabled={page >= totalPages}
                  className="px-3 py-1.5 text-sm font-medium rounded-lg border border-gray-300 text-gray-700 hover:bg-gray-50 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
                >
                  Next
                </button>
              </div>
            </div>
          )}
        </>
      )}
    </div>
  );
};

export default withErrorBoundary(MyApprovalRequests);
