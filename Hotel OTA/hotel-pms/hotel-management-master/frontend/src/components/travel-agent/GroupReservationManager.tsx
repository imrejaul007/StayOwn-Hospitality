import React, { useState } from 'react';
import {
  Users,
  Calendar,
  CheckCircle,
  Clock,
  AlertCircle,
  CreditCard,
  Mail,
  Phone,
  Edit,
  Trash2,
  Eye,
  FileText,
  Download,
  MapPin,
  Bed,
  DollarSign
} from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';
import { format } from 'date-fns';

interface RoomBooking {
  id: string;
  roomTypeId: string;
  roomTypeName: string;
  guestDetails: {
    primaryGuest: {
      name: string;
      email: string;
      phone: string;
    };
    additionalGuests: Array<{
      name: string;
      age: number;
    }>;
    totalGuests: number;
  };
  specialRequests?: string;
  addOns: Array<{
    name: string;
    price: number;
    quantity: number;
  }>;
  ratePerNight: number;
  specialRate?: number;
}

interface BookingDates {
  checkIn: Date;
  checkOut: Date;
  nights: number;
}

interface BulkPricing {
  subtotal: number;
  taxes: number;
  fees: number;
  discounts: number;
  totalAmount: number;
  commissionAmount: number;
  roomBreakdown: Array<{
    roomId: string;
    roomTotal: number;
    commission: number;
  }>;
}

interface GroupReservationManagerProps {
  roomBookings: RoomBooking[];
  bookingDates: BookingDates;
  bulkPricing: BulkPricing;
  hotelId: string;
}

interface ReservationStatus {
  roomId: string;
  status: 'confirmed' | 'pending' | 'failed' | 'cancelled';
  paymentStatus: 'paid' | 'pending' | 'failed' | 'refunded';
  confirmationNumber?: string;
  lastUpdated: Date;
}

const GroupReservationManager: React.FC<GroupReservationManagerProps> = ({
  roomBookings,
  bookingDates,
  bulkPricing,
  hotelId
}) => {
  const [reservationStatuses, setReservationStatuses] = useState<ReservationStatus[]>(
    roomBookings.map(room => ({
      roomId: room.id,
      status: 'pending',
      paymentStatus: 'pending',
      lastUpdated: new Date()
    }))
  );

  const [selectedRoom, setSelectedRoom] = useState<string | null>(null);
  const [showDetails, setShowDetails] = useState<Record<string, boolean>>({});

  const getStatusColor = (status: 'confirmed' | 'pending' | 'failed' | 'cancelled') => {
    switch (status) {
      case 'confirmed':
        return 'bg-green-100 text-green-800';
      case 'pending':
        return 'bg-yellow-100 text-yellow-800';
      case 'failed':
        return 'bg-red-100 text-red-800';
      case 'cancelled':
        return 'bg-gray-100 text-gray-800';
      default:
        return 'bg-gray-100 text-gray-800';
    }
  };

  const getPaymentStatusColor = (status: 'paid' | 'pending' | 'failed' | 'refunded') => {
    switch (status) {
      case 'paid':
        return 'bg-green-100 text-green-800';
      case 'pending':
        return 'bg-yellow-100 text-yellow-800';
      case 'failed':
        return 'bg-red-100 text-red-800';
      case 'refunded':
        return 'bg-blue-100 text-blue-800';
      default:
        return 'bg-gray-100 text-gray-800';
    }
  };

  const getStatusIcon = (status: 'confirmed' | 'pending' | 'failed' | 'cancelled') => {
    switch (status) {
      case 'confirmed':
        return <CheckCircle className="h-4 w-4" />;
      case 'pending':
        return <Clock className="h-4 w-4" />;
      case 'failed':
      case 'cancelled':
        return <AlertCircle className="h-4 w-4" />;
      default:
        return <Clock className="h-4 w-4" />;
    }
  };

  const toggleRoomDetails = (roomId: string) => {
    setShowDetails(prev => ({
      ...prev,
      [roomId]: !prev[roomId]
    }));
  };

  const calculateRoomTotal = (room: RoomBooking) => {
    const nightlyTotal = (room.specialRate || room.ratePerNight) * bookingDates.nights;
    const addOnsTotal = room.addOns.reduce((sum, addon) => sum + (addon.price * addon.quantity), 0);
    return nightlyTotal + addOnsTotal;
  };

  const getRoomCommission = (roomId: string) => {
    const breakdown = bulkPricing.roomBreakdown.find(r => r.roomId === roomId);
    return breakdown?.commission || 0;
  };

  const getOverallStatus = () => {
    const confirmedCount = reservationStatuses.filter(r => r.status === 'confirmed').length;
    const pendingCount = reservationStatuses.filter(r => r.status === 'pending').length;
    const failedCount = reservationStatuses.filter(r => r.status === 'failed').length;

    if (confirmedCount === roomBookings.length) return 'All Confirmed';
    if (failedCount > 0) return 'Some Failed';
    if (pendingCount > 0) return 'Pending Confirmation';
    return 'Processing';
  };

  const getOverallPaymentStatus = () => {
    const paidCount = reservationStatuses.filter(r => r.paymentStatus === 'paid').length;
    const pendingCount = reservationStatuses.filter(r => r.paymentStatus === 'pending').length;
    const failedCount = reservationStatuses.filter(r => r.paymentStatus === 'failed').length;

    if (paidCount === roomBookings.length) return 'All Paid';
    if (failedCount > 0) return 'Payment Issues';
    if (pendingCount > 0) return 'Payment Pending';
    return 'Processing Payment';
  };

  return (
    <div className="bg-white rounded-lg shadow-sm overflow-hidden">
      {/* Header */}
      <div className="bg-gradient-to-r from-blue-600 to-indigo-600 text-white p-6">
        <div className="flex items-center justify-between">
          <div>
            <h2 className="text-xl font-bold">Group Reservation Manager</h2>
            <p className="text-blue-100 mt-1">
              Managing {roomBookings.length} rooms for {format(bookingDates.checkIn, 'MMM dd')} - {format(bookingDates.checkOut, 'MMM dd, yyyy')}
            </p>
          </div>
          <div className="text-right">
            <div className="text-2xl font-bold">${bulkPricing.totalAmount.toLocaleString()}</div>
            <div className="text-blue-100 text-sm">Total Amount</div>
          </div>
        </div>

        {/* Overall Status */}
        <div className="mt-4 grid grid-cols-1 md:grid-cols-2 gap-4">
          <div className="bg-white/10 rounded-lg p-3">
            <div className="flex items-center gap-2">
              <CheckCircle className="h-5 w-5" />
              <span className="font-medium">Reservation Status</span>
            </div>
            <div className="text-lg font-bold mt-1">{getOverallStatus()}</div>
          </div>
          <div className="bg-white/10 rounded-lg p-3">
            <div className="flex items-center gap-2">
              <CreditCard className="h-5 w-5" />
              <span className="font-medium">Payment Status</span>
            </div>
            <div className="text-lg font-bold mt-1">{getOverallPaymentStatus()}</div>
          </div>
        </div>
      </div>

      {/* Room List */}
      <div className="p-6">
        <div className="space-y-4">
          {roomBookings.map((room, index) => {
            const status = reservationStatuses.find(r => r.roomId === room.id);
            const roomTotal = calculateRoomTotal(room);
            const commission = getRoomCommission(room.id);
            const isExpanded = showDetails[room.id];

            return (
              <motion.div
                key={room.id}
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: index * 0.1 }}
                className="border border-gray-200 rounded-lg overflow-hidden"
              >
                {/* Room Header */}
                <div role="button" tabIndex={0}
                  className="p-4 bg-gray-50 cursor-pointer hover:bg-gray-100 transition-colors"
                  onClick={() => toggleRoomDetails(room.id)}
                 onKeyDown={(e: React.KeyboardEvent) => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); const clickHandler = () => toggleRoomDetails(room.id); if (typeof clickHandler === 'function') { clickHandler(e as any); } } }}>
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-4">
                      <div className="flex items-center gap-2">
                        <Bed className="h-5 w-5 text-gray-600" />
                        <span className="font-semibold text-gray-900">
                          Room {index + 1}
                        </span>
                      </div>
                      <div>
                        <div className="font-medium text-gray-900">
                          {room.roomTypeName || 'Room Type'}
                        </div>
                        <div className="text-sm text-gray-600">
                          {room.guestDetails.primaryGuest.name}
                        </div>
                      </div>
                    </div>
                    <div className="flex items-center gap-4">
                      <div className="text-right">
                        <div className="font-semibold text-gray-900">
                          ${roomTotal.toLocaleString()}
                        </div>
                        <div className="text-sm text-green-600">
                          Commission: ${commission.toLocaleString()}
                        </div>
                      </div>
                      <div className="flex flex-col gap-1">
                        <span className={`inline-flex items-center gap-1 px-2 py-1 rounded-full text-xs font-medium ${getStatusColor(status?.status || 'pending')}`}>
                          {getStatusIcon(status?.status || 'pending')}
                          {status?.status || 'pending'}
                        </span>
                        <span className={`inline-flex items-center px-2 py-1 rounded-full text-xs font-medium ${getPaymentStatusColor(status?.paymentStatus || 'pending')}`}>
                          <CreditCard className="h-3 w-3 mr-1" />
                          {status?.paymentStatus || 'pending'}
                        </span>
                      </div>
                    </div>
                  </div>
                </div>

                {/* Room Details */}
                <AnimatePresence>
                  {isExpanded && (
                    <motion.div
                      initial={{ height: 0 }}
                      animate={{ height: 'auto' }}
                      exit={{ height: 0 }}
                      className="overflow-hidden"
                    >
                      <div className="p-4 border-t border-gray-200 bg-white">
                        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                          {/* Guest Information */}
                          <div>
                            <h4 className="font-medium text-gray-900 mb-3 flex items-center gap-2">
                              <Users className="h-4 w-4" />
                              Guest Information
                            </h4>
                            <div className="space-y-2 text-sm">
                              <div className="flex items-center gap-2">
                                <Mail className="h-4 w-4 text-gray-400" />
                                <span>{room.guestDetails.primaryGuest.email}</span>
                              </div>
                              <div className="flex items-center gap-2">
                                <Phone className="h-4 w-4 text-gray-400" />
                                <span>{room.guestDetails.primaryGuest.phone}</span>
                              </div>
                              <div className="flex items-center gap-2">
                                <Users className="h-4 w-4 text-gray-400" />
                                <span>{room.guestDetails.totalGuests} guest(s)</span>
                              </div>
                            </div>

                            {room.guestDetails.additionalGuests.length > 0 && (
                              <div className="mt-3">
                                <div className="text-sm font-medium text-gray-700 mb-2">
                                  Additional Guests:
                                </div>
                                <div className="space-y-1">
                                  {room.guestDetails.additionalGuests.map((guest, guestIndex) => (
                                    <div key={guestIndex} className="text-sm text-gray-600">
                                      {guest.name} ({guest.age} years old)
                                    </div>
                                  ))}
                                </div>
                              </div>
                            )}
                          </div>

                          {/* Booking Details */}
                          <div>
                            <h4 className="font-medium text-gray-900 mb-3 flex items-center gap-2">
                              <FileText className="h-4 w-4" />
                              Booking Details
                            </h4>
                            <div className="space-y-2 text-sm">
                              <div className="flex justify-between">
                                <span className="text-gray-600">Rate per night:</span>
                                <span>${(room.specialRate || room.ratePerNight).toLocaleString()}</span>
                              </div>
                              <div className="flex justify-between">
                                <span className="text-gray-600">Nights:</span>
                                <span>{bookingDates.nights}</span>
                              </div>
                              <div className="flex justify-between">
                                <span className="text-gray-600">Room subtotal:</span>
                                <span>${((room.specialRate || room.ratePerNight) * bookingDates.nights).toLocaleString()}</span>
                              </div>
                              {room.addOns.length > 0 && (
                                <>
                                  <div className="border-t pt-2 mt-2">
                                    <div className="font-medium text-gray-700 mb-1">Add-ons:</div>
                                    {room.addOns.map((addon, addonIndex) => (
                                      <div key={addonIndex} className="flex justify-between text-xs">
                                        <span>{addon.name} x{addon.quantity}</span>
                                        <span>${(addon.price * addon.quantity).toLocaleString()}</span>
                                      </div>
                                    ))}
                                  </div>
                                </>
                              )}
                              <div className="border-t pt-2 flex justify-between font-medium">
                                <span>Room Total:</span>
                                <span>${roomTotal.toLocaleString()}</span>
                              </div>
                              <div className="flex justify-between text-green-600 font-medium">
                                <span>Your Commission:</span>
                                <span>${commission.toLocaleString()}</span>
                              </div>
                            </div>
                          </div>
                        </div>

                        {/* Special Requests */}
                        {room.specialRequests && (
                          <div className="mt-4 pt-4 border-t border-gray-200">
                            <h4 className="font-medium text-gray-900 mb-2">Special Requests</h4>
                            <p className="text-sm text-gray-600 bg-gray-50 p-3 rounded-lg">
                              {room.specialRequests}
                            </p>
                          </div>
                        )}

                        {/* Confirmation Details */}
                        {status?.confirmationNumber && (
                          <div className="mt-4 pt-4 border-t border-gray-200">
                            <div className="bg-green-50 border border-green-200 rounded-lg p-3">
                              <div className="flex items-center gap-2 mb-2">
                                <CheckCircle className="h-4 w-4 text-green-600" />
                                <span className="font-medium text-green-800">Confirmation Details</span>
                              </div>
                              <div className="text-sm text-green-700">
                                Confirmation Number: <strong>{status.confirmationNumber}</strong>
                              </div>
                              <div className="text-sm text-green-600">
                                Last updated: {format(status.lastUpdated, 'MMM dd, yyyy HH:mm')}
                              </div>
                            </div>
                          </div>
                        )}

                        {/* Action Buttons */}
                        <div className="mt-4 pt-4 border-t border-gray-200 flex gap-2">
                          <button className="flex items-center gap-1 px-3 py-1 text-sm text-indigo-600 hover:text-indigo-800 transition-colors">
                            <Edit className="h-4 w-4" />
                            Modify
                          </button>
                          <button className="flex items-center gap-1 px-3 py-1 text-sm text-gray-600 hover:text-gray-800 transition-colors">
                            <Eye className="h-4 w-4" />
                            View Details
                          </button>
                          <button className="flex items-center gap-1 px-3 py-1 text-sm text-gray-600 hover:text-gray-800 transition-colors">
                            <Download className="h-4 w-4" />
                            Download
                          </button>
                          <button className="flex items-center gap-1 px-3 py-1 text-sm text-red-600 hover:text-red-800 transition-colors ml-auto">
                            <Trash2 className="h-4 w-4" />
                            Cancel
                          </button>
                        </div>
                      </div>
                    </motion.div>
                  )}
                </AnimatePresence>
              </motion.div>
            );
          })}
        </div>

        {/* Summary */}
        <div className="mt-6 pt-6 border-t border-gray-200">
          <div className="bg-gray-50 rounded-lg p-4">
            <h3 className="font-semibold text-gray-900 mb-3">Group Booking Summary</h3>
            <div className="grid grid-cols-1 md:grid-cols-4 gap-4 text-center">
              <div>
                <div className="text-2xl font-bold text-gray-900">{roomBookings.length}</div>
                <div className="text-sm text-gray-600">Total Rooms</div>
              </div>
              <div>
                <div className="text-2xl font-bold text-gray-900">
                  {roomBookings.reduce((sum, room) => sum + room.guestDetails.totalGuests, 0)}
                </div>
                <div className="text-sm text-gray-600">Total Guests</div>
              </div>
              <div>
                <div className="text-2xl font-bold text-indigo-600">
                  ${bulkPricing.totalAmount.toLocaleString()}
                </div>
                <div className="text-sm text-gray-600">Total Revenue</div>
              </div>
              <div>
                <div className="text-2xl font-bold text-green-600">
                  ${bulkPricing.commissionAmount.toLocaleString()}
                </div>
                <div className="text-sm text-gray-600">Your Commission</div>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};

export default GroupReservationManager;