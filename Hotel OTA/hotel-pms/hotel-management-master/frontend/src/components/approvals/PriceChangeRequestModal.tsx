import React, { useState } from 'react';
import { toast } from 'react-hot-toast';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { Modal } from '../ui/Modal';
import approvalService from '../../services/approvalService';

interface RoomType {
  _id: string;
  name: string;
  basePrice: number;
}

interface PriceChangeRequestModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSuccess?: () => void;
  roomType: RoomType;
}

const PriceChangeRequestModal: React.FC<PriceChangeRequestModalProps> = ({
  isOpen,
  onClose,
  onSuccess,
  roomType,
}) => {
  const queryClient = useQueryClient();
  const [requestedPrice, setRequestedPrice] = useState<string>('');
  const [reason, setReason] = useState<string>('');
  const [errors, setErrors] = useState<{ requestedPrice?: string; reason?: string }>({});

  const createRequestMutation = useMutation({
    mutationFn: approvalService.createApprovalRequest,
    onSuccess: () => {
      toast.success('Price change request submitted for approval');
      queryClient.invalidateQueries({ queryKey: ['approvalRequests'] });
      queryClient.invalidateQueries({ queryKey: ['myApprovalRequests'] });
      handleClose();
      onSuccess?.();
    },
    onError: (err: unknown) => {
      const axiosError = err as { response?: { data?: { message?: string } } };
      toast.error(axiosError?.response?.data?.message || 'Failed to submit request');
    },
  });

  const validateForm = (): boolean => {
    const newErrors: { requestedPrice?: string; reason?: string } = {};

    if (!requestedPrice || parseFloat(requestedPrice) <= 0) {
      newErrors.requestedPrice = 'Please enter a valid price';
    }

    if (parseFloat(requestedPrice) === roomType.basePrice) {
      newErrors.requestedPrice = 'Requested price must be different from current price';
    }

    if (!reason.trim()) {
      newErrors.reason = 'Reason is required';
    } else if (reason.trim().length < 20) {
      newErrors.reason = 'Reason must be at least 20 characters';
    }

    setErrors(newErrors);
    return Object.keys(newErrors).length === 0;
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    if (!validateForm()) {
      return;
    }

    createRequestMutation.mutate({
      requestType: 'price_change',
      targetResource: 'room_type',
      targetResourceId: roomType._id,
      requestData: {
        original: {
          basePrice: roomType.basePrice,
          name: roomType.name,
        },
        proposed: {
          basePrice: parseFloat(requestedPrice),
          reason: reason.trim(),
        },
      },
    });
  };

  const handleClose = () => {
    setRequestedPrice('');
    setReason('');
    setErrors({});
    onClose();
  };

  const priceChange = requestedPrice
    ? parseFloat(requestedPrice) - roomType.basePrice
    : 0;
  const priceChangePercent = requestedPrice && roomType.basePrice !== 0
    ? ((priceChange / roomType.basePrice) * 100).toFixed(1)
    : 'N/A';

  return (
    <Modal isOpen={isOpen} onClose={handleClose} title="Request Price Change">
      <form onSubmit={handleSubmit} className="space-y-6">
        {/* Room Type Info */}
        <div className="bg-blue-50 p-4 rounded-lg">
          <h3 className="font-semibold text-blue-900 mb-1">{roomType.name}</h3>
          <p className="text-sm text-blue-700">
            Requesting approval to change the base price
          </p>
        </div>

        {/* Current Price */}
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-2">
            Current Price
          </label>
          <div className="bg-gray-50 border border-gray-200 rounded-lg px-4 py-3 text-gray-900 font-medium">
            ${roomType.basePrice.toFixed(2)}
          </div>
        </div>

        {/* Requested Price */}
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-2">
            Requested Price <span className="text-red-500">*</span>
          </label>
          <div className="relative">
            <span className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-500">
              $
            </span>
            <input
              type="number"
              step="0.01"
              min="0"
              value={requestedPrice}
              onChange={(e) => {
                setRequestedPrice(e.target.value);
                setErrors((prev) => ({ ...prev, requestedPrice: undefined }));
              }}
              className={`w-full pl-8 pr-4 py-2 border rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent ${
                errors.requestedPrice ? 'border-red-500' : 'border-gray-300'
              }`}
              placeholder="0.00"
            />
          </div>
          {errors.requestedPrice && (
            <p className="mt-1 text-sm text-red-600">{errors.requestedPrice}</p>
          )}

          {/* Price Change Indicator */}
          {requestedPrice && !errors.requestedPrice && (
            <div
              className={`mt-2 p-3 rounded-lg ${
                priceChange > 0
                  ? 'bg-green-50 text-green-800'
                  : priceChange < 0
                  ? 'bg-red-50 text-red-800'
                  : 'bg-gray-50 text-gray-800'
              }`}
            >
              <div className="flex items-center justify-between text-sm font-medium">
                <span>Price Change:</span>
                <span>
                  {priceChange > 0 ? '+' : ''}${priceChange.toFixed(2)} (
                  {priceChange > 0 ? '+' : ''}
                  {priceChangePercent}%)
                </span>
              </div>
            </div>
          )}
        </div>

        {/* Reason */}
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-2">
            Reason for Change <span className="text-red-500">*</span>
          </label>
          <textarea
            value={reason}
            onChange={(e) => {
              setReason(e.target.value);
              setErrors((prev) => ({ ...prev, reason: undefined }));
            }}
            rows={4}
            className={`w-full px-4 py-2 border rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent resize-none ${
              errors.reason ? 'border-red-500' : 'border-gray-300'
            }`}
            placeholder="Explain why this price change is necessary (minimum 20 characters)..."
          />
          <div className="flex items-center justify-between mt-1">
            {errors.reason ? (
              <p className="text-sm text-red-600">{errors.reason}</p>
            ) : (
              <p className="text-sm text-gray-500">
                {reason.length}/20 characters minimum
              </p>
            )}
          </div>
        </div>

        {/* Info Box */}
        <div className="bg-amber-50 border border-amber-200 rounded-lg p-4">
          <div className="flex items-start gap-3">
            <span className="text-amber-600 text-xl">ℹ️</span>
            <div className="text-sm text-amber-800">
              <p className="font-medium mb-1">Approval Required</p>
              <p>
                This request will be reviewed by an administrator before the
                price change takes effect. You will be notified of the decision.
              </p>
            </div>
          </div>
        </div>

        {/* Actions */}
        <div className="flex gap-3 pt-4 border-t">
          <button
            type="button"
            onClick={handleClose}
            className="flex-1 px-4 py-2 border border-gray-300 rounded-lg text-gray-700 font-medium hover:bg-gray-50 transition-colors"
            disabled={createRequestMutation.isPending}
          >
            Cancel
          </button>
          <button aria-label="Close"
            type="submit"
            className="flex-1 px-4 py-2 bg-blue-600 text-white rounded-lg font-medium hover:bg-blue-700 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
            disabled={createRequestMutation.isPending}
          >
            {createRequestMutation.isPending ? 'Submitting...' : 'Submit Request'}
          </button>
        </div>
      </form>
    </Modal>
  );
};

export default PriceChangeRequestModal;
