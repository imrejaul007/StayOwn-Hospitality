import React, { useState, useEffect } from 'react';
import { api } from '../../services/api';
import {
  X,
  PieChart,
  Users,
  Target,
  TrendingUp,
  TrendingDown,
  Filter,
  Search,
  Download,
  RefreshCw,
  Plus,
  Edit,
  Trash2,
  Eye,
  BarChart3
} from 'lucide-react';
import { toast } from 'react-hot-toast';

interface UserSegmentationProps {
  analytics: unknown;
  onClose: () => void;
}

interface Segment {
  segment: string;
  count: number;
  averageEngagement: number;
  averageChurnRisk: number;
}

interface UserSegment {
  _id: string[];
  users: Array<{ name: string; email: string; role: string }>;
  averageEngagement: number;
  averageChurnRisk: number;
  averageRetentionScore: number;
  count: number;
  userCount: number;
}

const UserSegmentation: React.FC<UserSegmentationProps> = ({
  analytics,
  onClose
}) => {
  const [segments, setSegments] = useState<UserSegment[]>([]);
  const [loading, setLoading] = useState(true);
  const [activeTab, setActiveTab] = useState<'overview' | 'segments' | 'create'>('overview');
  const [selectedSegment, setSelectedSegment] = useState<string[] | null>(null);
  const [searchTerm, setSearchTerm] = useState('');
  const [showCreateForm, setShowCreateForm] = useState(false);
  const [newSegment, setNewSegment] = useState({
    name: '',
    criteria: {
      minEngagement: '',
      maxChurnRisk: '',
      role: '',
      lifecycleStage: ''
    }
  });

  useEffect(() => {
    fetchSegments();
  }, []);

  const fetchSegments = async () => {
    try {
      setLoading(true);

      const { data } = await api.get('/user-analytics/segmentation');
      setSegments(data.data.segments);
    } catch (error) {
      toast.error('Failed to fetch user segments');
    } finally {
      setLoading(false);
    }
  };

  const handleCreateSegment = async () => {
    try {
      await api.post('/user-analytics/segmentation', {
        name: newSegment.name,
        criteria: newSegment.criteria
      });
      toast.success('Segment created successfully');
      setShowCreateForm(false);
      setNewSegment({
        name: '',
        criteria: {
          minEngagement: '',
          maxChurnRisk: '',
          role: '',
          lifecycleStage: ''
        }
      });
      fetchSegments();
    } catch (error) {
      toast.error('Failed to create segment');
    }
  };

  const handleDeleteSegment = async (segmentId: string[]) => {
    if (window.confirm('Are you sure you want to delete this segment?')) {
      try {
        await api.delete(`/user-analytics/segmentation/${segmentId.join(',')}`);
        toast.success('Segment deleted successfully');
        fetchSegments();
      } catch (error) {
        toast.error('Failed to delete segment');
      }
    }
  };

  const getSegmentColor = (index: number) => {
    const colors = [
      'bg-blue-500',
      'bg-green-500',
      'bg-purple-500',
      'bg-orange-500',
      'bg-red-500',
      'bg-yellow-500',
      'bg-indigo-500',
      'bg-pink-500',
      'bg-teal-500',
      'bg-gray-500'
    ];
    return colors[index % colors.length];
  };

  const getEngagementColor = (score: number) => {
    if (score >= 80) return 'text-green-600 bg-green-100';
    if (score >= 60) return 'text-yellow-600 bg-yellow-100';
    if (score >= 40) return 'text-orange-600 bg-orange-100';
    return 'text-red-600 bg-red-100';
  };

  const getChurnRiskColor = (risk: number) => {
    if (risk >= 70) return 'text-red-600 bg-red-100';
    if (risk >= 40) return 'text-yellow-600 bg-yellow-100';
    return 'text-green-600 bg-green-100';
  };

  const formatSegmentName = (segmentArray: string[]) => {
    return segmentArray.map(segment => segment.replace('_', ' ')).join(', ');
  };

  const filteredSegments = segments.filter(segment => {
    const segmentName = formatSegmentName(segment._id).toLowerCase();
    return segmentName.includes(searchTerm.toLowerCase());
  });

  const totalUsers = segments.reduce((sum, segment) => sum + segment.userCount, 0);

  if (loading) {
    return (
      <div className="fixed inset-0 bg-gray-600 bg-opacity-50 overflow-y-auto h-full w-full z-50">
        <div className="relative top-20 mx-auto p-5 border w-11/12 md:w-4/5 lg:w-3/4 shadow-lg rounded-md bg-white">
          <div className="flex justify-center items-center h-64">
            <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600"></div>
            <span className="ml-2 text-gray-600">Loading user segments...</span>
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
            <PieChart className="w-6 h-6 text-blue-600 mr-2" />
            <h3 className="text-lg font-medium text-gray-900">User Segmentation</h3>
            <span className="ml-2 text-sm text-gray-500">({segments.length} segments)</span>
          </div>
          <div className="flex items-center space-x-3">
            <button
              onClick={fetchSegments}
              disabled={loading}
              className="flex items-center px-3 py-1 text-sm font-medium text-gray-700 bg-white border border-gray-300 rounded-md hover:bg-gray-50 disabled:opacity-50"
            >
              <RefreshCw className={`w-4 h-4 mr-1 ${loading ? 'animate-spin' : ''}`} />
              Refresh
            </button>
            <button aria-label="Close"
              onClick={onClose}
              className="text-gray-400 hover:text-gray-600"
            >
              <X className="w-6 h-6" />
            </button>
          </div>
        </div>

        {/* Tabs */}
        <div className="mb-6">
          <div className="border-b border-gray-200">
            <nav className="-mb-px flex space-x-8">
              {[
                { id: 'overview', label: 'Overview', icon: BarChart3 },
                { id: 'segments', label: 'Segments', icon: Users },
                { id: 'create', label: 'Create Segment', icon: Plus }
              ].map((tab) => {
                const Icon = tab.icon;
                return (
                  <button aria-label="Close"
                    key={tab.id}
                    onClick={() => setActiveTab(tab.id as unknown)}
                    className={`flex items-center py-2 px-1 border-b-2 font-medium text-sm ${
                      activeTab === tab.id
                        ? 'border-blue-500 text-blue-600'
                        : 'border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300'
                    }`}
                  >
                    <Icon className="w-4 h-4 mr-2" />
                    {tab.label}
                  </button>
                );
              })}
            </nav>
          </div>
        </div>

        {/* Overview Tab */}
        {activeTab === 'overview' && (
          <div className="space-y-6">
            {/* Summary Stats */}
            <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
              <div className="bg-white p-4 rounded-lg shadow-sm border">
                <div className="flex items-center">
                  <Users className="w-8 h-8 text-blue-600" />
                  <div className="ml-3">
                    <p className="text-sm font-medium text-gray-600">Total Segments</p>
                    <p className="text-2xl font-bold text-gray-900">{segments.length}</p>
                  </div>
                </div>
              </div>
              <div className="bg-white p-4 rounded-lg shadow-sm border">
                <div className="flex items-center">
                  <Target className="w-8 h-8 text-green-600" />
                  <div className="ml-3">
                    <p className="text-sm font-medium text-gray-600">Total Users</p>
                    <p className="text-2xl font-bold text-gray-900">{totalUsers}</p>
                  </div>
                </div>
              </div>
              <div className="bg-white p-4 rounded-lg shadow-sm border">
                <div className="flex items-center">
                  <TrendingUp className="w-8 h-8 text-purple-600" />
                  <div className="ml-3">
                    <p className="text-sm font-medium text-gray-600">Avg Engagement</p>
                    <p className="text-2xl font-bold text-gray-900">
                      {segments.length > 0 ? (segments.reduce((sum, s) => sum + s.averageEngagement, 0) / segments.length).toFixed(1) : 0}
                    </p>
                  </div>
                </div>
              </div>
              <div className="bg-white p-4 rounded-lg shadow-sm border">
                <div className="flex items-center">
                  <TrendingDown className="w-8 h-8 text-red-600" />
                  <div className="ml-3">
                    <p className="text-sm font-medium text-gray-600">Avg Churn Risk</p>
                    <p className="text-2xl font-bold text-gray-900">
                      {segments.length > 0 ? (segments.reduce((sum, s) => sum + s.averageChurnRisk, 0) / segments.length).toFixed(1) : 0}
                    </p>
                  </div>
                </div>
              </div>
            </div>

            {/* Pie Chart Visualization */}
            <div className="bg-white shadow-sm rounded-lg border p-6">
              <h4 className="text-lg font-medium text-gray-900 mb-4">Segment Distribution</h4>
              <div className="flex items-center justify-center">
                <div className="relative w-64 h-64">
                  <svg className="w-full h-full" viewBox="0 0 200 200">
                    {segments.map((segment, index) => {
                      const percentage = totalUsers > 0 ? (segment.userCount / totalUsers) * 100 : 0;
                      const angle = (percentage / 100) * 360;
                      const startAngle = segments.slice(0, index).reduce((sum, s) => sum + (s.userCount / totalUsers) * 360, 0);
                      const endAngle = startAngle + angle;
                      
                      const startAngleRad = (startAngle - 90) * (Math.PI / 180);
                      const endAngleRad = (endAngle - 90) * (Math.PI / 180);
                      
                      const x1 = 100 + 80 * Math.cos(startAngleRad);
                      const y1 = 100 + 80 * Math.sin(startAngleRad);
                      const x2 = 100 + 80 * Math.cos(endAngleRad);
                      const y2 = 100 + 80 * Math.sin(endAngleRad);
                      
                      const largeArcFlag = angle > 180 ? 1 : 0;
                      
                      const pathData = [
                        `M 100 100`,
                        `L ${x1} ${y1}`,
                        `A 80 80 0 ${largeArcFlag} 1 ${x2} ${y2}`,
                        `Z`
                      ].join(' ');
                      
                      return (
                        <path
                          key={`item-${index}`}
                          d={pathData}
                          fill={getSegmentColor(index).replace('bg-', '#').replace('-500', '')}
                          className="hover:opacity-80 transition-opacity cursor-pointer"
                          onClick={() => setSelectedSegment(segment._id)}
                        />
                      );
                    })}
                  </svg>
                  <div className="absolute inset-0 flex items-center justify-center">
                    <div className="text-center">
                      <div className="text-2xl font-bold text-gray-900">{totalUsers}</div>
                      <div className="text-sm text-gray-500">Total Users</div>
                    </div>
                  </div>
                </div>
              </div>
              
              {/* Legend */}
              <div className="mt-6 grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-3">
                {segments.map((segment, index) => (
                  <div key={segment._id} className="flex items-center">
                    <div className={`w-4 h-4 rounded ${getSegmentColor(index)} mr-2`}></div>
                    <div className="text-sm">
                      <div className="font-medium text-gray-900 truncate">
                        {formatSegmentName(segment._id)}
                      </div>
                      <div className="text-gray-500">
                        {segment.userCount} users ({totalUsers > 0 ? ((segment.userCount / totalUsers) * 100).toFixed(1) : 0}%)
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          </div>
        )}

        {/* Segments Tab */}
        {activeTab === 'segments' && (
          <div className="space-y-6">
            {/* Search and Filter */}
            <div className="bg-gray-50 p-4 rounded-lg">
              <div className="flex items-center space-x-4">
                <div className="flex-1">
                  <div className="relative">
                    <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400 w-4 h-4" />
                    <input
                      type="text"
                      value={searchTerm}
                      onChange={(e) => setSearchTerm(e.target.value)}
                      placeholder="Search segments..."
                      className="w-full pl-10 pr-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
                    />
                  </div>
                </div>
                <button
                  onClick={() => setSearchTerm('')}
                  className="flex items-center px-3 py-2 text-sm font-medium text-gray-700 bg-white border border-gray-300 rounded-md hover:bg-gray-50"
                >
                  <Filter className="w-4 h-4 mr-1" />
                  Clear
                </button>
              </div>
            </div>

            {/* Segments List */}
            <div className="bg-white shadow-sm rounded-lg border">
              <div className="px-6 py-4 border-b border-gray-200">
                <h4 className="text-lg font-medium text-gray-900">User Segments</h4>
              </div>
              <div className="divide-y divide-gray-200">
                {filteredSegments.length === 0 ? (
                  <div className="p-8 text-center">
                    <Users className="w-12 h-12 text-gray-400 mx-auto mb-4" />
                    <p className="text-gray-500">No segments found</p>
                  </div>
                ) : (
                  filteredSegments.map((segment, index) => (
                    <div key={segment._id} className="p-6 hover:bg-gray-50">
                      <div className="flex items-center justify-between">
                        <div className="flex items-center">
                          <div className={`w-4 h-4 rounded ${getSegmentColor(index)} mr-3`}></div>
                          <div>
                            <div className="text-sm font-medium text-gray-900">
                              {formatSegmentName(segment._id)}
                            </div>
                            <div className="text-sm text-gray-500">
                              {segment.userCount} users
                            </div>
                          </div>
                        </div>
                        <div className="flex items-center space-x-4">
                          <div className="text-right">
                            <div className="text-sm text-gray-500">Engagement</div>
                            <span className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium ${getEngagementColor(segment.averageEngagement)}`}>
                              {segment.averageEngagement.toFixed(1)}
                            </span>
                          </div>
                          <div className="text-right">
                            <div className="text-sm text-gray-500">Churn Risk</div>
                            <span className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium ${getChurnRiskColor(segment.averageChurnRisk)}`}>
                              {segment.averageChurnRisk.toFixed(1)}
                            </span>
                          </div>
                          <div className="flex items-center space-x-2">
                            <button aria-label="View"
                              onClick={() => setSelectedSegment(segment._id)}
                              className="text-blue-600 hover:text-blue-900"
                              title="View Details"
                            >
                              <Eye className="w-4 h-4" />
                            </button>
                            <button aria-label="Delete"
                              onClick={() => handleDeleteSegment(segment._id)}
                              className="text-red-600 hover:text-red-900"
                              title="Delete Segment"
                            >
                              <Trash2 className="w-4 h-4" />
                            </button>
                          </div>
                        </div>
                      </div>
                    </div>
                  ))
                )}
              </div>
            </div>
          </div>
        )}

        {/* Create Segment Tab */}
        {activeTab === 'create' && (
          <div className="space-y-6">
            <div className="bg-white shadow-sm rounded-lg border p-6">
              <h4 className="text-lg font-medium text-gray-900 mb-4">Create New Segment</h4>
              
              <div className="space-y-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    Segment Name
                  </label>
                  <input
                    type="text"
                    value={newSegment.name}
                    onChange={(e) => setNewSegment({ ...newSegment, name: e.target.value })}
                    placeholder="Enter segment name..."
                    className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
                  />
                </div>
                
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">
                      Minimum Engagement Score
                    </label>
                    <input
                      type="number"
                      min="0"
                      max="100"
                      value={newSegment.criteria.minEngagement}
                      onChange={(e) => setNewSegment({
                        ...newSegment,
                        criteria: { ...newSegment.criteria, minEngagement: e.target.value }
                      })}
                      placeholder="0"
                      className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
                    />
                  </div>
                  
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">
                      Maximum Churn Risk
                    </label>
                    <input
                      type="number"
                      min="0"
                      max="100"
                      value={newSegment.criteria.maxChurnRisk}
                      onChange={(e) => setNewSegment({
                        ...newSegment,
                        criteria: { ...newSegment.criteria, maxChurnRisk: e.target.value }
                      })}
                      placeholder="100"
                      className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
                    />
                  </div>
                  
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">
                      Role
                    </label>
                    <select
                      value={newSegment.criteria.role}
                      onChange={(e) => setNewSegment({
                        ...newSegment,
                        criteria: { ...newSegment.criteria, role: e.target.value }
                      })}
                      className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
                    >
                      <option value="">All Roles</option>
                      <option value="admin">Admin</option>
                      <option value="manager">Manager</option>
                      <option value="staff">Staff</option>
                      <option value="guest">Guest</option>
                    </select>
                  </div>
                  
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">
                      Lifecycle Stage
                    </label>
                    <select
                      value={newSegment.criteria.lifecycleStage}
                      onChange={(e) => setNewSegment({
                        ...newSegment,
                        criteria: { ...newSegment.criteria, lifecycleStage: e.target.value }
                      })}
                      className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
                    >
                      <option value="">All Stages</option>
                      <option value="new">New</option>
                      <option value="active">Active</option>
                      <option value="engaged">Engaged</option>
                      <option value="at_risk">At Risk</option>
                      <option value="churned">Churned</option>
                    </select>
                  </div>
                </div>
                
                <div className="flex justify-end space-x-3">
                  <button
                    onClick={() => setShowCreateForm(false)}
                    className="px-4 py-2 text-sm font-medium text-gray-700 bg-white border border-gray-300 rounded-md hover:bg-gray-50"
                  >
                    Cancel
                  </button>
                  <button
                    onClick={handleCreateSegment}
                    disabled={!newSegment.name}
                    className="px-4 py-2 text-sm font-medium text-white bg-blue-600 border border-transparent rounded-md hover:bg-blue-700 disabled:opacity-50"
                  >
                    Create Segment
                  </button>
                </div>
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
};

export default UserSegmentation;
