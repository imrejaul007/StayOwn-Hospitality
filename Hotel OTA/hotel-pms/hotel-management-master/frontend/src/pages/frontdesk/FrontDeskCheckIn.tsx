/**
 * FrontDeskCheckIn — Self-service and assisted check-in for front desk staff.
 * Mirrors FrontDeskCheckout pattern.
 *
 * Features:
 * - Search bookings by ref, guest name, or phone
 * - View booking + room assignment
 * - Assign / confirm room number
 * - Record ID verification
 * - Trigger check-in (PATCH /bookings/:id/check-in on PMS backend)
 * - Show REZ / OTA / Hotel Brand coin balances at check-in
 */

import React, { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Input } from '@/components/ui/input';
import { LoadingSpinner } from '../../components/LoadingSpinner';
import { useProperty } from '../../context/PropertyContext';
import { api } from '../../services/api';
import toast from 'react-hot-toast';
import { format } from 'date-fns';
import {
  Search,
  CheckCircle,
  User,
  Calendar,
  Bed,
  CreditCard,
  Wallet,
  LogIn,
  Phone,
  ShieldCheck,
} from 'lucide-react';

interface CheckInBooking {
  _id: string;
  bookingRef: string;
  status: string;
  checkInDate: string;
  checkOutDate: string;
  numRooms: number;
  numGuests: number;
  roomType?: { name: string };
  assignedRooms?: string[];
  guest?: {
    firstName: string;
    lastName: string;
    email?: string;
    phone?: string;
    idVerified?: boolean;
    rezUserId?: string;
    otaUserId?: string;
  };
  otaCoinBalancePaise?: number;
  rezCoinBalancePaise?: number;
  hotelBrandCoinBalancePaise?: number;
}

const PAGE_LIMIT = 20;

export default function FrontDeskCheckIn() {
  const { selectedPropertyId } = useProperty();
  const queryClient = useQueryClient();

  const [search, setSearch] = useState('');
  const [selectedBooking, setSelectedBooking] = useState<CheckInBooking | null>(null);
  const [roomNumber, setRoomNumber] = useState('');
  const [idVerified, setIdVerified] = useState(false);
  const [notes, setNotes] = useState('');

  // Bookings due for check-in today or overdue
  const { data, isLoading, refetch } = useQuery({
    queryKey: ['frontdesk-checkin-bookings', selectedPropertyId, search],
    queryFn: async () => {
      const today = format(new Date(), 'yyyy-MM-dd');
      const res = await api.get('/bookings', {
        params: {
          hotelId: selectedPropertyId,
          status: 'confirmed',
          checkInDateFrom: new Date(Date.now() - 2 * 24 * 3600 * 1000).toISOString().split('T')[0],
          checkInDateTo: today,
          search: search || undefined,
          page: 1,
          limit: PAGE_LIMIT,
        },
      });
      return res.data;
    },
    enabled: !!selectedPropertyId,
  });

  const bookings: CheckInBooking[] = data?.data ?? [];

  // Fetch coin balances when a booking is selected
  const fetchCoinBalances = async (booking: CheckInBooking): Promise<CheckInBooking> => {
    if (!booking.guest?.rezUserId && !booking.guest?.otaUserId) return booking;
    try {
      const walletRes = await api.get('/booking-engine/ota-wallet', {
        params: { userId: booking.guest.otaUserId || booking.guest.rezUserId, hotelId: selectedPropertyId },
      });
      const w = walletRes.data?.data ?? {};
      return {
        ...booking,
        otaCoinBalancePaise: w.ota_coin_balance_paise ?? 0,
        rezCoinBalancePaise: w.rez_coin_balance_paise ?? 0,
        hotelBrandCoinBalancePaise: (w.hotel_brand_coins ?? []).find((hb: any) => hb.hotelId === selectedPropertyId)?.balancePaise ?? 0,
      };
    } catch {
      return booking;
    }
  };

  const handleSelectBooking = async (booking: CheckInBooking) => {
    const enriched = await fetchCoinBalances(booking);
    setSelectedBooking(enriched);
    setRoomNumber(enriched.assignedRooms?.[0] ?? '');
    setIdVerified(enriched.guest?.idVerified ?? false);
    setNotes('');
  };

  const checkInMutation = useMutation({
    mutationFn: async () => {
      if (!selectedBooking) return;
      await api.patch(`/bookings/${selectedBooking._id}/check-in`, {
        hotelId: selectedPropertyId,
        roomNumber: roomNumber.trim() || undefined,
        idVerified,
        notes: notes.trim() || undefined,
      });
    },
    onSuccess: () => {
      toast.success(`Check-in complete for ${selectedBooking?.guest?.firstName} ${selectedBooking?.guest?.lastName}`);
      queryClient.invalidateQueries({ queryKey: ['frontdesk-checkin-bookings'] });
      setSelectedBooking(null);
      refetch();
    },
    onError: (err: any) => {
      toast.error(err?.response?.data?.message || 'Check-in failed');
    },
  });

  return (
    <div className="space-y-6 p-4">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-xl font-bold text-gray-900 flex items-center gap-2">
            <LogIn className="w-5 h-5 text-cyan-600" />
            Check-In
          </h2>
          <p className="text-sm text-gray-500 mt-0.5">Process guest arrivals for today</p>
        </div>
        <Button variant="outline" size="sm" onClick={() => refetch()}>
          Refresh
        </Button>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Booking Search + List */}
        <Card>
          <CardHeader>
            <CardTitle className="text-base flex items-center gap-2">
              <Search className="w-4 h-4" />
              Arriving Guests
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="mb-4">
              <Input
                placeholder="Search by name, ref, or phone..."
                value={search}
                onChange={(e) => setSearch(e.target.value)}
              />
            </div>

            {isLoading ? (
              <div className="flex justify-center py-10">
                <LoadingSpinner />
              </div>
            ) : bookings.length === 0 ? (
              <div className="text-center py-10 text-gray-400">
                <Calendar className="w-10 h-10 mx-auto mb-2" />
                <p>No check-ins pending{search ? ` for "${search}"` : ' today'}</p>
              </div>
            ) : (
              <div className="space-y-2 max-h-[500px] overflow-y-auto">
                {bookings.map((b) => (
                  <button
                    key={b._id}
                    onClick={() => handleSelectBooking(b)}
                    className={`w-full text-left p-3 rounded-lg border transition-colors ${
                      selectedBooking?._id === b._id
                        ? 'border-cyan-500 bg-cyan-50'
                        : 'border-gray-200 hover:bg-gray-50'
                    }`}
                  >
                    <div className="flex items-center justify-between">
                      <div>
                        <p className="font-semibold text-gray-900 text-sm">
                          {b.guest?.firstName} {b.guest?.lastName}
                        </p>
                        <p className="text-xs text-gray-500 mt-0.5">
                          {b.bookingRef} · {b.roomType?.name ?? 'Room'} · {b.numGuests} guest{b.numGuests !== 1 ? 's' : ''}
                        </p>
                      </div>
                      <div className="text-right">
                        <Badge variant="info" className="text-xs">
                          Check-in: {b.checkInDate}
                        </Badge>
                        <p className="text-xs text-gray-400 mt-1">
                          {b.numRooms} room{b.numRooms !== 1 ? 's' : ''}
                        </p>
                      </div>
                    </div>
                  </button>
                ))}
              </div>
            )}
          </CardContent>
        </Card>

        {/* Check-In Form */}
        <Card>
          <CardHeader>
            <CardTitle className="text-base flex items-center gap-2">
              <CheckCircle className="w-4 h-4 text-green-600" />
              Check-In Details
            </CardTitle>
          </CardHeader>
          <CardContent>
            {!selectedBooking ? (
              <div className="text-center py-10 text-gray-400">
                <User className="w-10 h-10 mx-auto mb-2" />
                <p>Select a guest from the list</p>
              </div>
            ) : (
              <div className="space-y-4">
                {/* Guest info */}
                <div className="bg-gray-50 rounded-lg p-3">
                  <p className="font-bold text-gray-900">
                    {selectedBooking.guest?.firstName} {selectedBooking.guest?.lastName}
                  </p>
                  {selectedBooking.guest?.phone && (
                    <p className="text-sm text-gray-500 flex items-center gap-1 mt-1">
                      <Phone className="w-3 h-3" />{selectedBooking.guest.phone}
                    </p>
                  )}
                  <div className="flex flex-wrap gap-2 mt-2">
                    <span className="text-xs bg-blue-100 text-blue-700 rounded px-2 py-0.5">
                      {selectedBooking.checkInDate} → {selectedBooking.checkOutDate}
                    </span>
                    <span className="text-xs bg-gray-200 text-gray-700 rounded px-2 py-0.5">
                      {selectedBooking.roomType?.name ?? 'Room'} · {selectedBooking.numRooms} room{selectedBooking.numRooms !== 1 ? 's' : ''}
                    </span>
                  </div>
                </div>

                {/* REZ / OTA Coin Balances */}
                {(selectedBooking.otaCoinBalancePaise != null || selectedBooking.rezCoinBalancePaise != null) && (
                  <div className="bg-gradient-to-r from-cyan-50 to-purple-50 border border-cyan-100 rounded-lg p-3">
                    <p className="text-xs font-semibold text-gray-600 flex items-center gap-1 mb-2">
                      <Wallet className="w-3 h-3" /> Guest Loyalty Coins
                    </p>
                    <div className="flex gap-4 flex-wrap">
                      {(selectedBooking.otaCoinBalancePaise ?? 0) > 0 && (
                        <div className="text-center">
                          <p className="text-xs text-gray-500">OTA Coins</p>
                          <p className="font-bold text-cyan-600">₹{Math.round((selectedBooking.otaCoinBalancePaise!) / 100).toLocaleString()}</p>
                        </div>
                      )}
                      {(selectedBooking.rezCoinBalancePaise ?? 0) > 0 && (
                        <div className="text-center">
                          <p className="text-xs text-gray-500">REZ Coins</p>
                          <p className="font-bold text-purple-600">₹{Math.round((selectedBooking.rezCoinBalancePaise!) / 100).toLocaleString()}</p>
                        </div>
                      )}
                      {(selectedBooking.hotelBrandCoinBalancePaise ?? 0) > 0 && (
                        <div className="text-center">
                          <p className="text-xs text-gray-500">Hotel Coins</p>
                          <p className="font-bold text-amber-600">₹{Math.round((selectedBooking.hotelBrandCoinBalancePaise!) / 100).toLocaleString()}</p>
                        </div>
                      )}
                    </div>
                  </div>
                )}

                {/* Room assignment */}
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    <Bed className="w-3 h-3 inline mr-1" />
                    Room Number
                  </label>
                  <Input
                    placeholder="e.g. 204, 305A"
                    value={roomNumber}
                    onChange={(e) => setRoomNumber(e.target.value)}
                  />
                </div>

                {/* ID Verification */}
                <div className="flex items-center gap-3">
                  <input
                    type="checkbox"
                    id="idVerified"
                    checked={idVerified}
                    onChange={(e) => setIdVerified(e.target.checked)}
                    className="w-4 h-4 text-cyan-600 rounded"
                  />
                  <label htmlFor="idVerified" className="text-sm text-gray-700 flex items-center gap-1">
                    <ShieldCheck className="w-4 h-4 text-green-500" />
                    ID verified (passport, Aadhaar, driving license)
                  </label>
                </div>

                {/* Notes */}
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Check-In Notes (optional)</label>
                  <textarea
                    className="w-full border border-gray-200 rounded-lg p-2 text-sm resize-none"
                    rows={2}
                    placeholder="Special requests, early check-in, etc."
                    value={notes}
                    onChange={(e) => setNotes(e.target.value)}
                  />
                </div>

                {/* Submit */}
                <Button
                  className="w-full bg-cyan-600 hover:bg-cyan-700 text-white"
                  onClick={() => checkInMutation.mutate()}
                  disabled={checkInMutation.isLoading || !idVerified}
                >
                  {checkInMutation.isLoading ? (
                    <LoadingSpinner />
                  ) : (
                    <>
                      <CheckCircle className="w-4 h-4 mr-2" />
                      Complete Check-In
                    </>
                  )}
                </Button>
                {!idVerified && (
                  <p className="text-xs text-amber-600 flex items-center gap-1">
                    <CreditCard className="w-3 h-3" />
                    Please verify guest ID before check-in
                  </p>
                )}
              </div>
            )}
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
