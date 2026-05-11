import React, { useState, useEffect } from 'react';
import { Card, CardHeader, CardTitle, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Badge } from '@/components/ui/badge';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Textarea } from '@/components/ui/textarea';
import { Star, MessageSquare, CheckCircle, XCircle, AlertTriangle, Search } from 'lucide-react';
import { bookingEngineService, ReviewManagement } from '@/services/bookingEngineService';
import { api } from '@/services/api';

interface ReviewResponse {
  reviewId: string;
  response: string;
  isPublic: boolean;
}

const ReviewManager: React.FC = () => {
  const [reviews, setReviews] = useState<ReviewManagement[]>([]);
  const [selectedReview, setSelectedReview] = useState<ReviewManagement | null>(null);
  const [isResponseModalOpen, setIsResponseModalOpen] = useState(false);
  const [loading, setLoading] = useState(true);
  const [activeTab, setActiveTab] = useState('all');
  const [searchTerm, setSearchTerm] = useState('');
  const [filterStatus, setFilterStatus] = useState('all');
  const [filterSentiment, setFilterSentiment] = useState('all');

  const [responseData, setResponseData] = useState<ReviewResponse>({
    reviewId: '',
    response: '',
    isPublic: true
  });

  useEffect(() => {
    fetchReviews();
  }, []);

  const fetchReviews = async () => {
    try {
      setLoading(true);
      const data = await bookingEngineService.getReviews();
      setReviews(data);
    } catch (error) {
      console.error('Failed to load reviews:', error);
    } finally {
      setLoading(false);
    }
  };

  const handleModerateReview = async (reviewId: string, status: string) => {
    try {
      await api.put(`/booking-engine/reviews/${reviewId}/moderate`, { status });
      fetchReviews();
    } catch (error) {
      console.error('Error moderating review:', error);
    }
  };

  const handleRespondToReview = async () => {
    if (!selectedReview) return;
    try {
      await api.post(`/booking-engine/reviews/${selectedReview._id}/respond`, {
        response: responseData.response,
        isPublic: responseData.isPublic,
      });
      setIsResponseModalOpen(false);
      setResponseData({ reviewId: '', response: '', isPublic: true });
      fetchReviews();
    } catch (error) {
      console.error('Error responding to review:', error);
    }
  };

  const openResponseModal = (review: ReviewManagement) => {
    setSelectedReview(review);
    setResponseData({
      reviewId: review._id,
      response: '',
      isPublic: true
    });
    setIsResponseModalOpen(true);
  };

  const getStatusColor = (status: string) => {
    const colors = {
      pending: 'bg-yellow-100 text-yellow-800',
      approved: 'bg-green-100 text-green-800',
      rejected: 'bg-red-100 text-red-800',
      flagged: 'bg-orange-100 text-orange-800'
    };
    return colors[status as keyof typeof colors] || 'bg-gray-100 text-gray-800';
  };

  const getSentimentColor = (sentiment: string) => {
    const colors = {
      positive: 'bg-green-100 text-green-800',
      negative: 'bg-red-100 text-red-800',
      neutral: 'bg-gray-100 text-gray-800'
    };
    return colors[sentiment as keyof typeof colors] || 'bg-gray-100 text-gray-800';
  };

  const getSentimentIcon = (sentiment: string) => {
    const icons = {
      positive: CheckCircle,
      negative: XCircle,
      neutral: AlertTriangle
    };
    return icons[sentiment as keyof typeof icons] || AlertTriangle;
  };

  const renderStars = (rating: number) => {
    return Array.from({ length: 5 }, (_, i) => (
      <Star
        key={i}
        className={`w-4 h-4 ${i < rating ? 'text-yellow-400 fill-current' : 'text-gray-300'}`}
      />
    ));
  };

  const filteredReviews = reviews.filter(review => {
    // Tab filtering
    if (activeTab === 'pending' && (!review.moderation || review.moderation.status !== 'pending')) return false;
    if (activeTab === 'approved' && (!review.moderation || review.moderation.status !== 'approved')) return false;
    if (activeTab === 'rejected' && (!review.moderation || review.moderation.status !== 'rejected')) return false;
    if (activeTab === 'flagged' && (!review.moderation || review.moderation.status !== 'flagged')) return false;

    // Status filtering
    if (filterStatus !== 'all' && (!review.moderation || review.moderation.status !== filterStatus)) return false;

    // Sentiment filtering
    if (filterSentiment !== 'all' && (!review.sentiment || review.sentiment.label !== filterSentiment)) return false;

    // Search filtering
    if (searchTerm && !review.content?.title?.toLowerCase().includes(searchTerm.toLowerCase()) &&
        !review.content?.review?.toLowerCase().includes(searchTerm.toLowerCase()) &&
        !review.guest?.name?.toLowerCase().includes(searchTerm.toLowerCase())) {
      return false;
    }

    return true;
  });

  if (loading) {
    return (
      <div className="p-6">
        <div className="flex justify-center py-8">
          <div className="text-lg">Loading reviews...</div>
        </div>
      </div>
    );
  }

  return (
    <div className="p-6 space-y-6">
      <div className="flex justify-between items-center">
        <h1 className="text-3xl font-bold">Review Management</h1>
      </div>

      {/* Review Statistics */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-6">
        <Card>
          <CardContent className="flex items-center p-6">
            <Star className="w-8 h-8 text-blue-600 mr-4" />
            <div>
              <p className="text-sm font-medium text-gray-600">Total Reviews</p>
              <p className="text-2xl font-bold">{reviews.length}</p>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardContent className="flex items-center p-6">
            <CheckCircle className="w-8 h-8 text-green-600 mr-4" />
            <div>
              <p className="text-sm font-medium text-gray-600">Approved</p>
              <p className="text-2xl font-bold">
                {reviews.filter(r => r && r.moderation && r.moderation.status === 'approved').length}
              </p>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardContent className="flex items-center p-6">
            <AlertTriangle className="w-8 h-8 text-yellow-600 mr-4" />
            <div>
              <p className="text-sm font-medium text-gray-600">Pending</p>
              <p className="text-2xl font-bold">
                {reviews.filter(r => r && r.moderation && r.moderation.status === 'pending').length}
              </p>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardContent className="flex items-center p-6">
            <Star className="w-8 h-8 text-purple-600 mr-4" />
            <div>
              <p className="text-sm font-medium text-gray-600">Avg Rating</p>
              <p className="text-2xl font-bold">
                {(() => {
                  const ratedReviews = reviews.filter(r => r.content?.rating);
                  if (ratedReviews.length === 0) return '0';
                  return (ratedReviews.reduce((sum, r) => sum + (r.content?.rating || 0), 0) / ratedReviews.length).toFixed(1);
                })()}
              </p>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Filters and Search */}
      <Card>
        <CardContent className="p-4">
          <div className="flex flex-col md:flex-row gap-4">
            <div className="flex-1">
              <Label htmlFor="search">Search Reviews</Label>
              <div className="relative">
                <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 w-4 h-4 text-gray-400" />
                <Input
                  id="search"
                  placeholder="Search by title, content, or guest name..."
                  value={searchTerm}
                  onChange={(e) => setSearchTerm(e.target.value)}
                  className="pl-10"
                />
              </div>
            </div>
            <div>
              <Label htmlFor="statusFilter">Status Filter</Label>
              <Select value={filterStatus} onValueChange={setFilterStatus}>
                <SelectTrigger>
                  <SelectValue placeholder="All Statuses" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">All Statuses</SelectItem>
                  <SelectItem value="pending">Pending</SelectItem>
                  <SelectItem value="approved">Approved</SelectItem>
                  <SelectItem value="rejected">Rejected</SelectItem>
                  <SelectItem value="flagged">Flagged</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div>
              <Label htmlFor="sentimentFilter">Sentiment Filter</Label>
              <Select value={filterSentiment} onValueChange={setFilterSentiment}>
                <SelectTrigger>
                  <SelectValue placeholder="All Sentiments" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">All Sentiments</SelectItem>
                  <SelectItem value="positive">Positive</SelectItem>
                  <SelectItem value="negative">Negative</SelectItem>
                  <SelectItem value="neutral">Neutral</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Review Tabs */}
      <Tabs value={activeTab} onValueChange={setActiveTab}>
        <TabsList>
          <TabsTrigger value="all">All Reviews</TabsTrigger>
          <TabsTrigger value="pending">Pending</TabsTrigger>
          <TabsTrigger value="approved">Approved</TabsTrigger>
          <TabsTrigger value="rejected">Rejected</TabsTrigger>
          <TabsTrigger value="flagged">Flagged</TabsTrigger>
        </TabsList>

        <TabsContent value={activeTab} className="space-y-4">
          {filteredReviews.length === 0 ? (
            <Card>
              <CardContent className="text-center py-8">
                <Star className="w-12 h-12 text-gray-400 mx-auto mb-4" />
                <p className="text-gray-500">No reviews found</p>
                <p className="text-sm text-gray-400">Try adjusting your filters or search terms</p>
              </CardContent>
            </Card>
          ) : (
            <div className="grid gap-4">
              {filteredReviews.map((review) => {
                const SentimentIcon = getSentimentIcon(review.sentiment?.label || 'neutral');
                return (
                  <Card key={review._id} className="hover:shadow-lg transition-shadow">
                    <CardHeader>
                      <div className="flex justify-between items-start">
                        <div className="flex items-start space-x-3">
                          <div className="flex-shrink-0">
                            <div className="w-12 h-12 bg-gray-100 rounded-full flex items-center justify-center">
                              <span className="text-lg font-semibold text-gray-600">
                                {(review.guest?.name || 'U').charAt(0).toUpperCase()}
                              </span>
                            </div>
                          </div>
                          <div className="flex-1">
                            <div className="flex items-center space-x-2 mb-1">
                              <h3 className="text-lg font-semibold">{review.guest?.name || 'Unknown Guest'}</h3>
                              {review.guest?.verified && (
                                <Badge variant="secondary" className="text-xs">Verified</Badge>
                              )}
                            </div>
                            <div className="flex items-center space-x-2 mb-2">
                              <div className="flex items-center">
                                {renderStars(review.content?.rating || 0)}
                              </div>
                              <span className="text-sm text-gray-600">
                                {review.content?.rating || 0}/5
                              </span>
                            </div>
                            {review.content?.title && (
                              <h4 className="font-medium text-gray-900 mb-1">{review.content.title}</h4>
                            )}
                            {review.content?.review && (
                              <p className="text-gray-600 text-sm line-clamp-2">{review.content.review}</p>
                            )}
                            <div className="flex items-center space-x-2 mt-2">
                              <Badge className={getStatusColor(review.moderation?.status || 'unknown')}>
                                {review.moderation?.status || 'unknown'}
                              </Badge>
                              <Badge className={getSentimentColor(review.sentiment?.label || 'neutral')}>
                                <SentimentIcon className="w-3 h-3 mr-1" />
                                {review.sentiment?.label || 'neutral'}
                              </Badge>
                              <span className="text-xs text-gray-500">
                                Stayed: {review.content?.stayDate ? new Date(review.content.stayDate).toLocaleDateString() : 'Unknown'}
                              </span>
                            </div>
                          </div>
                        </div>
                        <div className="flex items-center space-x-2">
                          <Button
                            size="sm"
                            variant="outline"
                            onClick={() => openResponseModal(review)}
                          >
                            <MessageSquare className="w-4 h-4" />
                            Respond
                          </Button>
                          {review.moderation?.status === 'pending' && (
                            <>
                              <Button
                                size="sm"
                                variant="outline"
                                onClick={() => handleModerateReview(review._id, 'approved')}
                                className="text-green-600 hover:text-green-700"
                              >
                                <CheckCircle className="w-4 h-4" />
                                Approve
                              </Button>
                              <Button
                                size="sm"
                                variant="outline"
                                onClick={() => handleModerateReview(review._id, 'rejected')}
                                className="text-red-600 hover:text-red-700"
                              >
                                <XCircle className="w-4 h-4" />
                                Reject
                              </Button>
                            </>
                          )}
                        </div>
                      </div>
                    </CardHeader>
                  </Card>
                );
              })}
            </div>
          )}
        </TabsContent>
      </Tabs>

      {/* Response Modal */}
      <Dialog open={isResponseModalOpen} onOpenChange={setIsResponseModalOpen}>
        <DialogContent className="max-w-2xl">
          <DialogHeader>
            <DialogTitle>Respond to Review</DialogTitle>
          </DialogHeader>
          <div className="space-y-4">
            {selectedReview && (
              <div className="bg-gray-50 p-4 rounded-lg">
                <h4 className="font-medium mb-2">Original Review:</h4>
                <div className="flex items-center space-x-2 mb-2">
                  <span className="font-medium">{selectedReview.guest?.name || 'Unknown Guest'}</span>
                  <div className="flex items-center">
                    {renderStars(selectedReview.content?.rating || 0)}
                  </div>
                </div>
                {selectedReview.content?.title && (
                  <p className="font-medium mb-1">{selectedReview.content.title}</p>
                )}
                {selectedReview.content?.review && (
                  <p className="text-gray-600">{selectedReview.content.review}</p>
                )}
              </div>
            )}
            
            <div>
              <Label htmlFor="response">Your Response</Label>
              <Textarea
                id="response"
                value={responseData.response}
                onChange={(e) => setResponseData({ ...responseData, response: e.target.value })}
                placeholder="Write your response to this review..."
                className="min-h-[120px]"
              />
            </div>

            <div className="flex items-center space-x-2">
              <input
                type="checkbox"
                id="isPublic"
                checked={responseData.isPublic}
                onChange={(e) => setResponseData({ ...responseData, isPublic: e.target.checked })}
              />
              <Label htmlFor="isPublic">Make response public</Label>
            </div>

            <div className="flex justify-end space-x-2">
              <Button variant="outline" onClick={() => setIsResponseModalOpen(false)}>
                Cancel
              </Button>
              <Button onClick={handleRespondToReview}>
                Post Response
              </Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
};

export default ReviewManager;
