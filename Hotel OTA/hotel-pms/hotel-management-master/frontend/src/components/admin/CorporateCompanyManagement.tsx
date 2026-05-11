import React, { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import {
  Building2,
  Plus,
  Search,
  Edit,
  Trash2,
  Phone,
  Mail,
  MapPin,
  CreditCard,
  Calendar,
  AlertTriangle,
  CheckCircle,
  X,
  Save,
  Users,
  TrendingUp,
  IndianRupee,
  BarChart3,
  Activity,
  PieChart,
  Power,
  PowerOff
} from 'lucide-react';
import {
  PieChart as RechartsPieChart,
  Pie as RechartsPie,
  Cell,
  BarChart,
  Bar as RechartsBar,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip as RechartsTooltip,
  Legend as RechartsLegend,
  ResponsiveContainer,
} from 'recharts';
import { cn } from '../../utils/cn';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { LoadingSpinner } from '../LoadingSpinner';
import { formatCurrency, formatDate } from '../../utils/dashboardUtils';
import { corporateService } from '../../services/corporateService';
import {
  validateCompanyForm,
  parseBackendErrors,
  formatGST,
  formatPAN,
  formatPhone,
  validateEmail,
  validateGST,
  validatePAN,
  validatePhone,
  validateZIP,
  type FieldValidationErrors
} from '../../utils/corporateValidators';
import toast from 'react-hot-toast';
import { api } from '../../services/api';
import { withErrorBoundary } from '../ErrorBoundary';

interface CorporateCompany {
  _id: string;
  name: string;
  email: string;
  phone?: string;
  gstNumber: string;
  panNumber?: string;
  address: {
    street: string;
    city: string;
    state: string;
    country: string;
    zipCode: string;
  };
  creditLimit: number;
  paymentTerms: number;
  hrContacts: Array<{
    _id?: string;
    name: string;
    email: string;
    phone?: string;
    designation?: string;
    isPrimary: boolean;
  }>;
  contractDetails?: {
    contractNumber?: string;
    contractStartDate?: Date;
    contractEndDate?: Date;
    discountPercentage?: number;
    specialTerms?: string;
  };
  billingCycle: string;
  isActive: boolean;
  createdAt: string;
  updatedAt: string;
}

interface CompanyFormData {
  name: string;
  email: string;
  phone: string;
  gstNumber: string;
  panNumber: string;
  address: {
    street: string;
    city: string;
    state: string;
    country: string;
    zipCode: string;
  };
  creditLimit: number;
  paymentTerms: number;
  hrContacts: Array<{
    name: string;
    email: string;
    phone: string;
    designation: string;
    isPrimary: boolean;
  }>;
  contractDetails: {
    contractNumber: string;
    contractStartDate: string;
    contractEndDate: string;
    discountPercentage: number;
    specialTerms: string;
  };
  billingCycle: string;
}

const initialFormData: CompanyFormData = {
  name: '',
  email: '',
  phone: '',
  gstNumber: '',
  panNumber: '',
  address: {
    street: '',
    city: '',
    state: '',
    country: 'India',
    zipCode: '',
  },
  creditLimit: 100000,
  paymentTerms: 30,
  hrContacts: [{
    name: '',
    email: '',
    phone: '',
    designation: '',
    isPrimary: true
  }],
  contractDetails: {
    contractNumber: '',
    contractStartDate: '',
    contractEndDate: '',
    discountPercentage: 0,
    specialTerms: ''
  },
  billingCycle: 'monthly'
};

// API functions
const fetchCorporateCompanies = async (page = 1, limit = 20): Promise<{ companies: CorporateCompany[]; pagination?: { page: number; limit: number; totalCount: number; totalPages: number } }> => {
  try {
    const response = await api.get(`/corporate/companies?page=${page}&limit=${limit}`);
    return response.data.data;
  } catch (error: unknown) {
    throw error instanceof Error ? error : new Error('Failed to fetch corporate companies');
  }
};

const createCorporateCompany = async (companyData: CompanyFormData): Promise<CorporateCompany> => {
  try {
    const { data } = await api.post('/corporate/companies', companyData);
    return data.data.company;
  } catch (error: unknown) {
    throw error instanceof Error ? error : new Error('Failed to create corporate company');
  }
};

const updateCorporateCompany = async ({ id, ...companyData }: CompanyFormData & { id: string }): Promise<CorporateCompany> => {
  try {
    const { data } = await api.patch(`/corporate/companies/${id}`, companyData);
    return data.data.company;
  } catch (error: unknown) {
    throw error instanceof Error ? error : new Error('Failed to update corporate company');
  }
};

const deleteCorporateCompany = async (id: string): Promise<void> => {
  try {
    await api.delete(`/corporate/companies/${id}`);
  } catch (error: unknown) {
    throw error instanceof Error ? error : new Error('Failed to delete corporate company');
  }
};

const toggleCompanyStatus = async (id: string): Promise<CorporateCompany> => {
  try {
    const { data } = await api.patch(`/corporate/companies/${id}/toggle-status`);
    return data.data.company;
  } catch (error: unknown) {
    throw error instanceof Error ? error : new Error('Failed to toggle company status');
  }
};

const CompanyRowInfo = React.memo(({ company }: { company: CorporateCompany }) => (
  <>
    <td className="px-6 py-4 whitespace-nowrap">
      <div className="flex items-center">
        <div className="flex-shrink-0 h-10 w-10 bg-blue-100 rounded-lg flex items-center justify-center">
          <Building2 className="h-6 w-6 text-blue-600" />
        </div>
        <div className="ml-4">
          <div className="text-sm font-medium text-gray-900">{company.name}</div>
          <div className="text-sm text-gray-500">GST: {company.gstNumber}</div>
        </div>
      </div>
    </td>
    <td className="px-6 py-4 whitespace-nowrap">
      <div className="text-sm text-gray-900 flex items-center">
        <Mail className="h-4 w-4 mr-1 text-gray-400" />
        {company.email}
      </div>
      {company.phone && (
        <div className="text-sm text-gray-500 flex items-center mt-1">
          <Phone className="h-4 w-4 mr-1 text-gray-400" />
          {company.phone}
        </div>
      )}
    </td>
    <td className="px-6 py-4 whitespace-nowrap">
      <div className="text-sm text-gray-900">Limit: {formatCurrency(company.creditLimit)}</div>
      <div className="text-sm text-gray-500">Terms: {company.paymentTerms} days</div>
    </td>
    <td className="px-6 py-4 whitespace-nowrap">
      <Badge
        variant={company.isActive ? "success" : "secondary"}
        className="flex items-center"
      >
        {company.isActive ? (
          <CheckCircle className="w-3 h-3 mr-1" />
        ) : (
          <AlertTriangle className="w-3 h-3 mr-1" />
        )}
        {company.isActive ? 'Active' : 'Inactive'}
      </Badge>
    </td>
  </>
));
CompanyRowInfo.displayName = 'CompanyRowInfo';

function CorporateCompanyManagement({ readOnly = false }: { readOnly?: boolean } = {}) {
  const [showForm, setShowForm] = useState(false);
  const [editingCompany, setEditingCompany] = useState<CorporateCompany | null>(null);
  const [searchTerm, setSearchTerm] = useState('');
  const [formData, setFormData] = useState<CompanyFormData>(initialFormData);
  const [formErrors, setFormErrors] = useState<FieldValidationErrors>({});
  const [currentPage, setCurrentPage] = useState(1);
  const PAGE_SIZE = 20;

  const queryClient = useQueryClient();

  // Fetch companies with server-side pagination
  const {
    data: companiesData,
    isLoading,
    error,
    refetch
  } = useQuery({
    queryKey: ['corporate-companies', currentPage],
    queryFn: () => fetchCorporateCompanies(currentPage, PAGE_SIZE),
    keepPreviousData: true,
  });

  // Fetch dashboard metrics
  const {
    data: metricsData,
    isLoading: metricsLoading,
    error: metricsError
  } = useQuery({
    queryKey: ['corporate-dashboard-metrics'],
    queryFn: () => corporateService.getDashboardMetrics(),
    refetchInterval: 30000, // Refresh every 30 seconds
  });

  // Create company mutation
  const createMutation = useMutation({
    mutationFn: createCorporateCompany,
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['corporate-companies'] });
      toast.success('Corporate company created successfully');
      setShowForm(false);
      setFormData(initialFormData);
      setFormErrors({});
    },
    onError: (error: unknown) => {
      const backendErrors = parseBackendErrors(error);
      if (backendErrors.general) {
        toast.error(backendErrors.general);
      } else {
        setFormErrors(backendErrors);
        toast.error('Please fix the form errors and try again');
      }
    },
  });

  // Update company mutation
  const updateMutation = useMutation({
    mutationFn: updateCorporateCompany,
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['corporate-companies'] });
      toast.success('Corporate company updated successfully');
      setShowForm(false);
      setEditingCompany(null);
      setFormData(initialFormData);
      setFormErrors({});
    },
    onError: (error: unknown) => {
      const backendErrors = parseBackendErrors(error);
      if (backendErrors.general) {
        toast.error(backendErrors.general);
      } else {
        setFormErrors(backendErrors);
        toast.error('Please fix the form errors and try again');
      }
    },
  });

  // Delete company mutation
  const deleteMutation = useMutation({
    mutationFn: deleteCorporateCompany,
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['corporate-companies'] });
      toast.success('Corporate company deleted successfully');
    },
    onError: (error: Error) => {
      toast.error(error.message);
    },
  });

  // Toggle status mutation
  const toggleStatusMutation = useMutation({
    mutationFn: toggleCompanyStatus,
    onSuccess: (updatedCompany) => {
      queryClient.invalidateQueries({ queryKey: ['corporate-companies'] });
      const statusText = updatedCompany.isActive ? 'activated' : 'deactivated';
      toast.success(`Company ${statusText} successfully`);
    },
    onError: (error: Error) => {
      toast.error(error.message);
    },
  });

  const companies = companiesData?.companies || [];

  // Filter companies based on search term
  const filteredCompanies = companies.filter(company =>
    company.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
    company.email.toLowerCase().includes(searchTerm.toLowerCase()) ||
    company.gstNumber.includes(searchTerm)
  );

  const handleCreateCompany = () => {
    setEditingCompany(null);
    setFormData(initialFormData);
    setFormErrors({});
    setShowForm(true);
  };

  const handleEditCompany = (company: CorporateCompany) => {
    setEditingCompany(company);
    setFormData({
      name: company.name,
      email: company.email,
      phone: company.phone || '',
      gstNumber: company.gstNumber,
      panNumber: company.panNumber || '',
      address: company.address,
      creditLimit: company.creditLimit,
      paymentTerms: company.paymentTerms,
      hrContacts: company.hrContacts.length > 0 ? company.hrContacts.map(contact => ({
        name: contact.name,
        email: contact.email,
        phone: contact.phone || '',
        designation: contact.designation || '',
        isPrimary: contact.isPrimary
      })) : initialFormData.hrContacts,
      contractDetails: company.contractDetails ? {
        contractNumber: company.contractDetails.contractNumber || '',
        contractStartDate: company.contractDetails.contractStartDate ? 
          new Date(company.contractDetails.contractStartDate).toISOString().split('T')[0] : '',
        contractEndDate: company.contractDetails.contractEndDate ? 
          new Date(company.contractDetails.contractEndDate).toISOString().split('T')[0] : '',
        discountPercentage: company.contractDetails.discountPercentage || 0,
        specialTerms: company.contractDetails.specialTerms || ''
      } : initialFormData.contractDetails,
      billingCycle: company.billingCycle
    });
    setFormErrors({});
    setShowForm(true);
  };

  const handleToggleStatus = async (company: CorporateCompany) => {
    const action = company.isActive ? 'deactivate' : 'activate';
    const message = company.isActive
      ? `Are you sure you want to deactivate ${company.name}? This will prevent new bookings.`
      : `Are you sure you want to activate ${company.name}?`;

    if (window.confirm(message)) {
      toggleStatusMutation.mutate(company._id);
    }
  };

  const handleAddHRContact = () => {
    setFormData(prev => ({
      ...prev,
      hrContacts: [
        ...prev.hrContacts,
        {
          name: '',
          email: '',
          phone: '',
          designation: '',
          isPrimary: false
        }
      ]
    }));
  };

  const handleRemoveHRContact = (index: number) => {
    if (formData.hrContacts.length > 1) {
      setFormData(prev => ({
        ...prev,
        hrContacts: prev.hrContacts.filter((_, i) => i !== index)
      }));
    }
  };

  const handleHRContactChange = (index: number, field: string, value: unknown) => {
    setFormData(prev => ({
      ...prev,
      hrContacts: prev.hrContacts.map((contact, i) =>
        i === index ? { ...contact, [field]: value } : contact
      )
    }));
  };

  const validateForm = (): boolean => {
    const errors = validateCompanyForm(formData);
    setFormErrors(errors);
    return Object.keys(errors).length === 0;
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    
    if (!validateForm()) {
      toast.error('Please fix the form errors');
      return;
    }

    if (editingCompany) {
      updateMutation.mutate({ ...formData, id: editingCompany._id });
    } else {
      createMutation.mutate(formData);
    }
  };

  const handleCloseForm = () => {
    setShowForm(false);
    setEditingCompany(null);
    setFormData(initialFormData);
    setFormErrors({});
  };

  if (isLoading) {
    return (
      <div className="flex justify-center items-center min-h-[400px]">
        <LoadingSpinner size="large" />
      </div>
    );
  }

  if (error) {
    return (
      <div className="text-center py-12">
        <AlertTriangle className="mx-auto h-12 w-12 text-red-500 mb-4" />
        <h3 className="text-lg font-medium text-gray-900 mb-2">Failed to load companies</h3>
        <p className="text-gray-500 mb-4">There was an error loading the corporate companies.</p>
        <Button onClick={() => refetch()}>Try Again</Button>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex justify-between items-center">
        <div>
          <h2 className="text-2xl font-bold text-gray-900">Corporate Companies</h2>
          <p className="text-gray-600">Manage corporate clients and their information</p>
        </div>
        {!readOnly && (
          <Button onClick={handleCreateCompany} className="flex items-center">
            <Plus className="w-4 h-4 mr-2" />
            Add Company
          </Button>
        )}
      </div>

      {/* Overview Metrics */}
      {metricsLoading ? (
        <div className="grid grid-cols-1 md:grid-cols-4 gap-6">
          {[...Array(4)].map((_, i) => (
            <div key={i} className="bg-white p-6 rounded-lg border border-gray-200">
              <div className="animate-pulse">
                <div className="h-4 bg-gray-200 rounded mb-2"></div>
                <div className="h-8 bg-gray-200 rounded mb-2"></div>
                <div className="h-3 bg-gray-200 rounded w-1/2"></div>
              </div>
            </div>
          ))}
        </div>
      ) : metricsError ? (
        <div className="bg-red-50 border border-red-200 rounded-lg p-4">
          <p className="text-red-600">Failed to load metrics. Using cached data where available.</p>
        </div>
      ) : metricsData?.data ? (
        <div className="grid grid-cols-1 md:grid-cols-4 gap-6">
          <div className="bg-white p-6 rounded-lg border border-gray-200">
            <div className="flex items-center">
              <div className="bg-blue-500 p-3 rounded-lg">
                <Building2 className="w-6 h-6 text-white" />
              </div>
              <div className="ml-4">
                <p className="text-sm font-medium text-gray-500">Total Companies</p>
                <p className="text-2xl font-bold text-gray-900">
                  {metricsData.data.overview.totalCompanies}
                </p>
              </div>
            </div>
          </div>

          <div className="bg-white p-6 rounded-lg border border-gray-200">
            <div className="flex items-center">
              <div className="bg-green-500 p-3 rounded-lg">
                <IndianRupee className="w-6 h-6 text-white" />
              </div>
              <div className="ml-4">
                <p className="text-sm font-medium text-gray-500">Total Credit Limit</p>
                <p className="text-2xl font-bold text-gray-900">
                  {formatCurrency(metricsData.data.overview.totalCreditLimit)}
                </p>
              </div>
            </div>
          </div>

          <div className="bg-white p-6 rounded-lg border border-gray-200">
            <div className="flex items-center">
              <div className="bg-orange-500 p-3 rounded-lg">
                <TrendingUp className="w-6 h-6 text-white" />
              </div>
              <div className="ml-4">
                <p className="text-sm font-medium text-gray-500">Credit Utilization</p>
                <p className="text-2xl font-bold text-gray-900">
                  {(metricsData.data.overview.averageUtilization ?? 0).toFixed(1)}%
                </p>
                <p className="text-sm text-gray-500">
                  {formatCurrency(metricsData.data.overview.totalUsedCredit)} used
                </p>
              </div>
            </div>
          </div>

          <div className="bg-white p-6 rounded-lg border border-gray-200">
            <div className="flex items-center">
              <div className={cn(
                "p-3 rounded-lg",
                metricsData.data.overview.lowCreditAlerts > 0 ? "bg-red-500" : "bg-gray-500"
              )}>
                {metricsData.data.overview.lowCreditAlerts > 0 ? (
                  <AlertTriangle className="w-6 h-6 text-white" />
                ) : (
                  <CheckCircle className="w-6 h-6 text-white" />
                )}
              </div>
              <div className="ml-4">
                <p className="text-sm font-medium text-gray-500">Low Credit Alerts</p>
                <p className="text-2xl font-bold text-gray-900">
                  {metricsData.data.overview.lowCreditAlerts}
                </p>
                <p className="text-sm text-gray-500">
                  {metricsData.data.overview.companiesWithActiveCredit} with active credit
                </p>
              </div>
            </div>
          </div>
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-4 gap-6">
          <div className="bg-white p-6 rounded-lg border border-gray-200">
            <div className="flex items-center">
              <div className="bg-gray-300 p-3 rounded-lg">
                <Building2 className="w-6 h-6 text-white" />
              </div>
              <div className="ml-4">
                <p className="text-sm font-medium text-gray-500">Total Companies</p>
                <p className="text-2xl font-bold text-gray-900">
                  {filteredCompanies.length}
                </p>
              </div>
            </div>
          </div>
          <div className="bg-white p-6 rounded-lg border border-gray-200">
            <div className="flex items-center">
              <div className="bg-gray-300 p-3 rounded-lg">
                <IndianRupee className="w-6 h-6 text-white" />
              </div>
              <div className="ml-4">
                <p className="text-sm font-medium text-gray-500">Total Credit Limit</p>
                <p className="text-2xl font-bold text-gray-900">Loading...</p>
              </div>
            </div>
          </div>
          <div className="bg-white p-6 rounded-lg border border-gray-200">
            <div className="flex items-center">
              <div className="bg-gray-300 p-3 rounded-lg">
                <TrendingUp className="w-6 h-6 text-white" />
              </div>
              <div className="ml-4">
                <p className="text-sm font-medium text-gray-500">Credit Utilization</p>
                <p className="text-2xl font-bold text-gray-900">Loading...</p>
              </div>
            </div>
          </div>
          <div className="bg-white p-6 rounded-lg border border-gray-200">
            <div className="flex items-center">
              <div className="bg-gray-300 p-3 rounded-lg">
                <Activity className="w-6 h-6 text-white" />
              </div>
              <div className="ml-4">
                <p className="text-sm font-medium text-gray-500">Low Credit Alerts</p>
                <p className="text-2xl font-bold text-gray-900">Loading...</p>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Analytics Charts */}
      {metricsData?.data && !metricsLoading && (
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          {/* Credit Utilization Distribution */}
          <div className="bg-white p-6 rounded-lg border border-gray-200">
            <div className="flex items-center mb-4">
              <PieChart className="w-5 h-5 mr-2 text-blue-600" />
              <h3 className="text-lg font-semibold text-gray-900">Credit Utilization Distribution</h3>
            </div>
            {metricsData.data.utilizationDistribution.length > 0 ? (
              <div className="h-64">
                <ResponsiveContainer width="100%" height="100%">
                  <RechartsPieChart>
                    <RechartsPie
                      data={metricsData.data.utilizationDistribution.map((item, index) => ({
                        name: item._id,
                        value: item.count,
                        totalUsedCredit: item.totalUsedCredit,
                        fill: ['#10b981', '#f59e0b', '#f97316', '#ef4444', '#991b1b'][index % 5],
                      }))}
                      dataKey="value"
                      nameKey="name"
                      cx="50%"
                      cy="50%"
                      outerRadius="80%"
                      strokeWidth={2}
                      stroke="#fff"
                    >
                      {metricsData.data.utilizationDistribution.map((_item, index) => (
                        <Cell
                          key={`cell-${index}`}
                          fill={['#10b981', '#f59e0b', '#f97316', '#ef4444', '#991b1b'][index % 5]}
                        />
                      ))}
                    </RechartsPie>
                    <RechartsTooltip
                      formatter={(value: number, name: string, props: Record<string, unknown>) => {
                        const item = props.payload;
                        return [`${item.value} companies (${formatCurrency(item.totalUsedCredit)} used)`, name];
                      }}
                    />
                    <RechartsLegend verticalAlign="bottom" />
                  </RechartsPieChart>
                </ResponsiveContainer>
              </div>
            ) : (
              <div className="h-64 flex items-center justify-center text-gray-500">
                <div className="text-center">
                  <PieChart className="w-8 h-8 mx-auto mb-2 text-gray-300" />
                  <p>No utilization data available</p>
                </div>
              </div>
            )}
          </div>

          {/* Top Company Performance */}
          <div className="bg-white p-6 rounded-lg border border-gray-200">
            <div className="flex items-center mb-4">
              <BarChart3 className="w-5 h-5 mr-2 text-green-600" />
              <h3 className="text-lg font-semibold text-gray-900">Top Company Performance</h3>
            </div>
            {metricsData.data.companyPerformance.length > 0 ? (
              <div className="h-64">
                <ResponsiveContainer width="100%" height="100%">
                  <BarChart
                    data={metricsData.data.companyPerformance.map(company => ({
                      name: company.name.length > 15
                        ? company.name.substring(0, 15) + '...'
                        : company.name,
                      usedCredit: company.usedCredit,
                      availableCredit: company.availableCredit,
                      utilizationRate: company.utilizationRate,
                    }))}
                    margin={{ top: 5, right: 30, left: 20, bottom: 5 }}
                  >
                    <CartesianGrid strokeDasharray="3 3" opacity={0.3} />
                    <XAxis dataKey="name" tick={{ fontSize: 11 }} />
                    <YAxis
                      tick={{ fontSize: 11 }}
                      tickFormatter={(value) => `₹${(value / 1000).toFixed(0)}K`}
                    />
                    <RechartsTooltip
                      formatter={(value: number, name: string, props: Record<string, unknown>) => {
                        const item = props.payload;
                        if (name === 'usedCredit') {
                          return [`${formatCurrency(value)} (${(item.utilizationRate ?? 0).toFixed(1)}%)`, 'Used Credit'];
                        }
                        return [formatCurrency(value), 'Available Credit'];
                      }}
                    />
                    <RechartsLegend verticalAlign="top" align="right" />
                    <RechartsBar dataKey="usedCredit" name="Used Credit" stackId="a" fill="#3b82f6" radius={[0, 0, 0, 0]} />
                    <RechartsBar dataKey="availableCredit" name="Available Credit" stackId="a" fill="#e5e7eb" radius={[4, 4, 0, 0]} />
                  </BarChart>
                </ResponsiveContainer>
              </div>
            ) : (
              <div className="h-64 flex items-center justify-center text-gray-500">
                <div className="text-center">
                  <BarChart3 className="w-8 h-8 mx-auto mb-2 text-gray-300" />
                  <p>No company performance data available</p>
                </div>
              </div>
            )}
          </div>
        </div>
      )}

      {/* Search */}
      <div className="relative">
        <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-gray-400" />
        <input
          type="text"
          placeholder="Search companies by name, email, or GST number..."
          value={searchTerm}
          onChange={(e) => setSearchTerm(e.target.value)}
          className="w-full pl-10 pr-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
        />
      </div>

      {/* Companies List */}
      <div className="bg-white rounded-lg border border-gray-200 overflow-hidden">
        {filteredCompanies.length > 0 ? (
          <div className="overflow-x-auto">
            <table className="min-w-full divide-y divide-gray-200">
              <thead className="bg-gray-50">
                <tr>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                    Company
                  </th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                    Contact
                  </th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                    Credit Info
                  </th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                    Status
                  </th>
                  {!readOnly && (
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                      Actions
                    </th>
                  )}
                </tr>
              </thead>
              <tbody className="bg-white divide-y divide-gray-200">
                {filteredCompanies.map((company) => (
                  <tr key={company._id} className="hover:bg-gray-50">
                    <CompanyRowInfo company={company} />
                    {!readOnly && (
                      <td className="px-6 py-4 whitespace-nowrap text-sm font-medium">
                        <div className="flex items-center space-x-2">
                          <Button
                            variant="ghost"
                            size="sm"
                            onClick={() => handleEditCompany(company)}
                          >
                            <Edit className="w-4 h-4" />
                          </Button>
                          <Button
                            variant="ghost"
                            size="sm"
                            onClick={() => handleToggleStatus(company)}
                            className={cn(
                              "flex items-center",
                              company.isActive
                                ? "text-orange-600 hover:text-orange-700"
                                : "text-green-600 hover:text-green-700"
                            )}
                            disabled={toggleStatusMutation.isPending}
                          >
                            {company.isActive ? (
                              <PowerOff className="w-4 h-4" />
                            ) : (
                              <Power className="w-4 h-4" />
                            )}
                          </Button>
                        </div>
                      </td>
                    )}
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        ) : (
          <div className="text-center py-12">
            <Building2 className="mx-auto h-12 w-12 text-gray-300 mb-4" />
            <h3 className="text-sm font-medium text-gray-900 mb-2">
              {searchTerm ? 'No companies found' : 'No corporate companies'}
            </h3>
            <p className="text-sm text-gray-500">
              {searchTerm 
                ? 'Try adjusting your search terms.' 
                : 'Get started by creating your first corporate company.'
              }
            </p>
          </div>
        )}
      </div>

      {/* Pagination Controls */}
      {companiesData?.pagination && companiesData.pagination.totalPages > 1 && (
        <div className="flex items-center justify-between px-4 py-3 bg-white border border-gray-200 rounded-lg mt-4">
          <div className="text-sm text-gray-700">
            Showing page {companiesData.pagination.page} of {companiesData.pagination.totalPages}
            {' '}({companiesData.pagination.totalCount} total companies)
          </div>
          <div className="flex items-center space-x-2">
            <Button
              variant="outline"
              size="sm"
              disabled={currentPage <= 1}
              onClick={() => setCurrentPage(prev => Math.max(1, prev - 1))}
            >
              Previous
            </Button>
            <span className="text-sm text-gray-600 px-2">
              Page {currentPage}
            </span>
            <Button
              variant="outline"
              size="sm"
              disabled={currentPage >= (companiesData.pagination.totalPages || 1)}
              onClick={() => setCurrentPage(prev => prev + 1)}
            >
              Next
            </Button>
          </div>
        </div>
      )}

      {/* Company Form Modal */}
      {showForm && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-lg max-w-4xl w-full max-h-[90vh] overflow-y-auto">
            <div className="flex items-center justify-between p-6 border-b border-gray-200">
              <h3 className="text-lg font-semibold text-gray-900">
                {editingCompany ? 'Edit Company' : 'Add New Company'}
              </h3>
              <button aria-label="Close"
                onClick={handleCloseForm}
                className="text-gray-400 hover:text-gray-500"
              >
                <X className="w-6 h-6" />
              </button>
            </div>

            <form onSubmit={handleSubmit} className="p-6 space-y-6">
              {/* Basic Information */}
              <div className="space-y-4">
                <h4 className="text-md font-medium text-gray-900 flex items-center">
                  <Building2 className="w-5 h-5 mr-2" />
                  Basic Information
                </h4>
                
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">
                      Company Name *
                    </label>
                    <input
                      type="text"
                      required
                      value={formData.name}
                      onChange={(e) => setFormData(prev => ({ ...prev, name: e.target.value }))}
                      className={cn(
                        "w-full px-3 py-2 border rounded-md focus:ring-2 focus:ring-blue-500 focus:border-transparent",
                        formErrors.name ? "border-red-300" : "border-gray-300"
                      )}
                      placeholder="Enter company name"
                    />
                    {formErrors.name && (
                      <p className="text-sm text-red-600 mt-1">{formErrors.name}</p>
                    )}
                  </div>

                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">
                      Email *
                    </label>
                    <input
                      type="email"
                      required
                      value={formData.email}
                      onChange={(e) => {
                        setFormData(prev => ({ ...prev, email: e.target.value }));

                        // Real-time validation
                        if (e.target.value.length > 0) {
                          const validation = validateEmail(e.target.value);
                          if (!validation.isValid) {
                            setFormErrors(prev => ({ ...prev, email: validation.error }));
                          } else {
                            setFormErrors(prev => {
                              const { email, ...rest } = prev;
                              return rest;
                            });
                          }
                        }
                      }}
                      className={cn(
                        "w-full px-3 py-2 border rounded-md focus:ring-2 focus:ring-blue-500 focus:border-transparent",
                        formErrors.email ? "border-red-300" : "border-gray-300"
                      )}
                      placeholder="company@example.com"
                    />
                    {formErrors.email && (
                      <p className="text-sm text-red-600 mt-1">{formErrors.email}</p>
                    )}
                  </div>

                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">
                      Phone
                    </label>
                    <input
                      type="tel"
                      value={formData.phone}
                      onChange={(e) => {
                        setFormData(prev => ({ ...prev, phone: e.target.value }));

                        // Real-time validation
                        if (e.target.value.length > 0) {
                          const validation = validatePhone(e.target.value);
                          if (!validation.isValid) {
                            setFormErrors(prev => ({ ...prev, phone: validation.error }));
                          } else {
                            setFormErrors(prev => {
                              const { phone, ...rest } = prev;
                              return rest;
                            });
                          }
                        }
                      }}
                      className={cn(
                        "w-full px-3 py-2 border rounded-md focus:ring-2 focus:ring-blue-500 focus:border-transparent",
                        formErrors.phone ? "border-red-300" : "border-gray-300"
                      )}
                      placeholder="+91 98765 43210"
                    />
                    {formErrors.phone && (
                      <p className="text-sm text-red-600 mt-1">{formErrors.phone}</p>
                    )}
                  </div>

                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">
                      GST Number *
                    </label>
                    <input
                      type="text"
                      required
                      value={formData.gstNumber}
                      onChange={(e) => {
                        const formatted = formatGST(e.target.value);
                        setFormData(prev => ({ ...prev, gstNumber: formatted }));

                        // Real-time validation
                        const validation = validateGST(formatted);
                        if (!validation.isValid && formatted.length > 0) {
                          setFormErrors(prev => ({ ...prev, gstNumber: validation.error }));
                        } else {
                          setFormErrors(prev => {
                            const { gstNumber, ...rest } = prev;
                            return rest;
                          });
                        }
                      }}
                      className={cn(
                        "w-full px-3 py-2 border rounded-md focus:ring-2 focus:ring-blue-500 focus:border-transparent",
                        formErrors.gstNumber ? "border-red-300" : "border-gray-300"
                      )}
                      placeholder="22AAAAA0000A1Z5"
                      maxLength={15}
                    />
                    {formErrors.gstNumber && (
                      <p className="text-sm text-red-600 mt-1">{formErrors.gstNumber}</p>
                    )}
                  </div>

                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">
                      PAN Number
                    </label>
                    <input
                      type="text"
                      value={formData.panNumber}
                      onChange={(e) => {
                        const formatted = formatPAN(e.target.value);
                        setFormData(prev => ({ ...prev, panNumber: formatted }));

                        // Real-time validation
                        if (formatted.length > 0) {
                          const validation = validatePAN(formatted);
                          if (!validation.isValid) {
                            setFormErrors(prev => ({ ...prev, panNumber: validation.error }));
                          } else {
                            setFormErrors(prev => {
                              const { panNumber, ...rest } = prev;
                              return rest;
                            });
                          }
                        }
                      }}
                      className={cn(
                        "w-full px-3 py-2 border rounded-md focus:ring-2 focus:ring-blue-500 focus:border-transparent",
                        formErrors.panNumber ? "border-red-300" : "border-gray-300"
                      )}
                      placeholder="ABCDE1234F"
                      maxLength={10}
                    />
                    {formErrors.panNumber && (
                      <p className="text-sm text-red-600 mt-1">{formErrors.panNumber}</p>
                    )}
                  </div>
                </div>
              </div>

              {/* Address Information */}
              <div className="space-y-4">
                <h4 className="text-md font-medium text-gray-900 flex items-center">
                  <MapPin className="w-5 h-5 mr-2" />
                  Address Information
                </h4>
                
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <div className="md:col-span-2">
                    <label className="block text-sm font-medium text-gray-700 mb-1">
                      Street Address *
                    </label>
                    <input
                      type="text"
                      required
                      value={formData.address.street}
                      onChange={(e) => setFormData(prev => ({
                        ...prev,
                        address: { ...prev.address, street: e.target.value }
                      }))}
                      className={cn(
                        "w-full px-3 py-2 border rounded-md focus:ring-2 focus:ring-blue-500 focus:border-transparent",
                        formErrors.street ? "border-red-300" : "border-gray-300"
                      )}
                      placeholder="Enter street address"
                    />
                    {formErrors.street && (
                      <p className="text-sm text-red-600 mt-1">{formErrors.street}</p>
                    )}
                  </div>

                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">
                      City *
                    </label>
                    <input
                      type="text"
                      required
                      value={formData.address.city}
                      onChange={(e) => setFormData(prev => ({
                        ...prev,
                        address: { ...prev.address, city: e.target.value }
                      }))}
                      className={cn(
                        "w-full px-3 py-2 border rounded-md focus:ring-2 focus:ring-blue-500 focus:border-transparent",
                        formErrors.city ? "border-red-300" : "border-gray-300"
                      )}
                      placeholder="Enter city"
                    />
                    {formErrors.city && (
                      <p className="text-sm text-red-600 mt-1">{formErrors.city}</p>
                    )}
                  </div>

                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">
                      State *
                    </label>
                    <input
                      type="text"
                      required
                      value={formData.address.state}
                      onChange={(e) => setFormData(prev => ({
                        ...prev,
                        address: { ...prev.address, state: e.target.value }
                      }))}
                      className={cn(
                        "w-full px-3 py-2 border rounded-md focus:ring-2 focus:ring-blue-500 focus:border-transparent",
                        formErrors.state ? "border-red-300" : "border-gray-300"
                      )}
                      placeholder="Enter state"
                    />
                    {formErrors.state && (
                      <p className="text-sm text-red-600 mt-1">{formErrors.state}</p>
                    )}
                  </div>

                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">
                      Country
                    </label>
                    <input
                      type="text"
                      value={formData.address.country}
                      onChange={(e) => setFormData(prev => ({
                        ...prev,
                        address: { ...prev.address, country: e.target.value }
                      }))}
                      className="w-full px-3 py-2 border border-gray-300 rounded-md focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                    />
                  </div>

                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">
                      ZIP Code *
                    </label>
                    <input
                      type="text"
                      required
                      value={formData.address.zipCode}
                      onChange={(e) => {
                        const value = e.target.value.replace(/\D/g, '').slice(0, 6);
                        setFormData(prev => ({
                          ...prev,
                          address: { ...prev.address, zipCode: value }
                        }));

                        // Real-time validation
                        if (value.length > 0) {
                          const validation = validateZIP(value);
                          if (!validation.isValid) {
                            setFormErrors(prev => ({ ...prev, zipCode: validation.error }));
                          } else {
                            setFormErrors(prev => {
                              const { zipCode, ...rest } = prev;
                              return rest;
                            });
                          }
                        }
                      }}
                      className={cn(
                        "w-full px-3 py-2 border rounded-md focus:ring-2 focus:ring-blue-500 focus:border-transparent",
                        formErrors.zipCode ? "border-red-300" : "border-gray-300"
                      )}
                      placeholder="Enter ZIP code"
                      maxLength={6}
                    />
                    {formErrors.zipCode && (
                      <p className="text-sm text-red-600 mt-1">{formErrors.zipCode}</p>
                    )}
                  </div>
                </div>
              </div>

              {/* Financial Information */}
              <div className="space-y-4">
                <h4 className="text-md font-medium text-gray-900 flex items-center">
                  <CreditCard className="w-5 h-5 mr-2" />
                  Financial Information
                </h4>
                
                <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">
                      Credit Limit
                    </label>
                    <input
                      type="number"
                      min="0"
                      step="1000"
                      value={formData.creditLimit}
                      onChange={(e) => setFormData(prev => ({ ...prev, creditLimit: Number(e.target.value) }))}
                      className="w-full px-3 py-2 border border-gray-300 rounded-md focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                    />
                  </div>

                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">
                      Payment Terms (days)
                    </label>
                    <select
                      value={formData.paymentTerms}
                      onChange={(e) => setFormData(prev => ({ ...prev, paymentTerms: Number(e.target.value) }))}
                      className="w-full px-3 py-2 border border-gray-300 rounded-md focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                    >
                      <option value={15}>15 days</option>
                      <option value={30}>30 days</option>
                      <option value={45}>45 days</option>
                      <option value={60}>60 days</option>
                      <option value={90}>90 days</option>
                    </select>
                  </div>

                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">
                      Billing Cycle
                    </label>
                    <select
                      value={formData.billingCycle}
                      onChange={(e) => setFormData(prev => ({ ...prev, billingCycle: e.target.value }))}
                      className="w-full px-3 py-2 border border-gray-300 rounded-md focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                    >
                      <option value="immediate">Immediate</option>
                      <option value="weekly">Weekly</option>
                      <option value="monthly">Monthly</option>
                      <option value="quarterly">Quarterly</option>
                    </select>
                  </div>
                </div>
              </div>

              {/* HR Contacts */}
              <div className="space-y-4">
                <div className="flex items-center justify-between">
                  <h4 className="text-md font-medium text-gray-900 flex items-center">
                    <Users className="w-5 h-5 mr-2" />
                    HR Contacts
                  </h4>
                  <Button type="button" variant="outline" size="sm" onClick={handleAddHRContact}>
                    <Plus className="w-4 h-4 mr-1" />
                    Add Contact
                  </Button>
                </div>

                {formData.hrContacts.map((contact, index) => (
                  <div key={`formData-hrContacts-${index}-${contact.name}`} className="border border-gray-200 rounded-lg p-4">
                    <div className="flex items-center justify-between mb-3">
                      <span className="text-sm font-medium text-gray-700">
                        Contact {index + 1} {contact.isPrimary && <Badge variant="primary" size="sm">Primary</Badge>}
                      </span>
                      {formData.hrContacts.length > 1 && (
                        <Button
                          type="button"
                          variant="ghost"
                          size="sm"
                          onClick={() => handleRemoveHRContact(index)}
                          className="text-red-600 hover:text-red-700"
                        >
                          <Trash2 className="w-4 h-4" />
                        </Button>
                      )}
                    </div>

                    <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                      <div>
                        <label className="block text-sm font-medium text-gray-700 mb-1">
                          Name *
                        </label>
                        <input
                          type="text"
                          required
                          value={contact.name}
                          onChange={(e) => handleHRContactChange(index, 'name', e.target.value)}
                          className={cn(
                            "w-full px-3 py-2 border rounded-md focus:ring-2 focus:ring-blue-500 focus:border-transparent",
                            formErrors[`hrContact_${index}_name`] ? "border-red-300" : "border-gray-300"
                          )}
                          placeholder="Contact name"
                        />
                        {formErrors[`hrContact_${index}_name`] && (
                          <p className="text-sm text-red-600 mt-1">{formErrors[`hrContact_${index}_name`]}</p>
                        )}
                      </div>

                      <div>
                        <label className="block text-sm font-medium text-gray-700 mb-1">
                          Email *
                        </label>
                        <input
                          type="email"
                          required
                          value={contact.email}
                          onChange={(e) => {
                            handleHRContactChange(index, 'email', e.target.value);

                            // Real-time validation for HR contact email
                            if (e.target.value.length > 0) {
                              const validation = validateEmail(e.target.value);
                              if (!validation.isValid) {
                                setFormErrors(prev => ({ ...prev, [`hrContact_${index}_email`]: validation.error }));
                              } else {
                                setFormErrors(prev => {
                                  const { [`hrContact_${index}_email`]: removed, ...rest } = prev;
                                  return rest;
                                });
                              }
                            }
                          }}
                          className={cn(
                            "w-full px-3 py-2 border rounded-md focus:ring-2 focus:ring-blue-500 focus:border-transparent",
                            formErrors[`hrContact_${index}_email`] ? "border-red-300" : "border-gray-300"
                          )}
                          placeholder="contact@company.com"
                        />
                        {formErrors[`hrContact_${index}_email`] && (
                          <p className="text-sm text-red-600 mt-1">{formErrors[`hrContact_${index}_email`]}</p>
                        )}
                      </div>

                      <div>
                        <label className="block text-sm font-medium text-gray-700 mb-1">
                          Phone
                        </label>
                        <input
                          type="tel"
                          value={contact.phone}
                          onChange={(e) => {
                            handleHRContactChange(index, 'phone', e.target.value);

                            // Real-time validation for HR contact phone
                            if (e.target.value.length > 0) {
                              const validation = validatePhone(e.target.value);
                              if (!validation.isValid) {
                                setFormErrors(prev => ({ ...prev, [`hrContact_${index}_phone`]: validation.error }));
                              } else {
                                setFormErrors(prev => {
                                  const { [`hrContact_${index}_phone`]: removed, ...rest } = prev;
                                  return rest;
                                });
                              }
                            }
                          }}
                          className={cn(
                            "w-full px-3 py-2 border rounded-md focus:ring-2 focus:ring-blue-500 focus:border-transparent",
                            formErrors[`hrContact_${index}_phone`] ? "border-red-300" : "border-gray-300"
                          )}
                          placeholder="+91 98765 43210"
                        />
                        {formErrors[`hrContact_${index}_phone`] && (
                          <p className="text-sm text-red-600 mt-1">{formErrors[`hrContact_${index}_phone`]}</p>
                        )}
                      </div>

                      <div>
                        <label className="block text-sm font-medium text-gray-700 mb-1">
                          Designation
                        </label>
                        <input
                          type="text"
                          value={contact.designation}
                          onChange={(e) => handleHRContactChange(index, 'designation', e.target.value)}
                          className="w-full px-3 py-2 border border-gray-300 rounded-md focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                          placeholder="HR Manager"
                        />
                      </div>
                    </div>

                    <div className="mt-3">
                      <label className="flex items-center">
                        <input
                          type="checkbox"
                          checked={contact.isPrimary}
                          onChange={(e) => {
                            // If setting as primary, uncheck all others first
                            if (e.target.checked) {
                              setFormData(prev => ({
                                ...prev,
                                hrContacts: prev.hrContacts.map((c, i) => ({
                                  ...c,
                                  isPrimary: i === index
                                }))
                              }));
                            } else {
                              handleHRContactChange(index, 'isPrimary', false);
                            }
                          }}
                          className="h-4 w-4 text-blue-600 focus:ring-blue-500 border-gray-300 rounded"
                        />
                        <span className="ml-2 text-sm text-gray-700">Primary Contact</span>
                      </label>
                    </div>
                  </div>
                ))}

                {formErrors.hrContacts && (
                  <p className="text-sm text-red-600">{formErrors.hrContacts}</p>
                )}
              </div>

              {/* Form Actions */}
              <div className="flex justify-end space-x-3 pt-6 border-t border-gray-200">
                <Button type="button" variant="outline" onClick={handleCloseForm}>
                  Cancel
                </Button>
                <Button
                  type="submit"
                  disabled={createMutation.isPending || updateMutation.isPending}
                  className="flex items-center"
                >
                  {(createMutation.isPending || updateMutation.isPending) ? (
                    <LoadingSpinner className="w-4 h-4 mr-2" />
                  ) : (
                    <Save className="w-4 h-4 mr-2" />
                  )}
                  {editingCompany ? 'Update Company' : 'Create Company'}
                </Button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}

export default withErrorBoundary(CorporateCompanyManagement, { level: 'component' });