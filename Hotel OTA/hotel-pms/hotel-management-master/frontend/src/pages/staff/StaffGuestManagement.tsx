import React, { useState, useCallback } from 'react';
import { useAuth } from '../../context/AuthContext';
import { api } from '../../services/api';
import { toast } from 'react-hot-toast';
import UserManagement from '../../components/user/UserManagement';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import {
  Search,
  User,
  Users,
  CreditCard,
  Edit,
  Star,
  ChevronLeft,
  ChevronRight,
  RefreshCw,
  AlertCircle,
} from 'lucide-react';
import { Modal } from '@/components/ui/Modal';
import { useQuery, keepPreviousData } from '@tanstack/react-query';
import { withErrorBoundary } from '../../components/ErrorBoundary';

interface GuestStats {
  bookings: {
    totalBookings: number;
    totalSpent: number;
    totalNights?: number;
    lastStay: string | null;
  };
  reviews: {
    totalReviews: number;
    averageRating: number;
  };
}

interface Guest {
  _id: string;
  name: string;
  email: string;
  phone?: string;
  role: string;
  guestType?: string;
  loyalty?: {
    tier?: 'bronze' | 'silver' | 'gold' | 'platinum' | 'diamond';
    points?: number;
  };
  billingDetails?: {
    gstNumber?: string;
    companyName?: string;
  };
  hasCompleteBillingInfo?: boolean;
  stats?: GuestStats;
}

interface GuestListResponse {
  status: string;
  results?: number;
  data: { guests: Guest[] };
  pagination: {
    current: number;
    pages: number;
    total: number;
  };
}

const PAGE_SIZE = 20;

const VIP_TIERS: Record<string, { label: string; color: string }> = {
  platinum: { label: 'Platinum', color: 'bg-purple-100 text-purple-800' },
  diamond:  { label: 'Diamond',  color: 'bg-blue-100 text-blue-800' },
  gold:     { label: 'Gold',     color: 'bg-yellow-100 text-yellow-800' },
  silver:   { label: 'Silver',   color: 'bg-gray-100 text-gray-700' },
  bronze:   { label: 'Bronze',   color: 'bg-orange-100 text-orange-700' },
};

const StaffGuestManagement: React.FC = () => {
  const { user } = useAuth();
  const [page, setPage] = useState(1);
  const [searchInput, setSearchInput] = useState('');
  // Debounced search term sent to backend
  const [searchTerm, setSearchTerm] = useState('');
  const [selectedGuest, setSelectedGuest] = useState<Guest | null>(null);
  const [showUserManagement, setShowUserManagement] = useState(false);

  const fetchGuests = useCallback(async (): Promise<GuestListResponse> => {
    const params = new URLSearchParams();
    params.append('page', String(page));
    params.append('limit', String(PAGE_SIZE));
    if (searchTerm) params.append('search', searchTerm);
    const response = await api.get<GuestListResponse>(`/guests?${params.toString()}`);
    return response.data;
  }, [page, searchTerm]);

  const { data, isLoading, isError, error, refetch } = useQuery<GuestListResponse, Error>({
    queryKey: ['staff-guests', page, searchTerm],
    queryFn: fetchGuests,
    placeholderData: keepPreviousData,
  });

  const guests = data?.data?.guests ?? [];
  const pagination = data?.pagination;
  const totalPages = pagination?.pages ?? 1;
  const totalCount = pagination?.total ?? 0;

  const handleSearchSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    setPage(1);
    setSearchTerm(searchInput.trim());
  };

  const handleSearchChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    setSearchInput(e.target.value);
    // Clear backend search immediately when field is emptied
    if (e.target.value === '') {
      setPage(1);
      setSearchTerm('');
    }
  };

  const handleEditGuest = (guest: Guest) => {
    setSelectedGuest(guest);
    setShowUserManagement(true);
  };

  const handleUserUpdate = () => {
    refetch();
    setShowUserManagement(false);
    setSelectedGuest(null);
  };

  const getLoyaltyBadge = (tier?: string) => {
    if (!tier || !VIP_TIERS[tier]) return null;
    const { label, color } = VIP_TIERS[tier];
    return (
      <span className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs font-medium ${color}`}>
        <Star className="w-3 h-3" />
        {label}
      </span>
    );
  };

  const isVip = (guest: Guest) =>
    guest.loyalty?.tier === 'platinum' || guest.loyalty?.tier === 'diamond';

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex justify-between items-center">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Guest Management</h1>
          <p className="text-gray-600 mt-1">Manage guest profiles and billing information</p>
        </div>
        <div className="flex items-center space-x-2">
          <Badge variant="secondary">
            <Users className="w-4 h-4 mr-1" />
            {totalCount} Guests
          </Badge>
          <Button size="sm" variant="outline" onClick={() => refetch()} disabled={isLoading}>
            <RefreshCw className={`h-4 w-4 mr-1 ${isLoading ? 'animate-spin' : ''}`} />
            Refresh
          </Button>
        </div>
      </div>

      {/* Search */}
      <Card>
        <CardContent className="p-4">
          <form onSubmit={handleSearchSubmit}>
            <div className="relative flex gap-2">
              <div className="relative flex-1">
                <Search className="absolute left-3 top-3 h-4 w-4 text-gray-400" />
                <Input
                  placeholder="Search guests by name, email, or phone..."
                  value={searchInput}
                  onChange={handleSearchChange}
                  className="pl-10"
                />
              </div>
              <Button type="submit" variant="outline" disabled={isLoading}>
                Search
              </Button>
            </div>
          </form>
        </CardContent>
      </Card>

      {/* Guests List */}
      <Card>
        <CardHeader>
          <CardTitle>
            Guest Directory
            {searchTerm && (
              <span className="ml-2 text-sm font-normal text-gray-500">
                — results for "{searchTerm}"
              </span>
            )}
          </CardTitle>
        </CardHeader>
        <CardContent>
          {isLoading ? (
            <div className="flex items-center justify-center py-12">
              <RefreshCw className="h-6 w-6 animate-spin text-blue-500" />
            </div>
          ) : isError ? (
            <div className="flex flex-col items-center justify-center py-12 text-gray-500">
              <AlertCircle className="h-10 w-10 text-red-400 mb-3" />
              <p className="font-medium text-red-600">Failed to load guests</p>
              <p className="text-sm mt-1 text-gray-500">
                {error instanceof Error ? error.message : 'An unexpected error occurred'}
              </p>
              <Button size="sm" variant="outline" className="mt-4" onClick={() => refetch()}>
                Retry
              </Button>
            </div>
          ) : guests.length === 0 ? (
            <div className="text-center py-8">
              <User className="w-12 h-12 text-gray-300 mx-auto mb-4" />
              <p className="text-gray-500">
                {searchTerm ? 'No guests found matching your search' : 'No guests found'}
              </p>
            </div>
          ) : (
            <>
              <div className="overflow-x-auto">
                <table className="min-w-full divide-y divide-gray-200">
                  <thead className="bg-gray-50">
                    <tr>
                      <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                        Guest
                      </th>
                      <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                        Contact
                      </th>
                      <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                        Type / Loyalty
                      </th>
                      <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                        Stay History
                      </th>
                      <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                        Billing Status
                      </th>
                      <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                        Actions
                      </th>
                    </tr>
                  </thead>
                  <tbody className="bg-white divide-y divide-gray-200">
                    {guests.map((guest) => (
                      <tr
                        key={guest._id}
                        className={`hover:bg-gray-50 ${isVip(guest) ? 'bg-purple-50/30' : ''}`}
                      >
                        <td className="px-6 py-4 whitespace-nowrap">
                          <div className="flex items-center">
                            <div
                              className={`w-10 h-10 rounded-full flex items-center justify-center ${
                                isVip(guest) ? 'bg-purple-100' : 'bg-blue-100'
                              }`}
                            >
                              <User
                                className={`w-5 h-5 ${isVip(guest) ? 'text-purple-600' : 'text-blue-600'}`}
                              />
                            </div>
                            <div className="ml-4">
                              <div className="flex items-center gap-2">
                                <span className="text-sm font-medium text-gray-900">
                                  {guest.name}
                                </span>
                                {getLoyaltyBadge(guest.loyalty?.tier)}
                              </div>
                              <div className="text-sm text-gray-500">ID: {guest._id.slice(-8)}</div>
                            </div>
                          </div>
                        </td>
                        <td className="px-6 py-4 whitespace-nowrap">
                          <div className="text-sm text-gray-900">{guest.email}</div>
                          <div className="text-sm text-gray-500">{guest.phone || 'No phone'}</div>
                        </td>
                        <td className="px-6 py-4 whitespace-nowrap">
                          <div className="flex flex-col gap-1">
                            <Badge
                              variant={guest.guestType === 'corporate' ? 'default' : 'secondary'}
                            >
                              {guest.guestType === 'corporate' ? 'Corporate' : 'Individual'}
                            </Badge>
                            {guest.loyalty?.points !== undefined && (
                              <span className="text-xs text-gray-500">
                                {guest.loyalty.points.toLocaleString()} pts
                              </span>
                            )}
                          </div>
                        </td>
                        <td className="px-6 py-4 whitespace-nowrap">
                          {guest.stats ? (
                            <div className="text-sm">
                              <span className="text-gray-900 font-medium">
                                {guest.stats.bookings.totalBookings} stay
                                {guest.stats.bookings.totalBookings !== 1 ? 's' : ''}
                              </span>
                              {guest.stats.bookings.lastStay && (
                                <div className="text-gray-500 text-xs">
                                  Last:{' '}
                                  {new Date(guest.stats.bookings.lastStay).toLocaleDateString()}
                                </div>
                              )}
                              {guest.stats.bookings.totalSpent > 0 && (
                                <div className="text-gray-500 text-xs">
                                  Spent: ₹{guest.stats.bookings.totalSpent.toLocaleString()}
                                </div>
                              )}
                            </div>
                          ) : (
                            <span className="text-sm text-gray-400">—</span>
                          )}
                        </td>
                        <td className="px-6 py-4 whitespace-nowrap">
                          <div className="flex items-center space-x-2">
                            {guest.hasCompleteBillingInfo ? (
                              <Badge
                                variant="default"
                                className="bg-green-100 text-green-800"
                              >
                                Complete
                              </Badge>
                            ) : guest.billingDetails?.gstNumber ||
                              guest.billingDetails?.companyName ? (
                              <Badge
                                variant="outline"
                                className="text-yellow-600 border-yellow-300"
                              >
                                Partial
                              </Badge>
                            ) : (
                              <Badge variant="outline" className="text-gray-600">
                                None
                              </Badge>
                            )}
                            {guest.billingDetails?.gstNumber && (
                              <CreditCard className="w-4 h-4 text-green-500" />
                            )}
                          </div>
                          {guest.billingDetails?.companyName && (
                            <div className="text-xs text-gray-500 mt-1">
                              {guest.billingDetails.companyName}
                            </div>
                          )}
                        </td>
                        <td className="px-6 py-4 whitespace-nowrap text-sm font-medium">
                          <div className="flex space-x-2">
                            <Button
                              size="sm"
                              variant="outline"
                              onClick={() => handleEditGuest(guest)}
                            >
                              <Edit className="w-4 h-4 mr-1" />
                              Edit Billing
                            </Button>
                          </div>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>

              {/* Pagination Controls */}
              {totalPages > 1 && (
                <div className="flex items-center justify-between mt-6 pt-4 border-t border-gray-100">
                  <p className="text-sm text-gray-500">
                    Page {page} of {totalPages} ({totalCount} guests total)
                  </p>
                  <div className="flex items-center gap-2">
                    <Button
                      size="sm"
                      variant="outline"
                      onClick={() => setPage((p) => p - 1)}
                      disabled={page <= 1 || isLoading}
                    >
                      <ChevronLeft className="h-4 w-4" />
                      Previous
                    </Button>
                    <Button
                      size="sm"
                      variant="outline"
                      onClick={() => setPage((p) => p + 1)}
                      disabled={page >= totalPages || isLoading}
                    >
                      Next
                      <ChevronRight className="h-4 w-4" />
                    </Button>
                  </div>
                </div>
              )}
            </>
          )}
        </CardContent>
      </Card>

      {/* User Management Modal */}
      {showUserManagement && selectedGuest && (
        <Modal
          isOpen={showUserManagement}
          onClose={() => {
            setShowUserManagement(false);
            setSelectedGuest(null);
          }}
          title={`Manage Guest - ${selectedGuest.name}`}
          size="lg"
        >
          <UserManagement
            userId={selectedGuest._id}
            currentUser={user}
            onUserUpdate={handleUserUpdate}
          />
        </Modal>
      )}
    </div>
  );
};

export default withErrorBoundary(StaffGuestManagement);
