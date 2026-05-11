import React, { useState, useCallback } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { toast } from 'react-hot-toast';
import {
  Search,
  Edit,
  Trash2,
  UserPlus,
  Users,
  Phone,
  Shield,
  Eye,
  EyeOff,
  ChevronLeft,
  ChevronRight,
} from 'lucide-react';
import { useProperty } from '../../context/PropertyContext';
import { useAuth } from '../../context/AuthContext';
import { PropertyBreadcrumb } from '../../components/common/PropertyBreadcrumb';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import { Modal } from '@/components/ui/Modal';
import { LoadingSpinner } from '../../components/LoadingSpinner';
import { staffService } from '../../services/staffService';
import { EditUserModal } from '../../components/user/EditUserModal';
import { CreateUserModal } from '../../components/user/CreateUserModal';
import { withErrorBoundary } from '../../components/ErrorBoundary';

interface StaffMember {
  _id: string;
  name: string;
  email: string;
  phone?: string;
  role: 'admin' | 'manager' | 'frontdesk' | 'housekeeping' | 'staff';
  isActive: boolean;
  hotelId: {
    _id: string;
    name: string;
  };
  createdAt: string;
  lastLogin?: string;
}

const PAGE_SIZE = 20;

/** Simple debounce hook that returns a debounced value */
function useDebouncedValue<T>(value: T, delay: number): T {
  const [debounced, setDebounced] = React.useState(value);
  React.useEffect(() => {
    const timer = setTimeout(() => setDebounced(value), delay);
    return () => clearTimeout(timer);
  }, [value, delay]);
  return debounced;
}

function AdminStaffManagement() {
  const { selectedPropertyId, selectedProperty, viewMode } = useProperty();
  const { user } = useAuth();

  // SECURITY: Only admin and manager roles may access this page.
  // Frontdesk users get a restricted view; guests/staff are denied entirely.
  const ALLOWED_ROLES = ['admin', 'manager', 'frontdesk'];
  if (user && !ALLOWED_ROLES.includes(user.role)) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="text-center">
          <div className="text-red-600 text-lg font-semibold mb-2">Access Denied</div>
          <p className="text-gray-600">You do not have permission to view staff management.</p>
        </div>
      </div>
    );
  }

  const isFrontDesk = user?.role === 'frontdesk';
  const [isCreateModalOpen, setIsCreateModalOpen] = useState(false);
  const [isEditModalOpen, setIsEditModalOpen] = useState(false);
  const [isDeleteModalOpen, setIsDeleteModalOpen] = useState(false);
  const [selectedStaff, setSelectedStaff] = useState<StaffMember | null>(null);
  const [searchTerm, setSearchTerm] = useState('');
  const [roleFilter, setRoleFilter] = useState<string>('all');
  const [statusFilter, setStatusFilter] = useState<string>('all');
  const [currentPage, setCurrentPage] = useState(1);

  const debouncedSearch = useDebouncedValue(searchTerm, 300);

  const queryClient = useQueryClient();

  // Reset to page 1 when filters change
  const handleSearchChange = useCallback((value: string) => {
    setSearchTerm(value);
    setCurrentPage(1);
  }, []);

  const handleRoleFilterChange = useCallback((value: string) => {
    setRoleFilter(value);
    setCurrentPage(1);
  }, []);

  const handleStatusFilterChange = useCallback((value: string) => {
    setStatusFilter(value);
    setCurrentPage(1);
  }, []);

  // Fetch staff members with server-side pagination
  const { data: staffData, isLoading, error } = useQuery({
    queryKey: ['staff', selectedPropertyId, debouncedSearch, roleFilter, statusFilter, currentPage],
    queryFn: () => staffService.getStaffMembers({
      hotelId: selectedPropertyId ?? undefined,
      search: debouncedSearch || undefined,
      role: roleFilter === 'all' ? undefined : roleFilter as StaffMember['role'],
      isActive: statusFilter === 'all' ? undefined : statusFilter === 'true',
      page: currentPage,
      limit: PAGE_SIZE,
    }),
    enabled: !!selectedPropertyId,
    refetchOnMount: 'always',
    refetchOnWindowFocus: true,
    staleTime: 0,
    keepPreviousData: true,
  });

  const staffList = staffData?.staff ?? [];
  const pagination = staffData?.pagination ?? { page: 1, limit: PAGE_SIZE, total: 0, pages: 1 };

  // Update staff mutation (for toggle status)
  const updateStaffMutation = useMutation({
    mutationFn: ({ id, data }: { id: string; data: { isActive?: boolean } }) =>
      staffService.updateStaffMember(id, data),
    onSuccess: () => {
      toast.success('Staff member updated successfully');
      queryClient.invalidateQueries({ queryKey: ['staff'] });
    },
    onError: (error: unknown) => {
      const err = error as { response?: { data?: { message?: string } }; message?: string };
      toast.error(err.response?.data?.message || err.message || 'Failed to update staff member');
    }
  });

  // Delete staff mutation
  const deleteStaffMutation = useMutation({
    mutationFn: staffService.deleteStaffMember,
    onSuccess: () => {
      toast.success('Staff member deleted successfully');
      setIsDeleteModalOpen(false);
      setSelectedStaff(null);
      queryClient.invalidateQueries({ queryKey: ['staff'] });
    },
    onError: (error: unknown) => {
      const err = error as { response?: { data?: { message?: string } }; message?: string };
      toast.error(err.response?.data?.message || err.message || 'Failed to delete staff member');
    }
  });

  const handleDeleteStaff = () => {
    if (!selectedStaff) return;
    deleteStaffMutation.mutate(selectedStaff._id);
  };

  const openEditModal = (staff: StaffMember) => {
    setSelectedStaff(staff);
    setIsEditModalOpen(true);
  };

  const openDeleteModal = (staff: StaffMember) => {
    setSelectedStaff(staff);
    setIsDeleteModalOpen(true);
  };

  const toggleStaffStatus = (staff: StaffMember) => {
    updateStaffMutation.mutate({
      id: staff._id,
      data: { isActive: !staff.isActive }
    });
  };

  // Pagination helpers
  const totalPages = pagination.pages;
  const canGoPrev = currentPage > 1;
  const canGoNext = currentPage < totalPages;

  // Fetch real aggregate stats from server (uses limit=1 requests for efficient counts)
  const { data: staffStats } = useQuery({
    queryKey: ['staff-stats', selectedPropertyId],
    queryFn: () => staffService.getStaffStats(selectedPropertyId ?? undefined),
    enabled: !!selectedPropertyId,
    staleTime: 30000,
  });

  const activeCount = staffStats?.active ?? 0;
  const adminCount = staffStats?.admins ?? 0;
  const regularCount = staffStats?.regularStaff ?? 0;

  if (error) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="text-center">
          <div className="text-red-600 mb-2">Error loading staff members</div>
          <Button onClick={() => queryClient.invalidateQueries({ queryKey: ['staff'] })}>Retry</Button>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <PropertyBreadcrumb items={['Staff Management']} />

      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Staff Management</h1>
          <p className="text-gray-600">
            {isFrontDesk ? 'View hotel staff members' : 'Manage your hotel staff members'}
          </p>
        </div>
        {!isFrontDesk && (
          <Button onClick={() => setIsCreateModalOpen(true)}>
            <UserPlus className="w-4 h-4 mr-2" />
            Add Staff Member
          </Button>
        )}
      </div>

      {/* Stats Cards */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
        <Card>
          <CardContent className="p-4">
            <div className="flex items-center">
              <div className="p-2 bg-blue-100 rounded-lg">
                <Users className="w-6 h-6 text-blue-600" />
              </div>
              <div className="ml-4">
                <p className="text-sm font-medium text-gray-600">Total Staff</p>
                <p className="text-2xl font-bold text-gray-900">
                  {pagination.total}
                </p>
              </div>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardContent className="p-4">
            <div className="flex items-center">
              <div className="p-2 bg-green-100 rounded-lg">
                <Eye className="w-6 h-6 text-green-600" />
              </div>
              <div className="ml-4">
                <p className="text-sm font-medium text-gray-600">Active</p>
                <p className="text-2xl font-bold text-gray-900">
                  {activeCount}
                </p>
              </div>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardContent className="p-4">
            <div className="flex items-center">
              <div className="p-2 bg-purple-100 rounded-lg">
                <Shield className="w-6 h-6 text-purple-600" />
              </div>
              <div className="ml-4">
                <p className="text-sm font-medium text-gray-600">Admins</p>
                <p className="text-2xl font-bold text-gray-900">
                  {adminCount}
                </p>
              </div>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardContent className="p-4">
            <div className="flex items-center">
              <div className="p-2 bg-orange-100 rounded-lg">
                <Users className="w-6 h-6 text-orange-600" />
              </div>
              <div className="ml-4">
                <p className="text-sm font-medium text-gray-600">Regular Staff</p>
                <p className="text-2xl font-bold text-gray-900">
                  {regularCount}
                </p>
              </div>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Filters */}
      <Card>
        <CardContent className="p-4">
          <div className="flex flex-col sm:flex-row gap-4">
            <div className="flex-1">
              <div className="relative">
                <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400 w-4 h-4" />
                <Input
                  placeholder="Search staff by name or email..."
                  value={searchTerm}
                  onChange={(e) => handleSearchChange(e.target.value)}
                  className="pl-10"
                />
              </div>
            </div>
            <select
              value={roleFilter}
              onChange={(e) => handleRoleFilterChange(e.target.value)}
              className="w-full sm:w-48 px-3 py-2 border border-gray-300 rounded-md shadow-sm focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500 bg-white"
            >
              <option value="all">All Roles</option>
              <option value="admin">Admin</option>
              <option value="manager">Manager</option>
              <option value="frontdesk">Front Desk</option>
              <option value="housekeeping">Housekeeping</option>
              <option value="staff">Staff</option>
            </select>
            <select
              value={statusFilter}
              onChange={(e) => handleStatusFilterChange(e.target.value)}
              className="w-full sm:w-40 px-3 py-2 border border-gray-300 rounded-md shadow-sm focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500 bg-white"
            >
              <option value="all">All Status</option>
              <option value="true">Active</option>
              <option value="false">Inactive</option>
            </select>
          </div>
        </CardContent>
      </Card>

      {/* Staff Table */}
      <Card>
        <CardHeader>
          <div className="flex items-center justify-between">
            <CardTitle>Staff Members</CardTitle>
            <div className="text-sm text-gray-500">
              Showing {staffList.length} of {pagination.total} staff
              {viewMode === 'single' && selectedProperty && (
                <span className="ml-2 text-blue-600">
                  for {selectedProperty.name}
                </span>
              )}
            </div>
          </div>
        </CardHeader>
        <CardContent>
          {isLoading ? (
            <div className="flex items-center justify-center h-64">
              <LoadingSpinner />
            </div>
          ) : staffList.length === 0 ? (
            <div className="flex flex-col items-center justify-center h-64 text-center">
              <Users className="w-12 h-12 text-gray-300 mb-4" />
              <h3 className="text-lg font-medium text-gray-900 mb-1">No staff members found</h3>
              <p className="text-sm text-gray-500 mb-4">
                {searchTerm || roleFilter !== 'all' || statusFilter !== 'all'
                  ? 'Try adjusting your search or filter criteria.'
                  : 'Get started by adding your first staff member.'}
              </p>
              {!isFrontDesk && !searchTerm && roleFilter === 'all' && statusFilter === 'all' && (
                <Button onClick={() => setIsCreateModalOpen(true)}>
                  <UserPlus className="w-4 h-4 mr-2" />
                  Add Staff Member
                </Button>
              )}
            </div>
          ) : (
            <>
              {/* Staff table */}
              <div className="overflow-x-auto">
                <table className="w-full min-w-full">
                  <thead className="bg-gray-50 border-b border-gray-200">
                    <tr>
                      <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Name</th>
                      <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Contact</th>
                      <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Role</th>
                      <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Status</th>
                      <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Last Login</th>
                      {!isFrontDesk && (
                        <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Actions</th>
                      )}
                    </tr>
                  </thead>
                  <tbody className="bg-white divide-y divide-gray-100">
                    {staffList.map((staff: StaffMember) => (
                      <tr key={staff._id} className="hover:bg-gray-50 transition-colors">
                        <td className="px-6 py-4">
                          <div className="flex items-center space-x-3">
                            <div className="w-8 h-8 bg-blue-100 rounded-full flex items-center justify-center">
                              <Users className="w-4 h-4 text-blue-600" />
                            </div>
                            <div>
                              <div className="font-medium text-gray-900">{staff.name}</div>
                              <div className="text-sm text-gray-500">{staff.email}</div>
                            </div>
                          </div>
                        </td>
                        <td className="px-6 py-4">
                          <div className="text-sm text-gray-600">
                            {staff.phone ? (
                              <div className="flex items-center space-x-1">
                                <Phone className="w-3 h-3" />
                                <span>{staff.phone}</span>
                              </div>
                            ) : (
                              <span className="text-gray-400">No phone</span>
                            )}
                          </div>
                        </td>
                        <td className="px-6 py-4">
                          <Badge variant={
                            staff.role === 'admin' ? 'destructive' :
                            staff.role === 'manager' ? 'default' :
                            'secondary'
                          }>
                            <Shield className="w-3 h-3 mr-1" />
                            {staff.role === 'frontdesk' ? 'Front Desk' : staff.role.charAt(0).toUpperCase() + staff.role.slice(1)}
                          </Badge>
                        </td>
                        <td className="px-6 py-4">
                          <Badge variant={staff.isActive ? 'default' : 'outline'}>
                            {staff.isActive ? 'Active' : 'Inactive'}
                          </Badge>
                        </td>
                        <td className="px-6 py-4">
                          <div className="text-sm text-gray-600">
                            {staff.lastLogin
                              ? new Date(staff.lastLogin).toLocaleDateString()
                              : 'Never'}
                          </div>
                        </td>
                        {!isFrontDesk && (
                          <td className="px-6 py-4">
                            <div className="flex items-center space-x-2">
                              <Button
                                variant="outline"
                                size="sm"
                                onClick={() => toggleStaffStatus(staff)}
                                disabled={updateStaffMutation.isPending}
                              >
                                {staff.isActive ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                              </Button>
                              <Button
                                variant="outline"
                                size="sm"
                                onClick={() => openEditModal(staff)}
                              >
                                <Edit className="w-4 h-4" />
                              </Button>
                              <Button
                                variant="outline"
                                size="sm"
                                onClick={() => openDeleteModal(staff)}
                                className="text-red-600 hover:text-red-700"
                              >
                                <Trash2 className="w-4 h-4" />
                              </Button>
                            </div>
                          </td>
                        )}
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>

              {/* Server-side pagination controls */}
              {totalPages > 1 && (
                <div className="flex items-center justify-between px-6 py-4 border-t border-gray-200">
                  <div className="text-sm text-gray-700">
                    Page {pagination.page} of {totalPages} ({pagination.total} total)
                  </div>
                  <div className="flex items-center space-x-2">
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => setCurrentPage((p) => Math.max(1, p - 1))}
                      disabled={!canGoPrev}
                    >
                      <ChevronLeft className="w-4 h-4 mr-1" />
                      Previous
                    </Button>
                    {/* Page number buttons */}
                    {Array.from({ length: Math.min(5, totalPages) }, (_, i) => {
                      // Show pages around current page
                      let pageNum: number;
                      if (totalPages <= 5) {
                        pageNum = i + 1;
                      } else if (currentPage <= 3) {
                        pageNum = i + 1;
                      } else if (currentPage >= totalPages - 2) {
                        pageNum = totalPages - 4 + i;
                      } else {
                        pageNum = currentPage - 2 + i;
                      }
                      return (
                        <Button
                          key={pageNum}
                          variant={currentPage === pageNum ? 'default' : 'outline'}
                          size="sm"
                          onClick={() => setCurrentPage(pageNum)}
                          className="min-w-[36px]"
                        >
                          {pageNum}
                        </Button>
                      );
                    })}
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => setCurrentPage((p) => Math.min(totalPages, p + 1))}
                      disabled={!canGoNext}
                    >
                      Next
                      <ChevronRight className="w-4 h-4 ml-1" />
                    </Button>
                  </div>
                </div>
              )}
            </>
          )}
        </CardContent>
      </Card>

      {/* Create User Modal - Only for admin/staff */}
      {!isFrontDesk && (
        <CreateUserModal
          isOpen={isCreateModalOpen}
          onClose={() => setIsCreateModalOpen(false)}
          onSuccess={() => {
            queryClient.invalidateQueries({ queryKey: ['staff'] });
            setIsCreateModalOpen(false);
          }}
        />
      )}

      {/* Edit User Modal - Only for admin/staff */}
      {!isFrontDesk && selectedStaff && (
        <EditUserModal
          isOpen={isEditModalOpen}
          onClose={() => {
            setIsEditModalOpen(false);
            setSelectedStaff(null);
          }}
          onSuccess={() => {
            queryClient.invalidateQueries({ queryKey: ['staff'] });
            setIsEditModalOpen(false);
            setSelectedStaff(null);
          }}
          user={selectedStaff as any}
        />
      )}

      {/* Delete Confirmation Modal - Only for admin/staff */}
      {!isFrontDesk && (
        <Modal
          isOpen={isDeleteModalOpen}
          onClose={() => setIsDeleteModalOpen(false)}
          title="Delete Staff Member"
        >
          <div className="space-y-4">
            <p className="text-gray-600">
              Are you sure you want to delete <strong>{selectedStaff?.name}</strong>?
              This action cannot be undone.
            </p>

            <div className="flex justify-end space-x-3">
              <Button
                variant="outline"
                onClick={() => setIsDeleteModalOpen(false)}
              >
                Cancel
              </Button>
              <Button
                variant="destructive"
                onClick={handleDeleteStaff}
                disabled={deleteStaffMutation.isPending}
              >
                {deleteStaffMutation.isPending ? 'Deleting...' : 'Delete Staff Member'}
              </Button>
            </div>
          </div>
        </Modal>
      )}
    </div>
  );
}

export default withErrorBoundary(AdminStaffManagement);
