import React, { useState, useMemo } from 'react';
import { useParams, useNavigate, useSearchParams } from 'react-router-dom';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import {
  Calendar,
  Clock,
  Users,
  MapPin,
  Star,
  CreditCard,
  CheckCircle,
  AlertCircle
} from 'lucide-react';
import { hotelServicesService } from '../../services/hotelServicesService';
import { Card } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { LoadingSpinner } from '../../components/LoadingSpinner';
import BackButton from '../../components/ui/BackButton';
import { formatCurrency } from '../../utils/formatters';
import toast from 'react-hot-toast';
import { withErrorBoundary } from '../../components/ErrorBoundary';
import { resolvePublicHotelId } from '../../utils/publicBookingHotel';

const ServiceBookingPage: React.FC = () => {
  const { serviceId } = useParams<{ serviceId: string }>();
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const publicHotelId = useMemo(() => resolvePublicHotelId(searchParams), [searchParams]);
  const queryClient = useQueryClient();
  
  const [formData, setFormData] = useState({
    bookingDate: '',
    numberOfPeople: 1,
    specialRequests: ''
  });
  
  const [availabilityChecked, setAvailabilityChecked] = useState(false);

  // Fetch service details
  const { data: service, isLoading, error } = useQuery({
    queryKey: ['service-details', publicHotelId, serviceId],
    queryFn: () => hotelServicesService.getServiceDetails(serviceId!, publicHotelId),
    enabled: !!serviceId,
  });

  // Check availability mutation
  const availabilityMutation = useMutation({
    mutationFn: ({ date, people }: { date: string; people: number }) =>
      hotelServicesService.checkAvailability(serviceId!, date, people, publicHotelId),
    onSuccess: (data) => {
      if (data.available) {
        setAvailabilityChecked(true);
        toast.success('Service is available for your selected date and time!');
      } else {
        toast.error(data.reason || 'Service is not available for the selected date and time');
      }
    },
    onError: (error: Error) => {
      const axiosError = error as Error & { response?: { data?: { message?: string } } };
      toast.error(axiosError.response?.data?.message || 'Failed to check availability');
    }
  });

  // Book service mutation
  const bookingMutation = useMutation({
    mutationFn: () => hotelServicesService.bookService(serviceId!, {
      ...formData,
      // IDEMPOTENCY FIX: crypto.randomUUID() prevents booking deduplication collisions.
      idempotencyKey: `svc-${serviceId}-${formData.bookingDate}-${formData.numberOfPeople}-${crypto.randomUUID()}`
    }, publicHotelId),
    onSuccess: (data) => {
      queryClient.invalidateQueries({ queryKey: ['service-bookings'] });
      toast.success('Service booked successfully!');
      navigate(`/app/services/bookings/confirmation/${data.booking._id}`);
    },
    onError: (error: Error) => {
      const axiosError = error as Error & { response?: { data?: { message?: string } } };
      toast.error(axiosError.response?.data?.message || 'Failed to book service');
    }
  });

  const handleInputChange = (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement>) => {
    const { name, value } = e.target;
    setFormData(prev => ({
      ...prev,
      [name]: name === 'numberOfPeople' ? parseInt(value) || 1 : value
    }));
    
    // Reset availability check when form changes
    if (availabilityChecked) {
      setAvailabilityChecked(false);
    }
  };

  const handleCheckAvailability = () => {
    if (!formData.bookingDate) {
      toast.error('Please select a date and time');
      return;
    }
    
    availabilityMutation.mutate({
      date: formData.bookingDate,
      people: formData.numberOfPeople
    });
  };

  const handleBookService = () => {
    if (!availabilityChecked) {
      toast.error('Please check availability first');
      return;
    }
    
    bookingMutation.mutate();
  };

  const getMinDateTime = () => {
    const now = new Date();
    now.setHours(now.getHours() + 2); // Minimum 2 hours from now
    return now.toISOString().slice(0, 16);
  };

  const calculateTotal = () => {
    if (!service) return 0;
    return service.price * formData.numberOfPeople;
  };

  if (isLoading) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center">
        <LoadingSpinner />
      </div>
    );
  }

  if (error || !service) {
    return (
      <div className="min-h-screen bg-gray-50 p-6">
        <div className="max-w-4xl mx-auto">
          <BackButton to={`/app/services/${serviceId}`} label="Back to Service" className="mb-6" />
          <Card className="p-8 text-center">
            <AlertCircle className="h-16 w-16 text-red-500 mx-auto mb-4" />
            <h2 className="text-xl font-semibold text-gray-900 mb-2">Service Not Found</h2>
            <p className="text-gray-600 mb-4">
              The service you're trying to book doesn't exist or has been removed.
            </p>
            <Button onClick={() => navigate('/app/services')}>
              Browse All Services
            </Button>
          </Card>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gray-50 p-6">
      <div className="max-w-4xl mx-auto">
        {/* Header */}
        <div className="mb-6">
          <BackButton 
            to={`/app/services/${serviceId}`} 
            label="Back to Service Details" 
            className="mb-4" 
          />
          <h1 className="text-3xl font-bold text-gray-900 mb-2">
            Book Service: {service.name}
          </h1>
          <p className="text-gray-600">
            Complete your booking by filling out the details below
          </p>
        </div>

        <div className="grid lg:grid-cols-3 gap-8">
          {/* Booking Form */}
          <div className="lg:col-span-2 space-y-6">
            {/* Service Summary */}
            <Card className="p-6">
              <div className="flex items-center gap-4 mb-4">
                <div className="w-16 h-16 bg-gray-200 rounded-lg overflow-hidden">
                  {service.images && service.images.length > 0 ? (
                    <img
                      src={service.images[0]}
                      alt={service.name}
                      className="w-full h-full object-cover"
                    />
                  ) : (
                    <div className="w-full h-full flex items-center justify-center text-gray-400">
                      <span className="text-2xl">
                        {hotelServicesService.getServiceTypeInfo(service.type).icon}
                      </span>
                    </div>
                  )}
                </div>
                <div>
                  <h2 className="text-xl font-semibold text-gray-900">{service.name}</h2>
                  <p className="text-gray-600">{service.type.charAt(0).toUpperCase() + service.type.slice(1)}</p>
                  <div className="flex items-center gap-4 mt-2">
                    {service.rating?.count > 0 && (
                      <div className="flex items-center gap-1">
                        <Star className="h-4 w-4 text-yellow-400 fill-current" />
                        <span className="text-sm">{service.rating.average?.toFixed(1)}</span>
                      </div>
                    )}
                    {service.location && (
                      <div className="flex items-center gap-1">
                        <MapPin className="h-4 w-4 text-gray-400" />
                        <span className="text-sm text-gray-600">{service.location}</span>
                      </div>
                    )}
                  </div>
                </div>
              </div>
            </Card>

            {/* Booking Details Form */}
            <Card className="p-6">
              <h3 className="text-lg font-semibold text-gray-900 mb-6">Booking Details</h3>
              
              <div className="space-y-6">
                {/* Date and Time */}
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">
                    <Calendar className="h-4 w-4 inline mr-2" />
                    Date and Time
                  </label>
                  <Input
                    type="datetime-local"
                    name="bookingDate"
                    value={formData.bookingDate}
                    onChange={handleInputChange}
                    min={getMinDateTime()}
                    required
                    className="w-full"
                  />
                  <p className="text-xs text-gray-500 mt-1">
                    Bookings must be made at least 2 hours in advance
                  </p>
                </div>

                {/* Number of People */}
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">
                    <Users className="h-4 w-4 inline mr-2" />
                    Number of People
                  </label>
                  <Input
                    type="number"
                    name="numberOfPeople"
                    value={formData.numberOfPeople}
                    onChange={handleInputChange}
                    min="1"
                    max={service.capacity || 10}
                    required
                    className="w-full"
                  />
                  {service.capacity && (
                    <p className="text-xs text-gray-500 mt-1">
                      Maximum capacity: {service.capacity} people
                    </p>
                  )}
                </div>

                {/* Special Requests */}
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">
                    Special Requests (Optional)
                  </label>
                  <textarea
                    name="specialRequests"
                    value={formData.specialRequests}
                    onChange={handleInputChange}
                    rows={3}
                    className="w-full border border-gray-300 rounded-lg px-3 py-2 focus:outline-none focus:ring-2 focus:ring-blue-500"
                    placeholder="Any special requests or requirements..."
                  />
                </div>

                {/* Availability Check */}
                <div className="border-t pt-6">
                  <Button
                    onClick={handleCheckAvailability}
                    disabled={!formData.bookingDate || availabilityMutation.isPending}
                    variant="outline"
                    className="w-full mb-4"
                  >
                    {availabilityMutation.isPending ? (
                      <>
                        <LoadingSpinner />
                        Checking Availability...
                      </>
                    ) : (
                      <>
                        <Clock className="h-4 w-4 mr-2" />
                        Check Availability
                      </>
                    )}
                  </Button>

                  {availabilityChecked && (
                    <div className="bg-green-50 border border-green-200 rounded-lg p-4 mb-4">
                      <div className="flex items-center gap-2 text-green-700">
                        <CheckCircle className="h-5 w-5" />
                        <span className="font-medium">Available!</span>
                      </div>
                      <p className="text-green-600 text-sm mt-1">
                        This service is available for your selected date and time.
                      </p>
                    </div>
                  )}
                </div>
              </div>
            </Card>
          </div>

          {/* Booking Summary */}
          <div className="space-y-6">
            <Card className="p-6 sticky top-6">
              <h3 className="text-lg font-semibold text-gray-900 mb-4">Booking Summary</h3>
              
              <div className="space-y-4 mb-6">
                <div className="flex justify-between">
                  <span className="text-gray-600">Service Price</span>
                  <span>{formatCurrency(service.price, service.currency || 'INR')}</span>
                </div>
                
                <div className="flex justify-between">
                  <span className="text-gray-600">Number of People</span>
                  <span>{formData.numberOfPeople}</span>
                </div>
                
                {service.duration && (
                  <div className="flex justify-between">
                    <span className="text-gray-600">Duration</span>
                    <span>{service.durationDisplay || `${service.duration} min`}</span>
                  </div>
                )}
                
                <hr className="border-gray-200" />
                
                <div className="flex justify-between text-lg font-semibold">
                  <span>Total Amount</span>
                  <span className="text-green-600">
                    {formatCurrency(calculateTotal(), service.currency || 'INR')}
                  </span>
                </div>
              </div>

              <Button
                onClick={handleBookService}
                disabled={!availabilityChecked || bookingMutation.isPending}
                className="w-full bg-blue-600 hover:bg-blue-700"
                size="lg"
              >
                {bookingMutation.isPending ? (
                  <>
                    <LoadingSpinner />
                    Processing...
                  </>
                ) : (
                  <>
                    <CreditCard className="h-5 w-5 mr-2" />
                    Confirm Booking
                  </>
                )}
              </Button>

              {!availabilityChecked && (
                <p className="text-xs text-gray-500 mt-2 text-center">
                  Please check availability before booking
                </p>
              )}

              {/* Service Information */}
              <div className="border-t pt-4 mt-6">
                <h4 className="font-medium text-gray-900 mb-3">Service Information</h4>
                
                {service.operatingHoursDisplay && (
                  <div className="flex items-center gap-2 mb-2 text-sm text-gray-600">
                    <Clock className="h-4 w-4" />
                    <span>{service.operatingHoursDisplay}</span>
                  </div>
                )}
                
                {service.contactInfo?.phone && (
                  <div className="flex items-center gap-2 mb-2 text-sm text-gray-600">
                    <span>📞</span>
                    <span>{service.contactInfo.phone}</span>
                  </div>
                )}
                
                {service.specialInstructions && (
                  <div className="bg-yellow-50 border border-yellow-200 rounded p-3 mt-4">
                    <p className="text-yellow-800 text-sm">
                      <strong>Note:</strong> {service.specialInstructions}
                    </p>
                  </div>
                )}
              </div>
            </Card>
          </div>
        </div>
      </div>
    </div>
  );
};

export default withErrorBoundary(ServiceBookingPage, { level: 'page' });