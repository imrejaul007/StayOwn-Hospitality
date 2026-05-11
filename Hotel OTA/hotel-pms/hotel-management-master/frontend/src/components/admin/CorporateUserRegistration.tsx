import React, { useState, useEffect } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { toast } from 'react-hot-toast';
import { LoadingSpinner } from '../LoadingSpinner';
import { Button } from '@/components/ui/button';
import { Modal } from '@/components/ui/Modal';
import { Input } from '@/components/ui/input';
import { Select } from '@/components/ui/select';
import { Badge } from '@/components/ui/badge';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { DataTable } from '../dashboard/DataTable';
import { MetricCard } from '../dashboard/MetricCard';
import { formatDate } from '../../utils/formatters';
import { api } from '../../services/api';

interface CorporateUser {
  _id: string;
  name: string;
  email: string;
  phone?: string;
  role: string;
  status: 'active' | 'inactive' | 'pending';
  corporateCompanyId?: {
    _id: string;
    name: string;
  };
  department?: string;
  designation?: string;
  employeeId?: string;
  isVerified: boolean;
  registrationApproved: boolean;
  lastLoginAt?: string;
  createdAt: string;
  updatedAt: string;
}

interface CorporateCompany {
  _id: string;
  name: string;
  email: string;
  phone: string;
  gstNumber?: string;
  status: 'active' | 'inactive';
}

interface UserRegistrationForm {
  name: string;
  email: string;
  phone: string;
  password: string;
  confirmPassword: string;
  corporateCompanyId: string;
  department: string;
  designation: string;
  employeeId: string;
  role: 'guest' | 'corporate_user';
}

const CorporateUserRegistration: React.FC = () => {
  const [selectedTab, setSelectedTab] = useState('users');
  const [showRegistrationModal, setShowRegistrationModal] = useState(false);
  const [showBulkRegistrationModal, setShowBulkRegistrationModal] = useState(false);
  const [selectedUsers, setSelectedUsers] = useState<string[]>([]);
  const [filters, setFilters] = useState({
    status: 'all',
    company: 'all',
    role: 'all'
  });

  // Registration form state
  const [registrationForm, setRegistrationForm] = useState<UserRegistrationForm>({
    name: '',
    email: '',
    phone: '',
    password: '',
    confirmPassword: '',
    corporateCompanyId: '',
    department: '',
    designation: '',
    employeeId: '',
    role: 'corporate_user'
  });

  // Bulk registration state
  const [bulkUsers, setBulkUsers] = useState<Partial<UserRegistrationForm>[]>([
    { name: '', email: '', phone: '', department: '', designation: '', employeeId: '' }
  ]);
  const [selectedCompanyForBulk, setSelectedCompanyForBulk] = useState('');

  const queryClient = useQueryClient();

  // Fetch corporate users
  const { data: users, isLoading: usersLoading } = useQuery({
    queryKey: ['corporateUsers', filters],
    queryFn: async () => {
      const params = new URLSearchParams();
      Object.entries(filters).forEach(([key, value]) => {
        if (value !== 'all') params.append(key, value);
      });
      params.append('role', 'guest,corporate_user');
      
      const { data } = await api.get(`/users?${params}`);
      return data;
    }
  });

  // Fetch corporate companies
  const { data: companies, isLoading: companiesLoading } = useQuery<{ data: CorporateCompany[] }>({
    queryKey: ['corporateCompanies'],
    queryFn: async () => {
      const { data } = await api.get('/corporate/companies');
      return data;
    }
  });

  // Register user mutation
  const registerUserMutation = useMutation({
    mutationFn: async (userData: UserRegistrationForm) => {
      const { data } = await api.post('/auth/register', {
          ...userData,
          corporateDetails: {
            corporateCompanyId: userData.corporateCompanyId,
            department: userData.department,
            designation: userData.designation,
            employeeId: userData.employeeId
          }
        });
      return data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['corporateUsers'] });
      toast.success('User registered successfully');
      setShowRegistrationModal(false);
      resetRegistrationForm();
    },
    onError: (error) => {
      toast.error(error instanceof Error ? error.message : 'Failed to register user');
    }
  });

  // Bulk register users mutation
  const bulkRegisterMutation = useMutation({
    mutationFn: async ({ users, companyId }: { users: Partial<UserRegistrationForm>[]; companyId: string }) => {
      const { data } = await api.post('/auth/bulk-register', {
          users: users.map(user => ({
            ...user,
            role: 'corporate_user',
            corporateCompanyId: companyId,
            password: 'TempPass123!' // Temporary password
          }))
        });
      return data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['corporateUsers'] });
      toast.success('Users registered successfully');
      setShowBulkRegistrationModal(false);
      resetBulkRegistration();
    },
    onError: (error) => {
      toast.error(error instanceof Error ? error.message : 'Failed to bulk register users');
    }
  });

  // Approve user mutation
  const approveUserMutation = useMutation({
    mutationFn: async (userId: string) => {
      const { data } = await api.patch(`/users/${userId}/approve`);
      return data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['corporateUsers'] });
      toast.success('User approved successfully');
    },
    onError: (error) => {
      toast.error(error instanceof Error ? error.message : 'Failed to approve user');
    }
  });

  // Deactivate user mutation
  const deactivateUserMutation = useMutation({
    mutationFn: async (userId: string) => {
      const { data } = await api.patch(`/users/${userId}/deactivate`);
      return data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['corporateUsers'] });
      toast.success('User deactivated successfully');
    },
    onError: (error) => {
      toast.error(error instanceof Error ? error.message : 'Failed to deactivate user');
    }
  });

  // Send welcome email mutation
  const sendWelcomeEmailMutation = useMutation({
    mutationFn: async (userId: string) => {
      const { data } = await api.post(`/users/${userId}/send-welcome-email`);
      return data;
    },
    onSuccess: () => {
      toast.success('Welcome email sent successfully');
    },
    onError: (error) => {
      toast.error(error instanceof Error ? error.message : 'Failed to send welcome email');
    }
  });

  const resetRegistrationForm = () => {
    setRegistrationForm({
      name: '',
      email: '',
      phone: '',
      password: '',
      confirmPassword: '',
      corporateCompanyId: '',
      department: '',
      designation: '',
      employeeId: '',
      role: 'corporate_user'
    });
  };

  const resetBulkRegistration = () => {
    setBulkUsers([{ name: '', email: '', phone: '', department: '', designation: '', employeeId: '' }]);
    setSelectedCompanyForBulk('');
  };

  const addBulkUser = () => {
    setBulkUsers([...bulkUsers, { name: '', email: '', phone: '', department: '', designation: '', employeeId: '' }]);
  };

  const removeBulkUser = (index: number) => {
    setBulkUsers(bulkUsers.filter((_, i) => i !== index));
  };

  const updateBulkUser = (index: number, field: keyof UserRegistrationForm, value: string) => {
    const updatedUsers = bulkUsers.map((user, i) => 
      i === index ? { ...user, [field]: value } : user
    );
    setBulkUsers(updatedUsers);
  };

  const handleRegistrationSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    
    if (registrationForm.password !== registrationForm.confirmPassword) {
      toast.error('Passwords do not match');
      return;
    }
    
    if (registrationForm.password.length < 6) {
      toast.error('Password must be at least 6 characters');
      return;
    }
    
    registerUserMutation.mutate(registrationForm);
  };

  const handleBulkRegistration = () => {
    const validUsers = bulkUsers.filter(user => 
      user.name && user.email && user.name.trim() && user.email.trim()
    );
    
    if (validUsers.length === 0) {
      toast.error('Please add at least one valid user');
      return;
    }
    
    if (!selectedCompanyForBulk) {
      toast.error('Please select a company');
      return;
    }
    
    bulkRegisterMutation.mutate({ 
      users: validUsers as Partial<UserRegistrationForm>[], 
      companyId: selectedCompanyForBulk 
    });
  };

  const getStatusColor = (status: string) => {
    switch (status) {
      case 'active': return 'bg-green-100 text-green-800';
      case 'inactive': return 'bg-red-100 text-red-800';
      case 'pending': return 'bg-yellow-100 text-yellow-800';
      default: return 'bg-gray-100 text-gray-800';
    }
  };

  if (usersLoading || companiesLoading) {
    return (
      <div className="flex items-center justify-center h-64">
        <LoadingSpinner />
      </div>
    );
  }

  const userColumns = [
    {
      header: 'Name',
      accessor: (user: CorporateUser) => user.name
    },
    {
      header: 'Email',
      accessor: (user: CorporateUser) => user.email
    },
    {
      header: 'Company',
      accessor: (user: CorporateUser) => user.corporateCompanyId?.name || 'No Company'
    },
    {
      header: 'Department',
      accessor: (user: CorporateUser) => user.department || 'N/A'
    },
    {
      header: 'Designation',
      accessor: (user: CorporateUser) => user.designation || 'N/A'
    },
    {
      header: 'Employee ID',
      accessor: (user: CorporateUser) => user.employeeId || 'N/A'
    },
    {
      header: 'Status',
      accessor: (user: CorporateUser) => (
        <Badge className={getStatusColor(user.status)}>
          {user.status}
        </Badge>
      )
    },
    {
      header: 'Verified',
      accessor: (user: CorporateUser) => (
        <Badge className={user.isVerified ? 'bg-green-100 text-green-800' : 'bg-red-100 text-red-800'}>
          {user.isVerified ? 'Verified' : 'Unverified'}
        </Badge>
      )
    },
    {
      header: 'Registered',
      accessor: (user: CorporateUser) => formatDate(user.createdAt)
    },
    {
      header: 'Actions',
      accessor: (user: CorporateUser) => (
        <div className="flex space-x-2">
          {!user.registrationApproved && (
            <Button
              variant="outline"
              size="sm"
              onClick={() => approveUserMutation.mutate(user._id)}
              disabled={approveUserMutation.isPending}
            >
              Approve
            </Button>
          )}
          <Button
            variant="outline"
            size="sm"
            onClick={() => user.status === 'active' 
              ? deactivateUserMutation.mutate(user._id)
              : approveUserMutation.mutate(user._id)
            }
            disabled={deactivateUserMutation.isPending || approveUserMutation.isPending}
          >
            {user.status === 'active' ? 'Deactivate' : 'Activate'}
          </Button>
          <Button
            variant="outline"
            size="sm"
            onClick={() => sendWelcomeEmailMutation.mutate(user._id)}
            disabled={sendWelcomeEmailMutation.isPending}
          >
            Send Email
          </Button>
        </div>
      )
    }
  ];

  const corporateUsers = users?.data?.filter((user: Record<string, unknown>) => 
    user.role === 'guest' && user.corporateCompanyId
  ) || [];

  const pendingUsers = corporateUsers.filter((user: CorporateUser) => !user.registrationApproved);
  const activeUsers = corporateUsers.filter((user: CorporateUser) => user.status === 'active');

  return (
    <div className="space-y-6">
      <div className="flex justify-between items-center">
        <h1 className="text-2xl font-bold">Corporate User Registration</h1>
        <div className="flex space-x-3">
          <Button onClick={() => setShowBulkRegistrationModal(true)}>
            Bulk Registration
          </Button>
          <Button onClick={() => setShowRegistrationModal(true)}>
            Register New User
          </Button>
        </div>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
        <MetricCard
          title="Total Corporate Users"
          value={corporateUsers.length}
          icon="👥"
          trend={{
            value: 12,
            isPositive: true,
            label: "this month"
          }}
        />
        <MetricCard
          title="Pending Approval"
          value={pendingUsers.length}
          icon="⏳"
          trend={{
            value: 3,
            isPositive: false,
            label: "awaiting approval"
          }}
        />
        <MetricCard
          title="Active Users"
          value={activeUsers.length}
          icon="✅"
          trend={{
            value: 8.5,
            isPositive: true,
            label: "vs last month"
          }}
        />
        <MetricCard
          title="Companies Registered"
          value={companies?.data?.length || 0}
          icon="🏢"
          trend={{
            value: 2,
            isPositive: true,
            label: "new companies"
          }}
        />
      </div>

      <Tabs value={selectedTab} onValueChange={setSelectedTab}>
        <TabsList>
          <TabsTrigger value="users">Corporate Users</TabsTrigger>
          <TabsTrigger value="pending">Pending Approval ({pendingUsers.length})</TabsTrigger>
          <TabsTrigger value="companies">Companies</TabsTrigger>
        </TabsList>

        <TabsContent value="users" className="space-y-6">
          <div className="flex justify-between items-center">
            <div className="flex space-x-4">
              <Select
                value={filters.status}
                onValueChange={(value) => setFilters(prev => ({ ...prev, status: value }))}
              >
                <option value="all">All Status</option>
                <option value="active">Active</option>
                <option value="inactive">Inactive</option>
                <option value="pending">Pending</option>
              </Select>
              <Select
                value={filters.company}
                onValueChange={(value) => setFilters(prev => ({ ...prev, company: value }))}
              >
                <option value="all">All Companies</option>
                {companies?.data?.map((company) => (
                  <option key={company._id} value={company._id}>
                    {company.name}
                  </option>
                ))}
              </Select>
            </div>
          </div>

          <Card>
            <CardContent>
              <DataTable
                columns={userColumns}
                data={corporateUsers}
                searchPlaceholder="Search users..."
                onSelectionChange={setSelectedUsers}
                selectable={true}
              />
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="pending" className="space-y-6">
          <Card>
            <CardHeader>
              <CardTitle>Users Pending Approval</CardTitle>
            </CardHeader>
            <CardContent>
              {pendingUsers.length === 0 ? (
                <div className="text-center py-8 text-gray-500">
                  No users pending approval
                </div>
              ) : (
                <DataTable
                  columns={userColumns}
                  data={pendingUsers}
                  searchPlaceholder="Search pending users..."
                />
              )}
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="companies" className="space-y-6">
          <Card>
            <CardContent>
              <div className="grid gap-4">
                {companies?.data?.map((company) => (
                  <div key={company._id} className="flex justify-between items-center p-4 border rounded-lg">
                    <div>
                      <div className="font-medium">{company.name}</div>
                      <div className="text-sm text-gray-600">{company.email}</div>
                      {company.gstNumber && (
                        <div className="text-xs text-gray-500">GST: {company.gstNumber}</div>
                      )}
                    </div>
                    <div className="text-right">
                      <div className="text-sm font-medium">
                        {corporateUsers.filter(user => user.corporateCompanyId?._id === company._id).length} Users
                      </div>
                      <Badge className={getStatusColor(company.status)}>
                        {company.status}
                      </Badge>
                    </div>
                  </div>
                ))}
              </div>
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>

      {/* User Registration Modal */}
      <Modal 
        isOpen={showRegistrationModal} 
        onClose={() => setShowRegistrationModal(false)} 
        title="Register Corporate User"
        size="lg"
      >
        <form onSubmit={handleRegistrationSubmit} className="space-y-4">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <Input
              placeholder="Full Name"
              value={registrationForm.name}
              onChange={(e) => setRegistrationForm(prev => ({ ...prev, name: e.target.value }))}
              required
            />
            <Input
              type="email"
              placeholder="Email Address"
              value={registrationForm.email}
              onChange={(e) => setRegistrationForm(prev => ({ ...prev, email: e.target.value }))}
              required
            />
            <Input
              type="tel"
              placeholder="Phone Number"
              value={registrationForm.phone}
              onChange={(e) => setRegistrationForm(prev => ({ ...prev, phone: e.target.value }))}
            />
            <Select
              value={registrationForm.corporateCompanyId}
              onValueChange={(value) => setRegistrationForm(prev => ({ ...prev, corporateCompanyId: value }))}
              required
            >
              <option value="">Select Company</option>
              {companies?.data?.map((company) => (
                <option key={company._id} value={company._id}>
                  {company.name}
                </option>
              ))}
            </Select>
            <Input
              placeholder="Department"
              value={registrationForm.department}
              onChange={(e) => setRegistrationForm(prev => ({ ...prev, department: e.target.value }))}
            />
            <Input
              placeholder="Designation"
              value={registrationForm.designation}
              onChange={(e) => setRegistrationForm(prev => ({ ...prev, designation: e.target.value }))}
            />
            <Input
              placeholder="Employee ID"
              value={registrationForm.employeeId}
              onChange={(e) => setRegistrationForm(prev => ({ ...prev, employeeId: e.target.value }))}
            />
            <Select
              value={registrationForm.role}
              onValueChange={(value) => setRegistrationForm(prev => ({ ...prev, role: value as 'guest' | 'corporate_user' }))}
            >
              <option value="corporate_user">Corporate User</option>
              <option value="guest">Guest</option>
            </Select>
            <Input
              type="password"
              placeholder="Password"
              value={registrationForm.password}
              onChange={(e) => setRegistrationForm(prev => ({ ...prev, password: e.target.value }))}
              required
            />
            <Input
              type="password"
              placeholder="Confirm Password"
              value={registrationForm.confirmPassword}
              onChange={(e) => setRegistrationForm(prev => ({ ...prev, confirmPassword: e.target.value }))}
              required
            />
          </div>

          <div className="flex justify-end space-x-3">
            <Button type="button" variant="outline" onClick={() => setShowRegistrationModal(false)}>
              Cancel
            </Button>
            <Button type="submit" disabled={registerUserMutation.isPending}>
              {registerUserMutation.isPending ? 'Registering...' : 'Register User'}
            </Button>
          </div>
        </form>
      </Modal>

      {/* Bulk Registration Modal */}
      <Modal 
        isOpen={showBulkRegistrationModal} 
        onClose={() => setShowBulkRegistrationModal(false)} 
        title="Bulk User Registration"
        size="xl"
      >
        <div className="space-y-4">
          <div>
            <label className="block text-sm font-medium mb-1">Select Company</label>
            <Select
              value={selectedCompanyForBulk}
              onValueChange={setSelectedCompanyForBulk}
              required
            >
              <option value="">Select Company</option>
              {companies?.data?.map((company) => (
                <option key={company._id} value={company._id}>
                  {company.name}
                </option>
              ))}
            </Select>
          </div>

          <div className="space-y-4 max-h-96 overflow-y-auto">
            <h4 className="font-medium">Users to Register</h4>
            {bulkUsers.map((user, index) => (
              <div key={`bulkUsers-${index}-${user.name}`} className="grid grid-cols-6 gap-4 p-4 border rounded-lg">
                <Input
                  placeholder="Name"
                  value={user.name || ''}
                  onChange={(e) => updateBulkUser(index, 'name', e.target.value)}
                />
                <Input
                  type="email"
                  placeholder="Email"
                  value={user.email || ''}
                  onChange={(e) => updateBulkUser(index, 'email', e.target.value)}
                />
                <Input
                  placeholder="Phone"
                  value={user.phone || ''}
                  onChange={(e) => updateBulkUser(index, 'phone', e.target.value)}
                />
                <Input
                  placeholder="Department"
                  value={user.department || ''}
                  onChange={(e) => updateBulkUser(index, 'department', e.target.value)}
                />
                <Input
                  placeholder="Designation"
                  value={user.designation || ''}
                  onChange={(e) => updateBulkUser(index, 'designation', e.target.value)}
                />
                <div className="flex items-center">
                  <Button
                    type="button"
                    variant="outline"
                    size="sm"
                    onClick={() => removeBulkUser(index)}
                    disabled={bulkUsers.length === 1}
                  >
                    Remove
                  </Button>
                </div>
              </div>
            ))}
          </div>

          <Button type="button" variant="outline" onClick={addBulkUser}>
            Add User
          </Button>

          <div className="text-sm text-gray-600 bg-blue-50 p-3 rounded">
            Note: Users will be registered with temporary password "TempPass123!" and will receive welcome emails.
          </div>

          <div className="flex justify-end space-x-3">
            <Button type="button" variant="outline" onClick={() => setShowBulkRegistrationModal(false)}>
              Cancel
            </Button>
            <Button 
              onClick={handleBulkRegistration} 
              disabled={bulkRegisterMutation.isPending}
            >
              {bulkRegisterMutation.isPending ? 'Registering...' : 'Register Users'}
            </Button>
          </div>
        </div>
      </Modal>
    </div>
  );
};

export default CorporateUserRegistration;