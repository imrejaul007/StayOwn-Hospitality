import React, { useState, useEffect, useRef, useCallback } from 'react';
import {
  Users,
  UserPlus,
  Search,
  Filter,
  Download,
  Upload,
  BarChart3,
  Activity,
  TrendingUp,
  AlertTriangle,
  CheckCircle,
  XCircle,
  Eye,
  Edit,
  Trash2,
  Clock
} from 'lucide-react';
import { toast } from 'react-hot-toast';
import { useProperty } from '../../context/PropertyContext';
import { PropertyBreadcrumb } from '../../components/common/PropertyBreadcrumb';
import { api } from '../../services/api';
import UserAnalytics from '../../components/user/UserAnalytics';
import UserBulkOperations from '../../components/user/UserBulkOperations';
import UserActivityTimeline from '../../components/user/UserActivityTimeline';
import { CreateUserModal } from '../../components/user/CreateUserModal';
import { EditUserModal } from '../../components/user/EditUserModal';
import { DeleteUserConfirmation } from '../../components/user/DeleteUserConfirmation';
import { withErrorBoundary } from '../../components/ErrorBoundary';

interface User {
  _id: string;
  name: string;
  email: string;
  phone?: string;
  role: 'guest' | 'staff' | 'admin' | 'manager';
  isActive: boolean;
  hotelId?: {
    _id: string;
    name: string;
  };
  createdAt: string;
  lastLogin?: string;
  activityCount?: number;
  lastActivity?: string;
  daysSinceLastActivity?: number;
  loginCount?: number;
}

interface UserAnalytics {
  totalUsers: number;
  activeUsers: number;
  inactiveUsers: number;
  guests: number;
  staff: number;
  admins: number;
  managers: number;
  engagementRate: number;
  loyaltyRate: number;
  monthlyTrends: unknown[];
  recentUsers: User[];
  topUsers: User[];
}

const AdminUserManagement: React.FC = () => {
  const { selectedPropertyId, viewMode } = useProperty();
  const [users, setUsers] = useState<User[]>([]);
  const [analytics, setAnalytics] = useState<UserAnalytics | null>(null);
  const [loading, setLoading] = useState(false);
  const [selectedUsers, setSelectedUsers] = useState<string[]>([]);
  const [showAnalytics, setShowAnalytics] = useState(false);
  const [showBulkOperations, setShowBulkOperations] = useState(false);
  const [showActivityTimeline, setShowActivityTimeline] = useState(false);
  const [selectedUser, setSelectedUser] = useState<User | null>(null);
  const [showCreateModal, setShowCreateModal] = useState(false);
  const [showEditModal, setShowEditModal] = useState(false);
  const [editUser, setEditUser] = useState<User | null>(null);
  const [showDeleteModal, setShowDeleteModal] = useState(false);
  const [deleteUser, setDeleteUser] = useState<User | null>(null);

  const [filters, setFilters] = useState({
    search: '',
    role: 'all',
    isActive: 'all',
    sortBy: 'createdAt',
    sortOrder: 'desc',
    dateRange: ''
  });

  const [pagination, setPagination] = useState({
    current: 1,
    pages: 1,
    total: 0,
    limit: 20
  });

  const roleOptions = [
    { value: 'all', label: 'All Roles' },
    { value: 'guest', label: 'Guests', icon: '👤' },
    { value: 'staff', label: 'Staff', icon: '👨‍💼' },
    { value: 'admin', label: 'Admins', icon: '👑' },
    { value: 'manager', label: 'Managers', icon: '🎯' }
  ];

  const statusOptions = [
    { value: 'all', label: 'All Status' },
    { value: 'true', label: 'Active' },
    { value: 'false', label: 'Inactive' }
  ];

  // Track if first load completed to avoid flash of "No users found"
  const hasLoaded = useRef(false);

  // Debounce search
  const searchTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const [debouncedSearch, setDebouncedSearch] = useState(filters.search);

  useEffect(() => {
    if (searchTimerRef.current) clearTimeout(searchTimerRef.current);
    searchTimerRef.current = setTimeout(() => {
      setDebouncedSearch(filters.search);
      setPagination(prev => ({ ...prev, current: 1 }));
    }, 400);
    return () => { if (searchTimerRef.current) clearTimeout(searchTimerRef.current); };
  }, [filters.search]);

  // Helper to update filters and reset to page 1 in one batch
  const updateFilter = useCallback((patch: Partial<typeof filters>) => {
    setFilters(prev => ({ ...prev, ...patch }));
    setPagination(prev => ({ ...prev, current: 1 }));
    // If search is being cleared, update debounced value immediately to avoid double-fetch
    if ('search' in patch) {
      setDebouncedSearch(patch.search || '');
    }
  }, []);

  // Fetch users — depends on all filter/page/search state
  const fetchUsers = useCallback(async () => {
    if (!selectedPropertyId) return;
    try {
      setLoading(true);
      const queryParams = new URLSearchParams();

      queryParams.append('page', pagination.current.toString());
      queryParams.append('limit', pagination.limit.toString());
      queryParams.append('hotelId', selectedPropertyId);

      if (debouncedSearch) queryParams.append('search', debouncedSearch);
      if (filters.role !== 'all') queryParams.append('role', filters.role);
      if (filters.isActive !== 'all') queryParams.append('isActive', filters.isActive);
      if (filters.sortBy) queryParams.append('sortBy', filters.sortBy);
      if (filters.sortOrder) queryParams.append('sortOrder', filters.sortOrder);
      if (filters.dateRange) queryParams.append('dateRange', filters.dateRange);

      const { data } = await api.get(`/user-management/advanced-list?${queryParams}`);
      setUsers(data.data.users);
      const apiPages = data.pagination.pages || 1;
      const apiCurrent = data.pagination.current;
      // If current page exceeds total pages (e.g. after deletion), go to last page
      if (apiCurrent > apiPages && apiPages > 0) {
        setPagination(prev => ({ ...prev, current: apiPages, pages: apiPages, total: data.pagination.total }));
        return; // will re-fetch with corrected page via useEffect
      }
      setPagination(prev => ({
        ...prev,
        current: apiCurrent,
        pages: apiPages,
        total: data.pagination.total
      }));
      hasLoaded.current = true;
    } catch {
      toast.error('Failed to fetch users');
      hasLoaded.current = true;
    } finally {
      setLoading(false);
    }
  }, [selectedPropertyId, debouncedSearch, filters.role, filters.isActive, filters.sortBy, filters.sortOrder, filters.dateRange, pagination.current, pagination.limit]);

  // Fetch analytics — only depends on property, not filters
  const fetchAnalytics = useCallback(async () => {
    if (!selectedPropertyId) return;
    try {
      const { data } = await api.get('/user-management/analytics');
      setAnalytics(data.data);
    } catch {
      // Analytics failure is non-blocking
    }
  }, [selectedPropertyId]);

  // Users: re-fetch on any filter/page/search change
  useEffect(() => {
    fetchUsers();
  }, [fetchUsers]);

  // Analytics: only re-fetch when property changes
  useEffect(() => {
    fetchAnalytics();
  }, [fetchAnalytics]);

  // Early return if no property selected in single mode (AFTER all hooks)
  if (!selectedPropertyId && viewMode === 'single') {
    return (
      <div className="p-6">
        <PropertyBreadcrumb items={['Configuration', 'User Management']} />
        <div className="flex items-center justify-center h-64">
          <p className="text-gray-600 text-lg">Please select a property to manage users</p>
        </div>
      </div>
    );
  }

  const handleUserSelect = (userId: string) => {
    setSelectedUsers(prev => 
      prev.includes(userId) 
        ? prev.filter(id => id !== userId)
        : [...prev, userId]
    );
  };

  const currentPageIds = users.map(u => u._id);
  const allCurrentPageSelected = users.length > 0 && currentPageIds.every(id => selectedUsers.includes(id));

  const handleSelectAll = () => {
    if (allCurrentPageSelected) {
      // Deselect only current page, keep other pages' selections
      setSelectedUsers(prev => prev.filter(id => !currentPageIds.includes(id)));
    } else {
      // Add current page to selections (dedup)
      setSelectedUsers(prev => [...new Set([...prev, ...currentPageIds])]);
    }
  };

  const handleExport = async () => {
    try {
      const queryParams = new URLSearchParams();
      queryParams.append('format', 'csv');
      
      if (filters.role !== 'all') queryParams.append('filters[role]', filters.role);
      if (filters.isActive !== 'all') queryParams.append('filters[isActive]', filters.isActive);

      const response = await api.get(`/user-management/export?${queryParams}`, { responseType: 'blob' });
      const blob = response.data;
      const url = window.URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = 'users.csv';
      document.body.appendChild(a);
      a.click();
      window.URL.revokeObjectURL(url);
      document.body.removeChild(a);

      toast.success('Users exported successfully');
    } catch (error) {
      toast.error('Failed to export users');
    }
  };

  const handleImport = async (file: File) => {
    try {
      const text = await file.text();
      const lines = text.split('\n').filter(line => line.trim());
      if (lines.length < 2) {
        toast.error('CSV file must have a header row and at least one data row');
        return;
      }

      const headers = lines[0].split(',').map(h => h.trim().toLowerCase());
      const usersData = lines.slice(1).map(line => {
        const values = line.split(',').map(v => v.trim());
        const user: Record<string, string> = {};
        headers.forEach((header, i) => {
          if (values[i]) user[header] = values[i];
        });
        return user;
      }).filter(u => u.email && u.name);

      if (usersData.length === 0) {
        toast.error('No valid user rows found. Ensure CSV has name and email columns.');
        return;
      }

      const { data } = await api.post('/user-management/import', { usersData });
      toast.success(`Imported ${data.data.created} users, updated ${data.data.updated} users`);
      fetchUsers();
      fetchAnalytics();
    } catch {
      toast.error('Failed to import users. Check CSV format.');
    }
  };

  const getRoleIcon = (role: string) => {
    const roleConfig = roleOptions.find(r => r.value === role);
    return roleConfig?.icon || '👤';
  };

  const getRoleColor = (role: string) => {
    const colors = {
      guest: 'bg-blue-100 text-blue-800',
      staff: 'bg-green-100 text-green-800',
      admin: 'bg-purple-100 text-purple-800',
      manager: 'bg-orange-100 text-orange-800'
    };
    return colors[role as keyof typeof colors] || 'bg-gray-100 text-gray-800';
  };

  const getActivityStatus = (user: User) => {
    if (!user.lastActivity) return { status: 'inactive', color: 'text-gray-500', label: 'No Activity' };

    const days = user.daysSinceLastActivity || 0;
    if (days <= 1) return { status: 'active', color: 'text-green-500', label: 'Very Active' };
    if (days <= 7) return { status: 'recent', color: 'text-blue-500', label: 'Recent' };
    if (days <= 30) return { status: 'moderate', color: 'text-yellow-500', label: 'Moderate' };
    return { status: 'inactive', color: 'text-red-500', label: 'Inactive' };
  };

  const handleEditUser = (user: User) => {
    setEditUser(user);
    setShowEditModal(true);
  };

  const handleDeleteUserClick = (user: User) => {
    setDeleteUser(user);
    setShowDeleteModal(true);
  };

  if (showAnalytics) {
    return (
      <UserAnalytics
        onClose={() => setShowAnalytics(false)}
      />
    );
  }

  if (showBulkOperations) {
    return (
      <UserBulkOperations
        selectedUsers={selectedUsers}
        onClose={() => setShowBulkOperations(false)}
        onSuccess={() => {
          setShowBulkOperations(false);
          setSelectedUsers([]);
          fetchUsers();
        }}
      />
    );
  }

  if (showActivityTimeline && selectedUser) {
    return (
      <UserActivityTimeline
        user={selectedUser}
        onClose={() => {
          setShowActivityTimeline(false);
          setSelectedUser(null);
        }}
      />
    );
  }

  return (
    <div className="p-6">
      {/* Property Breadcrumb */}
      <PropertyBreadcrumb items={['Configuration', 'User Management']} />

      <div className="mb-6">
        <div className="flex justify-between items-center mb-4">
          <div>
            <h1 className="text-2xl font-bold text-gray-900">User Management</h1>
            <p className="text-gray-600">Comprehensive user administration and analytics</p>
          </div>
          <div className="flex space-x-3">
            <button
              onClick={() => setShowAnalytics(true)}
              className="flex items-center px-4 py-2 text-sm font-medium text-gray-700 bg-white border border-gray-300 rounded-md hover:bg-gray-50"
            >
              <BarChart3 className="w-4 h-4 mr-2" />
              Analytics
            </button>
            <button
              onClick={handleExport}
              className="flex items-center px-4 py-2 text-sm font-medium text-gray-700 bg-white border border-gray-300 rounded-md hover:bg-gray-50"
            >
              <Download className="w-4 h-4 mr-2" />
              Export
            </button>
            <label className="flex items-center px-4 py-2 text-sm font-medium text-gray-700 bg-white border border-gray-300 rounded-md hover:bg-gray-50 cursor-pointer">
              <Upload className="w-4 h-4 mr-2" />
              Import
              <input
                type="file"
                accept=".csv,.xlsx"
                onChange={(e) => e.target.files?.[0] && handleImport(e.target.files[0])}
                className="hidden"
              />
            </label>
            {selectedUsers.length > 0 && (
              <button
                onClick={() => setShowBulkOperations(true)}
                className="flex items-center px-4 py-2 text-sm font-medium text-white bg-blue-600 border border-transparent rounded-md hover:bg-blue-700"
              >
                <Users className="w-4 h-4 mr-2" />
                Bulk Operations ({selectedUsers.length})
              </button>
            )}
            <button
              onClick={() => setShowCreateModal(true)}
              className="flex items-center px-4 py-2 text-sm font-medium text-white bg-blue-600 border border-transparent rounded-md hover:bg-blue-700"
            >
              <UserPlus className="w-4 h-4 mr-2" />
              Add User
            </button>
          </div>
        </div>

        {/* Analytics Overview */}
        {analytics && (
          <div className="grid grid-cols-1 md:grid-cols-4 lg:grid-cols-6 gap-4 mb-6">
            <div className="bg-white p-4 rounded-lg shadow-sm border">
              <div className="flex items-center">
                <Users className="w-8 h-8 text-blue-600" />
                <div className="ml-3">
                  <p className="text-sm font-medium text-gray-600">Total Users</p>
                  <p className="text-2xl font-bold text-gray-900">{analytics.totalUsers}</p>
                </div>
              </div>
            </div>
            <div className="bg-white p-4 rounded-lg shadow-sm border">
              <div className="flex items-center">
                <CheckCircle className="w-8 h-8 text-green-600" />
                <div className="ml-3">
                  <p className="text-sm font-medium text-gray-600">Active</p>
                  <p className="text-2xl font-bold text-gray-900">{analytics.activeUsers}</p>
                </div>
              </div>
            </div>
            <div className="bg-white p-4 rounded-lg shadow-sm border">
              <div className="flex items-center">
                <XCircle className="w-8 h-8 text-red-600" />
                <div className="ml-3">
                  <p className="text-sm font-medium text-gray-600">Inactive</p>
                  <p className="text-2xl font-bold text-gray-900">{analytics.inactiveUsers}</p>
                </div>
              </div>
            </div>
            <div className="bg-white p-4 rounded-lg shadow-sm border">
              <div className="flex items-center">
                <Activity className="w-8 h-8 text-purple-600" />
                <div className="ml-3">
                  <p className="text-sm font-medium text-gray-600">Engagement</p>
                  <p className="text-2xl font-bold text-gray-900">{(analytics.engagementRate ?? 0).toFixed(1)}%</p>
                </div>
              </div>
            </div>
            <div className="bg-white p-4 rounded-lg shadow-sm border">
              <div className="flex items-center">
                <TrendingUp className="w-8 h-8 text-orange-600" />
                <div className="ml-3">
                  <p className="text-sm font-medium text-gray-600">Loyalty</p>
                  <p className="text-2xl font-bold text-gray-900">{(analytics.loyaltyRate ?? 0).toFixed(1)}%</p>
                </div>
              </div>
            </div>
            <div className="bg-white p-4 rounded-lg shadow-sm border">
              <div className="flex items-center">
                <AlertTriangle className="w-8 h-8 text-yellow-600" />
                <div className="ml-3">
                  <p className="text-sm font-medium text-gray-600">Needs Attention</p>
                  <p className="text-2xl font-bold text-gray-900">
                    {analytics.inactiveUsers ?? 0}
                  </p>
                </div>
              </div>
            </div>
          </div>
        )}

        {/* Filters */}
        <div className="bg-white p-4 rounded-lg shadow-sm border">
          <div className="grid grid-cols-1 md:grid-cols-6 gap-4">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                Search
              </label>
              <div className="relative">
                <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400 w-4 h-4" />
                <input
                  type="text"
                  value={filters.search}
                  onChange={(e) => setFilters({ ...filters, search: e.target.value })}
                  placeholder="Search users..."
                  className="w-full pl-10 pr-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
                />
              </div>
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                Role
              </label>
              <select
                value={filters.role}
                onChange={(e) => updateFilter({ role: e.target.value })}
                className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
              >
                {roleOptions.map(role => (
                  <option key={role.value} value={role.value}>{role.label}</option>
                ))}
              </select>
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                Status
              </label>
              <select
                value={filters.isActive}
                onChange={(e) => updateFilter({ isActive: e.target.value })}
                className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
              >
                {statusOptions.map(status => (
                  <option key={status.value} value={status.value}>{status.label}</option>
                ))}
              </select>
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                Sort By
              </label>
              <select
                value={filters.sortBy}
                onChange={(e) => updateFilter({ sortBy: e.target.value })}
                className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
              >
                <option value="createdAt">Created Date</option>
                <option value="name">Name</option>
                <option value="email">Email</option>
                <option value="lastLogin">Last Login</option>
                <option value="activityCount">Activity</option>
              </select>
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                Order
              </label>
              <select
                value={filters.sortOrder}
                onChange={(e) => updateFilter({ sortOrder: e.target.value })}
                className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
              >
                <option value="desc">Descending</option>
                <option value="asc">Ascending</option>
              </select>
            </div>
            <div className="flex items-end">
              <button
                onClick={() => updateFilter({
                  search: '',
                  role: 'all',
                  isActive: 'all',
                  sortBy: 'createdAt',
                  sortOrder: 'desc',
                  dateRange: ''
                })}
                className="w-full flex items-center justify-center px-3 py-2 text-sm font-medium text-gray-700 bg-gray-100 border border-gray-300 rounded-md hover:bg-gray-200"
              >
                <Filter className="w-4 h-4 mr-2" />
                Clear
              </button>
            </div>
          </div>
        </div>
      </div>

      {/* Users Table */}
      <div className="bg-white shadow-sm rounded-lg border">
        {loading ? (
          <div className="p-8 text-center">
            <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600 mx-auto"></div>
            <p className="mt-2 text-gray-600">Loading users...</p>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="min-w-full divide-y divide-gray-200">
              <thead className="bg-gray-50">
                <tr>
                  <th className="px-6 py-3 text-left">
                    <input
                      type="checkbox"
                      checked={allCurrentPageSelected}
                      onChange={handleSelectAll}
                      className="h-4 w-4 text-blue-600 focus:ring-blue-500 border-gray-300 rounded"
                    />
                  </th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                    User
                  </th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                    Role
                  </th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                    Status
                  </th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                    Activity
                  </th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                    Last Login
                  </th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                    Actions
                  </th>
                </tr>
              </thead>
              <tbody className="bg-white divide-y divide-gray-200">
                {users.map((user) => {
                  const activityStatus = getActivityStatus(user);
                  return (
                    <tr key={user._id} className="hover:bg-gray-50">
                      <td className="px-6 py-4 whitespace-nowrap">
                        <input
                          type="checkbox"
                          checked={selectedUsers.includes(user._id)}
                          onChange={() => handleUserSelect(user._id)}
                          className="h-4 w-4 text-blue-600 focus:ring-blue-500 border-gray-300 rounded"
                        />
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap">
                        <div className="flex items-center">
                          <div className="flex-shrink-0 h-10 w-10">
                            <div className="h-10 w-10 rounded-full bg-gray-300 flex items-center justify-center">
                              <span className="text-sm font-medium text-gray-700">
                                {user.name.charAt(0).toUpperCase()}
                              </span>
                            </div>
                          </div>
                          <div className="ml-4">
                            <div className="text-sm font-medium text-gray-900">{user.name}</div>
                            <div className="text-sm text-gray-500">{user.email}</div>
                            {user.phone && (
                              <div className="text-xs text-gray-400">{user.phone}</div>
                            )}
                          </div>
                        </div>
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap">
                        <span className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium ${getRoleColor(user.role)}`}>
                          <span className="mr-1">{getRoleIcon(user.role)}</span>
                          {user.role}
                        </span>
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap">
                        <span className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium ${
                          user.isActive 
                            ? 'bg-green-100 text-green-800' 
                            : 'bg-red-100 text-red-800'
                        }`}>
                          {user.isActive ? (
                            <>
                              <CheckCircle className="w-3 h-3 mr-1" />
                              Active
                            </>
                          ) : (
                            <>
                              <XCircle className="w-3 h-3 mr-1" />
                              Inactive
                            </>
                          )}
                        </span>
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap">
                        <div className="flex items-center">
                          <span className={`text-sm ${activityStatus.color}`}>
                            {activityStatus.label}
                          </span>
                          {user.activityCount !== undefined && (
                            <span className="ml-2 text-xs text-gray-500">
                              ({user.activityCount} activities)
                            </span>
                          )}
                        </div>
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                        {user.lastLogin ? (
                          <div className="flex items-center">
                            <Clock className="w-3 h-3 mr-1" />
                            {new Date(user.lastLogin).toLocaleDateString()}
                          </div>
                        ) : (
                          <span className="text-gray-400">Never</span>
                        )}
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap text-sm font-medium">
                        <div className="flex space-x-2">
                          <button aria-label="View"
                            onClick={() => {
                              setSelectedUser(user);
                              setShowActivityTimeline(true);
                            }}
                            className="text-blue-600 hover:text-blue-900"
                            title="View Activity"
                          >
                            <Eye className="w-4 h-4" />
                          </button>
                          <button aria-label="Edit"
                            onClick={() => handleEditUser(user)}
                            className="text-green-600 hover:text-green-900"
                            title="Edit User"
                          >
                            <Edit className="w-4 h-4" />
                          </button>
                          <button aria-label="Delete"
                            onClick={() => handleDeleteUserClick(user)}
                            className="text-red-600 hover:text-red-900"
                            title="Delete User"
                          >
                            <Trash2 className="w-4 h-4" />
                          </button>
                        </div>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}

        {!loading && users.length === 0 && hasLoaded.current && (
          <div className="p-8 text-center">
            <Users className="w-12 h-12 text-gray-400 mx-auto mb-4" />
            <p className="text-gray-500">No users found</p>
          </div>
        )}

        {/* Pagination */}
        {pagination.pages > 1 && (
          <div className="bg-white px-4 py-3 flex items-center justify-between border-t border-gray-200 sm:px-6">
            <div className="flex-1 flex justify-between sm:hidden">
              <button
                onClick={() => setPagination(prev => ({ ...prev, current: prev.current - 1 }))}
                disabled={pagination.current === 1}
                className="relative inline-flex items-center px-4 py-2 border border-gray-300 text-sm font-medium rounded-md text-gray-700 bg-white hover:bg-gray-50 disabled:opacity-50"
              >
                Previous
              </button>
              <button
                onClick={() => setPagination(prev => ({ ...prev, current: prev.current + 1 }))}
                disabled={pagination.current === pagination.pages}
                className="ml-3 relative inline-flex items-center px-4 py-2 border border-gray-300 text-sm font-medium rounded-md text-gray-700 bg-white hover:bg-gray-50 disabled:opacity-50"
              >
                Next
              </button>
            </div>
            <div className="hidden sm:flex-1 sm:flex sm:items-center sm:justify-between">
              <div>
                <p className="text-sm text-gray-700">
                  Showing page <span className="font-medium">{pagination.current}</span> of{' '}
                  <span className="font-medium">{pagination.pages}</span> ({pagination.total} total users)
                </p>
              </div>
              <div>
                <nav className="relative z-0 inline-flex rounded-md shadow-sm -space-x-px">
                  <button
                    onClick={() => setPagination(prev => ({ ...prev, current: prev.current - 1 }))}
                    disabled={pagination.current === 1}
                    className="relative inline-flex items-center px-2 py-2 rounded-l-md border border-gray-300 bg-white text-sm font-medium text-gray-500 hover:bg-gray-50 disabled:opacity-50"
                  >
                    Previous
                  </button>
                  <button
                    onClick={() => setPagination(prev => ({ ...prev, current: prev.current + 1 }))}
                    disabled={pagination.current === pagination.pages}
                    className="relative inline-flex items-center px-2 py-2 rounded-r-md border border-gray-300 bg-white text-sm font-medium text-gray-500 hover:bg-gray-50 disabled:opacity-50"
                  >
                    Next
                  </button>
                </nav>
              </div>
            </div>
          </div>
        )}
      </div>

      {/* Create User Modal */}
      <CreateUserModal
        isOpen={showCreateModal}
        onClose={() => setShowCreateModal(false)}
        onSuccess={() => {
          setShowCreateModal(false);
          fetchUsers();
        }}
      />

      {/* Edit User Modal */}
      {editUser && (
        <EditUserModal
          isOpen={showEditModal}
          onClose={() => {
            setShowEditModal(false);
            setEditUser(null);
          }}
          onSuccess={() => {
            setShowEditModal(false);
            setEditUser(null);
            fetchUsers();
          }}
          user={editUser}
        />
      )}

      {/* Delete User Confirmation */}
      <DeleteUserConfirmation
        isOpen={showDeleteModal}
        onClose={() => {
          setShowDeleteModal(false);
          setDeleteUser(null);
        }}
        onSuccess={() => {
          setShowDeleteModal(false);
          setDeleteUser(null);
          fetchUsers();
        }}
        user={deleteUser}
      />
    </div>
  );
};

export default withErrorBoundary(AdminUserManagement, { level: 'page' });
