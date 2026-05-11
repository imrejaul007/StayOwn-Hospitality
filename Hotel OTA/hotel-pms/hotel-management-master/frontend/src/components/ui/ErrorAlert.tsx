import React from 'react';
import { AlertCircle, XCircle, Star, TrendingUp, Clock, Zap } from 'lucide-react';

export interface LoyaltyError {
  type: 'insufficient_points' | 'tier_required' | 'offer_expired' | 'offer_inactive' | 'max_redemptions' | 'generic';
  message: string;
  details?: {
    userPoints?: number;
    requiredPoints?: number;
    pointsNeeded?: number;
    userTier?: string;
    requiredTier?: string;
    expiryDate?: string;
    maxRedemptions?: number;
    currentRedemptions?: number;
  };
}

interface ErrorAlertProps {
  error: LoyaltyError;
  onDismiss?: () => void;
  showActions?: boolean;
  className?: string;
}

const ErrorAlert: React.FC<ErrorAlertProps> = ({
  error,
  onDismiss,
  showActions = true,
  className = ''
}) => {
  const getErrorConfig = (error: LoyaltyError) => {
    switch (error.type) {
      case 'insufficient_points':
        return {
          icon: <Star className="h-5 w-5" />,
          bgColor: 'bg-orange-50',
          borderColor: 'border-orange-200',
          textColor: 'text-orange-800',
          iconColor: 'text-orange-500',
          title: 'Not Enough Points',
          message: error.details?.pointsNeeded 
            ? `You need ${error.details.pointsNeeded} more points to redeem this offer. You have ${error.details.userPoints || 0} points, but need ${error.details.requiredPoints || 0} points.`
            : error.message,
          actionText: 'Earn More Points',
          actionType: 'earn_points'
        };
      
      case 'tier_required':
        return {
          icon: <TrendingUp className="h-5 w-5" />,
          bgColor: 'bg-purple-50',
          borderColor: 'border-purple-200',
          textColor: 'text-purple-800',
          iconColor: 'text-purple-500',
          title: 'Tier Upgrade Required',
          message: error.details?.requiredTier 
            ? `This offer requires ${error.details.requiredTier} tier or higher. You currently have ${error.details.userTier || 'Bronze'} tier.`
            : error.message,
          actionText: `Upgrade to ${error.details?.requiredTier || 'Higher'} Tier`,
          actionType: 'upgrade_tier'
        };
      
      case 'offer_expired':
        return {
          icon: <Clock className="h-5 w-5" />,
          bgColor: 'bg-gray-50',
          borderColor: 'border-gray-200',
          textColor: 'text-gray-800',
          iconColor: 'text-gray-500',
          title: 'Offer Expired',
          message: error.details?.expiryDate 
            ? `This offer expired on ${new Date(error.details.expiryDate).toLocaleDateString()}. Check out our other active offers!`
            : error.message,
          actionText: 'View Active Offers',
          actionType: 'view_offers'
        };
      
      case 'offer_inactive':
        return {
          icon: <XCircle className="h-5 w-5" />,
          bgColor: 'bg-red-50',
          borderColor: 'border-red-200',
          textColor: 'text-red-800',
          iconColor: 'text-red-500',
          title: 'Offer Unavailable',
          message: 'This offer is currently inactive. Please try again later or contact support.',
          actionText: 'View Other Offers',
          actionType: 'view_offers'
        };
      
      case 'max_redemptions':
        return {
          icon: <Zap className="h-5 w-5" />,
          bgColor: 'bg-yellow-50',
          borderColor: 'border-yellow-200',
          textColor: 'text-yellow-800',
          iconColor: 'text-yellow-500',
          title: 'Maximum Redemptions Reached',
          message: error.details?.maxRedemptions 
            ? `This offer has reached its maximum limit of ${error.details.maxRedemptions} redemptions. More offers coming soon!`
            : error.message,
          actionText: 'Explore Other Offers',
          actionType: 'view_offers'
        };
      
      default:
        return {
          icon: <AlertCircle className="h-5 w-5" />,
          bgColor: 'bg-red-50',
          borderColor: 'border-red-200',
          textColor: 'text-red-800',
          iconColor: 'text-red-500',
          title: 'Error',
          message: error.message,
          actionText: 'Try Again',
          actionType: 'retry'
        };
    }
  };

  const config = getErrorConfig(error);

  const handleAction = (actionType: string) => {
    switch (actionType) {
      case 'earn_points':
        // Navigate to earning opportunities or show earning guide
        break;
      case 'upgrade_tier':
        // Show tier upgrade information
        break;
      case 'view_offers':
        // Navigate to all offers page
        window.location.href = '/app/loyalty/offers';
        break;
      case 'retry':
        // Retry the action
        window.location.reload();
        break;
    }
  };

  return (
    <div className={`rounded-lg border p-4 ${config.bgColor} ${config.borderColor} ${className}`}>
      <div className="flex items-start gap-3">
        <div className={config.iconColor}>
          {config.icon}
        </div>
        <div className="flex-1 min-w-0">
          <h4 className={`text-sm font-medium ${config.textColor}`}>
            {config.title}
          </h4>
          <p className={`mt-1 text-sm ${config.textColor} opacity-90`}>
            {config.message}
          </p>
          
          {showActions && (
            <div className="mt-3 flex items-center gap-3">
              <button aria-label={config.actionText || 'Take action'}
                onClick={() => handleAction(config.actionType)}
                className={`text-sm font-medium ${config.textColor} hover:underline focus:outline-none focus:underline`}
              >
                {config.actionText}
              </button>
              
              {onDismiss && (
                <button
                  onClick={onDismiss}
                  className={`text-sm ${config.textColor} opacity-70 hover:opacity-100 focus:outline-none`}
                >
                  Dismiss
                </button>
              )}
            </div>
          )}
        </div>
        
        {onDismiss && (
          <button
            onClick={onDismiss}
            className={`${config.textColor} opacity-50 hover:opacity-100 focus:outline-none`}
          >
            <XCircle className="h-4 w-4" />
            <span className="sr-only">Dismiss</span>
          </button>
        )}
      </div>
    </div>
  );
};

export const parseErrorToLoyaltyError = (error: unknown): LoyaltyError => {
  const axiosErr = error as { response?: { data?: { error?: { message?: string }; message?: string; errorType?: string; userPoints?: number; requiredPoints?: number; pointsNeeded?: number; userTier?: string; requiredTier?: string; maxRedemptions?: number; expiryDate?: string; offer?: { validUntil?: string }; offerExpired?: boolean; offerInactive?: boolean; currentRedemptions?: number } } };
  const message = axiosErr.response?.data?.error?.message || axiosErr.response?.data?.message || (error instanceof Error ? error.message : 'An unexpected error occurred');
  const errorData = axiosErr.response?.data || {} as Record<string, unknown>;
  
  // Check if we have explicit error type from enhanced error handling
  if (errorData.errorType) {
    return {
      type: errorData.errorType,
      message,
      details: {
        userPoints: errorData.userPoints,
        requiredPoints: errorData.requiredPoints,
        pointsNeeded: errorData.pointsNeeded,
        userTier: errorData.userTier,
        requiredTier: errorData.requiredTier,
        expiryDate: errorData.offer?.validUntil,
        offerExpired: errorData.offerExpired,
        offerInactive: errorData.offerInactive
      }
    };
  }
  
  // Parse specific error types based on message content
  if (message.toLowerCase().includes('insufficient') || message.toLowerCase().includes('not enough points') || message.toLowerCase().includes('need') && message.toLowerCase().includes('more points')) {
    return {
      type: 'insufficient_points',
      message,
      details: {
        userPoints: errorData.userPoints,
        requiredPoints: errorData.requiredPoints,
        pointsNeeded: errorData.pointsNeeded
      }
    };
  }
  
  if (message.toLowerCase().includes('tier') || message.toLowerCase().includes('level required')) {
    return {
      type: 'tier_required',
      message,
      details: {
        userTier: axiosErr.response?.data?.userTier,
        requiredTier: axiosErr.response?.data?.requiredTier
      }
    };
  }
  
  if (message.toLowerCase().includes('expired') || message.toLowerCase().includes('no longer valid')) {
    return {
      type: 'offer_expired',
      message,
      details: {
        expiryDate: axiosErr.response?.data?.expiryDate
      }
    };
  }
  
  if (message.toLowerCase().includes('inactive') || message.toLowerCase().includes('unavailable')) {
    return {
      type: 'offer_inactive',
      message
    };
  }
  
  if (message.toLowerCase().includes('maximum') || message.toLowerCase().includes('limit reached')) {
    return {
      type: 'max_redemptions',
      message,
      details: {
        maxRedemptions: axiosErr.response?.data?.maxRedemptions,
        currentRedemptions: axiosErr.response?.data?.currentRedemptions
      }
    };
  }
  
  return {
    type: 'generic',
    message
  };
};

export default ErrorAlert;