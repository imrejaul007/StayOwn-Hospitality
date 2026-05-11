import React, { useState } from 'react';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import approvalService, { ApprovalRequest } from '../../services/approvalService';
import ApprovalBadge from '../../components/approvals/ApprovalBadge';
import ApprovalReviewModal from '../../components/approvals/ApprovalReviewModal';
import { withErrorBoundary } from '../../components/ErrorBoundary';

type StatusFilter = 'all' | 'pending' | 'approved' | 'rejected';
type RequestTypeFilter = 'all' | 'price_change' | 'rate_adjustment' | 'room_type_add' | 'room_type_delete';

const ApprovalManagement: React.FC = () => {
  const queryClient = useQueryClient();
  const [statusFilter, setStatusFilter] = useState<StatusFilter>('all');
  const [requestTypeFilter, setRequestTypeFilter] = useState<RequestTypeFilter>('all');
  const [selectedRequest, setSelectedRequest] = useState<ApprovalRequest | null>(null);
  const [isReviewModalOpen, setIsReviewModalOpen] = useState(false);

  const [page, setPage] = useState(1);
  const PAGE_SIZE = 20;

  const { data: paginatedData, isLoading } = useQuery({
    queryKey: ['approvalRequests', statusFilter, requestTypeFilter, page],
    queryFn: () => {
      return approvalService.getAllApprovalRequests({
        ...(statusFilter !== 'all' ? { status: statusFilter } : {}),
        ...(requestTypeFilter !== 'all' ? { requestType: requestTypeFilter } : {}),
        page,
        limit: PAGE_SIZE,
      });
    },
    keepPreviousData: true,
  });

  const requests = paginatedData?.data ?? [];
  const totalCount = paginatedData?.totalCount ?? 0;
  const totalPages = paginatedData?.totalPages ?? 1;

  const { data: stats } = useQuery({
    queryKey: ['approvalStats'],
    queryFn: () => approvalService.getApprovalStats(),
  });

  const handleReview = (request: ApprovalRequest) => {
    setSelectedRequest(request);
    setIsReviewModalOpen(true);
  };

  const handleReviewSuccess = () => {
    setSelectedRequest(null);
    setIsReviewModalOpen(false);
    // Refresh both the approval requests list and stats after a review action
    queryClient.invalidateQueries({ queryKey: ['approvalRequests'] });
    queryClient.invalidateQueries({ queryKey: ['approvalStats'] });
  };

  const formatDate = (dateString: string) => {
    return new Date(dateString).toLocaleString('en-US', {
      year: 'numeric',
      month: 'short',
      day: 'numeric',
      hour: '2-digit',
      minute: '2-digit',
    });
  };

  const getRequestTypeLabel = (type: string) => {
    const labels: Record<string, string> = {
      price_change: 'Price Change',
      rate_adjustment: 'Rate Adjustment',
      room_type_add: 'Room Type Addition',
      room_type_delete: 'Room Type Deletion',
    };
    return labels[type] || type;
  };

  const getTargetResourceLabel = (resource: string) => {
    const labels: Record<string, string> = {
      room_type: 'Room Type',
      booking: 'Booking',
      room: 'Room',
    };
    return labels[resource] || resource;
  };

  // Backend already filters by status and requestType; no client-side re-filtering needed
  const filteredRequests = requests;
  const pendingRequests = filteredRequests.filter((r) => r.status === 'pending');

  return (
    <div className="p-6 max-w-7xl mx-auto">
      {/* Header */}
      <div className="mb-6">
        <h1 className="text-2xl font-bold text-gray-900 mb-2">
          Approval Management
        </h1>
        <p className="text-gray-600">
          Review and manage approval requests from staff members
        </p>
      </div>

      {/* Stats Cards */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-6">
        <div className="bg-gradient-to-br from-yellow-500 to-yellow-600 text-white rounded-lg p-6 shadow-lg">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-yellow-100 text-sm font-medium">
                Pending Review
              </p>
              <p className="text-4xl font-bold mt-2">{stats?.pending || 0}</p>
              <p className="text-yellow-100 text-sm mt-1">
                Requires immediate attention
              </p>
            </div>
            <div className="w-16 h-16 bg-yellow-400 bg-opacity-30 rounded-full flex items-center justify-center">
              <span className="text-4xl">⏳</span>
            </div>
          </div>
        </div>

        <div className="bg-gradient-to-br from-green-500 to-green-600 text-white rounded-lg p-6 shadow-lg">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-green-100 text-sm font-medium">
                Approved (30 days)
              </p>
              <p className="text-4xl font-bold mt-2">{stats?.approved || 0}</p>
              <p className="text-green-100 text-sm mt-1">Successfully approved</p>
            </div>
            <div className="w-16 h-16 bg-green-400 bg-opacity-30 rounded-full flex items-center justify-center">
              <span className="text-4xl">✓</span>
            </div>
          </div>
        </div>

        <div className="bg-gradient-to-br from-red-500 to-red-600 text-white rounded-lg p-6 shadow-lg">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-red-100 text-sm font-medium">
                Rejected (30 days)
              </p>
              <p className="text-4xl font-bold mt-2">{stats?.rejected || 0}</p>
              <p className="text-red-100 text-sm mt-1">Declined requests</p>
            </div>
            <div className="w-16 h-16 bg-red-400 bg-opacity-30 rounded-full flex items-center justify-center">
              <span className="text-4xl">✗</span>
            </div>
          </div>
        </div>
      </div>

      {/* Filters */}
      <div className="bg-white border border-gray-200 rounded-lg p-4 mb-6">
        <div className="space-y-4">
          {/* Status Filter */}
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">
              Filter by Status:
            </label>
            <div className="flex gap-2 flex-wrap">
              {(['all', 'pending', 'approved', 'rejected'] as StatusFilter[]).map(
                (status) => (
                  <button aria-label="Filter"
                    key={status}
                    onClick={() => { setStatusFilter(status); setPage(1); }}
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

          {/* Request Type Filter */}
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">
              Filter by Request Type:
            </label>
            <div className="flex gap-2 flex-wrap">
              {(
                [
                  'all',
                  'price_change',
                  'rate_adjustment',
                  'room_type_add',
                  'room_type_delete',
                ] as RequestTypeFilter[]
              ).map((type) => (
                <button aria-label="Filter"
                  key={type}
                  onClick={() => { setRequestTypeFilter(type); setPage(1); }}
                  className={`px-4 py-2 rounded-lg font-medium text-sm transition-colors ${
                    requestTypeFilter === type
                      ? 'bg-blue-600 text-white'
                      : 'bg-gray-100 text-gray-700 hover:bg-gray-200'
                  }`}
                >
                  {type === 'all' ? 'All Types' : getRequestTypeLabel(type)}
                </button>
              ))}
            </div>
          </div>
        </div>
      </div>

      {/* Pending Requests Alert */}
      {pendingRequests.length > 0 && (
        <div className="bg-yellow-50 border-l-4 border-yellow-400 p-4 mb-6">
          <div className="flex items-center">
            <span className="text-yellow-400 text-2xl mr-3">⚠️</span>
            <div>
              <p className="text-sm font-medium text-yellow-800">
                {pendingRequests.length} request
                {pendingRequests.length !== 1 ? 's' : ''} pending review
              </p>
              <p className="text-sm text-yellow-700 mt-1">
                These requests require immediate attention from an administrator
              </p>
            </div>
          </div>
        </div>
      )}

      {/* Requests Table */}
      {isLoading ? (
        <div className="bg-white border border-gray-200 rounded-lg p-12 text-center">
          <div className="inline-block animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600"></div>
          <p className="mt-4 text-gray-600">Loading requests...</p>
        </div>
      ) : filteredRequests.length === 0 ? (
        <div className="bg-white border border-gray-200 rounded-lg p-12 text-center">
          <span className="text-6xl mb-4 block">📋</span>
          <h3 className="text-lg font-semibold text-gray-900 mb-2">
            No requests found
          </h3>
          <p className="text-gray-600">
            There are no approval requests matching your filters.
          </p>
        </div>
      ) : (
        <div className="bg-white border border-gray-200 rounded-lg overflow-hidden">
          <div className="overflow-x-auto">
            <table className="min-w-full divide-y divide-gray-200">
              <thead className="bg-gray-50">
                <tr>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                    Request Type
                  </th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                    Target
                  </th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                    Requested By
                  </th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                    Submitted
                  </th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                    Status
                  </th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                    Reviewed By
                  </th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                    Actions
                  </th>
                </tr>
              </thead>
              <tbody className="bg-white divide-y divide-gray-200">
                {filteredRequests.map((request) => (
                  <tr
                    key={request._id}
                    className={`hover:bg-gray-50 ${
                      request.status === 'pending' ? 'bg-yellow-50' : ''
                    }`}
                  >
                    <td className="px-6 py-4 whitespace-nowrap">
                      <div className="text-sm font-medium text-gray-900">
                        {getRequestTypeLabel(request.requestType)}
                      </div>
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap">
                      <div className="text-sm text-gray-900">
                        {getTargetResourceLabel(request.targetResource)}
                      </div>
                      <div className="text-xs text-gray-500">
                        {request.targetResourceId}
                      </div>
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap">
                      <div className="text-sm text-gray-900">
                        {request.requestedBy.name}
                      </div>
                      <div className="text-xs text-gray-500">
                        {request.requestedBy.email}
                      </div>
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                      {formatDate(request.createdAt)}
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap">
                      <ApprovalBadge status={request.status} size="sm" />
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap">
                      {request.reviewedBy ? (
                        <div>
                          <div className="text-sm text-gray-900">
                            {request.reviewedBy.name}
                          </div>
                          <div className="text-xs text-gray-500">
                            {request.reviewedAt && formatDate(request.reviewedAt)}
                          </div>
                        </div>
                      ) : (
                        <span className="text-sm text-gray-400">—</span>
                      )}
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-sm">
                      {request.status === 'pending' ? (
                        <button
                          onClick={() => handleReview(request)}
                          className="bg-blue-600 text-white px-4 py-2 rounded-lg hover:bg-blue-700 transition-colors font-medium"
                        >
                          Review
                        </button>
                      ) : (
                        <button
                          onClick={() => handleReview(request)}
                          className="text-blue-600 hover:text-blue-800 font-medium"
                        >
                          View Details
                        </button>
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* Pagination Controls */}
      {!isLoading && totalPages > 1 && (
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

      {/* Review Modal */}
      {selectedRequest && (
        <ApprovalReviewModal
          isOpen={isReviewModalOpen}
          onClose={() => {
            setIsReviewModalOpen(false);
            setSelectedRequest(null);
          }}
          onSuccess={handleReviewSuccess}
          approvalRequest={selectedRequest}
        />
      )}
    </div>
  );
};

export default withErrorBoundary(ApprovalManagement);
