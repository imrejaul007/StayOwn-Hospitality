import React, { useState, useEffect } from 'react';
import { XMarkIcon, ChartBarIcon } from '@heroicons/react/24/outline';
import { toast } from 'react-hot-toast';
import { api } from '../../services/api';

interface GuestAnalyticsProps {
  onClose: () => void;
}

interface AnalyticsData {
  totalGuests: number;
  loyaltyTierDistribution: { [key: string]: number };
  guestTypeDistribution: { [key: string]: number };
  registrationTrends: Array<{
    _id: { year: number; month: number };
    count: number;
  }>;
  bookingTrends: Array<{
    _id: { year: number; month: number };
    bookings: number;
    revenue: number;
  }>;
  topRevenueGuests: Array<{
    _id: string;
    totalRevenue: number;
    bookingCount: number;
  }>;
}

const GuestAnalytics: React.FC<GuestAnalyticsProps> = ({ onClose }) => {
  const [analytics, setAnalytics] = useState<AnalyticsData | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetchAnalytics();
  }, []);

  const fetchAnalytics = async () => {
    try {
      setLoading(true);
      const { data } = await api.get('/guests/analytics');
      setAnalytics(data.data);
    } catch (error) {
      toast.error('Failed to fetch guest analytics');
    } finally {
      setLoading(false);
    }
  };

  const getLoyaltyTierColor = (tier: string) => {
    const colors = {
      bronze: 'bg-orange-500',
      silver: 'bg-gray-500',
      gold: 'bg-yellow-500',
      platinum: 'bg-purple-500'
    };
    return colors[tier as keyof typeof colors] || 'bg-gray-500';
  };

  const getGuestTypeColor = (type: string) => {
    const colors = {
      normal: 'bg-blue-500',
      corporate: 'bg-green-500'
    };
    return colors[type as keyof typeof colors] || 'bg-gray-500';
  };

  const formatMonth = (month: number) => {
    const months = [
      'Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun',
      'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'
    ];
    return months[month - 1];
  };

  if (loading) {
    return (
      <div className="fixed inset-0 bg-gray-600 bg-opacity-50 overflow-y-auto h-full w-full z-50">
        <div className="relative top-20 mx-auto p-5 border w-11/12 md:w-4/5 lg:w-3/4 shadow-lg rounded-md bg-white">
          <div className="flex justify-center items-center h-64">
            <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600"></div>
            <span className="ml-2 text-gray-600">Loading analytics...</span>
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
            <ChartBarIcon className="w-6 h-6 text-blue-600 mr-2" />
            <h3 className="text-lg font-medium text-gray-900">Guest Analytics Dashboard</h3>
          </div>
          <button aria-label="Close"
            onClick={onClose}
            className="text-gray-400 hover:text-gray-600"
          >
            <XMarkIcon className="w-6 h-6" />
          </button>
        </div>

        {analytics && (
          <div className="space-y-6">
            {/* Overview Cards */}
            <div className="grid grid-cols-1 md:grid-cols-4 gap-6">
              <div className="bg-blue-50 p-6 rounded-lg">
                <div className="flex items-center">
                  <div className="flex-shrink-0">
                    <ChartBarIcon className="w-8 h-8 text-blue-600" />
                  </div>
                  <div className="ml-4">
                    <p className="text-sm font-medium text-blue-600">Total Guests</p>
                    <p className="text-2xl font-bold text-blue-900">{analytics.totalGuests}</p>
                  </div>
                </div>
              </div>

              <div className="bg-green-50 p-6 rounded-lg">
                <div className="flex items-center">
                  <div className="flex-shrink-0">
                    <div className="w-8 h-8 bg-green-600 rounded-full flex items-center justify-center">
                      <span className="text-white text-sm font-bold">$</span>
                    </div>
                  </div>
                  <div className="ml-4">
                    <p className="text-sm font-medium text-green-600">Top Revenue</p>
                    <p className="text-2xl font-bold text-green-900">
                      ${analytics.topRevenueGuests[0]?.totalRevenue?.toFixed(0) || '0'}
                    </p>
                  </div>
                </div>
              </div>

              <div className="bg-purple-50 p-6 rounded-lg">
                <div className="flex items-center">
                  <div className="flex-shrink-0">
                    <div className="w-8 h-8 bg-purple-600 rounded-full flex items-center justify-center">
                      <span className="text-white text-sm font-bold">★</span>
                    </div>
                  </div>
                  <div className="ml-4">
                    <p className="text-sm font-medium text-purple-600">Platinum Guests</p>
                    <p className="text-2xl font-bold text-purple-900">
                      {analytics.loyaltyTierDistribution.platinum || 0}
                    </p>
                  </div>
                </div>
              </div>

              <div className="bg-orange-50 p-6 rounded-lg">
                <div className="flex items-center">
                  <div className="flex-shrink-0">
                    <div className="w-8 h-8 bg-orange-600 rounded-full flex items-center justify-center">
                      <span className="text-white text-sm font-bold">🏢</span>
                    </div>
                  </div>
                  <div className="ml-4">
                    <p className="text-sm font-medium text-orange-600">Corporate Guests</p>
                    <p className="text-2xl font-bold text-orange-900">
                      {analytics.guestTypeDistribution.corporate || 0}
                    </p>
                  </div>
                </div>
              </div>
            </div>

            {/* Distribution Charts */}
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              {/* Loyalty Tier Distribution */}
              <div className="bg-white border border-gray-200 rounded-lg p-6">
                <h4 className="text-lg font-medium text-gray-900 mb-4">Loyalty Tier Distribution</h4>
                <div className="space-y-3">
                  {Object.entries(analytics.loyaltyTierDistribution).map(([tier, count]) => {
                    const percentage = analytics.totalGuests > 0 ? (count / analytics.totalGuests) * 100 : 0;
                    return (
                      <div key={tier} className="flex items-center justify-between">
                        <div className="flex items-center">
                          <div className={`w-4 h-4 rounded-full ${getLoyaltyTierColor(tier)} mr-3`}></div>
                          <span className="text-sm font-medium text-gray-900 capitalize">{tier}</span>
                        </div>
                        <div className="flex items-center space-x-2">
                          <span className="text-sm text-gray-500">{count}</span>
                          <div className="w-20 bg-gray-200 rounded-full h-2">
                            <div
                              className={`h-2 rounded-full ${getLoyaltyTierColor(tier)}`}
                              style={{ width: `${percentage}%` }}
                            ></div>
                          </div>
                          <span className="text-xs text-gray-500 w-8">{percentage.toFixed(1)}%</span>
                        </div>
                      </div>
                    );
                  })}
                </div>
              </div>

              {/* Guest Type Distribution */}
              <div className="bg-white border border-gray-200 rounded-lg p-6">
                <h4 className="text-lg font-medium text-gray-900 mb-4">Guest Type Distribution</h4>
                <div className="space-y-3">
                  {Object.entries(analytics.guestTypeDistribution).map(([type, count]) => {
                    const percentage = analytics.totalGuests > 0 ? (count / analytics.totalGuests) * 100 : 0;
                    return (
                      <div key={type} className="flex items-center justify-between">
                        <div className="flex items-center">
                          <div className={`w-4 h-4 rounded-full ${getGuestTypeColor(type)} mr-3`}></div>
                          <span className="text-sm font-medium text-gray-900 capitalize">{type}</span>
                        </div>
                        <div className="flex items-center space-x-2">
                          <span className="text-sm text-gray-500">{count}</span>
                          <div className="w-20 bg-gray-200 rounded-full h-2">
                            <div
                              className={`h-2 rounded-full ${getGuestTypeColor(type)}`}
                              style={{ width: `${percentage}%` }}
                            ></div>
                          </div>
                          <span className="text-xs text-gray-500 w-8">{percentage.toFixed(1)}%</span>
                        </div>
                      </div>
                    );
                  })}
                </div>
              </div>
            </div>

            {/* Trends */}
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              {/* Registration Trends */}
              <div className="bg-white border border-gray-200 rounded-lg p-6">
                <h4 className="text-lg font-medium text-gray-900 mb-4">Registration Trends (Last 12 Months)</h4>
                <div className="space-y-2">
                  {analytics.registrationTrends.slice(-6).map((trend, index) => (
                    <div key={trend._id} className="flex items-center justify-between">
                      <span className="text-sm text-gray-600">
                        {formatMonth(trend._id.month)} {trend._id.year}
                      </span>
                      <div className="flex items-center space-x-2">
                        <div className="w-24 bg-gray-200 rounded-full h-2">
                          <div
                            className="h-2 bg-blue-500 rounded-full"
                            style={{ 
                              width: `${Math.max(10, (trend.count / Math.max(...analytics.registrationTrends.map(t => t.count))) * 100)}%` 
                            }}
                          ></div>
                        </div>
                        <span className="text-sm text-gray-900 w-8">{trend.count}</span>
                      </div>
                    </div>
                  ))}
                </div>
              </div>

              {/* Booking Trends */}
              <div className="bg-white border border-gray-200 rounded-lg p-6">
                <h4 className="text-lg font-medium text-gray-900 mb-4">Booking Trends (Last 12 Months)</h4>
                <div className="space-y-2">
                  {analytics.bookingTrends.slice(-6).map((trend, index) => (
                    <div key={trend._id} className="flex items-center justify-between">
                      <span className="text-sm text-gray-600">
                        {formatMonth(trend._id.month)} {trend._id.year}
                      </span>
                      <div className="flex items-center space-x-2">
                        <div className="w-24 bg-gray-200 rounded-full h-2">
                          <div
                            className="h-2 bg-green-500 rounded-full"
                            style={{ 
                              width: `${Math.max(10, (trend.bookings / Math.max(...analytics.bookingTrends.map(t => t.bookings))) * 100)}%` 
                            }}
                          ></div>
                        </div>
                        <span className="text-sm text-gray-900 w-8">{trend.bookings}</span>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            </div>

            {/* Top Revenue Guests */}
            <div className="bg-white border border-gray-200 rounded-lg p-6">
              <h4 className="text-lg font-medium text-gray-900 mb-4">Top Revenue Guests</h4>
              <div className="space-y-3">
                {analytics.topRevenueGuests.slice(0, 5).map((guest, index) => (
                  <div key={guest._id} className="flex items-center justify-between p-3 bg-gray-50 rounded-lg">
                    <div className="flex items-center">
                      <div className="w-8 h-8 bg-blue-100 rounded-full flex items-center justify-center mr-3">
                        <span className="text-sm font-bold text-blue-600">#{index + 1}</span>
                      </div>
                      <div>
                        <p className="text-sm font-medium text-gray-900">Guest ID: {guest._id.slice(-8)}</p>
                        <p className="text-xs text-gray-500">{guest.bookingCount} bookings</p>
                      </div>
                    </div>
                    <div className="text-right">
                      <p className="text-sm font-bold text-green-600">
                        ${guest.totalRevenue.toFixed(2)}
                      </p>
                      <p className="text-xs text-gray-500">Total Revenue</p>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          </div>
        )}

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

export default GuestAnalytics;
