import React, { useState, useEffect, useCallback } from 'react';
import { DataTable } from '../../components/dashboard/DataTable';
import { StatusBadge } from '../../components/dashboard/StatusBadge';
import { Button } from '../../components/ui/button';
import { Input } from '../../components/ui/input';
import { Label } from '../../components/ui/label';
import { Textarea } from '../../components/ui/textarea';
import { Modal } from '../../components/ui/Modal';
import { Card, CardHeader, CardTitle, CardContent } from '../../components/ui/card';
import { adminService } from '../../services/adminService';
import { api } from '../../services/api';
import { paymentService } from '../../services/paymentService';
import { AdminBooking, BookingFilters, BookingStats } from '../../types/admin';
import { formatCurrency, formatNumber } from '../../utils/dashboardUtils';
import { format, parseISO } from 'date-fns';
import WalkInBooking from '../admin/WalkInBooking';
import PaymentCollectionModal from '../../components/admin/PaymentCollectionModal';
import PriceAdjustmentModal from '../../components/admin/PriceAdjustmentModal';
import NoShowModal from '../../components/admin/NoShowModal';
import toast from 'react-hot-toast';
import { useQueryClient } from '@tanstack/react-query';
import { useAuth } from '../../context/AuthContext';
import { useProperty } from '../../context/PropertyContext';
import { PropertyBreadcrumb } from '../../components/common/PropertyBreadcrumb';
import { withErrorBoundary } from '../../components/ErrorBoundary';
import { realTimeService } from '../../services/realTimeService';
import {
  Calendar,
  TrendingUp,
  Filter,
  Eye,
  X,
  CheckCircle,
  Clock,
  UserCheck,
  UserX,
  Plus,
  Search,
  Home,
  User,
  UserPlus,
  Building,
  DollarSign,
  AlertTriangle,
  AlertCircle,
  FileText,
  ShieldAlert,
  Loader2
} from 'lucide-react';

function FrontDeskBookings() {
  const queryClient = useQueryClient();
  const { user } = useAuth();
  const { selectedPropertyId } = useProperty();
  const activeHotelId = selectedPropertyId || user?.hotelId || '';
  const [bookings, setBookings] = useState<AdminBooking[]>([]);
  const [stats, setStats] = useState<BookingStats | null>(null);
  const [loading, setLoading] = useState(true);
  const [filters, setFilters] = useState<BookingFilters>({
    page: 1,
    limit: 50 // Increased from 10 to 50 to show more bookings
  });
  const [pagination, setPagination] = useState({
    current: 1,
    pages: 1,
    total: 0
  });
  const [selectedBooking, setSelectedBooking] = useState<AdminBooking | null>(null);
  const [showDetailsModal, setShowDetailsModal] = useState(false);
  const [showFilters, setShowFilters] = useState(false);
  const [updating, setUpdating] = useState(false);
  
  // Payment collection modal state (for check-in)
  const [showPaymentModal, setShowPaymentModal] = useState(false);
  const [selectedBookingForPayment, setSelectedBookingForPayment] = useState<AdminBooking | null>(null);

  // Checkout payment modal state (for checkout)
  const [showCheckOutPaymentModal, setShowCheckOutPaymentModal] = useState(false);
  const [selectedBookingForCheckOut, setSelectedBookingForCheckOut] = useState<AdminBooking | null>(null);

  // Bypass checkout modal state
  const [showBypassCheckoutDialog, setShowBypassCheckoutDialog] = useState(false);
  const [selectedBookingForBypass, setSelectedBookingForBypass] = useState<AdminBooking | null>(null);
  const [bypassReason, setBypassReason] = useState('');
  const [bypassConfirmed, setBypassConfirmed] = useState(false);

  // Room assignment state
  const [showRoomAssignmentModal, setShowRoomAssignmentModal] = useState(false);
  const [selectedBookingForRoomAssignment, setSelectedBookingForRoomAssignment] = useState<AdminBooking | null>(null);
  const [availableRoomsForAssignment, setAvailableRoomsForAssignment] = useState<Array<{ _id: string; roomNumber: string; type: string; baseRate: number; currentRate?: number; floor?: string; maxOccupancy?: number; amenities?: string[] }>>([]);
  const [selectedRoomNumbers, setSelectedRoomNumbers] = useState<{ [key: string]: string }>({});

  // Price adjustment modal state
  const [showPriceAdjustmentModal, setShowPriceAdjustmentModal] = useState(false);
  const [selectedBookingForPriceAdjustment, setSelectedBookingForPriceAdjustment] = useState<AdminBooking | null>(null);

  // No-show modal state
  const [showNoShowModal, setShowNoShowModal] = useState(false);
  const [selectedBookingForNoShow, setSelectedBookingForNoShow] = useState<AdminBooking | null>(null);

  // Settlement modal state
  const [showSettlementModal, setShowSettlementModal] = useState(false);
  const [selectedBookingForSettlement, setSelectedBookingForSettlement] = useState<AdminBooking | null>(null);
  const [settlementData, setSettlementData] = useState<{
    finalAmount: number;
    outstandingBalance: number;
    refundAmount: number;
    adjustments?: Array<{ type?: string; amount: number; description?: string }>;
  } | null>(null);

  // Manual booking form state
  const [showCreateModal, setShowCreateModal] = useState(false);
  const [showWalkInModal, setShowWalkInModal] = useState(false);
  const [availableRooms, setAvailableRooms] = useState<Array<{ _id: string; roomNumber: string; type: string; baseRate: number; currentRate?: number; floor?: string; maxOccupancy?: number; amenities?: string[] }>>([]);
  const [users, setUsers] = useState<Array<{ _id: string; name: string; email: string; phone?: string }>>([]);
  const [userSearch, setUserSearch] = useState('');
  const [creating, setCreating] = useState(false);
  const [createForm, setCreateForm] = useState({
    hotelId: activeHotelId,
    userId: '',
    roomIds: [] as string[],
    checkIn: '',
    checkOut: '',
    guestDetails: {
      adults: 1,
      children: 0,
      specialRequests: ''
    },
    totalAmount: 0,
    currency: 'INR',
    paymentStatus: 'pending' as 'pending' | 'paid',
    status: 'pending' as 'pending' | 'confirmed'
  });

  const getBookingHotelId = (booking: AdminBooking): string => {
    if (typeof booking.hotelId === 'string') return booking.hotelId;
    return booking.hotelId?._id || '';
  };

  const assertBookingInScope = (booking: AdminBooking): boolean => {
    if (!activeHotelId) {
      toast.error('Select a property to continue.');
      return false;
    }
    const bookingHotelId = getBookingHotelId(booking);
    if (bookingHotelId && bookingHotelId !== activeHotelId) {
      toast.error('This booking belongs to a different property.');
      return false;
    }
    return true;
  };

  // Fetch bookings
  const fetchBookings = useCallback(async () => {
    if (!activeHotelId) {
      setBookings([]);
      setPagination({ current: 1, pages: 1, total: 0 });
      setLoading(false);
      return;
    }
    try {
      setLoading(true);

      // Add hotelId to filters to ensure we only get bookings for the correct hotel
      const bookingFilters = {
        ...filters,
        hotelId: activeHotelId
      };

      const response = await adminService.getFrontDeskBookings(bookingFilters);

      // Backend returns: { status, results, pagination, stats, data: bookings[] }
      // After axios unwrapping, response === that object.
      let bookingsData: AdminBooking[] = [];
      if (Array.isArray(response.data)) {
        // data field is the array directly
        bookingsData = response.data as AdminBooking[];
      } else if (response.data && typeof response.data === 'object') {
        // Nested under data.bookings or data.data
        const inner = response.data as Record<string, unknown>;
        if (Array.isArray(inner.bookings)) {
          bookingsData = inner.bookings as AdminBooking[];
        } else if (Array.isArray(inner.data)) {
          bookingsData = inner.data as AdminBooking[];
        }
      }

      setBookings(Array.isArray(bookingsData) ? bookingsData : []);

      // Prefer server-side pagination metadata
      const pag = (response as Record<string, unknown>).pagination as Record<string, number> | undefined;
      if (pag) {
        setPagination({
          current: pag.page ?? pag.current ?? (bookingFilters.page || 1),
          pages: pag.pages ?? 1,
          total: pag.total ?? bookingsData.length
        });
      } else {
        setPagination({
          current: bookingFilters.page || 1,
          pages: Math.ceil(bookingsData.length / (bookingFilters.limit || 50)) || 1,
          total: bookingsData.length
        });
      }

      // Extract inline stats from the bookings list response to avoid a
      // separate /reports/bookings/stats round-trip.
      const inlineStats = (response as Record<string, unknown>).stats as Record<string, unknown> | undefined;
      if (inlineStats && typeof inlineStats === 'object') {
        setStats({
          total: (inlineStats.total as number) ?? (inlineStats.totalBookings as number) ?? 0,
          totalRevenue: (inlineStats.totalRevenue as number) ?? 0,
          averageBookingValue: (inlineStats.averageBookingValue as number) ?? 0,
          pending: (inlineStats.pending as number) ?? (inlineStats.pendingBookings as number) ?? 0,
          confirmed: (inlineStats.confirmed as number) ?? 0,
          checkedIn: (inlineStats.checkedIn as number) ?? 0,
          checkedOut: (inlineStats.checkedOut as number) ?? 0,
          cancelled: (inlineStats.cancelled as number) ?? 0,
        });
      }

    } catch (error: unknown) {
      const axiosErr = error as { response?: { status?: number } };
      if (axiosErr?.response?.status === 429) {
        toast.error('Too many requests. Please wait a moment and try again.');
      }
      setBookings([]);
      setPagination({ current: 1, pages: 1, total: 0 });
    } finally {
      setLoading(false);
    }
  }, [activeHotelId, filters]);

  // Fetch stats as a fallback — used when the inline stats from fetchBookings
  // are absent (e.g. older backend versions). Callers should always prefer
  // fetchBookings() which now sets stats inline from the list response.
  const fetchStats = useCallback(async () => {
    if (!activeHotelId) return;
    try {
      const response = await adminService.getBookingStats({ hotelId: activeHotelId });
      // Only update if inline stats from fetchBookings didn't already populate
      setStats(prev => prev ?? (response.data?.stats || (response.data as BookingStats) || null));
    } catch {
      // non-fatal — list stats from fetchBookings are sufficient
    }
  }, [activeHotelId]);

  useEffect(() => {
    fetchBookings();
  }, [fetchBookings]);

  // Run fetchStats as a fallback if fetchBookings didn't populate stats
  // (inline stats are always preferred to avoid an extra round-trip).
  useEffect(() => {
    if (!stats && activeHotelId) {
      fetchStats();
    }
  }, [stats, activeHotelId, fetchStats]);

  // Ensure the real-time WebSocket singleton is connected so event listeners below can fire.
  // Do NOT disconnect on unmount — realTimeService is a singleton shared across components.
  useEffect(() => {
    realTimeService.connect().catch(() => { /* WebSocket unavailable -- page still works */ });
  }, []);

  // Real-time: listen for booking events so guest actions (create, cancel, modify) reflect immediately
  useEffect(() => {
    const handleRealtimeRefresh = () => {
      fetchBookings();
      fetchStats();
      queryClient.invalidateQueries({ queryKey: ['dashboard'] });
    };

    realTimeService.on('booking:created', handleRealtimeRefresh);
    realTimeService.on('booking:updated', handleRealtimeRefresh);
    realTimeService.on('booking:cancelled', handleRealtimeRefresh);
    realTimeService.on('booking:modification_requested', handleRealtimeRefresh);
    realTimeService.on('booking:payment_updated', handleRealtimeRefresh);

    return () => {
      realTimeService.off('booking:created', handleRealtimeRefresh);
      realTimeService.off('booking:updated', handleRealtimeRefresh);
      realTimeService.off('booking:cancelled', handleRealtimeRefresh);
      realTimeService.off('booking:modification_requested', handleRealtimeRefresh);
      realTimeService.off('booking:payment_updated', handleRealtimeRefresh);
    };
  }, [fetchBookings, fetchStats, queryClient, activeHotelId]);

  // Handle status update
  const handleStatusUpdate = async (bookingId: string, newStatus: 'pending' | 'confirmed' | 'checked_in' | 'checked_out' | 'cancelled' | 'no_show') => {
    const booking = bookings.find(b => b._id === bookingId);
    if (booking && !assertBookingInScope(booking)) return;
    
    // Check if this is a pending -> confirmed transition that needs room assignment
    if (booking?.status === 'pending' && newStatus === 'confirmed') {
      // If booking has no rooms assigned or roomType is not specified, trigger room assignment
      if (!booking.rooms || booking.rooms.length === 0) {
        handleRoomAssignmentForConfirmation(booking);
        return;
      }
    }
    
    try {
      setUpdating(true);
      await adminService.updateBooking(bookingId, { status: newStatus });
      
      // Invalidate queries to refresh data
      queryClient.invalidateQueries({ queryKey: ['admin-bookings'] });
      queryClient.invalidateQueries({ queryKey: ['admin-bookings-stats'] });
      queryClient.invalidateQueries({ queryKey: ['dashboard'] });
      queryClient.invalidateQueries({ queryKey: ['bookings'] });
      
      await fetchBookings();
      await fetchStats();
      toast.success('Booking status updated successfully');
    } catch (error) {
      toast.error('Failed to update booking status');
    } finally {
      setUpdating(false);
    }
  };

  // Handle booking cancellation
  const handleCancelBooking = async (bookingId: string, reason: string = 'Cancelled by admin') => {
    const booking = bookings.find(b => b._id === bookingId);
    if (booking && !assertBookingInScope(booking)) return;
    try {
      setUpdating(true);
      await adminService.cancelBooking(bookingId, reason);
      toast.success('Booking cancelled successfully');
      await fetchBookings();
      await fetchStats();
    } catch {
      toast.error('Failed to cancel booking');
    } finally {
      setUpdating(false);
    }
  };

  // Handle room assignment specifically for confirmation
  const handleRoomAssignmentForConfirmation = async (booking: AdminBooking) => {
    try {
      setSelectedBookingForRoomAssignment(booking);
      
      
      // Check if hotel information is available
      let hotelId = booking.hotelId?._id;
      
      // If hotelId is not populated as an object, try to use it as a string
      if (!hotelId && typeof booking.hotelId === 'string') {
        hotelId = booking.hotelId;
      }
      
      // If still no hotelId, try to get it from the user context or use a fallback
      if (!hotelId) {

        // Try to get hotelId from user context (if user is logged in and has hotelId)
        const userHotelId = activeHotelId;

        if (userHotelId) {
          hotelId = userHotelId;
        } else {
          toast.error('Hotel information is missing for this booking');
          return;
        }
      }
      
      
      // Fetch available rooms for the booking dates
      const checkInDate = new Date(booking.checkIn).toISOString().split('T')[0];
      const checkOutDate = new Date(booking.checkOut).toISOString().split('T')[0];
      
      
      const response = await adminService.getAvailableRooms(
        hotelId, 
        checkInDate, 
        checkOutDate
      );
      
      const availableRooms = (response.data.rooms || []) as typeof availableRoomsForAssignment;

      setAvailableRoomsForAssignment(availableRooms);
      setSelectedRoomNumbers({});
      setShowRoomAssignmentModal(true);
    } catch (error) {
      toast.error('Failed to load available rooms');
    }
  };

  // Handle room assignment submission
  const handleSubmitRoomAssignment = async () => {
    if (!selectedBookingForRoomAssignment) return;

    try {
      const selectedRoomId = selectedRoomNumbers.selectedRoomId;
      const selectedRoomType = selectedRoomNumbers.selectedRoomType;
      
      if (!selectedRoomId) {
        toast.error('Please select a room');
        return;
      }

      // Find the selected room details
      const selectedRoom = availableRoomsForAssignment.find(r => r._id === selectedRoomId);
      if (!selectedRoom) {
        toast.error('Selected room not found');
        return;
      }

      // Create room assignment data
      const roomAssignments = [{
        roomType: selectedRoomType,
        roomNumber: selectedRoom.roomNumber
      }];

      // Submit room assignment by updating the booking with the selected room
      const roomAssignmentUpdate = {
        rooms: [{
          roomId: selectedRoomId,
          rate: selectedRoom.baseRate || selectedRoom.currentRate || 0
        }],
        status: 'confirmed'
      };

      const updatedBooking = await adminService.updateBooking(selectedBookingForRoomAssignment._id, roomAssignmentUpdate);

      toast.success('Room assigned and booking confirmed successfully!');

      // Update the selected booking in the modal if it's the same booking
      if (selectedBooking && selectedBooking._id === selectedBookingForRoomAssignment._id) {
        setSelectedBooking(updatedBooking.data.booking);
      }

      // Close modal and refresh data
      setShowRoomAssignmentModal(false);
      setSelectedBookingForRoomAssignment(null);
      setAvailableRoomsForAssignment([]);
      setSelectedRoomNumbers({});
      
      // Refresh all data
      queryClient.invalidateQueries({ queryKey: ['admin-bookings'] });
      queryClient.invalidateQueries({ queryKey: ['admin-bookings-stats'] });
      queryClient.invalidateQueries({ queryKey: ['dashboard'] });
      queryClient.invalidateQueries({ queryKey: ['bookings'] });
      
      await fetchBookings();
      await fetchStats();
    } catch (error) {
      toast.error('Failed to assign room');
    }
  };

  // Handle check-in with payment collection
  const handleCheckIn = async (booking: AdminBooking) => {
    if (!assertBookingInScope(booking)) return;
    // If payment is already completed, check-in directly without payment modal
    if (booking.paymentStatus === 'paid') {
      try {
        setUpdating(true);
        const response = await adminService.checkInBooking(booking._id);

        const updatedBooking = response.data.booking;
        toast.success('Guest checked in successfully! Payment already completed.');

        // Notify front-desk staff about the auto-generated digital key (if issued)
        const digitalKey = response.data.digitalKey;
        if (digitalKey?.keyCode) {
          toast.success(`Digital key issued: ${digitalKey.keyCode}`, { duration: 6000 });
        }

        // Update the selected booking in the modal if it's the same booking
        if (selectedBooking && selectedBooking._id === booking._id) {
          setSelectedBooking(updatedBooking);
        }

        // Refresh all data
        queryClient.invalidateQueries({ queryKey: ['admin-bookings'] });
        queryClient.invalidateQueries({ queryKey: ['admin-bookings-stats'] });
        queryClient.invalidateQueries({ queryKey: ['dashboard'] });
        queryClient.invalidateQueries({ queryKey: ['bookings'] });

        await fetchBookings();
        await fetchStats();
      } catch (error) {
        toast.error('Failed to check in guest');
      } finally {
        setUpdating(false);
      }
    } else {
      // Payment pending or partial - show payment modal
      setSelectedBookingForPayment(booking);
      setShowPaymentModal(true);
    }
  };

  // Handle payment collection and check-in
  const handlePaymentCollection = async (paymentDetails: { paymentMethods: Array<{ method: string; amount: number; reference?: string }> } | null) => {
    if (!selectedBookingForPayment) return;

    try {
      setUpdating(true);
      const response = await adminService.checkInBooking(
        selectedBookingForPayment._id,
        paymentDetails || undefined
      );

      // Extract payment details from response
      const updatedBooking = response.data.booking;
      const totalPaid = updatedBooking.paymentDetails?.totalPaid || 0;
      const remainingAmount = updatedBooking.paymentDetails?.remainingAmount || 0;
      const totalAmount = updatedBooking.totalAmount || 0;

      // Show success message with balance information
      if (paymentDetails && paymentDetails.paymentMethods.length > 0) {
        const collectedAmount = paymentDetails.paymentMethods.reduce((sum, p) => sum + p.amount, 0);
        if (remainingAmount > 0) {
          toast.success(
            `Guest checked in! Payment collected: ${formatCurrency(collectedAmount, updatedBooking.currency)}. Remaining balance: ${formatCurrency(remainingAmount, updatedBooking.currency)}`
          );
        } else {
          toast.success(
            `Guest checked in successfully! Payment collected: ${formatCurrency(collectedAmount, updatedBooking.currency)}. Fully paid!`
          );
        }
      } else {
        if (remainingAmount > 0) {
          toast.success(
            `Guest checked in! No payment collected. Remaining balance: ${formatCurrency(remainingAmount, updatedBooking.currency)}`
          );
        } else {
          toast.success('Guest checked in successfully!');
        }
      }

      // Notify front-desk staff about the auto-generated digital key (if issued)
      const digitalKey = response.data.digitalKey;
      if (digitalKey?.keyCode) {
        toast.success(`Digital key issued: ${digitalKey.keyCode}`, { duration: 6000 });
      }

      // Update the selected booking in the modal if it's the same booking
      if (selectedBooking && selectedBooking._id === selectedBookingForPayment._id) {
        setSelectedBooking(updatedBooking);
      }

      // Close payment modal and refresh data
      setShowPaymentModal(false);
      setSelectedBookingForPayment(null);

      // Refresh all data
      queryClient.invalidateQueries({ queryKey: ['admin-bookings'] });
      queryClient.invalidateQueries({ queryKey: ['admin-bookings-stats'] });
      queryClient.invalidateQueries({ queryKey: ['dashboard'] });
      queryClient.invalidateQueries({ queryKey: ['bookings'] });

      await fetchBookings();
      await fetchStats();
    } catch (error) {
      toast.error('Failed to check in guest');
    } finally {
      setUpdating(false);
    }
  };

  // Handle check-out - Smart checkout with automatic payment collection
  const handleCheckOut = async (booking: AdminBooking) => {
    if (!assertBookingInScope(booking)) return;
    try {

      // Calculate outstanding balance
      const totalAmount = booking.totalAmount || 0;
      const totalPaid = booking.paymentDetails?.totalPaid || 0;
      const outstandingBalance = totalAmount - totalPaid;


      // If there's an outstanding balance, open payment collection modal
      if (outstandingBalance > 0) {
        setSelectedBookingForCheckOut(booking);
        setShowCheckOutPaymentModal(true); // ✅ Open the modal
        return;
      }

      // If fully paid, proceed with direct checkout
      await processCheckOut(booking, false); // false = don't bypass
    } catch (error: unknown) {
      toast.error('Failed to initiate checkout');
    }
  };

  // Process actual checkout (called after payment or if no balance)
  const processCheckOut = async (booking: AdminBooking, bypass: boolean = false, bypassReason?: string) => {
    try {
      setUpdating(true);

      // Prepare request body with bypass flag if needed
      const requestBody = bypass ? {
        bypassBalanceCheck: true,
        bypassReason: bypassReason || 'No reason provided'
      } : {};

      const response = await api.patch(`/bookings/${booking._id}/check-out`, requestBody);


      // Extract settlement data from response
      const settlement = response.data?.data?.settlement;
      const settlementStatus = response.data?.data?.settlementStatus;
      const updatedBooking = response.data?.data?.booking;

      // Update the selected booking in the modal if it's the same booking
      if (selectedBooking && selectedBooking._id === booking._id) {
        setSelectedBooking(updatedBooking);
      }

      // Show settlement summary based on status
      if (settlement && settlementStatus) {
        if (settlementStatus === 'pending' && settlement.outstandingBalance > 0) {
          // Outstanding balance - show settlement modal with payment option
          setSelectedBookingForSettlement(updatedBooking);
          setSettlementData(settlement);
          setShowSettlementModal(true);
          if (bypass) {
            toast.warning(`Guest checked out (BYPASSED)! Outstanding balance: ₹${settlement.outstandingBalance.toLocaleString()}`);
          } else {
            toast.success(`Guest checked out! Outstanding balance: ₹${settlement.outstandingBalance.toLocaleString()}`);
          }
        } else if (settlementStatus === 'refund_pending' && settlement.refundAmount > 0) {
          // Refund due - show settlement modal with refund option
          setSelectedBookingForSettlement(updatedBooking);
          setSettlementData(settlement);
          setShowSettlementModal(true);
          toast.success(`Guest checked out! Refund due: ₹${settlement.refundAmount.toLocaleString()}`);
        } else if (settlementStatus === 'completed') {
          // Fully settled
          toast.success('Guest checked out successfully - Fully Settled!');
        } else {
          // Fallback
          toast.success('Guest checked out successfully!');
        }
      } else {
        toast.success('Guest checked out successfully!');
      }

      // Refresh all data
      queryClient.invalidateQueries({ queryKey: ['admin-bookings'] });
      queryClient.invalidateQueries({ queryKey: ['admin-bookings-stats'] });
      queryClient.invalidateQueries({ queryKey: ['dashboard'] });
      queryClient.invalidateQueries({ queryKey: ['bookings'] });

      await fetchBookings();
      await fetchStats();
    } catch (error: unknown) {
      const axiosErr = error as { response?: { data?: { code?: string; message?: string; error?: { code?: string; message?: string } } } };

      // Check if error is due to outstanding balance
      const errorCode = axiosErr?.response?.data?.code || axiosErr?.response?.data?.error?.code;
      const errorMessage = axiosErr?.response?.data?.message || axiosErr?.response?.data?.error?.message;

      if (errorCode === 'OUTSTANDING_BALANCE' || errorMessage?.includes('outstanding balance')) {
        // Extract balance from error message
        const balanceMatch = errorMessage?.match(/₹([\d,]+)/);
        const balance = balanceMatch ? balanceMatch[1] : 'unknown';

        // Show payment modal to collect payment
        setSelectedBookingForCheckOut(booking);
        setShowCheckOutPaymentModal(true);

        toast.error(`Cannot checkout: Outstanding balance of ₹${balance}. Please collect payment or use bypass.`);
      } else {
        toast.error(errorMessage || 'Failed to check out guest');
      }
    } finally {
      setUpdating(false);
    }
  };

  // Handle checkout payment collection (BEFORE actual checkout)
  const handleCheckOutPaymentCollection = async (paymentDetails: { paymentMethods: Array<{ method: string; amount: number; reference?: string }>; isPartialPayment: boolean } | null) => {
    if (!selectedBookingForCheckOut || !paymentDetails) return;

    try {
      setUpdating(true);

      const totalAmount = paymentDetails.paymentMethods.reduce((sum, pm) => sum + pm.amount, 0);

      // Process payment using the settlement payment endpoint with paymentMethods array
      const response = await api.post(`/bookings/${selectedBookingForCheckOut._id}/settlement/payment`, {
        paymentMethods: paymentDetails.paymentMethods,
        amount: totalAmount
      });

      const updatedBookingFromResponse = response.data?.data?.booking;
      const updatedPaymentDetails = updatedBookingFromResponse?.paymentDetails || response.data?.booking?.paymentDetails;

      if (paymentDetails.isPartialPayment) {
        // PARTIAL PAYMENT: Record payment only, do NOT checkout
        toast.success(`Partial payment of ${totalAmount.toLocaleString()} collected. Remaining balance will be due at checkout.`);

        // Close the checkout payment modal
        setShowCheckOutPaymentModal(false);

        // Refresh booking data to reflect updated payment
        await fetchBookings();
        await fetchStats();

        // Invalidate queries to update UI everywhere
        queryClient.invalidateQueries({ queryKey: ['admin-bookings'] });
        queryClient.invalidateQueries({ queryKey: ['admin-bookings-stats'] });
        queryClient.invalidateQueries({ queryKey: ['dashboard'] });
        queryClient.invalidateQueries({ queryKey: ['bookings'] });

        // Update selected booking if the detail panel is open
        if (selectedBooking && selectedBooking._id === selectedBookingForCheckOut._id && updatedBookingFromResponse) {
          setSelectedBooking(updatedBookingFromResponse);
        }

        // Clear checkout payment state
        setSelectedBookingForCheckOut(null);
      } else {
        // FULL PAYMENT: Record payment then proceed with checkout
        toast.success('Payment collected successfully!');

        // Close the checkout payment modal
        setShowCheckOutPaymentModal(false);

        // Use payment response to build updated booking data for checkout
        const bookingForCheckout = {
          ...selectedBookingForCheckOut,
          ...(updatedPaymentDetails ? { paymentDetails: updatedPaymentDetails } : {})
        };

        // Proceed with checkout
        await processCheckOut(bookingForCheckout);

        // Refresh data after checkout
        await fetchBookings();
        await fetchStats();

        // Clear checkout payment state
        setSelectedBookingForCheckOut(null);
      }

    } catch (error: unknown) {
      toast.error(error instanceof Error ? error.message : 'Failed to process payment');
    } finally {
      setUpdating(false);
    }
  };

  const handleProcessRefund = async () => {
    if (!selectedBookingForSettlement || !settlementData?.refundAmount) {
      return;
    }

    const paymentIntentId = selectedBookingForSettlement.stripePaymentId;
    if (!paymentIntentId) {
      toast.error('Cannot process refund: missing Stripe payment intent reference for this booking.');
      return;
    }

    try {
      setUpdating(true);
      await paymentService.createRefund({
        paymentIntentId,
        amount: settlementData.refundAmount,
        reason: 'requested_by_customer'
      });

      toast.success(`Refund processed successfully: ₹${settlementData.refundAmount.toLocaleString()}`);

      queryClient.invalidateQueries({ queryKey: ['admin-bookings'] });
      queryClient.invalidateQueries({ queryKey: ['admin-bookings-stats'] });
      queryClient.invalidateQueries({ queryKey: ['dashboard'] });
      queryClient.invalidateQueries({ queryKey: ['bookings'] });

      await fetchBookings();
      await fetchStats();
      setShowSettlementModal(false);
      setSelectedBookingForSettlement(null);
      setSettlementData(null);
    } catch (error: unknown) {
      const axiosErr = error as { response?: { data?: { message?: string } } };
      const message = axiosErr?.response?.data?.message || 'Failed to process refund';
      toast.error(message);
    } finally {
      setUpdating(false);
    }
  };

  // Handle bypass checkout - Show confirmation dialog
  const handleBypassCheckout = (booking: AdminBooking) => {
    if (!assertBookingInScope(booking)) return;
    setSelectedBookingForBypass(booking);
    setBypassReason('');
    setBypassConfirmed(false);
    setShowBypassCheckoutDialog(true);
  };

  // Confirm bypass checkout with reason
  const confirmBypassCheckout = async () => {
    if (!selectedBookingForBypass) return;

    if (!bypassReason.trim()) {
      toast.error('Please provide a reason for bypassing checkout');
      return;
    }

    if (bypassReason.length < 20) {
      toast.error('Reason must be at least 20 characters long');
      return;
    }

    if (!bypassConfirmed) {
      toast.error('Please confirm that this bypass is authorized');
      return;
    }

    setShowBypassCheckoutDialog(false);
    await processCheckOut(selectedBookingForBypass, true, bypassReason);
    setSelectedBookingForBypass(null);
    setBypassReason('');
    setBypassConfirmed(false);
  };

  // Handle price adjustment
  const handlePriceAdjustment = (booking: AdminBooking) => {
    setSelectedBookingForPriceAdjustment(booking);
    setShowPriceAdjustmentModal(true);
  };

  const handleNoShow = (booking: AdminBooking) => {
    setSelectedBookingForNoShow(booking);
    setShowNoShowModal(true);
  };

  const handleNoShowSuccess = async () => {
    // Refresh bookings and stats after successful no-show marking
    await fetchBookings();
    await fetchStats();
  };

  // Handle price adjustment success
  const handlePriceAdjustmentSuccess = async () => {
    try {
      // If the details modal is open for the same booking, fetch it directly
      // to avoid stale state from the bookings list (React state updates are async)
      if (selectedBooking && selectedBookingForPriceAdjustment && selectedBooking._id === selectedBookingForPriceAdjustment._id) {
        try {
          const response = await adminService.getBookingById(selectedBooking._id);
          const updatedBooking = response.data?.booking || response.data;
          if (updatedBooking) {
            setSelectedBooking(updatedBooking);
          }
        } catch {
          // Fall through to list refresh
        }
      }

      await fetchBookings();
      await fetchStats();
    } catch {
      toast.error('Failed to refresh booking data after price adjustment');
    }
  };

  // Fetch available rooms
  const fetchAvailableRooms = async (hotelId: string, checkIn: string, checkOut: string) => {
    try {
      const response = await adminService.getAvailableRooms(hotelId, checkIn, checkOut);
      setAvailableRooms((response.data.rooms || []) as typeof availableRooms);
    } catch (error) {
      setAvailableRooms([]);
    }
  };

  // Fetch users for guest selection (with limit to avoid unbounded queries)
  const fetchUsers = async (search: string = '') => {
    try {
      const response = await adminService.getUsers({ search, role: 'guest', limit: 20 } as Record<string, unknown>);
      setUsers((response.data.users || []) as typeof users);
    } catch (error) {
      setUsers([]);
    }
  };

  // Handle create booking form submission
  const handleCreateBooking = async () => {
    if (!activeHotelId) {
      toast.error('Select a property before creating a booking.');
      return;
    }
    try {
      setCreating(true);
      await adminService.createBooking(createForm);

      // Reset form and close modal
      setCreateForm({
        hotelId: activeHotelId,
        userId: '',
        roomIds: [],
        checkIn: '',
        checkOut: '',
        guestDetails: {
          adults: 1,
          children: 0,
          specialRequests: ''
        },
        totalAmount: 0,
        currency: 'INR',
        paymentStatus: 'pending',
        status: 'pending'
      });
      setShowCreateModal(false);
      toast.success('Booking created successfully');

      // Refresh bookings and stats
      await fetchBookings();
      await fetchStats();
    } catch {
      toast.error('Failed to create booking');
    } finally {
      setCreating(false);
    }
  };

  // Calculate total amount when rooms or dates change
  const calculateTotalAmount = () => {
    if (!createForm.checkIn || !createForm.checkOut || createForm.roomIds.length === 0) {
      return 0;
    }

    const checkInDate = new Date(createForm.checkIn);
    const checkOutDate = new Date(createForm.checkOut);
    if (isNaN(checkInDate.getTime()) || isNaN(checkOutDate.getTime())) {
      return 0;
    }
    const nights = Math.ceil((checkOutDate.getTime() - checkInDate.getTime()) / (1000 * 60 * 60 * 24));

    // Guard against zero or negative nights (checkout before/same as checkin)
    if (nights <= 0 || isNaN(nights)) {
      return 0;
    }

    const selectedRooms = availableRooms.filter(room => createForm.roomIds.includes(room._id));
    const roomsTotal = selectedRooms.reduce((total, room) => total + (room.currentRate || 0), 0);

    return roomsTotal * nights;
  };

  // Update total amount when form changes
  useEffect(() => {
    const totalAmount = calculateTotalAmount();
    setCreateForm(prev => ({ ...prev, totalAmount }));
  }, [createForm.roomIds, createForm.checkIn, createForm.checkOut, availableRooms]);

  useEffect(() => {
    setCreateForm(prev => ({ ...prev, hotelId: activeHotelId, roomIds: [] }));
    setAvailableRooms([]);
  }, [activeHotelId]);

  // Fetch available rooms when dates change
  useEffect(() => {
    if (createForm.hotelId && createForm.checkIn && createForm.checkOut) {
      fetchAvailableRooms(createForm.hotelId, createForm.checkIn, createForm.checkOut);
    }
  }, [createForm.hotelId, createForm.checkIn, createForm.checkOut]);

  // Fetch users when user search changes (debounced to avoid excessive API calls)
  useEffect(() => {
    const timer = setTimeout(() => {
      fetchUsers(userSearch);
    }, 300);
    return () => clearTimeout(timer);
  }, [userSearch]);

  // Table columns
  const columns = [
    {
      key: 'bookingNumber',
      header: 'Booking #',
      render: (value: string) => (
        <span className="font-mono text-sm font-medium">{value}</span>
      )
    },
    {
      key: 'userId',
      header: 'Guest',
      render: (value: unknown) => (
        <div>
          <div className="font-medium">{value?.name || 'Unknown Guest'}</div>
          <div className="text-sm text-gray-500">{value?.email || 'No email'}</div>
        </div>
      )
    },
    {
      key: 'rooms',
      header: 'Rooms',
      render: (value: unknown[]) => (
        <div className="space-y-1">
          {value && Array.isArray(value) ? value.map((room, index) => (
            <div key={`value-${index}`} className="text-sm">
              {room?.roomId?.roomNumber || 'Unknown Room'} ({room?.roomId?.type || 'Unknown Type'})
            </div>
          )) : <div className="text-sm text-gray-500">No rooms</div>}
        </div>
      )
    },
    {
      key: 'checkIn',
      header: 'Check In',
      render: (value: string) => {
        if (!value) return <div className="text-sm text-gray-500">No date</div>;
        try {
          const d = parseISO(value);
          return <div className="text-sm">{isNaN(d.getTime()) ? 'Invalid date' : format(d, 'MMM dd, yyyy')}</div>;
        } catch {
          return <div className="text-sm text-gray-500">Invalid date</div>;
        }
      }
    },
    {
      key: 'checkOut',
      header: 'Check Out',
      render: (value: string) => {
        if (!value) return <div className="text-sm text-gray-500">No date</div>;
        try {
          const d = parseISO(value);
          return <div className="text-sm">{isNaN(d.getTime()) ? 'Invalid date' : format(d, 'MMM dd, yyyy')}</div>;
        } catch {
          return <div className="text-sm text-gray-500">Invalid date</div>;
        }
      }
    },
    {
      key: 'nights',
      header: 'Nights',
      render: (value: number) => (
        <span className="text-sm font-medium">{value || 0}</span>
      ),
      align: 'center' as const
    },
    {
      key: 'totalAmount',
      header: 'Total',
      render: (value: number, row: AdminBooking) => (
        <div className="text-sm font-medium">
          {formatCurrency(value || 0, row?.currency || 'USD')}
        </div>
      ),
      align: 'right' as const
    },
    {
      key: 'status',
      header: 'Status',
      render: (value: string) => (
        <StatusBadge status={value} variant="pill" size="sm" />
      )
    },
    {
      key: 'paymentStatus',
      header: 'Payment',
      render: (value: string) => (
        <StatusBadge 
          status={value} 
          variant="pill" 
          size="sm"
          className={value === 'paid' ? 'bg-green-100 text-green-800' : 'bg-yellow-100 text-yellow-800'}
        />
      )
    },
    {
      key: 'actions',
      header: 'Actions',
      render: (value: unknown, row: AdminBooking) => (
        <div className="flex items-center space-x-2">
          <Button
            variant="ghost"
            size="sm"
            onClick={() => {
              setSelectedBooking(row);
              setShowDetailsModal(true);
            }}
          >
            <Eye className="h-4 w-4" />
          </Button>
          <Button
            variant="ghost"
            size="sm"
            onClick={() => handlePriceAdjustment(row)}
            title="Adjust Price"
          >
            <DollarSign className="h-4 w-4 text-green-600" />
          </Button>
          {row.status === 'pending' && (
            <>
              <Button
                variant="ghost"
                size="sm"
                onClick={() => handleStatusUpdate(row._id, 'confirmed')}
                disabled={updating}
              >
                <CheckCircle className="h-4 w-4 text-green-600" />
              </Button>
              <Button
                variant="ghost"
                size="sm"
                onClick={() => handleCancelBooking(row._id)}
                disabled={updating}
              >
                <X className="h-4 w-4 text-red-600" />
              </Button>
            </>
          )}
          {row.status === 'confirmed' && (
            <>
              <Button
                variant="ghost"
                size="sm"
                onClick={() => handleCheckIn(row)}
                disabled={updating}
                title="Check In"
              >
                <UserCheck className="h-4 w-4 text-blue-600" />
              </Button>
              <Button
                variant="ghost"
                size="sm"
                onClick={() => handleNoShow(row)}
                disabled={updating}
                title="Mark as No-Show"
              >
                <AlertTriangle className="h-4 w-4 text-orange-600" />
              </Button>
            </>
          )}
          {(row.status === 'pending') && (
            <Button
              variant="ghost"
              size="sm"
              onClick={() => handleNoShow(row)}
              disabled={updating}
              title="Mark as No-Show"
            >
              <AlertTriangle className="h-4 w-4 text-orange-600" />
            </Button>
          )}
          {row.status === 'checked_in' && (
            <Button
              variant="ghost"
              size="sm"
              onClick={() => handleCheckOut(row)}
              disabled={updating}
              title="Check Out"
            >
              <UserX className="h-4 w-4 text-gray-600" />
            </Button>
          )}
        </div>
      ),
      align: 'center' as const
    }
  ];

  // No property selected — show a helpful message instead of an empty table
  if (!activeHotelId) {
    return (
      <div className="space-y-4 sm:space-y-6">
        <PropertyBreadcrumb items={['Bookings']} />
        <div>
          <h1 className="text-xl sm:text-2xl font-bold text-gray-900">Booking Management</h1>
          <p className="text-gray-600 text-sm sm:text-base">Manage all hotel bookings and reservations</p>
        </div>
        <div className="bg-yellow-50 border-l-4 border-yellow-400 p-4 rounded-lg">
          <div className="flex items-center">
            <AlertCircle className="h-5 w-5 text-yellow-400 mr-3" />
            <p className="text-sm font-medium text-yellow-800">
              Please select a property to view bookings.
            </p>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-4 sm:space-y-6">
      {/* Breadcrumb */}
      <PropertyBreadcrumb items={['Bookings']} />

      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <h1 className="text-xl sm:text-2xl font-bold text-gray-900">Booking Management</h1>
          <p className="text-gray-600 text-sm sm:text-base">Manage all hotel bookings and reservations</p>
        </div>
        <div className="flex flex-col sm:flex-row items-stretch sm:items-center gap-2 sm:gap-3">
          <Button
            onClick={() => setShowWalkInModal(true)}
            className="bg-green-600 hover:bg-green-700 text-white"
          >
            <UserPlus className="h-4 w-4 mr-2" />
            Walk-in Booking
          </Button>
          <Button
            onClick={() => setShowCreateModal(true)}
            className="bg-blue-600 hover:bg-blue-700 text-white hidden"
          >
            <Plus className="h-4 w-4 mr-2" />
            Create Booking
          </Button>
          <Button
            variant="ghost"
            onClick={() => setShowFilters(!showFilters)}
          >
            <Filter className="h-4 w-4 mr-2" />
            Filters
          </Button>
        </div>
      </div>

      {/* Stats Cards */}
      {stats && (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4 sm:gap-6">
          <Card>
            <CardContent className="p-4 sm:p-6">
              <div className="flex items-center">
                <div className="p-2 bg-blue-100 rounded-lg">
                  <Calendar className="h-6 w-6 text-blue-600" />
                </div>
                <div className="ml-4">
                  <p className="text-sm font-medium text-gray-600">Total Bookings</p>
                  <p className="text-2xl font-bold text-gray-900">{formatNumber(stats.total)}</p>
                </div>
              </div>
            </CardContent>
          </Card>

          {/* Total Revenue Card - HIDDEN for FrontDesk */}

          <Card>
            <CardContent className="p-4 sm:p-6">
              <div className="flex items-center">
                <div className="p-2 bg-yellow-100 rounded-lg">
                  <Clock className="h-6 w-6 text-yellow-600" />
                </div>
                <div className="ml-4">
                  <p className="text-sm font-medium text-gray-600">Pending</p>
                  <p className="text-2xl font-bold text-gray-900">{formatNumber(stats.pending)}</p>
                </div>
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardContent className="p-4 sm:p-6">
              <div className="flex items-center">
                <div className="p-2 bg-purple-100 rounded-lg">
                  <TrendingUp className="h-6 w-6 text-purple-600" />
                </div>
                <div className="ml-4">
                  <p className="text-sm font-medium text-gray-600">Avg. Booking Value</p>
                  <p className="text-2xl font-bold text-gray-900">{formatCurrency(stats.averageBookingValue, 'INR')}</p>
                </div>
              </div>
            </CardContent>
          </Card>
        </div>
      )}


      {/* Filters */}
      {showFilters && (
        <Card>
          <CardHeader>
            <CardTitle>Filters</CardTitle>
          </CardHeader>
          <CardContent className="p-4 sm:p-6">
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Status</label>
                <select
                  className="w-full border border-gray-300 rounded-md px-3 py-2"
                  value={filters.status || ''}
                  onChange={(e) => setFilters({ ...filters, status: e.target.value || undefined, page: 1 })}
                >
                  <option value="">All Statuses</option>
                  <option value="pending">Pending</option>
                  <option value="confirmed">Confirmed</option>
                  <option value="checked_in">Checked In</option>
                  <option value="checked_out">Checked Out</option>
                  <option value="cancelled">Cancelled</option>
                  <option value="no_show">No Show</option>
                </select>
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Payment Status</label>
                <select
                  className="w-full border border-gray-300 rounded-md px-3 py-2"
                  value={filters.paymentStatus || ''}
                  onChange={(e) => setFilters({ ...filters, paymentStatus: e.target.value || undefined, page: 1 })}
                >
                  <option value="">All Payment Statuses</option>
                  <option value="pending">Pending</option>
                  <option value="partially_paid">Partially Paid</option>
                  <option value="paid">Paid</option>
                  <option value="refunded">Refunded</option>
                  <option value="failed">Failed</option>
                </select>
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Source</label>
                <select
                  className="w-full border border-gray-300 rounded-md px-3 py-2"
                  value={filters.source || ''}
                  onChange={(e) => setFilters({ ...filters, source: e.target.value || undefined, page: 1 })}
                >
                  <option value="">All Sources</option>
                  <option value="direct">Direct</option>
                  <option value="booking_com">Booking.com</option>
                  <option value="expedia">Expedia</option>
                  <option value="airbnb">Airbnb</option>
                </select>
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Check-in Date</label>
                <Input
                  type="date"
                  value={filters.checkIn || ''}
                  onChange={(e) => setFilters({ ...filters, checkIn: e.target.value || undefined, page: 1 })}
                />
              </div>
            </div>
          </CardContent>
        </Card>
      )}

      {/* Search and Controls */}
      <Card>
        <CardContent className="p-4 sm:p-6">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
            <div className="flex-1 max-w-md">
              <div className="relative">
                <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400 h-4 w-4" />
                <Input
                  type="text"
                  placeholder="Search bookings by guest name, email, or booking number..."
                  value={filters.search || ''}
                  onChange={(e) => setFilters({ ...filters, search: e.target.value || undefined, page: 1 })}
                  className="pl-10 pr-4 py-3 border-2 border-gray-200 rounded-lg focus:border-blue-500 focus:ring-2 focus:ring-blue-200 transition-all duration-200"
                />
              </div>
            </div>
            
            <div className="flex items-center gap-3">
              {/* Results per page */}
              <div className="flex items-center gap-2">
                <span className="text-sm text-gray-600 whitespace-nowrap">Show:</span>
                <select
                  className="border border-gray-300 rounded-lg px-3 py-2 text-sm focus:border-blue-500 focus:ring-2 focus:ring-blue-200 transition-all duration-200"
                  value={filters.limit || 50}
                  onChange={(e) => setFilters({ ...filters, limit: parseInt(e.target.value), page: 1 })}
                >
                  <option value={10}>10</option>
                  <option value={25}>25</option>
                  <option value={50}>50</option>
                  <option value={100}>100</option>
                </select>
              </div>
              
              {/* Export button */}
              <Button
                variant="outline"
                className="whitespace-nowrap border-2 hover:border-blue-500 hover:bg-blue-50"
                onClick={() => toast('Export feature coming soon', { icon: 'ℹ️' })}
              >
                Export
              </Button>
            </div>
          </div>
          
          {/* Results info */}
          <div className="mt-4 pt-4 border-t border-gray-100">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
              <div className="text-sm text-gray-600">
                Showing <span className="font-medium text-gray-900">
                  {pagination.total > 0 ? ((pagination.current - 1) * (filters.limit || 50)) + 1 : 0}
                </span> to <span className="font-medium text-gray-900">
                  {Math.min(pagination.current * (filters.limit || 50), pagination.total)}
                </span> of <span className="font-medium text-gray-900">{pagination.total}</span> bookings
              </div>
              
              {/* Modern Pagination */}
              <div className="flex items-center gap-2">
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => setFilters({ ...filters, page: Math.max(1, (filters.page || 1) - 1) })}
                  disabled={pagination.current === 1}
                  className="border-2 hover:border-blue-500 hover:bg-blue-50 disabled:opacity-50 disabled:cursor-not-allowed"
                >
                  <span className="sr-only">Previous page</span>
                  ←
                </Button>
                
                {/* Page numbers */}
                <div className="flex items-center gap-1">
                  {[...Array(Math.min(5, pagination.pages))].map((_, i) => {
                    const pageNum = Math.max(1, pagination.current - 2) + i;
                    if (pageNum > pagination.pages) return null;
                    
                    return (
                      <Button
                        key={pageNum}
                        variant={pageNum === pagination.current ? "default" : "outline"}
                        size="sm"
                        onClick={() => setFilters({ ...filters, page: pageNum })}
                        className={pageNum === pagination.current 
                          ? "bg-blue-600 text-white border-blue-600 hover:bg-blue-700" 
                          : "border-2 hover:border-blue-500 hover:bg-blue-50"
                        }
                      >
                        {pageNum}
                      </Button>
                    );
                  })}
                  
                  {pagination.pages > 5 && pagination.current < pagination.pages - 2 && (
                    <>
                      <span className="text-gray-400 px-1">…</span>
                      <Button
                        variant="outline"
                        size="sm"
                        onClick={() => setFilters({ ...filters, page: pagination.pages })}
                        className="border-2 hover:border-blue-500 hover:bg-blue-50"
                      >
                        {pagination.pages}
                      </Button>
                    </>
                  )}
                </div>
                
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => setFilters({ ...filters, page: Math.min(pagination.pages, (filters.page || 1) + 1) })}
                  disabled={pagination.current === pagination.pages}
                  className="border-2 hover:border-blue-500 hover:bg-blue-50 disabled:opacity-50 disabled:cursor-not-allowed"
                >
                  <span className="sr-only">Next page</span>
                  →
                </Button>
              </div>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Bookings Table */}
      <DataTable
        title="All Bookings"
        data={bookings}
        columns={columns}
        loading={loading}
        searchable={false}
        pagination={false}
        emptyMessage="No bookings found"
        onRowClick={(booking) => {
          setSelectedBooking(booking);
          setShowDetailsModal(true);
        }}
      />

      {/* Booking Details Modal */}
      {selectedBooking && (
        <Modal
          isOpen={showDetailsModal}
          onClose={() => {
            setShowDetailsModal(false);
            setSelectedBooking(null);
          }}
          title={`Booking Details - ${selectedBooking.bookingNumber}`}
        >
          <div className="space-y-6">
            {/* Basic Info */}
            <div className="grid grid-cols-2 gap-4">
              <div>
                <h3 className="text-sm font-medium text-gray-500">Guest</h3>
                <p className="text-sm text-gray-900">{selectedBooking.userId?.name || 'Guest name not available'}</p>
                <p className="text-sm text-gray-600">{selectedBooking.userId?.email || 'Email not available'}</p>
                {selectedBooking.userId?.phone && (
                  <p className="text-sm text-gray-600">{selectedBooking.userId.phone}</p>
                )}
              </div>
              <div>
                <h3 className="text-sm font-medium text-gray-500">Hotel</h3>
                <p className="text-sm text-gray-900">
                  {selectedBooking.hotelId?.name || 'Hotel name not available'}
                </p>
                {selectedBooking.hotelId?.address && typeof selectedBooking.hotelId.address === 'object' && (
                  <p className="text-sm text-gray-600">
                    {selectedBooking.hotelId.address.street}, {selectedBooking.hotelId.address.city}, {selectedBooking.hotelId.address.state}
                  </p>
                )}
              </div>
            </div>

            {/* Dates */}
            <div className="grid grid-cols-2 gap-4">
              <div>
                <h3 className="text-sm font-medium text-gray-500">Check In</h3>
                <p className="text-sm text-gray-900">
                  {(() => { try { return selectedBooking.checkIn ? format(parseISO(selectedBooking.checkIn), 'EEEE, MMMM dd, yyyy') : 'N/A'; } catch { return 'Invalid date'; } })()}
                </p>
                {selectedBooking.checkInTime && (
                  <p className="text-sm text-gray-600">
                    Time: {(() => { try { return format(parseISO(selectedBooking.checkInTime), 'HH:mm'); } catch { return 'N/A'; } })()}
                  </p>
                )}
              </div>
              <div>
                <h3 className="text-sm font-medium text-gray-500">Check Out</h3>
                <p className="text-sm text-gray-900">
                  {(() => { try { return selectedBooking.checkOut ? format(parseISO(selectedBooking.checkOut), 'EEEE, MMMM dd, yyyy') : 'N/A'; } catch { return 'Invalid date'; } })()}
                </p>
                {selectedBooking.checkOutTime && (
                  <p className="text-sm text-gray-600">
                    Time: {(() => { try { return format(parseISO(selectedBooking.checkOutTime), 'HH:mm'); } catch { return 'N/A'; } })()}
                  </p>
                )}
              </div>
            </div>

            {/* Rooms */}
            <div>
              <h3 className="text-sm font-medium text-gray-500 mb-2">Rooms</h3>
              <div className="space-y-2">
                {selectedBooking.rooms && selectedBooking.rooms.length > 0 ? (
                  selectedBooking.rooms.map((room, index) => (
                    <div key={room.roomId?._id || `room-${index}`} className="flex justify-between items-center p-3 bg-gray-50 rounded-lg">
                      <div>
                        <p className="text-sm font-medium">{room.roomId?.roomNumber || 'Room number not available'}</p>
                        <p className="text-sm text-gray-600">{room.roomId?.type || 'Room type not available'}</p>
                      </div>
                      <p className="text-sm font-medium">
                        {formatCurrency(room.rate, selectedBooking.currency)}/night
                      </p>
                    </div>
                  ))
                ) : (
                  <p className="text-sm text-gray-500">No rooms assigned</p>
                )}
              </div>
            </div>

            {/* Guest Details */}
            <div>
              <h3 className="text-sm font-medium text-gray-500 mb-2">Guest Details</h3>
              {selectedBooking.guestDetails ? (
                <>
                  <div className="grid grid-cols-2 gap-4">
                    <div>
                      <p className="text-sm text-gray-600">Adults</p>
                      <p className="text-sm font-medium">{selectedBooking.guestDetails.adults || 0}</p>
                    </div>
                    <div>
                      <p className="text-sm text-gray-600">Children</p>
                      <p className="text-sm font-medium">{selectedBooking.guestDetails.children || 0}</p>
                    </div>
                  </div>
                  {selectedBooking.guestDetails.specialRequests && (
                    <div className="mt-2">
                      <p className="text-sm text-gray-600">Special Requests</p>
                      <p className="text-sm text-gray-900">{selectedBooking.guestDetails.specialRequests}</p>
                    </div>
                  )}
                </>
              ) : (
                <p className="text-sm text-gray-500">Guest details not available</p>
              )}
            </div>

            {/* Extras */}
            {selectedBooking.extras && selectedBooking.extras.length > 0 && (
              <div>
                <h3 className="text-sm font-medium text-gray-500 mb-2">Extras</h3>
                <div className="space-y-2">
                  {selectedBooking.extras.map((extra, index) => (
                    <div key={`selectedBooking-extras-${index}-${extra.name}`} className="flex justify-between items-center">
                      <span className="text-sm">{extra.name} (x{extra.quantity})</span>
                      <span className="text-sm font-medium">
                        {formatCurrency(extra.price * extra.quantity, selectedBooking.currency)}
                      </span>
                    </div>
                  ))}
                </div>
              </div>
            )}

            {/* Financial Info */}
            <div className="border-t pt-4">
              <div className="space-y-3">
                {/* Total Amount with Edit Button */}
                <div className="flex justify-between items-center">
                  <span className="text-lg font-medium">Total Amount</span>
                  <div className="flex items-center gap-3">
                    <span className="text-lg font-bold">
                      {formatCurrency(selectedBooking.totalAmount, selectedBooking.currency)}
                    </span>
                    <Button
                      variant="ghost"
                      size="sm"
                      onClick={() => {
                        setSelectedBookingForPriceAdjustment(selectedBooking);
                        setShowPriceAdjustmentModal(true);
                      }}
                      className="bg-green-50 hover:bg-green-100 text-green-700 border border-green-200"
                      title="Adjust Price"
                    >
                      <DollarSign className="h-4 w-4 mr-1" />
                      Edit Price
                    </Button>
                  </div>
                </div>

                {/* Show price adjustment indicator if booking has adjustments */}
                {selectedBooking.priceAdjustments?.length > 0 && (
                  <div className="bg-blue-50 border border-blue-200 rounded-lg p-3">
                    <div className="flex items-center gap-2 mb-2">
                      <DollarSign className="h-4 w-4 text-blue-600" />
                      <span className="text-sm font-medium text-blue-900">Price Adjusted</span>
                    </div>
                    <div className="space-y-1 text-sm">
                      <div className="flex justify-between">
                        <span className="text-gray-600">Original Price:</span>
                        <span className="line-through text-gray-500">
                          {formatCurrency(selectedBooking.originalAmount || selectedBooking.priceAdjustments?.[0]?.previousAmount || selectedBooking.totalAmount, selectedBooking.currency)}
                        </span>
                      </div>
                      {selectedBooking.discountAmount && selectedBooking.discountAmount > 0 && (
                        <div className="flex justify-between">
                          <span className="text-gray-600">Discount:</span>
                          <span className="text-green-600 font-medium">
                            -{formatCurrency(selectedBooking.discountAmount, selectedBooking.currency)}
                          </span>
                        </div>
                      )}
                      {selectedBooking.surchargeAmount && selectedBooking.surchargeAmount > 0 && (
                        <div className="flex justify-between">
                          <span className="text-gray-600">Surcharge:</span>
                          <span className="text-red-600 font-medium">
                            +{formatCurrency(selectedBooking.surchargeAmount, selectedBooking.currency)}
                          </span>
                        </div>
                      )}
                    </div>
                  </div>
                )}

                <div className="flex justify-between items-center">
                  <span className="text-sm text-gray-600">Payment Status</span>
                  <StatusBadge status={selectedBooking.paymentStatus} variant="pill" size="sm" />
                </div>
                <div className="flex justify-between items-center">
                  <span className="text-sm text-gray-600">Booking Status</span>
                  <StatusBadge status={selectedBooking.status} variant="pill" size="sm" />
                </div>
              </div>
            </div>

            {/* Payment Details */}
            {selectedBooking.paymentDetails && selectedBooking.paymentDetails.paymentMethods && selectedBooking.paymentDetails.paymentMethods.length > 0 && (
              <div className="border-t pt-4">
                <h3 className="text-sm font-medium text-gray-500 mb-3">Payment Details</h3>
                <div className="space-y-2">
                  {selectedBooking.paymentDetails.paymentMethods.map((payment: Record<string, unknown>, index: number) => (
                    <div key={`payment-${index}-${payment.method}`} className="flex justify-between items-center p-2 bg-gray-50 rounded">
                      <div>
                        <span className="text-sm font-medium capitalize">{payment.method}</span>
                        {payment.reference && (
                          <span className="text-xs text-gray-500 ml-2">({payment.reference})</span>
                        )}
                      </div>
                      <span className="text-sm font-medium">
                        {formatCurrency(payment.amount, selectedBooking.currency)}
                      </span>
                    </div>
                  ))}
                  <div className="flex justify-between items-center pt-2 border-t">
                    <span className="text-sm font-medium">Total Paid</span>
                    <span className="text-sm font-bold text-green-600">
                      {formatCurrency(selectedBooking.paymentDetails.totalPaid, selectedBooking.currency)}
                    </span>
                  </div>
                  {selectedBooking.paymentDetails.remainingAmount > 0 && (
                    <div className="flex justify-between items-center">
                      <span className="text-sm font-medium">Remaining</span>
                      <span className="text-sm font-bold text-red-600">
                        {formatCurrency(selectedBooking.paymentDetails.remainingAmount, selectedBooking.currency)}
                      </span>
                    </div>
                  )}
                </div>
              </div>
            )}

            {/* Actions */}
            <div className="border-t pt-4">
              <div className="flex items-center justify-between">
                <div className="text-sm text-gray-600">
                  Created: {(() => { try { return selectedBooking.createdAt ? format(parseISO(selectedBooking.createdAt), 'MMM dd, yyyy HH:mm') : 'N/A'; } catch { return 'N/A'; } })()}
                </div>
                <div className="flex space-x-2">
                  {selectedBooking.status === 'pending' && (
                    <>
                      <Button
                        size="sm"
                        onClick={() => {
                          handleStatusUpdate(selectedBooking._id, 'confirmed');
                          setShowDetailsModal(false);
                        }}
                        disabled={updating}
                      >
                        Confirm
                      </Button>
                      <Button
                        variant="ghost"
                        size="sm"
                        onClick={() => {
                          handleCancelBooking(selectedBooking._id);
                          setShowDetailsModal(false);
                        }}
                        disabled={updating}
                      >
                        Cancel
                      </Button>
                    </>
                  )}
                  {selectedBooking.status === 'confirmed' && (
                    <Button
                      size="sm"
                      onClick={() => handleCheckIn(selectedBooking)}
                      disabled={updating}
                      className="bg-blue-600 hover:bg-blue-700"
                    >
                      Check In
                    </Button>
                  )}
                  {selectedBooking.status === 'checked_in' && (
                    <Button
                      size="sm"
                      onClick={() => handleCheckOut(selectedBooking)}
                      disabled={updating}
                      className="bg-green-600 hover:bg-green-700"
                    >
                      Check Out
                    </Button>
                  )}
                </div>
              </div>
            </div>
          </div>
        </Modal>
      )}

      {/* Create New Booking Modal */}
      <Modal
        isOpen={showCreateModal}
                 onClose={() => {
           setShowCreateModal(false);
           setCreateForm({
             hotelId: activeHotelId,
             userId: '',
             roomIds: [],
             checkIn: '',
             checkOut: '',
             guestDetails: {
               adults: 1,
               children: 0,
               specialRequests: ''
             },
             totalAmount: 0,
             currency: 'INR',
             paymentStatus: 'pending',
             status: 'pending'
           });
          setAvailableRooms([]);
          setUsers([]);
          setUserSearch('');
        }}
        title="Create New Booking"
        size="lg"
      >
        <div className="space-y-6">
          {/* Step 1: Guest Selection */}
          <div>
            <h3 className="text-lg font-medium text-gray-900 mb-3">Guest Information</h3>
            <div className="space-y-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Search Guest
                </label>
                <div className="relative">
                  <Search className="h-4 w-4 absolute left-3 top-3 text-gray-400" />
                  <Input
                    type="text"
                    value={userSearch}
                    onChange={(e) => setUserSearch(e.target.value)}
                    placeholder="Search guest by name or email"
                    className="pl-10"
                  />
                </div>
              </div>

              {users.length > 0 && (
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    Select Guest
                  </label>
                  <div className="max-h-40 overflow-y-auto border border-gray-300 rounded-md">
                    {users.map((user) => (
                      <div role="button" tabIndex={0}
                        key={user._id}
                        className={`p-3 cursor-pointer border-b border-gray-200 last:border-b-0 hover:bg-gray-50 ${
                          createForm.userId === user._id ? 'bg-blue-50 border-blue-200' : ''
                        }`}
                        onClick={() => setCreateForm(prev => ({ ...prev, userId: user._id }))}
                       onKeyDown={(e: React.KeyboardEvent) => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); const clickHandler = () => setCreateForm(prev => ({ ...prev, userId: user._id })); if (typeof clickHandler === 'function') { clickHandler(e as any); } } }}>
                        <div className="flex items-center">
                          <User className="h-4 w-4 text-gray-400 mr-2" />
                          <div>
                            <div className="font-medium text-sm">{user.name}</div>
                            <div className="text-xs text-gray-500">{user.email}</div>
                            {user.phone && (
                              <div className="text-xs text-gray-500">{user.phone}</div>
                            )}
                          </div>
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              )}
            </div>
          </div>

          {/* Step 2: Date Selection */}
          <div>
            <h3 className="text-lg font-medium text-gray-900 mb-3">Booking Dates</h3>
            <div className="grid grid-cols-2 gap-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Check-in Date
                </label>
                <Input
                  type="date"
                  value={createForm.checkIn}
                  onChange={(e) => setCreateForm(prev => ({ ...prev, checkIn: e.target.value }))}
                  min={new Date().toISOString().split('T')[0]}
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Check-out Date
                </label>
                <Input
                  type="date"
                  value={createForm.checkOut}
                  onChange={(e) => setCreateForm(prev => ({ ...prev, checkOut: e.target.value }))}
                  min={createForm.checkIn || new Date().toISOString().split('T')[0]}
                />
              </div>
            </div>
          </div>

          {/* Step 3: Room Selection */}
          {availableRooms.length > 0 && (
            <div>
              <h3 className="text-lg font-medium text-gray-900 mb-3">Available Rooms</h3>
              <div className="space-y-2 max-h-60 overflow-y-auto">
                {availableRooms.map((room) => (
                  <div role="button" tabIndex={0}
                    key={room._id}
                    className={`p-3 border rounded-lg cursor-pointer ${
                      createForm.roomIds.includes(room._id)
                        ? 'border-blue-500 bg-blue-50'
                        : 'border-gray-300 hover:border-gray-400'
                    }`}
                    onClick={() => {
                      setCreateForm(prev => ({
                        ...prev,
                        roomIds: prev.roomIds.includes(room._id)
                          ? prev.roomIds.filter(id => id !== room._id)
                          : [...prev.roomIds, room._id]
                      }));
                    }}
                   onKeyDown={(e: React.KeyboardEvent) => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); const clickHandler = () => {
                      setCreateForm(prev => ({
                        ...prev,
                        roomIds: prev.roomIds.includes(room._id)
                          ? prev.roomIds.filter(id => id !== room._id)
                          : [...prev.roomIds, room._id]
                      }));
                    }; if (typeof clickHandler === 'function') { clickHandler(e as any); } } }}>
                    <div className="flex justify-between items-center">
                      <div>
                        <div className="flex items-center">
                          <Home className="h-4 w-4 text-gray-400 mr-2" />
                          <span className="font-medium">Room {room.roomNumber}</span>
                        </div>
                        <div className="text-sm text-gray-600">
                          {room.type} • Floor {room.floor}
                        </div>
                        {room.amenities && room.amenities.length > 0 && (
                          <div className="text-xs text-gray-500 mt-1">
                            {room.amenities.slice(0, 3).join(', ')}
                            {room.amenities.length > 3 && ` +${room.amenities.length - 3} more`}
                          </div>
                        )}
                      </div>
                      <div className="text-right">
                        <div className="font-medium">
                          {formatCurrency(room.currentRate || 0, 'INR')}/night
                        </div>
                        <div className="text-xs text-gray-500">
                          Max {room.maxOccupancy} guests
                        </div>
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* Step 4: Guest Details */}
          <div>
            <h3 className="text-lg font-medium text-gray-900 mb-3">Guest Details</h3>
            <div className="grid grid-cols-2 gap-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Adults
                </label>
                <Input
                  type="number"
                  min="1"
                  value={createForm.guestDetails.adults}
                  onChange={(e) => setCreateForm(prev => ({
                    ...prev,
                    guestDetails: { ...prev.guestDetails, adults: parseInt(e.target.value) || 1 }
                  }))}
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Children
                </label>
                <Input
                  type="number"
                  min="0"
                  value={createForm.guestDetails.children}
                  onChange={(e) => setCreateForm(prev => ({
                    ...prev,
                    guestDetails: { ...prev.guestDetails, children: parseInt(e.target.value) || 0 }
                  }))}
                />
              </div>
            </div>
            <div className="mt-4">
              <label className="block text-sm font-medium text-gray-700 mb-1">
                Special Requests
              </label>
              <textarea
                className="w-full border border-gray-300 rounded-md px-3 py-2 text-sm"
                rows={3}
                value={createForm.guestDetails.specialRequests}
                onChange={(e) => setCreateForm(prev => ({
                  ...prev,
                  guestDetails: { ...prev.guestDetails, specialRequests: e.target.value }
                }))}
                placeholder="Any special requests or notes..."
              />
            </div>
          </div>

          {/* Step 6: Booking Configuration */}
          <div>
            <h3 className="text-lg font-medium text-gray-900 mb-3">Booking Configuration</h3>
            <div className="grid grid-cols-2 gap-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Booking Status
                </label>
                <select
                  className="w-full border border-gray-300 rounded-md px-3 py-2"
                  value={createForm.status}
                  onChange={(e) => setCreateForm(prev => ({ 
                    ...prev, 
                    status: e.target.value as 'pending' | 'confirmed' 
                  }))}
                >
                  <option value="pending">Pending</option>
                  <option value="confirmed">Confirmed</option>
                </select>
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Payment Status
                </label>
                <select
                  className="w-full border border-gray-300 rounded-md px-3 py-2"
                  value={createForm.paymentStatus}
                  onChange={(e) => setCreateForm(prev => ({ 
                    ...prev, 
                    paymentStatus: e.target.value as 'pending' | 'paid' 
                  }))}
                >
                  <option value="pending">Pending</option>
                  <option value="paid">Paid</option>
                </select>
              </div>
            </div>
          </div>

          {/* Total Amount Summary */}
          {createForm.totalAmount > 0 && (
            <div className="bg-gray-50 p-4 rounded-lg">
              <div className="flex justify-between items-center text-lg font-medium">
                <span>Total Amount</span>
                <span className="text-blue-600">
                  {formatCurrency(createForm.totalAmount, createForm.currency)}
                </span>
              </div>
              {createForm.checkIn && createForm.checkOut && (
                <div className="text-sm text-gray-600 mt-1">
                  {Math.ceil((new Date(createForm.checkOut).getTime() - new Date(createForm.checkIn).getTime()) / (1000 * 60 * 60 * 24))} nights • {createForm.roomIds.length} room{createForm.roomIds.length !== 1 ? 's' : ''}
                </div>
              )}
            </div>
          )}

          {/* Form Actions */}
          <div className="flex justify-end space-x-3 pt-6 border-t">
            <Button
              variant="outline"
              onClick={() => setShowCreateModal(false)}
              disabled={creating}
            >
              Cancel
            </Button>
            <Button
              onClick={handleCreateBooking}
              disabled={creating || !createForm.hotelId || !createForm.userId || createForm.roomIds.length === 0 || !createForm.checkIn || !createForm.checkOut}
              className="bg-blue-600 hover:bg-blue-700 text-white"
            >
              {creating ? 'Creating...' : 'Create Booking'}
            </Button>
          </div>
        </div>
      </Modal>

      {/* Room Assignment Modal */}
      {selectedBookingForRoomAssignment && (
        <Modal
          isOpen={showRoomAssignmentModal}
          onClose={() => {
            setShowRoomAssignmentModal(false);
            setSelectedBookingForRoomAssignment(null);
            setAvailableRoomsForAssignment([]);
            setSelectedRoomNumbers({});
          }}
          title="Assign Room Numbers"
          size="lg"
        >
          <div className="space-y-6">
            {/* Booking Details */}
            <div className="bg-gray-50 p-4 rounded-lg">
              <h3 className="text-lg font-medium text-gray-900 mb-3">
                Booking #{selectedBookingForRoomAssignment.bookingNumber}
              </h3>
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <span className="text-sm text-gray-600">Guest: </span>
                  <span className="font-medium">{selectedBookingForRoomAssignment.userId?.name || 'Unknown Guest'}</span>
                </div>
                <div>
                  <span className="text-sm text-gray-600">Dates: </span>
                  <span className="font-medium">
                    {(() => { try { return `${format(parseISO(selectedBookingForRoomAssignment.checkIn), 'MMM dd')} - ${format(parseISO(selectedBookingForRoomAssignment.checkOut), 'MMM dd')}`; } catch { return 'N/A'; } })()}
                  </span>
                </div>
              </div>
            </div>

            {/* Current Room Assignments */}
            <div>
              <h4 className="font-semibold text-gray-900 mb-3">Current Room Assignments</h4>
              <div className="bg-yellow-50 border border-yellow-200 rounded-lg p-4">
                {selectedBookingForRoomAssignment.rooms.length === 0 && !selectedBookingForRoomAssignment.roomType ? (
                  <div className="text-center text-yellow-700">
                    <div className="font-medium">Room - No Room Assigned Yet</div>
                    <div className="text-sm">No room type specified • Room number will be assigned below</div>
                  </div>
                ) : selectedBookingForRoomAssignment.rooms.length === 0 && selectedBookingForRoomAssignment.roomType ? (
                  <div className="text-center text-yellow-700">
                    <div className="font-medium">Room - No Room Assigned Yet</div>
                    <div className="text-sm capitalize">Room type: {selectedBookingForRoomAssignment.roomType} • Room number will be assigned below</div>
                  </div>
                ) : (
                  selectedBookingForRoomAssignment.rooms.map((room, index) => (
                    <div key={`selectedBookingForRoomAssignment-rooms-${index}-${room.roomId?.type || 'unknown'}`} className="flex justify-between items-center">
                      <div>
                        <div className="font-medium">Room {room.roomId?.roomNumber || 'N/A'}</div>
                        <div className="text-sm text-gray-600 capitalize">{room.roomId?.type || 'Unknown'}</div>
                      </div>
                      <div className="text-right">
                        <div className="font-medium">{formatCurrency(room.rate, selectedBookingForRoomAssignment.currency)}/night</div>
                      </div>
                    </div>
                  ))
                )}
              </div>
            </div>

            {/* Available Rooms for Assignment */}
            {availableRoomsForAssignment.length > 0 && (
              <div>
                <h4 className="font-semibold text-gray-900 mb-3">Available Rooms</h4>
                <div className="space-y-3 max-h-96 overflow-y-auto">
                  {/* Handle bookings with empty rooms array (room-type bookings or no rooms assigned) */}
                  {selectedBookingForRoomAssignment.rooms.length === 0 ? (
                    selectedBookingForRoomAssignment.roomType ? (
                      // If booking has roomType, filter by that type
                      <div className="border border-gray-200 rounded-lg p-4">
                        <h5 className="font-medium text-gray-900 mb-2 capitalize">
                          Assign {selectedBookingForRoomAssignment.roomType} Room
                        </h5>
                        <div className="grid grid-cols-2 md:grid-cols-3 gap-2">
                          {availableRoomsForAssignment
                            .filter(room => room.type === selectedBookingForRoomAssignment.roomType)
                            .map((room) => (
                              <button
                                key={room._id}
                                className={`p-3 border rounded-lg text-sm transition-colors ${
                                  selectedRoomNumbers.selectedRoomId === room._id
                                    ? 'border-blue-500 bg-blue-50 text-blue-700'
                                    : 'border-gray-300 hover:border-gray-400'
                                }`}
                                onClick={() => setSelectedRoomNumbers({
                                  selectedRoomId: room._id,
                                  selectedRoomType: room.type,
                                  general: room.roomNumber
                                })}
                              >
                                <div className="font-semibold">{room.roomNumber}</div>
                                <div className="text-xs capitalize">{room.type}</div>
                                <div className="text-xs text-gray-500">₹{room.baseRate}/night</div>
                              </button>
                            ))
                          }
                        </div>
                        {availableRoomsForAssignment.filter(room => room.type === selectedBookingForRoomAssignment.roomType).length === 0 && (
                          <div className="text-center py-4 text-gray-500">
                            No available {selectedBookingForRoomAssignment.roomType} rooms for the selected dates
                          </div>
                        )}
                      </div>
                    ) : (
                      // If booking has no roomType, show all available rooms grouped by type
                      <div className="space-y-4">
                        <div className="text-sm text-gray-600 mb-3">
                          Select a room for this booking:
                        </div>
                        {['single', 'double', 'suite', 'deluxe'].map(roomType => {
                          const roomsOfType = availableRoomsForAssignment.filter(room => room.type === roomType);
                          if (roomsOfType.length === 0) return null;
                          
                          return (
                            <div key={roomType} className="border border-gray-200 rounded-lg p-4">
                              <h5 className="font-medium text-gray-900 mb-2 capitalize">
                                {roomType} Rooms
                              </h5>
                              <div className="grid grid-cols-2 md:grid-cols-3 gap-2">
                                {roomsOfType.map((room) => (
                                  <button
                                    key={room._id}
                                    className={`p-3 border rounded-lg text-sm transition-colors ${
                                      selectedRoomNumbers.selectedRoomId === room._id
                                        ? 'border-blue-500 bg-blue-50 text-blue-700'
                                        : 'border-gray-300 hover:border-gray-400'
                                    }`}
                                    onClick={() => setSelectedRoomNumbers({
                                      selectedRoomId: room._id,
                                      selectedRoomType: room.type,
                                      general: room.roomNumber
                                    })}
                                  >
                                    <div className="font-semibold">{room.roomNumber}</div>
                                    <div className="text-xs capitalize">{room.type}</div>
                                    <div className="text-xs text-gray-500">₹{room.baseRate}/night</div>
                                  </button>
                                ))
                                }
                              </div>
                            </div>
                          );
                        })}
                      </div>
                    )
                  ) : (
                    // Handle existing bookings with specific rooms already assigned (traditional re-assignment)
                    selectedBookingForRoomAssignment.rooms.map((bookingRoom, index) => {
                      const bkRoomType = bookingRoom.roomId?.type || 'unknown';
                      return (
                      <div key={bookingRoom.roomId?._id || `booking-room-${index}`} className="border border-gray-200 rounded-lg p-4">
                        <h5 className="font-medium text-gray-900 mb-2 capitalize">
                          Assign {bkRoomType} Room
                        </h5>
                        <div className="grid grid-cols-2 md:grid-cols-3 gap-2">
                          {availableRoomsForAssignment
                            .filter(room => room.type === bkRoomType)
                            .map((room) => (
                              <button
                                key={room._id}
                                className={`p-3 border rounded-lg text-sm transition-colors ${
                                  selectedRoomNumbers[bkRoomType] === room.roomNumber
                                    ? 'border-blue-500 bg-blue-50 text-blue-700'
                                    : 'border-gray-300 hover:border-gray-400'
                                }`}
                                onClick={() => setSelectedRoomNumbers(prev => ({
                                  ...prev,
                                  [bkRoomType]: room.roomNumber
                                }))}
                              >
                                <div className="font-semibold">{room.roomNumber}</div>
                                <div className="text-xs capitalize">{room.type}</div>
                                <div className="text-xs text-gray-500">₹{room.baseRate}/night</div>
                              </button>
                            ))
                          }
                        </div>
                        {availableRoomsForAssignment.filter(room => room.type === bkRoomType).length === 0 && (
                          <div className="text-center py-4 text-gray-500">
                            No available {bkRoomType} rooms
                          </div>
                        )}
                      </div>
                    );})
                  )}
                </div>
              </div>
            )}

            {availableRoomsForAssignment.length === 0 && (
              <div className="text-center py-8 text-gray-500">
                <Building className="h-12 w-12 mx-auto mb-3 text-gray-400" />
                <p>No available rooms found for the booking dates</p>
              </div>
            )}
          </div>

          {/* Modal Actions */}
          <div className="flex justify-end space-x-3 pt-6 border-t mt-6">
            <Button
              variant="outline"
              onClick={() => {
                setShowRoomAssignmentModal(false);
                setSelectedBookingForRoomAssignment(null);
                setAvailableRoomsForAssignment([]);
                setSelectedRoomNumbers({});
              }}
            >
              Cancel
            </Button>
            <Button
              onClick={handleSubmitRoomAssignment}
              disabled={!selectedRoomNumbers.selectedRoomId}
              className="bg-green-600 hover:bg-green-700 text-white"
            >
              Assign Rooms
            </Button>
          </div>
        </Modal>
      )}

      {/* Walk-in Booking Modal */}
      <WalkInBooking
        isOpen={showWalkInModal}
        onClose={() => setShowWalkInModal(false)}
        onSuccess={() => {
          fetchBookings();
          fetchStats();
        }}
      />

      {/* Payment Collection Modal (for check-in) */}
      {selectedBookingForPayment && (
        <PaymentCollectionModal
          isOpen={showPaymentModal}
          onClose={() => {
            setShowPaymentModal(false);
            setSelectedBookingForPayment(null);
          }}
          onConfirm={handlePaymentCollection}
          totalAmount={selectedBookingForPayment.totalAmount}
          currency={selectedBookingForPayment.currency}
          bookingNumber={selectedBookingForPayment.bookingNumber}
        />
      )}

      {/* Checkout Payment Collection Modal (for checkout - BEFORE checkout API) */}
      {selectedBookingForCheckOut && (
        <PaymentCollectionModal
          isOpen={showCheckOutPaymentModal}
          onClose={() => {
            setShowCheckOutPaymentModal(false);
            setSelectedBookingForCheckOut(null);
          }}
          onConfirm={handleCheckOutPaymentCollection}
          totalAmount={selectedBookingForCheckOut.totalAmount}
          paidAmount={selectedBookingForCheckOut.paymentDetails?.totalPaid || 0}
          currency={selectedBookingForCheckOut.currency}
          bookingNumber={selectedBookingForCheckOut.bookingNumber}
          mode="checkout"
          onBypassCheckout={() => handleBypassCheckout(selectedBookingForCheckOut)}
        />
      )}

      {/* Bypass Checkout Confirmation Dialog - Enhanced */}
      {selectedBookingForBypass && (() => {
        const outstandingBalance = (selectedBookingForBypass.totalAmount || 0) - (selectedBookingForBypass.paymentDetails?.totalPaid || 0);
        const reasonTemplates = [
          'Corporate credit account',
          'Manager approval received',
          'Payment plan arranged',
          'VIP guest arrangement'
        ];

        return (
          <Modal
            isOpen={showBypassCheckoutDialog}
            onClose={() => {
              setShowBypassCheckoutDialog(false);
              setSelectedBookingForBypass(null);
              setBypassReason('');
              setBypassConfirmed(false);
            }}
            noPadding={true}
          >
            <div className="relative bg-white rounded-2xl shadow-2xl max-w-2xl w-full mx-auto overflow-hidden">
              {/* Gradient Header */}
              <div className="bg-gradient-to-r from-red-600 to-rose-700 p-8">
                <div className="flex items-center gap-4 text-white">
                  <div className="w-16 h-16 bg-white/20 rounded-full flex items-center justify-center flex-shrink-0">
                    <AlertCircle className="h-8 w-8 animate-pulse" />
                  </div>
                  <div>
                    <h2 className="text-2xl font-bold mb-1">Bypass Checkout Authorization</h2>
                    <p className="text-red-100 text-sm">Booking #{selectedBookingForBypass.bookingNumber}</p>
                  </div>
                </div>
              </div>

              <div className="p-8">
                {/* Enhanced Warning Section */}
                <div className="bg-gradient-to-br from-amber-50 to-orange-50 border-2 border-amber-300 rounded-xl p-6 mb-6 shadow-md">
                  <div className="flex gap-4">
                    <AlertCircle className="h-7 w-7 text-amber-600 flex-shrink-0 mt-1 animate-pulse" />
                    <div>
                      <h3 className="font-bold text-amber-900 text-lg mb-3">Critical Warning</h3>
                      <div className="mb-3">
                        <p className="text-amber-800 mb-2">Outstanding balance:</p>
                        <p className="text-3xl font-bold text-red-600">
                          ₹{outstandingBalance.toLocaleString('en-IN')}
                        </p>
                      </div>
                      <p className="text-amber-700 leading-relaxed">
                        Authorizing this bypass allows the guest to check out without settling this amount.
                        This action will be permanently recorded in the audit log with your credentials.
                      </p>
                    </div>
                  </div>
                </div>

                {/* Quick Reason Templates */}
                <div className="mb-6">
                  <Label className="text-sm font-semibold mb-3 block text-gray-700">
                    Quick Reason Templates
                  </Label>
                  <div className="grid grid-cols-2 gap-3">
                    {reasonTemplates.map((template) => (
                      <button aria-label={`Select reason: ${template}`}
                        key={template}
                        onClick={() => setBypassReason(template)}
                        className={`px-4 py-3 text-sm border-2 rounded-lg text-left transition-all duration-200 ${
                          bypassReason === template
                            ? 'border-blue-500 bg-blue-50 text-blue-900 font-medium'
                            : 'border-gray-300 hover:border-gray-400 hover:bg-gray-50 text-gray-700'
                        }`}
                      >
                        {template}
                      </button>
                    ))}
                  </div>
                </div>

                {/* Enhanced Reason Field */}
                <div className="mb-6">
                  <Label
                    htmlFor="bypassReason"
                    className="flex items-center gap-2 font-semibold mb-3 text-gray-800"
                  >
                    <FileText className="h-5 w-5 text-gray-600" />
                    Authorization Reason (Required)
                  </Label>
                  <Textarea
                    id="bypassReason"
                    value={bypassReason}
                    onChange={(e) => setBypassReason(e.target.value.slice(0, 500))}
                    rows={6}
                    maxLength={500}
                    className="w-full focus:ring-2 focus:ring-red-500 focus:border-red-500 transition-all"
                    placeholder="Enter detailed reason for bypass authorization. Include manager name, approval details, and payment arrangement specifics..."
                  />
                  <div className="flex justify-between mt-2 text-xs">
                    <span className={`${bypassReason.length < 20 ? 'text-red-500 font-medium' : 'text-gray-500'}`}>
                      {bypassReason.length < 20 ? `Minimum 20 characters required (${20 - bypassReason.length} more)` : 'Minimum met'}
                    </span>
                    <span className={`${bypassReason.length >= 500 ? 'text-red-500 font-medium' : 'text-gray-500'}`}>
                      {bypassReason.length}/500
                    </span>
                  </div>
                </div>

                {/* Confirmation Checkbox */}
                <div className="mb-6 bg-gray-50 border-2 border-gray-200 rounded-lg p-4">
                  <label className="flex items-start gap-3 cursor-pointer group">
                    <input
                      type="checkbox"
                      checked={bypassConfirmed}
                      onChange={(e) => setBypassConfirmed(e.target.checked)}
                      className="mt-1 h-5 w-5 text-red-600 focus:ring-red-500 focus:ring-2 rounded cursor-pointer"
                    />
                    <span className="text-sm text-gray-700 leading-relaxed select-none">
                      <strong className="text-gray-900">I confirm that this bypass is authorized</strong> and understand
                      that it will be permanently recorded in the audit trail with my user credentials and timestamp.
                    </span>
                  </label>
                </div>

                {/* Action Buttons */}
                <div className="flex flex-col sm:flex-row gap-4">
                  <Button
                    variant="outline"
                    onClick={() => {
                      setShowBypassCheckoutDialog(false);
                      setSelectedBookingForBypass(null);
                      setBypassReason('');
                      setBypassConfirmed(false);
                    }}
                    className="flex-1 h-12 text-base font-medium border-2 hover:bg-gray-50 transition-colors"
                    disabled={updating}
                  >
                    <X className="h-5 w-5 mr-2" />
                    Cancel
                  </Button>
                  <Button
                    variant="destructive"
                    onClick={confirmBypassCheckout}
                    disabled={!bypassConfirmed || bypassReason.length < 20 || updating}
                    className={`flex-1 h-12 text-base font-medium bg-gradient-to-r from-red-600 to-rose-700 hover:from-red-700 hover:to-rose-800 transition-all duration-200 ${
                      bypassConfirmed && bypassReason.length >= 20 && !updating
                        ? 'shadow-lg shadow-red-500/50 animate-pulse'
                        : ''
                    }`}
                  >
                    {updating ? (
                      <>
                        <Loader2 className="h-5 w-5 mr-2 animate-spin" />
                        Processing...
                      </>
                    ) : (
                      <>
                        <ShieldAlert className="h-5 w-5 mr-2" />
                        Authorize Bypass
                      </>
                    )}
                  </Button>
                </div>

                {/* Audit Trail Preview */}
                <div className="mt-6 p-4 bg-gray-50 rounded-lg border border-gray-200">
                  <p className="text-xs text-gray-600 font-semibold mb-2 flex items-center gap-2">
                    <FileText className="h-3.5 w-3.5" />
                    Audit Trail Preview - This action will be logged as:
                  </p>
                  <pre className="text-xs text-gray-700 whitespace-pre-wrap font-mono leading-relaxed">
{`Action: Bypass Checkout
Date/Time: ${new Date().toLocaleString('en-IN', {
  dateStyle: 'medium',
  timeStyle: 'short'
})}
Staff: ${user?.name || 'Unknown'} (${user?.email || 'N/A'})
Booking: #${selectedBookingForBypass.bookingNumber}
Guest: ${selectedBookingForBypass.userId?.name || 'Unknown Guest'}
Outstanding: ₹${outstandingBalance.toLocaleString('en-IN')}
Reason: ${bypassReason.substring(0, 80)}${bypassReason.length > 80 ? '...' : ''}`}
                  </pre>
                </div>
              </div>
            </div>
          </Modal>
        );
      })()}

      {/* Price Adjustment Modal */}
      {selectedBookingForPriceAdjustment && showPriceAdjustmentModal && (
        <PriceAdjustmentModal
          booking={selectedBookingForPriceAdjustment}
          onClose={() => {
            setShowPriceAdjustmentModal(false);
            setSelectedBookingForPriceAdjustment(null);
          }}
          onSuccess={handlePriceAdjustmentSuccess}
        />
      )}

      {/* No-Show Modal */}
      {selectedBookingForNoShow && showNoShowModal && (
        <NoShowModal
          isOpen={showNoShowModal}
          onClose={() => {
            setShowNoShowModal(false);
            setSelectedBookingForNoShow(null);
          }}
          booking={selectedBookingForNoShow}
          onSuccess={handleNoShowSuccess}
        />
      )}

      {/* Settlement Summary Modal */}
      {selectedBookingForSettlement && settlementData && showSettlementModal && (
        <Modal
          isOpen={showSettlementModal}
          onClose={() => {
            setShowSettlementModal(false);
            setSelectedBookingForSettlement(null);
            setSettlementData(null);
          }}
          title="Guest Checkout - Settlement Summary"
          size="lg"
        >
          <div className="space-y-6">
            {/* Booking Info */}
            <div className="bg-blue-50 border border-blue-200 rounded-lg p-4">
              <div className="flex items-center gap-2 mb-2">
                <CheckCircle className="w-5 h-5 text-blue-600" />
                <h3 className="font-semibold text-blue-900">Guest Checked Out Successfully</h3>
              </div>
              <p className="text-sm text-blue-700">
                Booking #{selectedBookingForSettlement.bookingNumber}
              </p>
            </div>

            {/* Settlement Details */}
            <div className="border rounded-lg p-4 space-y-3">
              <h3 className="font-semibold text-gray-900">Settlement Details</h3>

              <div className="space-y-2">
                <div className="flex justify-between py-2 border-b">
                  <span className="text-gray-600">Final Amount:</span>
                  <span className="font-bold text-gray-900">₹{settlementData.finalAmount.toLocaleString()}</span>
                </div>

                {settlementData.outstandingBalance > 0 && (
                  <div className="flex justify-between py-2 border-b bg-red-50 px-3 rounded">
                    <span className="text-red-700 font-medium">Outstanding Balance:</span>
                    <span className="font-bold text-red-700">₹{settlementData.outstandingBalance.toLocaleString()}</span>
                  </div>
                )}

                {settlementData.refundAmount > 0 && (
                  <div className="flex justify-between py-2 border-b bg-green-50 px-3 rounded">
                    <span className="text-green-700 font-medium">Refund Due:</span>
                    <span className="font-bold text-green-700">₹{settlementData.refundAmount.toLocaleString()}</span>
                  </div>
                )}
              </div>

              {/* Adjustments */}
              {settlementData.adjustments && settlementData.adjustments.length > 0 && (
                <div className="mt-4">
                  <h4 className="text-sm font-medium text-gray-700 mb-2">Adjustments:</h4>
                  <div className="space-y-1">
                    {settlementData.adjustments.map((adj, index) => (
                      <div key={`adj-${index}-${adj.type || ''}`} className="flex justify-between text-sm py-1">
                        <span className="text-gray-600">{adj.description || adj.type || 'Adjustment'}</span>
                        <span className="text-gray-900">₹{(adj.amount || 0).toLocaleString()}</span>
                      </div>
                    ))}
                  </div>
                </div>
              )}
            </div>

            {/* Action Buttons */}
            <div className="space-y-3">
              {settlementData.outstandingBalance > 0 && (
                <button
                  onClick={() => {
                    // Open payment modal
                    setSelectedBookingForPayment(selectedBookingForSettlement);
                    setShowPaymentModal(true);
                    setShowSettlementModal(false);
                  }}
                  className="w-full bg-blue-600 text-white px-6 py-3 rounded-lg hover:bg-blue-700 flex items-center justify-center gap-2 transition-colors"
                >
                  <DollarSign className="w-5 h-5" />
                  Collect Payment (₹{settlementData.outstandingBalance.toLocaleString()})
                </button>
              )}

              {settlementData.refundAmount > 0 && (
                <button
                  onClick={handleProcessRefund}
                  disabled={updating}
                  className="w-full bg-green-600 text-white px-6 py-3 rounded-lg hover:bg-green-700 flex items-center justify-center gap-2 transition-colors"
                >
                  <DollarSign className="w-5 h-5" />
                  {updating ? 'Processing Refund...' : `Process Refund (₹${settlementData.refundAmount.toLocaleString()})`}
                </button>
              )}

              {settlementData.outstandingBalance === 0 && settlementData.refundAmount === 0 && (
                <div className="bg-green-50 border border-green-200 rounded-lg p-4 text-center">
                  <div className="flex items-center justify-center gap-2 text-green-800">
                    <CheckCircle className="w-5 h-5" />
                    <span className="font-medium">Checkout Complete - Fully Settled</span>
                  </div>
                </div>
              )}

              <button
                onClick={() => {
                  setShowSettlementModal(false);
                  setSelectedBookingForSettlement(null);
                  setSettlementData(null);
                }}
                className="w-full bg-gray-200 text-gray-800 px-6 py-3 rounded-lg hover:bg-gray-300 transition-colors"
              >
                Close
              </button>
            </div>
          </div>
        </Modal>
      )}
    </div>
  );
}

export default withErrorBoundary(FrontDeskBookings, { level: 'page' });