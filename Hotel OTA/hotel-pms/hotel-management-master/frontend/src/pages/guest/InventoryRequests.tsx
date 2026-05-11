import React, { useState, useEffect, useCallback } from 'react';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { useAuth } from '../../context/AuthContext';
import { guestServiceService, GuestServiceRequest } from '../../services/guestService';
import { bookingService } from '../../services/bookingService';
import { useRealTime } from '../../services/realTimeService';
import { useDebounce } from '../../hooks/useDebounce';
import {
  Plus,
  Package,
  Search,
  Eye,
  XCircle,
  ChevronLeft,
  ChevronRight,
  AlertTriangle
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Card } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { LoadingSpinner } from '../../components/LoadingSpinner';
import { formatDate } from '../../utils/formatters';
import toast from 'react-hot-toast';
import { withErrorBoundary } from '../../components/ErrorBoundary';

interface Booking {
  _id: string;
  bookingNumber: string;
  checkIn: string;
  checkOut: string;
  status: string;
}

const PAGE_SIZE = 20;
const DEFAULT_REQUEST_TITLE = 'Inventory Request';

const getStatusColor = (status: string) => {
  switch (status) {
    case 'pending': return 'bg-orange-100 text-orange-800';
    case 'assigned': return 'bg-blue-100 text-blue-800';
    case 'in_progress': return 'bg-yellow-100 text-yellow-800';
    case 'completed': return 'bg-green-100 text-green-800';
    case 'cancelled': return 'bg-red-100 text-red-800';
    default: return 'bg-gray-100 text-gray-800';
  }
};

const getPriorityColor = (priority: string) => {
  switch (priority) {
    case 'urgent': return 'bg-red-100 text-red-800';
    case 'high': return 'bg-orange-100 text-orange-800';
    case 'medium': return 'bg-yellow-100 text-yellow-800';
    case 'low': return 'bg-green-100 text-green-800';
    default: return 'bg-gray-100 text-gray-800';
  }
};

function InventoryRequests() {
  const { user } = useAuth();
  const { on, off } = useRealTime();
  const queryClient = useQueryClient();
  const [bookings, setBookings] = useState<Booking[]>([]);
  const [creating, setCreating] = useState(false);
  const [cancelling, setCancelling] = useState<string | null>(null);
  const [showCreateForm, setShowCreateForm] = useState(false);
  const [selectedRequest, setSelectedRequest] = useState<GuestServiceRequest | null>(null);
  const [filter, setFilter] = useState('all');
  const [searchTerm, setSearchTerm] = useState('');
  const debouncedSearchTerm = useDebounce(searchTerm, 300);
  const [page, setPage] = useState(1);
  const [confirmCancelId, setConfirmCancelId] = useState<string | null>(null);

  // Form state
  const [formData, setFormData] = useState({
    bookingId: '',
    title: '',
    description: '',
    priority: 'medium',
    items: [{ name: '', quantity: 1, price: 0 }],
    specialInstructions: ''
  });

  const { data: requestsData, isLoading: loading, refetch } = useQuery({
    queryKey: ['inventory-requests', filter, page, debouncedSearchTerm],
    queryFn: async () => {
      const response = await guestServiceService.getServiceRequests({
        serviceType: 'other',
        serviceVariation: 'inventory_request',
        status: filter !== 'all' ? filter : undefined,
        search: debouncedSearchTerm?.trim() || undefined,
        page,
        limit: PAGE_SIZE
      });
      return response;
    },
    staleTime: 2 * 60 * 1000,
    placeholderData: (prev: unknown) => prev,
    enabled: !!user,
  });

  const requests = requestsData?.data?.serviceRequests || requestsData?.serviceRequests || [];
  const pagination = requestsData?.data?.pagination || requestsData?.pagination || {};
  const totalPages = pagination?.pages || 1;
  const totalCount = pagination?.total || 0;
  const error = requestsData === undefined && !loading ? 'Failed to load inventory requests. Please try again.' : null;

  const fetchBookings = useCallback(async () => {
    try {
      // Use server-side status filter to avoid fetching all bookings client-side
      const response = await bookingService.getUserBookings({ status: 'confirmed,checked_in', page: 1, limit: 20 });
      const bookingsData = Array.isArray(response.data?.bookings)
        ? response.data.bookings
        : Array.isArray(response.data)
          ? response.data
          : [];
      setBookings(bookingsData.filter((b: Booking) => ['confirmed', 'checked_in'].includes(b.status)));
    } catch {
      // Bookings fetch is non-critical; guest can still view existing requests
    }
  }, []);

  useEffect(() => {
    if (user) {
      fetchBookings();
    }
  }, [user, fetchBookings]);

  // Real-time updates for guest service events
  useEffect(() => {
    const handleServiceUpdate = () => {
      queryClient.invalidateQueries({ queryKey: ['inventory-requests'] });
    };

    on('guest-services:updated', handleServiceUpdate);
    on('guest-services:status_changed', handleServiceUpdate);
    on('guest-services:assigned', handleServiceUpdate);
    on('guest-services:completed', handleServiceUpdate);

    return () => {
      off('guest-services:updated', handleServiceUpdate);
      off('guest-services:status_changed', handleServiceUpdate);
      off('guest-services:assigned', handleServiceUpdate);
      off('guest-services:completed', handleServiceUpdate);
    };
  }, [on, off, queryClient]);

  // Reset page when filter changes
  useEffect(() => {
    setPage((prevPage) => (prevPage === 1 ? prevPage : 1));
  }, [filter]);

  const handleCreateRequest = async () => {
    if (creating) return; // Prevent double-submit

    if (!formData.bookingId || !formData.title) {
      toast.error('Please fill in all required fields');
      return;
    }

    // Validate items: ensure all named items have valid quantities
    const validItems = formData.items.filter(item => item.name.trim());
    const invalidItems = validItems.filter(item => item.quantity < 1);
    if (invalidItems.length > 0) {
      toast.error('All item quantities must be at least 1');
      return;
    }

    try {
      setCreating(true);
      await guestServiceService.createServiceRequest({
        bookingId: formData.bookingId,
        serviceType: 'other',
        serviceVariation: 'inventory_request',
        serviceVariations: ['inventory_request'],
        title: formData.title,
        description: formData.description,
        priority: formData.priority,
        items: validItems,
        specialInstructions: formData.specialInstructions
      });

      toast.success('Inventory request created successfully');
      setShowCreateForm(false);
      resetForm();
      setPage(1);
      queryClient.invalidateQueries({ queryKey: ['inventory-requests'] });
    } catch {
      toast.error('Failed to create inventory request');
    } finally {
      setCreating(false);
    }
  };

  const handleCancelRequest = (requestId: string) => {
    setConfirmCancelId(requestId);
  };

  const confirmCancelRequest = async () => {
    if (!confirmCancelId) return;
    const requestId = confirmCancelId;
    setConfirmCancelId(null);
    try {
      setCancelling(requestId);
      await guestServiceService.cancelServiceRequest(requestId, 'Cancelled by guest');
      toast.success('Request cancelled successfully');
      queryClient.invalidateQueries({ queryKey: ['inventory-requests'] });
    } catch {
      toast.error('Failed to cancel request');
    } finally {
      setCancelling(null);
    }
  };

  const resetForm = () => {
    setFormData({
      bookingId: '',
      title: '',
      description: '',
      priority: 'medium',
      items: [{ name: '', quantity: 1, price: 0 }],
      specialInstructions: ''
    });
  };

  const addItem = () => {
    setFormData(prev => ({
      ...prev,
      items: [...prev.items, { name: '', quantity: 1, price: 0 }]
    }));
  };

  const removeItem = (index: number) => {
    setFormData(prev => ({
      ...prev,
      items: prev.items.filter((_, i) => i !== index)
    }));
  };

  const updateItem = (index: number, field: string, value: string | number) => {
    // Enforce minimum quantity of 1
    if (field === 'quantity') {
      const numValue = typeof value === 'string' ? parseInt(value) : value;
      value = isNaN(numValue) || numValue < 1 ? 1 : numValue;
    }
    setFormData(prev => ({
      ...prev,
      items: prev.items.map((item, i) =>
        i === index ? { ...item, [field]: value } : item
      )
    }));
  };

  // Reset page when search term changes
  useEffect(() => {
    setPage((prevPage) => (prevPage === 1 ? prevPage : 1));
  }, [debouncedSearchTerm]);

  // Error state
  if (error && !loading && requests.length === 0) {
    return (
      <div className="p-6 max-w-7xl mx-auto">
        <div className="text-center py-12">
          <AlertTriangle className="mx-auto h-12 w-12 text-red-400 mb-4" />
          <h3 className="text-lg font-medium text-gray-900 mb-2">Failed to load requests</h3>
          <p className="text-gray-500 mb-4">{error}</p>
          <Button onClick={() => refetch()}>
            Retry
          </Button>
        </div>
      </div>
    );
  }

  return (
    <div className="p-6 max-w-7xl mx-auto">
      <div className="mb-8 flex justify-between items-start">
        <div>
          <h1 className="text-3xl font-bold text-gray-900 mb-2">Inventory Requests</h1>
          <div className="flex items-center space-x-4">
            <p className="text-gray-600">Request additional items or report missing/damaged inventory</p>
            {totalCount > 0 && (
              <span className="text-sm text-gray-400">({totalCount} total)</span>
            )}
          </div>
        </div>
        <Button onClick={() => setShowCreateForm(true)}>
          <Plus className="h-4 w-4 mr-2" />
          New Request
        </Button>
      </div>

      {/* Filters and Search */}
      <div className="mb-6 flex flex-col sm:flex-row gap-4">
        <div className="flex-1">
          <div className="relative">
            <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400 h-4 w-4" />
            <Input
              placeholder="Search requests..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="pl-10"
            />
          </div>
        </div>
        <div className="flex gap-2">
          <Button
            variant={filter === 'all' ? 'default' : 'outline'}
            onClick={() => setFilter('all')}
          >
            All
          </Button>
          <Button
            variant={filter === 'pending' ? 'default' : 'outline'}
            onClick={() => setFilter('pending')}
          >
            Pending
          </Button>
          <Button
            variant={filter === 'in_progress' ? 'default' : 'outline'}
            onClick={() => setFilter('in_progress')}
          >
            In Progress
          </Button>
          <Button
            variant={filter === 'completed' ? 'default' : 'outline'}
            onClick={() => setFilter('completed')}
          >
            Completed
          </Button>
        </div>
      </div>

      {/* Create Request Modal */}
      {showCreateForm && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
          <div className="bg-white rounded-lg p-6 w-full max-w-2xl max-h-[90vh] overflow-y-auto">
            <h2 className="text-2xl font-bold mb-4">Create Inventory Request</h2>

            <div className="space-y-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Booking *
                </label>
                <select
                  value={formData.bookingId}
                  onChange={(e) => setFormData(prev => ({ ...prev, bookingId: e.target.value }))}
                  className="w-full p-2 border border-gray-300 rounded-md"
                >
                  <option value="">Select a booking</option>
                  {bookings.map(booking => (
                    <option key={booking._id} value={booking._id}>
                      {booking.bookingNumber} - {formatDate(booking.checkIn)} to {formatDate(booking.checkOut)}
                    </option>
                  ))}
                </select>
                {bookings.length === 0 && (
                  <p className="mt-1 text-sm text-amber-600">No active bookings found. You need a confirmed or checked-in booking to create a request.</p>
                )}
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Request Title *
                </label>
                <Input
                  value={formData.title}
                  onChange={(e) => setFormData(prev => ({ ...prev, title: e.target.value }))}
                  placeholder="e.g., Missing towels, Damaged lamp, Need extra pillows"
                  maxLength={200}
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Description
                </label>
                <textarea
                  value={formData.description}
                  onChange={(e) => setFormData(prev => ({ ...prev, description: e.target.value }))}
                  placeholder="Provide details about your request..."
                  className="w-full p-2 border border-gray-300 rounded-md h-20"
                  maxLength={1000}
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Priority
                </label>
                <select
                  value={formData.priority}
                  onChange={(e) => setFormData(prev => ({ ...prev, priority: e.target.value }))}
                  className="w-full p-2 border border-gray-300 rounded-md"
                >
                  <option value="low">Low</option>
                  <option value="medium">Medium</option>
                  <option value="high">High</option>
                  <option value="urgent">Urgent</option>
                </select>
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  Items Needed
                </label>
                {formData.items.map((item, index) => (
                  <div key={`formData-items-${index}`} className="flex gap-2 mb-2">
                    <Input
                      value={item.name}
                      onChange={(e) => updateItem(index, 'name', e.target.value)}
                      placeholder="Item name"
                      className="flex-1"
                    />
                    <Input
                      type="number"
                      value={item.quantity}
                      onChange={(e) => updateItem(index, 'quantity', e.target.value)}
                      placeholder="Qty"
                      className="w-20"
                      min={1}
                    />
                    <Button
                      type="button"
                      variant="outline"
                      onClick={() => removeItem(index)}
                      disabled={formData.items.length === 1}
                    >
                      <XCircle className="h-4 w-4" />
                    </Button>
                  </div>
                ))}
                <Button type="button" variant="outline" onClick={addItem} className="mt-2">
                  <Plus className="h-4 w-4 mr-2" />
                  Add Item
                </Button>
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Special Instructions
                </label>
                <textarea
                  value={formData.specialInstructions}
                  onChange={(e) => setFormData(prev => ({ ...prev, specialInstructions: e.target.value }))}
                  placeholder="Any special instructions or preferences..."
                  className="w-full p-2 border border-gray-300 rounded-md h-20"
                  maxLength={300}
                />
              </div>
            </div>

            <div className="flex gap-2 mt-6">
              <Button onClick={handleCreateRequest} disabled={creating}>
                {creating ? 'Creating...' : 'Create Request'}
              </Button>
              <Button variant="outline" onClick={() => {
                setShowCreateForm(false);
                resetForm();
              }}>
                Cancel
              </Button>
            </div>
          </div>
        </div>
      )}

      {/* Detail View Modal */}
      {selectedRequest && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
          <div className="bg-white rounded-lg p-6 w-full max-w-lg max-h-[90vh] overflow-y-auto">
            <h2 className="text-2xl font-bold mb-4">{selectedRequest.title || DEFAULT_REQUEST_TITLE}</h2>
            <div className="space-y-3">
              <div className="flex gap-2">
                <span className={`px-2 py-1 rounded-full text-xs font-medium ${getStatusColor(selectedRequest.status)}`}>
                  {selectedRequest.status.replace('_', ' ')}
                </span>
                <span className={`px-2 py-1 rounded-full text-xs font-medium ${getPriorityColor(selectedRequest.priority)}`}>
                  {selectedRequest.priority}
                </span>
              </div>
              {selectedRequest.description && (
                <div>
                  <p className="text-sm font-medium text-gray-700">Description</p>
                  <p className="text-gray-600">{selectedRequest.description}</p>
                </div>
              )}
              {selectedRequest.items && selectedRequest.items.length > 0 && (
                <div>
                  <p className="text-sm font-medium text-gray-700 mb-1">Requested Items</p>
                  <ul className="list-disc list-inside text-gray-600">
                    {selectedRequest.items.map((item, idx) => (
                      <li key={`detail-item-${idx}`}>{item.name} - Qty: {item.quantity}</li>
                    ))}
                  </ul>
                </div>
              )}
              {selectedRequest.specialInstructions && (
                <div>
                  <p className="text-sm font-medium text-gray-700">Special Instructions</p>
                  <p className="text-gray-600">{selectedRequest.specialInstructions}</p>
                </div>
              )}
              <div className="text-sm text-gray-500 space-y-1">
                <p>Booking: {selectedRequest.bookingId?.bookingNumber || 'N/A'}</p>
                <p>Created: {formatDate(selectedRequest.createdAt)}</p>
                {selectedRequest.assignedTo && <p>Assigned to: {selectedRequest.assignedTo.name}</p>}
                {selectedRequest.completedTime && <p>Completed: {formatDate(selectedRequest.completedTime)}</p>}
                {selectedRequest.notes && <p>Staff Notes: {selectedRequest.notes}</p>}
              </div>
            </div>
            <div className="flex gap-2 mt-6">
              {['pending', 'assigned'].includes(selectedRequest.status) && (
                <Button
                  variant="outline"
                  onClick={() => {
                    handleCancelRequest(selectedRequest._id);
                    setSelectedRequest(null);
                  }}
                  className="text-red-600 border-red-300 hover:bg-red-50"
                >
                  <XCircle className="h-4 w-4 mr-1" />
                  Cancel Request
                </Button>
              )}
              <Button variant="outline" onClick={() => setSelectedRequest(null)}>
                Close
              </Button>
            </div>
          </div>
        </div>
      )}

      {/* Loading overlay for page transitions */}
      {loading && requests.length > 0 && (
        <div className="flex justify-center py-4">
          <LoadingSpinner />
        </div>
      )}

      {/* Initial loading state */}
      {loading && requests.length === 0 && (
        <div className="flex items-center justify-center h-64">
          <LoadingSpinner />
        </div>
      )}

      {/* Requests List */}
      {!loading && (
        <div className="space-y-4">
          {requests.length > 0 ? (
            <>
              {requests.map((request) => (
                <Card key={request._id} className="p-4">
                  <div className="flex justify-between items-start">
                    <div className="flex-1">
                      <div className="flex items-center gap-2 mb-2">
                        <h3 className="text-lg font-semibold">{request.title || DEFAULT_REQUEST_TITLE}</h3>
                        <span className={`px-2 py-1 rounded-full text-xs font-medium ${getStatusColor(request.status)}`}>
                          {request.status.replace('_', ' ')}
                        </span>
                        <span className={`px-2 py-1 rounded-full text-xs font-medium ${getPriorityColor(request.priority)}`}>
                          {request.priority}
                        </span>
                      </div>

                      {request.description && (
                        <p className="text-gray-600 mb-2">{request.description}</p>
                      )}

                      {request.items && request.items.length > 0 && (
                        <div className="mb-2">
                          <p className="text-sm font-medium text-gray-700 mb-1">Requested Items:</p>
                          <div className="flex flex-wrap gap-2">
                            {request.items.map((item, index) => (
                              <span key={`request-items-${request._id}-${index}`} className="px-2 py-1 bg-gray-100 rounded text-sm">
                                {item.name} (Qty: {item.quantity})
                              </span>
                            ))}
                          </div>
                        </div>
                      )}

                      {request.specialInstructions && (
                        <p className="text-sm text-gray-500 mb-2">
                          <strong>Special Instructions:</strong> {request.specialInstructions}
                        </p>
                      )}

                      <div className="flex items-center gap-4 text-sm text-gray-500">
                        <span>Booking: {request.bookingId?.bookingNumber || 'N/A'}</span>
                        <span>Created: {formatDate(request.createdAt)}</span>
                        {request.assignedTo && (
                          <span>Assigned to: {request.assignedTo.name}</span>
                        )}
                      </div>
                    </div>

                    <div className="flex gap-2 ml-4 flex-shrink-0">
                      <Button variant="outline" size="sm" onClick={() => setSelectedRequest(request)}>
                        <Eye className="h-4 w-4 mr-1" />
                        View
                      </Button>
                      {['pending', 'assigned'].includes(request.status) && (
                        <Button
                          variant="outline"
                          size="sm"
                          onClick={() => handleCancelRequest(request._id)}
                          disabled={cancelling === request._id}
                          className="text-red-600 border-red-300 hover:bg-red-50"
                        >
                          <XCircle className="h-4 w-4 mr-1" />
                          {cancelling === request._id ? 'Cancelling...' : 'Cancel'}
                        </Button>
                      )}
                    </div>
                  </div>
                </Card>
              ))}

              {/* Pagination Controls */}
              {totalPages > 1 && (
                <div className="flex items-center justify-between pt-4 border-t">
                  <p className="text-sm text-gray-600">
                    Page {page} of {totalPages} ({totalCount} total requests)
                  </p>
                  <div className="flex gap-2">
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => setPage(p => Math.max(1, p - 1))}
                      disabled={page <= 1}
                    >
                      <ChevronLeft className="h-4 w-4 mr-1" />
                      Previous
                    </Button>
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => setPage(p => Math.min(totalPages, p + 1))}
                      disabled={page >= totalPages}
                    >
                      Next
                      <ChevronRight className="h-4 w-4 ml-1" />
                    </Button>
                  </div>
                </div>
              )}
            </>
          ) : (
            <div className="text-center py-12">
              <Package className="mx-auto h-12 w-12 text-gray-400 mb-4" />
              <h3 className="text-lg font-medium text-gray-900 mb-2">No inventory requests found</h3>
              <p className="text-gray-500 mb-4">
                {searchTerm || filter !== 'all'
                  ? 'Try adjusting your search or filters'
                  : 'You haven\'t made any inventory requests yet'
                }
              </p>
              {!searchTerm && filter === 'all' && (
                <Button onClick={() => setShowCreateForm(true)}>
                  <Plus className="h-4 w-4 mr-2" />
                  Create Your First Request
                </Button>
              )}
            </div>
          )}
        </div>
      )}

      {/* Cancel Request Confirmation Dialog */}
      {confirmCancelId && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4" role="dialog" aria-modal="true" aria-labelledby="cancel-inv-request-title">
          <Card className="max-w-md w-full p-6">
            <h3 id="cancel-inv-request-title" className="text-lg font-semibold text-gray-900 mb-2">Cancel Request</h3>
            <p className="text-gray-600 mb-6">Are you sure you want to cancel this inventory request?</p>
            <div className="flex justify-end gap-3">
              <Button variant="outline" onClick={() => setConfirmCancelId(null)}>Keep Request</Button>
              <Button variant="outline" className="text-red-600 border-red-300 hover:bg-red-50" onClick={confirmCancelRequest}>
                <XCircle className="h-4 w-4 mr-1" /> Cancel Request
              </Button>
            </div>
          </Card>
        </div>
      )}
    </div>
  );
}

export default withErrorBoundary(InventoryRequests);
