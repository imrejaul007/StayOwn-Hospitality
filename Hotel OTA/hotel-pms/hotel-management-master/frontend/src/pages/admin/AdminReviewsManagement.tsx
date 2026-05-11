import React, { useState, useEffect } from 'react';
import {
  Star,
  MessageCircle,
  Clock,
  CheckCircle,
  XCircle,
  Filter,
  BarChart3,
  TrendingUp,
  AlertTriangle,
  Search,
  Calendar,
  Eye
} from 'lucide-react';
import toast from 'react-hot-toast';
import { Button } from '@/components/ui/button';
import { Card } from '@/components/ui/card';
import { Modal } from '@/components/ui/Modal';
import { Input } from '@/components/ui/input';
import reviewsService, { Review, ReviewSummary } from '../../services/reviewsService';
import { cn } from '../../utils/cn';
import { useAuth } from '../../context/AuthContext';
import { useProperty } from '../../context/PropertyContext';
import { PropertyBreadcrumb } from '../../components/common/PropertyBreadcrumb';
import { withErrorBoundary } from '../../components/ErrorBoundary';

interface ReviewResponseModalProps {
  review: Review | null;
  isOpen: boolean;
  onClose: () => void;
  onSubmit: (reviewId: string, response: string) => void;
}

function ReviewResponseModal({ review, isOpen, onClose, onSubmit }: ReviewResponseModalProps) {
  const [response, setResponse] = useState('');
  const [loading, setLoading] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!review || !response.trim()) return;

    setLoading(true);
    try {
      await onSubmit(review._id, response);
      setResponse('');
      onClose();
    } finally {
      setLoading(false);
    }
  };

  if (!review) return null;

  return (
    <Modal isOpen={isOpen} onClose={onClose} title="Respond to Review">
      <div className="space-y-6">
        {/* Review Preview */}
        <div className="bg-gray-50 p-4 rounded-lg">
          <div className="flex items-center space-x-2 mb-2">
            <div className="flex text-yellow-400">
              {[...Array(5)].map((_, i) => (
                <Star
                  key={i}
                  className={cn(
                    'h-4 w-4',
                    i < review.rating ? 'fill-current' : 'text-gray-300'
                  )}
                />
              ))}
            </div>
            <span className="font-medium text-gray-900">{review.guestName}</span>
          </div>
          <h4 className="font-semibold text-gray-900 mb-1">{review.title}</h4>
          <p className="text-gray-700">{review.content}</p>
        </div>

        <form onSubmit={handleSubmit}>
          <div className="mb-4">
            <label className="block text-sm font-medium text-gray-700 mb-2">
              Your Response
            </label>
            <textarea
              value={response}
              onChange={(e) => setResponse(e.target.value)}
              className="w-full p-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
              rows={4}
              placeholder="Thank you for your feedback..."
              required
            />
          </div>
          
          <div className="flex justify-end space-x-3">
            <Button type="button" variant="secondary" onClick={onClose}>
              Cancel
            </Button>
            <Button type="submit" disabled={loading || !response.trim()}>
              {loading ? 'Sending...' : 'Send Response'}
            </Button>
          </div>
        </form>
      </div>
    </Modal>
  );
}

interface ModerationModalProps {
  review: Review | null;
  isOpen: boolean;
  onClose: () => void;
  onSubmit: (reviewId: string, status: 'approved' | 'rejected', notes?: string) => void;
}

function ModerationModal({ review, isOpen, onClose, onSubmit }: ModerationModalProps) {
  const [status, setStatus] = useState<'approved' | 'rejected'>('approved');
  const [notes, setNotes] = useState('');
  const [loading, setLoading] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!review) return;

    setLoading(true);
    try {
      await onSubmit(review._id, status, notes);
      setNotes('');
      onClose();
    } finally {
      setLoading(false);
    }
  };

  if (!review) return null;

  return (
    <Modal isOpen={isOpen} onClose={onClose} title="Moderate Review">
      <div className="space-y-6">
        {/* Review Preview */}
        <div className="bg-gray-50 p-4 rounded-lg">
          <div className="flex items-center space-x-2 mb-2">
            <div className="flex text-yellow-400">
              {[...Array(5)].map((_, i) => (
                <Star
                  key={i}
                  className={cn(
                    'h-4 w-4',
                    i < review.rating ? 'fill-current' : 'text-gray-300'
                  )}
                />
              ))}
            </div>
            <span className="font-medium text-gray-900">{review.guestName}</span>
          </div>
          <h4 className="font-semibold text-gray-900 mb-1">{review.title}</h4>
          <p className="text-gray-700">{review.content}</p>
        </div>

        <form onSubmit={handleSubmit}>
          <div className="mb-4">
            <label className="block text-sm font-medium text-gray-700 mb-2">
              Moderation Decision
            </label>
            <select
              value={status}
              onChange={(e) => setStatus(e.target.value as 'approved' | 'rejected')}
              className="w-full p-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
            >
              <option value="approved">Approve</option>
              <option value="rejected">Reject</option>
            </select>
          </div>

          <div className="mb-4">
            <label className="block text-sm font-medium text-gray-700 mb-2">
              Notes (Optional)
            </label>
            <textarea
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
              className="w-full p-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
              rows={3}
              placeholder="Internal notes about this decision..."
            />
          </div>
          
          <div className="flex justify-end space-x-3">
            <Button type="button" variant="secondary" onClick={onClose}>
              Cancel
            </Button>
            <Button type="submit" disabled={loading}>
              {loading ? 'Processing...' : `${status === 'approved' ? 'Approve' : 'Reject'} Review`}
            </Button>
          </div>
        </form>
      </div>
    </Modal>
  );
}

const ADMIN_PAGE_SIZE = 20;

function AdminReviewsManagement() {
  const { user } = useAuth();
  const { selectedPropertyId, selectedProperty, viewMode } = useProperty();
  const [reviews, setReviews] = useState<Review[]>([]);
  const [pendingReviews, setPendingReviews] = useState<Review[]>([]);
  const [summary, setSummary] = useState<ReviewSummary | null>(null);
  const [loading, setLoading] = useState(true);
  const [activeTab, setActiveTab] = useState<'all' | 'pending' | 'analytics'>('all');
  const [selectedReview, setSelectedReview] = useState<Review | null>(null);
  const [responseModalOpen, setResponseModalOpen] = useState(false);
  const [moderationModalOpen, setModerationModalOpen] = useState(false);
  const [searchTerm, setSearchTerm] = useState('');
  const [filterRating, setFilterRating] = useState<number | undefined>();
  const [reviewPage, setReviewPage] = useState(1);
  const [pendingPage, setPendingPage] = useState(1);

  const hotelId = selectedPropertyId || user?.hotelId || '';

  const loadReviews = async () => {
    if (!hotelId) return;

    try {
      setLoading(true);
      const [allReviews, pendingReviewsData, summaryData] = await Promise.all([
        reviewsService.getHotelReviews(hotelId, { page: reviewPage, limit: ADMIN_PAGE_SIZE }),
        user?.role === 'admin' ? reviewsService.getPendingReviews({ page: pendingPage, limit: ADMIN_PAGE_SIZE }) : Promise.resolve({ reviews: [] }),
        reviewsService.getHotelRatingSummary(hotelId)
      ]);

      setReviews(allReviews.reviews);
      setPendingReviews(pendingReviewsData.reviews);
      setSummary(summaryData);
    } catch (error) {
      console.error('Failed to load reviews:', error);
      toast.error('Failed to load reviews. Please try again.');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    if (hotelId) {
      loadReviews();
    }
  }, [hotelId, reviewPage, pendingPage]);

  const handleResponse = async (reviewId: string, content: string) => {
    try {
      await reviewsService.addResponse(reviewId, content);
      loadReviews(); // Reload to show the new response
    } catch (error) {
      console.error('Failed to respond to review:', error);
      toast.error('Failed to send response. Please try again.');
    }
  };

  const handleModeration = async (reviewId: string, status: 'approved' | 'rejected', notes?: string) => {
    try {
      await reviewsService.moderateReview(reviewId, status, notes);
      loadReviews(); // Reload to update the review status
    } catch (error) {
      console.error('Failed to moderate review:', error);
      toast.error('Failed to moderate review. Please try again.');
    }
  };

  const openResponseModal = (review: Review) => {
    setSelectedReview(review);
    setResponseModalOpen(true);
  };

  const openModerationModal = (review: Review) => {
    setSelectedReview(review);
    setModerationModalOpen(true);
  };

  if (!selectedPropertyId && viewMode === 'single') {
    return (
      <div className="p-6 max-w-7xl mx-auto">
        <PropertyBreadcrumb items={['Reviews Management']} />
        <div className="text-center py-12">
          <MessageCircle className="mx-auto h-12 w-12 text-gray-400 mb-4" />
          <h3 className="text-lg font-medium text-gray-900 mb-2">No Property Selected</h3>
          <p className="text-gray-500">Please select a property to view reviews.</p>
        </div>
      </div>
    );
  }

  const filteredReviews = reviews.filter(review => {
    const matchesSearch = !searchTerm ||
      review.guestName.toLowerCase().includes(searchTerm.toLowerCase()) ||
      review.title.toLowerCase().includes(searchTerm.toLowerCase()) ||
      review.content.toLowerCase().includes(searchTerm.toLowerCase());

    const matchesRating = !filterRating || review.rating === filterRating;

    return matchesSearch && matchesRating;
  });

  const renderReviewCard = (review: Review) => (
    <Card key={review._id} className="p-6">
      <div className="flex items-start justify-between mb-4">
        <div className="flex items-center space-x-3">
          <div className="w-10 h-10 bg-gradient-to-r from-blue-500 to-purple-600 rounded-full flex items-center justify-center text-white font-bold">
            {review.guestName.charAt(0).toUpperCase()}
          </div>
          <div>
            <h4 className="font-semibold text-gray-900">{review.guestName}</h4>
            <div className="flex items-center space-x-2 text-sm text-gray-500">
              {review.isVerified && (
                <span className="inline-flex items-center px-2 py-1 rounded-full text-xs bg-green-100 text-green-800">
                  ✓ Verified
                </span>
              )}
              <span>{new Date(review.createdAt).toLocaleDateString()}</span>
              <span className={cn(
                'px-2 py-1 rounded-full text-xs font-medium',
                review.moderationStatus === 'approved' ? 'bg-green-100 text-green-800' :
                review.moderationStatus === 'rejected' ? 'bg-red-100 text-red-800' :
                'bg-yellow-100 text-yellow-800'
              )}>
                {review.moderationStatus}
              </span>
            </div>
          </div>
        </div>
        
        <div className="flex items-center space-x-2">
          <div className="flex text-yellow-400">
            {[...Array(5)].map((_, i) => (
              <Star
                key={i}
                className={cn(
                  'h-4 w-4',
                  i < review.rating ? 'fill-current' : 'text-gray-300'
                )}
              />
            ))}
          </div>
          <span className="text-sm font-medium">{review.rating.toFixed(1)}</span>
        </div>
      </div>

      <h5 className="font-semibold text-lg text-gray-900 mb-2">{review.title}</h5>
      <p className="text-gray-700 mb-4">{review.content}</p>

      {review.response && (
        <div className="mb-4 p-4 bg-blue-50 border-l-4 border-blue-500 rounded-r-lg">
          <div className="flex items-center space-x-2 mb-2">
            <MessageCircle className="h-4 w-4 text-blue-600" />
            <span className="font-medium text-blue-900">Your Response</span>
          </div>
          <p className="text-blue-800">{review.response.content}</p>
        </div>
      )}

      <div className="flex items-center justify-between pt-4 border-t border-gray-200">
        <div className="flex items-center space-x-4">
          {!review.response && (
            <Button
              size="sm"
              onClick={() => openResponseModal(review)}
              className="flex items-center space-x-2"
            >
              <MessageCircle className="h-4 w-4" />
              <span>Respond</span>
            </Button>
          )}
          
          {user?.role === 'admin' && review.moderationStatus === 'pending' && (
            <Button
              variant="secondary"
              size="sm"
              onClick={() => openModerationModal(review)}
              className="flex items-center space-x-2"
            >
              <Eye className="h-4 w-4" />
              <span>Moderate</span>
            </Button>
          )}
        </div>
        
        <div className="text-sm text-gray-500">
          {review.helpfulVotes} helpful votes
        </div>
      </div>
    </Card>
  );

  if (loading) {
    return (
      <div className="p-6 max-w-7xl mx-auto">
        <div className="flex items-center justify-center py-20">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600"></div>
        </div>
      </div>
    );
  }

  return (
    <div className="p-6 max-w-7xl mx-auto">
      {/* Breadcrumb */}
      <PropertyBreadcrumb items={['Reviews Management']} />

      {/* Header */}
      <div className="mb-8">
        <h1 className="text-3xl font-bold text-gray-900 mb-2">Reviews Management</h1>
        <p className="text-gray-600">
          Collect, analyze, and respond to guest feedback
        </p>
      </div>

      {/* Analytics Cards */}
      {summary && (
        <div className="grid grid-cols-1 md:grid-cols-4 gap-6 mb-8">
          <Card className="p-6 bg-gradient-to-br from-yellow-50 to-orange-50 border border-yellow-200">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm font-medium text-yellow-600">Average Rating</p>
                <p className="text-2xl font-bold text-yellow-700">{summary.averageRating.toFixed(1)}</p>
              </div>
              <Star className="h-8 w-8 text-yellow-500 fill-current" />
            </div>
          </Card>
          
          <Card className="p-6 bg-gradient-to-br from-blue-50 to-indigo-50 border border-blue-200">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm font-medium text-blue-600">Total Reviews</p>
                <p className="text-2xl font-bold text-blue-700">{summary.totalReviews.toLocaleString()}</p>
              </div>
              <BarChart3 className="h-8 w-8 text-blue-500" />
            </div>
          </Card>
          
          <Card className="p-6 bg-gradient-to-br from-green-50 to-emerald-50 border border-green-200">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm font-medium text-green-600">Pending Reviews</p>
                <p className="text-2xl font-bold text-green-700">{pendingReviews.length}</p>
              </div>
              <Clock className="h-8 w-8 text-green-500" />
            </div>
          </Card>
          
          <Card className="p-6 bg-gradient-to-br from-purple-50 to-pink-50 border border-purple-200">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm font-medium text-purple-600">Response Rate</p>
                <p className="text-2xl font-bold text-purple-700">
                  {Math.round(reviews.length > 0 ? (reviews.filter(r => r.response).length / reviews.length) * 100 : 0)}%
                </p>
              </div>
              <TrendingUp className="h-8 w-8 text-purple-500" />
            </div>
          </Card>
        </div>
      )}

      {/* Tabs */}
      <div className="mb-6">
        <nav className="flex space-x-8">
          <button
            onClick={() => setActiveTab('all')}
            className={cn(
              'py-2 px-1 border-b-2 font-medium text-sm',
              activeTab === 'all'
                ? 'border-blue-500 text-blue-600'
                : 'border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300'
            )}
          >
            All Reviews ({filteredReviews.length})
          </button>
          
          {user?.role === 'admin' && (
            <button
              onClick={() => setActiveTab('pending')}
              className={cn(
                'py-2 px-1 border-b-2 font-medium text-sm',
                activeTab === 'pending'
                  ? 'border-blue-500 text-blue-600'
                  : 'border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300'
              )}
            >
              Pending Moderation ({pendingReviews.length})
            </button>
          )}
          
          <button
            onClick={() => setActiveTab('analytics')}
            className={cn(
              'py-2 px-1 border-b-2 font-medium text-sm',
              activeTab === 'analytics'
                ? 'border-blue-500 text-blue-600'
                : 'border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300'
            )}
          >
            Analytics
          </button>
        </nav>
      </div>

      {/* Filters */}
      {activeTab === 'all' && (
        <div className="mb-6 flex flex-col sm:flex-row gap-4">
          <div className="flex-1">
            <Input
              placeholder="Search reviews by guest name, title, or content..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="w-full"
            />
          </div>
          
          <select
            value={filterRating || ''}
            onChange={(e) => setFilterRating(e.target.value ? parseInt(e.target.value) : undefined)}
            className="px-3 py-2 border border-gray-300 rounded-md focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
          >
            <option value="">All Ratings</option>
            <option value="5">5 Stars</option>
            <option value="4">4 Stars</option>
            <option value="3">3 Stars</option>
            <option value="2">2 Stars</option>
            <option value="1">1 Star</option>
          </select>
        </div>
      )}

      {/* Content */}
      {activeTab === 'all' && (
        <div className="space-y-6">
          {filteredReviews.length === 0 ? (
            <Card className="p-12 text-center">
              <MessageCircle className="h-12 w-12 text-gray-400 mx-auto mb-4" />
              <h3 className="text-lg font-medium text-gray-900 mb-2">No Reviews Found</h3>
              <p className="text-gray-600">No reviews match your current filters.</p>
            </Card>
          ) : (
            <>
              {filteredReviews.map(renderReviewCard)}
              <div className="flex justify-between items-center mt-4">
                <button
                  onClick={() => setReviewPage(p => Math.max(1, p - 1))}
                  disabled={reviewPage === 1}
                  className="px-3 py-1 border rounded disabled:opacity-50"
                >
                  Previous
                </button>
                <span>Page {reviewPage}</span>
                <button
                  onClick={() => setReviewPage(p => p + 1)}
                  disabled={reviews.length < ADMIN_PAGE_SIZE}
                  className="px-3 py-1 border rounded disabled:opacity-50"
                >
                  Next
                </button>
              </div>
            </>
          )}
        </div>
      )}

      {activeTab === 'pending' && (
        <div className="space-y-6">
          {pendingReviews.length === 0 ? (
            <Card className="p-12 text-center">
              <CheckCircle className="h-12 w-12 text-green-400 mx-auto mb-4" />
              <h3 className="text-lg font-medium text-gray-900 mb-2">All Caught Up!</h3>
              <p className="text-gray-600">No reviews are pending moderation.</p>
            </Card>
          ) : (
            <>
              {pendingReviews.map(renderReviewCard)}
              <div className="flex justify-between items-center mt-4">
                <button
                  onClick={() => setPendingPage(p => Math.max(1, p - 1))}
                  disabled={pendingPage === 1}
                  className="px-3 py-1 border rounded disabled:opacity-50"
                >
                  Previous
                </button>
                <span>Page {pendingPage}</span>
                <button
                  onClick={() => setPendingPage(p => p + 1)}
                  disabled={pendingReviews.length < ADMIN_PAGE_SIZE}
                  className="px-3 py-1 border rounded disabled:opacity-50"
                >
                  Next
                </button>
              </div>
            </>
          )}
        </div>
      )}

      {activeTab === 'analytics' && summary && (
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
          {/* Rating Distribution */}
          <Card className="p-6">
            <h3 className="text-lg font-semibold text-gray-900 mb-4">Rating Distribution</h3>
            <div className="space-y-3">
              {[5, 4, 3, 2, 1].map((rating) => {
                const count = summary.ratingDistribution[rating as keyof typeof summary.ratingDistribution];
                const percentage = summary.totalReviews > 0 ? (count / summary.totalReviews) * 100 : 0;
                
                return (
                  <div key={rating} className="flex items-center space-x-3">
                    <span className="text-sm font-medium w-8">{rating}★</span>
                    <div className="flex-1 bg-gray-200 rounded-full h-3">
                      <div
                        className="bg-yellow-400 h-3 rounded-full transition-all duration-300"
                        style={{ width: `${percentage}%` }}
                      />
                    </div>
                    <span className="text-sm text-gray-600 w-12 text-right">{count}</span>
                  </div>
                );
              })}
            </div>
          </Card>

          {/* Category Averages */}
          {Object.keys(summary.categoryAverages).length > 0 && (
            <Card className="p-6">
              <h3 className="text-lg font-semibold text-gray-900 mb-4">Category Performance</h3>
              <div className="space-y-4">
                {Object.entries(summary.categoryAverages).map(([category, rating]) => (
                  <div key={category}>
                    <div className="flex justify-between items-center mb-1">
                      <span className="text-sm font-medium text-gray-700 capitalize">{category}</span>
                      <span className="text-sm font-bold text-gray-900">{rating?.toFixed(1)}</span>
                    </div>
                    <div className="w-full bg-gray-200 rounded-full h-2">
                      <div
                        className="bg-blue-500 h-2 rounded-full transition-all duration-300"
                        style={{ width: `${((rating || 0) / 5) * 100}%` }}
                      />
                    </div>
                  </div>
                ))}
              </div>
            </Card>
          )}
        </div>
      )}

      {/* Modals */}
      <ReviewResponseModal
        review={selectedReview}
        isOpen={responseModalOpen}
        onClose={() => setResponseModalOpen(false)}
        onSubmit={handleResponse}
      />
      
      <ModerationModal
        review={selectedReview}
        isOpen={moderationModalOpen}
        onClose={() => setModerationModalOpen(false)}
        onSubmit={handleModeration}
      />
    </div>
  );
}

export default withErrorBoundary(AdminReviewsManagement);
