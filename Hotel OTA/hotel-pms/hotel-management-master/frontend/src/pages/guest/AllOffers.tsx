import React, { useEffect, useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import {
  Gift,
  Star,
  Percent,
  ArrowUp,
  Circle,
  Search,
  Filter,
  Eye
} from 'lucide-react';
import { loyaltyService, Offer } from '../../services/loyaltyService';
import { Card } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Badge } from '@/components/ui/badge';
import { LoadingSpinner } from '../../components/LoadingSpinner';
import { formatCurrency } from '../../utils/formatters';
import FavoriteButton from '../../components/ui/FavoriteButton';
import BackButton from '../../components/ui/BackButton';
import ErrorAlert, { parseErrorToLoyaltyError } from '../../components/ui/ErrorAlert';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import toast from 'react-hot-toast';
import { withErrorBoundary } from '../../components/ErrorBoundary';

const getOfferIcon = (type: string) => {
  switch (type) {
    case 'discount': return <Percent className="h-4 w-4" />;
    case 'free_service': return <Gift className="h-4 w-4" />;
    case 'upgrade': return <ArrowUp className="h-4 w-4" />;
    case 'bonus_points': return <Star className="h-4 w-4" />;
    default: return <Circle className="h-4 w-4" />;
  }
};

const getCategoryColor = (category: string) => {
  const colors = {
    room: 'bg-blue-100 text-blue-800',
    dining: 'bg-orange-100 text-orange-800',
    spa: 'bg-green-100 text-green-800',
    transport: 'bg-purple-100 text-purple-800',
    general: 'bg-gray-100 text-gray-800'
  };
  return colors[category as keyof typeof colors] || 'bg-gray-100 text-gray-800';
};

const getOfferTypeColor = (type: string) => {
  const colors = {
    discount: 'bg-green-100 text-green-800',
    free_service: 'bg-blue-100 text-blue-800',
    upgrade: 'bg-purple-100 text-purple-800',
    bonus_points: 'bg-yellow-100 text-yellow-800'
  };
  return colors[type as keyof typeof colors] || 'bg-gray-100 text-gray-800';
};

function AllOffers() {
  const [selectedCategory, setSelectedCategory] = useState<string>('all');
  const [searchTerm, setSearchTerm] = useState<string>('');
  const [selectedOffer, setSelectedOffer] = useState<Offer | null>(null);
  const [redeemingOffer, setRedeemingOffer] = useState<string | null>(null);
  const [redemptionError, setRedemptionError] = useState<unknown>(null);
  const [page, setPage] = useState<number>(1);
  const PAGE_SIZE = 12;

  useEffect(() => {
    setPage(1);
  }, [selectedCategory]);

  const { data: offersResponse, isLoading, error, refetch } = useQuery({
    queryKey: ['loyalty-offers', selectedCategory, page],
    queryFn: () => loyaltyService.getOffers(selectedCategory === 'all' ? undefined : selectedCategory, page, PAGE_SIZE),
    staleTime: 5 * 60 * 1000, // 5 minutes
  });

  // Get user loyalty info for pre-validation
  const { data: loyaltyInfo } = useQuery({
    queryKey: ['user-loyalty-info'],
    queryFn: () => loyaltyService.getUserLoyaltyInfo(),
    staleTime: 2 * 60 * 1000, // 2 minutes
  });

  const handleRedeemOffer = async (offerId: string) => {
    try {
      setRedeemingOffer(offerId);
      setRedemptionError(null);
      
      const result = await loyaltyService.redeemPoints(offerId);
      
      toast.success(result.message || 'Offer redeemed successfully!');
      
      // Refetch both offers and user loyalty info
      refetch();
    } catch (error: unknown) {
      setRedemptionError(error);
      
      // Also show a toast for immediate feedback
      const loyaltyError = parseErrorToLoyaltyError(error);
      toast.error(loyaltyError.message);
    } finally {
      setRedeemingOffer(null);
    }
  };

  const canUserRedeemOffer = (offer: Offer): {
    canRedeem: boolean;
    reason?: string;
    pointsNeeded?: number;
    requiredTier?: string;
    userTier?: string;
  } => {
    if (!loyaltyInfo) return { canRedeem: false, reason: 'loading' };

    const hasEnoughPoints = loyaltyInfo.points >= offer.pointsRequired;
    const meetsTierRequirement = loyaltyService.getTierLevel(loyaltyInfo.tier) >= loyaltyService.getTierLevel(offer.minTier);
    const isActive = offer.isActive;
    const notExpired = !offer.validUntil || new Date() <= new Date(offer.validUntil);

    if (!hasEnoughPoints) {
      return {
        canRedeem: false,
        reason: 'insufficient_points',
        pointsNeeded: offer.pointsRequired - loyaltyInfo.points
      };
    }

    if (!meetsTierRequirement) {
      return {
        canRedeem: false,
        reason: 'tier_required',
        requiredTier: offer.minTier,
        userTier: loyaltyInfo.tier
      };
    }

    if (!isActive) {
      return { canRedeem: false, reason: 'offer_inactive' };
    }

    if (!notExpired) {
      return { canRedeem: false, reason: 'offer_expired' };
    }

    return { canRedeem: true };
  };

  const handleViewDetails = async (offer: Offer) => {
    try {
      const detailedOffer = await loyaltyService.getOfferDetails(offer._id);
      setSelectedOffer(detailedOffer.offer);
    } catch (error) {
      toast.error('Failed to load offer details');
    }
  };

  const offers = offersResponse?.offers || [];
  const pagination = offersResponse?.pagination;

  // Search is client-side on the current paginated response
  const filteredOffers = offers.filter(offer =>
    offer.title.toLowerCase().includes(searchTerm.toLowerCase()) ||
    offer.description?.toLowerCase().includes(searchTerm.toLowerCase()) ||
    offer.category.toLowerCase().includes(searchTerm.toLowerCase())
  );

  if (isLoading) {
    return (
      <div className="flex items-center justify-center h-64">
        <LoadingSpinner />
      </div>
    );
  }

  if (error) {
    return (
      <div className="text-center py-8">
        <p className="text-red-600">Failed to load offers</p>
        <Button 
          onClick={() => refetch()} 
          variant="secondary" 
          className="mt-4"
        >
          Try Again
        </Button>
      </div>
    );
  }

  return (
    <div className="p-6 max-w-7xl mx-auto">
      {/* Header */}
      <div className="mb-8">
        <div className="flex items-center justify-between mb-4">
          <BackButton 
            to="/app/loyalty" 
            label="Back to Loyalty Dashboard" 
            className="mb-2"
          />
          {loyaltyInfo && (
            <div className="flex items-center gap-4">
              <div className="text-sm text-gray-600">
                <span className="font-medium">{loyaltyInfo.points}</span> points available
              </div>
              <div className="text-sm">
                <span className={`px-2 py-1 rounded-full text-xs font-medium ${
                  loyaltyInfo.tier === 'diamond' ? 'bg-cyan-100 text-cyan-900' :
                  loyaltyInfo.tier === 'platinum' ? 'bg-purple-100 text-purple-800' :
                  loyaltyInfo.tier === 'gold' ? 'bg-yellow-100 text-yellow-800' :
                  loyaltyInfo.tier === 'silver' ? 'bg-gray-100 text-gray-800' :
                  'bg-orange-100 text-orange-800'
                }`}>
                  {loyaltyInfo.tier?.charAt(0).toUpperCase() + loyaltyInfo.tier?.slice(1)} Tier
                </span>
              </div>
            </div>
          )}
        </div>
        <h1 className="text-3xl font-bold text-gray-900 mb-2">
          Loyalty Offers
        </h1>
        <p className="text-gray-600">
          Discover and redeem exclusive rewards with your loyalty points
        </p>
      </div>

      {/* Global Error Alert */}
      {redemptionError && (
        <div className="mb-6">
          <ErrorAlert 
            error={parseErrorToLoyaltyError(redemptionError)}
            onDismiss={() => setRedemptionError(null)}
            className="max-w-2xl"
          />
        </div>
      )}

      {/* Filters */}
      <div className="mb-6 flex flex-col sm:flex-row gap-4">
        <div className="flex-1 relative">
          <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400 h-4 w-4" />
          <Input
            placeholder="Search offers..."
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            className="pl-10"
          />
        </div>
        <Select value={selectedCategory} onValueChange={setSelectedCategory}>
          <SelectTrigger className="w-full sm:w-48">
            <Filter className="h-4 w-4 mr-2" />
            <SelectValue placeholder="All categories" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All categories</SelectItem>
            <SelectItem value="room">Room</SelectItem>
            <SelectItem value="dining">Dining</SelectItem>
            <SelectItem value="spa">Spa</SelectItem>
            <SelectItem value="transport">Transport</SelectItem>
            <SelectItem value="general">General</SelectItem>
          </SelectContent>
        </Select>
      </div>

      {/* Results count */}
      <div className="mb-6">
        <p className="text-sm text-gray-600">
          {filteredOffers.length} offer{filteredOffers.length !== 1 ? 's' : ''} available
        </p>
      </div>

      {/* Offers Grid */}
      {filteredOffers.length === 0 ? (
        <div className="text-center py-16 text-gray-500">
          <Gift className="h-16 w-16 mx-auto mb-4 text-gray-300" />
          <h3 className="text-lg font-semibold mb-2">No offers found</h3>
          <p>Try adjusting your search or category filter</p>
        </div>
      ) : (
        <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-6 auto-rows-fr">
          {filteredOffers.map((offer) => {
            const eligibility = canUserRedeemOffer(offer);
            const isEligible = eligibility.canRedeem;
            
            return (
              <Card 
                key={offer._id} 
                className={`p-6 hover:shadow-lg transition-all duration-200 flex flex-col h-full min-h-[400px] ${
                  isEligible 
                    ? 'border-green-200 hover:border-green-300 shadow-green-50' 
                    : 'border-gray-200 hover:border-orange-300 shadow-orange-50'
                }`}
              >
                <div className="flex justify-between items-start mb-4">
                  <Badge className={getCategoryColor(offer.category)}>
                    {offer.category.replace('_', ' ')}
                  </Badge>
                  <div className="flex items-center gap-2">
                    {!isEligible && (
                      <div className="text-xs px-2 py-1 bg-orange-100 text-orange-800 rounded-full">
                        {eligibility.reason === 'insufficient_points' && `Need ${eligibility.pointsNeeded} more`}
                        {eligibility.reason === 'tier_required' && `${eligibility.requiredTier} tier required`}
                        {eligibility.reason === 'offer_expired' && 'Expired'}
                        {eligibility.reason === 'offer_inactive' && 'Inactive'}
                      </div>
                    )}
                    <div className="text-sm font-medium text-blue-600">
                      {offer.pointsRequired} pts
                    </div>
                  </div>
                </div>
                
                <div className="flex items-start justify-between mb-3">
                  <div className="flex items-center space-x-2 flex-1 min-w-0">
                    <div className={`p-2 rounded-full flex-shrink-0 ${getOfferTypeColor(offer.type)}`}>
                      {getOfferIcon(offer.type)}
                    </div>
                    <h3 className="font-semibold text-gray-900 text-lg truncate">{offer.title}</h3>
                  </div>
                  <div className="flex-shrink-0 ml-2">
                    <FavoriteButton offerId={offer._id} size="sm" />
                  </div>
                </div>
                
                {/* Description section with fixed height */}
                <div className="flex-grow mb-4">
                  <p className="text-sm text-gray-600 line-clamp-3 mb-4">
                    {offer.description || 'No description available'}
                  </p>
                  
                  {/* Additional info section */}
                  <div className="space-y-2">
                    {offer.type === 'discount' && (
                      <Badge variant="secondary" className="bg-green-100 text-green-800">
                        {offer.discountPercentage 
                          ? `${offer.discountPercentage}% off` 
                          : `${formatCurrency(offer.discountAmount || 0)} off`
                        }
                      </Badge>
                    )}

                    {offer.maxRedemptions && (
                      <p className="text-xs text-gray-500">
                        {offer.maxRedemptions - offer.currentRedemptions} redemptions left
                      </p>
                    )}
                    
                    {offer.validUntil && (
                      <p className="text-xs text-gray-500">
                        Expires: {new Date(offer.validUntil).toLocaleDateString()}
                      </p>
                    )}
                  </div>
                </div>
              
                {/* Action buttons - always at bottom */}
                <div className="flex space-x-2 mt-auto pt-2">
                  <Button 
                    variant="outline" 
                    size="sm" 
                    className="flex-1"
                    onClick={() => handleViewDetails(offer)}
                  >
                    <Eye className="h-4 w-4 mr-1" />
                    Details
                  </Button>
                  <Button 
                    size="sm" 
                    className={`flex-1 ${
                      isEligible 
                        ? 'bg-green-600 hover:bg-green-700 text-white' 
                        : 'bg-gray-400 hover:bg-gray-500 text-white cursor-not-allowed'
                    }`}
                    onClick={() => isEligible ? handleRedeemOffer(offer._id) : null}
                    disabled={redeemingOffer === offer._id || !isEligible}
                    title={!isEligible ? 
                      eligibility.reason === 'insufficient_points' ? `You need ${eligibility.pointsNeeded} more points` :
                      eligibility.reason === 'tier_required' ? `Requires ${eligibility.requiredTier} tier` :
                      eligibility.reason === 'offer_expired' ? 'This offer has expired' :
                      'Offer not available' : 
                      'Click to redeem this offer'
                    }
                  >
                    {redeemingOffer === offer._id ? (
                      <>
                        <LoadingSpinner size="sm" />
                        Redeeming...
                      </>
                    ) : isEligible ? (
                      'Redeem'
                    ) : (
                      eligibility.reason === 'insufficient_points' ? `Need ${eligibility.pointsNeeded} more` :
                      eligibility.reason === 'tier_required' ? 'Tier Required' :
                      'Not Available'
                    )}
                  </Button>
                </div>
              </Card>
            );
          })}
        </div>
      )}

      {pagination && (
        <div className="mt-6 flex items-center justify-between">
          <p className="text-sm text-gray-600">
            Page {pagination.currentPage} of {pagination.totalPages} ({pagination.totalItems} total offers)
          </p>
          <div className="flex items-center gap-2">
            <Button
              variant="outline"
              size="sm"
              onClick={() => setPage((prev) => Math.max(1, prev - 1))}
              disabled={!pagination.hasPrev}
            >
              Previous
            </Button>
            <Button
              variant="outline"
              size="sm"
              onClick={() => setPage((prev) => prev + 1)}
              disabled={!pagination.hasNext}
            >
              Next
            </Button>
          </div>
        </div>
      )}

      {/* Offer Details Modal */}
      <Dialog open={!!selectedOffer} onOpenChange={() => setSelectedOffer(null)}>
        <DialogContent className="max-w-2xl">
          <DialogHeader>
            <DialogTitle className="flex items-center space-x-2">
              <div className={`p-2 rounded-full ${getOfferTypeColor(selectedOffer?.type || '')}`}>
                {getOfferIcon(selectedOffer?.type || '')}
              </div>
              <span>{selectedOffer?.title}</span>
            </DialogTitle>
          </DialogHeader>
          
          {selectedOffer && (
            <div className="space-y-6">
              <div className="flex flex-wrap gap-2">
                <Badge className={getCategoryColor(selectedOffer.category)}>
                  {selectedOffer.category.replace('_', ' ')}
                </Badge>
                <Badge className={getOfferTypeColor(selectedOffer.type)}>
                  {selectedOffer.type.replace('_', ' ')}
                </Badge>
                <Badge variant="outline">
                  {selectedOffer.pointsRequired} points required
                </Badge>
                {selectedOffer.minTier && (
                  <Badge variant="outline" className="capitalize">
                    {selectedOffer.minTier}+ tier
                  </Badge>
                )}
              </div>

              {selectedOffer.description && (
                <div>
                  <h4 className="font-semibold mb-2">Description</h4>
                  <p className="text-gray-600">{selectedOffer.description}</p>
                </div>
              )}

              {selectedOffer.type === 'discount' && (
                <div>
                  <h4 className="font-semibold mb-2">Discount Details</h4>
                  <div className="bg-green-50 p-4 rounded-lg">
                    <p className="text-green-800 font-medium">
                      {selectedOffer.discountPercentage
                        ? `${selectedOffer.discountPercentage}% discount`
                        : `${formatCurrency(selectedOffer.discountAmount || 0)} discount`
                      }
                    </p>
                  </div>
                </div>
              )}

              {selectedOffer.terms && (
                <div>
                  <h4 className="font-semibold mb-2">Terms & Conditions</h4>
                  <div className="bg-gray-50 p-4 rounded-lg">
                    <p className="text-sm text-gray-600">{selectedOffer.terms}</p>
                  </div>
                </div>
              )}

              {selectedOffer.validUntil && (
                <div>
                  <h4 className="font-semibold mb-2">Validity</h4>
                  <p className="text-sm text-gray-600">
                    Valid until: {new Date(selectedOffer.validUntil).toLocaleDateString()}
                  </p>
                </div>
              )}

              {selectedOffer.maxRedemptions && (
                <div>
                  <h4 className="font-semibold mb-2">Availability</h4>
                  <p className="text-sm text-gray-600">
                    {selectedOffer.maxRedemptions - selectedOffer.currentRedemptions} redemptions remaining
                  </p>
                </div>
              )}

              <div className="flex flex-col items-end gap-2">
                {(() => {
                  const eligibility = canUserRedeemOffer(selectedOffer);
                  const isEligible = eligibility.canRedeem;
                  return (
                    <>
                      {!isEligible && eligibility.reason !== 'loading' && (
                        <p className="text-sm text-orange-600">
                          {eligibility.reason === 'insufficient_points' && `You need ${eligibility.pointsNeeded} more points to redeem this offer.`}
                          {eligibility.reason === 'tier_required' && `This offer requires ${eligibility.requiredTier} tier (you are ${eligibility.userTier}).`}
                          {eligibility.reason === 'offer_expired' && 'This offer has expired.'}
                          {eligibility.reason === 'offer_inactive' && 'This offer is currently inactive.'}
                        </p>
                      )}
                      <Button
                        onClick={() => isEligible ? handleRedeemOffer(selectedOffer._id) : null}
                        disabled={redeemingOffer === selectedOffer._id || !isEligible}
                        className={!isEligible ? 'bg-gray-400 hover:bg-gray-500 cursor-not-allowed' : ''}
                      >
                        {redeemingOffer === selectedOffer._id ? (
                          <>
                            <LoadingSpinner size="sm" />
                            Redeeming...
                          </>
                        ) : isEligible ? (
                          `Redeem for ${selectedOffer.pointsRequired} points`
                        ) : (
                          eligibility.reason === 'insufficient_points' ? `Need ${eligibility.pointsNeeded} more points` :
                          eligibility.reason === 'tier_required' ? 'Tier Required' :
                          'Not Available'
                        )}
                      </Button>
                    </>
                  );
                })()}
              </div>
            </div>
          )}
        </DialogContent>
      </Dialog>
    </div>
  );
}

export default withErrorBoundary(AllOffers);
