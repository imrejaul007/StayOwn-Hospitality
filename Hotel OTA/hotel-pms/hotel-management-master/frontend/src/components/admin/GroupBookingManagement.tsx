import React, { useState, useEffect } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { useForm, useFieldArray } from 'react-hook-form';
import {
  CalendarDays,
  Plus,
  Search,
  Users,
  Building2,
  Clock,
  AlertTriangle,
  CheckCircle,
  Eye,
  Edit,
  X,
  Calendar,
  User,
  Phone,
  Mail,
  Power,
  PowerOff,
  Ban,
  RotateCcw,
  Trash2
} from 'lucide-react';
import { cn } from '../../utils/cn';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { LoadingSpinner } from '../LoadingSpinner';
import { formatCurrency, formatDate } from '../../utils/dashboardUtils';
import {
  parseGroupBookingBackendErrors,
  validateGroupBookingForm,
  formatDateForInput,
  type FieldValidationErrors
} from '../../utils/groupBookingValidators';
import toast from 'react-hot-toast';
import { groupBookingService, CreateGroupBookingData } from '../../services/groupBookingService';
import { corporateService, CorporateCompany } from '../../services/corporateService';
import { api } from '../../services/api';
import { withErrorBoundary } from '../ErrorBoundary';

interface GroupBooking {
  _id: string;
  groupName: string;
  corporateCompanyId: {
    _id: string;
    name: string;
  };
  checkIn: string;
  checkOut: string;
  rooms: Array<{
    guestName: string;
    guestEmail?: string;
    guestPhone?: string;
    employeeId?: string;
    department?: string;
    roomType: string;
    rate?: number;
    specialRequests?: string;
    status?: string;
  }>;
  contactPerson: {
    name: string;
    email: string;
    phone: string;
    designation?: string;
  };
  eventDetails?: {
    eventType?: string;
    eventName?: string;
    eventDescription?: string;
    meetingRoomRequired?: boolean;
    cateringRequired?: boolean;
    transportRequired?: boolean;
  };
  status: 'draft' | 'confirmed' | 'partially_confirmed' | 'checked_in' | 'checked_out' | 'cancelled';
  totalAmount?: number;
  paymentMethod: string;
  specialInstructions?: string;
  createdAt: string;
  updatedAt: string;
}

// API function to fetch group bookings
const fetchGroupBookings = async (page = 1, limit = 20): Promise<{ groupBookings: GroupBooking[]; pagination?: { page: number; limit: number; totalCount: number; totalPages: number } }> => {
  try {
    const { data } = await api.get(`/corporate/group-bookings?page=${page}&limit=${limit}`);
    return data.data || { groupBookings: [] };
  } catch (error) {
    if (error instanceof TypeError && error.message.includes('fetch')) {
      throw new Error('Network error. Please check your internet connection.');
    }
    throw error;
  }
};

// API function to toggle group booking status
const toggleGroupBookingStatus = async (id: string): Promise<GroupBooking> => {
  try {
    const { data } = await api.patch(`/corporate/group-bookings/${id}/toggle-status`);
    return data.data.groupBooking;
  } catch (error) {
    if (error instanceof TypeError && error.message.includes('fetch')) {
      throw new Error('Network error. Please check your internet connection.');
    }
    throw error;
  }
};

// API function to update group booking
const updateGroupBooking = async (id: string, data: Record<string, unknown>): Promise<GroupBooking> => {
  try {
    const { data: responseData } = await api.patch(`/corporate/group-bookings/${id}`, data);
    return responseData.data.groupBooking;
  } catch (error) {
    if (error instanceof TypeError && error.message.includes('fetch')) {
      throw new Error('Network error. Please check your internet connection.');
    }
    throw error;
  }
};

const GroupBookingDetails = React.memo(({ booking }: { booking: GroupBooking }) => (
  <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4 text-sm">
    <div>
      <p className="text-gray-500 flex items-center mb-1">
        <Calendar className="w-4 h-4 mr-1" />
        Check-in
      </p>
      <p className="font-medium">{new Date(booking.checkIn).toLocaleDateString()}</p>
    </div>
    <div>
      <p className="text-gray-500 flex items-center mb-1">
        <Calendar className="w-4 h-4 mr-1" />
        Check-out
      </p>
      <p className="font-medium">{new Date(booking.checkOut).toLocaleDateString()}</p>
    </div>
    <div>
      <p className="text-gray-500 flex items-center mb-1">
        <Users className="w-4 h-4 mr-1" />
        Rooms
      </p>
      <p className="font-medium">{booking.rooms.length} rooms</p>
    </div>
    <div>
      <p className="text-gray-500 flex items-center mb-1">
        <User className="w-4 h-4 mr-1" />
        Contact Person
      </p>
      <p className="font-medium">{booking.contactPerson?.name || 'N/A'}</p>
    </div>
  </div>
));
GroupBookingDetails.displayName = 'GroupBookingDetails';

function GroupBookingManagement() {
  const [searchTerm, setSearchTerm] = useState('');
  const [selectedBooking, setSelectedBooking] = useState<GroupBooking | null>(null);
  const [editingBooking, setEditingBooking] = useState<GroupBooking | null>(null);
  const [creatingBooking, setCreatingBooking] = useState(false);
  const [statusFilter, setStatusFilter] = useState<string>('all');
  const [formErrors, setFormErrors] = useState<FieldValidationErrors>({});
  const [createFormErrors, setCreateFormErrors] = useState<FieldValidationErrors>({});
  const [corporateCompanies, setCorporateCompanies] = useState<CorporateCompany[]>([]);
  const [currentPage, setCurrentPage] = useState(1);
  const PAGE_SIZE = 20;

  const queryClient = useQueryClient();

  // Form setup for editing
  const form = useForm({
    defaultValues: {
      groupName: '',
      corporateCompanyId: '',
      checkIn: '',
      checkOut: '',
      paymentMethod: '',
      contactPerson: {
        name: '',
        email: '',
        phone: '',
        designation: ''
      },
      eventDetails: {
        eventName: '',
        eventType: '',
        eventDescription: '',
        meetingRoomRequired: false,
        cateringRequired: false,
        transportRequired: false
      },
      specialInstructions: '',
      rooms: []
    }
  });

  const { fields: roomFields, append: appendRoom, remove: removeRoom } = useFieldArray({
    control: form.control,
    name: 'rooms'
  });

  // Form setup for creating new booking
  const createForm = useForm({
    defaultValues: {
      groupName: '',
      corporateCompanyId: '',
      checkIn: '',
      checkOut: '',
      paymentMethod: 'corporate_credit' as const,
      contactPerson: {
        name: '',
        email: '',
        phone: '',
        designation: ''
      },
      rooms: [{
        guestName: '',
        guestEmail: '',
        guestPhone: '',
        employeeId: '',
        department: '',
        roomType: 'double' as const,
        specialRequests: ''
      }],
      eventDetails: {
        eventType: undefined,
        eventName: '',
        eventDescription: '',
        meetingRoomRequired: false,
        cateringRequired: false,
        transportRequired: false
      },
      invoiceDetails: {
        billingEmail: '',
        purchaseOrderNumber: '',
        costCenter: ''
      },
      specialInstructions: ''
    }
  });

  const { fields: createRoomFields, append: appendCreateRoom, remove: removeCreateRoom } = useFieldArray({
    control: createForm.control,
    name: 'rooms'
  });

  // Reset form when editing booking changes
  useEffect(() => {
    if (editingBooking) {
      form.reset({
        groupName: editingBooking.groupName || '',
        corporateCompanyId: (editingBooking.corporateCompanyId as unknown as { _id: string })?._id || String(editingBooking.corporateCompanyId || ''),
        checkIn: formatDateForInput(editingBooking.checkIn) || '',
        checkOut: formatDateForInput(editingBooking.checkOut) || '',
        paymentMethod: editingBooking.paymentMethod || '',
        contactPerson: {
          name: editingBooking.contactPerson?.name || '',
          email: editingBooking.contactPerson?.email || '',
          phone: editingBooking.contactPerson?.phone || '',
          designation: editingBooking.contactPerson?.designation || ''
        },
        eventDetails: {
          eventName: editingBooking.eventDetails?.eventName || '',
          eventType: editingBooking.eventDetails?.eventType || '',
          eventDescription: editingBooking.eventDetails?.eventDescription || '',
          meetingRoomRequired: editingBooking.eventDetails?.meetingRoomRequired || false,
          cateringRequired: editingBooking.eventDetails?.cateringRequired || false,
          transportRequired: editingBooking.eventDetails?.transportRequired || false
        },
        specialInstructions: editingBooking.specialInstructions || '',
        rooms: editingBooking.rooms || []
      });
    }
  }, [editingBooking, form]);

  // Fetch group bookings with server-side pagination
  const {
    data: bookingsData,
    isLoading,
    error,
    refetch
  } = useQuery({
    queryKey: ['group-bookings', currentPage],
    queryFn: () => fetchGroupBookings(currentPage, PAGE_SIZE),
    keepPreviousData: true,
  });

  // Toggle status mutation
  const toggleStatusMutation = useMutation({
    mutationFn: toggleGroupBookingStatus,
    onSuccess: (updatedBooking) => {
      queryClient.invalidateQueries({ queryKey: ['group-bookings'] });
      const statusText = getStatusDisplayText(updatedBooking.status);
      toast.success(`Group booking ${statusText} successfully`);
      setFormErrors({}); // Clear any previous errors
    },
    onError: (error: unknown) => {
      const backendErrors = parseGroupBookingBackendErrors(error);

      // Set form errors for display
      setFormErrors(backendErrors);

      // Show toast for immediate feedback
      if (backendErrors.general) {
        toast.error(backendErrors.general);
      } else if (backendErrors.corporateCompanyId) {
        toast.error(backendErrors.corporateCompanyId);
      } else if (backendErrors.rooms) {
        toast.error(backendErrors.rooms);
      } else {
        toast.error(error instanceof Error ? error.message : 'Failed to update group booking status');
      }
    },
  });

  // Update booking mutation
  const updateBookingMutation = useMutation({
    mutationFn: ({ id, data }: { id: string, data: Record<string, unknown> }) => updateGroupBooking(id, data),
    onSuccess: (updatedBooking) => {
      queryClient.invalidateQueries({ queryKey: ['group-bookings'] });
      toast.success('Group booking updated successfully');
      setEditingBooking(null);
      setFormErrors({});
    },
    onError: (error: unknown) => {
      const backendErrors = parseGroupBookingBackendErrors(error);
      setFormErrors(backendErrors);

      if (backendErrors.general) {
        toast.error(backendErrors.general);
      } else {
        toast.error(error instanceof Error ? error.message : 'Failed to update group booking');
      }
    },
  });

  // Create booking mutation
  const createBookingMutation = useMutation({
    mutationFn: (bookingData: CreateGroupBookingData) => groupBookingService.createGroupBooking(bookingData),
    onSuccess: (response) => {
      queryClient.invalidateQueries({ queryKey: ['group-bookings'] });
      toast.success(`Group booking "${response.data.groupBooking.groupName}" created successfully`);
      setCreatingBooking(false);
      createForm.reset();
      setCreateFormErrors({});
    },
    onError: (error: unknown) => {
      const backendErrors = parseGroupBookingBackendErrors(error);
      setCreateFormErrors(backendErrors);

      if (backendErrors.general) {
        toast.error(backendErrors.general);
      } else {
        toast.error(error instanceof Error ? error.message : 'Failed to create group booking');
      }
    },
  });

  // Fetch corporate companies when creating modal opens
  useEffect(() => {
    if (creatingBooking && corporateCompanies.length === 0) {
      corporateService.getAllCompanies({ isActive: true, limit: 100 })
        .then(response => {
          setCorporateCompanies(response.data.companies || []);
        })
        .catch(error => {
          toast.error('Failed to load corporate companies');
        });
    }
  }, [creatingBooking, corporateCompanies.length]);

  const bookings = bookingsData?.groupBookings || [];

  // Filter bookings based on search term and status
  const filteredBookings = bookings.filter(booking => {
    const searchLower = searchTerm.toLowerCase();
    const matchesSearch =
      (booking.groupName || '').toLowerCase().includes(searchLower) ||
      (booking.corporateCompanyId?.name || '').toLowerCase().includes(searchLower) ||
      (booking.contactPerson?.name || '').toLowerCase().includes(searchLower);
    
    const matchesStatus = statusFilter === 'all' || booking.status === statusFilter;
    
    return matchesSearch && matchesStatus;
  });

  const getStatusColor = (status: string) => {
    switch (status) {
      case 'confirmed':
        return 'bg-green-100 text-green-800 border-green-200';
      case 'partially_confirmed':
        return 'bg-yellow-100 text-yellow-800 border-yellow-200';
      case 'draft':
        return 'bg-gray-100 text-gray-800 border-gray-200';
      case 'checked_in':
        return 'bg-blue-100 text-blue-800 border-blue-200';
      case 'checked_out':
        return 'bg-purple-100 text-purple-800 border-purple-200';
      case 'cancelled':
        return 'bg-red-100 text-red-800 border-red-200';
      default:
        return 'bg-gray-100 text-gray-800 border-gray-200';
    }
  };

  const getStatusDisplayText = (status: string) => {
    switch (status) {
      case 'confirmed': return 'confirmed';
      case 'partially_confirmed': return 'partially confirmed';
      case 'draft': return 'set to draft';
      case 'checked_in': return 'checked in';
      case 'checked_out': return 'checked out';
      case 'cancelled': return 'cancelled';
      default: return 'updated';
    }
  };

  const handleToggleStatus = async (booking: GroupBooking) => {
    const getActionText = (currentStatus: string) => {
      switch (currentStatus) {
        case 'draft': return 'confirm';
        case 'confirmed': return 'cancel';
        case 'partially_confirmed': return 'cancel';
        case 'cancelled': return 'reactivate';
        default: return 'update';
      }
    };

    const actionText = getActionText(booking.status);
    const message = `Are you sure you want to ${actionText} the group booking "${booking.groupName}"?`;

    if (window.confirm(message)) {
      toggleStatusMutation.mutate(booking._id);
    }
  };

  const getStatusActionButton = (booking: GroupBooking) => {
    // Don't show action buttons for checked-in or checked-out bookings
    if (['checked_in', 'checked_out'].includes(booking.status)) {
      return null;
    }

    switch (booking.status) {
      case 'draft':
        return (
          <Button
            variant="ghost"
            size="sm"
            onClick={() => handleToggleStatus(booking)}
            className="text-green-600 hover:text-green-700"
            disabled={toggleStatusMutation.isPending}
            title="Confirm booking"
          >
            <CheckCircle className="w-4 h-4" />
          </Button>
        );
      case 'confirmed':
      case 'partially_confirmed':
        return (
          <Button
            variant="ghost"
            size="sm"
            onClick={() => handleToggleStatus(booking)}
            className="text-red-600 hover:text-red-700"
            disabled={toggleStatusMutation.isPending}
            title="Cancel booking"
          >
            <Ban className="w-4 h-4" />
          </Button>
        );
      case 'cancelled':
        return (
          <Button
            variant="ghost"
            size="sm"
            onClick={() => handleToggleStatus(booking)}
            className="text-blue-600 hover:text-blue-700"
            disabled={toggleStatusMutation.isPending}
            title="Reactivate booking"
          >
            <RotateCcw className="w-4 h-4" />
          </Button>
        );
      default:
        return null;
    }
  };

  // Form submission handler
  const handleSaveBooking = (data: Record<string, unknown>) => {
    if (!editingBooking) return;

    // Client-side validation
    const validationErrors = validateGroupBookingForm(data);
    if (Object.keys(validationErrors).length > 0) {
      setFormErrors(validationErrors);
      toast.error('Please fix the form errors before saving');
      return;
    }

    // Prepare data for submission
    const updateData = {
      groupName: data.groupName,
      corporateCompanyId: data.corporateCompanyId,
      checkIn: data.checkIn,
      checkOut: data.checkOut,
      paymentMethod: data.paymentMethod,
      contactPerson: data.contactPerson,
      eventDetails: data.eventDetails,
      specialInstructions: data.specialInstructions,
      rooms: data.rooms
    };

    updateBookingMutation.mutate({ id: editingBooking._id, data: updateData });
  };

  // Create form submission handler
  const handleCreateBooking = (data: Record<string, unknown>) => {
    // Client-side validation
    const validationErrors = validateGroupBookingForm(data);
    if (Object.keys(validationErrors).length > 0) {
      setCreateFormErrors(validationErrors);
      toast.error('Please fix the form errors before saving');
      return;
    }

    // Prepare data for submission
    const createData: CreateGroupBookingData = {
      groupName: data.groupName,
      corporateCompanyId: data.corporateCompanyId,
      checkIn: data.checkIn,
      checkOut: data.checkOut,
      paymentMethod: data.paymentMethod,
      contactPerson: data.contactPerson,
      rooms: data.rooms,
      eventDetails: data.eventDetails,
      invoiceDetails: data.invoiceDetails,
      specialInstructions: data.specialInstructions
    };

    createBookingMutation.mutate(createData);
  };

  // Create room management functions
  const handleAddCreateRoom = () => {
    appendCreateRoom({
      guestName: '',
      guestEmail: '',
      guestPhone: '',
      employeeId: '',
      department: '',
      roomType: 'double' as const,
      specialRequests: ''
    });
  };

  const handleRemoveCreateRoom = (index: number) => {
    if (createRoomFields.length > 1) {
      removeCreateRoom(index);
    }
  };

  // Room management functions
  const handleAddRoom = () => {
    appendRoom({
      guestName: '',
      guestEmail: '',
      guestPhone: '',
      employeeId: '',
      department: '',
      roomType: 'single',
      specialRequests: '',
      guestPreferences: {
        bedType: 'single',
        floor: '',
        smokingAllowed: false
      }
    });
  };

  const handleRemoveRoom = (index: number) => {
    if (window.confirm('Are you sure you want to remove this room?')) {
      removeRoom(index);
    }
  };

  const getStatusIcon = (status: string) => {
    switch (status) {
      case 'confirmed':
      case 'checked_out':
        return <CheckCircle className="w-3 h-3" />;
      case 'partially_confirmed':
      case 'checked_in':
        return <Clock className="w-3 h-3" />;
      case 'cancelled':
        return <AlertTriangle className="w-3 h-3" />;
      default:
        return <Clock className="w-3 h-3" />;
    }
  };

  if (isLoading) {
    return (
      <div className="flex justify-center items-center min-h-[400px]">
        <LoadingSpinner size="large" />
      </div>
    );
  }

  if (error) {
    const errorMessage = error instanceof Error ? error.message : 'Unknown error occurred';
    return (
      <div className="text-center py-12">
        <AlertTriangle className="mx-auto h-12 w-12 text-red-500 mb-4" />
        <h3 className="text-lg font-medium text-gray-900 mb-2">Failed to load group bookings</h3>
        <p className="text-gray-500 mb-2">There was an error loading the group bookings.</p>
        <p className="text-sm text-red-600 mb-4">{errorMessage}</p>
        <div className="flex justify-center space-x-3">
          <Button onClick={() => refetch()} variant="outline">
            Try Again
          </Button>
          <Button onClick={() => window.location.reload()}>
            Reload Page
          </Button>
        </div>
      </div>
    );
  }

  // Calculate analytics
  const analytics = {
    total: bookings.length,
    confirmed: bookings.filter(b => b.status === 'confirmed').length,
    draft: bookings.filter(b => b.status === 'draft').length,
    cancelled: bookings.filter(b => b.status === 'cancelled').length,
    totalRooms: bookings.reduce((total, booking) => total + booking.rooms.length, 0),
    totalRevenue: bookings.reduce((total, booking) => total + (booking.totalAmount || 0), 0),
    upcomingEvents: bookings.filter(b =>
      new Date(b.checkIn) > new Date() && b.status === 'confirmed'
    ).length
  };

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex justify-between items-center">
        <div>
          <h2 className="text-2xl font-bold text-gray-900">Group Bookings</h2>
          <p className="text-gray-600">Manage corporate group bookings and events</p>
        </div>
        <Button
          className="flex items-center"
          onClick={() => setCreatingBooking(true)}
        >
          <Plus className="w-4 h-4 mr-2" />
          New Group Booking
        </Button>
      </div>

      {/* Analytics Overview */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
        <div className="bg-white p-6 rounded-lg border border-gray-200">
          <div className="flex items-center">
            <div className="flex-shrink-0">
              <CalendarDays className="h-8 w-8 text-blue-600" />
            </div>
            <div className="ml-4">
              <p className="text-sm font-medium text-gray-500">Total Bookings</p>
              <p className="text-2xl font-semibold text-gray-900">{analytics.total}</p>
            </div>
          </div>
        </div>

        <div className="bg-white p-6 rounded-lg border border-gray-200">
          <div className="flex items-center">
            <div className="flex-shrink-0">
              <CheckCircle className="h-8 w-8 text-green-600" />
            </div>
            <div className="ml-4">
              <p className="text-sm font-medium text-gray-500">Confirmed</p>
              <p className="text-2xl font-semibold text-gray-900">{analytics.confirmed}</p>
            </div>
          </div>
        </div>

        <div className="bg-white p-6 rounded-lg border border-gray-200">
          <div className="flex items-center">
            <div className="flex-shrink-0">
              <Users className="h-8 w-8 text-purple-600" />
            </div>
            <div className="ml-4">
              <p className="text-sm font-medium text-gray-500">Total Rooms</p>
              <p className="text-2xl font-semibold text-gray-900">{analytics.totalRooms}</p>
            </div>
          </div>
        </div>

        <div className="bg-white p-6 rounded-lg border border-gray-200">
          <div className="flex items-center">
            <div className="flex-shrink-0">
              <Clock className="h-8 w-8 text-orange-600" />
            </div>
            <div className="ml-4">
              <p className="text-sm font-medium text-gray-500">Upcoming Events</p>
              <p className="text-2xl font-semibold text-gray-900">{analytics.upcomingEvents}</p>
            </div>
          </div>
        </div>
      </div>

      {/* Status Summary */}
      <div className="bg-white p-6 rounded-lg border border-gray-200">
        <h3 className="text-lg font-medium text-gray-900 mb-4">Booking Status Summary</h3>
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
          <div className="text-center">
            <div className="text-2xl font-bold text-gray-600">{analytics.draft}</div>
            <div className="text-sm text-gray-500">Draft</div>
          </div>
          <div className="text-center">
            <div className="text-2xl font-bold text-green-600">{analytics.confirmed}</div>
            <div className="text-sm text-gray-500">Confirmed</div>
          </div>
          <div className="text-center">
            <div className="text-2xl font-bold text-red-600">{analytics.cancelled}</div>
            <div className="text-sm text-gray-500">Cancelled</div>
          </div>
          <div className="text-center">
            <div className="text-2xl font-bold text-orange-600">{analytics.upcomingEvents}</div>
            <div className="text-sm text-gray-500">Upcoming</div>
          </div>
        </div>
      </div>

      {/* Error Display */}
      {Object.keys(formErrors).length > 0 && (
        <div className="bg-red-50 border border-red-200 rounded-lg p-4">
          <div className="flex items-start">
            <AlertTriangle className="w-5 h-5 text-red-600 mt-0.5 mr-3 flex-shrink-0" />
            <div className="flex-1">
              <h3 className="text-sm font-medium text-red-800 mb-2">
                There were errors with your request
              </h3>
              <ul className="text-sm text-red-700 space-y-1">
                {Object.entries(formErrors).map(([field, error]) => (
                  <li key={field}>
                    <strong>{field.replace(/([A-Z])/g, ' $1').replace(/^./, str => str.toUpperCase())}:</strong> {error}
                  </li>
                ))}
              </ul>
              <Button
                variant="ghost"
                size="sm"
                className="mt-2 text-red-700 hover:text-red-800"
                onClick={() => setFormErrors({})}
              >
                <X className="w-4 h-4 mr-1" />
                Dismiss
              </Button>
            </div>
          </div>
        </div>
      )}

      {/* Filters */}
      <div className="flex flex-col sm:flex-row gap-4">
        <div className="relative flex-1">
          <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-gray-400" />
          <input
            type="text"
            placeholder="Search by group name, company, or contact person..."
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            className="w-full pl-10 pr-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
          />
        </div>
        <select
          value={statusFilter}
          onChange={(e) => setStatusFilter(e.target.value)}
          className="px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
        >
          <option value="all">All Status</option>
          <option value="draft">Draft</option>
          <option value="confirmed">Confirmed</option>
          <option value="partially_confirmed">Partially Confirmed</option>
          <option value="checked_in">Checked In</option>
          <option value="checked_out">Checked Out</option>
          <option value="cancelled">Cancelled</option>
        </select>
      </div>

      {/* Bookings List */}
      <div className="bg-white rounded-lg border border-gray-200 overflow-hidden">
        {filteredBookings.length > 0 ? (
          <div className="divide-y divide-gray-200">
            {filteredBookings.map((booking) => (
              <div key={booking._id} className="p-6 hover:bg-gray-50 transition-colors">
                <div className="flex items-start justify-between">
                  <div className="flex-1">
                    {/* Header */}
                    <div className="flex items-center justify-between mb-3">
                      <div className="flex items-center">
                        <div className="flex-shrink-0 h-10 w-10 bg-blue-100 rounded-lg flex items-center justify-center mr-3">
                          <CalendarDays className="h-6 w-6 text-blue-600" />
                        </div>
                        <div>
                          <h3 className="text-lg font-semibold text-gray-900">{booking.groupName}</h3>
                          <p className="text-sm text-gray-600 flex items-center">
                            <Building2 className="w-4 h-4 mr-1" />
                            {booking.corporateCompanyId?.name || 'Unknown Company'}
                          </p>
                        </div>
                      </div>
                      <Badge className={cn("px-2 py-1 text-xs font-medium border", getStatusColor(booking.status))}>
                        {getStatusIcon(booking.status)}
                        <span className="ml-1 capitalize">{booking.status.replace('_', ' ')}</span>
                      </Badge>
                    </div>

                    {/* Details Grid */}
                    <GroupBookingDetails booking={booking} />

                    {/* Event Details */}
                    {booking.eventDetails?.eventName && (
                      <div className="mt-3 p-3 bg-gray-50 rounded-lg">
                        <p className="text-sm font-medium text-gray-900">{booking.eventDetails.eventName}</p>
                        {booking.eventDetails.eventType && (
                          <p className="text-xs text-gray-600 mt-1">
                            Event Type: {booking.eventDetails.eventType}
                          </p>
                        )}
                      </div>
                    )}

                    {/* Special Requirements */}
                    {(booking.eventDetails?.meetingRoomRequired || 
                      booking.eventDetails?.cateringRequired || 
                      booking.eventDetails?.transportRequired) && (
                      <div className="mt-3 flex flex-wrap gap-2">
                        {booking.eventDetails.meetingRoomRequired && (
                          <Badge variant="outline" size="sm">Meeting Room</Badge>
                        )}
                        {booking.eventDetails.cateringRequired && (
                          <Badge variant="outline" size="sm">Catering</Badge>
                        )}
                        {booking.eventDetails.transportRequired && (
                          <Badge variant="outline" size="sm">Transport</Badge>
                        )}
                      </div>
                    )}
                  </div>

                  {/* Actions */}
                  <div className="flex items-center space-x-2 ml-4">
                    <Button
                      variant="ghost"
                      size="sm"
                      onClick={() => setSelectedBooking(booking)}
                      title="View details"
                    >
                      <Eye className="w-4 h-4" />
                    </Button>
                    <Button
                      variant="ghost"
                      size="sm"
                      onClick={() => setEditingBooking(booking)}
                      title="Edit booking"
                    >
                      <Edit className="w-4 h-4" />
                    </Button>
                    {getStatusActionButton(booking)}
                  </div>
                </div>
              </div>
            ))}
          </div>
        ) : (
          <div className="text-center py-12">
            <CalendarDays className="mx-auto h-12 w-12 text-gray-300 mb-4" />
            <h3 className="text-sm font-medium text-gray-900 mb-2">
              {searchTerm || statusFilter !== 'all' ? 'No group bookings found' : 'No group bookings'}
            </h3>
            <p className="text-sm text-gray-500">
              {searchTerm || statusFilter !== 'all' 
                ? 'Try adjusting your search or filters.' 
                : 'Get started by creating your first group booking.'
              }
            </p>
          </div>
        )}
      </div>

      {/* Pagination Controls */}
      {bookingsData?.pagination && bookingsData.pagination.totalPages > 1 && (
        <div className="flex items-center justify-between px-4 py-3 bg-white border border-gray-200 rounded-lg mt-4">
          <div className="text-sm text-gray-700">
            Showing page {bookingsData.pagination.page} of {bookingsData.pagination.totalPages}
            {' '}({bookingsData.pagination.totalCount} total bookings)
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
              disabled={currentPage >= (bookingsData.pagination.totalPages || 1)}
              onClick={() => setCurrentPage(prev => prev + 1)}
            >
              Next
            </Button>
          </div>
        </div>
      )}

      {/* Booking Details Modal */}
      {selectedBooking && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-lg max-w-4xl w-full max-h-[90vh] overflow-y-auto">
            <div className="flex items-center justify-between p-6 border-b border-gray-200">
              <h3 className="text-lg font-semibold text-gray-900">
                Group Booking Details
              </h3>
              <button aria-label="Close"
                onClick={() => setSelectedBooking(null)}
                className="text-gray-400 hover:text-gray-500"
              >
                <X className="w-6 h-6" />
              </button>
            </div>

            <div className="p-6 space-y-6">
              {/* Basic Information */}
              <div>
                <h4 className="text-lg font-medium text-gray-900 mb-4">Basic Information</h4>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">
                      Group Name
                    </label>
                    <p className="text-sm text-gray-900">{selectedBooking.groupName}</p>
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">
                      Company
                    </label>
                    <p className="text-sm text-gray-900">{selectedBooking.corporateCompanyId?.name || 'Unknown Company'}</p>
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">
                      Check-in Date
                    </label>
                    <p className="text-sm text-gray-900">{formatDate(selectedBooking.checkIn)}</p>
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">
                      Check-out Date
                    </label>
                    <p className="text-sm text-gray-900">{formatDate(selectedBooking.checkOut)}</p>
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">
                      Status
                    </label>
                    <Badge className={cn("px-2 py-1 text-xs font-medium border", getStatusColor(selectedBooking.status))}>
                      {getStatusIcon(selectedBooking.status)}
                      <span className="ml-1 capitalize">{selectedBooking.status.replace('_', ' ')}</span>
                    </Badge>
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">
                      Payment Method
                    </label>
                    <p className="text-sm text-gray-900 capitalize">{(selectedBooking.paymentMethod || '').replace('_', ' ') || 'N/A'}</p>
                  </div>
                </div>
              </div>

              {/* Contact Person */}
              <div>
                <h4 className="text-lg font-medium text-gray-900 mb-4">Contact Person</h4>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">
                      Name
                    </label>
                    <p className="text-sm text-gray-900">{selectedBooking.contactPerson?.name || 'N/A'}</p>
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">
                      Designation
                    </label>
                    <p className="text-sm text-gray-900">{selectedBooking.contactPerson?.designation || 'N/A'}</p>
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">
                      Email
                    </label>
                    <p className="text-sm text-gray-900 flex items-center">
                      <Mail className="w-4 h-4 mr-1 text-gray-400" />
                      {selectedBooking.contactPerson?.email || 'N/A'}
                    </p>
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">
                      Phone
                    </label>
                    <p className="text-sm text-gray-900 flex items-center">
                      <Phone className="w-4 h-4 mr-1 text-gray-400" />
                      {selectedBooking.contactPerson?.phone || 'N/A'}
                    </p>
                  </div>
                </div>
              </div>

              {/* Event Details */}
              {selectedBooking.eventDetails && (
                <div>
                  <h4 className="text-lg font-medium text-gray-900 mb-4">Event Details</h4>
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-1">
                        Event Name
                      </label>
                      <p className="text-sm text-gray-900">{selectedBooking.eventDetails.eventName || 'N/A'}</p>
                    </div>
                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-1">
                        Event Type
                      </label>
                      <p className="text-sm text-gray-900 capitalize">{selectedBooking.eventDetails.eventType || 'N/A'}</p>
                    </div>
                    {selectedBooking.eventDetails.eventDescription && (
                      <div className="md:col-span-2">
                        <label className="block text-sm font-medium text-gray-700 mb-1">
                          Description
                        </label>
                        <p className="text-sm text-gray-900">{selectedBooking.eventDetails.eventDescription}</p>
                      </div>
                    )}
                  </div>
                </div>
              )}

              {/* Rooms */}
              <div>
                <h4 className="text-lg font-medium text-gray-900 mb-4">Rooms ({selectedBooking.rooms.length})</h4>
                <div className="space-y-3">
                  {selectedBooking.rooms.map((room, index) => (
                    <div key={`selectedBooking-rooms-${index}`} className="border border-gray-200 rounded-lg p-4">
                      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                        <div>
                          <label className="block text-sm font-medium text-gray-700 mb-1">
                            Guest Name
                          </label>
                          <p className="text-sm text-gray-900">{room.guestName}</p>
                        </div>
                        <div>
                          <label className="block text-sm font-medium text-gray-700 mb-1">
                            Room Type
                          </label>
                          <p className="text-sm text-gray-900 capitalize">{room.roomType}</p>
                        </div>
                        <div>
                          <label className="block text-sm font-medium text-gray-700 mb-1">
                            Employee ID
                          </label>
                          <p className="text-sm text-gray-900">{room.employeeId || 'N/A'}</p>
                        </div>
                        {room.guestEmail && (
                          <div>
                            <label className="block text-sm font-medium text-gray-700 mb-1">
                              Email
                            </label>
                            <p className="text-sm text-gray-900">{room.guestEmail}</p>
                          </div>
                        )}
                        {room.department && (
                          <div>
                            <label className="block text-sm font-medium text-gray-700 mb-1">
                              Department
                            </label>
                            <p className="text-sm text-gray-900">{room.department}</p>
                          </div>
                        )}
                        {room.rate && (
                          <div>
                            <label className="block text-sm font-medium text-gray-700 mb-1">
                              Rate
                            </label>
                            <p className="text-sm text-gray-900">{formatCurrency(room.rate)}</p>
                          </div>
                        )}
                        {room.specialRequests && (
                          <div className="md:col-span-3">
                            <label className="block text-sm font-medium text-gray-700 mb-1">
                              Special Requests
                            </label>
                            <p className="text-sm text-gray-900">{room.specialRequests}</p>
                          </div>
                        )}
                      </div>
                    </div>
                  ))}
                </div>
              </div>

              {/* Special Instructions */}
              {selectedBooking.specialInstructions && (
                <div>
                  <h4 className="text-lg font-medium text-gray-900 mb-4">Special Instructions</h4>
                  <p className="text-sm text-gray-900 bg-gray-50 p-4 rounded-lg">
                    {selectedBooking.specialInstructions}
                  </p>
                </div>
              )}
            </div>

            <div className="flex justify-end space-x-3 p-6 border-t border-gray-200">
              <Button variant="outline" onClick={() => setSelectedBooking(null)}>
                Close
              </Button>
              <Button onClick={() => {
                setEditingBooking(selectedBooking);
                setSelectedBooking(null);
              }}>
                Edit Booking
              </Button>
            </div>
          </div>
        </div>
      )}

      {/* Edit Booking Modal */}
      {editingBooking && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-lg max-w-4xl w-full max-h-[90vh] overflow-y-auto">
            <div className="flex items-center justify-between p-6 border-b border-gray-200">
              <h3 className="text-lg font-semibold text-gray-900">
                Edit Group Booking
              </h3>
              <button aria-label="Edit"
                onClick={() => setEditingBooking(null)}
                className="text-gray-400 hover:text-gray-500"
              >
                <X className="w-6 h-6" />
              </button>
            </div>

            <form onSubmit={form.handleSubmit(handleSaveBooking)} className="p-6">
              {/* Error Display */}
              {Object.keys(formErrors).length > 0 && (
                <div className="mb-6 p-4 bg-red-50 border border-red-200 rounded-lg">
                  <div className="flex items-start">
                    <AlertTriangle className="w-5 h-5 text-red-600 mt-0.5 mr-3 flex-shrink-0" />
                    <div className="flex-1">
                      <h3 className="text-sm font-medium text-red-800 mb-2">
                        Please fix the following errors:
                      </h3>
                      <ul className="text-sm text-red-700 space-y-1">
                        {Object.entries(formErrors).map(([field, error]) => (
                          <li key={field}>
                            <strong>{field.replace(/([A-Z])/g, ' $1').replace(/^./, str => str.toUpperCase())}:</strong> {error}
                          </li>
                        ))}
                      </ul>
                    </div>
                  </div>
                </div>
              )}

              <div className="space-y-6">
                {/* Basic Information */}
                <div>
                  <h4 className="text-lg font-medium text-gray-900 mb-4">Basic Information</h4>
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-2">
                        Group Name *
                      </label>
                      <input
                        {...form.register('groupName')}
                        type="text"
                        required
                        className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                        placeholder="Enter group name"
                      />
                      {formErrors.groupName && (
                        <p className="text-red-600 text-sm mt-1">{formErrors.groupName}</p>
                      )}
                    </div>

                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-2">
                        Company
                      </label>
                      <p className="text-sm text-gray-900 bg-gray-50 px-3 py-2 rounded-lg border">
                        {editingBooking.corporateCompanyId?.name || 'Unknown Company'}
                      </p>
                      {/* Hidden field for corporate company ID */}
                      <input
                        {...form.register('corporateCompanyId')}
                        type="hidden"
                      />
                    </div>

                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-2">
                        Check-in Date *
                      </label>
                      <input
                        {...form.register('checkIn')}
                        type="date"
                        required
                        className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                      />
                      {formErrors.checkIn && (
                        <p className="text-red-600 text-sm mt-1">{formErrors.checkIn}</p>
                      )}
                    </div>

                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-2">
                        Check-out Date *
                      </label>
                      <input
                        {...form.register('checkOut')}
                        type="date"
                        required
                        className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                      />
                      {formErrors.checkOut && (
                        <p className="text-red-600 text-sm mt-1">{formErrors.checkOut}</p>
                      )}
                    </div>

                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-2">
                        Payment Method *
                      </label>
                      <select
                        {...form.register('paymentMethod')}
                        className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                      >
                        <option value="">Select payment method</option>
                        <option value="corporate_credit">Corporate Credit</option>
                        <option value="direct_billing">Direct Billing</option>
                        <option value="advance_payment">Advance Payment</option>
                      </select>
                      {formErrors.paymentMethod && (
                        <p className="text-red-600 text-sm mt-1">{formErrors.paymentMethod}</p>
                      )}
                    </div>
                  </div>
                </div>

                {/* Contact Person */}
                <div>
                  <h4 className="text-lg font-medium text-gray-900 mb-4">Contact Person</h4>
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-2">
                        Name *
                      </label>
                      <input
                        {...form.register('contactPerson.name')}
                        type="text"
                        required
                        className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                        placeholder="Contact person name"
                      />
                      {formErrors.contactPersonName && (
                        <p className="text-red-600 text-sm mt-1">{formErrors.contactPersonName}</p>
                      )}
                    </div>

                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-2">
                        Email *
                      </label>
                      <input
                        {...form.register('contactPerson.email')}
                        type="email"
                        required
                        className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                        placeholder="contact@example.com"
                      />
                      {formErrors.contactPersonEmail && (
                        <p className="text-red-600 text-sm mt-1">{formErrors.contactPersonEmail}</p>
                      )}
                    </div>

                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-2">
                        Phone *
                      </label>
                      <input
                        {...form.register('contactPerson.phone')}
                        type="tel"
                        required
                        className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                        placeholder="+1 (555) 123-4567"
                      />
                      {formErrors.contactPersonPhone && (
                        <p className="text-red-600 text-sm mt-1">{formErrors.contactPersonPhone}</p>
                      )}
                    </div>

                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-2">
                        Designation
                      </label>
                      <input
                        {...form.register('contactPerson.designation')}
                        type="text"
                        required
                        className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                        placeholder="Job title"
                      />
                    </div>
                  </div>
                </div>

                {/* Event Details */}
                <div>
                  <h4 className="text-lg font-medium text-gray-900 mb-4">Event Details</h4>
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-2">
                        Event Name
                      </label>
                      <input
                        {...form.register('eventDetails.eventName')}
                        type="text"
                        required
                        className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                        placeholder="Event name"
                      />
                    </div>

                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-2">
                        Event Type
                      </label>
                      <select
                        {...form.register('eventDetails.eventType')}
                        className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                      >
                        <option value="">Select event type</option>
                        <option value="conference">Conference</option>
                        <option value="training">Training</option>
                        <option value="meeting">Meeting</option>
                        <option value="team_building">Team Building</option>
                        <option value="other">Other</option>
                      </select>
                    </div>

                    <div className="md:col-span-2">
                      <label className="block text-sm font-medium text-gray-700 mb-2">
                        Event Description
                      </label>
                      <textarea
                        {...form.register('eventDetails.eventDescription')}
                        rows={3}
                        className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                        placeholder="Describe the event"
                      />
                    </div>

                    <div className="md:col-span-2">
                      <label className="block text-sm font-medium text-gray-700 mb-3">
                        Requirements
                      </label>
                      <div className="space-y-2">
                        <label className="flex items-center">
                          <input
                            {...form.register('eventDetails.meetingRoomRequired')}
                            type="checkbox"
                            className="rounded border-gray-300 text-blue-600 focus:ring-blue-500"
                          />
                          <span className="ml-2 text-sm text-gray-700">Meeting Room Required</span>
                        </label>
                        <label className="flex items-center">
                          <input
                            {...form.register('eventDetails.cateringRequired')}
                            type="checkbox"
                            className="rounded border-gray-300 text-blue-600 focus:ring-blue-500"
                          />
                          <span className="ml-2 text-sm text-gray-700">Catering Required</span>
                        </label>
                        <label className="flex items-center">
                          <input
                            {...form.register('eventDetails.transportRequired')}
                            type="checkbox"
                            className="rounded border-gray-300 text-blue-600 focus:ring-blue-500"
                          />
                          <span className="ml-2 text-sm text-gray-700">Transport Required</span>
                        </label>
                      </div>
                    </div>
                  </div>
                </div>

                {/* Rooms Section */}
                <div>
                  <div className="flex items-center justify-between mb-4">
                    <h4 className="text-lg font-medium text-gray-900">Rooms ({roomFields.length})</h4>
                    <Button
                      type="button"
                      variant="outline"
                      size="sm"
                      onClick={handleAddRoom}
                    >
                      <Plus className="w-4 h-4 mr-2" />
                      Add Room
                    </Button>
                  </div>

                  <div className="space-y-4">
                    {roomFields.map((field, index) => (
                      <div key={field.id} className="border border-gray-200 rounded-lg p-4">
                        <div className="flex items-center justify-between mb-3">
                          <h5 className="font-medium text-gray-900">Room {index + 1}</h5>
                          {roomFields.length > 1 && (
                            <Button
                              type="button"
                              variant="ghost"
                              size="sm"
                              onClick={() => handleRemoveRoom(index)}
                              className="text-red-600 hover:text-red-700"
                            >
                              <X className="w-4 h-4" />
                            </Button>
                          )}
                        </div>

                        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                          <div>
                            <label className="block text-sm font-medium text-gray-700 mb-2">
                              Guest Name *
                            </label>
                            <input
                              {...form.register(`rooms.${index}.guestName`)}
                              type="text"
                              required
                              className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                              placeholder="Guest name"
                            />
                          </div>

                          <div>
                            <label className="block text-sm font-medium text-gray-700 mb-2">
                              Room Type *
                            </label>
                            <select
                              {...form.register(`rooms.${index}.roomType`)}
                              className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                            >
                              <option value="single">Single</option>
                              <option value="double">Double</option>
                              <option value="suite">Suite</option>
                              <option value="deluxe">Deluxe</option>
                            </select>
                          </div>

                          <div>
                            <label className="block text-sm font-medium text-gray-700 mb-2">
                              Employee ID
                            </label>
                            <input
                              {...form.register(`rooms.${index}.employeeId`)}
                              type="text"
                              className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                              placeholder="Employee ID"
                            />
                          </div>

                          <div>
                            <label className="block text-sm font-medium text-gray-700 mb-2">
                              Email
                            </label>
                            <input
                              {...form.register(`rooms.${index}.guestEmail`)}
                              type="email"
                              className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                              placeholder="guest@example.com"
                            />
                          </div>

                          <div>
                            <label className="block text-sm font-medium text-gray-700 mb-2">
                              Phone
                            </label>
                            <input
                              {...form.register(`rooms.${index}.guestPhone`)}
                              type="tel"
                              className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                              placeholder="Phone number"
                            />
                          </div>

                          <div>
                            <label className="block text-sm font-medium text-gray-700 mb-2">
                              Department
                            </label>
                            <input
                              {...form.register(`rooms.${index}.department`)}
                              type="text"
                              className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                              placeholder="Department"
                            />
                          </div>

                          <div className="md:col-span-3">
                            <label className="block text-sm font-medium text-gray-700 mb-2">
                              Special Requests
                            </label>
                            <textarea
                              {...form.register(`rooms.${index}.specialRequests`)}
                              rows={2}
                              className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                              placeholder="Any special requests for this room"
                            />
                          </div>
                        </div>
                      </div>
                    ))}
                  </div>
                </div>

                {/* Special Instructions */}
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">
                    Special Instructions
                  </label>
                  <textarea
                    {...form.register('specialInstructions')}
                    rows={3}
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                    placeholder="Any special instructions for this group booking"
                  />
                </div>
              </div>
            </form>

            <div className="flex justify-end space-x-3 p-6 border-t border-gray-200">
              <Button variant="outline" onClick={() => setEditingBooking(null)}>
                Cancel
              </Button>
              <Button
                onClick={form.handleSubmit(handleSaveBooking)}
                disabled={updateBookingMutation.isPending}
              >
                {updateBookingMutation.isPending ? 'Saving...' : 'Save Changes'}
              </Button>
            </div>
          </div>
        </div>
      )}

      {/* Create Booking Modal */}
      {creatingBooking && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-lg max-w-4xl w-full max-h-[90vh] overflow-y-auto">
            <div className="flex items-center justify-between p-6 border-b border-gray-200">
              <h3 className="text-lg font-semibold text-gray-900">
                Create New Group Booking
              </h3>
              <button aria-label="Close"
                onClick={() => {
                  setCreatingBooking(false);
                  createForm.reset();
                  setCreateFormErrors({});
                }}
                className="text-gray-400 hover:text-gray-500"
              >
                <X className="w-6 h-6" />
              </button>
            </div>

            <form onSubmit={createForm.handleSubmit(handleCreateBooking)} className="p-6">
              {/* Error Display */}
              {Object.keys(createFormErrors).length > 0 && (
                <div className="mb-6 p-4 bg-red-50 border border-red-200 rounded-lg">
                  <div className="flex items-start">
                    <AlertTriangle className="w-5 h-5 text-red-600 mt-0.5 mr-3 flex-shrink-0" />
                    <div className="flex-1">
                      <h3 className="text-sm font-medium text-red-800 mb-2">
                        Please fix the following errors:
                      </h3>
                      <ul className="text-sm text-red-700 space-y-1">
                        {Object.entries(createFormErrors).map(([field, error]) => (
                          <li key={field}>
                            <strong>{field.replace(/([A-Z])/g, ' $1').replace(/^./, str => str.toUpperCase())}:</strong> {error}
                          </li>
                        ))}
                      </ul>
                    </div>
                  </div>
                </div>
              )}

              <div className="space-y-6">
                {/* Basic Information */}
                <div>
                  <h4 className="text-lg font-medium text-gray-900 mb-4">Basic Information</h4>
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-2">
                        Group Name *
                      </label>
                      <input
                        {...createForm.register('groupName')}
                        type="text"
                        required
                        className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                        placeholder="Enter group name"
                      />
                      {createFormErrors.groupName && (
                        <p className="text-red-600 text-sm mt-1">{createFormErrors.groupName}</p>
                      )}
                    </div>

                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-2">
                        Corporate Company *
                      </label>
                      <select
                        {...createForm.register('corporateCompanyId')}
                        className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                      >
                        <option value="">Select corporate company</option>
                        {corporateCompanies.map((company) => (
                          <option key={company._id} value={company._id}>
                            {company.name}
                          </option>
                        ))}
                      </select>
                      {createFormErrors.corporateCompanyId && (
                        <p className="text-red-600 text-sm mt-1">{createFormErrors.corporateCompanyId}</p>
                      )}
                    </div>

                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-2">
                        Check-in Date *
                      </label>
                      <input
                        {...createForm.register('checkIn')}
                        type="date"
                        required
                        className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                      />
                      {createFormErrors.checkIn && (
                        <p className="text-red-600 text-sm mt-1">{createFormErrors.checkIn}</p>
                      )}
                    </div>

                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-2">
                        Check-out Date *
                      </label>
                      <input
                        {...createForm.register('checkOut')}
                        type="date"
                        required
                        className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                      />
                      {createFormErrors.checkOut && (
                        <p className="text-red-600 text-sm mt-1">{createFormErrors.checkOut}</p>
                      )}
                    </div>

                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-2">
                        Payment Method *
                      </label>
                      <select
                        {...createForm.register('paymentMethod')}
                        className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                      >
                        <option value="corporate_credit">Corporate Credit</option>
                        <option value="direct_billing">Direct Billing</option>
                        <option value="advance_payment">Advance Payment</option>
                      </select>
                      {createFormErrors.paymentMethod && (
                        <p className="text-red-600 text-sm mt-1">{createFormErrors.paymentMethod}</p>
                      )}
                    </div>
                  </div>
                </div>

                {/* Contact Person */}
                <div>
                  <h4 className="text-lg font-medium text-gray-900 mb-4">Contact Person</h4>
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-2">
                        Name *
                      </label>
                      <input
                        {...createForm.register('contactPerson.name')}
                        type="text"
                        required
                        className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                        placeholder="Contact person name"
                      />
                      {createFormErrors.contactPersonName && (
                        <p className="text-red-600 text-sm mt-1">{createFormErrors.contactPersonName}</p>
                      )}
                    </div>

                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-2">
                        Email *
                      </label>
                      <input
                        {...createForm.register('contactPerson.email')}
                        type="email"
                        required
                        className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                        placeholder="Contact person email"
                      />
                      {createFormErrors.contactPersonEmail && (
                        <p className="text-red-600 text-sm mt-1">{createFormErrors.contactPersonEmail}</p>
                      )}
                    </div>

                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-2">
                        Phone *
                      </label>
                      <input
                        {...createForm.register('contactPerson.phone')}
                        type="tel"
                        required
                        className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                        placeholder="Contact person phone"
                      />
                      {createFormErrors.contactPersonPhone && (
                        <p className="text-red-600 text-sm mt-1">{createFormErrors.contactPersonPhone}</p>
                      )}
                    </div>

                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-2">
                        Designation
                      </label>
                      <input
                        {...createForm.register('contactPerson.designation')}
                        type="text"
                        required
                        className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                        placeholder="Job title or designation"
                      />
                    </div>
                  </div>
                </div>

                {/* Event Details */}
                <div>
                  <h4 className="text-lg font-medium text-gray-900 mb-4">Event Details (Optional)</h4>
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-2">
                        Event Name
                      </label>
                      <input
                        {...createForm.register('eventDetails.eventName')}
                        type="text"
                        required
                        className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                        placeholder="Event name"
                      />
                    </div>

                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-2">
                        Event Type
                      </label>
                      <select
                        {...createForm.register('eventDetails.eventType')}
                        className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                      >
                        <option value="">Select event type</option>
                        <option value="conference">Conference</option>
                        <option value="training">Training</option>
                        <option value="meeting">Meeting</option>
                        <option value="team_building">Team Building</option>
                        <option value="other">Other</option>
                      </select>
                    </div>

                    <div className="md:col-span-2">
                      <label className="block text-sm font-medium text-gray-700 mb-2">
                        Event Description
                      </label>
                      <textarea
                        {...createForm.register('eventDetails.eventDescription')}
                        rows={3}
                        className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                        placeholder="Describe the event"
                      />
                    </div>

                    <div className="md:col-span-2">
                      <label className="block text-sm font-medium text-gray-700 mb-3">
                        Requirements
                      </label>
                      <div className="space-y-2">
                        <label className="flex items-center">
                          <input
                            {...createForm.register('eventDetails.meetingRoomRequired')}
                            type="checkbox"
                            className="rounded border-gray-300 text-blue-600 focus:ring-blue-500"
                          />
                          <span className="ml-2 text-sm text-gray-700">Meeting Room Required</span>
                        </label>
                        <label className="flex items-center">
                          <input
                            {...createForm.register('eventDetails.cateringRequired')}
                            type="checkbox"
                            className="rounded border-gray-300 text-blue-600 focus:ring-blue-500"
                          />
                          <span className="ml-2 text-sm text-gray-700">Catering Required</span>
                        </label>
                        <label className="flex items-center">
                          <input
                            {...createForm.register('eventDetails.transportRequired')}
                            type="checkbox"
                            className="rounded border-gray-300 text-blue-600 focus:ring-blue-500"
                          />
                          <span className="ml-2 text-sm text-gray-700">Transport Required</span>
                        </label>
                      </div>
                    </div>
                  </div>
                </div>

                {/* Invoice Details */}
                <div>
                  <h4 className="text-lg font-medium text-gray-900 mb-4">Invoice Details (Optional)</h4>
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-2">
                        Billing Email
                      </label>
                      <input
                        {...createForm.register('invoiceDetails.billingEmail')}
                        type="email"
                        className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                        placeholder="billing@company.com"
                      />
                    </div>

                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-2">
                        Purchase Order Number
                      </label>
                      <input
                        {...createForm.register('invoiceDetails.purchaseOrderNumber')}
                        type="text"
                        className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                        placeholder="PO-2025-001"
                      />
                    </div>

                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-2">
                        Cost Center
                      </label>
                      <input
                        {...createForm.register('invoiceDetails.costCenter')}
                        type="text"
                        className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                        placeholder="CORP-EVENTS"
                      />
                    </div>
                  </div>
                </div>

                {/* Rooms */}
                <div>
                  <div className="flex items-center justify-between mb-4">
                    <h4 className="text-lg font-medium text-gray-900">Rooms ({createRoomFields.length})</h4>
                    <Button
                      type="button"
                      onClick={handleAddCreateRoom}
                      className="flex items-center"
                      disabled={createRoomFields.length >= 50}
                    >
                      <Plus className="w-4 h-4 mr-2" />
                      Add Room
                    </Button>
                  </div>

                  <div className="space-y-4">
                    {createRoomFields.map((field, index) => (
                      <div key={field.id} className="border border-gray-200 rounded-lg p-4">
                        <div className="flex items-center justify-between mb-3">
                          <h5 className="text-md font-medium text-gray-700">Room {index + 1}</h5>
                          {createRoomFields.length > 1 && (
                            <Button
                              type="button"
                              variant="outline"
                              size="sm"
                              onClick={() => handleRemoveCreateRoom(index)}
                              className="text-red-600 hover:text-red-700"
                            >
                              <Trash2 className="w-4 h-4" />
                            </Button>
                          )}
                        </div>

                        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                          <div>
                            <label className="block text-sm font-medium text-gray-700 mb-2">
                              Guest Name *
                            </label>
                            <input
                              {...createForm.register(`rooms.${index}.guestName`)}
                              type="text"
                              required
                              className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                              placeholder="Guest name"
                            />
                          </div>

                          <div>
                            <label className="block text-sm font-medium text-gray-700 mb-2">
                              Guest Email
                            </label>
                            <input
                              {...createForm.register(`rooms.${index}.guestEmail`)}
                              type="email"
                              required
                              className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                              placeholder="Guest email"
                            />
                          </div>

                          <div>
                            <label className="block text-sm font-medium text-gray-700 mb-2">
                              Guest Phone
                            </label>
                            <input
                              {...createForm.register(`rooms.${index}.guestPhone`)}
                              type="tel"
                              className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                              placeholder="Guest phone"
                            />
                          </div>

                          <div>
                            <label className="block text-sm font-medium text-gray-700 mb-2">
                              Employee ID
                            </label>
                            <input
                              {...createForm.register(`rooms.${index}.employeeId`)}
                              type="text"
                              className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                              placeholder="Employee ID"
                            />
                          </div>

                          <div>
                            <label className="block text-sm font-medium text-gray-700 mb-2">
                              Department
                            </label>
                            <input
                              {...createForm.register(`rooms.${index}.department`)}
                              type="text"
                              className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                              placeholder="Department"
                            />
                          </div>

                          <div>
                            <label className="block text-sm font-medium text-gray-700 mb-2">
                              Room Type *
                            </label>
                            <select
                              {...createForm.register(`rooms.${index}.roomType`)}
                              className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                            >
                              <option value="single">Single</option>
                              <option value="double">Double</option>
                              <option value="suite">Suite</option>
                              <option value="deluxe">Deluxe</option>
                            </select>
                          </div>

                          <div className="md:col-span-3">
                            <label className="block text-sm font-medium text-gray-700 mb-2">
                              Special Requests
                            </label>
                            <textarea
                              {...createForm.register(`rooms.${index}.specialRequests`)}
                              rows={2}
                              className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                              placeholder="Any special requests for this room"
                            />
                          </div>
                        </div>
                      </div>
                    ))}
                  </div>
                </div>

                {/* Special Instructions */}
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">
                    Special Instructions
                  </label>
                  <textarea
                    {...createForm.register('specialInstructions')}
                    rows={3}
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                    placeholder="Any special instructions for this group booking"
                  />
                </div>
              </div>
            </form>

            <div className="flex justify-end space-x-3 p-6 border-t border-gray-200">
              <Button
                variant="outline"
                onClick={() => {
                  setCreatingBooking(false);
                  createForm.reset();
                  setCreateFormErrors({});
                }}
              >
                Cancel
              </Button>
              <Button
                onClick={createForm.handleSubmit(handleCreateBooking)}
                disabled={createBookingMutation.isPending}
              >
                {createBookingMutation.isPending ? 'Creating...' : 'Create Group Booking'}
              </Button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

export default withErrorBoundary(GroupBookingManagement, { level: 'component' });