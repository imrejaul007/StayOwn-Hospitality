import React, { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { Sparkles, TrendingUp, Star, Users } from 'lucide-react';
import toast from 'react-hot-toast';
import favoritesService from '../../services/favoritesService';
import { loyaltyService } from '../../services/loyaltyService';
import FavoriteButton from '../../components/ui/FavoriteButton';
import BackButton from '../../components/ui/BackButton';
import ErrorAlert, { parseErrorToLoyaltyError } from '../../components/ui/ErrorAlert';
import { withErrorBoundary } from '../../components/ErrorBoundary';

const RecommendationsPage: React.FC = () => {
  const [activeTab, setActiveTab] = useState<'recommended' | 'popular'>('recommended');
  const [redemptionError, setRedemptionError] = useState<unknown>(null);

  // Get personalized recommendations
  const { data: recommendationsData, isLoading: recommendationsLoading } = useQuery({
    queryKey: ['recommendations'],
    queryFn: () => favoritesService.getRecommendations({ limit: 12, excludeFavorites: true }),
    staleTime: 1000 * 60 * 10, // 10 minutes
  });

  // Get popular offers
  const { data: popularData, isLoading: popularLoading } = useQuery({
    queryKey: ['popular-offers'],
    queryFn: () => favoritesService.getPopularOffers({ limit: 12, timeframe: 'month' }),
    staleTime: 1000 * 60 * 10, // 10 minutes
  });

  const getCategoryIcon = (category: string) => {
    switch (category) {
      case 'room': return '🏨';
      case 'dining': return '🍽️';
      case 'spa': return '🧖‍♀️';
      case 'transport': return '🚗';
      default: return '🎁';
    }
  };

  const getTypeColor = (type: string) => {
    switch (type) {
      case 'discount': return 'bg-green-100 text-green-800 border-green-200';
      case 'free_service': return 'bg-blue-100 text-blue-800 border-blue-200';
      case 'upgrade': return 'bg-purple-100 text-purple-800 border-purple-200';
      case 'bonus_points': return 'bg-yellow-100 text-yellow-800 border-yellow-200';
      default: return 'bg-gray-100 text-gray-800 border-gray-200';
    }
  };

  const handleRedeemOffer = async (offerId: string) => {
    try {
      setRedemptionError(null);
      const result = await loyaltyService.redeemPoints(offerId);
      toast.success(result.message || 'Offer redeemed successfully!');
    } catch (error: unknown) {
      setRedemptionError(error);
      const loyaltyError = parseErrorToLoyaltyError(error);
      toast.error(loyaltyError.message);
    }
  };

  const recommendations = recommendationsData?.data || [];
  const popularOffers = popularData?.data || [];

  return (
    <div className="min-h-screen bg-gray-50 p-6">
      <div className="max-w-7xl mx-auto">
        {/* Header */}
        <div className="mb-8">
          <div className="flex items-center justify-between mb-4">
            <BackButton 
              to="/app/loyalty" 
              label="Back to Loyalty Dashboard" 
            />
          </div>
          <div className="flex items-center gap-3 mb-4">
            <Sparkles className="h-8 w-8 text-purple-500" />
            <h1 className="text-3xl font-bold text-gray-900">Discover Offers</h1>
          </div>
          <p className="text-gray-600">
            Personalized recommendations and popular offers curated just for you
          </p>

          {/* Error Alert */}
          {redemptionError && (
            <div className="mb-6">
              <ErrorAlert 
                error={parseErrorToLoyaltyError(redemptionError)}
                onDismiss={() => setRedemptionError(null)}
                className="max-w-2xl"
              />
            </div>
          )}
        </div>

        {/* Tabs */}
        <div className="flex space-x-1 mb-8 bg-gray-100 p-1 rounded-lg w-fit">
          <button
            onClick={() => setActiveTab('recommended')}
            className={`px-6 py-3 rounded-md text-sm font-medium transition-colors ${
              activeTab === 'recommended'
                ? 'bg-white text-purple-600 shadow-sm'
                : 'text-gray-600 hover:text-gray-900'
            }`}
          >
            <div className="flex items-center gap-2">
              <Sparkles className="h-4 w-4" />
              For You
            </div>
          </button>
          <button
            onClick={() => setActiveTab('popular')}
            className={`px-6 py-3 rounded-md text-sm font-medium transition-colors ${
              activeTab === 'popular'
                ? 'bg-white text-purple-600 shadow-sm'
                : 'text-gray-600 hover:text-gray-900'
            }`}
          >
            <div className="flex items-center gap-2">
              <TrendingUp className="h-4 w-4" />
              Popular
            </div>
          </button>
        </div>

        {/* Content */}
        {activeTab === 'recommended' && (
          <div>
            <div className="flex items-center gap-2 mb-6">
              <Sparkles className="h-5 w-5 text-purple-500" />
              <h2 className="text-xl font-semibold text-gray-900">Recommended for You</h2>
            </div>

            {recommendationsLoading ? (
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
                {Array.from({ length: 6 }).map((_, i) => (
                  <div key={i} className="bg-white rounded-lg border p-6">
                    <div className="animate-pulse">
                      <div className="h-4 bg-gray-200 rounded mb-4"></div>
                      <div className="h-6 bg-gray-200 rounded mb-2"></div>
                      <div className="h-4 bg-gray-200 rounded mb-4"></div>
                      <div className="h-4 bg-gray-200 rounded w-1/2"></div>
                    </div>
                  </div>
                ))}
              </div>
            ) : recommendations.length === 0 ? (
              <div className="text-center py-16">
                <Sparkles className="h-16 w-16 text-gray-300 mx-auto mb-4" />
                <h3 className="text-xl font-semibold text-gray-900 mb-2">No recommendations yet</h3>
                <p className="text-gray-600">
                  Start adding offers to your favorites to get personalized recommendations!
                </p>
              </div>
            ) : (
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
                {recommendations.map((offer) => (
                  <div key={offer._id} className="bg-white rounded-lg border hover:shadow-lg transition-shadow group">
                    <div className="p-6">
                      <div className="flex items-start justify-between mb-4">
                        <div className="flex items-center gap-2">
                          <span className="text-2xl">{getCategoryIcon(offer.category)}</span>
                          <span className={`px-2 py-1 text-xs rounded-full border ${getTypeColor(offer.type)}`}>
                            {offer.type.replace('_', ' ')}
                          </span>
                        </div>
                        <FavoriteButton offerId={offer._id} size="sm" />
                      </div>
                      
                      <h3 className="text-lg font-semibold text-gray-900 mb-2">{offer.title}</h3>
                      <p className="text-gray-600 text-sm mb-4 line-clamp-2">{offer.description}</p>
                      
                      <div className="flex items-center justify-between mb-4">
                        <div className="flex items-center gap-1 text-purple-600">
                          <Star className="h-4 w-4" />
                          <span className="font-medium">{offer.pointsRequired} points</span>
                        </div>
                        <div className="text-xs text-green-600 bg-green-50 px-2 py-1 rounded">
                          Match: {(offer.recommendationScore * 100 / 6).toFixed(0)}%
                        </div>
                      </div>

                      <div className="text-xs text-gray-500 mb-4 bg-blue-50 p-2 rounded">
                        💡 {offer.recommendationReason}
                      </div>

                      <button
                        onClick={() => handleRedeemOffer(offer._id)}
                        className="w-full bg-purple-600 text-white py-2 rounded-lg hover:bg-purple-700 transition-colors font-medium"
                      >
                        Redeem Offer
                      </button>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        )}

        {activeTab === 'popular' && (
          <div>
            <div className="flex items-center gap-2 mb-6">
              <TrendingUp className="h-5 w-5 text-orange-500" />
              <h2 className="text-xl font-semibold text-gray-900">Popular This Month</h2>
            </div>

            {popularLoading ? (
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
                {Array.from({ length: 6 }).map((_, i) => (
                  <div key={i} className="bg-white rounded-lg border p-6">
                    <div className="animate-pulse">
                      <div className="h-4 bg-gray-200 rounded mb-4"></div>
                      <div className="h-6 bg-gray-200 rounded mb-2"></div>
                      <div className="h-4 bg-gray-200 rounded mb-4"></div>
                      <div className="h-4 bg-gray-200 rounded w-1/2"></div>
                    </div>
                  </div>
                ))}
              </div>
            ) : popularOffers.length === 0 ? (
              <div className="text-center py-16">
                <TrendingUp className="h-16 w-16 text-gray-300 mx-auto mb-4" />
                <h3 className="text-xl font-semibold text-gray-900 mb-2">No popular offers</h3>
                <p className="text-gray-600">Check back later for trending offers!</p>
              </div>
            ) : (
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
                {popularOffers.map((item) => (
                  <div key={item.offerId} className="bg-white rounded-lg border hover:shadow-lg transition-shadow group">
                    <div className="p-6">
                      <div className="flex items-start justify-between mb-4">
                        <div className="flex items-center gap-2">
                          <span className="text-2xl">{getCategoryIcon(item.offer.category)}</span>
                          <span className={`px-2 py-1 text-xs rounded-full border ${getTypeColor(item.offer.type)}`}>
                            {item.offer.type.replace('_', ' ')}
                          </span>
                        </div>
                        <FavoriteButton offerId={item.offerId} size="sm" />
                      </div>
                      
                      <h3 className="text-lg font-semibold text-gray-900 mb-2">{item.offer.title}</h3>
                      <p className="text-gray-600 text-sm mb-4 line-clamp-2">{item.offer.description}</p>
                      
                      <div className="flex items-center justify-between mb-4">
                        <div className="flex items-center gap-1 text-orange-600">
                          <Star className="h-4 w-4" />
                          <span className="font-medium">{item.offer.pointsRequired} points</span>
                        </div>
                        <div className="text-xs text-orange-600 bg-orange-50 px-2 py-1 rounded">
                          🔥 {item.favoriteCount} favorites
                        </div>
                      </div>

                      <div className="flex items-center gap-4 text-xs text-gray-500 mb-4">
                        <div className="flex items-center gap-1">
                          <Users className="h-3 w-3" />
                          {item.uniqueUsers} users
                        </div>
                        <div className="flex items-center gap-1">
                          <TrendingUp className="h-3 w-3" />
                          Score: {Math.round(item.popularityScore)}
                        </div>
                      </div>

                      <button
                        onClick={() => handleRedeemOffer(item.offerId)}
                        className="w-full bg-orange-600 text-white py-2 rounded-lg hover:bg-orange-700 transition-colors font-medium"
                      >
                        Redeem Offer
                      </button>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  );
};

export default withErrorBoundary(RecommendationsPage);