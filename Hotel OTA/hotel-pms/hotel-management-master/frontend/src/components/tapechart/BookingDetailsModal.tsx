import React, { useState, useEffect } from 'react';
import { formatCurrency } from '@/utils/currencyUtils';
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Badge } from '@/components/ui/badge';
import { Separator } from '@/components/ui/separator';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { toast } from '@/utils/toast';
import {
  Calendar, Clock, User, Phone, Mail, CreditCard, MapPin, Building2,
  Edit, Save, X, Trash2, UserCheck, UserX, Coffee, Wifi, Car,
  Star, Crown, Plane, Users, AlertCircle, CheckCircle, Calendar as CalendarIcon,
  IndianRupee, FileText, MessageSquare, History, Settings
} from 'lucide-react';
import { format, parseISO } from 'date-fns';
import { api } from '@/services/api';
import { withErrorBoundary } from '../ErrorBoundary';

interface BookingDetailsModalProps {
  isOpen: boolean;
  onClose: () => void;
  bookingId: string | null;
  roomNumber?: string;
  onBookingUpdate?: () => void;
}

interface BookingDetails {
  _id: string;
  bookingNumber: string;
  status: string;
  checkIn: string;
  checkOut: string;
  nights: number;
  totalAmount: number;
  currency: string;
  paymentStatus: string;
  paymentDetails: {
    totalPaid: number;
    remainingAmount: number;
    paymentMethods: unknown[];
  };
  userId: {
    _id: string;
    name: string;
    email: string;
    phone: string;
  };
  guestDetails: {
    adults: number;
    children: number;
    specialRequests?: string;
  };
  rooms: Array<{
    roomId: {
      _id: string;
      roomNumber: string;
      type: string;
      baseRate?: number;
      currentRate?: number;
      id: string;
    };
    rate: number;
    specialRequests?: string[];
    _id: string;
    id: string;
  }>;
  corporateBooking?: {
    corporateCompanyId: string;
    department: string;
    costCenter: string;
    employeeId: string;
    paymentMethod: string;
  };
  travelAgentDetails?: {
    agentId: string;
    commission: number;
    specialRatesApplied: boolean;
  };
  source: string;
  bookingSource: string;
  cancellationPolicy: string;
  extras: unknown[];
  statusHistory: Array<{
    status: string;
    timestamp: string;
    changedBy: string;
    reason?: string;
  }>;
  modifications: unknown[];
  createdAt: string;
  updatedAt: string;
}

const BookingDetailsModal: React.FC<BookingDetailsModalProps> = ({
  isOpen,
  onClose,
  bookingId,
  roomNumber,
  onBookingUpdate
}) => {
  const [booking, setBooking] = useState<BookingDetails | null>(null);
  const [loading, setLoading] = useState(false);
  const [saving, setSaving] = useState(false);
  const [isEditing, setIsEditing] = useState(false);
  const [editedBooking, setEditedBooking] = useState<Partial<BookingDetails>>({});

  useEffect(() => {
    if (isOpen && bookingId) {
      fetchBookingDetails();
    }
  }, [isOpen, bookingId]);

  const fetchBookingDetails = async () => {
    if (!bookingId) return;

    try {
      setLoading(true);
      const response = await api.get(`/bookings/${bookingId}`);

      let bookingData;
      if (response.data.status === 'success') {
        bookingData = response.data.data;
      } else {
        bookingData = response.data.data || response.data;
      }


      // Extract the actual booking from the nested structure
      const actualBooking = bookingData?.booking || bookingData;


      setBooking(actualBooking);
      setEditedBooking(actualBooking);
    } catch (error: unknown) {
      toast.error(error.response?.data?.message || 'Failed to fetch booking details');
    } finally {
      setLoading(false);
    }
  };

  const handleSave = async () => {
    if (!booking || !editedBooking) return;

    try {
      setSaving(true);

      // Only send the fields that are actually editable to avoid validation errors
      const updateData = {
        guestDetails: {
          adults: editedBooking.guestDetails?.adults || booking.guestDetails?.adults || 1,
          children: editedBooking.guestDetails?.children || booking.guestDetails?.children || 0,
          specialRequests: editedBooking.guestDetails?.specialRequests || booking.guestDetails?.specialRequests || ''
        },
        status: editedBooking.status || booking.status
      };


      const response = await api.patch(`/bookings/${booking._id}`, updateData);

      if (response.data.status === 'success') {
        // Update the booking with the response data
        const updatedBooking = response.data.data.booking || response.data.data;
        setBooking(updatedBooking);
        setEditedBooking(updatedBooking);
        setIsEditing(false);
        toast.success('Booking updated successfully');
        onBookingUpdate?.();
      } else {
        toast.error('Failed to update booking');
      }
    } catch (error: unknown) {
      const errorMessage = error.response?.data?.error?.message ||
                          error.response?.data?.message ||
                          'Failed to update booking';
      toast.error(errorMessage);
    } finally {
      setSaving(false);
    }
  };

  const handleCancel = () => {
    setEditedBooking(booking || {});
    setIsEditing(false);
  };

  const handleStatusChange = async (newStatus: string) => {
    if (!booking) return;

    try {
      setSaving(true);
      let endpoint = `/bookings/${booking._id}`;
      let requestData = {};

      if (newStatus === 'cancelled') {
        endpoint = `/bookings/${booking._id}/cancel`;
        requestData = { reason: 'Cancelled by admin' };
      } else if (newStatus === 'checked_in') {
        endpoint = `/bookings/${booking._id}/check-in`;
        requestData = { checkInTime: new Date().toISOString() };
      } else if (newStatus === 'checked_out') {
        endpoint = `/bookings/${booking._id}/check-out`;
        requestData = { checkOutTime: new Date().toISOString() };
      } else {
        // For other status changes, just update the status
        requestData = { status: newStatus };
      }


      const response = await api.patch(endpoint, requestData);

      if (response.data.status === 'success' || response.data.success !== false) {
        await fetchBookingDetails(); // Refresh data
        toast.success(`Booking ${newStatus.replace('_', ' ')} successfully`);
        onBookingUpdate?.();
      } else {
        toast.error('Failed to change booking status');
      }
    } catch (error: unknown) {
      const errorMessage = error.response?.data?.error?.message ||
                          error.response?.data?.message ||
                          'Failed to change booking status';
      toast.error(errorMessage);
    } finally {
      setSaving(false);
    }
  };

  const getStatusBadge = (status: string) => {
    // Handle undefined or null status
    if (!status) {
      status = 'pending';
    }

    const statusConfig = {
      'confirmed': { color: 'bg-blue-100 text-blue-800', icon: CheckCircle },
      'checked_in': { color: 'bg-green-100 text-green-800', icon: UserCheck },
      'checked_out': { color: 'bg-gray-100 text-gray-800', icon: UserX },
      'cancelled': { color: 'bg-red-100 text-red-800', icon: X },
      'pending': { color: 'bg-yellow-100 text-yellow-800', icon: Clock },
      'no_show': { color: 'bg-red-100 text-red-800', icon: AlertCircle }
    };

    const config = statusConfig[status as keyof typeof statusConfig] || statusConfig.pending;
    const Icon = config.icon;

    return (
      <Badge className={`${config.color} flex items-center gap-1`}>
        <Icon className="w-3 h-3" />
        {status.replace('_', ' ').toUpperCase()}
      </Badge>
    );
  };

  const getVIPBadge = (booking: BookingDetails | null) => {
    if (!booking) return null;

    if (booking.corporateBooking) {
      return (
        <Badge className="bg-blue-100 text-blue-800 flex items-center gap-1">
          <Building2 className="w-3 h-3" />
          CORPORATE
        </Badge>
      );
    }
    if (booking.travelAgentDetails) {
      return (
        <Badge className="bg-indigo-100 text-indigo-800 flex items-center gap-1">
          <Plane className="w-3 h-3" />
          TRAVEL AGENT
        </Badge>
      );
    }
    return null;
  };

  if (!booking && loading) {
    return (
      <Dialog open={isOpen} onOpenChange={onClose}>
        <DialogContent className="max-w-4xl max-h-[90vh] overflow-y-auto">
          <div className="flex items-center justify-center p-8">
            <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600"></div>
            <span className="ml-2">Loading booking details...</span>
          </div>
        </DialogContent>
      </Dialog>
    );
  }

  if (!booking) {
    return (
      <Dialog open={isOpen} onOpenChange={onClose}>
        <DialogContent className="max-w-4xl max-h-[90vh] overflow-y-auto">
          <div className="flex items-center justify-center p-8">
            <AlertCircle className="w-8 h-8 text-red-500 mr-2" />
            <span>Failed to load booking details</span>
          </div>
        </DialogContent>
      </Dialog>
    );
  }

  return (
    <Dialog open={isOpen} onOpenChange={onClose}>
      <DialogContent className="max-w-5xl w-full max-h-[90vh] overflow-hidden flex flex-col bg-white border-0 shadow-xl rounded-2xl p-0">
        {/* Modern Header with Gradient */}
        <div className="relative bg-gradient-to-r from-blue-600 via-blue-700 to-indigo-700 text-white p-6 rounded-t-2xl">
          <div className="absolute inset-0 bg-black/5 rounded-t-2xl"></div>
          <div className="relative z-10">
            <div className="flex items-start justify-between">
              <div className="space-y-2">
                <div className="flex items-center gap-3">
                  <div className="p-2 bg-white/20 rounded-lg backdrop-blur-sm">
                    <FileText className="w-5 h-5" />
                  </div>
                  <div>
                    <h1 className="text-2xl font-bold tracking-tight">
                      {booking.bookingNumber || 'Unknown Booking'}
                    </h1>
                    <div className="flex items-center gap-3 mt-1">
                      {getStatusBadge(booking.status)}
                      {getVIPBadge(booking)}
                    </div>
                  </div>
                </div>
                <div className="text-blue-100 text-sm flex items-center gap-4 ml-14">
                  <span className="flex items-center gap-1">
                    <MapPin className="w-4 h-4" />
                    {roomNumber ? `Room ${roomNumber}` : 'No room assigned'}
                  </span>
                  <span className="flex items-center gap-1">
                    <User className="w-4 h-4" />
                    {booking.userId?.name || 'Unknown Guest'}
                  </span>
                  <span className="flex items-center gap-1">
                    <Calendar className="w-4 h-4" />
                    {booking.checkIn && booking.checkOut ?
                      `${format(parseISO(booking.checkIn), 'MMM dd')} - ${format(parseISO(booking.checkOut), 'MMM dd, yyyy')}` :
                      'Dates not available'
                    }
                  </span>
                  <span className="flex items-center gap-1">
                    <IndianRupee className="w-4 h-4" />
                    {formatCurrency(booking.totalAmount || 0)}
                  </span>
                </div>
              </div>

              {/* Action Buttons */}
              <div className="flex items-center gap-2">
                {/* Close Button - Always Visible */}
                <Button
                  variant="secondary"
                  size="sm"
                  onClick={onClose}
                  className="bg-white/20 hover:bg-white/30 text-white border-white/30 backdrop-blur-sm"
                >
                  <X className="w-4 h-4" />
                </Button>

                {!isEditing ? (
                  <Button
                    variant="secondary"
                    size="sm"
                    onClick={() => setIsEditing(true)}
                    className="bg-white/20 hover:bg-white/30 text-white border-white/30 backdrop-blur-sm"
                  >
                    <Edit className="w-4 h-4 mr-2" />
                    Edit Booking
                  </Button>
                ) : (
                  <div className="flex items-center gap-2">
                    <Button
                      variant="secondary"
                      size="sm"
                      onClick={handleCancel}
                      disabled={saving}
                      className="bg-white/20 hover:bg-white/30 text-white border-white/30"
                    >
                      <X className="w-4 h-4 mr-2" />
                      Cancel
                    </Button>
                    <Button
                      size="sm"
                      onClick={handleSave}
                      disabled={saving}
                      className="bg-green-600 hover:bg-green-700 text-white border-0"
                    >
                      <Save className="w-4 h-4 mr-2" />
                      {saving ? 'Saving...' : 'Save Changes'}
                    </Button>
                  </div>
                )}
              </div>
            </div>
          </div>
        </div>

        <div className="px-6 pb-6 flex-1 overflow-hidden">
        <Tabs defaultValue="details" className="w-full flex-1 overflow-hidden">
          <TabsList className="grid w-full grid-cols-4 h-14 p-1 bg-white border border-gray-200 rounded-lg shadow-sm mb-6">
            <TabsTrigger
              value="details"
              className="flex items-center gap-2 h-12 data-[state=active]:bg-blue-600 data-[state=active]:text-white data-[state=active]:shadow-lg text-gray-600 hover:text-gray-800 font-medium transition-all duration-300 rounded-md"
            >
              <Calendar className="w-4 h-4" />
              Details
            </TabsTrigger>
            <TabsTrigger
              value="guest"
              className="flex items-center gap-2 h-12 data-[state=active]:bg-blue-600 data-[state=active]:text-white data-[state=active]:shadow-lg text-gray-600 hover:text-gray-800 font-medium transition-all duration-300 rounded-md"
            >
              <User className="w-4 h-4" />
              Guest Info
            </TabsTrigger>
            <TabsTrigger
              value="payment"
              className="flex items-center gap-2 h-12 data-[state=active]:bg-blue-600 data-[state=active]:text-white data-[state=active]:shadow-lg text-gray-600 hover:text-gray-800 font-medium transition-all duration-300 rounded-md"
            >
              <CreditCard className="w-4 h-4" />
              Payment
            </TabsTrigger>
            <TabsTrigger
              value="history"
              className="flex items-center gap-2 h-12 data-[state=active]:bg-blue-600 data-[state=active]:text-white data-[state=active]:shadow-lg text-gray-600 hover:text-gray-800 font-medium transition-all duration-300 rounded-md"
            >
              <History className="w-4 h-4" />
              History
            </TabsTrigger>
          </TabsList>

          <TabsContent value="details" className="space-y-6 mt-0 overflow-y-auto max-h-[60vh]">
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              {/* Booking Information */}
              <Card className="border border-gray-200 bg-white hover:shadow-lg hover:border-blue-200 transition-all duration-300 rounded-xl">
                <CardHeader className="pb-4 border-b border-gray-100">
                  <CardTitle className="flex items-center gap-3 text-lg font-semibold text-gray-900">
                    <div className="p-2.5 bg-blue-50 rounded-xl border border-blue-100">
                      <Calendar className="w-5 h-5 text-blue-600" />
                    </div>
                    Booking Information
                  </CardTitle>
                </CardHeader>
                <CardContent className="space-y-3 pt-4">
                  <div className="flex justify-between items-center py-1">
                    <span className="text-sm font-medium text-gray-600">Booking Number:</span>
                    <span className="font-mono text-sm font-semibold">{booking.bookingNumber}</span>
                  </div>
                  <div className="flex justify-between items-center py-1">
                    <span className="text-sm font-medium text-gray-600">Status:</span>
                    {isEditing ? (
                      <Select
                        value={editedBooking.status || booking.status}
                        onValueChange={(value) => setEditedBooking({ ...editedBooking, status: value })}
                      >
                        <SelectTrigger className="w-32 h-8">
                          <SelectValue />
                        </SelectTrigger>
                        <SelectContent>
                          <SelectItem value="pending">Pending</SelectItem>
                          <SelectItem value="confirmed">Confirmed</SelectItem>
                          <SelectItem value="checked_in">Checked In</SelectItem>
                          <SelectItem value="checked_out">Checked Out</SelectItem>
                          <SelectItem value="cancelled">Cancelled</SelectItem>
                          <SelectItem value="no_show">No Show</SelectItem>
                        </SelectContent>
                      </Select>
                    ) : (
                      getStatusBadge(booking.status)
                    )}
                  </div>
                  <div className="flex justify-between items-center py-1">
                    <span className="text-sm font-medium text-gray-600">Check-in:</span>
                    <span className="text-sm font-semibold">
                      {booking.checkIn ? format(parseISO(booking.checkIn), 'MMM dd, yyyy') : 'Not set'}
                    </span>
                  </div>
                  <div className="flex justify-between items-center py-1">
                    <span className="text-sm font-medium text-gray-600">Check-out:</span>
                    <span className="text-sm font-semibold">
                      {booking.checkOut ? format(parseISO(booking.checkOut), 'MMM dd, yyyy') : 'Not set'}
                    </span>
                  </div>
                  <div className="flex justify-between items-center py-1">
                    <span className="text-sm font-medium text-gray-600">Nights:</span>
                    <span className="text-sm font-semibold">{booking.nights || 0}</span>
                  </div>
                  <div className="flex justify-between items-center py-1">
                    <span className="text-sm font-medium text-gray-600">Source:</span>
                    <Badge variant="outline" className="bg-blue-50 text-blue-700 border-blue-200">{booking.bookingSource}</Badge>
                  </div>
                </CardContent>
              </Card>

              {/* Room Information */}
              <Card className="border border-gray-200 bg-white hover:shadow-lg hover:border-green-200 transition-all duration-300 rounded-xl">
                <CardHeader className="pb-4 border-b border-gray-100">
                  <CardTitle className="flex items-center gap-3 text-lg font-semibold text-gray-900">
                    <div className="p-2.5 bg-green-50 rounded-xl border border-green-100">
                      <MapPin className="w-5 h-5 text-green-600" />
                    </div>
                    Room Information
                  </CardTitle>
                </CardHeader>
                <CardContent className="space-y-3 pt-4">
                  {booking.rooms && booking.rooms.length > 0 ? booking.rooms.map((room, index) => (
                    <div key={room.roomId} className="p-3 border rounded-lg bg-gradient-to-br from-white to-gray-50/50 hover:shadow-sm transition-all duration-200">
                      <div className="flex justify-between items-center mb-2">
                        <div className="flex items-center gap-2">
                          <div className="p-1.5 bg-green-100 rounded-lg">
                            <MapPin className="w-4 h-4 text-green-600" />
                          </div>
                          <span className="font-semibold text-gray-800">Room {room.roomId?.roomNumber || 'Unknown'}</span>
                        </div>
                        <Badge variant="outline" className="bg-green-50 text-green-700 border-green-200">{room.roomId?.type || 'Unknown'}</Badge>
                      </div>
                      <div className="space-y-2">
                        <div className="flex items-center justify-between">
                          <span className="text-sm text-gray-600">Current Rate:</span>
                          <span className="font-semibold text-green-700">{formatCurrency(room.rate || 0)}</span>
                        </div>
                        {room.roomId?.baseRate && (
                          <div className="flex items-center justify-between">
                            <span className="text-xs text-gray-500">Base Rate:</span>
                            <span className="text-xs text-gray-500">{formatCurrency(room.roomId.baseRate)}</span>
                          </div>
                        )}
                      </div>
                      {room.specialRequests && room.specialRequests.length > 0 && (
                        <div className="mt-3 p-2 bg-blue-50 rounded-lg">
                          <span className="text-xs font-medium text-blue-700">Special Requests:</span>
                          <div className="flex flex-wrap gap-1 mt-1">
                            {room.specialRequests.map((req, idx) => (
                              <Badge key={idx} variant="secondary" className="text-xs bg-blue-100 text-blue-700">{req}</Badge>
                            ))}
                          </div>
                        </div>
                      )}
                    </div>
                  )) : (
                    <div className="p-3 text-center text-gray-500">
                      No room information available
                    </div>
                  )}
                </CardContent>
              </Card>
            </div>

            {/* Guest Details */}
            <Card className="border border-gray-200 bg-white hover:shadow-lg hover:border-purple-200 transition-all duration-300 rounded-xl">
              <CardHeader className="pb-4 border-b border-gray-100">
                <CardTitle className="flex items-center gap-3 text-lg font-semibold text-gray-900">
                  <div className="p-2.5 bg-purple-50 rounded-xl border border-purple-100">
                    <Users className="w-5 h-5 text-purple-600" />
                  </div>
                  Guest Details
                </CardTitle>
              </CardHeader>
              <CardContent className="pt-4">
                <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                  <div className="space-y-2">
                    <Label className="text-sm font-medium text-gray-600">Adults</Label>
                    {isEditing ? (
                      <Input
                        type="number"
                        value={editedBooking.guestDetails?.adults || booking.guestDetails.adults}
                        onChange={(e) => setEditedBooking({
                          ...editedBooking,
                          guestDetails: {
                            ...editedBooking.guestDetails,
                            adults: parseInt(e.target.value) || 0
                          }
                        })}
                        className="h-10"
                      />
                    ) : (
                      <p className="text-lg font-semibold text-gray-800">{booking.guestDetails.adults}</p>
                    )}
                  </div>
                  <div className="space-y-2">
                    <Label className="text-sm font-medium text-gray-600">Children</Label>
                    {isEditing ? (
                      <Input
                        type="number"
                        value={editedBooking.guestDetails?.children || booking.guestDetails.children}
                        onChange={(e) => setEditedBooking({
                          ...editedBooking,
                          guestDetails: {
                            ...editedBooking.guestDetails,
                            children: parseInt(e.target.value) || 0
                          }
                        })}
                        className="h-10"
                      />
                    ) : (
                      <p className="text-lg font-semibold text-gray-800">{booking.guestDetails.children}</p>
                    )}
                  </div>
                  <div className="space-y-2">
                    <Label className="text-sm font-medium text-gray-600">Total Guests</Label>
                    <p className="text-lg font-semibold text-purple-700">{booking.guestDetails.adults + booking.guestDetails.children}</p>
                  </div>
                </div>

                {booking.guestDetails.specialRequests && (
                  <div className="mt-4 p-3 bg-purple-50 rounded-lg border border-purple-100">
                    <Label className="text-sm font-medium text-purple-700">Special Requests</Label>
                    {isEditing ? (
                      <Textarea
                        value={editedBooking.guestDetails?.specialRequests || booking.guestDetails.specialRequests}
                        onChange={(e) => setEditedBooking({
                          ...editedBooking,
                          guestDetails: {
                            ...editedBooking.guestDetails,
                            specialRequests: e.target.value
                          }
                        })}
                        className="mt-2"
                        rows={3}
                      />
                    ) : (
                      <p className="mt-2 text-sm text-gray-700 leading-relaxed">{booking.guestDetails.specialRequests}</p>
                    )}
                  </div>
                )}
              </CardContent>
            </Card>

            {/* Quick Actions */}
            {!isEditing && (
              <Card className="border border-gray-200 bg-white hover:shadow-lg hover:border-orange-200 transition-all duration-300 rounded-xl">
                <CardHeader className="pb-4 border-b border-gray-100">
                  <CardTitle className="flex items-center gap-3 text-lg font-semibold text-gray-900">
                    <div className="p-2.5 bg-orange-50 rounded-xl border border-orange-100">
                      <Settings className="w-5 h-5 text-orange-600" />
                    </div>
                    Quick Actions
                  </CardTitle>
                </CardHeader>
                <CardContent className="pt-4">
                  <div className="space-y-3">
                    <div className="flex flex-wrap gap-3">
                      {/* Check In Actions */}
                      {(booking.status?.toLowerCase() === 'confirmed' || booking.status === 'confirmed') && (
                        <Button
                          variant="outline"
                          size="sm"
                          onClick={() => handleStatusChange('checked_in')}
                          disabled={saving}
                          className="flex items-center gap-2 bg-green-50 hover:bg-green-100 border-green-200 text-green-700 hover:text-green-800 transition-all duration-200"
                        >
                          <UserCheck className="w-4 h-4" />
                          Check In Guest
                        </Button>
                      )}

                      {/* Check Out Actions */}
                      {(booking.status?.toLowerCase() === 'checked_in' || booking.status === 'checked_in') && (
                        <Button
                          variant="outline"
                          size="sm"
                          onClick={() => handleStatusChange('checked_out')}
                          disabled={saving}
                          className="flex items-center gap-2 bg-blue-50 hover:bg-blue-100 border-blue-200 text-blue-700 hover:text-blue-800 transition-all duration-200"
                        >
                          <UserX className="w-4 h-4" />
                          Check Out Guest
                        </Button>
                      )}

                      {/* Cancel Actions */}
                      {(['confirmed', 'pending'].includes(booking.status?.toLowerCase()) || ['confirmed', 'pending'].includes(booking.status)) && (
                        <Button
                          variant="outline"
                          size="sm"
                          onClick={() => handleStatusChange('cancelled')}
                          disabled={saving}
                          className="flex items-center gap-2 bg-red-50 hover:bg-red-100 border-red-200 text-red-700 hover:text-red-800 transition-all duration-200"
                        >
                          <X className="w-4 h-4" />
                          Cancel Booking
                        </Button>
                      )}

                      {/* Reactivate Booking (for checked out bookings) */}
                      {(booking.status?.toLowerCase() === 'checked_out' || booking.status === 'checked_out') && (
                        <Button
                          variant="outline"
                          size="sm"
                          onClick={() => handleStatusChange('confirmed')}
                          disabled={saving}
                          className="flex items-center gap-2 bg-yellow-50 hover:bg-yellow-100 border-yellow-200 text-yellow-700 hover:text-yellow-800 transition-all duration-200"
                        >
                          <Calendar className="w-4 h-4" />
                          Reactivate Booking
                        </Button>
                      )}

                      {/* Generic Edit Status */}
                      <Button
                        variant="outline"
                        size="sm"
                        onClick={() => setIsEditing(true)}
                        disabled={saving}
                        className="flex items-center gap-2 bg-indigo-50 hover:bg-indigo-100 border-indigo-200 text-indigo-700 hover:text-indigo-800 transition-all duration-200"
                      >
                        <Edit className="w-4 h-4" />
                        Edit Details
                      </Button>

                      {/* View Guest Profile */}
                      <Button
                        variant="outline"
                        size="sm"
                        disabled={saving}
                        className="flex items-center gap-2 bg-purple-50 hover:bg-purple-100 border-purple-200 text-purple-700 hover:text-purple-800 transition-all duration-200"
                      >
                        <User className="w-4 h-4" />
                        View Guest Profile
                      </Button>
                    </div>
                  </div>
                </CardContent>
              </Card>
            )}
          </TabsContent>

          <TabsContent value="guest" className="space-y-6 mt-0 overflow-y-auto max-h-[60vh]">
            <Card className="border border-gray-200 bg-white hover:shadow-lg hover:border-blue-200 transition-all duration-300 rounded-xl">
              <CardHeader className="pb-4 border-b border-gray-100">
                <CardTitle className="flex items-center gap-3 text-lg font-semibold text-gray-900">
                  <div className="p-2.5 bg-blue-50 rounded-xl border border-blue-100">
                    <User className="w-5 h-5 text-blue-600" />
                  </div>
                  Guest Information
                </CardTitle>
              </CardHeader>
              <CardContent className="space-y-4 pt-4">
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <div className="space-y-2">
                    <Label className="text-sm font-medium text-gray-600">Guest Name</Label>
                    <p className="text-lg font-bold text-gray-800">{booking.userId.name}</p>
                  </div>
                  <div className="space-y-2">
                    <Label className="text-sm font-medium text-gray-600">Email Address</Label>
                    <p className="flex items-center gap-2 text-sm">
                      <Mail className="w-4 h-4 text-blue-500" />
                      <span className="font-medium">{booking.userId.email}</span>
                    </p>
                  </div>
                  <div className="space-y-2">
                    <Label className="text-sm font-medium text-gray-600">Phone Number</Label>
                    <p className="flex items-center gap-2 text-sm">
                      <Phone className="w-4 h-4 text-green-500" />
                      <span className="font-medium">{booking.userId.phone}</span>
                    </p>
                  </div>
                  <div className="space-y-2">
                    <Label className="text-sm font-medium text-gray-600">Guest ID</Label>
                    <p className="font-mono text-xs bg-gray-100 p-2 rounded border">{booking.userId._id}</p>
                  </div>
                </div>

                {/* Corporate Details */}
                {booking.corporateBooking && (
                  <div className="mt-4 p-3 border rounded-lg bg-blue-50">
                    <h4 className="font-medium mb-3 flex items-center gap-2">
                      <Building2 className="w-4 h-4" />
                      Corporate Booking Details
                    </h4>
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-3 text-sm">
                      <div>
                        <span className="text-gray-600">Department:</span>
                        <span className="ml-2">{booking.corporateBooking.department}</span>
                      </div>
                      <div>
                        <span className="text-gray-600">Cost Center:</span>
                        <span className="ml-2">{booking.corporateBooking.costCenter}</span>
                      </div>
                      <div>
                        <span className="text-gray-600">Employee ID:</span>
                        <span className="ml-2">{booking.corporateBooking.employeeId}</span>
                      </div>
                      <div>
                        <span className="text-gray-600">Payment Method:</span>
                        <span className="ml-2">{booking.corporateBooking.paymentMethod}</span>
                      </div>
                    </div>
                  </div>
                )}

                {/* Travel Agent Details */}
                {booking.travelAgentDetails && (
                  <div className="mt-4 p-3 border rounded-lg bg-indigo-50">
                    <h4 className="font-medium mb-3 flex items-center gap-2">
                      <Plane className="w-4 h-4" />
                      Travel Agent Details
                    </h4>
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-3 text-sm">
                      <div>
                        <span className="text-gray-600">Agent ID:</span>
                        <span className="ml-2">{booking.travelAgentDetails.agentId}</span>
                      </div>
                      <div>
                        <span className="text-gray-600">Commission:</span>
                        <span className="ml-2">{booking.travelAgentDetails.commission}%</span>
                      </div>
                      <div>
                        <span className="text-gray-600">Special Rates:</span>
                        <span className="ml-2">{booking.travelAgentDetails.specialRatesApplied ? 'Applied' : 'Not Applied'}</span>
                      </div>
                    </div>
                  </div>
                )}
              </CardContent>
            </Card>
          </TabsContent>

          <TabsContent value="payment" className="space-y-6 mt-0 overflow-y-auto max-h-[60vh]">
            <Card className="border border-gray-200 bg-white hover:shadow-lg hover:border-green-200 transition-all duration-300 rounded-xl">
              <CardHeader className="pb-4 border-b border-gray-100">
                <CardTitle className="flex items-center gap-3 text-lg font-semibold text-gray-900">
                  <div className="p-2.5 bg-green-50 rounded-xl border border-green-100">
                    <CreditCard className="w-5 h-5 text-green-600" />
                  </div>
                  Payment Information
                </CardTitle>
              </CardHeader>
              <CardContent className="space-y-6 pt-4">
                <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                  <div className="relative p-5 border-0 rounded-xl bg-gradient-to-br from-green-50 to-green-100/70 shadow-sm hover:shadow-md transition-shadow duration-200">
                    <div className="flex items-center justify-between mb-2">
                      <div className="text-sm font-medium text-green-700">Total Amount</div>
                      <div className="p-1.5 bg-green-200 rounded-lg">
                        <IndianRupee className="w-4 h-4 text-green-700" />
                      </div>
                    </div>
                    <div className="text-2xl font-bold text-green-800">
                      {formatCurrency(booking.totalAmount)}
                    </div>
                  </div>
                  <div className="relative p-5 border-0 rounded-xl bg-gradient-to-br from-blue-50 to-blue-100/70 shadow-sm hover:shadow-md transition-shadow duration-200">
                    <div className="flex items-center justify-between mb-2">
                      <div className="text-sm font-medium text-blue-700">Paid Amount</div>
                      <div className="p-1.5 bg-blue-200 rounded-lg">
                        <CheckCircle className="w-4 h-4 text-blue-700" />
                      </div>
                    </div>
                    <div className="text-2xl font-bold text-blue-800">
                      {formatCurrency(booking.paymentDetails.totalPaid)}
                    </div>
                  </div>
                  <div className="relative p-5 border-0 rounded-xl bg-gradient-to-br from-orange-50 to-orange-100/70 shadow-sm hover:shadow-md transition-shadow duration-200">
                    <div className="flex items-center justify-between mb-2">
                      <div className="text-sm font-medium text-orange-700">Remaining</div>
                      <div className="p-1.5 bg-orange-200 rounded-lg">
                        <Clock className="w-4 h-4 text-orange-700" />
                      </div>
                    </div>
                    <div className="text-2xl font-bold text-orange-800">
                      {formatCurrency(booking.paymentDetails.remainingAmount)}
                    </div>
                  </div>
                </div>

                <div className="flex items-center justify-between">
                  <span className="text-sm text-gray-600">Payment Status:</span>
                  <Badge className={
                    booking.paymentStatus === 'paid' ? 'bg-green-100 text-green-800' :
                    booking.paymentStatus === 'partial' ? 'bg-yellow-100 text-yellow-800' :
                    'bg-red-100 text-red-800'
                  }>
                    {booking.paymentStatus.toUpperCase()}
                  </Badge>
                </div>

                <div className="flex items-center justify-between">
                  <span className="text-sm text-gray-600">Currency:</span>
                  <span className="text-sm">{booking.currency}</span>
                </div>

                {booking.paymentDetails.paymentMethods.length > 0 && (
                  <div>
                    <h4 className="font-medium mb-2">Payment Methods</h4>
                    <div className="space-y-2">
                      {booking.paymentDetails.paymentMethods.map((method, index) => (
                        <div key={`booking-paymentDetails-paymentMethods-${index}-${method.type}`} className="flex justify-between items-center p-2 border rounded">
                          <span className="text-sm">{method.type}</span>
                          <span className="text-sm font-medium">{formatCurrency(method.amount)}</span>
                        </div>
                      ))}
                    </div>
                  </div>
                )}
              </CardContent>
            </Card>
          </TabsContent>

          <TabsContent value="history" className="space-y-6 mt-0 overflow-y-auto max-h-[60vh]">
            <Card className="border border-gray-200 bg-white hover:shadow-lg hover:border-purple-200 transition-all duration-300 rounded-xl">
              <CardHeader className="pb-4 border-b border-gray-100">
                <CardTitle className="flex items-center gap-3 text-lg font-semibold text-gray-900">
                  <div className="p-2.5 bg-purple-50 rounded-xl border border-purple-100">
                    <History className="w-5 h-5 text-purple-600" />
                  </div>
                  Status History
                </CardTitle>
              </CardHeader>
              <CardContent className="pt-4">
                <div className="space-y-4">
                  {booking.statusHistory.map((entry, index) => (
                    <div key={`booking-statusHistory-${index}-${entry.status}`} className="relative flex items-center gap-4 p-4 border-0 rounded-xl bg-gradient-to-r from-white to-purple-50/30 shadow-sm hover:shadow-md transition-shadow duration-200">
                      {/* Timeline connector */}
                      {index < booking.statusHistory.length - 1 && (
                        <div className="absolute left-6 top-12 w-0.5 h-6 bg-purple-200"></div>
                      )}

                      <div className="flex-shrink-0 relative">
                        <div className="p-1 bg-white rounded-full shadow-sm border-2 border-purple-100">
                          {getStatusBadge(entry.status)}
                        </div>
                      </div>

                      <div className="flex-1">
                        <div className="flex items-center justify-between mb-1">
                          <div className="text-sm font-semibold text-gray-800">
                            Status changed to {entry.status.replace('_', ' ').toUpperCase()}
                          </div>
                          <div className="text-xs text-purple-600 bg-purple-100 px-2 py-1 rounded-full">
                            {format(parseISO(entry.timestamp), 'MMM dd, hh:mm a')}
                          </div>
                        </div>

                        <div className="text-xs text-gray-600 mb-1">
                          Changed by <span className="font-medium">{entry.changedBy?.userName || entry.changedBy || 'System'}</span>
                        </div>

                        {entry.reason && (
                          <div className="text-xs text-gray-600 bg-gray-50 p-2 rounded-lg mt-2">
                            <span className="font-medium">Reason:</span> {entry.reason}
                          </div>
                        )}
                      </div>
                    </div>
                  ))}
                </div>
              </CardContent>
            </Card>

            <Card className="border border-gray-200 bg-white hover:shadow-lg hover:border-indigo-200 transition-all duration-300 rounded-xl">
              <CardHeader className="pb-4 border-b border-gray-100">
                <CardTitle className="flex items-center gap-3 text-lg font-semibold text-gray-900">
                  <div className="p-2.5 bg-indigo-50 rounded-xl border border-indigo-100">
                    <FileText className="w-5 h-5 text-indigo-600" />
                  </div>
                  Booking Timeline
                </CardTitle>
              </CardHeader>
              <CardContent className="pt-4">
                <div className="space-y-2 text-sm">
                  <div className="flex justify-between">
                    <span className="text-gray-600">Created:</span>
                    <span>{format(parseISO(booking.createdAt), 'MMM dd, yyyy hh:mm a')}</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-gray-600">Last Updated:</span>
                    <span>{format(parseISO(booking.updatedAt), 'MMM dd, yyyy hh:mm a')}</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-gray-600">Cancellation Policy:</span>
                    <Badge variant="outline">{booking.cancellationPolicy}</Badge>
                  </div>
                </div>
              </CardContent>
            </Card>
          </TabsContent>
        </Tabs>
        </div>
      </DialogContent>
    </Dialog>
  );
};

export default withErrorBoundary(BookingDetailsModal, { level: 'component' });