import React, { useState, useCallback } from 'react';
import { useQuery } from '@tanstack/react-query';
import {
  Users,
  Search,
  RefreshCw,
  AlertCircle,
  CheckCircle,
  XCircle,
  Clock,
  Info,
  Building2,
  Phone,
  Mail,
  Hash,
  Percent,
  TrendingUp,
  Banknote,
  Calendar,
  ArrowLeft,
  ChevronLeft,
  ChevronRight,
  Briefcase,
  Globe,
  Eye,
} from 'lucide-react';
import { cn } from '../../utils/cn';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { LoadingSpinner } from '../../components/LoadingSpinner';
import { api } from '../../services/api';
import { useProperty } from '../../context/PropertyContext';
import { useAuth } from '../../context/AuthContext';
import type { TravelAgent } from '../../services/travelAgentService';
import { withErrorBoundary } from '../../components/ErrorBoundary';

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

interface PaginationMeta {
  currentPage: number;
  totalPages: number;
  totalItems: number;
  hasNext: boolean;
  hasPrev: boolean;
}

interface AgentListResponse {
  travelAgents: TravelAgent[];
  pagination: PaginationMeta;
}

interface AgentPerformanceData {
  performance: {
    totalBookings?: number;
    totalRevenue?: number;
    totalCommission?: number;
    averageBookingValue?: number;
    cancelledBookings?: number;
    completedBookings?: number;
  };
  monthlyRevenue: Array<{
    _id: number;
    revenue: number;
    bookings: number;
  }>;
  agentDetails: {
    companyName: string;
    agentCode: string;
    status: string;
    commissionRate: number;
  };
}

interface ValidateCodeResponse {
  success: boolean;
  valid: boolean;
  message?: string;
  data?: {
    agentCode: string;
    companyName: string;
    commissionRate: number;
  };
}

// ---------------------------------------------------------------------------
// API helpers
// ---------------------------------------------------------------------------

const AGENTS_PER_PAGE = 20;

async function fetchAgents(params: {
  page: number;
  limit: number;
  search?: string;
  status?: string;
}): Promise<AgentListResponse> {
  const { data } = await api.get('/travel-agents', { params });
  const payload = data.data || data;
  return {
    travelAgents: payload.travelAgents || [],
    pagination: payload.pagination || {
      currentPage: params.page,
      totalPages: 1,
      totalItems: payload.travelAgents?.length || 0,
      hasNext: false,
      hasPrev: false,
    },
  };
}

async function fetchAgentById(id: string): Promise<TravelAgent> {
  const { data } = await api.get(`/travel-agents/${id}`);
  return data.data?.travelAgent || data.travelAgent;
}

async function fetchAgentPerformance(id: string): Promise<AgentPerformanceData> {
  const { data } = await api.get(`/travel-agents/${id}/performance`);
  return data.data || data;
}

async function validateAgentCode(code: string): Promise<ValidateCodeResponse> {
  const { data } = await api.get(`/travel-agents/validate-code/${code}`);
  return data;
}

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function getStatusColor(status: string) {
  switch (status) {
    case 'active':
      return 'bg-green-100 text-green-800 border-green-200';
    case 'inactive':
      return 'bg-gray-100 text-gray-800 border-gray-200';
    case 'suspended':
      return 'bg-red-100 text-red-800 border-red-200';
    case 'pending_approval':
      return 'bg-yellow-100 text-yellow-800 border-yellow-200';
    default:
      return 'bg-gray-100 text-gray-800 border-gray-200';
  }
}

function getStatusIcon(status: string) {
  switch (status) {
    case 'active':
      return <CheckCircle className="h-4 w-4 text-green-600" />;
    case 'suspended':
      return <XCircle className="h-4 w-4 text-red-600" />;
    case 'pending_approval':
      return <Clock className="h-4 w-4 text-yellow-600" />;
    default:
      return <AlertCircle className="h-4 w-4 text-gray-600" />;
  }
}

function formatCurrency(amount: number | undefined | null): string {
  if (amount == null) return '$0.00';
  return new Intl.NumberFormat('en-US', {
    style: 'currency',
    currency: 'USD',
    minimumFractionDigits: 2,
  }).format(amount);
}

function formatDate(date: Date | string | undefined): string {
  if (!date) return 'N/A';
  return new Date(date).toLocaleDateString('en-US', {
    year: 'numeric',
    month: 'short',
    day: 'numeric',
  });
}

function formatBusinessType(type?: string): string {
  switch (type) {
    case 'domestic':
      return 'Domestic';
    case 'international':
      return 'International';
    case 'both':
      return 'Domestic & International';
    default:
      return 'Not specified';
  }
}

// ---------------------------------------------------------------------------
// Sub-components
// ---------------------------------------------------------------------------

/** Quick code validation widget */
function AgentCodeLookup() {
  const [code, setCode] = useState('');
  const [submitted, setSubmitted] = useState('');

  const {
    data: result,
    isLoading,
    isFetched,
  } = useQuery({
    queryKey: ['validate-agent-code', submitted],
    queryFn: () => validateAgentCode(submitted),
    enabled: submitted.length >= 2,
    staleTime: 30_000,
  });

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (code.trim().length >= 2) {
      setSubmitted(code.trim().toUpperCase());
    }
  };

  return (
    <Card>
      <CardHeader className="pb-3">
        <CardTitle className="text-base flex items-center gap-2">
          <Hash className="w-4 h-4" />
          Validate Agent Code
        </CardTitle>
      </CardHeader>
      <CardContent>
        <form onSubmit={handleSubmit} className="flex gap-2">
          <Input
            placeholder="Enter agent code..."
            value={code}
            onChange={(e) => setCode(e.target.value.toUpperCase())}
            className="flex-1"
          />
          <Button type="submit" disabled={code.trim().length < 2 || isLoading} size="sm">
            {isLoading ? <LoadingSpinner size="sm" className="mr-1" /> : <Search className="w-4 h-4 mr-1" />}
            Validate
          </Button>
        </form>

        {submitted && isFetched && result && (
          <div className="mt-3">
            {result.valid && result.data ? (
              <div className="bg-green-50 border border-green-200 rounded-lg p-3">
                <div className="flex items-center gap-2 mb-1">
                  <CheckCircle className="h-4 w-4 text-green-600" />
                  <span className="text-sm font-medium text-green-800">Valid Agent Code</span>
                </div>
                <div className="grid grid-cols-3 gap-2 mt-2 text-sm">
                  <div>
                    <span className="text-gray-500">Code:</span>{' '}
                    <span className="font-medium">{result.data.agentCode}</span>
                  </div>
                  <div>
                    <span className="text-gray-500">Company:</span>{' '}
                    <span className="font-medium">{result.data.companyName}</span>
                  </div>
                  <div>
                    <span className="text-gray-500">Commission:</span>{' '}
                    <span className="font-medium">{result.data.commissionRate}%</span>
                  </div>
                </div>
              </div>
            ) : (
              <div className="bg-red-50 border border-red-200 rounded-lg p-3">
                <div className="flex items-center gap-2">
                  <XCircle className="h-4 w-4 text-red-600" />
                  <span className="text-sm font-medium text-red-800">
                    {result.message || 'Invalid agent code'}
                  </span>
                </div>
              </div>
            )}
          </div>
        )}
      </CardContent>
    </Card>
  );
}

/** Agent detail panel shown when an agent row is selected */
function AgentDetailPanel({
  agentId,
  onClose,
}: {
  agentId: string;
  onClose: () => void;
}) {
  const {
    data: agent,
    isLoading: agentLoading,
    error: agentError,
  } = useQuery({
    queryKey: ['travel-agent-detail', agentId],
    queryFn: () => fetchAgentById(agentId),
    enabled: !!agentId,
    staleTime: 60_000,
  });

  const {
    data: perfData,
    isLoading: perfLoading,
  } = useQuery({
    queryKey: ['travel-agent-performance', agentId],
    queryFn: () => fetchAgentPerformance(agentId),
    enabled: !!agentId,
    staleTime: 60_000,
  });

  if (agentLoading) {
    return (
      <Card>
        <CardContent className="flex justify-center items-center py-16">
          <LoadingSpinner size="lg" />
        </CardContent>
      </Card>
    );
  }

  if (agentError || !agent) {
    return (
      <Card>
        <CardContent className="text-center py-12">
          <AlertCircle className="mx-auto h-8 w-8 text-red-500 mb-2" />
          <p className="text-sm text-gray-600">Failed to load agent details.</p>
          <Button variant="outline" size="sm" onClick={onClose} className="mt-3">
            <ArrowLeft className="w-4 h-4 mr-1" /> Back to list
          </Button>
        </CardContent>
      </Card>
    );
  }

  const perf = perfData?.performance || {};
  const monthlyRevenue = perfData?.monthlyRevenue || [];

  return (
    <div className="space-y-4">
      {/* Back button */}
      <Button variant="outline" size="sm" onClick={onClose}>
        <ArrowLeft className="w-4 h-4 mr-1" /> Back to list
      </Button>

      {/* Agent header */}
      <Card>
        <CardContent className="p-6">
          <div className="flex flex-col md:flex-row md:items-start md:justify-between gap-4">
            <div className="flex items-start gap-4">
              <div className="w-12 h-12 rounded-full bg-blue-100 flex items-center justify-center flex-shrink-0">
                <Building2 className="w-6 h-6 text-blue-600" />
              </div>
              <div>
                <h2 className="text-xl font-bold text-gray-900">{agent.companyName}</h2>
                <p className="text-sm text-gray-500">Agent Code: {agent.agentCode}</p>
                <div className="flex items-center gap-2 mt-1">
                  {getStatusIcon(agent.status)}
                  <Badge className={cn('text-xs', getStatusColor(agent.status))}>
                    {agent.status.replace(/_/g, ' ')}
                  </Badge>
                </div>
              </div>
            </div>
            <div className="text-right">
              <p className="text-sm text-gray-500">Commission Rate</p>
              <p className="text-2xl font-bold text-blue-600">
                {agent.commissionStructure?.defaultRate ?? 0}%
              </p>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Contact & Business details */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="text-base">Contact Information</CardTitle>
          </CardHeader>
          <CardContent className="space-y-3">
            <div className="flex items-center gap-3 text-sm">
              <Users className="w-4 h-4 text-gray-400 flex-shrink-0" />
              <div>
                <span className="text-gray-500">Contact Person:</span>{' '}
                <span className="font-medium">{agent.contactPerson}</span>
              </div>
            </div>
            <div className="flex items-center gap-3 text-sm">
              <Mail className="w-4 h-4 text-gray-400 flex-shrink-0" />
              <div>
                <span className="text-gray-500">Email:</span>{' '}
                <span className="font-medium">{agent.email}</span>
              </div>
            </div>
            <div className="flex items-center gap-3 text-sm">
              <Phone className="w-4 h-4 text-gray-400 flex-shrink-0" />
              <div>
                <span className="text-gray-500">Phone:</span>{' '}
                <span className="font-medium">{agent.phone}</span>
              </div>
            </div>
            {agent.address && (agent.address.city || agent.address.country) && (
              <div className="flex items-center gap-3 text-sm">
                <Globe className="w-4 h-4 text-gray-400 flex-shrink-0" />
                <div>
                  <span className="text-gray-500">Location:</span>{' '}
                  <span className="font-medium">
                    {[agent.address.city, agent.address.state, agent.address.country]
                      .filter(Boolean)
                      .join(', ')}
                  </span>
                </div>
              </div>
            )}
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="text-base">Business Details</CardTitle>
          </CardHeader>
          <CardContent className="space-y-3">
            <div className="flex items-center gap-3 text-sm">
              <Briefcase className="w-4 h-4 text-gray-400 flex-shrink-0" />
              <div>
                <span className="text-gray-500">Business Type:</span>{' '}
                <span className="font-medium">
                  {formatBusinessType(agent.businessDetails?.businessType)}
                </span>
              </div>
            </div>
            {agent.businessDetails?.licenseNumber && (
              <div className="flex items-center gap-3 text-sm">
                <Hash className="w-4 h-4 text-gray-400 flex-shrink-0" />
                <div>
                  <span className="text-gray-500">License No:</span>{' '}
                  <span className="font-medium">{agent.businessDetails.licenseNumber}</span>
                </div>
              </div>
            )}
            {agent.businessDetails?.establishedYear && (
              <div className="flex items-center gap-3 text-sm">
                <Calendar className="w-4 h-4 text-gray-400 flex-shrink-0" />
                <div>
                  <span className="text-gray-500">Established:</span>{' '}
                  <span className="font-medium">{agent.businessDetails.establishedYear}</span>
                </div>
              </div>
            )}
            {agent.paymentTerms && (
              <div className="flex items-center gap-3 text-sm">
                <Banknote className="w-4 h-4 text-gray-400 flex-shrink-0" />
                <div>
                  <span className="text-gray-500">Payment Terms:</span>{' '}
                  <span className="font-medium">
                    {agent.paymentTerms.paymentDueDays} days, {agent.paymentTerms.preferredPaymentMethod?.replace(/_/g, ' ')}
                  </span>
                </div>
              </div>
            )}
            {agent.bookingLimits && (
              <div className="flex items-center gap-3 text-sm">
                <TrendingUp className="w-4 h-4 text-gray-400 flex-shrink-0" />
                <div>
                  <span className="text-gray-500">Max Bookings/Day:</span>{' '}
                  <span className="font-medium">{agent.bookingLimits.maxBookingsPerDay}</span>
                  {' | '}
                  <span className="text-gray-500">Max Rooms/Booking:</span>{' '}
                  <span className="font-medium">{agent.bookingLimits.maxRoomsPerBooking}</span>
                </div>
              </div>
            )}
            <div className="flex items-center gap-3 text-sm">
              <Calendar className="w-4 h-4 text-gray-400 flex-shrink-0" />
              <div>
                <span className="text-gray-500">Registered:</span>{' '}
                <span className="font-medium">{formatDate(agent.createdAt)}</span>
              </div>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Performance / Commission summary */}
      <Card>
        <CardHeader className="pb-3">
          <CardTitle className="text-base flex items-center gap-2">
            <TrendingUp className="w-4 h-4" />
            Performance &amp; Commission Summary
          </CardTitle>
        </CardHeader>
        <CardContent>
          {perfLoading ? (
            <div className="flex justify-center py-8">
              <LoadingSpinner size="md" />
            </div>
          ) : (
            <>
              <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-6">
                <div className="bg-blue-50 rounded-lg p-4 text-center">
                  <p className="text-xs text-blue-600 font-medium">Total Bookings</p>
                  <p className="text-2xl font-bold text-blue-800">
                    {perf.totalBookings ?? agent.performanceMetrics?.totalBookings ?? 0}
                  </p>
                </div>
                <div className="bg-green-50 rounded-lg p-4 text-center">
                  <p className="text-xs text-green-600 font-medium">Total Revenue</p>
                  <p className="text-2xl font-bold text-green-800">
                    {formatCurrency(perf.totalRevenue ?? agent.performanceMetrics?.totalRevenue)}
                  </p>
                </div>
                <div className="bg-purple-50 rounded-lg p-4 text-center">
                  <p className="text-xs text-purple-600 font-medium">Commission Earned</p>
                  <p className="text-2xl font-bold text-purple-800">
                    {formatCurrency(perf.totalCommission ?? agent.performanceMetrics?.totalCommissionEarned)}
                  </p>
                </div>
                <div className="bg-amber-50 rounded-lg p-4 text-center">
                  <p className="text-xs text-amber-600 font-medium">Avg Booking Value</p>
                  <p className="text-2xl font-bold text-amber-800">
                    {formatCurrency(perf.averageBookingValue ?? agent.performanceMetrics?.averageBookingValue)}
                  </p>
                </div>
              </div>

              {/* Monthly revenue breakdown (last few months available) */}
              {monthlyRevenue.length > 0 && (
                <div>
                  <h4 className="text-sm font-medium text-gray-700 mb-3">Monthly Revenue (This Year)</h4>
                  <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-6 gap-2">
                    {monthlyRevenue.map((m) => {
                      const monthNames = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
                      return (
                        <div key={m._id} className="bg-gray-50 rounded p-2 text-center">
                          <p className="text-xs text-gray-500">{monthNames[(m._id - 1)] || `M${m._id}`}</p>
                          <p className="text-sm font-semibold text-gray-800">{formatCurrency(m.revenue)}</p>
                          <p className="text-xs text-gray-400">{m.bookings} bookings</p>
                        </div>
                      );
                    })}
                  </div>
                </div>
              )}

              {agent.performanceMetrics?.lastBookingDate && (
                <p className="text-xs text-gray-500 mt-4">
                  Last booking: {formatDate(agent.performanceMetrics.lastBookingDate)}
                </p>
              )}
            </>
          )}
        </CardContent>
      </Card>

      {/* Notes */}
      {agent.notes && (
        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="text-base">Notes</CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-sm text-gray-700 whitespace-pre-wrap">{agent.notes}</p>
          </CardContent>
        </Card>
      )}
    </div>
  );
}

// ---------------------------------------------------------------------------
// Main page component
// ---------------------------------------------------------------------------

function FrontDeskTravelAgents() {
  const { user } = useAuth();
  const { selectedPropertyId, selectedProperty } = useProperty();

  const [page, setPage] = useState(1);
  const [searchInput, setSearchInput] = useState('');
  const [searchTerm, setSearchTerm] = useState('');
  const [filterStatus, setFilterStatus] = useState('all');
  const [selectedAgentId, setSelectedAgentId] = useState<string | null>(null);
  const [refreshing, setRefreshing] = useState(false);

  // ---- Agent list query ----
  const {
    data: listData,
    isLoading: listLoading,
    error: listError,
    refetch: refetchList,
  } = useQuery({
    queryKey: [
      'frontdesk-travel-agents',
      selectedPropertyId,
      page,
      searchTerm,
      filterStatus,
    ],
    queryFn: () =>
      fetchAgents({
        page,
        limit: AGENTS_PER_PAGE,
        search: searchTerm || undefined,
        status: filterStatus !== 'all' ? filterStatus : undefined,
      }),
    enabled: !!selectedPropertyId,
    keepPreviousData: true,
    staleTime: 30_000,
  });

  const agents = listData?.travelAgents || [];
  const pagination = listData?.pagination || {
    currentPage: 1,
    totalPages: 1,
    totalItems: 0,
    hasNext: false,
    hasPrev: false,
  };

  // ---- Handlers ----
  const handleSearch = useCallback(
    (e: React.FormEvent) => {
      e.preventDefault();
      setSearchTerm(searchInput.trim());
      setPage(1);
    },
    [searchInput]
  );

  const handleStatusFilter = useCallback((status: string) => {
    setFilterStatus(status);
    setPage(1);
  }, []);

  const handleRefresh = useCallback(() => {
    setRefreshing(true);
    refetchList().finally(() => setTimeout(() => setRefreshing(false), 400));
  }, [refetchList]);

  // ---- No property guard ----
  if (!selectedPropertyId || !selectedProperty) {
    return (
      <div className="space-y-6">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Travel Agents</h1>
          <p className="mt-1 text-gray-600">View and look up travel agent partners</p>
        </div>
        <div className="bg-yellow-50 border-l-4 border-yellow-400 p-4 rounded-lg">
          <div className="flex items-center">
            <AlertCircle className="h-5 w-5 text-yellow-400 mr-3" />
            <p className="text-sm font-medium text-yellow-800">
              Please select a property to view travel agents.
            </p>
          </div>
        </div>
      </div>
    );
  }

  // ---- Detail view ----
  if (selectedAgentId) {
    return (
      <div className="space-y-6">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Travel Agent Details</h1>
          <p className="mt-1 text-gray-600">Viewing agent profile and performance</p>
        </div>
        <AgentDetailPanel
          agentId={selectedAgentId}
          onClose={() => setSelectedAgentId(null)}
        />
      </div>
    );
  }

  // ---- List view ----
  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:justify-between sm:items-center gap-4">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Travel Agents</h1>
          <p className="mt-1 text-gray-600">
            View and look up travel agent partners for {selectedProperty.name}
          </p>
        </div>
        <Button
          onClick={handleRefresh}
          disabled={refreshing}
          variant="outline"
          className="flex items-center self-start"
        >
          <RefreshCw className={cn('w-4 h-4 mr-2', refreshing && 'animate-spin')} />
          Refresh
        </Button>
      </div>

      {/* Read-only notice */}
      <div className="bg-blue-50 border border-blue-200 rounded-lg p-4">
        <p className="text-sm text-blue-800 flex items-start gap-2">
          <Info className="w-4 h-4 mt-0.5 flex-shrink-0" />
          <span>
            <strong>Front Desk Access:</strong> You can view travel agent details and validate agent
            codes during booking. Agent onboarding, editing, and status management are restricted to
            administrators.
          </span>
        </p>
      </div>

      {/* Agent Code Lookup */}
      <AgentCodeLookup />

      {/* Search & Filters */}
      <Card>
        <CardContent className="p-4">
          <div className="flex flex-col sm:flex-row gap-3">
            <form onSubmit={handleSearch} className="flex gap-2 flex-1">
              <div className="relative flex-1">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
                <Input
                  placeholder="Search by company, contact, code, or email..."
                  value={searchInput}
                  onChange={(e) => setSearchInput(e.target.value)}
                  className="pl-9"
                />
              </div>
              <Button type="submit" size="sm">
                Search
              </Button>
              {searchTerm && (
                <Button
                  type="button"
                  variant="ghost"
                  size="sm"
                  onClick={() => {
                    setSearchInput('');
                    setSearchTerm('');
                    setPage(1);
                  }}
                >
                  Clear
                </Button>
              )}
            </form>

            {/* Status filter */}
            <div className="flex gap-1 flex-wrap">
              {[
                { value: 'all', label: 'All' },
                { value: 'active', label: 'Active' },
                { value: 'inactive', label: 'Inactive' },
                { value: 'suspended', label: 'Suspended' },
                { value: 'pending_approval', label: 'Pending' },
              ].map((opt) => (
                <Button
                  key={opt.value}
                  variant={filterStatus === opt.value ? 'default' : 'outline'}
                  size="sm"
                  onClick={() => handleStatusFilter(opt.value)}
                  className="text-xs"
                >
                  {opt.label}
                </Button>
              ))}
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Agent list */}
      <Card>
        <CardHeader className="pb-3">
          <CardTitle className="text-lg flex items-center gap-2">
            <Users className="w-5 h-5" />
            Travel Agents
            <span className="text-sm font-normal text-gray-500 ml-1">
              ({pagination.totalItems} total)
            </span>
          </CardTitle>
        </CardHeader>
        <CardContent>
          {listLoading && agents.length === 0 ? (
            <div className="flex justify-center py-12">
              <LoadingSpinner size="lg" />
            </div>
          ) : listError ? (
            <div className="text-center py-12">
              <AlertCircle className="mx-auto h-8 w-8 text-red-500 mb-2" />
              <p className="text-sm text-gray-600 mb-3">Failed to load travel agents.</p>
              <Button variant="outline" size="sm" onClick={() => refetchList()}>
                Retry
              </Button>
            </div>
          ) : agents.length === 0 ? (
            <div className="text-center py-12">
              <Users className="mx-auto h-10 w-10 text-gray-300 mb-3" />
              <p className="text-gray-500 font-medium">No travel agents found</p>
              <p className="text-sm text-gray-400 mt-1">
                {searchTerm || filterStatus !== 'all'
                  ? 'Try adjusting your search or filters.'
                  : 'No travel agents have been registered for this property yet.'}
              </p>
            </div>
          ) : (
            <>
              {/* Table */}
              <div className="overflow-x-auto">
                <table className="w-full text-sm">
                  <thead>
                    <tr className="border-b border-gray-200">
                      <th className="text-left py-3 px-3 font-medium text-gray-600">Company</th>
                      <th className="text-left py-3 px-3 font-medium text-gray-600">Code</th>
                      <th className="text-left py-3 px-3 font-medium text-gray-600 hidden md:table-cell">Contact</th>
                      <th className="text-left py-3 px-3 font-medium text-gray-600">Status</th>
                      <th className="text-right py-3 px-3 font-medium text-gray-600 hidden lg:table-cell">Commission</th>
                      <th className="text-right py-3 px-3 font-medium text-gray-600 hidden lg:table-cell">Bookings</th>
                      <th className="text-right py-3 px-3 font-medium text-gray-600 hidden xl:table-cell">Revenue</th>
                      <th className="text-center py-3 px-3 font-medium text-gray-600">Action</th>
                    </tr>
                  </thead>
                  <tbody>
                    {agents.map((agent) => (
                      <tr
                        key={agent._id}
                        className="border-b border-gray-100 hover:bg-gray-50 transition-colors"
                      >
                        <td className="py-3 px-3">
                          <div>
                            <p className="font-medium text-gray-900">{agent.companyName}</p>
                            <p className="text-xs text-gray-500 md:hidden">{agent.contactPerson}</p>
                          </div>
                        </td>
                        <td className="py-3 px-3">
                          <code className="text-xs bg-gray-100 px-2 py-0.5 rounded font-mono">
                            {agent.agentCode}
                          </code>
                        </td>
                        <td className="py-3 px-3 hidden md:table-cell">
                          <p className="text-gray-800">{agent.contactPerson}</p>
                          <p className="text-xs text-gray-400">{agent.email}</p>
                        </td>
                        <td className="py-3 px-3">
                          <div className="flex items-center gap-1.5">
                            {getStatusIcon(agent.status)}
                            <Badge className={cn('text-xs', getStatusColor(agent.status))}>
                              {agent.status.replace(/_/g, ' ')}
                            </Badge>
                          </div>
                        </td>
                        <td className="py-3 px-3 text-right hidden lg:table-cell">
                          <div className="flex items-center justify-end gap-1">
                            <Percent className="w-3 h-3 text-gray-400" />
                            <span>{agent.commissionStructure?.defaultRate ?? 0}%</span>
                          </div>
                        </td>
                        <td className="py-3 px-3 text-right hidden lg:table-cell">
                          {agent.performanceMetrics?.totalBookings ?? 0}
                        </td>
                        <td className="py-3 px-3 text-right hidden xl:table-cell">
                          {formatCurrency(agent.performanceMetrics?.totalRevenue)}
                        </td>
                        <td className="py-3 px-3 text-center">
                          <Button
                            variant="ghost"
                            size="sm"
                            onClick={() => setSelectedAgentId(agent._id)}
                            title="View agent details"
                          >
                            <Eye className="w-4 h-4 mr-1" />
                            View
                          </Button>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>

              {/* Pagination */}
              {pagination.totalPages > 1 && (
                <div className="flex items-center justify-between mt-4 pt-4 border-t border-gray-200">
                  <p className="text-sm text-gray-500">
                    Page {pagination.currentPage} of {pagination.totalPages} ({pagination.totalItems}{' '}
                    agents)
                  </p>
                  <div className="flex items-center gap-2">
                    <Button
                      variant="outline"
                      size="sm"
                      disabled={!pagination.hasPrev}
                      onClick={() => setPage((p) => Math.max(1, p - 1))}
                    >
                      <ChevronLeft className="w-4 h-4" />
                    </Button>

                    {/* Page number buttons (show up to 5 around current) */}
                    {(() => {
                      const total = pagination.totalPages;
                      const current = pagination.currentPage;
                      let start = Math.max(1, current - 2);
                      const end = Math.min(total, start + 4);
                      start = Math.max(1, end - 4);
                      const pages: number[] = [];
                      for (let i = start; i <= end; i++) pages.push(i);
                      return pages.map((p) => (
                        <Button
                          key={p}
                          variant={p === current ? 'default' : 'outline'}
                          size="sm"
                          onClick={() => setPage(p)}
                          className="min-w-[36px]"
                        >
                          {p}
                        </Button>
                      ));
                    })()}

                    <Button
                      variant="outline"
                      size="sm"
                      disabled={!pagination.hasNext}
                      onClick={() => setPage((p) => p + 1)}
                    >
                      <ChevronRight className="w-4 h-4" />
                    </Button>
                  </div>
                </div>
              )}
            </>
          )}
        </CardContent>
      </Card>
    </div>
  );
}

export default withErrorBoundary(FrontDeskTravelAgents);
