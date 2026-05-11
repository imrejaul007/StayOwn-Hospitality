import React, { useState } from 'react';
import {
  TrendingUp,
  Search as SearchIcon,
  Zap,
  IndianRupee,
  ArrowRight,
  Loader2,
  Package
} from 'lucide-react';
import { api } from '../../services/api';
import { useToast } from '../../hooks/useToast';

interface AddOnService {
  _id: string;
  serviceId: string;
  name: string;
  description: string;
  category: string;
  type: string;
  pricing: {
    basePrice: number;
    baseCurrency: string;
  };
  availability: {
    isAvailable: boolean;
    maxQuantityPerBooking: number;
  };
  analytics: {
    totalBookings: number;
    totalRevenue: number;
    averageRating: number;
    popularityScore: number;
  };
  isActive: boolean;
  isFeatured: boolean;
  location: {
    venue?: string;
    isOffsite: boolean;
  };
  upsellSettings?: {
    isEligible: boolean;
    triggerConditions?: {
      minBookingValue?: number;
      minNights?: number;
      roomTypes?: string[];
    };
    discountPercent?: number;
    priority?: number;
  };
  isUpsellEligible?: boolean;
}

interface UpsellRecommendation {
  _id?: string;
  serviceId?: string;
  name: string;
  description?: string;
  category: string;
  price: number;
  currency?: string;
  discountPercent?: number;
  discountedPrice?: number;
  reason?: string;
  score?: number;
}

interface UpsellManagerProps {
  services: AddOnService[];
  onUpdate: () => void;
}

const ROOM_TYPES = [
  'standard',
  'deluxe',
  'superior',
  'suite',
  'executive',
  'presidential',
  'villa',
  'cottage',
  'penthouse'
];

const getErrorMessage = (error: unknown): string => {
  if (error instanceof Error) return error.message;
  if (typeof error === 'object' && error !== null && 'message' in error)
    return String((error as Record<string, unknown>).message);
  return 'An unexpected error occurred';
};

const UpsellManager: React.FC<UpsellManagerProps> = ({ services, onUpdate: _onUpdate }) => {
  const { showToast } = useToast();

  // Test Recommendations state
  const [roomType, setRoomType] = useState('deluxe');
  const [totalValue, setTotalValue] = useState<number>(5000);
  const [nights, setNights] = useState<number>(2);
  const [recommendations, setRecommendations] = useState<UpsellRecommendation[]>([]);
  const [loadingRecs, setLoadingRecs] = useState(false);
  const [hasFetched, setHasFetched] = useState(false);

  // Filter upsell-eligible services from props
  const upsellServices = services.filter(
    (s) => s.upsellSettings?.isEligible || s.isUpsellEligible
  );

  const fetchRecommendations = async () => {
    setLoadingRecs(true);
    setHasFetched(true);
    try {
      const response = await api.get('/add-on-services/upsell-recommendations', {
        params: { roomType, totalValue, nights }
      });
      const data = response.data?.data || response.data;
      const list = Array.isArray(data) ? data : (data?.recommendations || []);
      setRecommendations(list);
      if (list.length === 0) {
        showToast('No recommendations found for these criteria', 'error');
      }
    } catch (error: unknown) {
      showToast(getErrorMessage(error), 'error');
      setRecommendations([]);
    } finally {
      setLoadingRecs(false);
    }
  };

  const getCategoryColor = (category: string): string => {
    const colors: Record<string, string> = {
      dining: 'bg-orange-100 text-orange-800',
      spa: 'bg-purple-100 text-purple-800',
      fitness: 'bg-green-100 text-green-800',
      transportation: 'bg-blue-100 text-blue-800',
      entertainment: 'bg-pink-100 text-pink-800',
      business: 'bg-gray-100 text-gray-800',
      laundry: 'bg-teal-100 text-teal-800',
      tours: 'bg-indigo-100 text-indigo-800',
      concierge: 'bg-yellow-100 text-yellow-800'
    };
    return colors[category] || 'bg-gray-100 text-gray-800';
  };

  return (
    <div className="space-y-8">
      {/* Section 1: Test Recommendations */}
      <div className="bg-white border border-gray-200 rounded-lg">
        <div className="p-6 border-b border-gray-200">
          <div className="flex items-center space-x-2">
            <Zap className="h-5 w-5 text-indigo-600" />
            <h3 className="text-lg font-semibold text-gray-900">Test Recommendations</h3>
          </div>
          <p className="text-sm text-gray-600 mt-1">
            Simulate upsell recommendations for a given booking scenario
          </p>
        </div>

        <div className="p-6">
          <div className="grid grid-cols-1 sm:grid-cols-4 gap-4 mb-6">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Room Type</label>
              <select
                value={roomType}
                onChange={(e) => setRoomType(e.target.value)}
                className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500"
              >
                {ROOM_TYPES.map((rt) => (
                  <option key={rt} value={rt}>
                    {rt.charAt(0).toUpperCase() + rt.slice(1)}
                  </option>
                ))}
              </select>
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                Booking Value
              </label>
              <div className="relative">
                <IndianRupee className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400 h-4 w-4" />
                <input
                  type="number"
                  value={totalValue}
                  onChange={(e) => setTotalValue(parseFloat(e.target.value) || 0)}
                  className="w-full pl-9 pr-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500"
                  min="0"
                />
              </div>
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Nights</label>
              <input
                type="number"
                value={nights}
                onChange={(e) => setNights(parseInt(e.target.value) || 1)}
                className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500"
                min="1"
              />
            </div>
            <div className="flex items-end">
              <button
                onClick={fetchRecommendations}
                disabled={loadingRecs}
                className="w-full flex items-center justify-center space-x-2 bg-indigo-600 text-white px-4 py-2 rounded-lg hover:bg-indigo-700 disabled:opacity-50"
              >
                {loadingRecs ? (
                  <Loader2 className="h-4 w-4 animate-spin" />
                ) : (
                  <SearchIcon className="h-4 w-4" />
                )}
                <span>{loadingRecs ? 'Fetching...' : 'Get Recommendations'}</span>
              </button>
            </div>
          </div>

          {/* Recommendation Results */}
          {hasFetched && !loadingRecs && recommendations.length > 0 && (
            <div className="space-y-3">
              <h4 className="text-sm font-medium text-gray-700">
                {recommendations.length} Recommendation{recommendations.length !== 1 ? 's' : ''} Found
              </h4>
              <div className="grid gap-3 md:grid-cols-2 lg:grid-cols-3">
                {recommendations.map((rec, idx) => (
                  <div
                    key={rec._id || rec.serviceId || idx}
                    className="border border-gray-200 rounded-lg p-4 hover:shadow-md transition-shadow"
                  >
                    <div className="flex justify-between items-start mb-2">
                      <div>
                        <h5 className="font-medium text-gray-900">{rec.name}</h5>
                        <span
                          className={`inline-block px-2 py-0.5 text-xs font-medium rounded-full mt-1 ${getCategoryColor(rec.category)}`}
                        >
                          {rec.category}
                        </span>
                      </div>
                      {rec.score != null && (
                        <div className="text-xs text-gray-500 bg-gray-100 px-2 py-1 rounded">
                          Score: {typeof rec.score === 'number' ? rec.score.toFixed(1) : rec.score}
                        </div>
                      )}
                    </div>
                    {rec.description && (
                      <p className="text-sm text-gray-600 mb-2 line-clamp-2">{rec.description}</p>
                    )}
                    <div className="flex items-center justify-between mt-2">
                      <div className="flex items-center space-x-1">
                        <IndianRupee className="h-3.5 w-3.5 text-green-600" />
                        {rec.discountedPrice != null && rec.discountedPrice < rec.price ? (
                          <span className="text-sm">
                            <span className="line-through text-gray-400 mr-1">
                              {rec.price.toLocaleString()}
                            </span>
                            <span className="font-medium text-green-700">
                              {rec.discountedPrice.toLocaleString()}
                            </span>
                          </span>
                        ) : (
                          <span className="text-sm font-medium text-gray-900">
                            {rec.price.toLocaleString()}
                          </span>
                        )}
                      </div>
                      {rec.discountPercent != null && rec.discountPercent > 0 && (
                        <span className="text-xs bg-red-100 text-red-700 px-2 py-0.5 rounded-full">
                          {rec.discountPercent}% OFF
                        </span>
                      )}
                    </div>
                    {rec.reason && (
                      <div className="mt-2 flex items-start space-x-1 text-xs text-gray-500">
                        <ArrowRight className="h-3 w-3 mt-0.5 flex-shrink-0" />
                        <span>{rec.reason}</span>
                      </div>
                    )}
                  </div>
                ))}
              </div>
            </div>
          )}

          {hasFetched && !loadingRecs && recommendations.length === 0 && (
            <div className="text-center py-6 bg-gray-50 rounded-lg">
              <TrendingUp className="h-8 w-8 text-gray-400 mx-auto mb-2" />
              <p className="text-sm text-gray-600">
                No recommendations for these criteria. Try different parameters.
              </p>
            </div>
          )}
        </div>
      </div>

      {/* Section 2: Upsell-Eligible Services */}
      <div className="bg-white border border-gray-200 rounded-lg">
        <div className="p-6 border-b border-gray-200">
          <div className="flex items-center space-x-2">
            <TrendingUp className="h-5 w-5 text-green-600" />
            <h3 className="text-lg font-semibold text-gray-900">Upsell-Eligible Services</h3>
          </div>
          <p className="text-sm text-gray-600 mt-1">
            Services configured for upsell recommendations ({upsellServices.length} total)
          </p>
        </div>

        <div className="p-6">
          {upsellServices.length > 0 ? (
            <div className="overflow-x-auto">
              <table className="min-w-full divide-y divide-gray-200">
                <thead className="bg-gray-50">
                  <tr>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                      Service
                    </th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                      Category
                    </th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                      Price
                    </th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                      Upsell Trigger Conditions
                    </th>
                  </tr>
                </thead>
                <tbody className="bg-white divide-y divide-gray-200">
                  {upsellServices.map((service) => (
                    <tr key={service._id} className="hover:bg-gray-50">
                      <td className="px-6 py-4 whitespace-nowrap">
                        <div className="font-medium text-gray-900">{service.name}</div>
                        {service.description && (
                          <div className="text-sm text-gray-500 truncate max-w-xs">
                            {service.description}
                          </div>
                        )}
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap">
                        <span
                          className={`px-2 py-1 text-xs font-medium rounded-full ${getCategoryColor(service.category)}`}
                        >
                          {service.category}
                        </span>
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap">
                        <div className="flex items-center space-x-1 text-sm font-medium text-gray-900">
                          <IndianRupee className="h-3.5 w-3.5" />
                          <span>{service.pricing.basePrice.toLocaleString()}</span>
                        </div>
                      </td>
                      <td className="px-6 py-4">
                        {service.upsellSettings?.triggerConditions ? (
                          <div className="flex flex-wrap gap-2">
                            {service.upsellSettings.triggerConditions.minBookingValue != null && (
                              <span className="text-xs bg-blue-50 text-blue-700 px-2 py-1 rounded">
                                Min Booking: {'\u20B9'}{service.upsellSettings.triggerConditions.minBookingValue.toLocaleString()}
                              </span>
                            )}
                            {service.upsellSettings.triggerConditions.minNights != null && (
                              <span className="text-xs bg-green-50 text-green-700 px-2 py-1 rounded">
                                Min Nights: {service.upsellSettings.triggerConditions.minNights}
                              </span>
                            )}
                            {service.upsellSettings.triggerConditions.roomTypes &&
                              service.upsellSettings.triggerConditions.roomTypes.length > 0 && (
                                <span className="text-xs bg-purple-50 text-purple-700 px-2 py-1 rounded">
                                  Rooms: {service.upsellSettings.triggerConditions.roomTypes.join(', ')}
                                </span>
                              )}
                            {service.upsellSettings.discountPercent != null &&
                              service.upsellSettings.discountPercent > 0 && (
                                <span className="text-xs bg-red-50 text-red-700 px-2 py-1 rounded">
                                  Discount: {service.upsellSettings.discountPercent}%
                                </span>
                              )}
                          </div>
                        ) : (
                          <span className="text-sm text-gray-400">No conditions set</span>
                        )}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          ) : (
            /* Empty State */
            <div className="text-center py-12">
              <Package className="h-12 w-12 text-gray-400 mx-auto mb-4" />
              <h3 className="text-lg font-medium text-gray-900 mb-2">
                No upsell services configured
              </h3>
              <p className="text-gray-600">
                Enable upsell settings on your add-on services to see them here.
                Configure upsell eligibility from the service edit form.
              </p>
            </div>
          )}
        </div>
      </div>
    </div>
  );
};

export default UpsellManager;
