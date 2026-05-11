import React, { useState } from 'react';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import {
  X,
  Calendar,
  Users,
  Clock,
  Home,
  AlertCircle,
  CheckCircle,
  Loader2
} from 'lucide-react';
import { bookingService } from '../../services/bookingService';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Modal } from '@/components/ui/Modal';
import { formatCurrency, formatDate } from '../../utils/formatters';
import toast from 'react-hot-toast';

interface BookingModificationModalProps {
  booking: {
    _id: string;
    bookingNumber: string;
    checkIn: string;
    checkOut: string;
    totalAmount: number;
    currency: string;
    guestDetails: {
      adults: number;
      children: number;
      specialRequests?: string;
    };
    nights: number;
    status: string;
  };
  isOpen: boolean;
  onClose: () => void;
  onSuccess?: () => void;
}

type ModificationType = 'date_change' | 'room_upgrade' | 'guest_count' | 'early_checkin' | 'late_checkout';

interface ModificationOption {
  id: ModificationType;
  title: string;
  description: string;
  icon: React.ReactNode;
  available: boolean;
  reason?: string;
}

export default function BookingModificationModal({
  booking,
  isOpen,
  onClose,
  onSuccess
}: BookingModificationModalProps) {
  const queryClient = useQueryClient();
  const [selectedModification, setSelectedModification] = useState<ModificationType | null>(null);
  const [formData, setFormData] = useState({
    newCheckIn: formatDate(booking.checkIn, 'yyyy-MM-dd'),
    newCheckOut: formatDate(booking.checkOut, 'yyyy-MM-dd'),
    newAdults: booking.guestDetails.adults,
    newChildren: booking.guestDetails.children,
    reason: '',
    specialRequests: ''
  });

  const modificationOptions: ModificationOption[] = [
    {
      id: 'date_change',
      title: 'Change Dates',
      description: 'Modify check-in or check-out dates',
      icon: <Calendar className="w-5 h-5" />,
      available: ['confirmed', 'pending'].includes(booking.status),
      reason: booking.status !== 'confirmed' && booking.status !== 'pending' ? 'Only available for confirmed or pending bookings' : undefined
    },
    {
      id: 'room_upgrade',
      title: 'Room Upgrade',
      description: 'Request an upgrade to a better room category',
      icon: <Home className="w-5 h-5" />,
      available: ['confirmed'].includes(booking.status),
      reason: booking.status !== 'confirmed' ? 'Only available for confirmed bookings' : undefined
    },
    {
      id: 'guest_count',
      title: 'Guest Count',
      description: 'Change number of adults or children',
      icon: <Users className="w-5 h-5" />,
      available: ['confirmed', 'pending'].includes(booking.status),
      reason: booking.status !== 'confirmed' && booking.status !== 'pending' ? 'Only available for confirmed or pending bookings' : undefined
    },
    {
      id: 'early_checkin',
      title: 'Early Check-in',
      description: 'Request to check in before standard time',
      icon: <Clock className="w-5 h-5" />,
      available: ['confirmed'].includes(booking.status) && new Date(booking.checkIn) > new Date(),
      reason: booking.status !== 'confirmed' ? 'Only available for confirmed bookings' :
              new Date(booking.checkIn) <= new Date() ? 'Check-in date has passed' : undefined
    },
    {
      id: 'late_checkout',
      title: 'Late Check-out',
      description: 'Request to check out after standard time',
      icon: <Clock className="w-5 h-5" />,
      available: ['confirmed', 'checked_in'].includes(booking.status),
      reason: !['confirmed', 'checked_in'].includes(booking.status) ? 'Only available for confirmed or checked-in bookings' : undefined
    }
  ];

  const createModificationMutation = useMutation({
    mutationFn: async ({
      modificationType,
      requestedChanges,
      reason
    }: {
      modificationType: ModificationType;
      requestedChanges: Record<string, unknown>;
      reason: string;
    }) => {
      return await bookingService.createModificationRequest(
        booking._id,
        modificationType,
        requestedChanges,
        reason,
        'medium'
      );
    },
    onSuccess: () => {
      toast.success('Modification request submitted successfully');
      queryClient.invalidateQueries({ queryKey: ['bookings'] });
      onSuccess?.();
      onClose();
    },
    onError: (error: unknown) => {
      toast.error(error.response?.data?.message || 'Failed to submit modification request');
    }
  });

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();

    if (!selectedModification) return;

    let requestedChanges: Record<string, unknown> = {};

    switch (selectedModification) {
      case 'date_change':
        requestedChanges = {
          checkIn: new Date(formData.newCheckIn).toISOString(),
          checkOut: new Date(formData.newCheckOut).toISOString()
        };
        break;
      case 'guest_count':
        requestedChanges = {
          guestDetails: {
            adults: formData.newAdults,
            children: formData.newChildren
          }
        };
        break;
      case 'room_upgrade':
        requestedChanges = {
          requestType: 'upgrade',
          specialRequests: formData.specialRequests
        };
        break;
      case 'early_checkin':
      case 'late_checkout':
        requestedChanges = {
          requestType: selectedModification,
          specialRequests: formData.specialRequests
        };
        break;
    }

    createModificationMutation.mutate({
      modificationType: selectedModification,
      requestedChanges,
      reason: formData.reason
    });
  };

  const renderModificationForm = () => {
    if (!selectedModification) return null;

    switch (selectedModification) {
      case 'date_change':
        return (
          <div className="space-y-4">
            <div className="grid grid-cols-2 gap-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  New Check-in Date
                </label>
                <Input
                  type="date"
                  value={formData.newCheckIn}
                  onChange={(e) => setFormData({ ...formData, newCheckIn: e.target.value })}
                  min={new Date().toISOString().split('T')[0]}
                  required
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  New Check-out Date
                </label>
                <Input
                  type="date"
                  value={formData.newCheckOut}
                  onChange={(e) => setFormData({ ...formData, newCheckOut: e.target.value })}
                  min={formData.newCheckIn}
                  required
                />
              </div>
            </div>
            <div className="bg-blue-50 p-3 rounded-lg">
              <div className="flex items-center text-blue-700 text-sm">
                <AlertCircle className="w-4 h-4 mr-2" />
                <span>Date changes may affect your total cost and are subject to availability</span>
              </div>
            </div>
          </div>
        );

      case 'guest_count':
        return (
          <div className="space-y-4">
            <div className="grid grid-cols-2 gap-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Adults
                </label>
                <Input
                  type="number"
                  min="1"
                  max="8"
                  value={formData.newAdults}
                  onChange={(e) => setFormData({ ...formData, newAdults: parseInt(e.target.value) })}
                  required
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Children
                </label>
                <Input
                  type="number"
                  min="0"
                  max="6"
                  value={formData.newChildren}
                  onChange={(e) => setFormData({ ...formData, newChildren: parseInt(e.target.value) })}
                  required
                />
              </div>
            </div>
            <div className="bg-yellow-50 p-3 rounded-lg">
              <div className="flex items-center text-yellow-700 text-sm">
                <AlertCircle className="w-4 h-4 mr-2" />
                <span>Additional guests may incur extra charges and are subject to room capacity</span>
              </div>
            </div>
          </div>
        );

      case 'room_upgrade':
      case 'early_checkin':
      case 'late_checkout':
        return (
          <div className="space-y-4">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                Special Requests (Optional)
              </label>
              <textarea
                className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-yellow-500 focus:border-transparent"
                rows={3}
                value={formData.specialRequests}
                onChange={(e) => setFormData({ ...formData, specialRequests: e.target.value })}
                placeholder={
                  selectedModification === 'room_upgrade'
                    ? 'Specify your preferred room type or any specific requirements...'
                    : selectedModification === 'early_checkin'
                    ? 'What time would you like to check in? Any specific requirements...'
                    : 'What time would you like to check out? Any specific requirements...'
                }
              />
            </div>
            <div className="bg-green-50 p-3 rounded-lg">
              <div className="flex items-center text-green-700 text-sm">
                <CheckCircle className="w-4 h-4 mr-2" />
                <span>
                  {selectedModification === 'room_upgrade' && 'Upgrades are subject to availability and may include additional charges'}
                  {selectedModification === 'early_checkin' && 'Early check-in requests will be confirmed based on room availability'}
                  {selectedModification === 'late_checkout' && 'Late check-out may be available for a small fee based on next-day reservations'}
                </span>
              </div>
            </div>
          </div>
        );

      default:
        return null;
    }
  };

  if (!isOpen) return null;

  return (
    <Modal
      isOpen={isOpen}
      onClose={onClose}
      title="Request Booking Modification"
      className="max-w-2xl"
    >
      <div className="p-6">
        {/* Booking Summary */}
        <div className="bg-gray-50 rounded-lg p-4 mb-6">
          <h3 className="font-medium text-gray-900 mb-2">Current Booking Details</h3>
          <div className="grid grid-cols-2 gap-4 text-sm">
            <div>
              <span className="text-gray-600">Booking:</span>
              <span className="ml-2 font-medium">#{booking.bookingNumber}</span>
            </div>
            <div>
              <span className="text-gray-600">Total:</span>
              <span className="ml-2 font-medium">{formatCurrency(booking.totalAmount, booking.currency)}</span>
            </div>
            <div>
              <span className="text-gray-600">Check-in:</span>
              <span className="ml-2 font-medium">{formatDate(booking.checkIn)}</span>
            </div>
            <div>
              <span className="text-gray-600">Check-out:</span>
              <span className="ml-2 font-medium">{formatDate(booking.checkOut)}</span>
            </div>
            <div>
              <span className="text-gray-600">Guests:</span>
              <span className="ml-2 font-medium">
                {booking.guestDetails.adults} adult{booking.guestDetails.adults !== 1 ? 's' : ''}
                {booking.guestDetails.children > 0 && `, ${booking.guestDetails.children} child${booking.guestDetails.children !== 1 ? 'ren' : ''}`}
              </span>
            </div>
            <div>
              <span className="text-gray-600">Nights:</span>
              <span className="ml-2 font-medium">{booking.nights}</span>
            </div>
          </div>
        </div>

        {!selectedModification ? (
          <div>
            <h3 className="font-medium text-gray-900 mb-4">What would you like to modify?</h3>
            <div className="space-y-3">
              {modificationOptions.map((option) => (
                <button aria-label="Close"
                  key={option.id}
                  onClick={() => option.available && setSelectedModification(option.id)}
                  disabled={!option.available}
                  className={`w-full flex items-center p-4 rounded-lg border-2 transition-all ${
                    option.available
                      ? 'border-gray-200 hover:border-yellow-300 hover:bg-yellow-50 cursor-pointer'
                      : 'border-gray-100 bg-gray-50 cursor-not-allowed opacity-60'
                  }`}
                >
                  <div className={`flex items-center justify-center w-10 h-10 rounded-full mr-4 ${
                    option.available ? 'bg-yellow-100 text-yellow-600' : 'bg-gray-100 text-gray-400'
                  }`}>
                    {option.icon}
                  </div>
                  <div className="flex-1 text-left">
                    <h4 className="font-medium text-gray-900">{option.title}</h4>
                    <p className="text-sm text-gray-600">{option.description}</p>
                    {!option.available && option.reason && (
                      <p className="text-xs text-red-500 mt-1">{option.reason}</p>
                    )}
                  </div>
                </button>
              ))}
            </div>
          </div>
        ) : (
          <form onSubmit={handleSubmit} className="space-y-6">
            {/* Back button */}
            <button
              type="button"
              onClick={() => setSelectedModification(null)}
              className="flex items-center text-sm text-gray-600 hover:text-gray-800"
            >
              ← Back to modification options
            </button>

            {/* Selected modification title */}
            <div className="flex items-center">
              <div className="flex items-center justify-center w-10 h-10 rounded-full bg-yellow-100 text-yellow-600 mr-3">
                {modificationOptions.find(opt => opt.id === selectedModification)?.icon}
              </div>
              <div>
                <h3 className="font-medium text-gray-900">
                  {modificationOptions.find(opt => opt.id === selectedModification)?.title}
                </h3>
                <p className="text-sm text-gray-600">
                  {modificationOptions.find(opt => opt.id === selectedModification)?.description}
                </p>
              </div>
            </div>

            {/* Modification form */}
            {renderModificationForm()}

            {/* Reason field */}
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                Reason for Request *
              </label>
              <textarea
                className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-yellow-500 focus:border-transparent"
                rows={3}
                value={formData.reason}
                onChange={(e) => setFormData({ ...formData, reason: e.target.value })}
                placeholder="Please explain why you need this modification..."
                required
              />
            </div>

            {/* Submit buttons */}
            <div className="flex items-center justify-end space-x-3 pt-4 border-t">
              <Button
                type="button"
                variant="ghost"
                onClick={onClose}
                disabled={createModificationMutation.isPending}
              >
                Cancel
              </Button>
              <Button
                type="submit"
                className="bg-yellow-600 hover:bg-yellow-700"
                disabled={createModificationMutation.isPending}
              >
                {createModificationMutation.isPending && (
                  <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                )}
                Submit Request
              </Button>
            </div>
          </form>
        )}
      </div>
    </Modal>
  );
}