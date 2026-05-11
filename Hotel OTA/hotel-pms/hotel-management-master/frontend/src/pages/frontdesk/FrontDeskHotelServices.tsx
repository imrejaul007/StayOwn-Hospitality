import React, { useState, useMemo } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import {
  Search,
  RefreshCw,
  Calendar,
  Users,
  Clock,
  MapPin,
  Phone,
  Mail,
  Star,
  ChevronLeft,
  ChevronRight,
  AlertTriangle,
  CheckCircle,
  XCircle,
  Info,
  Eye,
  BookOpen,
  X,
  DollarSign,
  Tag,
} from 'lucide-react';
import { cn } from '../../utils/cn';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Card, CardContent } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Tabs, TabsList, TabsTrigger, TabsContent } from '@/components/ui/tabs';
import { LoadingSpinner } from '../../components/LoadingSpinner';
import { PropertyBreadcrumb } from '../../components/common/PropertyBreadcrumb';
import { useProperty } from '../../context/PropertyContext';
import { formatCurrency } from '../../utils/formatters';
import {
  hotelServicesService,
  HotelService,
  ServiceBooking,
  ServiceType,
  AvailabilityCheck,
} from '../../services/hotelServicesService';
import toast from 'react-hot-toast';
import { withErrorBoundary } from '../../components/ErrorBoundary';

// ---------------------------------------------------------------------------
// Helper: error message extraction
// ---------------------------------------------------------------------------
const getErrorMessage = (error: unknown): string => {
  if (error instanceof Error) return error.message;
  if (typeof error === 'object' && error !== null && 'message' in error)
    return String((error as Record<string, unknown>).message);
  return 'An unexpected error occurred';
};

// ---------------------------------------------------------------------------
// Constants
// ---------------------------------------------------------------------------
const PAGE_SIZE = 12;

const SERVICE_TYPE_META: Record<string, { label: string; color: string; bg: string }> = {
  dining: { label: 'Dining', color: 'text-orange-700', bg: 'bg-orange-100' },
  spa: { label: 'Spa', color: 'text-pink-700', bg: 'bg-pink-100' },
  gym: { label: 'Gym', color: 'text-blue-700', bg: 'bg-blue-100' },
  transport: { label: 'Transport', color: 'text-green-700', bg: 'bg-green-100' },
  entertainment: { label: 'Entertainment', color: 'text-purple-700', bg: 'bg-purple-100' },
  business: { label: 'Business', color: 'text-gray-700', bg: 'bg-gray-200' },
  wellness: { label: 'Wellness', color: 'text-teal-700', bg: 'bg-teal-100' },
  recreation: { label: 'Recreation', color: 'text-indigo-700', bg: 'bg-indigo-100' },
};

const BOOKING_STATUS_META: Record<string, { label: string; variant: 'default' | 'success' | 'warning' | 'error' | 'info' }> = {
  pending: { label: 'Pending', variant: 'warning' },
  confirmed: { label: 'Confirmed', variant: 'info' },
  completed: { label: 'Completed', variant: 'success' },
  cancelled: { label: 'Cancelled', variant: 'error' },
};

// ---------------------------------------------------------------------------
// Main component
// ---------------------------------------------------------------------------
function FrontDeskHotelServices() {
  const { selectedPropertyId } = useProperty();
  const queryClient = useQueryClient();

  // -- Tab state
  const [activeTab, setActiveTab] = useState<string>('catalog');

  // -- Catalog filters
  const [searchTerm, setSearchTerm] = useState('');
  const [appliedSearch, setAppliedSearch] = useState('');
  const [typeFilter, setTypeFilter] = useState('');
  const [minPrice, setMinPrice] = useState('');
  const [maxPrice, setMaxPrice] = useState('');
  const [catalogPage, setCatalogPage] = useState(1);

  // -- Bookings filters
  const [bookingStatusFilter, setBookingStatusFilter] = useState('');
  const [bookingsPage, setBookingsPage] = useState(1);

  // -- Detail / booking modals
  const [selectedService, setSelectedService] = useState<HotelService | null>(null);
  const [showDetailModal, setShowDetailModal] = useState(false);
  const [showBookingModal, setShowBookingModal] = useState(false);
  const [showAvailabilityModal, setShowAvailabilityModal] = useState(false);

  // -- Booking form state
  const [bookingDate, setBookingDate] = useState('');
  const [bookingTime, setBookingTime] = useState('10:00');
  const [numberOfPeople, setNumberOfPeople] = useState(1);
  const [specialRequests, setSpecialRequests] = useState('');

  // -- Availability check state
  const [availDate, setAvailDate] = useState('');
  const [availPeople, setAvailPeople] = useState(1);

  // -- Refreshing
  const [refreshing, setRefreshing] = useState(false);

  // -----------------------------------------------------------------------
  // Queries
  // -----------------------------------------------------------------------

  // Service types
  const { data: serviceTypes } = useQuery<ServiceType[]>({
    queryKey: ['service-types'],
    queryFn: () => hotelServicesService.getServiceTypes(),
    staleTime: 10 * 60 * 1000,
  });

  // Paginated service catalog
  const {
    data: catalogData,
    isLoading: catalogLoading,
    isError: catalogError,
    error: catalogQueryError,
    refetch: refetchCatalog,
  } = useQuery({
    queryKey: [
      'frontdesk-hotel-services',
      {
        hotelId: selectedPropertyId,
        type: typeFilter,
        search: appliedSearch,
        minPrice: minPrice || undefined,
        maxPrice: maxPrice || undefined,
        page: catalogPage,
        limit: PAGE_SIZE,
      },
    ],
    queryFn: () =>
      hotelServicesService.getServicesWithPagination({
        hotelId: selectedPropertyId,
        type: typeFilter || undefined,
        search: appliedSearch || undefined,
        minPrice: minPrice ? Number(minPrice) : undefined,
        maxPrice: maxPrice ? Number(maxPrice) : undefined,
        page: catalogPage,
        limit: PAGE_SIZE,
      }),
    enabled: !!selectedPropertyId,
    staleTime: 30_000,
    placeholderData: (prev) => prev,
  });

  const services = catalogData?.services ?? [];
  const catalogPagination = catalogData?.pagination;

  // Bookings list
  const {
    data: bookingsData,
    isLoading: bookingsLoading,
    isError: bookingsError,
    error: bookingsQueryError,
    refetch: refetchBookings,
  } = useQuery({
    queryKey: [
      'frontdesk-service-bookings',
      { hotelId: selectedPropertyId, status: bookingStatusFilter, page: bookingsPage, limit: PAGE_SIZE },
    ],
    queryFn: () =>
      hotelServicesService.getUserBookings({
        hotelId: selectedPropertyId,
        status: bookingStatusFilter || undefined,
        page: bookingsPage,
        limit: PAGE_SIZE,
      }),
    enabled: !!selectedPropertyId,
    staleTime: 15_000,
    placeholderData: (prev) => prev,
  });

  const bookings = bookingsData?.bookings ?? [];
  const bookingsPagination = bookingsData?.pagination;

  // Availability check (on-demand)
  const {
    data: availabilityResult,
    isLoading: availabilityLoading,
    refetch: checkAvailability,
  } = useQuery<AvailabilityCheck>({
    queryKey: [
      'service-availability',
      selectedService?._id,
      availDate,
      availPeople,
      selectedPropertyId,
    ],
    queryFn: () =>
      hotelServicesService.checkAvailability(
        selectedService!._id,
        availDate,
        availPeople,
        selectedPropertyId
      ),
    enabled: false, // manual trigger only
  });

  // -----------------------------------------------------------------------
  // Mutations
  // -----------------------------------------------------------------------

  const bookMutation = useMutation({
    mutationFn: (params: { serviceId: string; bookingDate: string; numberOfPeople: number; specialRequests?: string }) =>
      hotelServicesService.bookService(
        params.serviceId,
        {
          bookingDate: params.bookingDate,
          numberOfPeople: params.numberOfPeople,
          specialRequests: params.specialRequests,
        },
        selectedPropertyId
      ),
    onSuccess: () => {
      toast.success('Service booked successfully');
      setShowBookingModal(false);
      resetBookingForm();
      queryClient.invalidateQueries({ queryKey: ['frontdesk-service-bookings'] });
    },
    onError: (error) => {
      toast.error(getErrorMessage(error));
    },
  });

  const cancelMutation = useMutation({
    mutationFn: (params: { bookingId: string; reason: string }) =>
      hotelServicesService.cancelBooking(params.bookingId, { reason: params.reason }, selectedPropertyId),
    onSuccess: () => {
      toast.success('Booking cancelled');
      queryClient.invalidateQueries({ queryKey: ['frontdesk-service-bookings'] });
    },
    onError: (error) => {
      toast.error(getErrorMessage(error));
    },
  });

  // -----------------------------------------------------------------------
  // Handlers
  // -----------------------------------------------------------------------

  const resetBookingForm = () => {
    setBookingDate('');
    setBookingTime('10:00');
    setNumberOfPeople(1);
    setSpecialRequests('');
  };

  const handleSearchSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    setAppliedSearch(searchTerm);
    setCatalogPage(1);
  };

  const clearFilters = () => {
    setSearchTerm('');
    setAppliedSearch('');
    setTypeFilter('');
    setMinPrice('');
    setMaxPrice('');
    setCatalogPage(1);
  };

  const hasActiveFilters = !!(appliedSearch || typeFilter || minPrice || maxPrice);

  const handleOpenDetail = (service: HotelService) => {
    setSelectedService(service);
    setShowDetailModal(true);
  };

  const handleOpenBooking = (service: HotelService) => {
    setSelectedService(service);
    resetBookingForm();
    setShowBookingModal(true);
  };

  const handleOpenAvailability = (service: HotelService) => {
    setSelectedService(service);
    setAvailDate('');
    setAvailPeople(1);
    setShowAvailabilityModal(true);
  };

  const handleCheckAvailability = () => {
    if (!availDate) {
      toast.error('Please select a date');
      return;
    }
    checkAvailability();
  };

  const handleBookService = () => {
    if (!selectedService || !bookingDate || !bookingTime) {
      toast.error('Please fill in all required fields');
      return;
    }
    const dateTime = `${bookingDate}T${bookingTime}:00`;
    bookMutation.mutate({
      serviceId: selectedService._id,
      bookingDate: dateTime,
      numberOfPeople,
      specialRequests: specialRequests || undefined,
    });
  };

  const handleCancelBooking = (bookingId: string) => {
    const reason = prompt('Enter cancellation reason:');
    if (reason && reason.trim()) {
      cancelMutation.mutate({ bookingId, reason: reason.trim() });
    }
  };

  const handleRefresh = () => {
    setRefreshing(true);
    Promise.all([refetchCatalog(), refetchBookings()]).finally(() =>
      setTimeout(() => setRefreshing(false), 500)
    );
  };

  // -----------------------------------------------------------------------
  // Derived
  // -----------------------------------------------------------------------

  const todayStr = useMemo(() => {
    const d = new Date();
    return d.toISOString().split('T')[0];
  }, []);

  // -----------------------------------------------------------------------
  // Guards
  // -----------------------------------------------------------------------

  if (!selectedPropertyId) {
    return (
      <div className="p-6 max-w-7xl mx-auto">
        <PropertyBreadcrumb items={['Hotel Services']} />
        <div className="text-center py-12">
          <div className="text-gray-400 mb-4">
            <BookOpen className="w-16 h-16 mx-auto" />
          </div>
          <h3 className="text-lg font-medium text-gray-900 mb-2">No Property Selected</h3>
          <p className="text-gray-500">Please select a property to view hotel services.</p>
        </div>
      </div>
    );
  }

  // -----------------------------------------------------------------------
  // Sub-renders
  // -----------------------------------------------------------------------

  const renderServiceCard = (service: HotelService) => {
    const meta = SERVICE_TYPE_META[service.type] ?? { label: service.type, color: 'text-gray-700', bg: 'bg-gray-100' };
    return (
      <Card key={service._id} className="hover:shadow-md transition-shadow">
        <CardContent className="p-4">
          {/* Header row */}
          <div className="flex items-start justify-between mb-2">
            <div className="flex-1 min-w-0">
              <h3 className="font-semibold text-gray-900 truncate">{service.name}</h3>
              <span className={cn('inline-block text-xs font-medium px-2 py-0.5 rounded-full mt-1', meta.bg, meta.color)}>
                {meta.label}
              </span>
            </div>
            {service.featured && (
              <Star className="w-4 h-4 text-amber-500 fill-amber-500 flex-shrink-0 ml-2" />
            )}
          </div>

          {/* Description */}
          <p className="text-sm text-gray-600 line-clamp-2 mb-3">{service.description}</p>

          {/* Info row */}
          <div className="flex flex-wrap gap-x-4 gap-y-1 text-xs text-gray-500 mb-3">
            <span className="font-semibold text-gray-900 text-sm">
              {formatCurrency(service.price, service.currency || 'INR')}
              {service.duration ? <span className="text-gray-500 font-normal"> / {hotelServicesService.formatDuration(service.duration)}</span> : ''}
            </span>
            {service.capacity && (
              <span className="flex items-center gap-1">
                <Users className="w-3 h-3" /> Max {service.capacity}
              </span>
            )}
            {service.operatingHours?.open && service.operatingHours?.close && (
              <span className="flex items-center gap-1">
                <Clock className="w-3 h-3" /> {service.operatingHours.open} - {service.operatingHours.close}
              </span>
            )}
            {service.location && (
              <span className="flex items-center gap-1">
                <MapPin className="w-3 h-3" /> {service.location}
              </span>
            )}
          </div>

          {/* Rating */}
          {service.rating && service.rating.count > 0 && (
            <div className="flex items-center gap-1 text-xs text-gray-500 mb-3">
              <Star className="w-3 h-3 text-amber-500 fill-amber-500" />
              <span>{service.rating.average.toFixed(1)}</span>
              <span>({service.rating.count} review{service.rating.count !== 1 ? 's' : ''})</span>
            </div>
          )}

          {/* Actions */}
          <div className="flex gap-2 mt-auto">
            <Button size="sm" variant="outline" onClick={() => handleOpenDetail(service)} className="flex-1">
              <Eye className="w-3.5 h-3.5 mr-1" /> Details
            </Button>
            <Button size="sm" variant="outline" onClick={() => handleOpenAvailability(service)} className="flex-1">
              <Calendar className="w-3.5 h-3.5 mr-1" /> Availability
            </Button>
            <Button size="sm" onClick={() => handleOpenBooking(service)} className="flex-1">
              <BookOpen className="w-3.5 h-3.5 mr-1" /> Book
            </Button>
          </div>
        </CardContent>
      </Card>
    );
  };

  const renderPagination = (
    currentPage: number,
    totalPages: number,
    totalCount: number,
    onPageChange: (p: number) => void
  ) => (
    <div className="flex items-center justify-between mt-4">
      <p className="text-sm text-gray-500">
        Page {currentPage} of {totalPages} ({totalCount} total)
      </p>
      <div className="flex gap-2">
        <Button
          size="sm"
          variant="outline"
          disabled={currentPage <= 1}
          onClick={() => onPageChange(currentPage - 1)}
        >
          <ChevronLeft className="w-4 h-4 mr-1" /> Prev
        </Button>
        <Button
          size="sm"
          variant="outline"
          disabled={currentPage >= totalPages}
          onClick={() => onPageChange(currentPage + 1)}
        >
          Next <ChevronRight className="w-4 h-4 ml-1" />
        </Button>
      </div>
    </div>
  );

  const renderBookingRow = (booking: ServiceBooking) => {
    const statusMeta = BOOKING_STATUS_META[booking.status] ?? { label: booking.status, variant: 'default' as const };
    const serviceName = typeof booking.serviceId === 'object' && booking.serviceId?.name
      ? booking.serviceId.name
      : 'Unknown Service';
    const serviceType = typeof booking.serviceId === 'object' && booking.serviceId?.type
      ? booking.serviceId.type
      : '';
    const bookingDate = new Date(booking.bookingDate);
    const canCancel = booking.status === 'pending' || booking.status === 'confirmed';

    return (
      <div
        key={booking._id}
        className="flex flex-col sm:flex-row sm:items-center justify-between p-4 bg-gray-50 rounded-lg border border-gray-100 gap-3"
      >
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2 mb-1">
            <p className="font-medium text-gray-900 truncate">{serviceName}</p>
            {serviceType && (
              <span className={cn(
                'text-xs px-1.5 py-0.5 rounded-full',
                SERVICE_TYPE_META[serviceType]?.bg ?? 'bg-gray-100',
                SERVICE_TYPE_META[serviceType]?.color ?? 'text-gray-700'
              )}>
                {SERVICE_TYPE_META[serviceType]?.label ?? serviceType}
              </span>
            )}
          </div>
          <div className="flex flex-wrap gap-x-4 gap-y-1 text-xs text-gray-500">
            <span className="flex items-center gap-1">
              <Calendar className="w-3 h-3" />
              {bookingDate.toLocaleDateString('en-IN', { weekday: 'short', year: 'numeric', month: 'short', day: 'numeric' })}
              {' '}
              {bookingDate.toLocaleTimeString('en-IN', { hour: '2-digit', minute: '2-digit' })}
            </span>
            <span className="flex items-center gap-1">
              <Users className="w-3 h-3" /> {booking.numberOfPeople} guest{booking.numberOfPeople !== 1 ? 's' : ''}
            </span>
            <span className="flex items-center gap-1">
              <DollarSign className="w-3 h-3" /> {formatCurrency(booking.totalAmount, booking.currency || 'INR')}
            </span>
          </div>
          {booking.specialRequests && (
            <p className="text-xs text-gray-400 mt-1 line-clamp-1">Note: {booking.specialRequests}</p>
          )}
        </div>
        <div className="flex items-center gap-2 flex-shrink-0">
          <Badge variant={statusMeta.variant} size="sm">{statusMeta.label}</Badge>
          {canCancel && (
            <Button
              size="sm"
              variant="outline"
              className="text-red-600 border-red-200 hover:bg-red-50"
              onClick={() => handleCancelBooking(booking._id)}
              disabled={cancelMutation.isPending}
            >
              <XCircle className="w-3.5 h-3.5 mr-1" /> Cancel
            </Button>
          )}
        </div>
      </div>
    );
  };

  // -----------------------------------------------------------------------
  // Render
  // -----------------------------------------------------------------------

  return (
    <div className="p-6 max-w-7xl mx-auto space-y-6">
      <PropertyBreadcrumb items={['Hotel Services']} />

      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Hotel Services</h1>
          <p className="text-gray-600">Browse the service catalog and book services for guests</p>
        </div>
        <Button
          onClick={handleRefresh}
          disabled={refreshing}
          variant="outline"
          className="flex items-center self-start"
        >
          <RefreshCw className={cn('w-4 h-4 mr-2', refreshing && 'animate-spin')} />
          Refresh
        </Button>
      </div>

      {/* Info notice */}
      <div className="bg-blue-50 border border-blue-200 rounded-lg p-4">
        <p className="text-sm text-blue-800 flex items-start gap-2">
          <Info className="w-4 h-4 mt-0.5 flex-shrink-0" />
          <span>
            <strong>Front Desk Access:</strong> You can browse the service catalog, check availability, and book
            services on behalf of guests. Catalog management (create, edit, delete) is restricted to administrators.
          </span>
        </p>
      </div>

      {/* Tabs */}
      <Tabs value={activeTab} onValueChange={setActiveTab}>
        <TabsList className="w-full sm:w-auto">
          <TabsTrigger value="catalog">Service Catalog</TabsTrigger>
          <TabsTrigger value="bookings">Service Bookings</TabsTrigger>
        </TabsList>

        {/* ============================================================= */}
        {/* TAB: Service Catalog                                          */}
        {/* ============================================================= */}
        <TabsContent value="catalog">
          {/* Filters */}
          <Card className="mb-4">
            <CardContent className="p-4">
              <div className="flex flex-col gap-3">
                {/* Search row */}
                <form onSubmit={handleSearchSubmit} className="flex gap-2">
                  <div className="relative flex-1">
                    <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
                    <Input
                      placeholder="Search services by name or description..."
                      value={searchTerm}
                      onChange={(e) => setSearchTerm(e.target.value)}
                      className="pl-9"
                    />
                  </div>
                  <Button type="submit" variant="outline">
                    <Search className="w-4 h-4 mr-1" /> Search
                  </Button>
                </form>

                {/* Filter row */}
                <div className="flex flex-wrap items-end gap-3">
                  {/* Type filter */}
                  <div className="flex flex-col gap-1">
                    <label className="text-xs font-medium text-gray-500">Service Type</label>
                    <select
                      value={typeFilter}
                      onChange={(e) => { setTypeFilter(e.target.value); setCatalogPage(1); }}
                      className="rounded-md border border-gray-300 bg-white px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
                    >
                      <option value="">All types</option>
                      {(serviceTypes ?? []).map((t) => (
                        <option key={t.value} value={t.value}>{t.label}</option>
                      ))}
                    </select>
                  </div>

                  {/* Price range */}
                  <div className="flex flex-col gap-1">
                    <label className="text-xs font-medium text-gray-500">Min Price</label>
                    <Input
                      type="number"
                      min="0"
                      placeholder="0"
                      value={minPrice}
                      onChange={(e) => { setMinPrice(e.target.value); setCatalogPage(1); }}
                      className="w-24"
                    />
                  </div>
                  <div className="flex flex-col gap-1">
                    <label className="text-xs font-medium text-gray-500">Max Price</label>
                    <Input
                      type="number"
                      min="0"
                      placeholder="Any"
                      value={maxPrice}
                      onChange={(e) => { setMaxPrice(e.target.value); setCatalogPage(1); }}
                      className="w-24"
                    />
                  </div>

                  {hasActiveFilters && (
                    <Button variant="outline" size="sm" onClick={clearFilters} className="self-end">
                      <X className="w-3.5 h-3.5 mr-1" /> Clear filters
                    </Button>
                  )}
                </div>
              </div>
            </CardContent>
          </Card>

          {/* Catalog grid */}
          {catalogLoading ? (
            <div className="flex justify-center items-center min-h-[300px]">
              <LoadingSpinner size="lg" />
            </div>
          ) : catalogError ? (
            <div className="text-center py-12">
              <AlertTriangle className="mx-auto h-12 w-12 text-red-500 mb-4" />
              <h3 className="text-lg font-medium text-gray-900 mb-2">Failed to load services</h3>
              <p className="text-gray-500 mb-4">{getErrorMessage(catalogQueryError)}</p>
              <Button onClick={() => refetchCatalog()}>Try Again</Button>
            </div>
          ) : services.length === 0 ? (
            <div className="text-center py-12">
              <BookOpen className="mx-auto h-12 w-12 text-gray-300 mb-4" />
              <h3 className="text-lg font-medium text-gray-900 mb-2">No services found</h3>
              <p className="text-gray-500">
                {hasActiveFilters
                  ? 'Try adjusting your search or filters.'
                  : 'No services are currently available for this property.'}
              </p>
              {hasActiveFilters && (
                <Button variant="outline" className="mt-4" onClick={clearFilters}>
                  Clear filters
                </Button>
              )}
            </div>
          ) : (
            <>
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                {services.map(renderServiceCard)}
              </div>

              {catalogPagination && catalogPagination.totalPages > 1 && (
                renderPagination(
                  catalogPagination.page,
                  catalogPagination.totalPages,
                  catalogPagination.totalCount,
                  setCatalogPage
                )
              )}
            </>
          )}
        </TabsContent>

        {/* ============================================================= */}
        {/* TAB: Service Bookings                                         */}
        {/* ============================================================= */}
        <TabsContent value="bookings">
          {/* Bookings filter */}
          <Card className="mb-4">
            <CardContent className="p-4">
              <div className="flex flex-wrap items-end gap-3">
                <div className="flex flex-col gap-1">
                  <label className="text-xs font-medium text-gray-500">Status</label>
                  <select
                    value={bookingStatusFilter}
                    onChange={(e) => { setBookingStatusFilter(e.target.value); setBookingsPage(1); }}
                    className="rounded-md border border-gray-300 bg-white px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
                  >
                    <option value="">All statuses</option>
                    <option value="pending">Pending</option>
                    <option value="confirmed">Confirmed</option>
                    <option value="completed">Completed</option>
                    <option value="cancelled">Cancelled</option>
                  </select>
                </div>
                {bookingStatusFilter && (
                  <Button variant="outline" size="sm" onClick={() => { setBookingStatusFilter(''); setBookingsPage(1); }}>
                    <X className="w-3.5 h-3.5 mr-1" /> Clear
                  </Button>
                )}
              </div>
            </CardContent>
          </Card>

          {/* Bookings list */}
          {bookingsLoading ? (
            <div className="flex justify-center items-center min-h-[300px]">
              <LoadingSpinner size="lg" />
            </div>
          ) : bookingsError ? (
            <div className="text-center py-12">
              <AlertTriangle className="mx-auto h-12 w-12 text-red-500 mb-4" />
              <h3 className="text-lg font-medium text-gray-900 mb-2">Failed to load bookings</h3>
              <p className="text-gray-500 mb-4">{getErrorMessage(bookingsQueryError)}</p>
              <Button onClick={() => refetchBookings()}>Try Again</Button>
            </div>
          ) : bookings.length === 0 ? (
            <div className="text-center py-12">
              <Calendar className="mx-auto h-12 w-12 text-gray-300 mb-4" />
              <h3 className="text-lg font-medium text-gray-900 mb-2">No bookings found</h3>
              <p className="text-gray-500">
                {bookingStatusFilter
                  ? 'No bookings match the selected filter.'
                  : 'No service bookings have been made yet.'}
              </p>
            </div>
          ) : (
            <>
              <div className="space-y-3">
                {bookings.map(renderBookingRow)}
              </div>

              {bookingsPagination && bookingsPagination.totalPages > 1 && (
                renderPagination(
                  bookingsPagination.currentPage,
                  bookingsPagination.totalPages,
                  bookingsPagination.totalItems,
                  setBookingsPage
                )
              )}
            </>
          )}
        </TabsContent>
      </Tabs>

      {/* ================================================================ */}
      {/* Modal: Service Details                                           */}
      {/* ================================================================ */}
      <Dialog open={showDetailModal} onOpenChange={setShowDetailModal}>
        <DialogContent className="max-w-lg max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>Service Details</DialogTitle>
          </DialogHeader>
          {selectedService && (
            <div className="space-y-4">
              {/* Name & type */}
              <div>
                <h3 className="text-lg font-semibold text-gray-900">{selectedService.name}</h3>
                <span className={cn(
                  'inline-block text-xs font-medium px-2 py-0.5 rounded-full mt-1',
                  SERVICE_TYPE_META[selectedService.type]?.bg ?? 'bg-gray-100',
                  SERVICE_TYPE_META[selectedService.type]?.color ?? 'text-gray-700'
                )}>
                  {SERVICE_TYPE_META[selectedService.type]?.label ?? selectedService.type}
                </span>
                {selectedService.featured && (
                  <Badge variant="warning" size="sm" className="ml-2">Featured</Badge>
                )}
              </div>

              {/* Description */}
              <p className="text-sm text-gray-600">{selectedService.description}</p>

              {/* Key info */}
              <div className="grid grid-cols-2 gap-3">
                <div className="bg-gray-50 rounded-lg p-3">
                  <p className="text-xs text-gray-500 mb-1">Price</p>
                  <p className="font-semibold text-gray-900">
                    {formatCurrency(selectedService.price, selectedService.currency || 'INR')}
                    {selectedService.duration ? <span className="text-xs text-gray-500 font-normal"> / person</span> : ''}
                  </p>
                </div>
                {selectedService.duration && (
                  <div className="bg-gray-50 rounded-lg p-3">
                    <p className="text-xs text-gray-500 mb-1">Duration</p>
                    <p className="font-semibold text-gray-900 flex items-center gap-1">
                      <Clock className="w-4 h-4 text-gray-400" />
                      {hotelServicesService.formatDuration(selectedService.duration)}
                    </p>
                  </div>
                )}
                {selectedService.capacity && (
                  <div className="bg-gray-50 rounded-lg p-3">
                    <p className="text-xs text-gray-500 mb-1">Capacity</p>
                    <p className="font-semibold text-gray-900 flex items-center gap-1">
                      <Users className="w-4 h-4 text-gray-400" />
                      {selectedService.capacity} people
                    </p>
                  </div>
                )}
                {selectedService.operatingHours?.open && selectedService.operatingHours?.close && (
                  <div className="bg-gray-50 rounded-lg p-3">
                    <p className="text-xs text-gray-500 mb-1">Operating Hours</p>
                    <p className="font-semibold text-gray-900 flex items-center gap-1">
                      <Clock className="w-4 h-4 text-gray-400" />
                      {selectedService.operatingHours.open} - {selectedService.operatingHours.close}
                    </p>
                  </div>
                )}
              </div>

              {/* Location */}
              {selectedService.location && (
                <div className="flex items-center gap-2 text-sm text-gray-600">
                  <MapPin className="w-4 h-4 text-gray-400" />
                  <span>{selectedService.location}</span>
                </div>
              )}

              {/* Contact */}
              {selectedService.contactInfo && (selectedService.contactInfo.phone || selectedService.contactInfo.email) && (
                <div className="space-y-1">
                  <p className="text-xs font-medium text-gray-500">Contact</p>
                  {selectedService.contactInfo.phone && (
                    <div className="flex items-center gap-2 text-sm text-gray-600">
                      <Phone className="w-4 h-4 text-gray-400" />
                      <span>{selectedService.contactInfo.phone}</span>
                    </div>
                  )}
                  {selectedService.contactInfo.email && (
                    <div className="flex items-center gap-2 text-sm text-gray-600">
                      <Mail className="w-4 h-4 text-gray-400" />
                      <span>{selectedService.contactInfo.email}</span>
                    </div>
                  )}
                </div>
              )}

              {/* Amenities */}
              {selectedService.amenities && selectedService.amenities.length > 0 && (
                <div>
                  <p className="text-xs font-medium text-gray-500 mb-2">Amenities</p>
                  <div className="flex flex-wrap gap-1.5">
                    {selectedService.amenities.map((a, i) => (
                      <Badge key={i} variant="secondary" size="sm">{a}</Badge>
                    ))}
                  </div>
                </div>
              )}

              {/* Tags */}
              {selectedService.tags && selectedService.tags.length > 0 && (
                <div>
                  <p className="text-xs font-medium text-gray-500 mb-2">Tags</p>
                  <div className="flex flex-wrap gap-1.5">
                    {selectedService.tags.map((t, i) => (
                      <span key={i} className="inline-flex items-center gap-1 text-xs bg-gray-100 text-gray-600 px-2 py-0.5 rounded-full">
                        <Tag className="w-3 h-3" /> {t}
                      </span>
                    ))}
                  </div>
                </div>
              )}

              {/* Special instructions */}
              {selectedService.specialInstructions && (
                <div className="bg-amber-50 border border-amber-200 rounded-lg p-3">
                  <p className="text-xs font-medium text-amber-700 mb-1">Special Instructions</p>
                  <p className="text-sm text-amber-800">{selectedService.specialInstructions}</p>
                </div>
              )}

              {/* Rating */}
              {selectedService.rating && selectedService.rating.count > 0 && (
                <div className="flex items-center gap-2 text-sm">
                  <Star className="w-4 h-4 text-amber-500 fill-amber-500" />
                  <span className="font-medium">{selectedService.rating.average.toFixed(1)}</span>
                  <span className="text-gray-500">({selectedService.rating.count} review{selectedService.rating.count !== 1 ? 's' : ''})</span>
                </div>
              )}

              {/* Actions */}
              <div className="flex gap-2 pt-2 border-t">
                <Button variant="outline" onClick={() => handleOpenAvailability(selectedService)} className="flex-1">
                  <Calendar className="w-4 h-4 mr-1" /> Check Availability
                </Button>
                <Button onClick={() => { setShowDetailModal(false); handleOpenBooking(selectedService); }} className="flex-1">
                  <BookOpen className="w-4 h-4 mr-1" /> Book Service
                </Button>
              </div>
            </div>
          )}
        </DialogContent>
      </Dialog>

      {/* ================================================================ */}
      {/* Modal: Check Availability                                        */}
      {/* ================================================================ */}
      <Dialog open={showAvailabilityModal} onOpenChange={setShowAvailabilityModal}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle>Check Availability</DialogTitle>
          </DialogHeader>
          {selectedService && (
            <div className="space-y-4">
              <p className="text-sm text-gray-600">
                Checking availability for <strong>{selectedService.name}</strong>
              </p>

              <div className="space-y-3">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Date</label>
                  <Input
                    type="date"
                    value={availDate}
                    min={todayStr}
                    onChange={(e) => setAvailDate(e.target.value)}
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Number of Guests</label>
                  <Input
                    type="number"
                    min={1}
                    max={selectedService.capacity || 100}
                    value={availPeople}
                    onChange={(e) => setAvailPeople(Math.max(1, parseInt(e.target.value) || 1))}
                  />
                </div>
              </div>

              <Button onClick={handleCheckAvailability} disabled={availabilityLoading || !availDate} className="w-full">
                {availabilityLoading ? (
                  <><LoadingSpinner size="sm" /> Checking...</>
                ) : (
                  <><Calendar className="w-4 h-4 mr-1" /> Check Availability</>
                )}
              </Button>

              {/* Result */}
              {availabilityResult && availDate && (
                <div className={cn(
                  'rounded-lg p-4 border',
                  availabilityResult.available
                    ? 'bg-green-50 border-green-200'
                    : 'bg-red-50 border-red-200'
                )}>
                  <div className="flex items-start gap-2">
                    {availabilityResult.available ? (
                      <CheckCircle className="w-5 h-5 text-green-600 flex-shrink-0 mt-0.5" />
                    ) : (
                      <XCircle className="w-5 h-5 text-red-600 flex-shrink-0 mt-0.5" />
                    )}
                    <div>
                      <p className={cn('font-medium', availabilityResult.available ? 'text-green-800' : 'text-red-800')}>
                        {availabilityResult.available ? 'Available' : 'Not Available'}
                      </p>
                      {availabilityResult.reason && (
                        <p className="text-sm text-red-700 mt-1">{availabilityResult.reason}</p>
                      )}
                      {availabilityResult.available && availabilityResult.availableCapacity !== null && availabilityResult.availableCapacity !== undefined && (
                        <p className="text-sm text-green-700 mt-1">
                          {availabilityResult.availableCapacity} spot{availabilityResult.availableCapacity !== 1 ? 's' : ''} remaining
                        </p>
                      )}
                    </div>
                  </div>
                  {availabilityResult.available && (
                    <Button
                      size="sm"
                      className="mt-3"
                      onClick={() => {
                        setShowAvailabilityModal(false);
                        setBookingDate(availDate);
                        setNumberOfPeople(availPeople);
                        handleOpenBooking(selectedService);
                      }}
                    >
                      <BookOpen className="w-3.5 h-3.5 mr-1" /> Proceed to Book
                    </Button>
                  )}
                </div>
              )}
            </div>
          )}
        </DialogContent>
      </Dialog>

      {/* ================================================================ */}
      {/* Modal: Book Service                                              */}
      {/* ================================================================ */}
      <Dialog open={showBookingModal} onOpenChange={setShowBookingModal}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle>Book Service for Guest</DialogTitle>
          </DialogHeader>
          {selectedService && (
            <div className="space-y-4">
              {/* Service summary */}
              <div className="bg-gray-50 rounded-lg p-3">
                <h4 className="font-medium text-gray-900">{selectedService.name}</h4>
                <p className="text-sm text-gray-500 mt-0.5">
                  {formatCurrency(selectedService.price, selectedService.currency || 'INR')} per person
                  {selectedService.duration ? ` / ${hotelServicesService.formatDuration(selectedService.duration)}` : ''}
                </p>
                {selectedService.operatingHours?.open && selectedService.operatingHours?.close && (
                  <p className="text-xs text-gray-400 mt-1">
                    Hours: {selectedService.operatingHours.open} - {selectedService.operatingHours.close}
                  </p>
                )}
              </div>

              {/* Form */}
              <div className="space-y-3">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    Date <span className="text-red-500">*</span>
                  </label>
                  <Input
                    type="date"
                    value={bookingDate}
                    min={todayStr}
                    onChange={(e) => setBookingDate(e.target.value)}
                  />
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    Time <span className="text-red-500">*</span>
                  </label>
                  <Input
                    type="time"
                    value={bookingTime}
                    onChange={(e) => setBookingTime(e.target.value)}
                  />
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    Number of Guests <span className="text-red-500">*</span>
                  </label>
                  <Input
                    type="number"
                    min={1}
                    max={selectedService.capacity || 100}
                    value={numberOfPeople}
                    onChange={(e) => setNumberOfPeople(Math.max(1, parseInt(e.target.value) || 1))}
                  />
                  {selectedService.capacity && (
                    <p className="text-xs text-gray-400 mt-1">Maximum capacity: {selectedService.capacity}</p>
                  )}
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Special Requests</label>
                  <textarea
                    value={specialRequests}
                    onChange={(e) => setSpecialRequests(e.target.value)}
                    rows={3}
                    maxLength={500}
                    placeholder="Any special requirements for the guest..."
                    className="w-full rounded-md border border-gray-300 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 resize-none"
                  />
                </div>
              </div>

              {/* Estimated total */}
              <div className="bg-blue-50 border border-blue-200 rounded-lg p-3">
                <div className="flex items-center justify-between">
                  <span className="text-sm font-medium text-blue-800">Estimated Total</span>
                  <span className="text-lg font-bold text-blue-900">
                    {formatCurrency(selectedService.price * numberOfPeople, selectedService.currency || 'INR')}
                  </span>
                </div>
                <p className="text-xs text-blue-600 mt-1">
                  {formatCurrency(selectedService.price, selectedService.currency || 'INR')} x {numberOfPeople} guest{numberOfPeople !== 1 ? 's' : ''}
                </p>
              </div>

              {/* Submit */}
              <div className="flex gap-2 pt-2">
                <Button variant="outline" className="flex-1" onClick={() => setShowBookingModal(false)}>
                  Cancel
                </Button>
                <Button
                  className="flex-1"
                  onClick={handleBookService}
                  disabled={bookMutation.isPending || !bookingDate || !bookingTime}
                >
                  {bookMutation.isPending ? (
                    <><LoadingSpinner size="sm" /> Booking...</>
                  ) : (
                    <><CheckCircle className="w-4 h-4 mr-1" /> Confirm Booking</>
                  )}
                </Button>
              </div>
            </div>
          )}
        </DialogContent>
      </Dialog>
    </div>
  );
}

export default withErrorBoundary(FrontDeskHotelServices);
