import React, { useState, useEffect, useMemo, useCallback, Suspense, lazy } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import { AddPropertyModal } from './AddPropertyModal';
import { EditPropertyModal } from './EditPropertyModal';
import { AddGroupModal } from './AddGroupModal';
import { EditGroupModal } from './EditGroupModal';
import { ExportModal } from './ExportModal';
import { VirtualizedPropertyList } from './VirtualizedPropertyList';
import { Pagination } from '../ui/Pagination';

// HOTEL-OTA-ARCH-001: Lazy load analytics components to reduce initial bundle size
// These are heavy components (Recharts, etc.) - only load when tab is active
const PerformanceBenchmarking = lazy(() => import('../analytics/PerformanceBenchmarking').then(m => ({ default: m.PerformanceBenchmarking })));
const RevenueOptimizationInsights = lazy(() => import('../analytics/RevenueOptimizationInsights').then(m => ({ default: m.RevenueOptimizationInsights })));
const CustomReportBuilder = lazy(() => import('../analytics/CustomReportBuilder').then(m => ({ default: m.CustomReportBuilder })));
const AutomatedReportScheduling = lazy(() => import('../analytics/AutomatedReportScheduling').then(m => ({ default: m.AutomatedReportScheduling })));

// Loading fallback for lazy components
const AnalyticsLoadingFallback = () => (
  <div className="flex items-center justify-center p-8">
    <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600"></div>
  </div>
);
import {
  useProperties,
  usePropertyGroups,
  useCreatePropertyGroup,
  useUpdatePropertyGroup,
  useDeletePropertyGroup,
  useSyncGroupSettings,
  useAddPropertiesToGroup,
  useRemovePropertiesFromGroup,
  QUERY_KEYS
} from '../../hooks/usePropertyQueries';
import { useQueryClient } from '@tanstack/react-query';
import {
  Building2,
  MapPin,
  Users,
  IndianRupee,
  TrendingUp,
  Calendar,
  Settings,
  Plus,
  Edit,
  Trash2,
  Eye,
  BarChart3,
  Globe,
  Wifi,
  Star,
  Phone,
  Mail,
  Clock,
  Bed,
  Car,
  Coffee,
  Utensils,
  Dumbbell,
  Shield,
  AlertCircle,
  CheckCircle,
  XCircle,
  User,
  ArrowUpRight,
  ArrowDownRight,
  Filter,
  Search,
  Download,
  Upload,
  RefreshCw,
  MoreVertical,
  LayoutGrid
} from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { 
  DropdownMenu, 
  DropdownMenuTrigger, 
  DropdownMenuContent, 
  DropdownMenuItem, 
  DropdownMenuSeparator 
} from '@/components/ui/dropdown-menu';
import { Textarea } from '@/components/ui/textarea';
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from '@/components/ui/alert-dialog';
import { useToast } from '@/components/ui/use-toast';
import { propertyGroupsApi, api } from '../../services/api';
import { withErrorBoundary } from '../ErrorBoundary';
import { Property, PropertyGroup } from '../../types/property';

export const MultiPropertyManager: React.FC = () => {
  const { toast } = useToast();
  const navigate = useNavigate();
  const queryClient = useQueryClient();

  // UI state
  const [selectedProperty, setSelectedProperty] = useState<Property | null>(null);
  const [selectedGroup, setSelectedGroup] = useState<PropertyGroup | null>(null);
  const [activeView, setActiveView] = useState<'dashboard' | 'properties' | 'groups' | 'analytics'>('dashboard');
  const [searchTerm, setSearchTerm] = useState('');
  const [statusFilter, setStatusFilter] = useState<string>('all');
  const [typeFilter, setTypeFilter] = useState<string>('all');
  const [showAddProperty, setShowAddProperty] = useState(false);
  const [showEditProperty, setShowEditProperty] = useState(false);
  const [selectedPropertyForEdit, setSelectedPropertyForEdit] = useState<Property | null>(null);
  const [showAddGroup, setShowAddGroup] = useState(false);
  const [showEditGroup, setShowEditGroup] = useState(false);
  const [selectedGroupForEdit, setSelectedGroupForEdit] = useState<PropertyGroup | null>(null);
  const [showPropertyAssignment, setShowPropertyAssignment] = useState(false);
  const [showGroupDashboard, setShowGroupDashboard] = useState(false);
  const [selectedGroupForDashboard, setSelectedGroupForDashboard] = useState<PropertyGroup | null>(null);

  // Confirmation dialog state
  const [confirmDialog, setConfirmDialog] = useState<{
    open: boolean;
    title: string;
    description: string;
    onConfirm: () => void;
  }>({ open: false, title: '', description: '', onConfirm: () => {} });

  // Pagination state
  const [pagination, setPagination] = useState({
    currentPage: 1,
    itemsPerPage: 20,
    totalItems: 0,
    totalPages: 0
  });

  // React Query hooks
  const { data: propertiesData = [], isLoading: propertiesLoading, refetch: refetchProperties } = useProperties();
  const properties = Array.isArray(propertiesData) ? propertiesData : [];
  const {
    data: propertyGroupsData,
    isLoading: groupsLoading,
    error: groupsError,
    refetch: refetchPropertyGroups
  } = usePropertyGroups({
    page: pagination.currentPage,
    limit: pagination.itemsPerPage,
    status: statusFilter,
    search: searchTerm
  });

  // Extract data from React Query response
  const propertyGroups = propertyGroupsData?.data || [];
  const groupsPagination = propertyGroupsData?.pagination;

  // Combined loading and error states
  const loading = propertiesLoading || groupsLoading;
  const error = groupsError;

  // Pagination handlers
  const handlePageChange = (page: number) => {
    setPagination(prev => ({ ...prev, currentPage: page }));
  };

  const handleItemsPerPageChange = (itemsPerPage: number) => {
    setPagination(prev => ({ ...prev, itemsPerPage, currentPage: 1 }));
  };

  // Mutations
  const createGroupMutation = useCreatePropertyGroup();
  const updateGroupMutation = useUpdatePropertyGroup();
  const deleteGroupMutation = useDeletePropertyGroup();
  const syncGroupMutation = useSyncGroupSettings();
  const addPropertiesMutation = useAddPropertiesToGroup();
  const removePropertiesMutation = useRemovePropertiesFromGroup();
  const [selectedPropertiesForAssignment, setSelectedPropertiesForAssignment] = useState<string[]>([]);
  const [targetGroup, setTargetGroup] = useState<PropertyGroup | null>(null);
  const [showExportModal, setShowExportModal] = useState(false);

  // Clear cache on mount to ensure fresh data
  useEffect(() => {
    queryClient.invalidateQueries({ queryKey: QUERY_KEYS.properties });
  }, []); // Empty dependency array = run once on mount

  // Update pagination when React Query data changes
  React.useEffect(() => {
    if (groupsPagination) {
      setPagination({
        currentPage: groupsPagination.page || 1,
        itemsPerPage: groupsPagination.limit || 20,
        totalItems: groupsPagination.total || 0,
        totalPages: groupsPagination.pages || 0
      });
    }
  }, [groupsPagination]);


  // Property Group Management Functions
  const handleCreateGroup = async (groupData: Record<string, unknown>) => {
    try {
      await propertyGroupsApi.createGroup(groupData);
      toast({
        title: "Success",
        description: "Property group created successfully"
      });
      refetchPropertyGroups();
      setShowAddGroup(false);
    } catch (err: unknown) {
      toast({
        variant: "destructive",
        title: "Error",
        description: err.response?.data?.message || "Failed to create property group"
      });
    }
  };

  const handleUpdateGroup = async (groupId: string, groupData: Record<string, unknown>) => {
    try {
      await propertyGroupsApi.updateGroup(groupId, groupData);
      toast({
        title: "Success",
        description: "Property group updated successfully"
      });
      refetchPropertyGroups();
    } catch (err: unknown) {
      toast({
        variant: "destructive",
        title: "Error",
        description: err.response?.data?.message || "Failed to update property group"
      });
    }
  };

  const handleDeleteGroup = (groupId: string) => {
    setConfirmDialog({
      open: true,
      title: 'Delete Property Group',
      description: 'Are you sure you want to delete this property group? This action cannot be undone.',
      onConfirm: async () => {
        try {
          await propertyGroupsApi.deleteGroup(groupId);
          toast({
            title: "Success",
            description: "Property group deleted successfully"
          });
          refetchPropertyGroups();
          if (selectedGroup?.id === groupId) {
            setSelectedGroup(null);
          }
        } catch (err: unknown) {
          const error = err as { response?: { data?: { message?: string } } };
          toast({
            variant: "destructive",
            title: "Error",
            description: error?.response?.data?.message || "Failed to delete property group"
          });
        }
      }
    });
  };

  const handleSyncGroupSettings = async (groupId: string) => {
    try {
      await propertyGroupsApi.syncGroupSettings(groupId);
      toast({
        title: "Success",
        description: "Group settings synced successfully"
      });
      refetchPropertyGroups();
    } catch (err: unknown) {
      toast({
        variant: "destructive",
        title: "Error",
        description: err.response?.data?.message || "Failed to sync group settings"
      });
    }
  };

  // Property Assignment Functions
  const handleAddPropertiesToGroup = async (groupId: string, propertyIds: string[]) => {
    try {
      await propertyGroupsApi.addPropertiesToGroup(groupId, { propertyIds });
      toast({
        title: "Success",
        description: `Added ${propertyIds.length} property(ies) to group successfully`
      });
      refetchPropertyGroups();
      refetchProperties();
    } catch (err: unknown) {
      toast({
        variant: "destructive",
        title: "Error",
        description: err.response?.data?.message || "Failed to add properties to group"
      });
    }
  };

  const handleRemovePropertiesFromGroup = (groupId: string, propertyIds: string[]) => {
    setConfirmDialog({
      open: true,
      title: 'Remove Properties',
      description: `Are you sure you want to remove ${propertyIds.length} property(ies) from this group?`,
      onConfirm: async () => {
        try {
          await propertyGroupsApi.removePropertiesFromGroup(groupId, { propertyIds });
          toast({
            title: "Success",
            description: `Removed ${propertyIds.length} property(ies) from group successfully`
          });
          refetchPropertyGroups();
          refetchProperties();
        } catch (err: unknown) {
          const error = err as { response?: { data?: { message?: string } } };
          toast({
            variant: "destructive",
            title: "Error",
            description: error?.response?.data?.message || "Failed to remove properties from group"
          });
        }
      }
    });
  };

  const openPropertyAssignmentModal = (group: PropertyGroup) => {
    setTargetGroup(group);
    setSelectedPropertiesForAssignment([]);
    setShowPropertyAssignment(true);
  };

  const handlePropertySelection = (propertyId: string, isSelected: boolean) => {
    setSelectedPropertiesForAssignment(prev => 
      isSelected 
        ? [...prev, propertyId]
        : prev.filter(id => id !== propertyId)
    );
  };

  const handleBulkAssignment = async () => {
    if (targetGroup && selectedPropertiesForAssignment.length > 0) {
      await handleAddPropertiesToGroup(targetGroup._id, selectedPropertiesForAssignment);
      setShowPropertyAssignment(false);
      setTargetGroup(null);
      setSelectedPropertiesForAssignment([]);
    }
  };

  const filteredProperties = useMemo(() => properties.filter(property => {
    const matchesSearch = property.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
                         property.location?.city?.toLowerCase().includes(searchTerm.toLowerCase()) || false;
    const matchesStatus = statusFilter === 'all' || property.status === statusFilter;
    const matchesType = typeFilter === 'all' || property.type === typeFilter;

    return matchesSearch && matchesStatus && matchesType;
  }), [properties, searchTerm, statusFilter, typeFilter]);

  const totalStats = useMemo(() => ({
    properties: properties.length,
    totalRooms: properties.reduce((sum, p) => sum + (p.rooms?.total || 0), 0),
    totalRevenue: properties.reduce((sum, p) => sum + (p.performance?.revenue || 0), 0),
    avgOccupancy: properties.length > 0 ? properties.reduce((sum, p) => sum + (p.performance?.occupancyRate || 0), 0) / properties.length : 0,
    avgADR: properties.length > 0 ? properties.reduce((sum, p) => sum + (p.performance?.adr || 0), 0) / properties.length : 0
  }), [properties]);

  const getStatusColor = (status: string) => {
    switch (status) {
      case 'active': return 'default';
      case 'inactive': return 'secondary';
      case 'maintenance': return 'destructive';
      default: return 'secondary';
    }
  };

  const getPerformanceChange = (current: number, previous: number) => {
    if (previous === 0 && current === 0) {
      return { value: '—', isPositive: true };
    }
    if (previous === 0) {
      return { value: 'New', isPositive: true };
    }
    const change = ((current - previous) / previous) * 100;
    return {
      value: Math.abs(change).toFixed(1),
      isPositive: change >= 0
    };
  };

  const renderDashboard = () => (
    <div className="space-y-8">
      {/* Portfolio Analytics Link */}
      <Card className="border-0 shadow-sm bg-gradient-to-r from-blue-50 to-indigo-50">
        <CardContent className="p-6">
          <div className="flex items-center justify-between">
            <div className="flex items-center space-x-4">
              <div className="p-3 bg-blue-500 rounded-full">
                <LayoutGrid className="h-6 w-6 text-white" />
              </div>
              <div>
                <h3 className="text-lg font-semibold text-gray-900">Portfolio Analytics</h3>
                <p className="text-sm text-gray-600">View comprehensive analytics across all properties</p>
              </div>
            </div>
            <Button
              className="bg-blue-600 hover:bg-blue-700"
              onClick={() => navigate('/admin/portfolio')}
            >
              <BarChart3 className="mr-2 h-4 w-4" />
              View Portfolio Dashboard
            </Button>
          </div>
        </CardContent>
      </Card>

      {/* Overview Stats */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4 lg:gap-6">
        <Card className="border-0 shadow-sm hover:shadow-md transition-shadow duration-200 bg-gradient-to-br from-blue-50 to-blue-100">
          <CardContent className="p-6">
            <div className="flex items-center justify-between">
              <div className="space-y-1">
                <p className="text-sm font-medium text-blue-600">Total Properties</p>
                <p className="text-3xl font-bold text-blue-900">{totalStats.properties}</p>
                <p className="text-xs text-blue-500">Active properties</p>
              </div>
              <div className="p-3 bg-blue-500 rounded-full">
                <Building2 className="h-6 w-6 text-white" />
              </div>
            </div>
          </CardContent>
        </Card>

        <Card className="border-0 shadow-sm hover:shadow-md transition-shadow duration-200 bg-gradient-to-br from-green-50 to-green-100">
          <CardContent className="p-6">
            <div className="flex items-center justify-between">
              <div className="space-y-1">
                <p className="text-sm font-medium text-green-600">Total Rooms</p>
                <p className="text-3xl font-bold text-green-900">{totalStats.totalRooms}</p>
                <p className="text-xs text-green-500">Across all properties</p>
              </div>
              <div className="p-3 bg-green-500 rounded-full">
                <Bed className="h-6 w-6 text-white" />
              </div>
            </div>
          </CardContent>
        </Card>

        <Card className="border-0 shadow-sm hover:shadow-md transition-shadow duration-200 bg-gradient-to-br from-emerald-50 to-emerald-100">
          <CardContent className="p-6">
            <div className="flex items-center justify-between">
              <div className="space-y-1">
                <p className="text-sm font-medium text-emerald-600">Total Revenue</p>
                <p className="text-3xl font-bold text-emerald-900">₹{(totalStats.totalRevenue || 0).toLocaleString()}</p>
                <p className="text-xs text-emerald-500">All time paid</p>
              </div>
              <div className="p-3 bg-emerald-500 rounded-full">
                <IndianRupee className="h-6 w-6 text-white" />
              </div>
            </div>
          </CardContent>
        </Card>

        <Card className="border-0 shadow-sm hover:shadow-md transition-shadow duration-200 bg-gradient-to-br from-purple-50 to-purple-100">
          <CardContent className="p-6">
            <div className="flex items-center justify-between">
              <div className="space-y-1">
                <p className="text-sm font-medium text-purple-600">Avg Occupancy</p>
                <p className="text-3xl font-bold text-purple-900">{totalStats.avgOccupancy.toFixed(1)}%</p>
                <p className="text-xs text-purple-500">Portfolio average</p>
              </div>
              <div className="p-3 bg-purple-500 rounded-full">
                <TrendingUp className="h-6 w-6 text-white" />
              </div>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Property Groups */}
      <Card className="border-0 shadow-sm">
        <CardHeader className="pb-4">
          <div className="flex items-center justify-between">
            <div>
              <CardTitle className="text-xl font-semibold">Property Groups</CardTitle>
              <p className="text-sm text-muted-foreground mt-1">Organize and manage your properties</p>
            </div>
            <Button onClick={() => setShowAddGroup(true)} className="bg-blue-600 hover:bg-blue-700">
              <Plus className="mr-2 h-4 w-4" />
              Add Group
            </Button>
          </div>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
            {propertyGroups.map(group => (
              <div role="button" tabIndex={0} key={group.id} className="p-6 border border-gray-200 rounded-xl cursor-pointer hover:border-blue-300 hover:shadow-md transition-all duration-200 bg-white"
                   onClick={() => setSelectedGroup(group)} onKeyDown={(e: React.KeyboardEvent) => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); const clickHandler = () => setSelectedGroup(group); if (typeof clickHandler === 'function') { clickHandler(e as any); } } }}>
                <div className="flex items-start justify-between mb-4">
                  <div className="flex-1">
                    <div className="flex items-center space-x-3 mb-2">
                      <h3 className="font-semibold text-lg text-gray-900">{group.name}</h3>
                      <Badge variant="secondary" className="bg-blue-100 text-blue-700">{group.properties?.length || 0} properties</Badge>
                    </div>
                    <p className="text-sm text-gray-600 mb-3">{group.description}</p>
                    <div className="flex items-center space-x-6 text-sm text-gray-500">
                      <div className="flex items-center">
                        <User className="h-4 w-4 mr-1" />
                        <span>{group.manager || 'Not assigned'}</span>
                      </div>
                      <div className="flex items-center">
                        <IndianRupee className="h-4 w-4 mr-1" />
                        <span>₹{(group.budget || 0).toLocaleString()}</span>
                      </div>
                    </div>
                  </div>
                </div>
                <div className="flex items-center justify-between pt-4 border-t border-gray-100">
                  <div>
                    <div className="text-2xl font-bold text-gray-900">₹{(group.performance?.totalRevenue || 0).toLocaleString()}</div>
                    <div className="text-sm text-gray-500">Total Revenue</div>
                  </div>
                  <div className="text-right">
                    <div className="text-lg font-semibold text-green-600">{group.performance?.avgOccupancy || 0}%</div>
                    <div className="text-sm text-gray-500">Avg Occupancy</div>
                  </div>
                </div>
              </div>
            ))}
          </div>
        </CardContent>
      </Card>

      {/* Top Performing Properties */}
      <Card className="border-0 shadow-sm">
        <CardHeader className="pb-4">
          <div className="flex items-center justify-between">
            <div>
              <CardTitle className="text-xl font-semibold">Top Performing Properties</CardTitle>
              <p className="text-sm text-muted-foreground mt-1">Properties with highest RevPAR this month</p>
            </div>
            <Badge variant="outline" className="bg-green-50 text-green-700 border-green-200">
              <TrendingUp className="h-3 w-3 mr-1" />
              Top 3
            </Badge>
          </div>
        </CardHeader>
        <CardContent>
          <div className="space-y-4">
            {properties
              .sort((a, b) => (b.performance?.revpar || 0) - (a.performance?.revpar || 0))
              .slice(0, 3)
              .map((property, index) => {
                const revparChange = getPerformanceChange(
                  property.performance?.revpar || 0,
                  property.performance?.lastMonth?.revpar || 0
                );
                const rankColors = ['bg-yellow-100 text-yellow-800', 'bg-gray-100 text-gray-800', 'bg-orange-100 text-orange-800'];
                const rankIcons = ['🥇', '🥈', '🥉'];
                
                return (
                  <div key={property.id} className="flex items-center justify-between p-6 border border-gray-200 rounded-xl hover:border-blue-300 hover:shadow-sm transition-all duration-200 bg-white">
                    <div className="flex items-center space-x-4">
                      <div className="flex items-center space-x-3">
                        <div className={`w-8 h-8 rounded-full flex items-center justify-center text-sm font-bold ${rankColors[index]}`}>
                          {index + 1}
                        </div>
                        <div className="w-14 h-14 bg-gradient-to-br from-blue-500 to-blue-600 rounded-xl flex items-center justify-center text-white font-bold text-lg shadow-md">
                          {property.name.charAt(0).toUpperCase()}
                        </div>
                      </div>
                      <div className="flex-1">
                        <div className="flex items-center space-x-2 mb-1">
                          <h3 className="font-semibold text-lg text-gray-900">{property.name}</h3>
                          <Badge variant="outline" className="text-xs">{property.type}</Badge>
                        </div>
                        <div className="flex items-center space-x-4 text-sm text-gray-600 mb-2">
                          <div className="flex items-center">
                            <MapPin className="h-4 w-4 mr-1" />
                            <span>{property.location?.city || 'Unknown'}, {property.location?.country || 'Unknown'}</span>
                          </div>
                          <div className="flex items-center">
                            <Star className="h-4 w-4 fill-yellow-400 text-yellow-400 mr-1" />
                            <span>{property.rating}</span>
                          </div>
                        </div>
                        <div className="flex items-center space-x-4 text-xs text-gray-500">
                          <span>{property.rooms?.total || 0} rooms</span>
                          <span>{property.performance?.occupancyRate || 0}% occupancy</span>
                        </div>
                      </div>
                    </div>
                    <div className="text-right">
                      <div className="text-2xl font-bold text-gray-900">₹{(property.performance?.revpar || 0).toFixed(0)}</div>
                      <div className="text-sm text-gray-500 mb-1">RevPAR</div>
                      <div className={`flex items-center justify-end text-sm font-medium ${
                        revparChange.isPositive ? 'text-green-600' : 'text-red-600'
                      }`}>
                        {revparChange.value === '—' || revparChange.value === 'New' ? (
                          <span className="text-gray-400">{revparChange.value}</span>
                        ) : (
                          <>
                            {revparChange.isPositive ? (
                              <ArrowUpRight className="h-4 w-4 mr-1" />
                            ) : (
                              <ArrowDownRight className="h-4 w-4 mr-1" />
                            )}
                            {revparChange.value}%
                          </>
                        )}
                      </div>
                    </div>
                  </div>
                );
              })}
          </div>
        </CardContent>
      </Card>
    </div>
  );

  const renderProperties = () => (
    <div className="space-y-6">
      {/* Filters */}
      <Card className="border-0 shadow-sm">
        <CardContent className="p-6">
          <div className="flex flex-col lg:flex-row items-start lg:items-center space-y-4 lg:space-y-0 lg:space-x-4">
            <div className="relative flex-1 w-full lg:w-auto">
              <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-gray-400" />
              <Input
                placeholder="Search properties by name or location..."
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                className="pl-10 h-11 border-gray-200 focus:border-blue-500 focus:ring-blue-500"
              />
            </div>
            <div className="flex flex-col sm:flex-row items-start sm:items-center space-y-2 sm:space-y-0 sm:space-x-3 w-full lg:w-auto">
              <Select value={statusFilter} onValueChange={setStatusFilter}>
                <SelectTrigger className="w-full sm:w-40 h-11 border-gray-200">
                  <span>{statusFilter === 'all' ? 'All Status' : statusFilter.charAt(0).toUpperCase() + statusFilter.slice(1)}</span>
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">All Status</SelectItem>
                  <SelectItem value="active">Active</SelectItem>
                  <SelectItem value="inactive">Inactive</SelectItem>
                  <SelectItem value="maintenance">Maintenance</SelectItem>
                </SelectContent>
              </Select>
              <Select value={typeFilter} onValueChange={setTypeFilter}>
                <SelectTrigger className="w-full sm:w-40 h-11 border-gray-200">
                  <span>{typeFilter === 'all' ? 'All Types' : typeFilter.charAt(0).toUpperCase() + typeFilter.slice(1)}</span>
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">All Types</SelectItem>
                  <SelectItem value="hotel">Hotel</SelectItem>
                  <SelectItem value="resort">Resort</SelectItem>
                  <SelectItem value="aparthotel">Apart Hotel</SelectItem>
                  <SelectItem value="boutique">Boutique</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <Button 
              onClick={() => setShowAddProperty(true)} 
              className="w-full sm:w-auto bg-blue-600 hover:bg-blue-700 h-11"
            >
              <Plus className="mr-2 h-4 w-4" />
              Add Property
            </Button>
          </div>
        </CardContent>
      </Card>

      {/* Property Cards */}
      {/* Virtualized Property List */}
      <VirtualizedPropertyList
        properties={filteredProperties}
        isLoading={propertiesLoading}
        onPropertySelect={setSelectedProperty}
        onPropertyEdit={(property) => {
          setSelectedPropertyForEdit(property.originalHotel || property);
          setShowEditProperty(true);
        }}
        onPropertyDelete={(propertyId) => {
          toast({ title: 'Property Deleted', description: 'Property has been removed from the system.' });
        }}
        onResetFilters={() => {
          setSearchTerm('');
          setStatusFilter('all');
          setTypeFilter('all');
        }}
        searchTerm={searchTerm}
        statusFilter={statusFilter}
        typeFilter={typeFilter}
        itemHeight={420}
        containerHeight={800}
      />
      <div style={{ display: 'none' }} className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {filteredProperties.map(property => {
          const occupancyChange = getPerformanceChange(
            property.performance.occupancyRate,
            property.performance.lastMonth.occupancyRate
          );
          const adrChange = getPerformanceChange(
            property.performance.adr,
            property.performance.lastMonth.adr
          );

          return (
            <Card key={property.id} className="cursor-pointer hover:shadow-lg transition-shadow"
                  onClick={() => setSelectedProperty(property)}>
              <CardHeader>
                <div className="flex items-center justify-between">
                  <div>
                    <CardTitle className="flex items-center">
                      {property.name}
                      <Badge variant={getStatusColor(property.status) as unknown} className="ml-2">
                        {property.status}
                      </Badge>
                    </CardTitle>
                    <p className="text-sm text-muted-foreground mt-1">
                      {property.brand} • {property.type.charAt(0).toUpperCase() + property.type.slice(1)}
                    </p>
                  </div>
                  <div className="flex items-center space-x-2">
                    <div className="flex items-center">
                      <Star className="h-4 w-4 fill-yellow-400 text-yellow-400 mr-1" />
                      <span className="text-sm font-medium">{property.rating}</span>
                    </div>
                  </div>
                </div>
              </CardHeader>
              <CardContent>
                <div className="space-y-4">
                  {/* Location */}
                  <div className="flex items-center text-sm text-muted-foreground">
                    <MapPin className="mr-2 h-4 w-4" />
                    {property.location.city}, {property.location.country}
                  </div>

                  {/* Room Stats */}
                  <div className="grid grid-cols-4 gap-4 text-center">
                    <div>
                      <div className="text-lg font-bold text-green-600">{property.rooms.available}</div>
                      <div className="text-xs text-muted-foreground">Available</div>
                    </div>
                    <div>
                      <div className="text-lg font-bold text-blue-600">{property.rooms.occupied}</div>
                      <div className="text-xs text-muted-foreground">Occupied</div>
                    </div>
                    <div>
                      <div className="text-lg font-bold text-red-600">{property.rooms.outOfOrder}</div>
                      <div className="text-xs text-muted-foreground">OOO</div>
                    </div>
                    <div>
                      <div className="text-lg font-bold">{property.rooms.total}</div>
                      <div className="text-xs text-muted-foreground">Total</div>
                    </div>
                  </div>

                  {/* Performance */}
                  <div className="grid grid-cols-3 gap-4">
                    <div className="text-center">
                      <div className="text-lg font-bold">{property.performance.occupancyRate}%</div>
                      <div className="text-xs text-muted-foreground">Occupancy</div>
                      <div className={`text-xs flex items-center justify-center ${
                        occupancyChange.isPositive ? 'text-green-600' : 'text-red-600'
                      }`}>
                        {occupancyChange.isPositive ? (
                          <ArrowUpRight className="h-3 w-3 mr-1" />
                        ) : (
                          <ArrowDownRight className="h-3 w-3 mr-1" />
                        )}
                        {occupancyChange.value}%
                      </div>
                    </div>
                    <div className="text-center">
                      <div className="text-lg font-bold">₹{property.performance.adr}</div>
                      <div className="text-xs text-muted-foreground">ADR</div>
                      <div className={`text-xs flex items-center justify-center ${
                        adrChange.isPositive ? 'text-green-600' : 'text-red-600'
                      }`}>
                        {adrChange.isPositive ? (
                          <ArrowUpRight className="h-3 w-3 mr-1" />
                        ) : (
                          <ArrowDownRight className="h-3 w-3 mr-1" />
                        )}
                        {adrChange.value}%
                      </div>
                    </div>
                    <div className="text-center">
                      <div className="text-lg font-bold">₹{property.performance.revpar.toFixed(0)}</div>
                      <div className="text-xs text-muted-foreground">RevPAR</div>
                    </div>
                  </div>

                  {/* Features */}
                  <div className="flex flex-wrap gap-2">
                    {property.features.restaurant && <Badge variant="outline" className="text-xs">Restaurant</Badge>}
                    {property.features.spa && <Badge variant="outline" className="text-xs">Spa</Badge>}
                    {property.features.fitness && <Badge variant="outline" className="text-xs">Fitness</Badge>}
                    {property.features.pool && <Badge variant="outline" className="text-xs">Pool</Badge>}
                    {property.features.parking && <Badge variant="outline" className="text-xs">Parking</Badge>}
                    {property.features.wifi && <Badge variant="outline" className="text-xs">WiFi</Badge>}
                  </div>
                </div>
              </CardContent>
            </Card>
          );
        })}
      </div>
    </div>
  );

  // Auto-select first property for analytics if none selected
  const analyticsProperty = selectedProperty || (properties.length > 0 ? properties[0] : null);

  const renderAnalytics = () => (
    <div className="space-y-6">
      {/* Portfolio Overview */}
      <Card>
        <CardHeader>
          <CardTitle>Portfolio Analytics Overview</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-1 md:grid-cols-4 gap-6">
            <div className="text-center">
              <div className="text-3xl font-bold text-blue-600">{(totalStats.avgOccupancy || 0).toFixed(1)}%</div>
              <div className="text-sm text-muted-foreground">Average Occupancy</div>
            </div>
            <div className="text-center">
              <div className="text-3xl font-bold text-green-600">₹{(totalStats.avgADR || 0).toLocaleString('en-IN', { maximumFractionDigits: 0 })}</div>
              <div className="text-sm text-muted-foreground">Average ADR</div>
            </div>
            <div className="text-center">
              <div className="text-3xl font-bold text-purple-600">₹{(totalStats.totalRevenue || 0).toLocaleString('en-IN')}</div>
              <div className="text-sm text-muted-foreground">Total Revenue</div>
            </div>
            <div className="text-center">
              <div className="text-3xl font-bold text-orange-600">{properties.length}</div>
              <div className="text-sm text-muted-foreground">Total Properties</div>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Performance Benchmarking Dashboard - Lazy loaded */}
      <Suspense fallback={<AnalyticsLoadingFallback />}>
        <PerformanceBenchmarking
          properties={properties}
          selectedProperty={analyticsProperty}
        />
      </Suspense>

      {/* Revenue Optimization Insights - Lazy loaded */}
      <Suspense fallback={<AnalyticsLoadingFallback />}>
        <RevenueOptimizationInsights
          properties={properties}
          selectedProperty={analyticsProperty}
        />
      </Suspense>

      {/* Custom Report Builder - Lazy loaded */}
      <Suspense fallback={<AnalyticsLoadingFallback />}>
        <CustomReportBuilder
          properties={properties}
          selectedProperty={analyticsProperty}
          onSaveReport={(config) => {
            toast({ title: 'Report Template Saved', description: 'Your custom report template has been saved successfully.' });
          }}
          onGenerateReport={(config) => {
            toast({ title: 'Report Generation Started', description: 'Your custom report is being generated and will be sent to recipients.' });
          }}
        />
      </Suspense>

      {/* Automated Report Scheduling - Lazy loaded */}
      <Suspense fallback={<AnalyticsLoadingFallback />}>
        <AutomatedReportScheduling
          onCreateSchedule={(schedule) => {
          toast({ title: 'Schedule Created', description: 'Your automated report schedule has been created successfully.' });
        }}
        onUpdateSchedule={(id, updates) => {
          toast({ title: 'Schedule Updated', description: 'Your report schedule has been updated successfully.' });
        }}
        onDeleteSchedule={(id) => {
          toast({ title: 'Schedule Deleted', description: 'The report schedule has been deleted successfully.' });
        }}
        onRunSchedule={(id) => {
          toast({ title: 'Report Generated', description: 'The scheduled report has been generated and sent to recipients.' });
        }}
        />
      </Suspense>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <Card>
          <CardHeader>
            <CardTitle>Performance by Property Type</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="space-y-4">
              {properties.length === 0 && (
                <div className="text-center py-8 text-gray-500 text-sm">No properties to display</div>
              )}
              {[...new Set(properties.map(p => p.type).filter(Boolean))].map(type => {
                const typeProperties = properties.filter(p => p.type === type);
                const avgRevenue = typeProperties.length > 0 ? typeProperties.reduce((sum, p) => sum + (p.performance?.revenue || 0), 0) / typeProperties.length : 0;
                const avgOccupancy = typeProperties.length > 0 ? typeProperties.reduce((sum, p) => sum + (p.performance?.occupancyRate || 0), 0) / typeProperties.length : 0;

                return (
                  <div key={type} className="flex items-center justify-between p-4 border rounded-lg">
                    <div>
                      <div className="font-medium capitalize">{type}s</div>
                      <div className="text-sm text-muted-foreground">{typeProperties.length} {typeProperties.length === 1 ? 'property' : 'properties'}</div>
                      <div className="text-sm text-blue-600">{avgOccupancy.toFixed(1)}% avg occupancy</div>
                    </div>
                    <div className="text-right">
                      <div className="font-bold">₹{(avgRevenue || 0).toLocaleString('en-IN', { maximumFractionDigits: 0 })}</div>
                      <div className="text-sm text-muted-foreground">Avg Revenue</div>
                    </div>
                  </div>
                );
              })}
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>Geographic Performance</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="space-y-4">
              {properties.length === 0 && (
                <div className="text-center py-8 text-gray-500 text-sm">No properties to display</div>
              )}
              {[...new Set(properties.map(p => p.location?.city).filter(Boolean))].map(city => {
                const cityProperties = properties.filter(p => p.location?.city === city);
                const totalRevenue = cityProperties.reduce((sum, p) => sum + (p.performance?.revenue || 0), 0);
                const avgOccupancy = cityProperties.length > 0 ? cityProperties.reduce((sum, p) => sum + (p.performance?.occupancyRate || 0), 0) / cityProperties.length : 0;

                return (
                  <div key={city} className="flex items-center justify-between p-4 border rounded-lg">
                    <div>
                      <div className="font-medium">{city}</div>
                      <div className="text-sm text-muted-foreground">{cityProperties.length} {cityProperties.length === 1 ? 'property' : 'properties'}</div>
                      <div className="text-sm text-blue-600">{avgOccupancy.toFixed(1)}% avg occupancy</div>
                    </div>
                    <div className="text-right">
                      <div className="font-bold">₹{(totalRevenue || 0).toLocaleString()}</div>
                      <div className="text-sm text-muted-foreground">Total Revenue</div>
                    </div>
                  </div>
                );
              })}
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  );

  const renderGroups = () => (
    <div className="space-y-8">
      {/* Group Management Header */}
      <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between space-y-4 sm:space-y-0">
        <div>
          <h2 className="text-2xl font-bold text-gray-900">Property Groups</h2>
          <p className="text-gray-600 mt-1">Organize and manage your properties into groups for better control</p>
        </div>
        <Button 
          onClick={() => setShowAddGroup(true)}
          className="bg-blue-600 hover:bg-blue-700"
        >
          <Plus className="mr-2 h-4 w-4" />
          Add Group
        </Button>
      </div>

      {/* Property Groups Grid */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
        {propertyGroups.map(group => (
          <Card key={group._id} className="border-0 shadow-sm hover:shadow-lg transition-all duration-200 bg-white">
            <CardHeader className="pb-4">
              <div className="flex items-start justify-between">
                <div className="flex-1">
                  <div className="flex items-center space-x-2 mb-2">
                    <CardTitle className="text-lg font-semibold text-gray-900">{group.name}</CardTitle>
                    <Badge variant="outline" className="text-xs bg-blue-50 text-blue-700 border-blue-200">
                      {group.groupType || 'Standard'}
                    </Badge>
                  </div>
                  {group.description && (
                    <p className="text-sm text-gray-600 line-clamp-2">{group.description}</p>
                  )}
                </div>
                <DropdownMenu>
                  <DropdownMenuTrigger asChild>
                    <Button variant="ghost" size="sm" className="h-8 w-8 p-0">
                      <MoreVertical className="h-4 w-4" />
                    </Button>
                  </DropdownMenuTrigger>
                  <DropdownMenuContent align="end" className="w-48">
                    <DropdownMenuItem onClick={() => {
                      setSelectedGroup(group);
                      setSelectedGroupForEdit(group);
                      setShowEditGroup(true);
                    }}>
                      <Edit className="mr-2 h-4 w-4" />
                      Edit Group
                    </DropdownMenuItem>
                    <DropdownMenuItem onClick={() => handleSyncGroupSettings(group._id)}>
                      <RefreshCw className="mr-2 h-4 w-4" />
                      Sync Settings
                    </DropdownMenuItem>
                    <DropdownMenuSeparator />
                    <DropdownMenuItem 
                      className="text-red-600 focus:text-red-600"
                      onClick={() => handleDeleteGroup(group._id)}
                    >
                      <Trash2 className="mr-2 h-4 w-4" />
                      Delete Group
                    </DropdownMenuItem>
                  </DropdownMenuContent>
                </DropdownMenu>
              </div>
            </CardHeader>
            <CardContent className="space-y-6">
              {/* Group Stats */}
              <div className="grid grid-cols-3 gap-4">
                <div className="text-center p-3 bg-blue-50 rounded-lg">
                  <div className="text-2xl font-bold text-blue-600">{group.properties?.length || 0}</div>
                  <div className="text-xs text-blue-600 font-medium">Properties</div>
                </div>
                <div className="text-center p-3 bg-green-50 rounded-lg">
                  <div className="text-2xl font-bold text-green-600">
                    {group.performance?.avgOccupancy ? `${group.performance.avgOccupancy}%` : 'N/A'}
                  </div>
                  <div className="text-xs text-green-600 font-medium">Avg Occupancy</div>
                </div>
                <div className="text-center p-3 bg-purple-50 rounded-lg">
                  <div className="text-2xl font-bold text-purple-600">
                    ₹{(group.performance?.totalRevenue || 0).toLocaleString()}
                  </div>
                  <div className="text-xs text-purple-600 font-medium">Revenue</div>
                </div>
              </div>

              {/* Group Status and Info */}
              <div className="flex items-center justify-between pt-4 border-t border-gray-100">
                <div className="flex items-center space-x-2">
                  <Badge variant={group.isActive ? "default" : "secondary"} className={group.isActive ? "bg-green-100 text-green-800" : "bg-gray-100 text-gray-800"}>
                    {group.isActive ? "Active" : "Inactive"}
                  </Badge>
                </div>
                <div className="text-xs text-gray-500">
                  Created {new Date(group.createdAt).toLocaleDateString()}
                </div>
              </div>

              {/* Quick Actions */}
              <div className="space-y-3">
                <div className="grid grid-cols-2 gap-2">
                  <Button 
                    variant="outline" 
                    size="sm" 
                    className="h-9 text-xs"
                    onClick={() => {
                      setSelectedGroupForDashboard(group);
                      setShowGroupDashboard(true);
                    }}
                  >
                    <BarChart3 className="mr-1 h-3 w-3" />
                    Dashboard
                  </Button>
                  <Button 
                    variant="outline" 
                    size="sm" 
                    className="h-9 text-xs"
                    onClick={() => {
                      setSelectedGroup(group);
                      setSelectedGroupForEdit(group);
                      setShowEditGroup(true);
                    }}
                  >
                    <Settings className="mr-1 h-3 w-3" />
                    Settings
                  </Button>
                </div>
                <Button 
                  variant="default"
                  size="sm" 
                  className="w-full h-9 bg-blue-600 hover:bg-blue-700"
                  onClick={() => openPropertyAssignmentModal(group)}
                >
                  <Building2 className="mr-2 h-4 w-4" />
                  Manage Properties
                </Button>
              </div>
            </CardContent>
          </Card>
        ))}
      </div>

      {/* Pagination */}
      {pagination.totalPages > 1 && (
        <div className="flex justify-center mt-8">
          <Pagination
            currentPage={pagination.currentPage}
            totalPages={pagination.totalPages}
            totalItems={pagination.totalItems}
            itemsPerPage={pagination.itemsPerPage}
            onPageChange={handlePageChange}
            onItemsPerPageChange={handleItemsPerPageChange}
            isLoading={groupsLoading}
          />
        </div>
      )}

      {/* Empty State */}
      {propertyGroups.length === 0 && !groupsLoading && (
        <Card className="border-0 shadow-sm">
          <CardContent className="py-16">
            <div className="text-center">
              <div className="mx-auto w-24 h-24 bg-gray-100 rounded-full flex items-center justify-center mb-6">
                <Users className="h-12 w-12 text-gray-400" />
              </div>
              <h3 className="text-xl font-semibold text-gray-900 mb-2">No property groups yet</h3>
              <p className="text-gray-600 mb-6 max-w-md mx-auto">
                Get started by creating your first property group to organize and manage your properties more effectively.
              </p>
              <Button 
                className="bg-blue-600 hover:bg-blue-700" 
                onClick={() => setShowAddGroup(true)}
              >
                <Plus className="mr-2 h-4 w-4" />
                Create First Group
              </Button>
            </div>
          </CardContent>
        </Card>
      )}
    </div>
  );

  const tabs = [
    { id: 'dashboard', name: 'Dashboard', icon: BarChart3 },
    { id: 'properties', name: 'Properties', icon: Building2 },
    { id: 'groups', name: 'Groups', icon: Users },
    { id: 'analytics', name: 'Analytics', icon: TrendingUp }
  ];

  // Show loading state
  if (loading) {
    return (
      <div className="min-h-screen bg-gray-50">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
          <div className="flex items-center justify-center h-96">
            <div className="text-center">
              <div className="mx-auto w-16 h-16 bg-blue-100 rounded-full flex items-center justify-center mb-4">
                <RefreshCw className="h-8 w-8 animate-spin text-blue-600" />
              </div>
              <h3 className="text-lg font-semibold text-gray-900 mb-2">Loading dashboard...</h3>
              <p className="text-gray-600">Please wait while we fetch your property data</p>
            </div>
          </div>
        </div>
      </div>
    );
  }

  // Show error state
  if (error && propertyGroups.length === 0) {
    return (
      <div className="min-h-screen bg-gray-50">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
          <div className="flex items-center justify-center h-96">
            <div className="text-center">
              <div className="mx-auto w-16 h-16 bg-red-100 rounded-full flex items-center justify-center mb-4">
                <AlertCircle className="h-8 w-8 text-red-600" />
              </div>
              <h3 className="text-lg font-semibold text-gray-900 mb-2">Something went wrong</h3>
              <p className="text-gray-600 mb-6 max-w-md mx-auto">
                {error}
              </p>
              <Button 
                onClick={() => {
                  refetchPropertyGroups();
                  refetchProperties();
                }}
                className="bg-blue-600 hover:bg-blue-700"
              >
                <RefreshCw className="mr-2 h-4 w-4" />
                Try Again
              </Button>
            </div>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gray-50">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        {/* Header */}
        <div className="mb-8">
          <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between space-y-4 sm:space-y-0">
            <div>
              <h1 className="text-4xl font-bold text-gray-900">Multi-Property Manager</h1>
              <p className="text-lg text-gray-600 mt-2">Manage and monitor your property portfolio</p>
            </div>
            <div className="flex flex-col sm:flex-row space-y-2 sm:space-y-0 sm:space-x-3">
              <Button 
                variant="outline" 
                onClick={() => {
                  refetchPropertyGroups();
                  refetchProperties();
                }}
                className="border-gray-300 hover:bg-gray-50"
              >
                <RefreshCw className="mr-2 h-4 w-4" />
                Refresh Data
              </Button>
              <Button 
                variant="outline" 
                onClick={() => setShowExportModal(true)}
                className="border-gray-300 hover:bg-gray-50"
              >
                <Download className="mr-2 h-4 w-4" />
                Export Data
              </Button>
            </div>
          </div>
        </div>

        {/* Navigation Tabs */}
        <Card className="border-0 shadow-sm mb-8">
          <CardContent className="p-0">
            <div className="flex flex-wrap border-b border-gray-200">
              {tabs.map(tab => {
                const Icon = tab.icon;
                return (
                  <button aria-label="View"
                    key={tab.id}
                    onClick={() => setActiveView(tab.id as typeof activeView)}
                    className={`flex items-center px-6 py-4 text-sm font-medium border-b-2 transition-all duration-200 ${
                      activeView === tab.id
                        ? 'border-blue-500 text-blue-600 bg-blue-50'
                        : 'border-transparent text-gray-600 hover:text-gray-900 hover:border-gray-300 hover:bg-gray-50'
                    }`}
                  >
                    <Icon className="mr-2 h-4 w-4" />
                    {tab.name}
                  </button>
                );
              })}
            </div>
          </CardContent>
        </Card>

        {/* Content */}
        {activeView === 'dashboard' && renderDashboard()}
        {activeView === 'properties' && renderProperties()}
        {activeView === 'groups' && renderGroups()}
        {activeView === 'analytics' && renderAnalytics()}
      </div>

      {/* Property Details Modal */}
      {selectedProperty && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center p-4 z-50">
          <Card className="w-full max-w-4xl max-h-[90vh] overflow-y-auto">
            <CardHeader>
              <div className="flex items-center justify-between">
                <CardTitle>{selectedProperty.name}</CardTitle>
                <div className="flex space-x-2">
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => {
                      setSelectedPropertyForEdit(selectedProperty.originalHotel || selectedProperty);
                      setShowEditProperty(true);
                    }}
                  >
                    <Edit className="h-4 w-4" />
                  </Button>
                  <Button variant="outline" size="sm" onClick={() => setSelectedProperty(null)}>
                    <XCircle className="h-4 w-4" />
                  </Button>
                </div>
              </div>
            </CardHeader>
            <CardContent className="space-y-6">
              {/* Basic Info */}
              <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                <Card>
                  <CardHeader>
                    <CardTitle className="text-lg">Property Information</CardTitle>
                  </CardHeader>
                  <CardContent className="space-y-3">
                    <div className="grid grid-cols-2 gap-3 text-sm">
                      <div>
                        <span className="text-muted-foreground">Brand:</span>
                        <div className="font-medium">{selectedProperty.brand}</div>
                      </div>
                      <div>
                        <span className="text-muted-foreground">Type:</span>
                        <div className="font-medium capitalize">{selectedProperty.type}</div>
                      </div>
                      <div>
                        <span className="text-muted-foreground">Rating:</span>
                        <div className="font-medium flex items-center">
                          <Star className="h-4 w-4 fill-yellow-400 text-yellow-400 mr-1" />
                          {selectedProperty.rating}
                        </div>
                      </div>
                      <div>
                        <span className="text-muted-foreground">Status:</span>
                        <Badge variant={getStatusColor(selectedProperty.status) as unknown}>
                          {selectedProperty.status}
                        </Badge>
                      </div>
                    </div>
                    <div>
                      <span className="text-muted-foreground">Address:</span>
                      <div className="font-medium">{selectedProperty.location.address}</div>
                      <div className="text-sm">{selectedProperty.location.city}, {selectedProperty.location.country}</div>
                    </div>
                  </CardContent>
                </Card>

                <Card>
                  <CardHeader>
                    <CardTitle className="text-lg">Contact Information</CardTitle>
                  </CardHeader>
                  <CardContent className="space-y-3">
                    <div className="flex items-center">
                      <Phone className="mr-2 h-4 w-4 text-muted-foreground" />
                      <span>{selectedProperty.contact.phone}</span>
                    </div>
                    <div className="flex items-center">
                      <Mail className="mr-2 h-4 w-4 text-muted-foreground" />
                      <span>{selectedProperty.contact.email}</span>
                    </div>
                    <div className="flex items-center">
                      <User className="mr-2 h-4 w-4 text-muted-foreground" />
                      <span>Manager: {selectedProperty.contact.manager}</span>
                    </div>
                  </CardContent>
                </Card>
              </div>

              {/* Performance Metrics */}
              <Card>
                <CardHeader>
                  <CardTitle className="text-lg">Performance Metrics</CardTitle>
                </CardHeader>
                <CardContent>
                  <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                    <div className="text-center">
                      <div className="text-2xl font-bold">{selectedProperty.performance.occupancyRate}%</div>
                      <div className="text-sm text-muted-foreground">Occupancy Rate</div>
                    </div>
                    <div className="text-center">
                      <div className="text-2xl font-bold">₹{selectedProperty.performance.adr}</div>
                      <div className="text-sm text-muted-foreground">ADR</div>
                    </div>
                    <div className="text-center">
                      <div className="text-2xl font-bold">₹{selectedProperty.performance.revpar.toFixed(0)}</div>
                      <div className="text-sm text-muted-foreground">RevPAR</div>
                    </div>
                    <div className="text-center">
                      <div className="text-2xl font-bold">₹{(selectedProperty.performance?.revenue || 0).toLocaleString()}</div>
                      <div className="text-sm text-muted-foreground">Revenue</div>
                    </div>
                  </div>
                </CardContent>
              </Card>

              {/* Features and Amenities */}
              <Card>
                <CardHeader>
                  <CardTitle className="text-lg">Features & Amenities</CardTitle>
                </CardHeader>
                <CardContent>
                  <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-4">
                    {Object.entries(selectedProperty.features).map(([feature, enabled]) => {
                      const icons: { [key: string]: React.ComponentType<unknown> } = {
                        pms: Settings,
                        pos: IndianRupee,
                        spa: Star,
                        restaurant: Utensils,
                        parking: Car,
                        wifi: Wifi,
                        fitness: Dumbbell,
                        pool: Coffee
                      };
                      const Icon = icons[feature] || CheckCircle;
                      
                      return (
                        <div key={feature} className={`flex items-center space-x-2 ${enabled ? 'text-green-600' : 'text-muted-foreground'}`}>
                          <Icon className="h-4 w-4" />
                          <span className="capitalize text-sm">{feature}</span>
                          {enabled ? <CheckCircle className="h-3 w-3" /> : <XCircle className="h-3 w-3" />}
                        </div>
                      );
                    })}
                  </div>
                  
                  <div className="pt-4 border-t">
                    <div className="text-sm font-medium mb-2">Amenities:</div>
                    <div className="flex flex-wrap gap-2">
                      {selectedProperty.amenities.map(amenity => (
                        <Badge key={amenity} variant="secondary">{amenity}</Badge>
                      ))}
                    </div>
                  </div>
                </CardContent>
              </Card>
            </CardContent>
          </Card>
        </div>
      )}

      {/* Property Assignment Modal */}
      {showPropertyAssignment && targetGroup && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center p-4 z-50">
          <Card className="w-full max-w-4xl max-h-[90vh] overflow-y-auto">
            <CardHeader>
              <div className="flex items-center justify-between">
                <div>
                  <CardTitle>Manage Properties for {targetGroup.name}</CardTitle>
                  <p className="text-sm text-muted-foreground mt-1">
                    Add or remove properties from this group
                  </p>
                </div>
                <Button 
                  variant="outline" 
                  size="sm" 
                  onClick={() => {
                    setShowPropertyAssignment(false);
                    setTargetGroup(null);
                    setSelectedPropertiesForAssignment([]);
                  }}
                >
                  <XCircle className="h-4 w-4" />
                </Button>
              </div>
            </CardHeader>
            <CardContent>
              <div className="space-y-4">
                {/* Current Properties in Group */}
                <div>
                  <h4 className="text-sm font-medium mb-2 flex items-center">
                    <Building2 className="mr-2 h-4 w-4" />
                    Current Properties ({targetGroup.properties?.length || 0})
                  </h4>
                  {targetGroup.properties && targetGroup.properties.length > 0 ? (
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-2">
                      {targetGroup.properties.map((propertyId: string) => {
                        const property = properties.find(p => p.id === propertyId);
                        if (!property) return null;
                        
                        return (
                          <div key={property.id} className="flex items-center justify-between p-2 border rounded">
                            <div className="flex items-center space-x-2">
                              <Building2 className="h-4 w-4 text-blue-600" />
                              <div>
                                <div className="text-sm font-medium">{property.name}</div>
                                <div className="text-xs text-muted-foreground">{property.location.city}</div>
                              </div>
                            </div>
                            <Button
                              variant="outline"
                              size="sm"
                              onClick={() => handleRemovePropertiesFromGroup(targetGroup._id, [property.id])}
                            >
                              <Trash2 className="h-3 w-3" />
                            </Button>
                          </div>
                        );
                      })}
                    </div>
                  ) : (
                    <p className="text-sm text-muted-foreground">No properties assigned to this group yet.</p>
                  )}
                </div>

                {/* Available Properties to Add */}
                <div>
                  <h4 className="text-sm font-medium mb-2 flex items-center">
                    <Plus className="mr-2 h-4 w-4" />
                    Available Properties
                  </h4>
                  <div className="space-y-2 max-h-60 overflow-y-auto">
                    {properties
                      .filter(property => !targetGroup.properties?.includes(property.id))
                      .map(property => (
                        <label
                          key={property.id}
                          className="flex items-center space-x-3 p-2 border rounded hover:bg-gray-50 cursor-pointer"
                        >
                          <input
                            type="checkbox"
                            checked={selectedPropertiesForAssignment.includes(property.id)}
                            onChange={(e) => handlePropertySelection(property.id, e.target.checked)}
                            className="rounded"
                          />
                          <Building2 className="h-4 w-4 text-gray-400" />
                          <div className="flex-1">
                            <div className="text-sm font-medium">{property.name}</div>
                            <div className="text-xs text-muted-foreground">
                              {property.location.city} • {property.rooms.total} rooms • {property.type}
                            </div>
                          </div>
                          <Badge variant="outline">
                            {property.status}
                          </Badge>
                        </label>
                      ))}
                  </div>
                </div>

                {/* Action Buttons */}
                {selectedPropertiesForAssignment.length > 0 && (
                  <div className="flex items-center justify-between pt-4 border-t">
                    <div className="text-sm text-muted-foreground">
                      {selectedPropertiesForAssignment.length} property(ies) selected
                    </div>
                    <div className="flex space-x-2">
                      <Button
                        variant="outline"
                        onClick={() => setSelectedPropertiesForAssignment([])}
                      >
                        Clear Selection
                      </Button>
                      <Button onClick={handleBulkAssignment}>
                        <Plus className="mr-2 h-4 w-4" />
                        Add to Group
                      </Button>
                    </div>
                  </div>
                )}
              </div>
            </CardContent>
          </Card>
        </div>
      )}

      {/* Add Property Modal */}
      <AddPropertyModal
        isOpen={showAddProperty}
        onClose={() => setShowAddProperty(false)}
        onSuccess={() => {
          refetchProperties();
          setShowAddProperty(false);
        }}
      />

      {/* Edit Property Modal */}
      <EditPropertyModal
        isOpen={showEditProperty}
        onClose={() => {
          setShowEditProperty(false);
          setSelectedPropertyForEdit(null);
        }}
        onSuccess={() => {
          refetchProperties();
          setShowEditProperty(false);
          setSelectedPropertyForEdit(null);
        }}
        property={selectedPropertyForEdit}
      />

      {/* Add Group Modal */}
      <AddGroupModal
        isOpen={showAddGroup}
        onClose={() => setShowAddGroup(false)}
        onSuccess={() => {
          refetchPropertyGroups();
          setShowAddGroup(false);
        }}
      />

      {/* Edit Group Modal */}
      <EditGroupModal
        isOpen={showEditGroup}
        onClose={() => {
          setShowEditGroup(false);
          setSelectedGroupForEdit(null);
        }}
        onSuccess={() => {
          refetchPropertyGroups();
          setShowEditGroup(false);
          setSelectedGroupForEdit(null);
        }}
        group={selectedGroupForEdit}
      />

      {/* Export Modal */}
      <ExportModal
        isOpen={showExportModal}
        onClose={() => setShowExportModal(false)}
        properties={properties}
        groups={propertyGroups}
      />

      {/* Group Dashboard Modal */}
      {showGroupDashboard && selectedGroupForDashboard && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center p-4 z-50">
          <Card className="w-full max-w-6xl max-h-[90vh] overflow-y-auto">
            <CardHeader>
              <div className="flex items-center justify-between">
                <div>
                  <CardTitle className="text-2xl">{selectedGroupForDashboard.name} Dashboard</CardTitle>
                  <p className="text-sm text-muted-foreground mt-1">
                    Comprehensive analytics and performance overview
                  </p>
                </div>
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={() => setShowGroupDashboard(false)}
                >
                  <XCircle className="h-4 w-4" />
                </Button>
              </div>
            </CardHeader>
            <CardContent className="space-y-6">
              {/* Key Performance Metrics */}
              <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
                <Card>
                  <CardContent className="p-4">
                    <div className="flex items-center space-x-2">
                      <Building2 className="h-5 w-5 text-blue-600" />
                      <div>
                        <p className="text-sm font-medium text-muted-foreground">Properties</p>
                        <p className="text-2xl font-bold">{selectedGroupForDashboard.properties?.length || 0}</p>
                      </div>
                    </div>
                  </CardContent>
                </Card>

                <Card>
                  <CardContent className="p-4">
                    <div className="flex items-center space-x-2">
                      <TrendingUp className="h-5 w-5 text-green-600" />
                      <div>
                        <p className="text-sm font-medium text-muted-foreground">Avg Occupancy</p>
                        <p className="text-2xl font-bold text-green-600">
                          {selectedGroupForDashboard.performance?.avgOccupancy || 0}%
                        </p>
                      </div>
                    </div>
                  </CardContent>
                </Card>

                <Card>
                  <CardContent className="p-4">
                    <div className="flex items-center space-x-2">
                      <IndianRupee className="h-5 w-5 text-purple-600" />
                      <div>
                        <p className="text-sm font-medium text-muted-foreground">Total Revenue</p>
                        <p className="text-2xl font-bold text-purple-600">
                          ₹{(selectedGroupForDashboard.performance?.totalRevenue || 0).toLocaleString()}
                        </p>
                      </div>
                    </div>
                  </CardContent>
                </Card>

                <Card>
                  <CardContent className="p-4">
                    <div className="flex items-center space-x-2">
                      <Users className="h-5 w-5 text-orange-600" />
                      <div>
                        <p className="text-sm font-medium text-muted-foreground">Total Rooms</p>
                        <p className="text-2xl font-bold text-orange-600">
                          {selectedGroupForDashboard.properties?.reduce((sum, p) => sum + (p.rooms?.total || 0), 0) || 0}
                        </p>
                      </div>
                    </div>
                  </CardContent>
                </Card>
              </div>

              {/* Group Information */}
              <Card>
                <CardHeader>
                  <CardTitle className="text-lg">Group Information</CardTitle>
                </CardHeader>
                <CardContent>
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    <div>
                      <p className="text-sm font-medium text-muted-foreground">Group Type</p>
                      <p className="text-lg capitalize">{selectedGroupForDashboard.groupType || 'Standard'}</p>
                    </div>
                    <div>
                      <p className="text-sm font-medium text-muted-foreground">Status</p>
                      <Badge className={selectedGroupForDashboard.status === 'active' ? 'bg-green-100 text-green-800' : 'bg-gray-100 text-gray-800'}>
                        {selectedGroupForDashboard.status || 'Active'}
                      </Badge>
                    </div>
                    <div>
                      <p className="text-sm font-medium text-muted-foreground">Manager</p>
                      <p className="text-lg">{selectedGroupForDashboard.manager || 'Not assigned'}</p>
                    </div>
                    <div>
                      <p className="text-sm font-medium text-muted-foreground">Budget</p>
                      <p className="text-lg">₹{(selectedGroupForDashboard.budget || 0).toLocaleString()}</p>
                    </div>
                  </div>
                  {selectedGroupForDashboard.description && (
                    <div className="mt-4">
                      <p className="text-sm font-medium text-muted-foreground">Description</p>
                      <p className="text-sm mt-1">{selectedGroupForDashboard.description}</p>
                    </div>
                  )}
                </CardContent>
              </Card>

              {/* Properties in Group */}
              <Card>
                <CardHeader>
                  <CardTitle className="text-lg">Properties in Group</CardTitle>
                </CardHeader>
                <CardContent>
                  {selectedGroupForDashboard.properties && selectedGroupForDashboard.properties.length > 0 ? (
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                      {selectedGroupForDashboard.properties.map((property: Record<string, unknown>) => (
                        <div key={property.id || property._id} className="p-4 border rounded-lg">
                          <div className="flex items-center justify-between">
                            <div>
                              <h4 className="font-medium">{property.name}</h4>
                              <p className="text-sm text-muted-foreground">{property.location?.city}</p>
                            </div>
                            <div className="text-right">
                              <p className="font-medium">{property.rooms?.total || 0} rooms</p>
                              <p className="text-sm text-green-600">{property.performance?.occupancyRate || 0}% occupied</p>
                            </div>
                          </div>
                        </div>
                      ))}
                    </div>
                  ) : (
                    <div className="text-center py-8">
                      <Building2 className="h-12 w-12 text-gray-400 mx-auto mb-4" />
                      <p className="text-gray-500">No properties assigned to this group</p>
                      <Button
                        variant="outline"
                        className="mt-2"
                        onClick={() => {
                          setShowGroupDashboard(false);
                          openPropertyAssignmentModal(selectedGroupForDashboard);
                        }}
                      >
                        Assign Properties
                      </Button>
                    </div>
                  )}
                </CardContent>
              </Card>

              {/* Group Settings Summary */}
              <Card>
                <CardHeader>
                  <CardTitle className="text-lg">Group Settings</CardTitle>
                </CardHeader>
                <CardContent>
                  <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                    <div>
                      <p className="text-sm font-medium text-muted-foreground">Base Currency</p>
                      <p className="text-lg">{selectedGroupForDashboard.settings?.baseCurrency || 'INR'}</p>
                    </div>
                    <div>
                      <p className="text-sm font-medium text-muted-foreground">Timezone</p>
                      <p className="text-lg">{selectedGroupForDashboard.settings?.timezone || 'UTC'}</p>
                    </div>
                    <div>
                      <p className="text-sm font-medium text-muted-foreground">Default Language</p>
                      <p className="text-lg">{selectedGroupForDashboard.settings?.defaultLanguage || 'en'}</p>
                    </div>
                  </div>
                </CardContent>
              </Card>

              {/* Action Buttons */}
              <div className="flex justify-end space-x-2">
                <Button
                  variant="outline"
                  onClick={() => {
                    setSelectedGroupForEdit(selectedGroupForDashboard);
                    setShowEditGroup(true);
                    setShowGroupDashboard(false);
                  }}
                >
                  <Settings className="mr-2 h-4 w-4" />
                  Edit Settings
                </Button>
                <Button
                  onClick={() => {
                    openPropertyAssignmentModal(selectedGroupForDashboard);
                    setShowGroupDashboard(false);
                  }}
                >
                  <Building2 className="mr-2 h-4 w-4" />
                  Manage Properties
                </Button>
              </div>
            </CardContent>
          </Card>
        </div>
      )}

      {/* Confirmation Dialog */}
      <AlertDialog open={confirmDialog.open} onOpenChange={(open) => setConfirmDialog(prev => ({ ...prev, open }))}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>{confirmDialog.title}</AlertDialogTitle>
            <AlertDialogDescription>{confirmDialog.description}</AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction
              onClick={() => {
                confirmDialog.onConfirm();
                setConfirmDialog(prev => ({ ...prev, open: false }));
              }}
              className="bg-red-600 hover:bg-red-700"
            >
              Confirm
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
};

export default withErrorBoundary(MultiPropertyManager, { level: 'component' });