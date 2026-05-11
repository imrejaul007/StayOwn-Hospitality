import React, { useState, useEffect } from 'react';
import { Star, Filter, ThumbsUp, MessageCircle, BarChart3 } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Card } from '@/components/ui/card';
import reviewsService, { Review, ReviewSummary } from '../../services/reviewsService';
import { DEFAULT_PUBLIC_HOTEL_ID } from '../../constants/publicHotel';
import { cn } from '../../utils/cn';
import { withErrorBoundary } from '../../components/ErrorBoundary';

interface ReviewCardProps {
  review: Review;
  onHelpful?: (reviewId: string) => void;
  onReply?: (reviewId: string) => void;
}

function ReviewCard({ review, onHelpful, onReply }: ReviewCardProps) {
  const renderStars = (rating: number) => {
    return (
      <div className="flex items-center space-x-1">
        {[...Array(5)].map((_, i) => (
          <Star
            key={i}
            className={cn(
              'h-4 w-4',
              i < Math.floor(rating) ? 'text-yellow-400 fill-current' : 'text-gray-300'
            )}
          />
        ))}
        <span className="ml-2 text-sm font-medium text-gray-700">{rating.toFixed(1)}</span>
      </div>
    );
  };

  return (
    <Card className="p-4 sm:p-6 hover:shadow-lg transition-all duration-300">
      <div className="flex flex-col sm:flex-row items-start sm:justify-between mb-4 gap-3 sm:gap-0">
        <div className="flex items-center space-x-3">
          <div className="w-12 h-12 bg-gradient-to-r from-blue-500 to-purple-600 rounded-full flex items-center justify-center text-white font-bold text-lg">
            {review.guestName.charAt(0).toUpperCase()}
          </div>
          <div>
            <h4 className="font-semibold text-gray-900">{review.guestName}</h4>
            <div className="flex items-center space-x-2 text-sm text-gray-500">
              {review.isVerified && (
                <span className="inline-flex items-center px-2 py-1 rounded-full text-xs bg-green-100 text-green-800">
                  ✓ Verified Stay
                </span>
              )}
              <span>{review.visitType}</span>
              <span>•</span>
              <span>{new Date(review.createdAt).toLocaleDateString()}</span>
            </div>
          </div>
        </div>
        {renderStars(review.rating)}
      </div>

      <h5 className="font-semibold text-lg text-gray-900 mb-2">{review.title}</h5>
      <p className="text-gray-700 leading-relaxed mb-4">{review.content}</p>

      {review.categories && (
        <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-5 gap-3 sm:gap-4 mb-4 p-3 sm:p-4 bg-gray-50 rounded-lg">
          {Object.entries(review.categories).map(([category, rating]) => (
            rating && (
              <div key={category} className="text-center">
                <div className="text-sm font-medium text-gray-600 capitalize mb-1">
                  {category === 'value' ? 'Value' : category}
                </div>
                <div className="text-lg font-bold text-blue-600">{rating.toFixed(1)}</div>
              </div>
            )
          ))}
        </div>
      )}

      {review.response && (
        <div className="mt-4 p-4 bg-blue-50 border-l-4 border-blue-500 rounded-r-lg">
          <div className="flex items-center space-x-2 mb-2">
            <MessageCircle className="h-4 w-4 text-blue-600" />
            <span className="font-medium text-blue-900">Hotel Response</span>
            <span className="text-sm text-blue-700">
              by {review.response.respondedBy.name}
            </span>
          </div>
          <p className="text-blue-800">{review.response.content}</p>
        </div>
      )}

      <div className="flex flex-col sm:flex-row items-center sm:justify-between mt-6 pt-4 border-t border-gray-200 gap-3 sm:gap-0">
        <Button
          variant="secondary"
          size="sm"
          onClick={() => onHelpful?.(review._id)}
          className="flex items-center space-x-2"
        >
          <ThumbsUp className="h-4 w-4" />
          <span>Helpful ({review.helpfulVotes})</span>
        </Button>
        
        {onReply && (
          <Button
            variant="secondary"
            size="sm"
            onClick={() => onReply(review._id)}
            className="flex items-center space-x-2"
          >
            <MessageCircle className="h-4 w-4" />
            <span>Reply</span>
          </Button>
        )}
      </div>
    </Card>
  );
}

function RatingSummary({ summary }: { summary: ReviewSummary }) {
  const renderRatingBar = (rating: number, count: number, total: number) => {
    const percentage = total > 0 ? (count / total) * 100 : 0;
    return (
      <div className="flex items-center space-x-3">
        <span className="text-sm font-medium w-8">{rating}★</span>
        <div className="flex-1 bg-gray-200 rounded-full h-2">
          <div
            className="bg-yellow-400 h-2 rounded-full transition-all duration-300"
            style={{ width: `${percentage}%` }}
          />
        </div>
        <span className="text-sm text-gray-600 w-8">{count}</span>
      </div>
    );
  };

  return (
    <Card className="p-4 sm:p-6 bg-gradient-to-br from-yellow-50 to-orange-50 border border-yellow-200">
      <div className="text-center mb-6">
        <div className="text-4xl font-bold text-yellow-600 mb-2">
          {summary.averageRating.toFixed(1)}
        </div>
        <div className="flex justify-center mb-2">
          {[...Array(5)].map((_, i) => (
            <Star
              key={i}
              className={cn(
                'h-6 w-6',
                i < Math.floor(summary.averageRating)
                  ? 'text-yellow-400 fill-current'
                  : 'text-gray-300'
              )}
            />
          ))}
        </div>
        <p className="text-gray-600">
          Based on {summary.totalReviews.toLocaleString()} reviews
        </p>
      </div>

      <div className="space-y-2">
        {[5, 4, 3, 2, 1].map((rating) => (
          <div key={rating}>
            {renderRatingBar(
              rating,
              summary.ratingDistribution[rating as keyof typeof summary.ratingDistribution],
              summary.totalReviews
            )}
          </div>
        ))}
      </div>

      {Object.keys(summary.categoryAverages).length > 0 && (
        <div className="mt-6 pt-6 border-t border-yellow-200">
          <h4 className="font-semibold text-gray-900 mb-4 flex items-center">
            <BarChart3 className="h-5 w-5 mr-2" />
            Category Ratings
          </h4>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            {Object.entries(summary.categoryAverages).map(([category, rating]) => (
              <div key={category} className="text-center">
                <div className="text-sm font-medium text-gray-600 capitalize mb-1">
                  {category}
                </div>
                <div className="text-lg font-bold text-blue-600">{rating?.toFixed(1)}</div>
              </div>
            ))}
          </div>
        </div>
      )}
    </Card>
  );
}

function ReviewsPage() {
  const [reviews, setReviews] = useState<Review[]>([]);
  const [summary, setSummary] = useState<ReviewSummary | null>(null);
  const [loading, setLoading] = useState(true);
  const [currentPage, setCurrentPage] = useState(1);
  const [totalPages, setTotalPages] = useState(1);
  const [sortBy, setSortBy] = useState<'newest' | 'oldest' | 'highest_rated' | 'lowest_rated' | 'most_helpful'>('newest');
  const [filterRating, setFilterRating] = useState<number | undefined>();

  const hotelId = DEFAULT_PUBLIC_HOTEL_ID;

  useEffect(() => {
    document.title = 'Guest Reviews - The Pentouz';
  }, []);

  const loadReviews = async (page = 1) => {
    try {
      setLoading(true);
      
      const [reviewsData, summaryData] = await Promise.all([
        reviewsService.getHotelReviews(hotelId, {
          page,
          limit: 10,
          sortBy,
          rating: filterRating
        }),
        reviewsService.getHotelRatingSummary(hotelId)
      ]);

      setReviews(reviewsData.reviews);
      setSummary(summaryData);
      setCurrentPage(reviewsData.pagination.page);
      setTotalPages(reviewsData.pagination.pages);
    } catch (error) {
      console.error('Failed to load reviews:', error);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadReviews(1);
  }, [sortBy, filterRating]);

  const handleHelpful = async (reviewId: string) => {
    try {
      await reviewsService.markHelpful(reviewId);
      // Reload reviews to get updated helpful count
      loadReviews(currentPage);
    } catch {
      // Error handled silently
    }
  };

  const handlePageChange = (page: number) => {
    loadReviews(page);
  };

  if (loading && reviews.length === 0) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-gray-50 to-blue-50">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-12">
          <div className="flex items-center justify-center py-20">
            <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600"></div>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-gray-50 to-blue-50">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8 sm:py-12">
        {/* Header */}
        <div className="text-center mb-10 sm:mb-16">
          <div className="inline-flex items-center justify-center w-16 h-16 bg-gradient-to-r from-yellow-400 to-yellow-600 rounded-full mb-6">
            <Star className="h-8 w-8 text-white fill-current" />
          </div>
          <h1 className="text-3xl sm:text-4xl lg:text-5xl font-bold bg-gradient-to-r from-gray-900 via-blue-800 to-gray-900 bg-clip-text text-transparent mb-6">
            Guest Reviews & Feedback
          </h1>
          <p className="text-lg sm:text-xl text-gray-600 max-w-3xl mx-auto">
            Real experiences from our guests at The Pentouz
          </p>
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-4 gap-6 lg:gap-8">
          {/* Sidebar with Rating Summary and Filters */}
          <div className="lg:col-span-1 space-y-6">
            {summary && <RatingSummary summary={summary} />}
            
            {/* Filters */}
            <Card className="p-4 sm:p-6">
              <h3 className="font-semibold text-gray-900 mb-4 flex items-center">
                <Filter className="h-5 w-5 mr-2" />
                Filters
              </h3>
              
              <div className="space-y-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">
                    Sort By
                  </label>
                  <select
                    value={sortBy}
                    onChange={(e) => setSortBy(e.target.value as typeof sortBy)}
                    className="w-full p-2 border border-gray-300 rounded-md focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                  >
                    <option value="newest">Newest First</option>
                    <option value="oldest">Oldest First</option>
                    <option value="highest_rated">Highest Rated</option>
                    <option value="lowest_rated">Lowest Rated</option>
                    <option value="most_helpful">Most Helpful</option>
                  </select>
                </div>
                
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">
                    Filter by Rating
                  </label>
                  <select
                    value={filterRating || ''}
                    onChange={(e) => setFilterRating(e.target.value ? parseInt(e.target.value) : undefined)}
                    className="w-full p-2 border border-gray-300 rounded-md focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                  >
                    <option value="">All Ratings</option>
                    <option value="5">5 Stars</option>
                    <option value="4">4 Stars</option>
                    <option value="3">3 Stars</option>
                    <option value="2">2 Stars</option>
                    <option value="1">1 Star</option>
                  </select>
                </div>
              </div>
            </Card>
          </div>

          {/* Reviews List */}
          <div className="lg:col-span-3">
            <div className="mb-6">
              <h2 className="text-xl sm:text-2xl font-bold text-gray-900 mb-2">
                {summary?.totalReviews ? `${summary.totalReviews.toLocaleString()} Reviews` : 'Reviews'}
              </h2>
              <p className="text-gray-600">
                Authentic feedback from verified guests
              </p>
            </div>

            {loading ? (
              <div className="space-y-6">
                {[...Array(5)].map((_, i) => (
                  <Card key={i} className="p-4 sm:p-6 animate-pulse">
                    <div className="h-4 bg-gray-200 rounded w-1/4 mb-4"></div>
                    <div className="h-4 bg-gray-200 rounded w-3/4 mb-2"></div>
                    <div className="h-4 bg-gray-200 rounded w-1/2"></div>
                  </Card>
                ))}
              </div>
            ) : reviews.length === 0 ? (
              <Card className="p-8 sm:p-12 text-center">
                <div className="w-16 h-16 bg-gray-200 rounded-full flex items-center justify-center mx-auto mb-4">
                  <Star className="h-8 w-8 text-gray-400" />
                </div>
                <h3 className="text-lg font-medium text-gray-900 mb-2">No Reviews Found</h3>
                <p className="text-gray-600">Be the first to share your experience!</p>
              </Card>
            ) : (
              <div className="space-y-6">
                {reviews.map((review) => (
                  <ReviewCard
                    key={review._id}
                    review={review}
                    onHelpful={handleHelpful}
                  />
                ))}

                {/* Pagination */}
                {totalPages > 1 && (
                  <div className="flex flex-col sm:flex-row justify-center items-center space-y-4 sm:space-y-0 sm:space-x-4 mt-8">
                    <Button
                      variant="secondary"
                      onClick={() => handlePageChange(currentPage - 1)}
                      disabled={currentPage === 1}
                    >
                      Previous
                    </Button>
                    
                    <div className="flex items-center space-x-2 overflow-x-auto pb-2">
                      {[...Array(Math.min(5, totalPages))].map((_, i) => {
                        const page = i + 1;
                        return (
                          <button aria-label={`Go to page ${page}`}
                            key={page}
                            onClick={() => handlePageChange(page)}
                            className={cn(
                              'w-10 h-10 rounded-lg font-medium transition-colors flex-shrink-0',
                              page === currentPage
                                ? 'bg-blue-600 text-white'
                                : 'bg-white text-gray-700 hover:bg-gray-100'
                            )}
                          >
                            {page}
                          </button>
                        );
                      })}
                      {totalPages > 5 && (
                        <span className="text-gray-500">... {totalPages}</span>
                      )}
                    </div>
                    
                    <Button
                      variant="secondary"
                      onClick={() => handlePageChange(currentPage + 1)}
                      disabled={currentPage === totalPages}
                    >
                      Next
                    </Button>
                  </div>
                )}
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}

export default withErrorBoundary(ReviewsPage);
