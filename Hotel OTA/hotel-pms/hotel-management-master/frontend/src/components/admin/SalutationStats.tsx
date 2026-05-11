import React, { useState, useEffect } from 'react';
import { XMarkIcon, ChartBarIcon } from '@heroicons/react/24/outline';
import { toast } from 'react-hot-toast';
import { api } from '../../services/api';

interface SalutationStatsProps {
  onClose: () => void;
}

interface StatsData {
  total: number;
  active: number;
  inactive: number;
  byCategory: {
    [key: string]: {
      total: number;
      active: number;
      inactive: number;
    };
  };
}

const SalutationStats: React.FC<SalutationStatsProps> = ({ onClose }) => {
  const [stats, setStats] = useState<StatsData | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetchStats();
  }, []);

  const fetchStats = async () => {
    try {
      setLoading(true);
      const { data } = await api.get('/salutations/stats');
      setStats(data.data);
    } catch (error) {
      toast.error('Failed to fetch salutation statistics');
    } finally {
      setLoading(false);
    }
  };

  const getCategoryColor = (category: string) => {
    const colors = {
      personal: 'bg-blue-500',
      professional: 'bg-green-500',
      religious: 'bg-purple-500',
      cultural: 'bg-orange-500',
      academic: 'bg-indigo-500'
    };
    return colors[category as keyof typeof colors] || 'bg-gray-500';
  };

  const getCategoryLabel = (category: string) => {
    const labels = {
      personal: 'Personal',
      professional: 'Professional',
      religious: 'Religious',
      cultural: 'Cultural',
      academic: 'Academic'
    };
    return labels[category as keyof typeof labels] || category;
  };

  if (loading) {
    return (
      <div className="fixed inset-0 bg-gray-600 bg-opacity-50 overflow-y-auto h-full w-full z-50">
        <div className="relative top-20 mx-auto p-5 border w-11/12 md:w-2/3 lg:w-1/2 shadow-lg rounded-md bg-white">
          <div className="flex justify-center items-center h-64">
            <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600"></div>
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
            <ChartBarIcon className="w-6 h-6 text-blue-600 mr-2" />
            <h3 className="text-lg font-medium text-gray-900">Salutation Statistics</h3>
          </div>
          <button aria-label="Close"
            onClick={onClose}
            className="text-gray-400 hover:text-gray-600"
          >
            <XMarkIcon className="w-6 h-6" />
          </button>
        </div>

        {stats && (
          <div className="space-y-6">
            {/* Overview Cards */}
            <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
              <div className="bg-blue-50 p-6 rounded-lg">
                <div className="flex items-center">
                  <div className="flex-shrink-0">
                    <ChartBarIcon className="w-8 h-8 text-blue-600" />
                  </div>
                  <div className="ml-4">
                    <p className="text-sm font-medium text-blue-600">Total Salutations</p>
                    <p className="text-2xl font-bold text-blue-900">{stats.total}</p>
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
                    <p className="text-2xl font-bold text-green-900">{stats.active}</p>
                  </div>
                </div>
              </div>

              <div className="bg-red-50 p-6 rounded-lg">
                <div className="flex items-center">
                  <div className="flex-shrink-0">
                    <div className="w-8 h-8 bg-red-600 rounded-full flex items-center justify-center">
                      <span className="text-white text-sm font-bold">✗</span>
                    </div>
                  </div>
                  <div className="ml-4">
                    <p className="text-sm font-medium text-red-600">Inactive</p>
                    <p className="text-2xl font-bold text-red-900">{stats.inactive}</p>
                  </div>
                </div>
              </div>
            </div>

            {/* Category Breakdown */}
            <div className="bg-white border border-gray-200 rounded-lg p-6">
              <h4 className="text-lg font-medium text-gray-900 mb-4">Breakdown by Category</h4>
              <div className="space-y-4">
                {Object.entries(stats.byCategory).map(([category, data]) => (
                  <div key={category} className="border border-gray-200 rounded-lg p-4">
                    <div className="flex items-center justify-between mb-3">
                      <div className="flex items-center">
                        <div className={`w-4 h-4 rounded-full ${getCategoryColor(category)} mr-3`}></div>
                        <h5 className="text-sm font-medium text-gray-900">
                          {getCategoryLabel(category)}
                        </h5>
                      </div>
                      <div className="text-sm text-gray-500">
                        {data.total} total
                      </div>
                    </div>
                    
                    <div className="grid grid-cols-2 gap-4">
                      <div className="flex items-center justify-between">
                        <span className="text-sm text-green-600">Active:</span>
                        <span className="text-sm font-medium text-green-900">{data.active}</span>
                      </div>
                      <div className="flex items-center justify-between">
                        <span className="text-sm text-red-600">Inactive:</span>
                        <span className="text-sm font-medium text-red-900">{data.inactive}</span>
                      </div>
                    </div>

                    {/* Progress Bar */}
                    <div className="mt-3">
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
                  </div>
                ))}
              </div>
            </div>

            {/* Summary */}
            <div className="bg-gray-50 p-6 rounded-lg">
              <h4 className="text-lg font-medium text-gray-900 mb-3">Summary</h4>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4 text-sm">
                <div>
                  <p className="text-gray-600">
                    <strong>Active Rate:</strong> {stats.total > 0 ? Math.round((stats.active / stats.total) * 100) : 0}%
                  </p>
                  <p className="text-gray-600">
                    <strong>Most Popular Category:</strong> {
                      Object.entries(stats.byCategory).reduce((max, [category, data]) => 
                        data.total > max.total ? { category, ...data } : max, 
                        { category: 'None', total: 0 }
                      ).category
                    }
                  </p>
                </div>
                <div>
                  <p className="text-gray-600">
                    <strong>Categories with Data:</strong> {Object.keys(stats.byCategory).length}
                  </p>
                  <p className="text-gray-600">
                    <strong>Average per Category:</strong> {Object.keys(stats.byCategory).length > 0 ? Math.round(stats.total / Object.keys(stats.byCategory).length) : 0}
                  </p>
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

export default SalutationStats;
