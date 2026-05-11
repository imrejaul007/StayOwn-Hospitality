import React, { useState, useEffect } from 'react';
import { XMarkIcon, ChartBarIcon, DocumentTextIcon, CheckCircleIcon } from '@heroicons/react/24/outline';
import { toast } from 'react-hot-toast';
import { api } from '../../services/api';

interface CustomFieldAnalyticsProps {
  onClose: () => void;
}

interface FieldStatistics {
  total: number;
  active: number;
  inactive: number;
  required: number;
  visible: number;
  editable: number;
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
}

interface DataAnalytics {
  totalEntries: number;
  nonEmptyEntries: number;
  completionRate: number;
  byCategory: {
    [key: string]: {
      total: number;
      completed: number;
    };
  };
  byType: {
    [key: string]: {
      total: number;
      completed: number;
    };
  };
}

const CustomFieldAnalytics: React.FC<CustomFieldAnalyticsProps> = ({ onClose }) => {
  const [fieldStats, setFieldStats] = useState<FieldStatistics | null>(null);
  const [dataAnalytics, setDataAnalytics] = useState<DataAnalytics | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetchAnalytics();
  }, []);

  const fetchAnalytics = async () => {
    try {
      setLoading(true);
      
      // Fetch field statistics
      const { data: fieldStatsData } = await api.get('/custom-fields/statistics');
      setFieldStats(fieldStatsData.data);

      // Fetch data analytics
      const { data: dataAnalyticsData } = await api.get('/custom-fields/analytics');
      setDataAnalytics(dataAnalyticsData.data);
    } catch (error) {
      toast.error('Failed to fetch analytics data');
    } finally {
      setLoading(false);
    }
  };

  const getTypeIcon = (type: string) => {
    const icons = {
      text: '📝',
      textarea: '📄',
      number: '🔢',
      date: '📅',
      email: '📧',
      phone: '📞',
      url: '🔗',
      dropdown: '📋',
      multiselect: '☑️☑️',
      checkbox: '☑️'
    };
    return icons[type as keyof typeof icons] || '📝';
  };

  const getCategoryColor = (category: string) => {
    const colors = {
      personal: 'bg-blue-500',
      preferences: 'bg-green-500',
      contact: 'bg-purple-500',
      business: 'bg-orange-500',
      special: 'bg-red-500',
      other: 'bg-gray-500'
    };
    return colors[category as keyof typeof colors] || 'bg-gray-500';
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
            <h3 className="text-lg font-medium text-gray-900">Custom Fields Analytics</h3>
          </div>
          <button aria-label="Close"
            onClick={onClose}
            className="text-gray-400 hover:text-gray-600"
          >
            <XMarkIcon className="w-6 h-6" />
          </button>
        </div>

        <div className="space-y-6">
          {/* Field Statistics Overview */}
          {fieldStats && (
            <div>
              <h4 className="text-lg font-medium text-gray-900 mb-4">Field Statistics</h4>
              <div className="grid grid-cols-1 md:grid-cols-6 gap-4">
                <div className="bg-blue-50 p-4 rounded-lg">
                  <div className="flex items-center">
                    <DocumentTextIcon className="w-8 h-8 text-blue-600" />
                    <div className="ml-3">
                      <p className="text-sm font-medium text-blue-600">Total Fields</p>
                      <p className="text-2xl font-bold text-blue-900">{fieldStats.total}</p>
                    </div>
                  </div>
                </div>

                <div className="bg-green-50 p-4 rounded-lg">
                  <div className="flex items-center">
                    <CheckCircleIcon className="w-8 h-8 text-green-600" />
                    <div className="ml-3">
                      <p className="text-sm font-medium text-green-600">Active</p>
                      <p className="text-2xl font-bold text-green-900">{fieldStats.active}</p>
                    </div>
                  </div>
                </div>

                <div className="bg-gray-50 p-4 rounded-lg">
                  <div className="flex items-center">
                    <div className="w-8 h-8 bg-gray-600 rounded-full flex items-center justify-center">
                      <span className="text-white text-sm font-bold">-</span>
                    </div>
                    <div className="ml-3">
                      <p className="text-sm font-medium text-gray-600">Inactive</p>
                      <p className="text-2xl font-bold text-gray-900">{fieldStats.inactive}</p>
                    </div>
                  </div>
                </div>

                <div className="bg-red-50 p-4 rounded-lg">
                  <div className="flex items-center">
                    <div className="w-8 h-8 bg-red-600 rounded-full flex items-center justify-center">
                      <span className="text-white text-sm font-bold">!</span>
                    </div>
                    <div className="ml-3">
                      <p className="text-sm font-medium text-red-600">Required</p>
                      <p className="text-2xl font-bold text-red-900">{fieldStats.required}</p>
                    </div>
                  </div>
                </div>

                <div className="bg-purple-50 p-4 rounded-lg">
                  <div className="flex items-center">
                    <div className="w-8 h-8 bg-purple-600 rounded-full flex items-center justify-center">
                      <span className="text-white text-sm font-bold">👁</span>
                    </div>
                    <div className="ml-3">
                      <p className="text-sm font-medium text-purple-600">Visible</p>
                      <p className="text-2xl font-bold text-purple-900">{fieldStats.visible}</p>
                    </div>
                  </div>
                </div>

                <div className="bg-orange-50 p-4 rounded-lg">
                  <div className="flex items-center">
                    <div className="w-8 h-8 bg-orange-600 rounded-full flex items-center justify-center">
                      <span className="text-white text-sm font-bold">✏️</span>
                    </div>
                    <div className="ml-3">
                      <p className="text-sm font-medium text-orange-600">Editable</p>
                      <p className="text-2xl font-bold text-orange-900">{fieldStats.editable}</p>
                    </div>
                  </div>
                </div>
              </div>
            </div>
          )}

          {/* Field Type Distribution */}
          {fieldStats && (
            <div className="bg-white border border-gray-200 rounded-lg p-6">
              <h4 className="text-lg font-medium text-gray-900 mb-4">Field Type Distribution</h4>
              <div className="space-y-4">
                {Object.entries(fieldStats.byType).map(([type, data]) => {
                  const percentage = fieldStats.total > 0 ? (data.total / fieldStats.total) * 100 : 0;
                  return (
                    <div key={type} className="border border-gray-200 rounded-lg p-4">
                      <div className="flex items-center justify-between mb-3">
                        <div className="flex items-center">
                          <span className="text-2xl mr-3">{getTypeIcon(type)}</span>
                          <h5 className="text-sm font-medium text-gray-900 capitalize">{type}</h5>
                        </div>
                        <div className="text-sm text-gray-500">
                          {data.total} total ({percentage.toFixed(1)}%)
                        </div>
                      </div>
                      
                      <div className="grid grid-cols-2 gap-4 mb-3">
                        <div className="flex items-center justify-between">
                          <span className="text-sm text-green-600">Active:</span>
                          <span className="text-sm font-medium text-green-900">{data.active}</span>
                        </div>
                        <div className="flex items-center justify-between">
                          <span className="text-sm text-gray-600">Inactive:</span>
                          <span className="text-sm font-medium text-gray-900">{data.inactive}</span>
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

                      {/* Type Progress Bar */}
                      <div>
                        <div className="flex justify-between text-xs text-gray-500 mb-1">
                          <span>Distribution</span>
                          <span>{percentage.toFixed(1)}%</span>
                        </div>
                        <div className="w-full bg-gray-200 rounded-full h-2">
                          <div
                            className="bg-blue-500 h-2 rounded-full"
                            style={{ width: `${percentage}%` }}
                          ></div>
                        </div>
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>
          )}

          {/* Category Distribution */}
          {fieldStats && (
            <div className="bg-white border border-gray-200 rounded-lg p-6">
              <h4 className="text-lg font-medium text-gray-900 mb-4">Category Distribution</h4>
              <div className="space-y-4">
                {Object.entries(fieldStats.byCategory).map(([category, data]) => {
                  const percentage = fieldStats.total > 0 ? (data.total / fieldStats.total) * 100 : 0;
                  return (
                    <div key={category} className="border border-gray-200 rounded-lg p-4">
                      <div className="flex items-center justify-between mb-3">
                        <div className="flex items-center">
                          <div className={`w-4 h-4 rounded-full ${getCategoryColor(category)} mr-3`}></div>
                          <h5 className="text-sm font-medium text-gray-900 capitalize">{category}</h5>
                        </div>
                        <div className="text-sm text-gray-500">
                          {data.total} total ({percentage.toFixed(1)}%)
                        </div>
                      </div>
                      
                      <div className="grid grid-cols-2 gap-4 mb-3">
                        <div className="flex items-center justify-between">
                          <span className="text-sm text-green-600">Active:</span>
                          <span className="text-sm font-medium text-green-900">{data.active}</span>
                        </div>
                        <div className="flex items-center justify-between">
                          <span className="text-sm text-gray-600">Inactive:</span>
                          <span className="text-sm font-medium text-gray-900">{data.inactive}</span>
                        </div>
                      </div>

                      {/* Progress Bar */}
                      <div>
                        <div className="flex justify-between text-xs text-gray-500 mb-1">
                          <span>Active</span>
                          <span>{data.total > 0 ? Math.round((data.active / data.total) * 100) : 0}%</span>
                        </div>
                        <div className="w-full bg-gray-200 rounded-full h-2">
                          <div
                            className={`h-2 rounded-full ${getCategoryColor(category)}`}
                            style={{ width: `${data.total > 0 ? (data.active / data.total) * 100 : 0}%` }}
                          ></div>
                        </div>
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>
          )}

          {/* Data Analytics */}
          {dataAnalytics && (
            <div className="bg-white border border-gray-200 rounded-lg p-6">
              <h4 className="text-lg font-medium text-gray-900 mb-4">Data Completion Analytics</h4>
              <div className="grid grid-cols-1 md:grid-cols-3 gap-6 mb-6">
                <div className="text-center">
                  <div className="text-3xl font-bold text-blue-600">
                    {dataAnalytics.totalEntries.toLocaleString()}
                  </div>
                  <div className="text-sm text-gray-500">Total Data Entries</div>
                </div>
                <div className="text-center">
                  <div className="text-3xl font-bold text-green-600">
                    {dataAnalytics.nonEmptyEntries.toLocaleString()}
                  </div>
                  <div className="text-sm text-gray-500">Completed Entries</div>
                </div>
                <div className="text-center">
                  <div className="text-3xl font-bold text-purple-600">
                    {dataAnalytics.completionRate.toFixed(1)}%
                  </div>
                  <div className="text-sm text-gray-500">Completion Rate</div>
                </div>
              </div>

              {/* Completion by Category */}
              <div className="mb-6">
                <h5 className="text-sm font-medium text-gray-900 mb-3">Completion by Category</h5>
                <div className="space-y-2">
                  {Object.entries(dataAnalytics.byCategory).map(([category, data]) => {
                    const completionRate = data.total > 0 ? (data.completed / data.total) * 100 : 0;
                    return (
                      <div key={category} className="flex items-center justify-between">
                        <div className="flex items-center">
                          <div className={`w-3 h-3 rounded-full ${getCategoryColor(category)} mr-2`}></div>
                          <span className="text-sm text-gray-700 capitalize">{category}</span>
                        </div>
                        <div className="flex items-center space-x-2">
                          <span className="text-sm text-gray-500">
                            {data.completed}/{data.total}
                          </span>
                          <div className="w-20 bg-gray-200 rounded-full h-2">
                            <div
                              className={`h-2 rounded-full ${getCategoryColor(category)}`}
                              style={{ width: `${completionRate}%` }}
                            ></div>
                          </div>
                          <span className="text-xs text-gray-500 w-8">
                            {completionRate.toFixed(1)}%
                          </span>
                        </div>
                      </div>
                    );
                  })}
                </div>
              </div>

              {/* Completion by Type */}
              <div>
                <h5 className="text-sm font-medium text-gray-900 mb-3">Completion by Field Type</h5>
                <div className="space-y-2">
                  {Object.entries(dataAnalytics.byType).map(([type, data]) => {
                    const completionRate = data.total > 0 ? (data.completed / data.total) * 100 : 0;
                    return (
                      <div key={type} className="flex items-center justify-between">
                        <div className="flex items-center">
                          <span className="text-lg mr-2">{getTypeIcon(type)}</span>
                          <span className="text-sm text-gray-700 capitalize">{type}</span>
                        </div>
                        <div className="flex items-center space-x-2">
                          <span className="text-sm text-gray-500">
                            {data.completed}/{data.total}
                          </span>
                          <div className="w-20 bg-gray-200 rounded-full h-2">
                            <div
                              className="bg-blue-500 h-2 rounded-full"
                              style={{ width: `${completionRate}%` }}
                            ></div>
                          </div>
                          <span className="text-xs text-gray-500 w-8">
                            {completionRate.toFixed(1)}%
                          </span>
                        </div>
                      </div>
                    );
                  })}
                </div>
              </div>
            </div>
          )}

          {/* Summary */}
          <div className="bg-gray-50 p-6 rounded-lg">
            <h4 className="text-lg font-medium text-gray-900 mb-3">Summary</h4>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4 text-sm">
              <div>
                <p className="text-gray-600">
                  <strong>Field Utilization:</strong> {fieldStats ? Math.round((fieldStats.active / fieldStats.total) * 100) : 0}% of fields are active
                </p>
                <p className="text-gray-600">
                  <strong>Most Common Type:</strong> {
                    fieldStats ? Object.entries(fieldStats.byType).reduce((max, [type, data]) => 
                      data.total > max.total ? { type, ...data } : max, 
                      { type: 'None', total: 0 }
                    ).type : 'None'
                  }
                </p>
              </div>
              <div>
                <p className="text-gray-600">
                  <strong>Most Common Category:</strong> {
                    fieldStats ? Object.entries(fieldStats.byCategory).reduce((max, [category, data]) => 
                      data.total > max.total ? { category, ...data } : max, 
                      { category: 'None', total: 0 }
                    ).category : 'None'
                  }
                </p>
                <p className="text-gray-600">
                  <strong>Data Completion:</strong> {dataAnalytics ? dataAnalytics.completionRate.toFixed(1) : 0}% of fields have data
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

export default CustomFieldAnalytics;
