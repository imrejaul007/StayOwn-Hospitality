import React, { useState, useEffect } from 'react';
import { XMarkIcon, SparklesIcon as CrownIcon, ChartBarIcon, StarIcon } from '@heroicons/react/24/outline';
import { IndianRupee } from 'lucide-react';
import { toast } from 'react-hot-toast';
import { api } from '../../services/api';

interface VIPStatisticsProps {
  onClose: () => void;
}

interface StatisticsData {
  total: number;
  active: number;
  inactive: number;
  suspended: number;
  pending: number;
  byLevel: {
    [key: string]: {
      total: number;
      active: number;
      inactive: number;
      suspended: number;
      pending: number;
    };
  };
  totalSpent: number;
  totalStays: number;
  totalNights: number;
}

const VIPStatistics: React.FC<VIPStatisticsProps> = ({ onClose }) => {
  const [statistics, setStatistics] = useState<StatisticsData | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetchStatistics();
  }, []);

  const fetchStatistics = async () => {
    try {
      setLoading(true);
      const { data } = await api.get('/vip/statistics');
      setStatistics(data.data);
    } catch (error) {
      toast.error('Failed to fetch VIP statistics');
    } finally {
      setLoading(false);
    }
  };

  const getLevelColor = (level: string) => {
    const colors = {
      bronze: 'bg-amber-500',
      silver: 'bg-gray-500',
      gold: 'bg-yellow-500',
      platinum: 'bg-blue-500',
      diamond: 'bg-purple-500'
    };
    return colors[level as keyof typeof colors] || 'bg-gray-500';
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
            <span className="ml-2 text-gray-600">Loading statistics...</span>
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
            <ChartBarIcon className="w-6 h-6 text-purple-600 mr-2" />
            <h3 className="text-lg font-medium text-gray-900">VIP Statistics</h3>
          </div>
          <button aria-label="Close"
            onClick={onClose}
            className="text-gray-400 hover:text-gray-600"
          >
            <XMarkIcon className="w-6 h-6" />
          </button>
        </div>

        {statistics && (
          <div className="space-y-6">
            {/* Overview Cards */}
            <div className="grid grid-cols-1 md:grid-cols-5 gap-6">
              <div className="bg-purple-50 p-6 rounded-lg">
                <div className="flex items-center">
                  <div className="flex-shrink-0">
                    <CrownIcon className="w-8 h-8 text-purple-600" />
                  </div>
                  <div className="ml-4">
                    <p className="text-sm font-medium text-purple-600">Total VIPs</p>
                    <p className="text-2xl font-bold text-purple-900">{statistics.total}</p>
                  </div>
                </div>
              </div>

              <div className="bg-green-50 p-6 rounded-lg">
                <div className="flex items-center">
                  <div className="flex-shrink-0">
                    <div className="w-8 h-8 bg-green-600 rounded-full flex items-center justify-center">
                      <span className="text-white text-sm font-bold">✓</span>
                    </div>
                  </div>
                  <div className="ml-4">
                    <p className="text-sm font-medium text-green-600">Active</p>
                    <p className="text-2xl font-bold text-green-900">{statistics.active}</p>
                  </div>
                </div>
              </div>

              <div className="bg-gray-50 p-6 rounded-lg">
                <div className="flex items-center">
                  <div className="flex-shrink-0">
                    <div className="w-8 h-8 bg-gray-600 rounded-full flex items-center justify-center">
                      <span className="text-white text-sm font-bold">-</span>
                    </div>
                  </div>
                  <div className="ml-4">
                    <p className="text-sm font-medium text-gray-600">Inactive</p>
                    <p className="text-2xl font-bold text-gray-900">{statistics.inactive}</p>
                  </div>
                </div>
              </div>

              <div className="bg-red-50 p-6 rounded-lg">
                <div className="flex items-center">
                  <div className="flex-shrink-0">
                    <div className="w-8 h-8 bg-red-600 rounded-full flex items-center justify-center">
                      <span className="text-white text-sm font-bold">!</span>
                    </div>
                  </div>
                  <div className="ml-4">
                    <p className="text-sm font-medium text-red-600">Suspended</p>
                    <p className="text-2xl font-bold text-red-900">{statistics.suspended}</p>
                  </div>
                </div>
              </div>

              <div className="bg-yellow-50 p-6 rounded-lg">
                <div className="flex items-center">
                  <div className="flex-shrink-0">
                    <div className="w-8 h-8 bg-yellow-600 rounded-full flex items-center justify-center">
                      <span className="text-white text-sm font-bold">?</span>
                    </div>
                  </div>
                  <div className="ml-4">
                    <p className="text-sm font-medium text-yellow-600">Pending</p>
                    <p className="text-2xl font-bold text-yellow-900">{statistics.pending}</p>
                  </div>
                </div>
              </div>
            </div>

            {/* Financial Overview */}
            <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
              <div className="bg-blue-50 p-6 rounded-lg">
                <div className="flex items-center">
                  <div className="flex-shrink-0">
                    <IndianRupee className="w-8 h-8 text-blue-600" />
                  </div>
                  <div className="ml-4">
                    <p className="text-sm font-medium text-blue-600">Total Revenue</p>
                    <p className="text-2xl font-bold text-blue-900">{formatCurrency(statistics.totalSpent)}</p>
                  </div>
                </div>
              </div>

              <div className="bg-indigo-50 p-6 rounded-lg">
                <div className="flex items-center">
                  <div className="flex-shrink-0">
                    <StarIcon className="w-8 h-8 text-indigo-600" />
                  </div>
                  <div className="ml-4">
                    <p className="text-sm font-medium text-indigo-600">Total Stays</p>
                    <p className="text-2xl font-bold text-indigo-900">{statistics.totalStays}</p>
                  </div>
                </div>
              </div>

              <div className="bg-teal-50 p-6 rounded-lg">
                <div className="flex items-center">
                  <div className="flex-shrink-0">
                    <div className="w-8 h-8 bg-teal-600 rounded-full flex items-center justify-center">
                      <span className="text-white text-sm font-bold">🌙</span>
                    </div>
                  </div>
                  <div className="ml-4">
                    <p className="text-sm font-medium text-teal-600">Total Nights</p>
                    <p className="text-2xl font-bold text-teal-900">{statistics.totalNights}</p>
                  </div>
                </div>
              </div>
            </div>

            {/* VIP Level Distribution */}
            <div className="bg-white border border-gray-200 rounded-lg p-6">
              <h4 className="text-lg font-medium text-gray-900 mb-4">VIP Level Distribution</h4>
              <div className="space-y-4">
                {Object.entries(statistics.byLevel).map(([level, data]) => {
                  const percentage = statistics.total > 0 ? (data.total / statistics.total) * 100 : 0;
                  return (
                    <div key={level} className="border border-gray-200 rounded-lg p-4">
                      <div className="flex items-center justify-between mb-3">
                        <div className="flex items-center">
                          <span className="text-2xl mr-3">{getLevelIcon(level)}</span>
                          <h5 className="text-sm font-medium text-gray-900 capitalize">{level} VIP</h5>
                        </div>
                        <div className="text-sm text-gray-500">
                          {data.total} total ({percentage.toFixed(1)}%)
                        </div>
                      </div>
                      
                      <div className="grid grid-cols-4 gap-4 mb-3">
                        <div className="flex items-center justify-between">
                          <span className="text-sm text-green-600">Active:</span>
                          <span className="text-sm font-medium text-green-900">{data.active}</span>
                        </div>
                        <div className="flex items-center justify-between">
                          <span className="text-sm text-gray-600">Inactive:</span>
                          <span className="text-sm font-medium text-gray-900">{data.inactive}</span>
                        </div>
                        <div className="flex items-center justify-between">
                          <span className="text-sm text-red-600">Suspended:</span>
                          <span className="text-sm font-medium text-red-900">{data.suspended}</span>
                        </div>
                        <div className="flex items-center justify-between">
                          <span className="text-sm text-yellow-600">Pending:</span>
                          <span className="text-sm font-medium text-yellow-900">{data.pending}</span>
                        </div>
                      </div>

                      {/* Progress Bar */}
                      <div className="mb-2">
                        <div className="flex justify-between text-xs text-gray-500 mb-1">
                          <span>Active</span>
                          <span>{data.total > 0 ? Math.round((data.active / data.total) * 100) : 0}%</span>
                        </div>
                        <div className="w-full bg-gray-200 rounded-full h-2">
                          <div
                            className="bg-green-500 h-2 rounded-full"
                            style={{ width: `${data.total > 0 ? (data.active / data.total) * 100 : 0}%` }}
                          ></div>
                        </div>
                      </div>

                      {/* Level Progress Bar */}
                      <div>
                        <div className="flex justify-between text-xs text-gray-500 mb-1">
                          <span>Distribution</span>
                          <span>{percentage.toFixed(1)}%</span>
                        </div>
                        <div className="w-full bg-gray-200 rounded-full h-2">
                          <div
                            className={`h-2 rounded-full ${getLevelColor(level)}`}
                            style={{ width: `${percentage}%` }}
                          ></div>
                        </div>
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>

            {/* Summary Metrics */}
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              <div className="bg-gray-50 p-6 rounded-lg">
                <h4 className="text-lg font-medium text-gray-900 mb-3">Performance Metrics</h4>
                <div className="space-y-3">
                  <div className="flex justify-between">
                    <span className="text-gray-600">Active Rate:</span>
                    <span className="font-medium">
                      {statistics.total > 0 ? Math.round((statistics.active / statistics.total) * 100) : 0}%
                    </span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-gray-600">Average Revenue per VIP:</span>
                    <span className="font-medium">
                      {statistics.total > 0 ? formatCurrency(statistics.totalSpent / statistics.total) : '$0'}
                    </span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-gray-600">Average Stays per VIP:</span>
                    <span className="font-medium">
                      {statistics.total > 0 ? (statistics.totalStays / statistics.total).toFixed(1) : '0'}
                    </span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-gray-600">Average Nights per VIP:</span>
                    <span className="font-medium">
                      {statistics.total > 0 ? (statistics.totalNights / statistics.total).toFixed(1) : '0'}
                    </span>
                  </div>
                </div>
              </div>

              <div className="bg-gray-50 p-6 rounded-lg">
                <h4 className="text-lg font-medium text-gray-900 mb-3">Top Performing Level</h4>
                <div className="space-y-3">
                  {(() => {
                    const topLevel = Object.entries(statistics.byLevel).reduce((max, [level, data]) => 
                      data.total > max.total ? { level, ...data } : max, 
                      { level: 'None', total: 0 }
                    );
                    
                    return (
                      <div className="text-center">
                        <div className="text-4xl mb-2">{getLevelIcon(topLevel.level)}</div>
                        <div className="text-lg font-medium text-gray-900 capitalize">{topLevel.level} VIP</div>
                        <div className="text-sm text-gray-500">{topLevel.total} members</div>
                        <div className="text-sm text-gray-500">
                          {statistics.total > 0 ? Math.round((topLevel.total / statistics.total) * 100) : 0}% of total VIPs
                        </div>
                      </div>
                    );
                  })()}
                </div>
              </div>
            </div>

            {/* Revenue Distribution */}
            <div className="bg-white border border-gray-200 rounded-lg p-6">
              <h4 className="text-lg font-medium text-gray-900 mb-4">Revenue Insights</h4>
              <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
                <div className="text-center">
                  <div className="text-2xl font-bold text-green-600">
                    {formatCurrency(statistics.totalSpent)}
                  </div>
                  <div className="text-sm text-gray-500">Total VIP Revenue</div>
                </div>
                <div className="text-center">
                  <div className="text-2xl font-bold text-blue-600">
                    {statistics.totalStays > 0 ? formatCurrency(statistics.totalSpent / statistics.totalStays) : '$0'}
                  </div>
                  <div className="text-sm text-gray-500">Revenue per Stay</div>
                </div>
                <div className="text-center">
                  <div className="text-2xl font-bold text-purple-600">
                    {statistics.totalNights > 0 ? formatCurrency(statistics.totalSpent / statistics.totalNights) : '$0'}
                  </div>
                  <div className="text-sm text-gray-500">Revenue per Night</div>
                </div>
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

export default VIPStatistics;
