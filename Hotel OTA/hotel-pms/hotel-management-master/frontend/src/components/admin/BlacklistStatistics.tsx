import React, { useState, useEffect } from 'react';
import { XMarkIcon, ExclamationTriangleIcon, ChartBarIcon } from '@heroicons/react/24/outline';
import { toast } from 'react-hot-toast';
import { api } from '../../services/api';

interface BlacklistStatisticsProps {
  onClose: () => void;
}

interface StatisticsData {
  total: number;
  active: number;
  inactive: number;
  byType: {
    [key: string]: {
      total: number;
      active: number;
      inactive: number;
    };
  };
  byCategory: {
    [key: string]: {
      total: number;
      active: number;
      inactive: number;
    };
  };
  pendingAppeals: number;
}

const BlacklistStatistics: React.FC<BlacklistStatisticsProps> = ({ onClose }) => {
  const [statistics, setStatistics] = useState<StatisticsData | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetchStatistics();
  }, []);

  const fetchStatistics = async () => {
    try {
      setLoading(true);
      const { data } = await api.get('/blacklist/statistics');
      setStatistics(data.data);
    } catch (error) {
      toast.error('Failed to fetch blacklist statistics');
    } finally {
      setLoading(false);
    }
  };

  const getTypeColor = (type: string) => {
    const colors = {
      temporary: 'bg-yellow-500',
      permanent: 'bg-red-500',
      conditional: 'bg-orange-500'
    };
    return colors[type as keyof typeof colors] || 'bg-gray-500';
  };

  const getCategoryColor = (category: string) => {
    const colors = {
      non_payment: 'bg-red-500',
      damage: 'bg-orange-500',
      misconduct: 'bg-purple-500',
      security: 'bg-red-500',
      policy_violation: 'bg-blue-500',
      other: 'bg-gray-500'
    };
    return colors[category as keyof typeof colors] || 'bg-gray-500';
  };

  if (loading) {
    return (
      <div className="fixed inset-0 bg-gray-600 bg-opacity-50 overflow-y-auto h-full w-full z-50">
        <div className="relative top-20 mx-auto p-5 border w-11/12 md:w-4/5 lg:w-3/4 shadow-lg rounded-md bg-white">
          <div className="flex justify-center items-center h-64">
            <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-red-600"></div>
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
            <ChartBarIcon className="w-6 h-6 text-red-600 mr-2" />
            <h3 className="text-lg font-medium text-gray-900">Blacklist Statistics</h3>
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
            <div className="grid grid-cols-1 md:grid-cols-4 gap-6">
              <div className="bg-red-50 p-6 rounded-lg">
                <div className="flex items-center">
                  <div className="flex-shrink-0">
                    <ExclamationTriangleIcon className="w-8 h-8 text-red-600" />
                  </div>
                  <div className="ml-4">
                    <p className="text-sm font-medium text-red-600">Total Entries</p>
                    <p className="text-2xl font-bold text-red-900">{statistics.total}</p>
                  </div>
                </div>
              </div>

              <div className="bg-orange-50 p-6 rounded-lg">
                <div className="flex items-center">
                  <div className="flex-shrink-0">
                    <div className="w-8 h-8 bg-orange-600 rounded-full flex items-center justify-center">
                      <span className="text-white text-sm font-bold">!</span>
                    </div>
                  </div>
                  <div className="ml-4">
                    <p className="text-sm font-medium text-orange-600">Active</p>
                    <p className="text-2xl font-bold text-orange-900">{statistics.active}</p>
                  </div>
                </div>
              </div>

              <div className="bg-gray-50 p-6 rounded-lg">
                <div className="flex items-center">
                  <div className="flex-shrink-0">
                    <div className="w-8 h-8 bg-gray-600 rounded-full flex items-center justify-center">
                      <span className="text-white text-sm font-bold">✓</span>
                    </div>
                  </div>
                  <div className="ml-4">
                    <p className="text-sm font-medium text-gray-600">Inactive</p>
                    <p className="text-2xl font-bold text-gray-900">{statistics.inactive}</p>
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
                    <p className="text-sm font-medium text-yellow-600">Pending Appeals</p>
                    <p className="text-2xl font-bold text-yellow-900">{statistics.pendingAppeals}</p>
                  </div>
                </div>
              </div>
            </div>

            {/* Distribution Charts */}
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              {/* Type Distribution */}
              <div className="bg-white border border-gray-200 rounded-lg p-6">
                <h4 className="text-lg font-medium text-gray-900 mb-4">Distribution by Type</h4>
                <div className="space-y-3">
                  {Object.entries(statistics.byType).map(([type, data]) => {
                    const percentage = statistics.total > 0 ? (data.total / statistics.total) * 100 : 0;
                    return (
                      <div key={type} className="flex items-center justify-between">
                        <div className="flex items-center">
                          <div className={`w-4 h-4 rounded-full ${getTypeColor(type)} mr-3`}></div>
                          <span className="text-sm font-medium text-gray-900 capitalize">{type}</span>
                        </div>
                        <div className="flex items-center space-x-2">
                          <span className="text-sm text-gray-500">{data.total}</span>
                          <div className="w-20 bg-gray-200 rounded-full h-2">
                            <div
                              className={`h-2 rounded-full ${getTypeColor(type)}`}
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

              {/* Category Distribution */}
              <div className="bg-white border border-gray-200 rounded-lg p-6">
                <h4 className="text-lg font-medium text-gray-900 mb-4">Distribution by Category</h4>
                <div className="space-y-3">
                  {Object.entries(statistics.byCategory).map(([category, data]) => {
                    const percentage = statistics.total > 0 ? (data.total / statistics.total) * 100 : 0;
                    return (
                      <div key={category} className="flex items-center justify-between">
                        <div className="flex items-center">
                          <div className={`w-4 h-4 rounded-full ${getCategoryColor(category)} mr-3`}></div>
                          <span className="text-sm font-medium text-gray-900 capitalize">
                            {category.replace('_', ' ')}
                          </span>
                        </div>
                        <div className="flex items-center space-x-2">
                          <span className="text-sm text-gray-500">{data.total}</span>
                          <div className="w-20 bg-gray-200 rounded-full h-2">
                            <div
                              className={`h-2 rounded-full ${getCategoryColor(category)}`}
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

            {/* Detailed Breakdown */}
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              {/* Type Breakdown */}
              <div className="bg-white border border-gray-200 rounded-lg p-6">
                <h4 className="text-lg font-medium text-gray-900 mb-4">Type Breakdown</h4>
                <div className="space-y-4">
                  {Object.entries(statistics.byType).map(([type, data]) => (
                    <div key={type} className="border border-gray-200 rounded-lg p-4">
                      <div className="flex items-center justify-between mb-3">
                        <div className="flex items-center">
                          <div className={`w-4 h-4 rounded-full ${getTypeColor(type)} mr-3`}></div>
                          <h5 className="text-sm font-medium text-gray-900 capitalize">{type}</h5>
                        </div>
                        <div className="text-sm text-gray-500">
                          {data.total} total
                        </div>
                      </div>
                      
                      <div className="grid grid-cols-2 gap-4">
                        <div className="flex items-center justify-between">
                          <span className="text-sm text-orange-600">Active:</span>
                          <span className="text-sm font-medium text-orange-900">{data.active}</span>
                        </div>
                        <div className="flex items-center justify-between">
                          <span className="text-sm text-gray-600">Inactive:</span>
                          <span className="text-sm font-medium text-gray-900">{data.inactive}</span>
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
                            className="bg-orange-500 h-2 rounded-full"
                            style={{ width: `${data.total > 0 ? (data.active / data.total) * 100 : 0}%` }}
                          ></div>
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              </div>

              {/* Category Breakdown */}
              <div className="bg-white border border-gray-200 rounded-lg p-6">
                <h4 className="text-lg font-medium text-gray-900 mb-4">Category Breakdown</h4>
                <div className="space-y-4">
                  {Object.entries(statistics.byCategory).map(([category, data]) => (
                    <div key={category} className="border border-gray-200 rounded-lg p-4">
                      <div className="flex items-center justify-between mb-3">
                        <div className="flex items-center">
                          <div className={`w-4 h-4 rounded-full ${getCategoryColor(category)} mr-3`}></div>
                          <h5 className="text-sm font-medium text-gray-900 capitalize">
                            {category.replace('_', ' ')}
                          </h5>
                        </div>
                        <div className="text-sm text-gray-500">
                          {data.total} total
                        </div>
                      </div>
                      
                      <div className="grid grid-cols-2 gap-4">
                        <div className="flex items-center justify-between">
                          <span className="text-sm text-orange-600">Active:</span>
                          <span className="text-sm font-medium text-orange-900">{data.active}</span>
                        </div>
                        <div className="flex items-center justify-between">
                          <span className="text-sm text-gray-600">Inactive:</span>
                          <span className="text-sm font-medium text-gray-900">{data.inactive}</span>
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
                            className="bg-orange-500 h-2 rounded-full"
                            style={{ width: `${data.total > 0 ? (data.active / data.total) * 100 : 0}%` }}
                          ></div>
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            </div>

            {/* Summary */}
            <div className="bg-gray-50 p-6 rounded-lg">
              <h4 className="text-lg font-medium text-gray-900 mb-3">Summary</h4>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4 text-sm">
                <div>
                  <p className="text-gray-600">
                    <strong>Active Rate:</strong> {statistics.total > 0 ? Math.round((statistics.active / statistics.total) * 100) : 0}%
                  </p>
                  <p className="text-gray-600">
                    <strong>Most Common Type:</strong> {
                      Object.entries(statistics.byType).reduce((max, [type, data]) => 
                        data.total > max.total ? { type, ...data } : max, 
                        { type: 'None', total: 0 }
                      ).type
                    }
                  </p>
                </div>
                <div>
                  <p className="text-gray-600">
                    <strong>Most Common Category:</strong> {
                      Object.entries(statistics.byCategory).reduce((max, [category, data]) => 
                        data.total > max.total ? { category, ...data } : max, 
                        { category: 'None', total: 0 }
                      ).category.replace('_', ' ')
                    }
                  </p>
                  <p className="text-gray-600">
                    <strong>Appeals Pending:</strong> {statistics.pendingAppeals} need review
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

export default BlacklistStatistics;
