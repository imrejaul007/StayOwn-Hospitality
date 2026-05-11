import { api } from './api';

export interface LoyaltyDashboard {
  user: {
    points: number;
    tier: string;
    nextTier: string | null;
    pointsToNextTier: number;
    pointsExpiringSoon?: {
      totalPoints: number;
      items: Array<{
        points: number;
        expiresAt: string;
        description: string;
        awardType?: string | null;
      }>;
    };
    pendingPoints?: number;
    pendingBreakdown?: Array<{
      bookingId: string;
      bookingNumber: string;
      estimatedPoints: number;
    }>;
    earningFormula?: {
      pointsPerCurrencyUnit: number;
      pointsPerNight: number;
      maxPointsPerStay: number;
    };
  };
  recentTransactions: LoyaltyTransaction[];
  availableOffers: Offer[];
}

export interface LoyaltyTransaction {
  _id: string;
  type: 'earned' | 'redeemed' | 'expired' | 'bonus';
  points: number;
  description: string;
  createdAt: string;
  bookingId?: {
    _id: string;
    bookingNumber: string;
    checkIn: string;
    checkOut: string;
    totalAmount: number;
  };
  offerId?: {
    _id: string;
    title: string;
    category: string;
  };
  hotelId?: {
    _id: string;
    name: string;
  };
}

export interface Offer {
  _id: string;
  title: string;
  description: string;
  pointsRequired: number;
  discountPercentage?: number;
  discountAmount?: number;
  type: 'discount' | 'free_service' | 'upgrade' | 'bonus_points';
  category: 'room' | 'dining' | 'spa' | 'transport' | 'general';
  minTier: string;
  isActive: boolean;
  validFrom: string;
  validUntil?: string;
  maxRedemptions?: number;
  currentRedemptions: number;
  imageUrl?: string;
  terms?: string;
  hotelId?: {
    _id: string;
    name: string;
  };
}

export interface LoyaltyPoints {
  totalPoints: number;
  activePoints: number;
  tier: string;
  nextTier: string | null;
  pointsToNextTier: number;
}

export interface TransactionHistory {
  transactions: LoyaltyTransaction[];
  pagination: {
    currentPage: number;
    totalPages: number;
    totalItems: number;
    hasNext: boolean;
    hasPrev: boolean;
  };
}

export interface OffersResponse {
  offers: Offer[];
  pagination: {
    currentPage: number;
    totalPages: number;
    totalItems: number;
    itemsPerPage: number;
    hasNext: boolean;
    hasPrev: boolean;
  };
}

export interface RedemptionResult {
  message: string;
  transaction: LoyaltyTransaction;
  remainingPoints: number;
  newTier: string;
}

export interface LoyaltyAdminHealth {
  totalLedgerLiability: number;
  latestReconciliation: {
    createdAt: string;
    mismatchCount: number;
    totalUsersChecked: number;
    largestDelta: number;
  } | null;
  mismatchRate: number;
  latestExpiryRunAt: string | null;
  recentRuns: Array<{
    _id: string;
    createdAt: string;
    status: string;
    mismatchCount: number;
    totalUsersChecked: number;
    repairedCount: number;
  }>;
  openAlerts?: number;
}

export interface LoyaltyQueueStats {
  depth: number;
}

export interface LoyaltyRuleVersion {
  _id: string;
  version: number;
  isActive: boolean;
  rules: {
    pointsPerCurrencyUnit: number;
    pointsPerNight: number;
    maxPointsPerStay: number;
  };
  notes?: string;
  createdAt: string;
}

export interface LoyaltyBonusCampaign {
  _id: string;
  name: string;
  code: string;
  isActive: boolean;
  points: number;
  startsAt: string;
  endsAt: string;
  maxTotalAwards: number;
  maxAwardsPerUser: number;
  totalAwardsCount: number;
}

export interface LoyaltyOpsAlert {
  _id: string;
  type: string;
  severity: 'low' | 'medium' | 'high' | 'critical';
  message: string;
  status: 'open' | 'acknowledged' | 'resolved';
  createdAt: string;
  metadata?: Record<string, unknown>;
}

export interface OfferDetails {
  offer: Offer;
  canRedeem: boolean;
  userPoints: number;
  userTier: string;
}

class LoyaltyService {
  /**
   * Get user's loyalty dashboard
   */
  async getDashboard(): Promise<LoyaltyDashboard> {
    try {
      const response = await api.get('/loyalty/dashboard');
      return response.data.data;
    } catch (error: unknown) {
      throw error instanceof Error ? error : new Error('Request failed');
    }
  }

  /**
   * Get available loyalty offers (with pagination support)
   */
  async getOffers(category?: string, page = 1, limit = 20): Promise<OffersResponse> {
    try {
      const params: Record<string, unknown> = { page, limit };
      if (category) params.category = category;
      const response = await api.get('/loyalty/offers', { params });
      const data = response.data.data;
      return {
        offers: Array.isArray(data) ? data : (data.offers || []),
        pagination: data?.pagination || {
          currentPage: page,
          totalPages: 1,
          totalItems: Array.isArray(data) ? data.length : (data?.offers?.length || 0),
          itemsPerPage: limit,
          hasNext: false,
          hasPrev: page > 1
        }
      };
    } catch (error: unknown) {
      throw error instanceof Error ? error : new Error('Request failed');
    }
  }

  /**
   * Get specific offer details
   */
  async getOfferDetails(offerId: string): Promise<OfferDetails> {
    try {
      const response = await api.get(`/loyalty/offers/${offerId}`);
      return response.data.data;
    } catch (error: unknown) {
      throw error instanceof Error ? error : new Error('Request failed');
    }
  }

  /**
   * Get current user's loyalty information
   */
  async getUserLoyaltyInfo(): Promise<{
    points: number;
    tier: string;
    nextTier: string | null;
    pointsToNextTier: number;
  }> {
    try {
      const response = await api.get('/loyalty/dashboard');
      const dashboardData = response.data.data;
      return {
        points: dashboardData.user.points,
        tier: dashboardData.user.tier,
        nextTier: dashboardData.user.nextTier,
        pointsToNextTier: dashboardData.user.pointsToNextTier
      };
    } catch (error: unknown) {
      throw error instanceof Error ? error : new Error('Request failed');
    }
  }

  /**
   * Check if user can redeem a specific offer
   */
  async canRedeemOffer(offerId: string): Promise<{
    canRedeem: boolean;
    reason?: string;
    details?: {
      userPoints: number;
      requiredPoints: number;
      pointsNeeded?: number;
      userTier: string;
      requiredTier: string;
      offerExpired?: boolean;
      offerInactive?: boolean;
      maxRedemptionsReached?: boolean;
    };
  }> {
    try {
      const response = await api.get(`/loyalty/offers/${offerId}/can-redeem`);
      return response.data.data;
    } catch (error: unknown) {
      // If endpoint doesn't exist, do client-side validation
      try {
        const [offer, userInfo] = await Promise.all([
          this.getOfferDetails(offerId),
          this.getUserLoyaltyInfo()
        ]);

        const canRedeem = userInfo.points >= offer.pointsRequired && 
                         this.getTierLevel(userInfo.tier) >= this.getTierLevel(offer.minTier) &&
                         offer.isActive &&
                         (!offer.validUntil || new Date() <= new Date(offer.validUntil));

        return {
          canRedeem,
          reason: !canRedeem ? 'Requirements not met' : undefined,
          details: {
            userPoints: userInfo.points,
            requiredPoints: offer.pointsRequired,
            pointsNeeded: Math.max(0, offer.pointsRequired - userInfo.points),
            userTier: userInfo.tier,
            requiredTier: offer.minTier,
            offerExpired: offer.validUntil ? new Date() > new Date(offer.validUntil) : false,
            offerInactive: !offer.isActive
          }
        };
      } catch (fallbackError) {
        throw error;
      }
    }
  }

  /**
   * Get tier level for comparison
   */
  getTierLevel(tier: string): number {
    const levels = { bronze: 0, silver: 1, gold: 2, platinum: 3, diamond: 4 };
    return levels[tier.toLowerCase() as keyof typeof levels] || 0;
  }

  /**
   * Redeem points for an offer with enhanced error handling
   */
  async redeemPoints(offerId: string): Promise<RedemptionResult> {
    
    try {
      const response = await api.post('/loyalty/redeem', { offerId });
      return response.data.data;
    } catch (error: unknown) {
      const axiosErr = error as { response?: { data?: { message?: string }; status?: number }; config?: unknown };
      
      // If backend error is generic, add client-side context
      if (axiosErr.response?.status === 400 || axiosErr.response?.status === 500) {
        try {
          // Get current user info and offer details to provide specific error
          const [userInfo, offer] = await Promise.all([
            this.getUserLoyaltyInfo().catch(() => null),
            this.getOfferDetails(offerId).catch(() => null)
          ]);
          
          if (userInfo && offer) {
            const pointsNeeded = Math.max(0, offer.pointsRequired - userInfo.points);
            const hasInsufficientPoints = userInfo.points < offer.pointsRequired;
            const hasInsufficientTier = this.getTierLevel(userInfo.tier) < this.getTierLevel(offer.minTier);
            const isExpired = offer.validUntil && new Date() > new Date(offer.validUntil);
            
            // Enhance error with specific context
            axiosErr.response.data = {
              ...axiosErr.response.data,
              userPoints: userInfo.points,
              requiredPoints: offer.pointsRequired,
              pointsNeeded: pointsNeeded,
              userTier: userInfo.tier,
              requiredTier: offer.minTier,
              offerExpired: isExpired,
              offerInactive: !offer.isActive,
              errorType: hasInsufficientPoints ? 'insufficient_points' : 
                         hasInsufficientTier ? 'tier_required' :
                         isExpired ? 'offer_expired' :
                         !offer.isActive ? 'offer_inactive' : 'generic'
            };
            
            // Create more specific error message
            if (hasInsufficientPoints) {
              axiosErr.response.data.error = {
                message: `You need ${pointsNeeded} more points to redeem this offer. You have ${userInfo.points} points, but need ${offer.pointsRequired} points.`
              };
            } else if (hasInsufficientTier) {
              axiosErr.response.data.error = {
                message: `This offer requires ${offer.minTier} tier or higher. You currently have ${userInfo.tier} tier.`
              };
            } else if (isExpired) {
              axiosErr.response.data.error = {
                message: `This offer expired on ${new Date(offer.validUntil!).toLocaleDateString()}.`
              };
            } else if (!offer.isActive) {
              axiosErr.response.data.error = {
                message: 'This offer is currently inactive.'
              };
            }
          }
        } catch {
          // Error handled silently
        }
      }
      
      throw error;
    }
  }

  /**
   * Get transaction history
   */
  async getHistory(page = 1, limit = 20, type?: string): Promise<TransactionHistory> {
    try {
      const params: Record<string, unknown> = { page, limit };
      if (type) params.type = type;
    
      const response = await api.get('/loyalty/history', { params });
      return response.data.data;
    } catch (error: unknown) {
      throw error instanceof Error ? error : new Error('Request failed');
    }
  }

  /**
   * Get user's current points and tier
   */
  async getPoints(): Promise<LoyaltyPoints> {
    try {
      const response = await api.get('/loyalty/points');
      return response.data.data;
    } catch (error: unknown) {
      throw error instanceof Error ? error : new Error('Request failed');
    }
  }

  async getAdminHealth(): Promise<LoyaltyAdminHealth> {
    const response = await api.get('/loyalty/admin/health');
    return response.data.data;
  }

  async getReconciliationRuns(page = 1, limit = 20) {
    const response = await api.get('/loyalty/admin/reconciliation-runs', { params: { page, limit } });
    return response.data.data;
  }

  async runReconciliation(maxUsers = 1000) {
    const response = await api.post('/loyalty/admin/reconciliation/run', { maxUsers });
    return response.data.data;
  }

  async reconcileUser(userId: string, applyFix = false) {
    const response = await api.post(`/loyalty/admin/reconcile/${userId}`, { applyFix });
    return response.data.data;
  }

  async runExpiry(limit = 300) {
    const response = await api.post('/loyalty/admin/expiry/run', { limit });
    return response.data.data;
  }

  async getRules() {
    const response = await api.get('/loyalty/admin/rules');
    return response.data.data as { active: LoyaltyRuleVersion | null; versions: LoyaltyRuleVersion[] };
  }

  async createRuleVersion(rules: { pointsPerCurrencyUnit: number; pointsPerNight: number; maxPointsPerStay: number }, notes = '') {
    const response = await api.post('/loyalty/admin/rules', { rules, notes });
    return response.data.data as LoyaltyRuleVersion;
  }

  async simulateRules(payload: {
    monthlyCompletedStays: number;
    avgStayAmount: number;
    avgNights: number;
    sampleUsers?: number;
    rules: { pointsPerCurrencyUnit: number; pointsPerNight: number; maxPointsPerStay: number };
  }) {
    const response = await api.post('/loyalty/admin/rules/simulate', payload);
    return response.data.data;
  }

  async getCampaigns(page = 1, limit = 20) {
    const response = await api.get('/loyalty/admin/campaigns', { params: { page, limit } });
    return response.data.data as { campaigns: LoyaltyBonusCampaign[]; pagination: Record<string, unknown> };
  }

  async createCampaign(payload: {
    name: string;
    code: string;
    points: number;
    startsAt: string;
    endsAt: string;
    maxTotalAwards: number;
    maxAwardsPerUser: number;
  }) {
    const response = await api.post('/loyalty/admin/campaigns', payload);
    return response.data.data as LoyaltyBonusCampaign;
  }

  async awardCampaignBonus(campaignId: string, userId: string, reference?: string) {
    const response = await api.post(`/loyalty/admin/campaigns/${campaignId}/award`, { userId, reference });
    return response.data.data;
  }

  async getOpsAlerts(page = 1, limit = 20, status = 'open') {
    const response = await api.get('/loyalty/admin/alerts', { params: { page, limit, status } });
    return response.data.data as { alerts: LoyaltyOpsAlert[]; pagination: Record<string, unknown> };
  }

  async evaluateOpsAlerts() {
    const response = await api.post('/loyalty/admin/alerts/evaluate', {});
    return response.data.data;
  }

  async acknowledgeAlert(alertId: string) {
    const response = await api.post(`/loyalty/admin/alerts/${alertId}/ack`, {});
    return response.data.data as LoyaltyOpsAlert;
  }

  async enqueueQueueEvent(type: string, payload: Record<string, unknown> = {}) {
    const response = await api.post('/loyalty/admin/queue/enqueue', { type, payload });
    return response.data.data;
  }

  async getQueueStats(): Promise<LoyaltyQueueStats> {
    const response = await api.get('/loyalty/admin/queue/stats');
    return response.data.data;
  }

  async getComplianceRetentionReport(months = 12) {
    const response = await api.get('/loyalty/admin/compliance/retention-report', { params: { months } });
    return response.data.data;
  }

  async downloadMonthlyLiabilityCsv(year: number, month: number) {
    const response = await api.get('/loyalty/admin/finance/monthly-liability', {
      params: { year, month, format: 'csv' },
      responseType: 'blob'
    });
    return response.data as Blob;
  }

  /**
   * Get offers by category
   */
  async getOffersByCategory(category: string): Promise<Offer[]> {
    const result = await this.getOffers(category, 1, 20);
    return result.offers;
  }


  /**
   * Get tier benefits description
   */
  getTierBenefits(tier: string): string {
    switch (tier) {
      case 'diamond':
        return 'Top-tier recognition, dedicated concierge, best available upgrades, premium welcome amenities';
      case 'platinum':
        return 'Exclusive benefits, priority support, room upgrades, late checkout, welcome gifts';
      case 'gold':
        return 'Free breakfast, late checkout, welcome gifts, room preferences';
      case 'silver':
        return 'Room preferences, faster check-in, priority booking';
      default:
        return 'Basic loyalty benefits, points earning';
    }
  }

  /**
   * Get tier color for UI
   */
  getTierColor(tier: string): string {
    switch (tier) {
      case 'diamond':
        return 'from-cyan-400 to-blue-700';
      case 'platinum':
        return 'from-purple-500 to-purple-700';
      case 'gold':
        return 'from-yellow-500 to-yellow-700';
      case 'silver':
        return 'from-gray-400 to-gray-600';
      default:
        return 'from-amber-600 to-amber-800';
    }
  }

  /**
   * Get tier icon name
   */
  getTierIcon(tier: string): string {
    switch (tier) {
      case 'diamond':
        return 'Star';
      case 'platinum':
        return 'Star';
      case 'gold':
        return 'Award';
      case 'silver':
        return 'TrendingUp';
      default:
        return 'Zap';
    }
  }

  /**
   * Format points with proper formatting (en-IN locale, NaN-safe)
   */
  formatPoints(points: number): string {
    if (points == null || isNaN(points)) return '0';
    return points.toLocaleString();
  }

  /**
   * Get transaction type display info
   */
  getTransactionTypeInfo(type: string): {
    label: string;
    color: string;
    icon: string;
  } {
    switch (type) {
      case 'earned':
        return {
          label: 'Earned',
          color: 'text-green-600 bg-green-100',
          icon: 'TrendingUp'
        };
      case 'redeemed':
        return {
          label: 'Redeemed',
          color: 'text-red-600 bg-red-100',
          icon: 'Gift'
        };
      case 'bonus':
        return {
          label: 'Bonus',
          color: 'text-blue-600 bg-blue-100',
          icon: 'Star'
        };
      case 'expired':
        return {
          label: 'Expired',
          color: 'text-gray-600 bg-gray-100',
          icon: 'Clock'
        };
      default:
        return {
          label: 'Transaction',
          color: 'text-gray-600 bg-gray-100',
          icon: 'Circle'
        };
    }
  }

  /**
   * Get offer type display info
   */
  getOfferTypeInfo(type: string): {
    label: string;
    color: string;
    icon: string;
  } {
    switch (type) {
      case 'discount':
        return {
          label: 'Discount',
          color: 'text-green-600 bg-green-100',
          icon: 'Percent'
        };
      case 'free_service':
        return {
          label: 'Free Service',
          color: 'text-blue-600 bg-blue-100',
          icon: 'Gift'
        };
      case 'upgrade':
        return {
          label: 'Upgrade',
          color: 'text-purple-600 bg-purple-100',
          icon: 'ArrowUp'
        };
      case 'bonus_points':
        return {
          label: 'Bonus Points',
          color: 'text-yellow-600 bg-yellow-100',
          icon: 'Star'
        };
      default:
        return {
          label: 'Offer',
          color: 'text-gray-600 bg-gray-100',
          icon: 'Circle'
        };
    }
  }
}

export const loyaltyService = new LoyaltyService();
