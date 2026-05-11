import React, { useState } from 'react';
import { toast } from 'react-hot-toast';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { Modal } from '../ui/Modal';
import approvalService, { ApprovalRequest } from '../../services/approvalService';
import ApprovalBadge from './ApprovalBadge';

interface ApprovalReviewModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSuccess?: () => void;
  approvalRequest: ApprovalRequest;
}

const ApprovalReviewModal: React.FC<ApprovalReviewModalProps> = ({
  isOpen,
  onClose,
  onSuccess,
  approvalRequest,
}) => {
  const queryClient = useQueryClient();
  const [action, setAction] = useState<'approve' | 'reject' | null>(null);
  const [notes, setNotes] = useState<string>('');
  const [errors, setErrors] = useState<{ notes?: string }>({});

  const approveMutation = useMutation({
    mutationFn: ({ id, notes }: { id: string; notes?: string }) =>
      approvalService.approveRequest(id, notes),
    onSuccess: () => {
      toast.success('Request approved successfully');
      queryClient.invalidateQueries({ queryKey: ['approvalRequests'] });
      queryClient.invalidateQueries({ queryKey: ['approvalStats'] });
      handleClose();
      onSuccess?.();
    },
    onError: (err: unknown) => {
      const axiosError = err as { response?: { data?: { message?: string } } };
      toast.error(axiosError?.response?.data?.message || 'Failed to approve request');
    },
  });

  const rejectMutation = useMutation({
    mutationFn: ({ id, reason }: { id: string; reason: string }) =>
      approvalService.rejectRequest(id, reason),
    onSuccess: () => {
      toast.success('Request rejected');
      queryClient.invalidateQueries({ queryKey: ['approvalRequests'] });
      queryClient.invalidateQueries({ queryKey: ['approvalStats'] });
      handleClose();
      onSuccess?.();
    },
    onError: (err: unknown) => {
      const axiosError = err as { response?: { data?: { message?: string } } };
      toast.error(axiosError?.response?.data?.message || 'Failed to reject request');
    },
  });

  const validateForm = (): boolean => {
    if (action === 'reject') {
      if (!notes.trim()) {
        setErrors({ notes: 'Rejection reason is required' });
        return false;
      }
      if (notes.trim().length < 20) {
        setErrors({ notes: 'Rejection reason must be at least 20 characters' });
        return false;
      }
    }
    setErrors({});
    return true;
  };

  const handleSubmit = async () => {
    if (!validateForm() || !action) {
      return;
    }

    if (action === 'approve') {
      approveMutation.mutate({
        id: approvalRequest._id,
        notes: notes.trim() || undefined,
      });
    } else if (action === 'reject') {
      rejectMutation.mutate({
        id: approvalRequest._id,
        reason: notes.trim(),
      });
    }
  };

  const handleClose = () => {
    setAction(null);
    setNotes('');
    setErrors({});
    onClose();
  };

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
    if (approvalRequest.requestType === 'price_change') {
      const currentPrice = Number(approvalRequest.requestData?.original?.basePrice);
      const requestedPrice = Number(approvalRequest.requestData?.proposed?.basePrice);

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
        <div className="bg-gray-50 rounded-lg p-4 space-y-3">
          <div className="flex items-center justify-between">
            <span className="text-sm text-gray-600">Current Price:</span>
            <span className="font-semibold text-lg">${currentPrice.toFixed(2)}</span>
          </div>
          <div className="flex items-center justify-center">
            <span className="text-2xl text-gray-400">&darr;</span>
          </div>
          <div className="flex items-center justify-between">
            <span className="text-sm text-gray-600">Requested Price:</span>
            <span className="font-semibold text-lg text-blue-600">
              ${requestedPrice.toFixed(2)}
            </span>
          </div>
          <div className="pt-3 border-t border-gray-200">
            <div className="flex items-center justify-between">
              <span className="text-sm font-medium text-gray-700">Net Change:</span>
              <span
                className={`font-bold text-lg ${
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

    const original = approvalRequest.requestData?.original;
    const proposed = approvalRequest.requestData?.proposed;

    return (
      <div className="space-y-3">
        {original && (
          <div>
            <p className="text-sm font-medium text-gray-700 mb-2">Current State:</p>
            <pre className="text-xs bg-gray-50 p-3 rounded overflow-x-auto">
              {JSON.stringify(original, null, 2)}
            </pre>
          </div>
        )}
        {proposed && (
          <div>
            <p className="text-sm font-medium text-gray-700 mb-2">Requested State:</p>
            <pre className="text-xs bg-blue-50 p-3 rounded overflow-x-auto">
              {JSON.stringify(proposed, null, 2)}
            </pre>
          </div>
        )}
      </div>
    );
  };

  const isPending = approveMutation.isPending || rejectMutation.isPending;

  return (
    <Modal isOpen={isOpen} onClose={handleClose} title="Review Approval Request">
      <div className="space-y-6">
        {/* Request Header */}
        <div className="bg-blue-50 p-4 rounded-lg">
          <div className="flex items-center justify-between mb-2">
            <h3 className="font-semibold text-blue-900">
              {getRequestTypeLabel(approvalRequest.requestType)}
            </h3>
            <ApprovalBadge status={approvalRequest.status} />
          </div>
          <p className="text-sm text-blue-700">
            Target:{' '}
            <span className="font-medium">
              {getTargetResourceLabel(approvalRequest.targetResource)}
            </span>
            <span className="ml-1 text-xs text-blue-500">
              ({approvalRequest.targetResourceId})
            </span>
          </p>
        </div>

        {/* Request Details */}
        <div className="grid grid-cols-2 gap-4">
          <div>
            <p className="text-xs text-gray-500">Requested By</p>
            <p className="text-sm font-medium text-gray-900">
              {approvalRequest.requestedBy?.name ?? 'Unknown'}
            </p>
            {approvalRequest.requestedBy?.email && (
              <p className="text-xs text-gray-500">{approvalRequest.requestedBy.email}</p>
            )}
          </div>
          <div>
            <p className="text-xs text-gray-500">Submitted</p>
            <p className="text-sm font-medium text-gray-900">
              {formatDate(approvalRequest.createdAt)}
            </p>
          </div>
        </div>

        {/* Changes Comparison */}
        <div>
          <h4 className="text-sm font-medium text-gray-700 mb-3">
            Requested Changes
          </h4>
          {renderChanges()}
        </div>

        {/* Action Selection */}
        {approvalRequest.status === 'pending' && !action && (
          <div className="space-y-3">
            <p className="text-sm font-medium text-gray-700">Select Action:</p>
            <div className="flex gap-3">
              <button
                onClick={() => setAction('approve')}
                className="flex-1 px-4 py-3 bg-green-600 text-white rounded-lg font-medium hover:bg-green-700 transition-colors"
              >
                Approve Request
              </button>
              <button
                onClick={() => setAction('reject')}
                className="flex-1 px-4 py-3 bg-red-600 text-white rounded-lg font-medium hover:bg-red-700 transition-colors"
              >
                Reject Request
              </button>
            </div>
          </div>
        )}

        {/* Notes/Reason Input */}
        {action && (
          <div className="space-y-3">
            <div
              className={`p-3 rounded-lg ${
                action === 'approve' ? 'bg-green-50' : 'bg-red-50'
              }`}
            >
              <p
                className={`text-sm font-medium ${
                  action === 'approve' ? 'text-green-800' : 'text-red-800'
                }`}
              >
                {action === 'approve'
                  ? 'Approving this request'
                  : 'Rejecting this request'}
              </p>
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">
                {action === 'approve' ? 'Notes (Optional)' : 'Rejection Reason'}
                {action === 'reject' && <span className="text-red-500"> *</span>}
              </label>
              <textarea
                value={notes}
                onChange={(e) => {
                  setNotes(e.target.value);
                  setErrors({});
                }}
                rows={4}
                className={`w-full px-4 py-2 border rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent resize-none ${
                  errors.notes ? 'border-red-500' : 'border-gray-300'
                }`}
                placeholder={
                  action === 'approve'
                    ? 'Add any notes or comments (optional)...'
                    : 'Explain why you are rejecting this request (minimum 20 characters)...'
                }
              />
              {errors.notes ? (
                <p className="mt-1 text-sm text-red-600">{errors.notes}</p>
              ) : (
                action === 'reject' && (
                  <p className="mt-1 text-sm text-gray-500">
                    {notes.length}/20 characters minimum
                  </p>
                )
              )}
            </div>
          </div>
        )}

        {/* Actions */}
        <div className="flex gap-3 pt-4 border-t">
          {action ? (
            <>
              <button
                type="button"
                onClick={() => {
                  setAction(null);
                  setNotes('');
                  setErrors({});
                }}
                className="flex-1 px-4 py-2 border border-gray-300 rounded-lg text-gray-700 font-medium hover:bg-gray-50 transition-colors"
                disabled={isPending}
              >
                Back
              </button>
              <button
                onClick={handleSubmit}
                className={`flex-1 px-4 py-2 rounded-lg font-medium text-white transition-colors disabled:opacity-50 disabled:cursor-not-allowed ${
                  action === 'approve'
                    ? 'bg-green-600 hover:bg-green-700'
                    : 'bg-red-600 hover:bg-red-700'
                }`}
                disabled={isPending}
              >
                {isPending
                  ? 'Processing...'
                  : action === 'approve'
                  ? 'Confirm Approval'
                  : 'Confirm Rejection'}
              </button>
            </>
          ) : (
            <button
              type="button"
              onClick={handleClose}
              className="w-full px-4 py-2 border border-gray-300 rounded-lg text-gray-700 font-medium hover:bg-gray-50 transition-colors"
            >
              Close
            </button>
          )}
        </div>
      </div>
    </Modal>
  );
};

export default ApprovalReviewModal;
