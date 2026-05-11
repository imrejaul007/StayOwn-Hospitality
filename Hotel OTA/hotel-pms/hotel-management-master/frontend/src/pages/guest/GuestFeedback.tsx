import React, { useState, useEffect } from 'react';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { useAuth } from '../../context/AuthContext';
import { bookingService } from '../../services/bookingService';
import { reviewService } from '../../services/reviewService';
import { useRealTime } from '../../services/realTimeService';
import { Booking } from '../../types/booking';
import { Review } from '../../services/reviewService';
import {
  Star,
  MessageSquare,
  Calendar,
  MapPin,
  Users,
  CheckCircle,
  Send,
  ChevronLeft,
  ChevronRight,
  Clock,
  Eye,
  EyeOff,
  MessageCircle,
  ThumbsUp
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Card } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { LoadingSpinner } from '../../components/LoadingSpinner';
import { formatDate } from '../../utils/formatters';
import toast from 'react-hot-toast';
import { withErrorBoundary } from '../../components/ErrorBoundary';

interface CheckedOutBooking extends Omit<Booking, 'hotelId'> {
  hotelId: {
    _id: string;
    name: string;
    address?: {
      street: string;
      city: string;
      state: string;
    };
  };
}

interface SafeHotelInfo {
  _id: string;
  name: string;
  city: string;
}

interface FeedbackForm {
  bookingId: string;
  rating: number;
  title: string;
  content: string;
  categories: {
    cleanliness: number;
    service: number;
    location: number;
    value: number;
    amenities: number;
  };
  visitType: 'business' | 'leisure' | 'family' | 'couple' | 'solo';
  isAnonymous: boolean;
}

interface PaginationInfo {
  page: number;
  limit: number;
  total: number;
  pages: number;
}

const toSafeHotelInfo = (hotelId: unknown): SafeHotelInfo => {
  if (hotelId && typeof hotelId === 'object') {
    const hotel = hotelId as {
      _id?: string;
      name?: string;
      address?: { city?: string };
    };
    return {
      _id: typeof hotel._id === 'string' ? hotel._id : '',
      name: typeof hotel.name === 'string' && hotel.name.trim() ? hotel.name : 'Hotel',
      city: typeof hotel.address?.city === 'string' && hotel.address.city.trim() ? hotel.address.city : 'Location'
    };
  }

  if (typeof hotelId === 'string') {
    return { _id: hotelId, name: 'Hotel', city: 'Location' };
  }

  return { _id: '', name: 'Hotel', city: 'Location' };
};

function GuestFeedback() {
  const { user } = useAuth();
  const { on, off } = useRealTime();
  const [submitting, setSubmitting] = useState(false);
  const [selectedBooking, setSelectedBooking] = useState<CheckedOutBooking | null>(null);
  const [showFeedbackForm, setShowFeedbackForm] = useState(false);
  const [activeTab, setActiveTab] = useState<'leave' | 'history'>('leave');

  // Feedback history state
  const [reviewsPage, setReviewsPage] = useState(1);
  const queryClient = useQueryClient();

  // Bookings pagination state
  const BOOKINGS_PER_PAGE = 10;
  const [bookingsPage, setBookingsPage] = useState(1);

  const [feedbackForm, setFeedbackForm] = useState<FeedbackForm>({
    bookingId: '',
    rating: 0,
    title: '',
    content: '',
    categories: {
      cleanliness: 0,
      service: 0,
      location: 0,
      value: 0,
      amenities: 0
    },
    visitType: 'leisure',
    isAnonymous: false
  });

  // Fetch checked-out bookings via TanStack Query
  const { data: bookingsData, isLoading: bookingsLoading, error: bookingsError, refetch: refetchBookings } = useQuery({
    queryKey: ['feedback-bookings', bookingsPage],
    queryFn: async () => {
      const response = await bookingService.getUserBookings({
        status: 'checked_out',
        page: bookingsPage,
        limit: BOOKINGS_PER_PAGE
      });
      const bookings = Array.isArray(response.data?.bookings) ? response.data.bookings :
                      Array.isArray(response.data) ? response.data : [];

      // Server already returned only checked_out bookings; cast directly
      const checkedOut = bookings as CheckedOutBooking[];

      const pagination: PaginationInfo = response.pagination
        ? {
            page: response.pagination.page || bookingsPage,
            limit: response.pagination.limit || BOOKINGS_PER_PAGE,
            total: response.pagination.total || 0,
            pages: response.pagination.pages || 0
          }
        : {
            page: bookingsPage,
            limit: BOOKINGS_PER_PAGE,
            total: checkedOut.length,
            pages: checkedOut.length >= BOOKINGS_PER_PAGE ? bookingsPage + 1 : bookingsPage
          };

      return { bookings: checkedOut, pagination };
    },
    enabled: !!user && activeTab === 'leave',
    staleTime: 5 * 60 * 1000,
    placeholderData: (prev: unknown) => prev,
  });

  const checkedOutBookings = bookingsData?.bookings || [];
  const bookingsPagination: PaginationInfo = bookingsData?.pagination || {
    page: 1, limit: BOOKINGS_PER_PAGE, total: 0, pages: 0
  };

  // Fetch reviews via TanStack Query
  const { data: reviewsData, isLoading: reviewsLoading } = useQuery({
    queryKey: ['my-reviews', reviewsPage],
    queryFn: async () => {
      const response = await reviewService.getMyReviews({ page: reviewsPage, limit: 10 });
      return response;
    },
    enabled: !!user && activeTab === 'history',
    staleTime: 5 * 60 * 1000,
    placeholderData: (prev: unknown) => prev,
  });

  const myReviews = reviewsData?.reviews || [];
  const reviewsPagination: PaginationInfo = reviewsData?.pagination || { page: 1, limit: 10, total: 0, pages: 0 };

  // Real-time updates for review responses and moderation changes
  useEffect(() => {
    const handleReviewUpdate = () => {
      queryClient.invalidateQueries({ queryKey: ['my-reviews'] });
    };

    on('review:responded', handleReviewUpdate);
    on('review:moderation_updated', handleReviewUpdate);
    on('review:updated', handleReviewUpdate);

    return () => {
      off('review:responded', handleReviewUpdate);
      off('review:moderation_updated', handleReviewUpdate);
      off('review:updated', handleReviewUpdate);
    };
  }, [on, off, queryClient]);

  const handleStartFeedback = (booking: CheckedOutBooking) => {
    setSelectedBooking(booking);
    setFeedbackForm(prev => ({
      ...prev,
      bookingId: booking._id
    }));
    setShowFeedbackForm(true);
  };

  const handleSubmitFeedback = async (e: React.FormEvent) => {
    e.preventDefault();

    if (submitting) return; // Prevent double-submit

    if (!feedbackForm.title.trim() || !feedbackForm.content.trim()) {
      toast.error('Please fill in all required fields');
      return;
    }

    if (feedbackForm.rating < 1 || feedbackForm.rating > 5) {
      toast.error('Please select an overall rating between 1 and 5 stars');
      return;
    }

    // Validate category ratings -- all must be set (1-5)
    const unratedCategories = Object.entries(feedbackForm.categories)
      .filter(([, value]) => value < 1 || value > 5);
    if (unratedCategories.length > 0) {
      toast.error('Please rate all categories (1-5 stars)');
      return;
    }

    try {
      setSubmitting(true);
      const selectedHotel = toSafeHotelInfo(selectedBooking?.hotelId);
      if (!selectedHotel._id) {
        throw new Error('Invalid booking details. Please re-open the feedback form.');
      }

      await reviewService.createReview({
        hotelId: selectedHotel._id,
        bookingId: feedbackForm.bookingId,
        rating: feedbackForm.rating,
        title: feedbackForm.title.trim(),
        content: feedbackForm.content.trim(),
        categories: feedbackForm.categories,
        visitType: feedbackForm.visitType,
        stayDate: selectedBooking.checkOut,
        isAnonymous: feedbackForm.isAnonymous
      });

      toast.success('Thank you for your feedback!');
      setShowFeedbackForm(false);
      setSelectedBooking(null);
      resetForm();
      refetchBookings(); // Refresh to show updated status
      // Also refresh reviews history
      queryClient.invalidateQueries({ queryKey: ['my-reviews'] });
    } catch (error: unknown) {
      const message = error instanceof Error ? error.message : 'Failed to submit feedback. Please try again.';
      toast.error(message);
    } finally {
      setSubmitting(false);
    }
  };

  const resetForm = () => {
    setFeedbackForm({
      bookingId: '',
      rating: 0,
      title: '',
      content: '',
      categories: {
        cleanliness: 0,
        service: 0,
        location: 0,
        value: 0,
        amenities: 0
      },
      visitType: 'leisure',
      isAnonymous: false
    });
  };

  const updateCategoryRating = (category: keyof typeof feedbackForm.categories, rating: number) => {
    const clampedRating = Math.max(1, Math.min(5, rating));
    setFeedbackForm(prev => ({
      ...prev,
      categories: {
        ...prev.categories,
        [category]: clampedRating
      }
    }));
  };

  const handleReviewsPageChange = (newPage: number) => {
    setReviewsPage(newPage);
  };

  const renderStarRating = (rating: number, size: 'sm' | 'md' = 'md') => {
    const sizeClass = size === 'sm' ? 'h-4 w-4' : 'h-5 w-5';
    return (
      <div className="flex items-center gap-0.5">
        {[1, 2, 3, 4, 5].map((star) => (
          <Star
            key={star}
            className={`${sizeClass} ${rating >= star ? 'text-yellow-400 fill-yellow-400' : 'text-gray-300'}`}
          />
        ))}
      </div>
    );
  };

  if (bookingsLoading && checkedOutBookings.length === 0) {
    return (
      <div className="flex items-center justify-center h-64">
        <LoadingSpinner size="lg" />
      </div>
    );
  }

  if (bookingsError && checkedOutBookings.length === 0) {
    const errorMessage = bookingsError instanceof Error ? bookingsError.message : 'Failed to load your bookings. Please try again.';
    return (
      <div className="flex items-center justify-center h-64">
        <div className="text-center">
          <MessageSquare className="w-16 h-16 text-red-400 mx-auto mb-4" />
          <h2 className="text-xl font-semibold text-gray-900 mb-2">Failed to load feedback data</h2>
          <p className="text-gray-600 mb-4">{errorMessage}</p>
          <Button onClick={() => refetchBookings()} variant="outline">
            Try Again
          </Button>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Feedback</h1>
          <p className="text-gray-600 mt-1">
            Share your experience or view your feedback history
          </p>
        </div>
      </div>

      {/* Tabs */}
      <div className="border-b border-gray-200">
        <nav className="flex gap-6">
          <button
            onClick={() => setActiveTab('leave')}
            className={`pb-3 text-sm font-medium border-b-2 transition-colors ${
              activeTab === 'leave'
                ? 'border-blue-500 text-blue-600'
                : 'border-transparent text-gray-500 hover:text-gray-700'
            }`}
          >
            <div className="flex items-center gap-2">
              <Send className="h-4 w-4" />
              Leave Feedback
            </div>
          </button>
          <button
            onClick={() => setActiveTab('history')}
            className={`pb-3 text-sm font-medium border-b-2 transition-colors ${
              activeTab === 'history'
                ? 'border-blue-500 text-blue-600'
                : 'border-transparent text-gray-500 hover:text-gray-700'
            }`}
          >
            <div className="flex items-center gap-2">
              <Clock className="h-4 w-4" />
              My Reviews
              {reviewsPagination.total > 0 && (
                <span className="px-1.5 py-0.5 text-xs bg-gray-100 text-gray-600 rounded-full">
                  {reviewsPagination.total}
                </span>
              )}
            </div>
          </button>
        </nav>
      </div>

      {/* Leave Feedback Tab */}
      {activeTab === 'leave' && (
        <>
          {checkedOutBookings.length === 0 ? (
            <Card className="p-8 text-center">
              <CheckCircle className="mx-auto h-12 w-12 text-green-500 mb-4" />
              <h3 className="text-lg font-medium text-gray-900 mb-2">No Completed Stays</h3>
              <p className="text-gray-500">
                You don't have any completed stays yet. Once you check out from a booking,
                you'll be able to leave feedback here.
              </p>
            </Card>
          ) : (
            <>
              <div className="grid gap-6">
                {checkedOutBookings.map((booking) => {
                  const safeHotel = toSafeHotelInfo(booking.hotelId);
                  return (
                  <Card key={booking._id} className="p-6">
                    <div className="flex items-start justify-between">
                      <div className="flex-1">
                        <div className="flex items-center gap-3 mb-2">
                          <h3 className="text-lg font-semibold text-gray-900">
                            {safeHotel.name}
                          </h3>
                          <span className="px-2 py-1 text-xs font-medium bg-green-100 text-green-800 rounded-full">
                            Completed
                          </span>
                        </div>

                        <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-4">
                          <div className="flex items-center gap-2 text-sm text-gray-600">
                            <Calendar className="h-4 w-4" />
                            <span>{formatDate(booking.checkIn)} - {formatDate(booking.checkOut)}</span>
                          </div>
                          <div className="flex items-center gap-2 text-sm text-gray-600">
                            <MapPin className="h-4 w-4" />
                            <span>{safeHotel.city}</span>
                          </div>
                          <div className="flex items-center gap-2 text-sm text-gray-600">
                            <Users className="h-4 w-4" />
                            <span>{booking.guestDetails?.adults || 1} guests</span>
                          </div>
                        </div>

                        <div className="flex items-center gap-2">
                          <span className="text-sm font-medium text-gray-700">Booking:</span>
                          <span className="text-sm text-gray-600">{booking.bookingNumber}</span>
                        </div>
                      </div>

                      <Button
                        onClick={() => handleStartFeedback(booking)}
                        className="flex items-center gap-2"
                      >
                        <MessageSquare className="h-4 w-4" />
                        Leave Feedback
                      </Button>
                    </div>
                  </Card>
                )})}
              </div>

              {/* Bookings pagination */}
              {bookingsPagination.pages > 1 && (
                <div className="flex items-center justify-center gap-2 pt-4">
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => setBookingsPage(prev => Math.max(1, prev - 1))}
                    disabled={bookingsPage <= 1}
                  >
                    <ChevronLeft className="h-4 w-4" />
                    Previous
                  </Button>
                  <span className="text-sm text-gray-600 px-3">
                    Page {bookingsPagination.page} of {bookingsPagination.pages}
                  </span>
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => setBookingsPage(prev => prev + 1)}
                    disabled={bookingsPagination.page >= bookingsPagination.pages}
                  >
                    Next
                    <ChevronRight className="h-4 w-4" />
                  </Button>
                </div>
              )}
            </>
          )}
        </>
      )}

      {/* Feedback History Tab */}
      {activeTab === 'history' && (
        <>
          {reviewsLoading ? (
            <div className="flex items-center justify-center h-48">
              <LoadingSpinner size="lg" />
            </div>
          ) : myReviews.length === 0 ? (
            <Card className="p-8 text-center">
              <MessageSquare className="mx-auto h-12 w-12 text-gray-400 mb-4" />
              <h3 className="text-lg font-medium text-gray-900 mb-2">No Reviews Yet</h3>
              <p className="text-gray-500">
                You haven't submitted any reviews yet. Complete a stay and share your experience!
              </p>
              <Button
                variant="outline"
                className="mt-4"
                onClick={() => setActiveTab('leave')}
              >
                Leave Feedback
              </Button>
            </Card>
          ) : (
            <>
              <div className="grid gap-6">
                {myReviews.map((review) => (
                  <Card key={review._id} className="p-6">
                    <div className="space-y-4">
                      {/* Review header */}
                      <div className="flex items-start justify-between">
                        <div>
                          <h3 className="text-lg font-semibold text-gray-900">
                            {typeof review.hotelId === 'object' && review.hotelId?.name
                              ? review.hotelId.name
                              : 'Hotel'}
                          </h3>
                          <div className="flex items-center gap-3 mt-1">
                            {renderStarRating(review.rating)}
                            <span className="text-sm text-gray-600">{review.rating}/5</span>
                            <span className="text-sm text-gray-400">
                              {formatDate(review.createdAt)}
                            </span>
                          </div>
                        </div>
                        <div className="flex items-center gap-2">
                          {review.isVerified && (
                            <span className="px-2 py-1 text-xs font-medium bg-blue-100 text-blue-800 rounded-full flex items-center gap-1">
                              <CheckCircle className="h-3 w-3" />
                              Verified Stay
                            </span>
                          )}
                          <span className={`px-2 py-1 text-xs font-medium rounded-full ${
                            review.moderationStatus === 'approved'
                              ? 'bg-green-100 text-green-800'
                              : review.moderationStatus === 'pending'
                              ? 'bg-yellow-100 text-yellow-800'
                              : 'bg-red-100 text-red-800'
                          }`}>
                            {review.moderationStatus === 'approved' ? 'Published' :
                             review.moderationStatus === 'pending' ? 'Pending Review' :
                             'Not Published'}
                          </span>
                        </div>
                      </div>

                      {/* Review title and content */}
                      <div>
                        <h4 className="font-medium text-gray-900">{review.title}</h4>
                        <p className="text-gray-600 mt-1">{review.content}</p>
                      </div>

                      {/* Category ratings */}
                      {review.categories && (
                        <div className="grid grid-cols-2 md:grid-cols-5 gap-3 pt-2 border-t">
                          {Object.entries(review.categories).map(([category, rating]) => (
                            rating != null && (
                              <div key={category} className="text-center">
                                <p className="text-xs text-gray-500 capitalize mb-1">{category}</p>
                                <div className="flex items-center justify-center gap-1">
                                  {renderStarRating(rating as number, 'sm')}
                                </div>
                              </div>
                            )
                          ))}
                        </div>
                      )}

                      {/* Visit type and booking info */}
                      <div className="flex items-center gap-4 text-sm text-gray-500">
                        {review.visitType && (
                          <span className="capitalize">
                            {review.visitType} trip
                          </span>
                        )}
                        {review.stayDate && (
                          <span className="flex items-center gap-1">
                            <Calendar className="h-3 w-3" />
                            Stay: {formatDate(review.stayDate)}
                          </span>
                        )}
                        {review.helpfulVotes > 0 && (
                          <span className="flex items-center gap-1">
                            <ThumbsUp className="h-3 w-3" />
                            {review.helpfulVotes} found helpful
                          </span>
                        )}
                      </div>

                      {/* Hotel response */}
                      {review.response?.content && (
                        <div className="bg-blue-50 border border-blue-200 rounded-lg p-4 mt-3">
                          <div className="flex items-center gap-2 mb-2">
                            <MessageCircle className="h-4 w-4 text-blue-600" />
                            <span className="text-sm font-medium text-blue-800">
                              Hotel Response
                            </span>
                            {review.response.respondedBy && (
                              <span className="text-xs text-blue-600">
                                by {typeof review.response.respondedBy === 'object'
                                  ? review.response.respondedBy.name
                                  : 'Hotel Staff'}
                              </span>
                            )}
                            {review.response.respondedAt && (
                              <span className="text-xs text-blue-500 ml-auto">
                                {formatDate(review.response.respondedAt)}
                              </span>
                            )}
                          </div>
                          <p className="text-sm text-blue-900">{review.response.content}</p>
                        </div>
                      )}
                    </div>
                  </Card>
                ))}
              </div>

              {/* Reviews Pagination */}
              {reviewsPagination.pages > 1 && (
                <div className="flex items-center justify-between pt-4">
                  <p className="text-sm text-gray-600">
                    Showing {((reviewsPagination.page - 1) * reviewsPagination.limit) + 1}-
                    {Math.min(reviewsPagination.page * reviewsPagination.limit, reviewsPagination.total)} of {reviewsPagination.total} reviews
                  </p>
                  <div className="flex items-center gap-2">
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => handleReviewsPageChange(reviewsPagination.page - 1)}
                      disabled={reviewsPagination.page <= 1}
                    >
                      <ChevronLeft className="h-4 w-4" />
                      Previous
                    </Button>
                    <span className="text-sm text-gray-600 px-2">
                      Page {reviewsPagination.page} of {reviewsPagination.pages}
                    </span>
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => handleReviewsPageChange(reviewsPagination.page + 1)}
                      disabled={reviewsPagination.page >= reviewsPagination.pages}
                    >
                      Next
                      <ChevronRight className="h-4 w-4" />
                    </Button>
                  </div>
                </div>
              )}
            </>
          )}
        </>
      )}

      {/* Feedback Modal */}
      {showFeedbackForm && selectedBooking && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
          <Card className="w-full max-w-2xl max-h-[90vh] overflow-y-auto">
            <div className="p-6">
              <div className="flex items-center justify-between mb-6">
                <h2 className="text-xl font-semibold text-gray-900">
                  Leave Feedback for {toSafeHotelInfo(selectedBooking.hotelId).name}
                </h2>
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={() => { setShowFeedbackForm(false); resetForm(); }}
                >
                  ×
                </Button>
              </div>

              <form onSubmit={handleSubmitFeedback} className="space-y-6">
                {/* Overall Rating */}
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">
                    Overall Rating *
                  </label>
                  <div className="flex items-center gap-2">
                    {[1, 2, 3, 4, 5].map((star) => (
                      <button
                        key={star}
                        type="button"
                        aria-label={`Rate ${star} out of 5 stars`}
                        onClick={() => setFeedbackForm(prev => ({ ...prev, rating: star }))}
                        className={`p-1 rounded ${
                          feedbackForm.rating >= star
                            ? 'text-yellow-400'
                            : 'text-gray-300'
                        } hover:text-yellow-400 transition-colors`}
                      >
                        <Star className="h-6 w-6 fill-current" />
                      </button>
                    ))}
                    <span className="ml-2 text-sm text-gray-600">
                      {feedbackForm.rating > 0 ? `${feedbackForm.rating} out of 5` : 'Select a rating'}
                    </span>
                  </div>
                  {feedbackForm.rating === 0 && (
                    <p className="text-xs text-red-500 mt-1">Please select a star rating</p>
                  )}
                </div>

                {/* Title */}
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">
                    Review Title *
                  </label>
                  <Input
                    value={feedbackForm.title}
                    onChange={(e) => setFeedbackForm(prev => ({ ...prev, title: e.target.value }))}
                    placeholder="Summarize your experience"
                    maxLength={200}
                    required
                  />
                  <p className="text-xs text-gray-400 mt-1">{feedbackForm.title.length}/200</p>
                </div>

                {/* Content */}
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">
                    Review Content *
                  </label>
                  <textarea
                    value={feedbackForm.content}
                    onChange={(e) => setFeedbackForm(prev => ({ ...prev, content: e.target.value }))}
                    placeholder="Share your detailed experience..."
                    className="w-full border border-gray-300 rounded-md px-3 py-2 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                    rows={4}
                    maxLength={2000}
                    required
                  />
                  <p className="text-xs text-gray-400 mt-1">{feedbackForm.content.length}/2000</p>
                </div>

                {/* Category Ratings */}
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-3">
                    Rate by Category *
                  </label>
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    {Object.entries(feedbackForm.categories).map(([category, rating]) => (
                      <div key={category} className="space-y-2">
                        <label className="block text-sm font-medium text-gray-600 capitalize">
                          {category}
                        </label>
                        <div className="flex items-center gap-1">
                          {[1, 2, 3, 4, 5].map((star) => (
                            <button
                              key={star}
                              type="button"
                              aria-label={`Rate ${category} ${star} out of 5 stars`}
                              onClick={() => updateCategoryRating(category as keyof typeof feedbackForm.categories, star)}
                              className={`p-1 rounded ${
                                rating >= star
                                  ? 'text-yellow-400'
                                  : 'text-gray-300'
                              } hover:text-yellow-400 transition-colors`}
                            >
                              <Star className="h-4 w-4 fill-current" />
                            </button>
                          ))}
                          <span className="ml-1 text-xs text-gray-500">
                            {rating > 0 ? `${rating}/5` : 'Not rated'}
                          </span>
                        </div>
                      </div>
                    ))}
                  </div>
                </div>

                {/* Visit Type */}
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">
                    Type of Visit
                  </label>
                  <select
                    value={feedbackForm.visitType}
                    onChange={(e) => setFeedbackForm(prev => ({
                      ...prev,
                      visitType: e.target.value as FeedbackForm['visitType']
                    }))}
                    className="w-full border border-gray-300 rounded-md px-3 py-2 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                  >
                    <option value="leisure">Leisure</option>
                    <option value="business">Business</option>
                    <option value="family">Family</option>
                    <option value="couple">Couple</option>
                    <option value="solo">Solo</option>
                  </select>
                </div>

                {/* Anonymous Feedback Option */}
                <div className="flex items-center gap-3 py-3 px-4 bg-gray-50 rounded-lg">
                  <button
                    type="button"
                    onClick={() => setFeedbackForm(prev => ({ ...prev, isAnonymous: !prev.isAnonymous }))}
                    className={`relative inline-flex h-6 w-11 items-center rounded-full transition-colors ${
                      feedbackForm.isAnonymous ? 'bg-blue-600' : 'bg-gray-300'
                    }`}
                    aria-label="Toggle anonymous feedback"
                  >
                    <span
                      className={`inline-block h-4 w-4 transform rounded-full bg-white transition-transform ${
                        feedbackForm.isAnonymous ? 'translate-x-6' : 'translate-x-1'
                      }`}
                    />
                  </button>
                  <div className="flex items-center gap-2">
                    {feedbackForm.isAnonymous ? (
                      <EyeOff className="h-4 w-4 text-blue-600" />
                    ) : (
                      <Eye className="h-4 w-4 text-gray-500" />
                    )}
                    <div>
                      <p className="text-sm font-medium text-gray-700">
                        {feedbackForm.isAnonymous ? 'Anonymous Review' : 'Public Review'}
                      </p>
                      <p className="text-xs text-gray-500">
                        {feedbackForm.isAnonymous
                          ? 'Your name will be hidden from the public review'
                          : 'Your name will be displayed with your review'}
                      </p>
                    </div>
                  </div>
                </div>

                {/* Submit Button */}
                <div className="flex justify-end gap-3 pt-4 border-t">
                  <Button
                    type="button"
                    variant="outline"
                    onClick={() => { setShowFeedbackForm(false); resetForm(); }}
                    disabled={submitting}
                  >
                    Cancel
                  </Button>
                  <Button
                    type="submit"
                    disabled={submitting || feedbackForm.rating === 0}
                    className="flex items-center gap-2"
                  >
                    {submitting ? (
                      <LoadingSpinner size="sm" />
                    ) : (
                      <Send className="h-4 w-4" />
                    )}
                    Submit Feedback
                  </Button>
                </div>
              </form>
            </div>
          </Card>
        </div>
      )}
    </div>
  );
}

export default withErrorBoundary(GuestFeedback);
