import React from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { useQuery } from '@tanstack/react-query';
import { 
  CheckCircle,
  AlertCircle,
  Calendar,
  Clock,
  Users,
  MapPin,
  Mail,
  Phone,
  Download,
  Share2,
  Home,
  ArrowRight
} from 'lucide-react';
import { hotelServicesService } from '../../services/hotelServicesService';
import { Card } from '../../components/ui/card';
import { Button } from '../../components/ui/button';
import { LoadingSpinner } from '../../components/LoadingSpinner';
import { formatCurrency } from '../../utils/formatters';
import toast from 'react-hot-toast';
import { withErrorBoundary } from '../../components/ErrorBoundary';

const ServiceBookingConfirmation: React.FC = () => {
  const { bookingId } = useParams<{ bookingId: string }>();
  const navigate = useNavigate();

  // Fetch booking details
  const { data: booking, isLoading, error } = useQuery({
    queryKey: ['booking-details', bookingId],
    queryFn: () => hotelServicesService.getBooking(bookingId!),
    enabled: !!bookingId,
    staleTime: 10 * 60 * 1000 // 10 minutes
  });

  const formatDateTime = (dateString: string) => {
    const date = new Date(dateString);
    return {
      date: date.toLocaleDateString('en-US', {
        weekday: 'long',
        year: 'numeric',
        month: 'long',
        day: 'numeric'
      }),
      time: date.toLocaleTimeString('en-US', {
        hour: '2-digit',
        minute: '2-digit'
      })
    };
  };

  const handleShare = async () => {
    if (navigator.share && booking) {
      try {
        await navigator.share({
          title: 'Service Booking Confirmation',
          text: `My booking for ${booking.serviceId.name} has been confirmed!`,
          url: window.location.href
        });
      } catch (error) {
        // Fallback to clipboard
        handleCopyLink();
      }
    } else {
      handleCopyLink();
    }
  };

  const handleCopyLink = () => {
    navigator.clipboard.writeText(window.location.href);
    toast.success('Link copied to clipboard!');
  };

  const handleDownloadReceipt = () => {
    if (!booking) return;

    const bookingDateTime = formatDateTime(booking.bookingDate);
    const hotelName = booking.hotelId?.name || 'Hotel';
    const receiptContent = `
${hotelName} - Service Booking Receipt
==========================================

Booking ID: ${booking._id}
Date Generated: ${new Date().toLocaleDateString()}

Service Details:
- Service: ${booking.serviceId.name}
- Type: ${booking.serviceId.type}
- Date: ${bookingDateTime.date}
- Time: ${bookingDateTime.time}
- Number of People: ${booking.numberOfPeople}

Booking Information:
- Status: ${booking.status}
- Total Amount: ${formatCurrency(booking.totalAmount, booking.currency)}
- Payment Status: ${booking.paymentStatus}
- Booked On: ${new Date(booking.createdAt).toLocaleDateString()}

${booking.specialRequests ? `Special Requests: ${booking.specialRequests}` : ''}

Hotel Information:
- Hotel: ${booking.hotelId.name}

Thank you for choosing ${hotelName}!
For any queries, please contact us.
    `.trim();

    // Create and download the receipt as a text file
    const blob = new Blob([receiptContent], { type: 'text/plain' });
    const url = window.URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = `receipt-${booking._id}.txt`;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    window.URL.revokeObjectURL(url);

    toast.success('Receipt downloaded successfully!');
  };

  const getTimeUntilBooking = (bookingDate: string) => {
    const now = new Date();
    const booking = new Date(bookingDate);
    const diff = booking.getTime() - now.getTime();
    
    if (diff <= 0) return 'Today or Past';
    
    const days = Math.floor(diff / (1000 * 60 * 60 * 24));
    const hours = Math.floor((diff % (1000 * 60 * 60 * 24)) / (1000 * 60 * 60));
    
    if (days > 0) {
      return `${days} day${days > 1 ? 's' : ''} ${hours > 0 ? `and ${hours} hour${hours > 1 ? 's' : ''}` : ''}`;
    } else {
      return `${hours} hour${hours > 1 ? 's' : ''}`;
    }
  };

  if (isLoading) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center">
        <LoadingSpinner />
      </div>
    );
  }

  if (error || !booking) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center p-6">
        <Card className="max-w-md w-full p-8 text-center">
          <div className="text-red-500 mb-4">
            <AlertCircle className="h-16 w-16 mx-auto" />
          </div>
          <h2 className="text-xl font-semibold text-gray-900 mb-2">Booking Not Found</h2>
          <p className="text-gray-600 mb-6">
            We couldn't find the booking you're looking for. It may have been removed or the link may be invalid.
          </p>
          <div className="space-y-2">
            <Button onClick={() => navigate('/app/services/bookings')} className="w-full">
              View My Bookings
            </Button>
            <Button variant="outline" onClick={() => navigate('/app/services')} className="w-full">
              Browse Services
            </Button>
          </div>
        </Card>
      </div>
    );
  }

  const bookingDateTime = formatDateTime(booking.bookingDate);

  return (
    <div className="min-h-screen bg-gray-50 p-6">
      <div className="max-w-4xl mx-auto">
        {/* Success Header */}
        <div className="text-center mb-8">
          <div className="inline-flex items-center justify-center w-20 h-20 bg-green-100 rounded-full mb-4">
            <CheckCircle className="h-12 w-12 text-green-600" />
          </div>
          <h1 className="text-3xl font-bold text-gray-900 mb-2">
            {booking?.status === 'confirmed' ? 'Booking Confirmed!' : booking?.status === 'pending' ? 'Booking Submitted!' : 'Booking Received!'}
          </h1>
          <p className="text-lg text-gray-600 max-w-2xl mx-auto">
            Your booking has been recorded. Check your bookings page for status updates.
          </p>
        </div>

        <div className="grid lg:grid-cols-3 gap-8">
          {/* Main Booking Details */}
          <div className="lg:col-span-2 space-y-6">
            {/* Service Information */}
            <Card className="p-6">
              <h2 className="text-xl font-semibold text-gray-900 mb-4">Service Details</h2>
              
              <div className="flex items-start gap-4">
                <div className="w-20 h-20 bg-gray-200 rounded-lg overflow-hidden flex-shrink-0">
                  {booking.serviceId.images && booking.serviceId.images.length > 0 ? (
                    <img
                      src={booking.serviceId.images[0]}
                      alt={booking.serviceId.name}
                      className="w-full h-full object-cover"
                    />
                  ) : (
                    <div className="w-full h-full flex items-center justify-center text-gray-400">
                      <span className="text-3xl">
                        {hotelServicesService.getServiceTypeInfo(booking.serviceId.type).icon}
                      </span>
                    </div>
                  )}
                </div>

                <div className="flex-1">
                  <h3 className="text-xl font-semibold text-gray-900 mb-2">
                    {booking.serviceId.name}
                  </h3>
                  <span className="inline-block px-3 py-1 bg-blue-100 text-blue-800 text-sm rounded-full mb-3">
                    {booking.serviceId.type.charAt(0).toUpperCase() + booking.serviceId.type.slice(1)}
                  </span>
                  
                  {booking.serviceId.description && (
                    <p className="text-gray-600 text-sm">
                      {booking.serviceId.description}
                    </p>
                  )}
                </div>
              </div>
            </Card>

            {/* Booking Information */}
            <Card className="p-6">
              <h2 className="text-xl font-semibold text-gray-900 mb-4">Booking Information</h2>
              
              <div className="grid md:grid-cols-2 gap-6">
                <div className="space-y-4">
                  <div className="flex items-center gap-3">
                    <Calendar className="h-5 w-5 text-gray-400" />
                    <div>
                      <div className="font-medium text-gray-900">Date</div>
                      <div className="text-gray-600">{bookingDateTime.date}</div>
                    </div>
                  </div>

                  <div className="flex items-center gap-3">
                    <Clock className="h-5 w-5 text-gray-400" />
                    <div>
                      <div className="font-medium text-gray-900">Time</div>
                      <div className="text-gray-600">{bookingDateTime.time}</div>
                    </div>
                  </div>
                </div>

                <div className="space-y-4">
                  <div className="flex items-center gap-3">
                    <Users className="h-5 w-5 text-gray-400" />
                    <div>
                      <div className="font-medium text-gray-900">People</div>
                      <div className="text-gray-600">{booking.numberOfPeople} person{booking.numberOfPeople > 1 ? 's' : ''}</div>
                    </div>
                  </div>

                  {booking.hotelId?.name && (
                    <div className="flex items-center gap-3">
                      <MapPin className="h-5 w-5 text-gray-400" />
                      <div>
                        <div className="font-medium text-gray-900">Location</div>
                        <div className="text-gray-600">{booking.hotelId.name}</div>
                      </div>
                    </div>
                  )}
                </div>
              </div>

              {/* Special Requests */}
              {booking.specialRequests && (
                <div className="mt-6 pt-6 border-t border-gray-200">
                  <h3 className="font-medium text-gray-900 mb-2">Special Requests</h3>
                  <div className="bg-gray-50 rounded-lg p-4">
                    <p className="text-gray-700">{booking.specialRequests}</p>
                  </div>
                </div>
              )}
            </Card>

            {/* Payment Information */}
            <Card className="p-6">
              <h2 className="text-xl font-semibold text-gray-900 mb-4">Payment Details</h2>
              
              <div className="space-y-4">
                <div className="flex justify-between items-center">
                  <span className="text-gray-600">Service Price ({booking.numberOfPeople} person{booking.numberOfPeople > 1 ? 's' : ''})</span>
                  <span className="font-medium">
                    {formatCurrency(booking.serviceId.price * booking.numberOfPeople, booking.currency)}
                  </span>
                </div>
                
                <div className="border-t pt-4">
                  <div className="flex justify-between items-center text-lg font-semibold">
                    <span>Total Amount</span>
                    <span className="text-green-600">
                      {formatCurrency(booking.totalAmount, booking.currency)}
                    </span>
                  </div>
                </div>

                <div className="bg-green-50 border border-green-200 rounded-lg p-4 mt-4">
                  <div className="flex items-center gap-2">
                    <CheckCircle className="h-5 w-5 text-green-600" />
                    <span className="font-medium text-green-800">Payment Status: {booking.paymentStatus || 'pending'}</span>
                  </div>
                  <p className="text-green-700 text-sm mt-1">
                    Your booking has been confirmed. Payment settlement status is shown above.
                  </p>
                </div>
              </div>
            </Card>
          </div>

          {/* Sidebar */}
          <div className="space-y-6">
            {/* Booking Status Card */}
            <Card className="p-6">
              <h3 className="text-lg font-semibold text-gray-900 mb-4">Booking Status</h3>
              
              <div className="text-center mb-4">
                <div className={`inline-flex items-center gap-2 px-4 py-2 rounded-full text-sm font-medium ${
                  booking.status === 'confirmed' ? 'bg-green-100 text-green-800' :
                  booking.status === 'pending' ? 'bg-yellow-100 text-yellow-800' :
                  'bg-blue-100 text-blue-800'
                }`}>
                  <CheckCircle className="h-4 w-4" />
                  {booking.status?.charAt(0).toUpperCase() + booking.status?.slice(1) || 'Pending'}
                </div>
              </div>

              <div className="space-y-3 text-sm">
                <div>
                  <span className="font-medium text-gray-900">Booking ID:</span>
                  <p className="text-gray-600 font-mono">{booking._id}</p>
                </div>
                
                <div>
                  <span className="font-medium text-gray-900">Time until service:</span>
                  <p className="text-gray-600">{getTimeUntilBooking(booking.bookingDate)}</p>
                </div>
                
                <div>
                  <span className="font-medium text-gray-900">Booked on:</span>
                  <p className="text-gray-600">
                    {new Date(booking.createdAt).toLocaleDateString()}
                  </p>
                </div>
              </div>
            </Card>

            {/* Contact Information */}
            {(booking.serviceId.contactInfo?.phone || booking.serviceId.contactInfo?.email) && (
              <Card className="p-6">
                <h3 className="text-lg font-semibold text-gray-900 mb-4">Contact Information</h3>
                
                <div className="space-y-3">
                  {booking.serviceId.contactInfo.phone && (
                    <div className="flex items-center gap-2">
                      <Phone className="h-4 w-4 text-gray-400" />
                      <span className="text-sm text-gray-600">{booking.serviceId.contactInfo.phone}</span>
                    </div>
                  )}
                  
                  {booking.serviceId.contactInfo.email && (
                    <div className="flex items-center gap-2">
                      <Mail className="h-4 w-4 text-gray-400" />
                      <span className="text-sm text-gray-600">{booking.serviceId.contactInfo.email}</span>
                    </div>
                  )}
                </div>

                <p className="text-xs text-gray-500 mt-4">
                  Contact the service provider if you need to make any changes or have questions about your booking.
                </p>
              </Card>
            )}

            {/* Quick Actions */}
            <Card className="p-6">
              <h3 className="text-lg font-semibold text-gray-900 mb-4">Quick Actions</h3>
              
              <div className="space-y-3">
                <Button 
                  variant="outline" 
                  size="sm" 
                  className="w-full justify-start"
                  onClick={handleDownloadReceipt}
                >
                  <Download className="h-4 w-4 mr-2" />
                  Download Receipt
                </Button>
                
                <Button 
                  variant="outline" 
                  size="sm" 
                  className="w-full justify-start"
                  onClick={handleShare}
                >
                  <Share2 className="h-4 w-4 mr-2" />
                  Share Booking
                </Button>
                
                <Button 
                  variant="outline" 
                  size="sm" 
                  className="w-full justify-start"
                  onClick={() => navigate('/app/services/bookings')}
                >
                  <Calendar className="h-4 w-4 mr-2" />
                  View All Bookings
                </Button>
              </div>
            </Card>
          </div>
        </div>

        {/* Navigation Actions */}
        <div className="mt-12 text-center">
          <div className="flex flex-col sm:flex-row gap-4 justify-center">
            <Button 
              onClick={() => navigate('/app/services')}
              variant="outline"
              size="lg"
            >
              <Home className="h-5 w-5 mr-2" />
              Browse More Services
            </Button>
            
            <Button 
              onClick={() => navigate('/app')}
              size="lg"
            >
              Go to Dashboard
              <ArrowRight className="h-5 w-5 ml-2" />
            </Button>
          </div>
        </div>

        {/* Important Notice */}
        <Card className="mt-8 p-6 bg-blue-50 border-blue-200">
          <div className="flex items-start gap-3">
            <div className="flex-shrink-0">
              <CheckCircle className="h-6 w-6 text-blue-600" />
            </div>
            <div>
              <h3 className="font-medium text-blue-900 mb-2">Important Reminders</h3>
              <ul className="text-blue-800 text-sm space-y-1">
                <li>• Please arrive 15 minutes before your scheduled time</li>
                <li>• Bring a valid ID for verification</li>
                <li>• You can cancel or modify your booking up to 24 hours in advance</li>
                <li>• Check your email for detailed instructions and directions</li>
              </ul>
            </div>
          </div>
        </Card>
      </div>
    </div>
  );
};

export default withErrorBoundary(ServiceBookingConfirmation, { level: 'page' });