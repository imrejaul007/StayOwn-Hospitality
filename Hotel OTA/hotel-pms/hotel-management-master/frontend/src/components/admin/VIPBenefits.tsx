import React, { useState, useEffect } from 'react';
import { XMarkIcon, GiftIcon, StarIcon, CheckCircleIcon } from '@heroicons/react/24/outline';
import { toast } from 'react-hot-toast';
import { api } from '../../services/api';

interface VIPBenefitsProps {
  onClose: () => void;
}

interface VIPLevelRequirements {
  [key: string]: {
    totalSpent: number;
    totalStays: number;
    averageRating: number;
    benefits: string[];
  };
}

const VIPBenefits: React.FC<VIPBenefitsProps> = ({ onClose }) => {
  const [requirements, setRequirements] = useState<VIPLevelRequirements>({});
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetchVIPRequirements();
  }, []);

  const fetchVIPRequirements = async () => {
    try {
      setLoading(true);
      const { data } = await api.get('/vip/requirements');
      setRequirements(data.data.requirements);
    } catch (error) {
      toast.error('Failed to fetch VIP requirements');
    } finally {
      setLoading(false);
    }
  };

  const getLevelColor = (level: string) => {
    const colors = {
      bronze: 'bg-amber-100 text-amber-800 border-amber-200',
      silver: 'bg-gray-100 text-gray-800 border-gray-200',
      gold: 'bg-yellow-100 text-yellow-800 border-yellow-200',
      platinum: 'bg-blue-100 text-blue-800 border-blue-200',
      diamond: 'bg-purple-100 text-purple-800 border-purple-200'
    };
    return colors[level as keyof typeof colors] || 'bg-gray-100 text-gray-800 border-gray-200';
  };

  const getLevelIcon = (level: string) => {
    const icons = {
      bronze: '🥉',
      silver: '🥈',
      gold: '🥇',
      platinum: '💎',
      diamond: '💠'
    };
    return icons[level as keyof typeof icons] || '⭐';
  };

  const getLevelGradient = (level: string) => {
    const gradients = {
      bronze: 'from-amber-400 to-amber-600',
      silver: 'from-gray-400 to-gray-600',
      gold: 'from-yellow-400 to-yellow-600',
      platinum: 'from-blue-400 to-blue-600',
      diamond: 'from-purple-400 to-purple-600'
    };
    return gradients[level as keyof typeof gradients] || 'from-gray-400 to-gray-600';
  };

  const formatCurrency = (amount: number) => {
    return new Intl.NumberFormat('en-US', {
      style: 'currency',
      currency: 'USD'
    }).format(amount);
  };

  if (loading) {
    return (
      <div className="fixed inset-0 bg-gray-600 bg-opacity-50 overflow-y-auto h-full w-full z-50">
        <div className="relative top-20 mx-auto p-5 border w-11/12 md:w-4/5 lg:w-3/4 shadow-lg rounded-md bg-white">
          <div className="flex justify-center items-center h-64">
            <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-purple-600"></div>
            <span className="ml-2 text-gray-600">Loading VIP benefits...</span>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="fixed inset-0 bg-gray-600 bg-opacity-50 overflow-y-auto h-full w-full z-50">
      <div className="relative top-10 mx-auto p-5 border w-11/12 md:w-4/5 lg:w-3/4 shadow-lg rounded-md bg-white">
        <div className="flex justify-between items-center mb-6">
          <div className="flex items-center">
            <GiftIcon className="w-6 h-6 text-purple-600 mr-2" />
            <h3 className="text-lg font-medium text-gray-900">VIP Benefits & Requirements</h3>
          </div>
          <button aria-label="Close"
            onClick={onClose}
            className="text-gray-400 hover:text-gray-600"
          >
            <XMarkIcon className="w-6 h-6" />
          </button>
        </div>

        <div className="space-y-6">
          {/* VIP Levels Overview */}
          <div className="grid grid-cols-1 md:grid-cols-5 gap-4">
            {Object.entries(requirements).map(([level, data]) => (
              <div key={level} className={`border-2 rounded-lg p-4 ${getLevelColor(level)}`}>
                <div className="text-center">
                  <div className="text-3xl mb-2">{getLevelIcon(level)}</div>
                  <div className="font-bold text-lg capitalize">{level} VIP</div>
                  <div className="text-sm mt-1">
                    {data.totalStays} stays • {formatCurrency(data.totalSpent)}
                  </div>
                </div>
              </div>
            ))}
          </div>

          {/* Detailed VIP Level Cards */}
          <div className="space-y-6">
            {Object.entries(requirements).map(([level, data]) => (
              <div key={level} className="bg-white border border-gray-200 rounded-lg overflow-hidden shadow-sm">
                {/* Header */}
                <div className={`bg-gradient-to-r ${getLevelGradient(level)} p-6 text-white`}>
                  <div className="flex items-center">
                    <span className="text-4xl mr-4">{getLevelIcon(level)}</span>
                    <div>
                      <h4 className="text-2xl font-bold capitalize">{level} VIP</h4>
                      <p className="text-white/90">Premium hospitality experience</p>
                    </div>
                  </div>
                </div>

                <div className="p-6">
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
                    {/* Requirements */}
                    <div>
                      <h5 className="text-lg font-semibold text-gray-900 mb-4 flex items-center">
                        <StarIcon className="w-5 h-5 mr-2 text-yellow-500" />
                        Qualification Requirements
                      </h5>
                      <div className="space-y-3">
                        <div className="flex justify-between items-center p-3 bg-gray-50 rounded-lg">
                          <span className="text-gray-700">Total Stays</span>
                          <span className="font-semibold text-gray-900">{data.totalStays}</span>
                        </div>
                        <div className="flex justify-between items-center p-3 bg-gray-50 rounded-lg">
                          <span className="text-gray-700">Total Spent</span>
                          <span className="font-semibold text-gray-900">{formatCurrency(data.totalSpent)}</span>
                        </div>
                        <div className="flex justify-between items-center p-3 bg-gray-50 rounded-lg">
                          <span className="text-gray-700">Average Rating</span>
                          <span className="font-semibold text-gray-900">
                            {data.averageRating > 0 ? `${data.averageRating}/5` : 'No minimum'}
                          </span>
                        </div>
                      </div>
                    </div>

                    {/* Benefits */}
                    <div>
                      <h5 className="text-lg font-semibold text-gray-900 mb-4 flex items-center">
                        <GiftIcon className="w-5 h-5 mr-2 text-green-500" />
                        Exclusive Benefits
                      </h5>
                      <div className="space-y-2">
                        {data.benefits.map((benefit, index) => (
                          <div key={`data-benefits-${index}-${benefit}`} className="flex items-center p-3 bg-green-50 rounded-lg">
                            <CheckCircleIcon className="w-5 h-5 text-green-500 mr-3 flex-shrink-0" />
                            <span className="text-gray-700">{benefit}</span>
                          </div>
                        ))}
                      </div>
                    </div>
                  </div>

                  {/* Additional Benefits for Higher Tiers */}
                  {level === 'platinum' && (
                    <div className="mt-6 p-4 bg-blue-50 rounded-lg">
                      <h6 className="font-semibold text-blue-900 mb-2">Platinum Exclusive</h6>
                      <div className="grid grid-cols-1 md:grid-cols-2 gap-2 text-sm text-blue-800">
                        <div>• Dedicated Concierge Service</div>
                        <div>• Airport Transfer Service</div>
                        <div>• Spa Access & Treatments</div>
                        <div>• Priority Restaurant Reservations</div>
                      </div>
                    </div>
                  )}

                  {level === 'diamond' && (
                    <div className="mt-6 p-4 bg-purple-50 rounded-lg">
                      <h6 className="font-semibold text-purple-900 mb-2">Diamond Exclusive</h6>
                      <div className="grid grid-cols-1 md:grid-cols-2 gap-2 text-sm text-purple-800">
                        <div>• All Platinum Benefits</div>
                        <div>• Personal Butler Service</div>
                        <div>• Private Dining Experiences</div>
                        <div>• Complimentary Suite Upgrades</div>
                        <div>• 25% Discount on All Services</div>
                        <div>• Exclusive Event Access</div>
                      </div>
                    </div>
                  )}
                </div>
              </div>
            ))}
          </div>

          {/* Benefits Comparison Table */}
          <div className="bg-white border border-gray-200 rounded-lg overflow-hidden">
            <div className="px-6 py-4 bg-gray-50 border-b border-gray-200">
              <h4 className="text-lg font-semibold text-gray-900">Benefits Comparison</h4>
            </div>
            <div className="overflow-x-auto">
              <table className="min-w-full divide-y divide-gray-200">
                <thead className="bg-gray-50">
                  <tr>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                      Benefit
                    </th>
                    {Object.keys(requirements).map(level => (
                      <th key={level} className="px-6 py-3 text-center text-xs font-medium text-gray-500 uppercase tracking-wider">
                        <div className="flex flex-col items-center">
                          <span className="text-lg">{getLevelIcon(level)}</span>
                          <span className="capitalize">{level}</span>
                        </div>
                      </th>
                    ))}
                  </tr>
                </thead>
                <tbody className="bg-white divide-y divide-gray-200">
                  {[
                    'Priority Reservation',
                    'Welcome Amenities',
                    'Room Upgrade',
                    'Late Checkout',
                    'Early Check-in',
                    'Complimentary Breakfast',
                    'Dining Discount',
                    'Spa Access',
                    'Concierge Service',
                    'Airport Transfer'
                  ].map(benefit => (
                    <tr key={benefit}>
                      <td className="px-6 py-4 whitespace-nowrap text-sm font-medium text-gray-900">
                        {benefit}
                      </td>
                      {Object.keys(requirements).map(level => {
                        const hasBenefit = requirements[level].benefits.some(b => 
                          b.toLowerCase().includes(benefit.toLowerCase()) ||
                          (benefit === 'Dining Discount' && b.includes('Discount')) ||
                          (benefit === 'Spa Access' && b.includes('Spa'))
                        );
                        return (
                          <td key={level} className="px-6 py-4 whitespace-nowrap text-center">
                            {hasBenefit ? (
                              <CheckCircleIcon className="w-5 h-5 text-green-500 mx-auto" />
                            ) : (
                              <div className="w-5 h-5 mx-auto"></div>
                            )}
                          </td>
                        );
                      })}
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>

          {/* How to Qualify */}
          <div className="bg-gradient-to-r from-purple-50 to-blue-50 p-6 rounded-lg">
            <h4 className="text-lg font-semibold text-gray-900 mb-4">How to Qualify for VIP Status</h4>
            <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
              <div className="text-center">
                <div className="w-12 h-12 bg-purple-100 rounded-full flex items-center justify-center mx-auto mb-3">
                  <span className="text-2xl">🏨</span>
                </div>
                <h5 className="font-semibold text-gray-900 mb-2">Stay Frequently</h5>
                <p className="text-sm text-gray-600">
                  Regular stays at our hotel help you accumulate the required number of visits
                </p>
              </div>
              <div className="text-center">
                <div className="w-12 h-12 bg-purple-100 rounded-full flex items-center justify-center mx-auto mb-3">
                  <span className="text-2xl">💰</span>
                </div>
                <h5 className="font-semibold text-gray-900 mb-2">Spend More</h5>
                <p className="text-sm text-gray-600">
                  Higher spending on rooms, dining, and services accelerates your VIP journey
                </p>
              </div>
              <div className="text-center">
                <div className="w-12 h-12 bg-purple-100 rounded-full flex items-center justify-center mx-auto mb-3">
                  <span className="text-2xl">⭐</span>
                </div>
                <h5 className="font-semibold text-gray-900 mb-2">Rate Your Experience</h5>
                <p className="text-sm text-gray-600">
                  High ratings and positive feedback help maintain your VIP status
                </p>
              </div>
            </div>
          </div>
        </div>

        <div className="flex justify-end mt-6">
          <button
            onClick={onClose}
            className="px-4 py-2 text-sm font-medium text-gray-700 bg-white border border-gray-300 rounded-md hover:bg-gray-50"
          >
            Close
          </button>
        </div>
      </div>
    </div>
  );
};

export default VIPBenefits;
