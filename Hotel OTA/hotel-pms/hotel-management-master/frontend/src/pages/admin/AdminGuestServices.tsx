import React, { useState, useEffect } from 'react';
import { format, parseISO } from 'date-fns';
import '../../styles/admin-guest-services-animations.css';
import {
  Headphones,
  Clock,
  CheckCircle,
  AlertCircle,
  Filter,
  Eye,
  User,
  MapPin,
  MessageSquare,
  Phone,
  RefreshCw,
  UserCheck,
  Play,
  CheckSquare,
  Users,
  Activity,
  TrendingUp,
  Star,
  Settings,
  Zap,
  Target,
  BarChart3,
  Bell,
  Package,
  AlertTriangle,
  Mail,
  Calendar,
  FileText,
  UserPlus,
  DollarSign,
  Download,
  FileSpreadsheet,
  CheckSquare2,
  Square
} from 'lucide-react';
import { Card, CardContent, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Modal } from '@/components/ui/Modal';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { DataTable } from '../../components/dashboard/DataTable';
import { StatusBadge } from '../../components/dashboard/StatusBadge';
import { LoadingSpinner } from '../../components/LoadingSpinner';
import ErrorBoundary from '../../components/ErrorBoundary';
import GuestInventoryTracker from '../../components/admin/GuestInventoryTracker';
import ServiceTypeManager from '../../components/admin/ServiceTypeManager';
import ServiceAnalytics from '../../components/admin/ServiceAnalytics';
import SLATracker from '../../components/admin/SLATracker';
import { formatCurrency } from '../../utils/currencyUtils';
import toast from 'react-hot-toast';
import { adminGuestServicesService, GuestService, GuestServiceStats, GuestServiceFilters } from '../../services/adminGuestServicesService';
import { useRealTime } from '../../services/realTimeService';
import { useProperty } from '../../context/PropertyContext';
import { PropertyBreadcrumb } from '../../components/common/PropertyBreadcrumb';


export default function AdminGuestServices() {
  const { selectedPropertyId, viewMode } = useProperty();
  const [services, setServices] = useState<GuestService[]>([]);
  const [stats, setStats] = useState<GuestServiceStats>({
    total: 0,
    pending: 0,
    assigned: 0,
    inProgress: 0,
    completed: 0,
    cancelled: 0,
    avgResponseTime: 0,
    avgCompletionTime: 0,
    satisfactionScore: 0
  });
  const [loading, setLoading] = useState(true);
  const [updating, setUpdating] = useState(false);
  const [filters, setFilters] = useState<GuestServiceFilters>({ page: 1, limit: 20 });
  const [pagination, setPagination] = useState({ total: 0, pages: 0 });
  const [availableStaff, setAvailableStaff] = useState<Array<{ _id: string; name: string; email: string; department: string }>>([]);
  
  // Real-time connection
  const { connectionState, connect, on, off, isConnected } = useRealTime();
  
  // Modal states
  const [showViewModal, setShowViewModal] = useState(false);
  const [selectedService, setSelectedService] = useState<GuestService | null>(null);
  const [showAssignModal, setShowAssignModal] = useState(false);
  const [assignData, setAssignData] = useState({
    assignedTo: '',
    notes: '',
    scheduledTime: ''
  });

  // Bulk operations state
  const [selectedServices, setSelectedServices] = useState<Set<string>>(new Set());
  const [showBulkAssignModal, setShowBulkAssignModal] = useState(false);
  const [showExportModal, setShowExportModal] = useState(false);
  const [bulkOperating, setBulkOperating] = useState(false);
  const [exportFormat, setExportFormat] = useState<'csv' | 'json'>('csv');

  const fetchServices = async () => {
    try {
      setLoading(true);
      const response = await adminGuestServicesService.getServices({
        ...filters,
        hotelId: selectedPropertyId
      });
      setServices(response.data?.serviceRequests || []);
      setPagination({
        total: response.data?.pagination?.total || 0,
        pages: response.data?.pagination?.pages || 1
      });
    } catch (error) {
      toast.error('Failed to load guest services');
    } finally {
      setLoading(false);
    }
  };

  const fetchStats = async () => {
    try {
      // Service will handle hotelId dynamically
      const response = await adminGuestServicesService.getStats(selectedPropertyId);
      
      // Map backend response to frontend expected format
      // Backend returns { overall: {...}, byServiceType: [...] }
      const backendData = (response.data || {}) as Record<string, unknown>;
      const overall = (backendData.overall || {}) as Record<string, number>;

      // Convert avg times from milliseconds to minutes for display
      const avgResponseMs = Number(overall.totalResponseTime) || 0;
      const avgCompletionMs = Number(overall.totalCompletionTime) || 0;

      const mappedStats: GuestServiceStats = {
        total: Number(overall.totalRequests) || 0,
        pending: Number(overall.pendingCount) || 0,
        assigned: Number(overall.assignedCount) || 0,
        inProgress: Number(overall.inProgressCount) || 0,
        completed: Number(overall.completedCount) || 0,
        cancelled: Number(overall.cancelledCount) || 0,
        avgResponseTime: avgResponseMs > 0 ? Math.round(avgResponseMs / 60000) : 0,
        avgCompletionTime: avgCompletionMs > 0 ? Math.round(avgCompletionMs / 60000) : 0,
        satisfactionScore: overall.avgRating ? Math.round(Number(overall.avgRating) * 10) / 10 : 0
      };
      
      setStats(mappedStats);
    } catch (error) {
      toast.error('Failed to load guest service statistics');
    }
  };

  const fetchAvailableStaff = async () => {
    try {
      // Service will handle hotelId dynamically
      const response = await adminGuestServicesService.getAvailableStaff(selectedPropertyId);
      setAvailableStaff(response.data || []);
    } catch {
      // Error handled silently
    }
  };

  // Fetch data when filters or property changes
  useEffect(() => {
    if (selectedPropertyId) {
      fetchServices();
      fetchStats();
      fetchAvailableStaff();
    }
  }, [filters, selectedPropertyId]);

  // Connect to real-time updates once (separate from data fetching)
  // Do NOT disconnect on unmount — realTimeService is a singleton shared across components
  useEffect(() => {
    connect().catch(() => {
      // WebSocket unavailable -- page still works via manual refresh
    });
  }, [connect]);
  
  // Keep refs to latest fetch functions so socket handlers never use stale closures
  const fetchServicesRef = React.useRef(fetchServices);
  fetchServicesRef.current = fetchServices;
  const fetchStatsRef = React.useRef(fetchStats);
  fetchStatsRef.current = fetchStats;

  // Set up real-time event listeners
  useEffect(() => {
    if (!isConnected) return;

    const handleGuestServiceUpdate = () => {
      fetchServicesRef.current();
      fetchStatsRef.current();
      toast.success('Guest service data updated in real-time');
    };

    const handleGuestServiceCreate = () => {
      fetchServicesRef.current();
      fetchStatsRef.current();
      toast.success('New guest service request created');
    };

    // Subscribe to guest service events
    on('guest-services:created', handleGuestServiceCreate);
    on('guest-services:updated', handleGuestServiceUpdate);
    on('guest-services:status_changed', handleGuestServiceUpdate);

    return () => {
      off('guest-services:created', handleGuestServiceCreate);
      off('guest-services:updated', handleGuestServiceUpdate);
      off('guest-services:status_changed', handleGuestServiceUpdate);
    };
  }, [isConnected, on, off]);

  // Handle status update
  const handleStatusUpdate = async (serviceId: string, newStatus: 'assigned' | 'in_progress' | 'completed' | 'cancelled') => {
    try {
      setUpdating(true);
      await adminGuestServicesService.updateStatus(serviceId, newStatus);
      
      await fetchServices();
      await fetchStats();
      toast.success('Service status updated successfully');
    } catch (error) {
      toast.error('Failed to update service status');
    } finally {
      setUpdating(false);
    }
  };

  // Handle assignment
  const handleAssignService = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedService) return;

    try {
      setUpdating(true);
      await adminGuestServicesService.assignService(selectedService._id, assignData);
      
      await fetchServices();
      await fetchStats();
      setShowAssignModal(false);
      setAssignData({ assignedTo: '', notes: '', scheduledTime: '' });
      toast.success('Service assigned successfully');
    } catch (error) {
      toast.error('Failed to assign service');
    } finally {
      setUpdating(false);
    }
  };

  const handleViewService = (service: GuestService) => {
    setSelectedService(service);
    setShowViewModal(true);
  };

  const openAssignModal = (service: GuestService) => {
    setSelectedService(service);
    setShowAssignModal(true);
  };

  // Bulk operations handlers
  const handleSelectService = (serviceId: string, checked: boolean) => {
    const newSelected = new Set(selectedServices);
    if (checked) {
      newSelected.add(serviceId);
    } else {
      newSelected.delete(serviceId);
    }
    setSelectedServices(newSelected);
  };

  const handleSelectAll = (checked: boolean) => {
    if (checked) {
      const allIds = new Set(services.map(service => service._id));
      setSelectedServices(allIds);
    } else {
      setSelectedServices(new Set());
    }
  };

  const handleBulkAssign = async () => {
    if (selectedServices.size === 0 || !assignData.assignedTo) return;

    try {
      setBulkOperating(true);
      await adminGuestServicesService.bulkAssign(Array.from(selectedServices), assignData.assignedTo);

      await fetchServices();
      await fetchStats();
      setShowBulkAssignModal(false);
      setSelectedServices(new Set());
      setAssignData({ assignedTo: '', notes: '', scheduledTime: '' });
      toast.success(`${selectedServices.size} services assigned successfully`);
    } catch (error) {
      toast.error('Failed to assign services');
    } finally {
      setBulkOperating(false);
    }
  };

  const handleBulkStatusUpdate = async (status: string) => {
    if (selectedServices.size === 0) return;

    try {
      setBulkOperating(true);
      await adminGuestServicesService.bulkUpdateStatus(Array.from(selectedServices), status);

      await fetchServices();
      await fetchStats();
      setSelectedServices(new Set());
      toast.success(`${selectedServices.size} services updated to ${status}`);
    } catch (error) {
      toast.error('Failed to update services');
    } finally {
      setBulkOperating(false);
    }
  };

  const handleExport = async () => {
    try {
      setBulkOperating(true);
      const blob = await adminGuestServicesService.exportServices(filters, exportFormat, selectedPropertyId);

      // Create download link
      const url = window.URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.style.display = 'none';
      a.href = url;
      a.download = `guest-services-${new Date().toISOString().split('T')[0]}.${exportFormat}`;
      document.body.appendChild(a);
      a.click();
      window.URL.revokeObjectURL(url);
      document.body.removeChild(a);

      setShowExportModal(false);
      toast.success('Export completed successfully');
    } catch (error) {
      toast.error('Failed to export services');
    } finally {
      setBulkOperating(false);
    }
  };

  const getServiceTypeIcon = (type: string) => {
    const icons: Record<string, React.ReactNode> = {
      room_service: <Headphones className="h-4 w-4" />,
      housekeeping: <Clock className="h-4 w-4" />,
      maintenance: <AlertCircle className="h-4 w-4" />,
      concierge: <User className="h-4 w-4" />,
      transport: <MapPin className="h-4 w-4" />,
      spa: <CheckCircle className="h-4 w-4" />,
      laundry: <RefreshCw className="h-4 w-4" />,
      other: <MessageSquare className="h-4 w-4" />
    };
    return icons[type] || <MessageSquare className="h-4 w-4" />;
  };

  const getServiceTypeColor = (type: string) => {
    const colors: Record<string, string> = {
      room_service: 'bg-blue-100 text-blue-800',
      housekeeping: 'bg-green-100 text-green-800',
      maintenance: 'bg-orange-100 text-orange-800',
      concierge: 'bg-purple-100 text-purple-800',
      transport: 'bg-indigo-100 text-indigo-800',
      spa: 'bg-pink-100 text-pink-800',
      laundry: 'bg-cyan-100 text-cyan-800',
      other: 'bg-gray-100 text-gray-800'
    };
    return colors[type] || 'bg-gray-100 text-gray-800';
  };

  const getPriorityColor = (priority: string) => {
    const colors: Record<string, string> = {
      low: 'bg-gray-100 text-gray-800',
      medium: 'bg-yellow-100 text-yellow-800',
      high: 'bg-orange-100 text-orange-800',
      urgent: 'bg-red-100 text-red-800'
    };
    return colors[priority] || 'bg-gray-100 text-gray-800';
  };

  const columns = [
    {
      key: 'select',
      header: (
        <div className="flex items-center">
          <input
            type="checkbox"
            checked={selectedServices.size > 0 && selectedServices.size === services.length}
            onChange={(e) => handleSelectAll(e.target.checked)}
            className="w-4 h-4 text-blue-600 bg-gray-100 border-gray-300 rounded focus:ring-blue-500"
          />
        </div>
      ),
      render: (value: unknown, service: GuestService) => {
        if (!service) return <div>No data</div>;
        return (
          <div className="flex items-center">
            <input
              type="checkbox"
              checked={selectedServices.has(service._id)}
              onChange={(e) => handleSelectService(service._id, e.target.checked)}
              className="w-4 h-4 text-blue-600 bg-gray-100 border-gray-300 rounded focus:ring-blue-500"
            />
          </div>
        );
      }
    },
    {
      key: 'serviceType',
      header: 'Service',
      render: (value: unknown, service: GuestService) => {
        if (!service) return <div>No data</div>;
        return (
          <div className="flex items-center space-x-3">
            <div className={`p-2 rounded-lg ${getServiceTypeColor(service.serviceType)}`}>
              {getServiceTypeIcon(service.serviceType)}
            </div>
            <div>
              <div className="font-medium text-gray-900">{service.title}</div>
              <div className="text-sm text-gray-500">{service.description}</div>
            </div>
          </div>
        );
      }
    },
    {
      key: 'guest',
      header: 'Guest',
      render: (value: unknown, service: GuestService) => {
        if (!service) return <div>No data</div>;
        return (
          <div className="text-sm">
            <div className="font-medium">{service.userId?.name}</div>
            <div className="text-gray-500">Room {service.bookingId?.rooms?.[0]?.roomId?.roomNumber}</div>
            <div className="text-gray-500">{service.bookingId?.bookingNumber}</div>
          </div>
        );
      }
    },
    {
      key: 'priority',
      header: 'Priority',
      render: (value: unknown, service: GuestService) => {
        if (!service) return <div>No data</div>;
        return (
          <span className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium ${getPriorityColor(service.priority)}`}>
            {service.priority}
          </span>
        );
      }
    },
    {
      key: 'assignedTo',
      header: 'Assigned To',
      render: (value: unknown, service: GuestService) => {
        if (!service) return <div>No data</div>;
        return (
          <div className="text-sm">
            {service.assignedTo ? (
              <>
                <div className="font-medium">{service.assignedTo.name}</div>
                <div className="text-gray-500">{service.assignedTo.email}</div>
              </>
            ) : (
              <span className="text-gray-400">Unassigned</span>
            )}
          </div>
        );
      }
    },
    {
      key: 'status',
      header: 'Status',
      render: (value: unknown, service: GuestService) => {
        if (!service) return <div>No data</div>;
        return (
          <StatusBadge 
            status={service.status} 
            colorMap={{
              pending: 'yellow',
              assigned: 'blue',
              in_progress: 'orange',
              completed: 'green',
              cancelled: 'red'
            }}
          />
        );
      }
    },
    {
      key: 'cost',
      header: 'Cost',
      render: (value: unknown, service: GuestService) => {
        if (!service) return <div>No data</div>;
        return (
          <div className="text-sm">
                         {service.actualCost ? (
               <div>
                 <div className="font-medium">{formatCurrency(service.actualCost)}</div>
                 {service.actualCost !== service.estimatedCost && (
                   <div className="text-gray-500">Est: {formatCurrency(service.estimatedCost || 0)}</div>
                 )}
               </div>
             ) : (
               <div className="text-gray-600">{formatCurrency(service.estimatedCost || 0)}</div>
             )}
          </div>
        );
      }
    },
    {
      key: 'createdAt',
      header: 'Created',
      render: (value: unknown, service: GuestService) => {
        if (!service || !service.createdAt) return <div>No data</div>;
        return (
          <div className="text-sm text-gray-600">
            {format(parseISO(service.createdAt), 'MMM dd, HH:mm')}
          </div>
        );
      }
    },
    {
      key: 'actions',
      header: 'Actions',
      render: (value: unknown, service: GuestService) => {
        if (!service) return <div>No data</div>;
        return (
          <div className="flex items-center space-x-3">
            <Button
              size="sm"
              onClick={() => handleViewService(service)}
              className="bg-gradient-to-r from-blue-500 to-indigo-500 hover:from-blue-600 hover:to-indigo-600 text-white px-3 py-2 rounded-lg shadow-md hover:shadow-lg transition-all duration-200 transform hover:scale-105"
            >
              <Eye className="h-4 w-4" />
            </Button>
            {service.status === 'pending' && (
              <Button
                size="sm"
                onClick={() => openAssignModal(service)}
                disabled={updating}
                className="bg-gradient-to-r from-green-500 to-emerald-500 hover:from-green-600 hover:to-emerald-600 text-white px-3 py-2 rounded-lg shadow-md hover:shadow-lg transition-all duration-200 transform hover:scale-105 disabled:opacity-50 disabled:cursor-not-allowed"
              >
                <UserCheck className="h-4 w-4" />
              </Button>
            )}
            {service.status === 'assigned' && (
              <Button
                size="sm"
                onClick={() => handleStatusUpdate(service._id, 'in_progress')}
                disabled={updating}
                className="bg-gradient-to-r from-yellow-500 to-orange-500 hover:from-yellow-600 hover:to-orange-600 text-white px-3 py-2 rounded-lg shadow-md hover:shadow-lg transition-all duration-200 transform hover:scale-105 disabled:opacity-50 disabled:cursor-not-allowed"
              >
                <Play className="h-4 w-4" />
              </Button>
            )}
            {(service.status === 'in_progress' || service.status === 'assigned') && (
              <Button
                size="sm"
                onClick={() => handleStatusUpdate(service._id, 'completed')}
                disabled={updating}
                className="bg-gradient-to-r from-green-600 to-emerald-600 hover:from-green-700 hover:to-emerald-700 text-white px-3 py-2 rounded-lg shadow-md hover:shadow-lg transition-all duration-200 transform hover:scale-105 disabled:opacity-50 disabled:cursor-not-allowed"
              >
                <CheckSquare className="h-4 w-4" />
              </Button>
            )}
          </div>
        );
      },
      align: 'center' as const
    }
  ];

  // Early return if no property selected in single property mode
  if (!selectedPropertyId && viewMode === 'single') {
    return (
      <div className="p-6">
        <PropertyBreadcrumb items={['Services', 'Guest Services']} />
        <div className="text-center py-12">
          <p className="text-gray-600">Please select a property to manage guest services</p>
        </div>
      </div>
    );
  }

  if (loading && !services.length) {
    return (
      <div className="flex items-center justify-center h-64">
        <LoadingSpinner />
      </div>
    );
  }

  return (
    <ErrorBoundary level="page" onError={() => {
      toast.error('An error occurred in the guest services management page');
    }}>
    <div className="min-h-screen bg-gradient-to-br from-slate-50 via-blue-50 to-indigo-50 relative overflow-hidden">
      {/* Property Breadcrumb */}
      <div className="relative z-10 px-3 sm:px-6 lg:px-8">
        <PropertyBreadcrumb items={['Services', 'Guest Services']} />
      </div>
      {/* Animated Background Elements */}
      <div className="absolute inset-0 overflow-hidden pointer-events-none">
        <div className="absolute top-10 left-10 w-72 h-72 bg-gradient-to-br from-blue-400/20 to-indigo-600/20 rounded-full blur-3xl animate-float"></div>
        <div className="absolute top-32 right-16 w-96 h-96 bg-gradient-to-br from-purple-400/15 to-pink-600/15 rounded-full blur-3xl animate-float-delayed"></div>
        <div className="absolute bottom-20 left-1/4 w-80 h-80 bg-gradient-to-br from-emerald-400/20 to-cyan-600/20 rounded-full blur-3xl animate-float-slow"></div>
      </div>
      <div className="px-3 py-4 sm:px-6 sm:py-6 lg:px-8 max-w-8xl mx-auto">
        {/* Header */}
        <div className="relative mb-8 hover-lift">
          <div className="absolute inset-0 bg-gradient-to-r from-blue-600 to-indigo-600 transform -skew-y-1 shadow-xl rounded-3xl animate-pulse-glow"></div>
          <div className="relative glass-effect p-6 sm:p-8 rounded-3xl shadow-2xl border border-white/20 hover:backdrop-blur-lg transition-all duration-300">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between space-y-4 sm:space-y-0">
              <div className="flex items-center space-x-4">
                <div className="p-3 bg-gradient-to-br from-blue-500 to-indigo-600 rounded-2xl shadow-lg animate-float">
                  <Bell className="w-8 h-8 text-white" />
                </div>
                <div>
                  <h1 className="text-3xl sm:text-4xl font-bold text-gradient-blue animate-scale-bounce">
                    Guest Services Management
                  </h1>
                  <p className="text-gray-600 mt-1 font-medium">Monitor and manage guest service requests</p>
                </div>
              </div>

              <div className="flex flex-col sm:flex-row items-center space-y-2 sm:space-y-0 sm:space-x-3">
                {/* Real-time connection status */}
                <div
                  className="flex items-center space-x-2 px-3 py-2 bg-white/70 backdrop-blur-sm rounded-xl shadow-sm cursor-pointer"
                  onClick={() => {
                    if (connectionState === 'disconnected') {
                      connect().catch(() => { /* retry silently */ });
                    }
                  }}
                  title={connectionState === 'disconnected' ? 'Click to retry real-time connection. Data still refreshes via API.' : `Real-time: ${connectionState}`}
                >
                  <div className={`w-2 h-2 rounded-full ${
                    connectionState === 'connected' ? 'bg-green-500 animate-pulse' :
                    connectionState === 'connecting' ? 'bg-yellow-500 animate-bounce' : 'bg-gray-400'
                  }`}></div>
                  <span className="text-xs text-gray-600 capitalize font-medium">
                    {connectionState === 'connected' ? 'Live' : connectionState === 'connecting' ? 'Connecting...' : 'Manual Refresh'}
                  </span>
                </div>

                <Button
                  onClick={() => { fetchServices(); fetchStats(); fetchAvailableStaff(); }}
                  variant="secondary"
                  size="sm"
                  disabled={loading}
                  className="btn-glow-blue text-white font-semibold px-4 sm:px-6 py-2.5 rounded-xl shadow-lg hover:shadow-xl transition-all duration-200 transform hover:scale-105 disabled:opacity-50 w-full sm:w-auto"
                >
                  <RefreshCw className={`w-4 h-4 mr-2 ${loading ? 'animate-spin' : ''}`} />
                  <span className="hidden sm:inline">Refresh</span>
                  <span className="sm:hidden">Refresh Data</span>
                </Button>
              </div>
            </div>
          </div>
        </div>

        {/* Stats Cards */}
        {stats && (
          <div className="grid grid-cols-1 xs:grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-6 xl:grid-cols-9 gap-3 mb-8">
            {/* Total Requests */}
            <div className="relative group hover-lift stagger-animation">
              <div className="absolute inset-0 bg-gradient-to-r from-blue-500 to-cyan-500 rounded-xl blur opacity-75 group-hover:opacity-100 transition duration-300 animate-pulse-glow"></div>
              <Card className="relative glass-effect border-0 shadow-lg hover:shadow-xl transition-all duration-300 transform hover:scale-105 rounded-xl h-24 animate-float">
                <CardContent className="p-3 text-center flex flex-col justify-center h-full">
                  <div className="flex items-center justify-center mb-1">
                    <div className="p-1.5 bg-gradient-to-br from-blue-500 to-cyan-500 rounded-lg animate-scale-bounce">
                      <BarChart3 className="w-4 h-4 text-white" />
                    </div>
                  </div>
                  <div className="text-xl font-bold text-gradient-blue animate-scale-bounce">{stats.total}</div>
                  <div className="text-xs font-medium text-gray-600">Total Requests</div>
                </CardContent>
              </Card>
            </div>

            {/* Pending */}
            <div className="relative group hover-lift stagger-animation">
              <div className="absolute inset-0 bg-gradient-to-r from-yellow-400 to-orange-400 rounded-xl blur opacity-75 group-hover:opacity-100 transition duration-300"></div>
              <Card className="relative glass-effect border-0 shadow-lg hover:shadow-xl transition-all duration-300 transform hover:scale-105 rounded-xl h-24 animate-float">
                <CardContent className="p-3 text-center flex flex-col justify-center h-full">
                  <div className="flex items-center justify-center mb-1">
                    <div className="p-1.5 bg-gradient-to-br from-yellow-400 to-orange-400 rounded-lg animate-scale-bounce">
                      <Clock className="w-4 h-4 text-white" />
                    </div>
                  </div>
                  <div className="text-xl font-bold text-gradient-blue animate-scale-bounce">{stats.pending}</div>
                  <div className="text-xs font-medium text-gray-600">Pending</div>
                </CardContent>
              </Card>
            </div>

            {/* Assigned */}
            <div className="relative group hover-lift stagger-animation">
              <div className="absolute inset-0 bg-gradient-to-r from-indigo-500 to-purple-500 rounded-xl blur opacity-75 group-hover:opacity-100 transition duration-200"></div>
              <Card className="relative bg-white/90 backdrop-blur-sm border-0 shadow-lg hover:shadow-xl transition-all duration-300 transform hover:scale-105 rounded-xl h-24">
                <CardContent className="p-3 text-center flex flex-col justify-center h-full">
                  <div className="flex items-center justify-center mb-1">
                    <div className="p-1.5 bg-gradient-to-br from-indigo-500 to-purple-500 rounded-lg">
                      <Users className="w-4 h-4 text-white" />
                    </div>
                  </div>
                  <div className="text-xl font-bold bg-gradient-to-r from-indigo-600 to-purple-600 bg-clip-text text-transparent">{stats.assigned}</div>
                  <div className="text-xs font-medium text-gray-600">Assigned</div>
                </CardContent>
              </Card>
            </div>

            {/* In Progress */}
            <div className="relative group hover-lift stagger-animation">
              <div className="absolute inset-0 bg-gradient-to-r from-orange-500 to-red-500 rounded-xl blur opacity-75 group-hover:opacity-100 transition duration-200"></div>
              <Card className="relative bg-white/90 backdrop-blur-sm border-0 shadow-lg hover:shadow-xl transition-all duration-300 transform hover:scale-105 rounded-xl h-24">
                <CardContent className="p-3 text-center flex flex-col justify-center h-full">
                  <div className="flex items-center justify-center mb-1">
                    <div className="p-1.5 bg-gradient-to-br from-orange-500 to-red-500 rounded-lg">
                      <Activity className="w-4 h-4 text-white" />
                    </div>
                  </div>
                  <div className="text-xl font-bold bg-gradient-to-r from-orange-600 to-red-600 bg-clip-text text-transparent">{stats.inProgress}</div>
                  <div className="text-xs font-medium text-gray-600">In Progress</div>
                </CardContent>
              </Card>
            </div>

            {/* Completed */}
            <div className="relative group hover-lift stagger-animation">
              <div className="absolute inset-0 bg-gradient-to-r from-green-500 to-emerald-500 rounded-xl blur opacity-75 group-hover:opacity-100 transition duration-200"></div>
              <Card className="relative bg-white/90 backdrop-blur-sm border-0 shadow-lg hover:shadow-xl transition-all duration-300 transform hover:scale-105 rounded-xl h-24">
                <CardContent className="p-3 text-center flex flex-col justify-center h-full">
                  <div className="flex items-center justify-center mb-1">
                    <div className="p-1.5 bg-gradient-to-br from-green-500 to-emerald-500 rounded-lg">
                      <CheckCircle className="w-4 h-4 text-white" />
                    </div>
                  </div>
                  <div className="text-xl font-bold bg-gradient-to-r from-green-600 to-emerald-600 bg-clip-text text-transparent">{stats.completed}</div>
                  <div className="text-xs font-medium text-gray-600">Completed</div>
                </CardContent>
              </Card>
            </div>

            {/* Cancelled */}
            <div className="relative group hover-lift stagger-animation">
              <div className="absolute inset-0 bg-gradient-to-r from-red-500 to-pink-500 rounded-xl blur opacity-75 group-hover:opacity-100 transition duration-200"></div>
              <Card className="relative bg-white/90 backdrop-blur-sm border-0 shadow-lg hover:shadow-xl transition-all duration-300 transform hover:scale-105 rounded-xl h-24">
                <CardContent className="p-3 text-center flex flex-col justify-center h-full">
                  <div className="flex items-center justify-center mb-1">
                    <div className="p-1.5 bg-gradient-to-br from-red-500 to-pink-500 rounded-lg">
                      <AlertCircle className="w-4 h-4 text-white" />
                    </div>
                  </div>
                  <div className="text-xl font-bold bg-gradient-to-r from-red-600 to-pink-600 bg-clip-text text-transparent">{stats.cancelled}</div>
                  <div className="text-xs font-medium text-gray-600">Cancelled</div>
                </CardContent>
              </Card>
            </div>

            {/* Avg Response Time */}
            <div className="relative group hover-lift stagger-animation">
              <div className="absolute inset-0 bg-gradient-to-r from-purple-500 to-violet-500 rounded-xl blur opacity-75 group-hover:opacity-100 transition duration-200"></div>
              <Card className="relative bg-white/90 backdrop-blur-sm border-0 shadow-lg hover:shadow-xl transition-all duration-300 transform hover:scale-105 rounded-xl h-24">
                <CardContent className="p-3 text-center flex flex-col justify-center h-full">
                  <div className="flex items-center justify-center mb-1">
                    <div className="p-1.5 bg-gradient-to-br from-purple-500 to-violet-500 rounded-lg">
                      <Zap className="w-4 h-4 text-white" />
                    </div>
                  </div>
                  <div className="text-xl font-bold bg-gradient-to-r from-purple-600 to-violet-600 bg-clip-text text-transparent">{stats.avgResponseTime}</div>
                  <div className="text-xs font-medium text-gray-600">Avg Response</div>
                </CardContent>
              </Card>
            </div>

            {/* Avg Completion Time */}
            <div className="relative group hover-lift stagger-animation">
              <div className="absolute inset-0 bg-gradient-to-r from-teal-500 to-cyan-500 rounded-xl blur opacity-75 group-hover:opacity-100 transition duration-200"></div>
              <Card className="relative bg-white/90 backdrop-blur-sm border-0 shadow-lg hover:shadow-xl transition-all duration-300 transform hover:scale-105 rounded-xl h-24">
                <CardContent className="p-3 text-center flex flex-col justify-center h-full">
                  <div className="flex items-center justify-center mb-1">
                    <div className="p-1.5 bg-gradient-to-br from-teal-500 to-cyan-500 rounded-lg">
                      <TrendingUp className="w-4 h-4 text-white" />
                    </div>
                  </div>
                  <div className="text-xl font-bold bg-gradient-to-r from-teal-600 to-cyan-600 bg-clip-text text-transparent">{stats.avgCompletionTime}</div>
                  <div className="text-xs font-medium text-gray-600">Avg Completion</div>
                </CardContent>
              </Card>
            </div>

            {/* Satisfaction Score */}
            <div className="relative group hover-lift stagger-animation">
              <div className="absolute inset-0 bg-gradient-to-r from-emerald-500 to-green-500 rounded-xl blur opacity-75 group-hover:opacity-100 transition duration-200"></div>
              <Card className="relative bg-white/90 backdrop-blur-sm border-0 shadow-lg hover:shadow-xl transition-all duration-300 transform hover:scale-105 rounded-xl h-24">
                <CardContent className="p-3 text-center flex flex-col justify-center h-full">
                  <div className="flex items-center justify-center mb-1">
                    <div className="p-1.5 bg-gradient-to-br from-emerald-500 to-green-500 rounded-lg">
                      <Star className="w-4 h-4 text-white" />
                    </div>
                  </div>
                  <div className="text-xl font-bold bg-gradient-to-r from-emerald-600 to-green-600 bg-clip-text text-transparent">{stats.satisfactionScore}</div>
                  <div className="text-xs font-medium text-gray-600">Satisfaction</div>
                </CardContent>
              </Card>
            </div>
          </div>
        )}

        {/* Filters */}
        <Card className="mb-8 bg-white/90 backdrop-blur-sm border-0 shadow-xl rounded-2xl overflow-hidden">
          <div className="bg-gradient-to-r from-slate-100 to-gray-100 px-6 py-4 border-b border-gray-200/50">
            <CardTitle className="flex items-center text-gray-800">
              <div className="p-2 bg-gradient-to-br from-slate-500 to-gray-600 rounded-xl mr-3">
                <Filter className="h-4 w-4 text-white" />
              </div>
              Filter Guest Services
            </CardTitle>
          </div>
          <CardContent className="p-6">
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4 sm:gap-6">
              <div className="space-y-2">
                <label className="block text-sm font-semibold text-gray-700">Status</label>
                <select
                  className="w-full border-2 border-gray-200 rounded-xl px-4 py-3 bg-white/80 backdrop-blur-sm focus:border-blue-500 focus:ring-2 focus:ring-blue-200 transition-all duration-200 font-medium text-gray-700"
                  value={filters.status || ''}
                  onChange={(e) => setFilters({ ...filters, status: e.target.value || undefined, page: 1 })}
                >
                  <option value="">All Statuses</option>
                  <option value="pending">Pending</option>
                  <option value="assigned">Assigned</option>
                  <option value="in_progress">In Progress</option>
                  <option value="completed">Completed</option>
                  <option value="cancelled">Cancelled</option>
                </select>
              </div>
              <div className="space-y-2">
                <label className="block text-sm font-semibold text-gray-700">Service Type</label>
                <select
                  className="w-full border-2 border-gray-200 rounded-xl px-4 py-3 bg-white/80 backdrop-blur-sm focus:border-blue-500 focus:ring-2 focus:ring-blue-200 transition-all duration-200 font-medium text-gray-700"
                  value={filters.serviceType || ''}
                  onChange={(e) => setFilters({ ...filters, serviceType: e.target.value || undefined, page: 1 })}
                >
                  <option value="">All Types</option>
                  <option value="room_service">Room Service</option>
                  <option value="housekeeping">Housekeeping</option>
                  <option value="maintenance">Maintenance</option>
                  <option value="concierge">Concierge</option>
                  <option value="transport">Transport</option>
                  <option value="spa">Spa</option>
                  <option value="laundry">Laundry</option>
                  <option value="other">Other</option>
                </select>
              </div>
              <div className="space-y-2">
                <label className="block text-sm font-semibold text-gray-700">Priority</label>
                <select
                  className="w-full border-2 border-gray-200 rounded-xl px-4 py-3 bg-white/80 backdrop-blur-sm focus:border-blue-500 focus:ring-2 focus:ring-blue-200 transition-all duration-200 font-medium text-gray-700"
                  value={filters.priority || ''}
                  onChange={(e) => setFilters({ ...filters, priority: e.target.value || undefined, page: 1 })}
                >
                  <option value="">All Priorities</option>
                  <option value="low">Low</option>
                  <option value="medium">Medium</option>
                  <option value="high">High</option>
                  <option value="urgent">Urgent</option>
                </select>
              </div>
              <div className="flex items-end">
                <Button
                  onClick={() => setFilters({ page: 1, limit: 20 })}
                  className="w-full btn-glow-blue text-white shadow-lg hover:shadow-xl transition-all duration-200 rounded-xl py-3 font-semibold transform hover:scale-105"
                >
                  Reset Filters
                </Button>
              </div>
            </div>
          </CardContent>
        </Card>

        {/* Bulk Actions Toolbar */}
        {selectedServices.size > 0 && (
          <Card className="mb-6 glass-effect border-2 border-blue-200/50 shadow-xl rounded-2xl overflow-hidden animate-slide-up hover-lift">
            <CardContent className="p-4">
              <div className="flex flex-col sm:flex-row items-center justify-between space-y-4 sm:space-y-0">
                <div className="flex items-center space-x-3">
                  <CheckSquare2 className="w-5 h-5 text-blue-600" />
                  <span className="text-sm font-semibold text-blue-800">
                    {selectedServices.size} service{selectedServices.size !== 1 ? 's' : ''} selected
                  </span>
                </div>
                <div className="flex flex-wrap items-center gap-3">
                  <Button
                    onClick={() => setShowBulkAssignModal(true)}
                    className="bg-gradient-to-r from-green-600 to-emerald-600 hover:from-green-700 hover:to-emerald-700 text-white px-4 py-2 rounded-xl shadow-lg hover:shadow-xl transition-all duration-200 transform hover:scale-105 font-semibold text-sm"
                    disabled={bulkOperating}
                  >
                    <Users className="w-4 h-4 mr-2" />
                    Bulk Assign
                  </Button>
                  <Button
                    onClick={() => handleBulkStatusUpdate('in_progress')}
                    className="bg-gradient-to-r from-yellow-600 to-orange-600 hover:from-yellow-700 hover:to-orange-700 text-white px-4 py-2 rounded-xl shadow-lg hover:shadow-xl transition-all duration-200 transform hover:scale-105 font-semibold text-sm"
                    disabled={bulkOperating}
                  >
                    <Play className="w-4 h-4 mr-2" />
                    Start Progress
                  </Button>
                  <Button
                    onClick={() => handleBulkStatusUpdate('completed')}
                    className="bg-gradient-to-r from-green-600 to-emerald-600 hover:from-green-700 hover:to-emerald-700 text-white px-4 py-2 rounded-xl shadow-lg hover:shadow-xl transition-all duration-200 transform hover:scale-105 font-semibold text-sm"
                    disabled={bulkOperating}
                  >
                    <CheckCircle className="w-4 h-4 mr-2" />
                    Mark Complete
                  </Button>
                  <Button
                    onClick={() => setSelectedServices(new Set())}
                    variant="secondary"
                    className="bg-white/80 hover:bg-white/90 border-gray-300 text-gray-700 px-4 py-2 rounded-xl shadow-lg hover:shadow-xl transition-all duration-200 font-semibold text-sm"
                  >
                    <Square className="w-4 h-4 mr-2" />
                    Clear Selection
                  </Button>
                </div>
              </div>
            </CardContent>
          </Card>
        )}

        {/* Main Content Tabs */}
        <Tabs defaultValue="services" className="space-y-6">
          <div className="bg-white rounded-xl shadow-lg border border-gray-100 p-1">
            <TabsList className="grid w-full grid-cols-5">
              <TabsTrigger value="services" className="flex items-center gap-2 text-sm font-medium">
                <Bell className="h-4 w-4" />
                Service Requests
              </TabsTrigger>
              <TabsTrigger value="inventory" className="flex items-center gap-2 text-sm font-medium">
                <Package className="h-4 w-4" />
                Guest Inventory
              </TabsTrigger>
              <TabsTrigger value="management" className="flex items-center gap-2 text-sm font-medium">
                <Settings className="h-4 w-4" />
                Service Management
              </TabsTrigger>
              <TabsTrigger value="analytics" className="flex items-center gap-2 text-sm font-medium">
                <BarChart3 className="h-4 w-4" />
                Analytics
              </TabsTrigger>
              <TabsTrigger value="sla" className="flex items-center gap-2 text-sm font-medium">
                <Target className="h-4 w-4" />
                SLA Tracking
              </TabsTrigger>
            </TabsList>
          </div>

          <TabsContent value="services">
            {/* Services Table */}
            <Card className="glass-effect border-0 shadow-xl rounded-2xl overflow-hidden animate-slide-up hover-lift">
              <div className="bg-gradient-to-r from-blue-50 to-indigo-50 px-6 py-5 border-b border-gray-200/50">
                <div className="flex items-center justify-between">
                  <CardTitle className="flex items-center text-gray-800">
                    <div className="p-2 bg-gradient-to-br from-blue-500 to-indigo-600 rounded-xl mr-3 animate-float">
                      <Bell className="h-5 w-5 text-white" />
                    </div>
                    <div>
                      <div className="text-xl font-bold text-gradient-blue">Guest Service Requests</div>
                      <div className="text-sm text-gray-600 mt-1 font-medium">{pagination.total} total requests</div>
                </div>
              </CardTitle>
              <Button
                onClick={() => setShowExportModal(true)}
                className="btn-glow-blue text-white px-4 py-2 rounded-xl shadow-lg hover:shadow-xl transition-all duration-200 transform hover:scale-105 font-semibold"
              >
                <Download className="w-4 h-4 mr-2" />
                Export Data
              </Button>
            </div>
          </div>
          <CardContent className="p-0">
            <ErrorBoundary level="component" fallback={
              <div className="p-8 text-center">
                <div className="p-4 bg-red-50 rounded-xl inline-block">
                  <AlertCircle className="w-8 h-8 text-red-500 mx-auto mb-2" />
                  <div className="text-red-700 font-medium">Failed to load guest services table</div>
                </div>
              </div>
            }>
              <div className="overflow-x-auto">
                <div className="min-w-full">
                  {!loading && services.length === 0 ? (
                    <div className="p-12 text-center">
                      <Bell className="w-12 h-12 text-gray-300 mx-auto mb-4" />
                      <h3 className="text-lg font-semibold text-gray-600 mb-2">No Service Requests</h3>
                      <p className="text-sm text-gray-500">No guest service requests found for the current filters. Requests will appear here when guests submit them.</p>
                    </div>
                  ) : (
                    <DataTable
                      data={services}
                      columns={columns}
                      loading={loading}
                    />
                  )}
                </div>
              </div>
            </ErrorBoundary>
          </CardContent>

          {/* Pagination */}
          {pagination.pages > 1 && (
            <div className="px-6 py-5 bg-gradient-to-r from-gray-50 to-slate-50 border-t border-gray-200/50">
              <div className="flex flex-col sm:flex-row items-center justify-between space-y-3 sm:space-y-0">
                <div className="text-sm font-medium text-gray-700 bg-white/80 px-4 py-2 rounded-xl shadow-sm">
                  Showing {((filters.page || 1) - 1) * (filters.limit || 20) + 1} to{' '}
                  {Math.min((filters.page || 1) * (filters.limit || 20), pagination.total)} of{' '}
                  {pagination.total} results
                </div>
                <div className="flex items-center space-x-3">
                  <Button
                    variant="secondary"
                    size="sm"
                    disabled={(filters.page || 1) <= 1}
                    onClick={() => setFilters({ ...filters, page: (filters.page || 1) - 1 })}
                    className="bg-white/80 hover:bg-white/90 border-gray-200 shadow-lg hover:shadow-xl transition-all duration-200 rounded-xl font-semibold"
                  >
                    Previous
                  </Button>
                  <span className="text-sm font-semibold text-gray-700 bg-white/80 px-4 py-2 rounded-xl shadow-sm">
                    Page {filters.page || 1} of {pagination.pages}
                  </span>
                  <Button
                    variant="secondary"
                    size="sm"
                    disabled={(filters.page || 1) >= pagination.pages}
                    onClick={() => setFilters({ ...filters, page: (filters.page || 1) + 1 })}
                    className="bg-white/80 hover:bg-white/90 border-gray-200 shadow-lg hover:shadow-xl transition-all duration-200 rounded-xl font-semibold"
                  >
                    Next
                  </Button>
                </div>
              </div>
            </div>
          )}
        </Card>
          </TabsContent>

          <TabsContent value="inventory">
            <GuestInventoryTracker hotelId={selectedPropertyId} />
          </TabsContent>

          <TabsContent value="management">
            <ServiceTypeManager hotelId={selectedPropertyId} />
          </TabsContent>

          <TabsContent value="analytics">
            <ServiceAnalytics hotelId={selectedPropertyId} />
          </TabsContent>

          <TabsContent value="sla">
            <SLATracker hotelId={selectedPropertyId} />
          </TabsContent>
        </Tabs>

        {/* View Service Modal */}
        {selectedService && (
          <Modal
            isOpen={showViewModal}
            onClose={() => setShowViewModal(false)}
            title={
              <div className="flex items-center space-x-3">
                <div className="p-2 bg-gradient-to-br from-green-500 to-emerald-600 rounded-xl">
                  <Eye className="w-5 h-5 text-white" />
                </div>
                <span className="text-xl font-bold bg-gradient-to-r from-green-600 to-emerald-600 bg-clip-text text-transparent">
                  Service Request Details
                </span>
              </div>
            }
          >
          <div className="space-y-6">
            <div className="bg-gradient-to-r from-gray-50 to-white p-6 rounded-2xl border border-gray-100">
              <div className="flex items-start space-x-4">
                <div className={`p-3 rounded-xl shadow-lg ${getServiceTypeColor(selectedService.serviceType)}`}>
                  {getServiceTypeIcon(selectedService.serviceType)}
                </div>
                <div className="flex-1">
                  <h3 className="text-xl font-bold bg-gradient-to-r from-gray-800 to-gray-600 bg-clip-text text-transparent">{selectedService.title}</h3>
                  <p className="text-gray-600 mt-2 text-sm leading-relaxed">{selectedService.description}</p>
                </div>
              </div>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-6">
              <div className="bg-white/80 backdrop-blur-sm p-4 rounded-xl border border-gray-100 shadow-sm">
                <label className="flex items-center text-sm font-semibold text-gray-700 mb-3">
                  <Package className="w-4 h-4 mr-2 text-blue-500" />
                  Service Type
                </label>
                <span className={`inline-flex items-center px-3 py-1.5 rounded-xl text-sm font-semibold shadow-sm ${getServiceTypeColor(selectedService.serviceType)}`}>
                  {selectedService.serviceType.replace('_', ' ')}
                </span>
              </div>
              <div className="bg-white/80 backdrop-blur-sm p-4 rounded-xl border border-gray-100 shadow-sm">
                <label className="flex items-center text-sm font-semibold text-gray-700 mb-3">
                  <AlertTriangle className="w-4 h-4 mr-2 text-amber-500" />
                  Priority
                </label>
                <span className={`inline-flex items-center px-3 py-1.5 rounded-xl text-sm font-semibold shadow-sm ${getPriorityColor(selectedService.priority)}`}>
                  {selectedService.priority}
                </span>
              </div>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-6">
              <div className="bg-gradient-to-br from-blue-50 to-indigo-50 p-5 rounded-xl border border-blue-100">
                <label className="flex items-center text-sm font-semibold text-gray-700 mb-3">
                  <User className="w-4 h-4 mr-2 text-blue-500" />
                  Guest Information
                </label>
                <div className="space-y-1">
                  <div className="font-semibold text-gray-900">{selectedService.userId?.name || 'N/A'}</div>
                  <div className="text-sm text-gray-600 flex items-center">
                    <Mail className="w-3 h-3 mr-1" />
                    {selectedService.userId?.email || 'N/A'}
                  </div>
                  {selectedService.userId?.phone && (
                    <div className="text-sm text-gray-600 flex items-center">
                      <Phone className="w-3 h-3 mr-1" />
                      {selectedService.userId.phone}
                    </div>
                  )}
                </div>
              </div>
              <div className="bg-gradient-to-br from-green-50 to-emerald-50 p-5 rounded-xl border border-green-100">
                <label className="flex items-center text-sm font-semibold text-gray-700 mb-3">
                  <MapPin className="w-4 h-4 mr-2 text-green-500" />
                  Room & Booking
                </label>
                <div className="space-y-1">
                  <div className="font-semibold text-gray-900">
                    Room {selectedService.bookingId?.rooms?.[0]?.roomId?.roomNumber || 'N/A'}
                  </div>
                  <div className="text-sm text-gray-600">
                    {selectedService.bookingId?.bookingNumber || 'N/A'}
                  </div>
                </div>
              </div>
            </div>

            {selectedService.assignedTo && (
              <div className="bg-gradient-to-br from-purple-50 to-pink-50 p-5 rounded-xl border border-purple-100">
                <label className="flex items-center text-sm font-semibold text-gray-700 mb-3">
                  <UserCheck className="w-4 h-4 mr-2 text-purple-500" />
                  Assigned Staff
                </label>
                <div className="space-y-1">
                  <div className="font-semibold text-gray-900">{selectedService.assignedTo.name}</div>
                  <div className="text-sm text-gray-600 flex items-center">
                    <Mail className="w-3 h-3 mr-1" />
                    {selectedService.assignedTo.email}
                  </div>
                </div>
              </div>
            )}

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-6">
              <div className="bg-white/80 backdrop-blur-sm p-4 rounded-xl border border-gray-100 shadow-sm">
                <label className="flex items-center text-sm font-semibold text-gray-700 mb-3">
                  <Activity className="w-4 h-4 mr-2 text-indigo-500" />
                  Current Status
                </label>
                <div>
                  <StatusBadge
                    status={selectedService.status}
                    colorMap={{
                      pending: 'yellow',
                      assigned: 'blue',
                      in_progress: 'orange',
                      completed: 'green',
                      cancelled: 'red'
                    }}
                  />
                </div>
              </div>
              <div className="bg-white/80 backdrop-blur-sm p-4 rounded-xl border border-gray-100 shadow-sm">
                <label className="flex items-center text-sm font-semibold text-gray-700 mb-3">
                  <DollarSign className="w-4 h-4 mr-2 text-green-500" />
                  Service Cost
                </label>
                <div className="text-sm text-gray-900">
                                     {selectedService.actualCost ? (
                     <div>
                       <div className="font-medium">{formatCurrency(selectedService.actualCost)} (Actual)</div>
                       {selectedService.actualCost !== selectedService.estimatedCost && (
                         <div className="text-gray-500">Estimated: {formatCurrency(selectedService.estimatedCost || 0)}</div>
                       )}
                     </div>
                   ) : (
                     <div>{formatCurrency(selectedService.estimatedCost || 0)} (Estimated)</div>
                   )}
                </div>
              </div>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-6">
              <div className="bg-gradient-to-br from-gray-50 to-slate-50 p-5 rounded-xl border border-gray-100">
                <label className="flex items-center text-sm font-semibold text-gray-700 mb-3">
                  <Calendar className="w-4 h-4 mr-2 text-gray-500" />
                  Created Date
                </label>
                <div className="text-sm font-medium text-gray-900">
                  {format(parseISO(selectedService.createdAt), 'MMM dd, yyyy HH:mm')}
                </div>
              </div>
              {selectedService.completedTime && (
                <div className="bg-gradient-to-br from-green-50 to-emerald-50 p-5 rounded-xl border border-green-100">
                  <label className="flex items-center text-sm font-semibold text-gray-700 mb-3">
                    <CheckCircle className="w-4 h-4 mr-2 text-green-500" />
                    Completed Date
                  </label>
                  <div className="text-sm font-medium text-gray-900">
                    {format(parseISO(selectedService.completedTime), 'MMM dd, yyyy HH:mm')}
                  </div>
                </div>
              )}
            </div>

            {selectedService.scheduledTime && (
              <div className="bg-gradient-to-br from-blue-50 to-indigo-50 p-5 rounded-xl border border-blue-100">
                <label className="flex items-center text-sm font-semibold text-gray-700 mb-3">
                  <Clock className="w-4 h-4 mr-2 text-blue-500" />
                  Scheduled Time
                </label>
                <div className="text-sm font-medium text-gray-900">
                  {format(parseISO(selectedService.scheduledTime), 'MMM dd, yyyy HH:mm')}
                </div>
              </div>
            )}

            {selectedService.notes && (
              <div className="bg-gradient-to-br from-orange-50 to-amber-50 p-5 rounded-xl border border-orange-100">
                <label className="flex items-center text-sm font-semibold text-gray-700 mb-3">
                  <FileText className="w-4 h-4 mr-2 text-orange-500" />
                  Staff Notes
                </label>
                <div className="text-sm text-gray-900 bg-white/60 backdrop-blur-sm p-4 rounded-lg font-medium leading-relaxed">
                  {selectedService.notes}
                </div>
              </div>
            )}

            {selectedService.guestNotes && (
              <div className="bg-gradient-to-br from-cyan-50 to-blue-50 p-5 rounded-xl border border-cyan-100">
                <label className="flex items-center text-sm font-semibold text-gray-700 mb-3">
                  <MessageSquare className="w-4 h-4 mr-2 text-cyan-500" />
                  Guest Notes
                </label>
                <div className="text-sm text-gray-900 bg-white/60 backdrop-blur-sm p-4 rounded-lg font-medium leading-relaxed">
                  {selectedService.guestNotes}
                </div>
              </div>
            )}
          </div>

          <div className="flex items-center justify-end space-x-4 pt-6 border-t border-gray-100">
            <Button
              variant="secondary"
              onClick={() => setShowViewModal(false)}
              className="px-6 py-2.5 rounded-xl border-2 border-gray-300 hover:border-gray-400 transition-all duration-200 font-semibold"
            >
              Close
            </Button>
            {selectedService.status !== 'completed' && selectedService.status !== 'cancelled' && (
              <>
                {selectedService.status === 'pending' && (
                  <Button
                    onClick={() => {
                      setShowViewModal(false);
                      openAssignModal(selectedService);
                    }}
                    className="bg-gradient-to-r from-blue-600 to-indigo-600 hover:from-blue-700 hover:to-indigo-700 text-white px-6 py-2.5 rounded-xl shadow-lg hover:shadow-xl transition-all duration-200 transform hover:scale-105 font-semibold"
                  >
                    <UserPlus className="w-4 h-4 mr-2" />
                    Assign Service
                  </Button>
                )}
                {selectedService.status !== 'pending' && (
                  <Button
                    onClick={() => {
                      const nextStatus: 'in_progress' | 'completed' = selectedService.status === 'assigned' ? 'in_progress' : 'completed';
                      handleStatusUpdate(selectedService._id, nextStatus);
                      setShowViewModal(false);
                    }}
                    disabled={updating}
                    className="bg-gradient-to-r from-green-600 to-emerald-600 hover:from-green-700 hover:to-emerald-700 text-white px-6 py-2.5 rounded-xl shadow-lg hover:shadow-xl transition-all duration-200 transform hover:scale-105 font-semibold disabled:opacity-50 disabled:cursor-not-allowed"
                  >
                    {selectedService.status === 'assigned' && (
                      <>
                        <Play className="w-4 h-4 mr-2" />
                        Start Service
                      </>
                    )}
                    {selectedService.status === 'in_progress' && (
                      <>
                        <CheckCircle className="w-4 h-4 mr-2" />
                        Complete Service
                      </>
                    )}
                  </Button>
                )}
              </>
            )}
          </div>
        </Modal>
      )}

      {/* Assign Service Modal */}
      <Modal
        isOpen={showAssignModal}
        onClose={() => {
          setShowAssignModal(false);
          setAssignData({ assignedTo: '', notes: '', scheduledTime: '' });
        }}
        title={
          <div className="flex items-center space-x-3">
            <div className="p-2 bg-gradient-to-br from-blue-500 to-indigo-600 rounded-xl">
              <UserPlus className="w-5 h-5 text-white" />
            </div>
            <span className="text-xl font-bold bg-gradient-to-r from-blue-600 to-indigo-600 bg-clip-text text-transparent">
              Assign Service to Staff
            </span>
          </div>
        }
      >
        <form onSubmit={handleAssignService} className="space-y-6">
          <div className="bg-gradient-to-br from-blue-50 to-indigo-50 p-5 rounded-xl border border-blue-100">
            <label className="flex items-center text-sm font-semibold text-gray-700 mb-3">
              <Users className="w-4 h-4 mr-2 text-blue-500" />
              Select Staff Member
            </label>
            <select
              className="w-full border-2 border-gray-200 rounded-xl px-4 py-3 bg-white/80 backdrop-blur-sm focus:border-blue-500 focus:ring-2 focus:ring-blue-200 transition-all duration-200 font-medium"
              value={assignData.assignedTo}
              onChange={(e) => setAssignData({ ...assignData, assignedTo: e.target.value })}
              required
            >
              <option value="">Choose a staff member...</option>
              {availableStaff.map((staff) => (
                <option key={staff._id} value={staff._id}>
                  {staff.name} - {staff.department}
                </option>
              ))}
            </select>
          </div>
          
          <div className="bg-gradient-to-br from-green-50 to-emerald-50 p-5 rounded-xl border border-green-100">
            <label className="flex items-center text-sm font-semibold text-gray-700 mb-3">
              <Clock className="w-4 h-4 mr-2 text-green-500" />
              Scheduled Time (Optional)
            </label>
            <input
              type="datetime-local"
              className="w-full border-2 border-gray-200 rounded-xl px-4 py-3 bg-white/80 backdrop-blur-sm focus:border-green-500 focus:ring-2 focus:ring-green-200 transition-all duration-200 font-medium"
              value={assignData.scheduledTime}
              onChange={(e) => setAssignData({ ...assignData, scheduledTime: e.target.value })}
            />
          </div>

          <div className="bg-gradient-to-br from-purple-50 to-pink-50 p-5 rounded-xl border border-purple-100">
            <label className="flex items-center text-sm font-semibold text-gray-700 mb-3">
              <MessageSquare className="w-4 h-4 mr-2 text-purple-500" />
              Assignment Instructions
            </label>
            <textarea
              className="w-full border-2 border-gray-200 rounded-xl px-4 py-3 bg-white/80 backdrop-blur-sm focus:border-purple-500 focus:ring-2 focus:ring-purple-200 transition-all duration-200 font-medium h-24 resize-none"
              value={assignData.notes}
              onChange={(e) => setAssignData({ ...assignData, notes: e.target.value })}
              placeholder="Add any special instructions, requirements, or notes for the assigned staff member..."
            />
          </div>

          <div className="flex items-center justify-end space-x-4 pt-6 border-t border-gray-100">
            <Button
              type="button"
              variant="secondary"
              onClick={() => setShowAssignModal(false)}
              className="px-6 py-2.5 rounded-xl border-2 border-gray-300 hover:border-gray-400 transition-all duration-200 font-semibold"
            >
              Cancel
            </Button>
            <Button
              type="submit"
              disabled={updating}
              className="bg-gradient-to-r from-blue-600 to-indigo-600 hover:from-blue-700 hover:to-indigo-700 text-white px-6 py-2.5 rounded-xl shadow-lg hover:shadow-xl transition-all duration-200 transform hover:scale-105 font-semibold disabled:opacity-50 disabled:cursor-not-allowed"
            >
              {updating ? (
                <>
                  <RefreshCw className="h-4 w-4 mr-2 animate-spin" />
                  Assigning...
                </>
              ) : (
                <>
                  <UserCheck className="h-4 w-4 mr-2" />
                  Assign Service
                </>
              )}
            </Button>
          </div>
        </form>
      </Modal>

      {/* Bulk Assign Modal */}
      <Modal
        isOpen={showBulkAssignModal}
        onClose={() => {
          setShowBulkAssignModal(false);
          setAssignData({ assignedTo: '', notes: '', scheduledTime: '' });
        }}
        title={
          <div className="flex items-center space-x-3">
            <div className="p-2 bg-gradient-to-br from-green-500 to-emerald-600 rounded-xl">
              <Users className="w-5 h-5 text-white" />
            </div>
            <span className="text-xl font-bold bg-gradient-to-r from-green-600 to-emerald-600 bg-clip-text text-transparent">
              Bulk Assign Services ({selectedServices.size} selected)
            </span>
          </div>
        }
      >
        <div className="space-y-6">
          <div className="bg-gradient-to-br from-blue-50 to-indigo-50 p-5 rounded-xl border border-blue-100">
            <label className="flex items-center text-sm font-semibold text-gray-700 mb-3">
              <UserCheck className="w-4 h-4 mr-2 text-blue-500" />
              Select Staff Member
            </label>
            <select
              className="w-full border-2 border-gray-200 rounded-xl px-4 py-3 bg-white/80 backdrop-blur-sm focus:border-blue-500 focus:ring-2 focus:ring-blue-200 transition-all duration-200 font-medium"
              value={assignData.assignedTo}
              onChange={(e) => setAssignData({ ...assignData, assignedTo: e.target.value })}
              required
            >
              <option value="">Choose a staff member...</option>
              {availableStaff.map((staff) => (
                <option key={staff._id} value={staff._id}>
                  {staff.name} - {staff.department}
                </option>
              ))}
            </select>
          </div>

          <div className="bg-gradient-to-br from-purple-50 to-pink-50 p-5 rounded-xl border border-purple-100">
            <label className="flex items-center text-sm font-semibold text-gray-700 mb-3">
              <MessageSquare className="w-4 h-4 mr-2 text-purple-500" />
              Assignment Notes
            </label>
            <textarea
              className="w-full border-2 border-gray-200 rounded-xl px-4 py-3 bg-white/80 backdrop-blur-sm focus:border-purple-500 focus:ring-2 focus:ring-purple-200 transition-all duration-200 font-medium h-24 resize-none"
              value={assignData.notes}
              onChange={(e) => setAssignData({ ...assignData, notes: e.target.value })}
              placeholder="Add instructions for the assigned staff members..."
            />
          </div>

          <div className="flex items-center justify-end space-x-4 pt-6 border-t border-gray-100">
            <Button
              type="button"
              variant="secondary"
              onClick={() => setShowBulkAssignModal(false)}
              className="px-6 py-2.5 rounded-xl border-2 border-gray-300 hover:border-gray-400 transition-all duration-200 font-semibold"
            >
              Cancel
            </Button>
            <Button
              onClick={handleBulkAssign}
              disabled={bulkOperating || !assignData.assignedTo}
              className="bg-gradient-to-r from-green-600 to-emerald-600 hover:from-green-700 hover:to-emerald-700 text-white px-6 py-2.5 rounded-xl shadow-lg hover:shadow-xl transition-all duration-200 transform hover:scale-105 font-semibold disabled:opacity-50 disabled:cursor-not-allowed"
            >
              {bulkOperating ? (
                <>
                  <RefreshCw className="h-4 w-4 mr-2 animate-spin" />
                  Assigning...
                </>
              ) : (
                <>
                  <UserCheck className="h-4 w-4 mr-2" />
                  Assign {selectedServices.size} Services
                </>
              )}
            </Button>
          </div>
        </div>
      </Modal>

      {/* Export Modal */}
      <Modal
        isOpen={showExportModal}
        onClose={() => setShowExportModal(false)}
        title={
          <div className="flex items-center space-x-3">
            <div className="p-2 bg-gradient-to-br from-purple-500 to-pink-600 rounded-xl">
              <Download className="w-5 h-5 text-white" />
            </div>
            <span className="text-xl font-bold bg-gradient-to-r from-purple-600 to-pink-600 bg-clip-text text-transparent">
              Export Service Requests
            </span>
          </div>
        }
      >
        <div className="space-y-6">
          <div className="bg-gradient-to-br from-blue-50 to-indigo-50 p-5 rounded-xl border border-blue-100">
            <label className="flex items-center text-sm font-semibold text-gray-700 mb-3">
              <FileSpreadsheet className="w-4 h-4 mr-2 text-blue-500" />
              Export Format
            </label>
            <div className="grid grid-cols-2 gap-4">
              <label className="flex items-center space-x-3 p-3 bg-white/80 rounded-xl border-2 border-gray-200 hover:border-blue-300 cursor-pointer transition-all duration-200">
                <input
                  type="radio"
                  name="exportFormat"
                  value="csv"
                  checked={exportFormat === 'csv'}
                  onChange={(e) => setExportFormat(e.target.value as 'csv' | 'json')}
                  className="w-4 h-4 text-blue-600"
                />
                <div>
                  <div className="font-semibold text-gray-900">CSV Format</div>
                  <div className="text-sm text-gray-600">Comma-separated values</div>
                </div>
              </label>
              <label className="flex items-center space-x-3 p-3 bg-white/80 rounded-xl border-2 border-gray-200 hover:border-blue-300 cursor-pointer transition-all duration-200">
                <input
                  type="radio"
                  name="exportFormat"
                  value="json"
                  checked={exportFormat === 'json'}
                  onChange={(e) => setExportFormat(e.target.value as 'csv' | 'json')}
                  className="w-4 h-4 text-blue-600"
                />
                <div>
                  <div className="font-semibold text-gray-900">JSON Format</div>
                  <div className="text-sm text-gray-600">Structured JSON export</div>
                </div>
              </label>
            </div>
          </div>

          <div className="bg-gradient-to-br from-green-50 to-emerald-50 p-5 rounded-xl border border-green-100">
            <h4 className="flex items-center text-sm font-semibold text-gray-700 mb-3">
              <BarChart3 className="w-4 h-4 mr-2 text-green-500" />
              Export Details
            </h4>
            <div className="space-y-2 text-sm text-gray-600">
              <div>• Total records: {pagination.total}</div>
              <div>• Applied filters: {Object.keys(filters).filter(key => filters[key as keyof GuestServiceFilters] && key !== 'page' && key !== 'limit').length || 'None'}</div>
              <div>• Format: {exportFormat.toUpperCase()}</div>
              <div>• File name: guest-services-{new Date().toISOString().split('T')[0]}.{exportFormat}</div>
            </div>
          </div>

          <div className="flex items-center justify-end space-x-4 pt-6 border-t border-gray-100">
            <Button
              type="button"
              variant="secondary"
              onClick={() => setShowExportModal(false)}
              className="px-6 py-2.5 rounded-xl border-2 border-gray-300 hover:border-gray-400 transition-all duration-200 font-semibold"
            >
              Cancel
            </Button>
            <Button
              onClick={handleExport}
              disabled={bulkOperating}
              className="bg-gradient-to-r from-purple-600 to-pink-600 hover:from-purple-700 hover:to-pink-700 text-white px-6 py-2.5 rounded-xl shadow-lg hover:shadow-xl transition-all duration-200 transform hover:scale-105 font-semibold disabled:opacity-50 disabled:cursor-not-allowed"
            >
              {bulkOperating ? (
                <>
                  <RefreshCw className="h-4 w-4 mr-2 animate-spin" />
                  Exporting...
                </>
              ) : (
                <>
                  <Download className="h-4 w-4 mr-2" />
                  Export Data
                </>
              )}
            </Button>
          </div>
        </div>
      </Modal>
      </div>
    </div>
  </ErrorBoundary>
  );
}