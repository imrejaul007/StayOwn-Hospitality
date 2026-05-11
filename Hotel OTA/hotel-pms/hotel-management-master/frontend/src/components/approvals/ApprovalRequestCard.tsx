import React from 'react';
import { ApprovalRequest } from '../../services/approvalService';
import ApprovalBadge from './ApprovalBadge';

interface ApprovalRequestCardProps {
  request: ApprovalRequest;
  showActions?: boolean;
  onReview?: (request: ApprovalRequest) => void;
  onCancel?: (request: ApprovalRequest) => void;
}

const ApprovalRequestCard: React.FC<ApprovalRequestCardProps> = ({
  request,
  showActions = false,
  onReview,
  onCancel,
}) => {
  const formatDate = (dateString?: string | null) => {
    if (!dateString) return 'N/A';
    const d = new Date(dateString);
    if (isNaN(d.getTime())) return 'Invalid date';
    return d.toLocaleString('en-US', {
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

  const renderChanges = () => {
    if (request.requestType === 'price_change') {
      const currentPrice = Number(request.requestData?.original?.basePrice);
      const requestedPrice = Number(request.requestData?.proposed?.basePrice);

      if (isNaN(currentPrice) || isNaN(requestedPrice)) {
        return (
          <div className="text-sm text-gray-500">
            Price data unavailable.
          </div>
        );
      }

      const change = requestedPrice - currentPrice;
      const changePercent =
        currentPrice !== 0 ? ((change / currentPrice) * 100).toFixed(1) : 'N/A';

      return (
        <div className="space-y-2">
          <div className="flex items-center justify-between">
            <span className="text-sm text-gray-600">Current Price:</span>
            <span className="font-medium">${currentPrice.toFixed(2)}</span>
          </div>
          <div className="flex items-center justify-between">
            <span className="text-sm text-gray-600">Requested Price:</span>
            <span className="font-medium">${requestedPrice.toFixed(2)}</span>
          </div>
          <div className="pt-2 border-t">
            <div className="flex items-center justify-between">
              <span className="text-sm font-medium text-gray-700">Change:</span>
              <span
                className={`font-semibold ${
                  change > 0 ? 'text-green-600' : change < 0 ? 'text-red-600' : 'text-gray-600'
                }`}
              >
                {change > 0 ? '+' : ''}${change.toFixed(2)}
                {changePercent !== 'N/A' && (
                  <> ({change > 0 ? '+' : ''}{changePercent}%)</>
                )}
              </span>
            </div>
          </div>
        </div>
      );
    }

    const original = request.requestData?.original;
    const proposed = request.requestData?.proposed;

    return (
      <div className="space-y-2">
        {original && (
          <div>
            <p className="text-sm text-gray-600 mb-1">Current:</p>
            <pre className="text-xs bg-gray-50 p-2 rounded overflow-x-auto">
              {JSON.stringify(original, null, 2)}
            </pre>
          </div>
        )}
        {proposed && (
          <div>
            <p className="text-sm text-gray-600 mb-1">Requested:</p>
            <pre className="text-xs bg-gray-50 p-2 rounded overflow-x-auto">
              {JSON.stringify(proposed, null, 2)}
            </pre>
          </div>
        )}
      </div>
    );
  };

  const requesterName = request.requestedBy?.name ?? 'Unknown';
  const requesterEmail = request.requestedBy?.email ?? '';

  return (
    <div className="bg-white border border-gray-200 rounded-lg shadow-sm hover:shadow-md transition-shadow">
      {/* Header */}
      <div className="p-4 border-b border-gray-200">
        <div className="flex items-start justify-between gap-4">
          <div className="flex-1">
            <div className="flex items-center gap-3 mb-2">
              <h3 className="font-semibold text-gray-900">
                {getRequestTypeLabel(request.requestType)}
              </h3>
              <ApprovalBadge status={request.status} size="sm" />
            </div>
            <p className="text-sm text-gray-600">
              Target: <span className="font-medium">
                {getTargetResourceLabel(request.targetResource)}
              </span>
              <span className="ml-1 text-xs text-gray-400">
                ({request.targetResourceId})
              </span>
            </p>
          </div>
        </div>
      </div>

      {/* Content */}
      <div className="p-4 space-y-4">
        {/* Changes Section */}
        <div>
          <h4 className="text-sm font-medium text-gray-700 mb-2">
            Requested Changes
          </h4>
          {renderChanges()}
        </div>

        {/* Request Info */}
        <div className="grid grid-cols-2 gap-4 pt-3 border-t">
          <div>
            <p className="text-xs text-gray-500">Requested By</p>
            <p className="text-sm font-medium text-gray-900">
              {requesterName}
            </p>
            {requesterEmail && (
              <p className="text-xs text-gray-500">{requesterEmail}</p>
            )}
          </div>
          <div>
            <p className="text-xs text-gray-500">Submitted</p>
            <p className="text-sm font-medium text-gray-900">
              {formatDate(request.createdAt)}
            </p>
          </div>
        </div>

        {/* Review Info (if reviewed) */}
        {request.reviewedBy && (
          <div className="pt-3 border-t">
            <div className="grid grid-cols-2 gap-4">
              <div>
                <p className="text-xs text-gray-500">Reviewed By</p>
                <p className="text-sm font-medium text-gray-900">
                  {request.reviewedBy.name ?? 'Unknown'}
                </p>
                {request.reviewedBy.email && (
                  <p className="text-xs text-gray-500">{request.reviewedBy.email}</p>
                )}
              </div>
              <div>
                <p className="text-xs text-gray-500">Reviewed At</p>
                <p className="text-sm font-medium text-gray-900">
                  {formatDate(request.reviewedAt)}
                </p>
              </div>
            </div>
            {request.reviewNotes && (
              <div className="mt-3">
                <p className="text-xs text-gray-500 mb-1">Review Notes</p>
                <p className="text-sm text-gray-700 bg-gray-50 p-3 rounded-lg">
                  {request.reviewNotes}
                </p>
              </div>
            )}
          </div>
        )}
      </div>

      {/* Actions */}
      {showActions && (
        <div className="p-4 border-t border-gray-200 bg-gray-50 rounded-b-lg">
          <div className="flex gap-3">
            {request.status === 'pending' && onReview && (
              <button
                onClick={() => onReview(request)}
                className="flex-1 px-4 py-2 bg-blue-600 text-white rounded-lg font-medium hover:bg-blue-700 transition-colors"
              >
                Review Request
              </button>
            )}
            {request.status === 'pending' && onCancel && (
              <button
                onClick={() => onCancel(request)}
                className="px-4 py-2 border border-gray-300 rounded-lg text-gray-700 font-medium hover:bg-white transition-colors"
              >
                Cancel
              </button>
            )}
          </div>
        </div>
      )}
    </div>
  );
};

export default ApprovalRequestCard;
