import React, { useState, useMemo } from 'react';
import { useParams, useNavigate, useSearchParams } from 'react-router-dom';
import { useQuery } from '@tanstack/react-query';
import {
  Star,
  Clock,
  MapPin,
  Users,
  Calendar,
  Phone,
  Mail,
  Heart,
  HeartOff,
  CheckCircle,
  AlertCircle
} from 'lucide-react';
import { hotelServicesService } from '../../services/hotelServicesService';
import { Card } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { LoadingSpinner } from '../../components/LoadingSpinner';
import BackButton from '../../components/ui/BackButton';
import { formatCurrency } from '../../utils/formatters';
import toast from 'react-hot-toast';
import { withErrorBoundary } from '../../components/ErrorBoundary';
import { resolvePublicHotelId } from '../../utils/publicBookingHotel';

const ServiceDetailsPage: React.FC = () => {
  const { serviceId } = useParams<{ serviceId: string }>();
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const publicHotelId = useMemo(() => resolvePublicHotelId(searchParams), [searchParams]);
  const [isFavorite, setIsFavorite] = useState(false);
  const [currentImageIndex, setCurrentImageIndex] = useState(0);

  // Fetch service details
  const { data: service, isLoading, error } = useQuery({
    queryKey: ['service-details', publicHotelId, serviceId],
    queryFn: () => hotelServicesService.getServiceDetails(serviceId!, publicHotelId),
    enabled: !!serviceId,
  });

  React.useEffect(() => {
    if (serviceId) {
      // Check if service is in favorites via API
      hotelServicesService.getFavorites(publicHotelId)
        .then((ids) => {
          setIsFavorite(Array.isArray(ids) && ids.includes(serviceId));
        })
        .catch(() => {
          setIsFavorite(false);
        });
    }
  }, [serviceId, publicHotelId]);

  const toggleFavorite = async () => {
    if (!serviceId) return;

    try {
      if (isFavorite) {
        await hotelServicesService.removeFavorite(serviceId, publicHotelId);
        setIsFavorite(false);
        toast.success('Removed from favorites');
      } else {
        await hotelServicesService.addFavorite(serviceId, publicHotelId);
        setIsFavorite(true);
        toast.success('Added to favorites');
      }
    } catch (error) {
      console.error('Failed to update favorite:', error);
      toast.error('Failed to update favorite');
    }
  };

  const handleBookNow = () => {
    if (serviceId) {
      navigate(`/app/services/${serviceId}/book`);
    }
  };

  const getServiceTypeIcon = (type: string) => {
    const icons = {
      dining: '🍽️',
      spa: '🧖‍♀️',
      gym: '💪',
      transport: '🚗',
      entertainment: '🎭',
      business: '💼',
      wellness: '🌿',
      recreation: '🎯'
    };
    return icons[type as keyof typeof icons] || '🏨';
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
          <BackButton to="/app/services" label="Back to Services" className="mb-6" />
          <Card className="p-8 text-center">
            <AlertCircle className="h-16 w-16 text-red-500 mx-auto mb-4" />
            <h2 className="text-xl font-semibold text-gray-900 mb-2">Service Not Found</h2>
            <p className="text-gray-600 mb-4">
              The service you're looking for doesn't exist or has been removed.
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
      <div className="max-w-6xl mx-auto">
        {/* Header */}
        <div className="mb-6">
          <BackButton to="/app/services" label="Back to Services" className="mb-4" />
        </div>

        <div className="grid lg:grid-cols-3 gap-8">
          {/* Main Content */}
          <div className="lg:col-span-2 space-y-6">
            {/* Image Gallery */}
            {service.images && service.images.length > 0 && (
              <Card className="overflow-hidden">
                <div className="aspect-video bg-gray-200 relative">
                  <img
                    src={service.images[currentImageIndex]}
                    alt={service.name}
                    className="w-full h-full object-cover"
                    onError={(e) => {
                      (e.target as HTMLImageElement).src = '/placeholder-service.jpg';
                    }}
                  />
                  {service.images.length > 1 && (
                    <div className="absolute bottom-4 left-1/2 transform -translate-x-1/2 flex gap-2">
                      {service.images.map((_, index) => (
                        <button
                          key={`service-images-${index}`}
                          onClick={() => setCurrentImageIndex(index)}
                          className={`w-3 h-3 rounded-full transition-colors ${
                            index === currentImageIndex 
                              ? 'bg-white' 
                              : 'bg-white/50 hover:bg-white/75'
                          }`}
                        />
                      ))}
                    </div>
                  )}
                </div>
              </Card>
            )}

            {/* Service Information */}
            <Card className="p-6">
              <div className="flex items-start justify-between mb-4">
                <div className="flex items-center gap-3">
                  <span className="text-3xl">{getServiceTypeIcon(service.type)}</span>
                  <div>
                    <h1 className="text-2xl font-bold text-gray-900">{service.name}</h1>
                    <span className="inline-block px-3 py-1 bg-blue-100 text-blue-800 text-sm rounded-full mt-2">
                      {service.type.charAt(0).toUpperCase() + service.type.slice(1)}
                    </span>
                  </div>
                </div>
                
                <button aria-label={isFavorite ? 'Remove from favorites' : 'Add to favorites'}
                  onClick={toggleFavorite}
                  className={`p-3 rounded-full transition-colors ${
                    isFavorite
                      ? 'bg-red-50 text-red-500 hover:bg-red-100'
                      : 'bg-gray-50 text-gray-400 hover:bg-gray-100 hover:text-red-500'
                  }`}
                >
                  {isFavorite ? <Heart className="h-6 w-6 fill-current" /> : <HeartOff className="h-6 w-6" />}
                </button>
              </div>

              <div className="flex items-center gap-6 mb-4">
                {service.rating && (
                  <div className="flex items-center gap-1">
                    <Star className="h-5 w-5 text-yellow-400 fill-current" />
                    <span className="font-medium">{service.rating.average.toFixed(1)}</span>
                    <span className="text-gray-500">({service.rating.count} reviews)</span>
                  </div>
                )}
                
                <div className="text-2xl font-bold text-green-600">
                  {formatCurrency(service.price, service.currency || 'INR')}
                  {service.durationDisplay && (
                    <span className="text-sm font-normal text-gray-500 ml-1">
                      / {service.durationDisplay}
                    </span>
                  )}
                </div>
              </div>

              <p className="text-gray-700 leading-relaxed mb-6">{service.description}</p>

              {/* Service Details */}
              <div className="grid md:grid-cols-2 gap-4">
                {service.duration && (
                  <div className="flex items-center gap-3">
                    <Clock className="h-5 w-5 text-gray-400" />
                    <div>
                      <div className="font-medium">Duration</div>
                      <div className="text-gray-600">{service.durationDisplay || `${service.duration} minutes`}</div>
                    </div>
                  </div>
                )}

                {service.capacity && (
                  <div className="flex items-center gap-3">
                    <Users className="h-5 w-5 text-gray-400" />
                    <div>
                      <div className="font-medium">Capacity</div>
                      <div className="text-gray-600">Up to {service.capacity} people</div>
                    </div>
                  </div>
                )}

                {service.location && (
                  <div className="flex items-center gap-3">
                    <MapPin className="h-5 w-5 text-gray-400" />
                    <div>
                      <div className="font-medium">Location</div>
                      <div className="text-gray-600">{service.location}</div>
                    </div>
                  </div>
                )}

                {service.operatingHoursDisplay && (
                  <div className="flex items-center gap-3">
                    <Clock className="h-5 w-5 text-gray-400" />
                    <div>
                      <div className="font-medium">Hours</div>
                      <div className="text-gray-600">{service.operatingHoursDisplay}</div>
                    </div>
                  </div>
                )}
              </div>

              {/* Amenities */}
              {service.amenities && service.amenities.length > 0 && (
                <div className="mt-6">
                  <h3 className="font-semibold text-gray-900 mb-3">Amenities & Features</h3>
                  <div className="flex flex-wrap gap-2">
                    {service.amenities.map((amenity, index) => (
                      <span
                        key={`service-amenities-${index}-${amenity}`}
                        className="inline-flex items-center gap-1 px-3 py-1 bg-green-50 text-green-700 text-sm rounded-full"
                      >
                        <CheckCircle className="h-3 w-3" />
                        {amenity}
                      </span>
                    ))}
                  </div>
                </div>
              )}

              {/* Special Instructions */}
              {service.specialInstructions && (
                <div className="mt-6">
                  <h3 className="font-semibold text-gray-900 mb-3">Special Instructions</h3>
                  <div className="bg-yellow-50 border border-yellow-200 rounded-lg p-4">
                    <p className="text-yellow-800">{service.specialInstructions}</p>
                  </div>
                </div>
              )}
            </Card>
          </div>

          {/* Sidebar */}
          <div className="space-y-6">
            {/* Booking Card */}
            <Card className="p-6 sticky top-6">
              <h2 className="text-xl font-semibold text-gray-900 mb-4">Book This Service</h2>
              
              <div className="text-center mb-6">
                <div className="text-3xl font-bold text-green-600 mb-2">
                  {formatCurrency(service.price, service.currency || 'INR')}
                </div>
                {service.durationDisplay && (
                  <div className="text-gray-500">per {service.durationDisplay}</div>
                )}
              </div>

              <Button 
                onClick={handleBookNow} 
                className="w-full mb-4 bg-blue-600 hover:bg-blue-700"
                size="lg"
              >
                <Calendar className="h-5 w-5 mr-2" />
                Book Now
              </Button>

              {/* Contact Information */}
              {(service.contactInfo?.phone || service.contactInfo?.email) && (
                <div className="border-t pt-4">
                  <h3 className="font-medium text-gray-900 mb-3">Contact</h3>
                  {service.contactInfo.phone && (
                    <div className="flex items-center gap-2 mb-2">
                      <Phone className="h-4 w-4 text-gray-400" />
                      <span className="text-sm">{service.contactInfo.phone}</span>
                    </div>
                  )}
                  {service.contactInfo.email && (
                    <div className="flex items-center gap-2">
                      <Mail className="h-4 w-4 text-gray-400" />
                      <span className="text-sm">{service.contactInfo.email}</span>
                    </div>
                  )}
                </div>
              )}
            </Card>

            {/* Service Tags */}
            {service.tags && service.tags.length > 0 && (
              <Card className="p-6">
                <h3 className="font-semibold text-gray-900 mb-3">Tags</h3>
                <div className="flex flex-wrap gap-2">
                  {service.tags.map((tag, index) => (
                    <span
                      key={`service-tags-${index}-${tag}`}
                      className="px-2 py-1 bg-gray-100 text-gray-700 text-sm rounded"
                    >
                      {tag}
                    </span>
                  ))}
                </div>
              </Card>
            )}
          </div>
        </div>
      </div>
    </div>
  );
};

export default withErrorBoundary(ServiceDetailsPage, { level: 'page' });