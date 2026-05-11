import React, { useState } from 'react';
import { UserPlus, FileText, IndianRupee, Users } from 'lucide-react';
import { formatCurrency } from '@/utils/currencyUtils';
import { BookingEditModal } from '../booking/BookingEditModal';

interface BookingData {
  _id: string;
  bookingNumber: string;
  checkIn: string;
  checkOut: string;
  status: string;
  totalAmount: number;
  guestDetails: {
    adults: number;
    children: number;
  };
  extraPersons?: Array<{
    personId?: string;
    name: string;
    type: 'adult' | 'child';
    age?: number;
    isActive: boolean;
  }>;
  extraPersonCharges?: Array<{
    personId: string;
    baseCharge: number;
    totalCharge: number;
    currency: string;
    description: string;
  }>;
}

interface BookingEditingIntegrationProps {
  booking: BookingData;
  onBookingUpdated?: (updatedBooking: BookingData) => void;
}

export function BookingEditingIntegration({ booking, onBookingUpdated }: BookingEditingIntegrationProps) {
  const [isEditModalOpen, setIsEditModalOpen] = useState(false);

  const canEdit = ['confirmed', 'checked_in', 'checked_out'].includes(booking.status);
  const hasExtraPersons = booking.extraPersons && booking.extraPersons.length > 0;
  const totalExtraCharges = booking.extraPersonCharges?.reduce((sum, charge) => sum + charge.totalCharge, 0) || 0;

  if (!canEdit) {
    return null; // Don't show editing options for bookings that can't be edited
  }

  return (
    <>
      <div className="space-y-4">
        {/* Extra Persons Summary */}
        <div className="bg-gradient-to-r from-blue-50 to-indigo-50 rounded-lg p-4 border border-blue-200">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3">
              <div className="p-2 bg-blue-100 rounded-lg">
                <Users className="w-5 h-5 text-blue-600" />
              </div>
              <div>
                <h4 className="font-semibold text-gray-900">Guest Management</h4>
                <p className="text-sm text-gray-600">
                  {booking.guestDetails.adults} adults, {booking.guestDetails.children} children
                  {hasExtraPersons && (
                    <span className="ml-2 text-blue-600 font-medium">
                      + {booking.extraPersons!.length} extra person{booking.extraPersons!.length > 1 ? 's' : ''}
                    </span>
                  )}
                </p>
              </div>
            </div>
            <button
              onClick={() => setIsEditModalOpen(true)}
              className="bg-blue-600 text-white px-4 py-2 rounded-lg hover:bg-blue-700 transition-colors flex items-center gap-2"
            >
              <UserPlus className="w-4 h-4" />
              Manage Guests
            </button>
          </div>

          {/* Extra Charges Summary */}
          {totalExtraCharges > 0 && (
            <div className="mt-3 pt-3 border-t border-blue-200">
              <div className="flex items-center justify-between text-sm">
                <span className="text-gray-600">Extra person charges:</span>
                <span className="font-semibold text-green-600">{formatCurrency(totalExtraCharges)}</span>
              </div>
              <div className="flex items-center justify-between text-sm">
                <span className="text-gray-600">Updated total amount:</span>
                <span className="font-semibold text-blue-600">
                  {formatCurrency(booking.totalAmount + totalExtraCharges)}
                </span>
              </div>
            </div>
          )}
        </div>

        {/* Quick Actions */}
        <div className="grid grid-cols-2 gap-3">
          <button
            onClick={() => setIsEditModalOpen(true)}
            className="flex items-center gap-2 p-3 bg-white border border-gray-200 rounded-lg hover:bg-gray-50 hover:border-blue-200 transition-colors"
          >
            <UserPlus className="w-4 h-4 text-blue-600" />
            <span className="text-sm font-medium text-gray-700">Add Extra Person</span>
          </button>

          <button
            onClick={() => setIsEditModalOpen(true)}
            className="flex items-center gap-2 p-3 bg-white border border-gray-200 rounded-lg hover:bg-gray-50 hover:border-green-200 transition-colors"
          >
            <FileText className="w-4 h-4 text-green-600" />
            <span className="text-sm font-medium text-gray-700">Settlement</span>
          </button>
        </div>

        {/* Extra Persons List (if any) */}
        {hasExtraPersons && (
          <div className="bg-white rounded-lg border border-gray-200 p-4">
            <h5 className="font-medium text-gray-900 mb-3">Extra Persons</h5>
            <div className="space-y-2">
              {booking.extraPersons!.map((person, index) => {
                const personCharge = booking.extraPersonCharges?.find(c => c.personId === person.personId);
                return (
                  <div key={person.personId || index} className="flex items-center justify-between p-2 bg-gray-50 rounded">
                    <div>
                      <p className="text-sm font-medium text-gray-900">{person.name}</p>
                      <p className="text-xs text-gray-500">
                        {person.type === 'child' ? `Child${person.age ? ` (${person.age} years)` : ''}` : 'Adult'}
                      </p>
                    </div>
                    {personCharge && (
                      <div className="text-right">
                        <p className="text-sm font-medium text-green-600">{formatCurrency(personCharge.totalCharge)}</p>
                      </div>
                    )}
                  </div>
                );
              })}
            </div>
          </div>
        )}
      </div>

      {/* Booking Edit Modal */}
      <BookingEditModal
        isOpen={isEditModalOpen}
        onClose={() => setIsEditModalOpen(false)}
        booking={booking}
        onBookingUpdated={(updatedBooking) => {
          setIsEditModalOpen(false);
          if (onBookingUpdated) {
            onBookingUpdated(updatedBooking);
          }
        }}
      />
    </>
  );
}

// Hook to integrate with existing TapeChart
export function useTapeChartBookingEditing() {
  const [selectedBookingForEditing, setSelectedBookingForEditing] = useState<BookingData | null>(null);

  const openBookingEditor = (booking: BookingData) => {
    setSelectedBookingForEditing(booking);
  };

  const closeBookingEditor = () => {
    setSelectedBookingForEditing(null);
  };

  return {
    selectedBookingForEditing,
    openBookingEditor,
    closeBookingEditor
  };
}

// Enhanced booking card component for TapeChart
export function EnhancedBookingCard({
  booking,
  onClick,
  onEditClick
}: {
  booking: BookingData;
  onClick?: () => void;
  onEditClick?: () => void;
}) {
  const hasExtraPersons = booking.extraPersons && booking.extraPersons.length > 0;
  const canEdit = ['confirmed', 'checked_in', 'checked_out'].includes(booking.status);

  return (
    <div role="button" tabIndex={0}
      className="relative bg-white rounded-lg border border-gray-200 p-3 hover:shadow-lg transition-shadow cursor-pointer"
      onClick={onClick}
     onKeyDown={(e: React.KeyboardEvent) => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); onClick(e as any); } }}>
      {/* Main booking info */}
      <div className="flex justify-between items-start mb-2">
        <div>
          <p className="font-semibold text-gray-900">{booking.bookingNumber}</p>
          <p className="text-sm text-gray-600">
            {booking.guestDetails.adults + booking.guestDetails.children} guest{booking.guestDetails.adults + booking.guestDetails.children > 1 ? 's' : ''}
          </p>
        </div>
        <div className="text-right">
          <p className="text-sm font-medium text-green-600">{formatCurrency(booking.totalAmount)}</p>
          <span className={`inline-flex items-center px-2 py-1 rounded-full text-xs font-medium ${
            booking.status === 'confirmed' ? 'bg-blue-100 text-blue-800' :
            booking.status === 'checked_in' ? 'bg-green-100 text-green-800' :
            booking.status === 'checked_out' ? 'bg-gray-100 text-gray-800' :
            'bg-yellow-100 text-yellow-800'
          }`}>
            {booking.status.replace('_', ' ')}
          </span>
        </div>
      </div>

      {/* Extra persons indicator */}
      {hasExtraPersons && (
        <div className="mb-2">
          <div className="flex items-center gap-1 text-xs text-blue-600">
            <Users className="w-3 h-3" />
            <span>+{booking.extraPersons!.length} extra person{booking.extraPersons!.length > 1 ? 's' : ''}</span>
          </div>
        </div>
      )}

      {/* Edit button overlay */}
      {canEdit && onEditClick && (
        <button aria-label="Edit"
          onClick={(e) => {
            e.stopPropagation();
            onEditClick();
          }}
          className="absolute top-2 right-2 p-1 bg-blue-600 text-white rounded opacity-0 group-hover:opacity-100 hover:bg-blue-700 transition-all"
          title="Edit booking"
        >
          <UserPlus className="w-3 h-3" />
        </button>
      )}
    </div>
  );
}