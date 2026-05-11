'use client';

import { useState, useEffect, useCallback } from 'react';
import Link from 'next/link';

interface RoomServiceRequest {
  id: string;
  room_number: string;
  guest_name: string;
  service_type: string;
  description: string;
  status: 'pending' | 'assigned' | 'in_progress' | 'completed' | 'cancelled';
  priority: 'low' | 'medium' | 'high' | 'urgent';
  created_at: string;
  assigned_to_name?: string;
  sla_deadline?: string;
  sla_status?: 'ok' | 'warning' | 'breach';
}

interface Staff {
  id: string;
  name: string;
  department: string;
  current_load: number;
}

const SERVICE_TYPES = [
  { value: 'housekeeping', label: 'Housekeeping', icon: '🧹' },
  { value: 'room_service', label: 'Room Service', icon: '🍽️' },
  { value: 'spa', label: 'Spa & Wellness', icon: '💆' },
  { value: 'laundry', label: 'Laundry', icon: '👕' },
  { value: 'maintenance', label: 'Maintenance', icon: '🔧' },
  { value: 'concierge', label: 'Concierge', icon: '🛎️' },
  { value: 'transport', label: 'Transport', icon: '🚗' },
];

const PRIORITIES = [
  { value: 'low', label: 'Low', color: 'bg-gray-100 text-gray-700' },
  { value: 'medium', label: 'Medium', color: 'bg-blue-100 text-blue-700' },
  { value: 'high', label: 'High', color: 'bg-amber-100 text-amber-700' },
  { value: 'urgent', label: 'Urgent', color: 'bg-red-100 text-red-700' },
];

const COLUMNS = [
  { id: 'pending', title: 'Pending', color: 'border-gray-300 bg-gray-50' },
  { id: 'assigned', title: 'Assigned', color: 'border-blue-300 bg-blue-50' },
  { id: 'in_progress', title: 'In Progress', color: 'border-amber-300 bg-amber-50' },
  { id: 'completed', title: 'Completed', color: 'border-green-300 bg-green-50' },
];

export default function RequestsPage() {
  const [requests, setRequests] = useState<RoomServiceRequest[]>([]);
  const [staff, setStaff] = useState<Staff[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [filterType, setFilterType] = useState<string>('all');
  const [filterPriority, setFilterPriority] = useState<string>('all');
  const [filterRoom, setFilterRoom] = useState<string>('');
  const [selectedRequest, setSelectedRequest] = useState<RoomServiceRequest | null>(null);
  const [showAssignModal, setShowAssignModal] = useState(false);
  const [autoAssigning, setAutoAssigning] = useState(false);

  useEffect(() => {
    fetchRequests();
    fetchStaff();
  }, []);

  const fetchRequests = async () => {
    try {
      const res = await fetch('/api/staff/requests', { credentials: 'include' });
      if (!res.ok) throw new Error('Failed to fetch requests');
      const data = await res.json();
      setRequests(data.requests || []);
    } catch (err: any) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };

  const fetchStaff = async () => {
    try {
      const res = await fetch('/api/staff/team', { credentials: 'include' });
      if (res.ok) {
        const data = await res.json();
        setStaff(data.staff || []);
      }
    } catch (err) {
      console.error('Failed to fetch staff');
    }
  };

  const handleStatusChange = async (requestId: string, newStatus: string) => {
    try {
      const res = await fetch(`/api/staff/requests/${requestId}/status`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ status: newStatus }),
        credentials: 'include',
      });
      if (res.ok) {
        setRequests((prev) =>
          prev.map((r) => (r.id === requestId ? { ...r, status: newStatus as any } : r))
        );
      }
    } catch (err) {
      console.error('Failed to update status');
    }
  };

  const handleAssign = async (requestId: string, staffId: string) => {
    try {
      const res = await fetch(`/api/staff/requests/${requestId}/assign`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ staffId }),
        credentials: 'include',
      });
      if (res.ok) {
        const data = await res.json();
        setRequests((prev) =>
          prev.map((r) =>
            r.id === requestId
              ? {
                  ...r,
                  assigned_to_name: data.request.assigned_to_name,
                  status: 'assigned' as const,
                }
              : r
          )
        );
        setShowAssignModal(false);
        setSelectedRequest(null);
      }
    } catch (err) {
      console.error('Failed to assign request');
    }
  };

  const handleAutoAssign = async (requestId: string) => {
    setAutoAssigning(true);
    try {
      const res = await fetch('/api/staff/auto-assign', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ requestId }),
        credentials: 'include',
      });
      if (res.ok) {
        const data = await res.json();
        setRequests((prev) =>
          prev.map((r) =>
            r.id === requestId
              ? {
                  ...r,
                  assigned_to_name: data.assigned_to_name,
                  status: 'assigned' as const,
                }
              : r
          )
        );
      }
    } catch (err) {
      console.error('Failed to auto-assign');
    } finally {
      setAutoAssigning(false);
    }
  };

  const filteredRequests = requests.filter((r) => {
    if (filterType !== 'all' && r.service_type !== filterType) return false;
    if (filterPriority !== 'all' && r.priority !== filterPriority) return false;
    if (filterRoom && !r.room_number.includes(filterRoom)) return false;
    return true;
  });

  const getColumnRequests = (status: string) => {
    if (status === 'pending') {
      return filteredRequests.filter((r) => r.status === 'pending');
    }
    if (status === 'assigned') {
      return filteredRequests.filter((r) => r.status === 'assigned');
    }
    if (status === 'in_progress') {
      return filteredRequests.filter((r) => r.status === 'in_progress');
    }
    if (status === 'completed') {
      return filteredRequests.filter((r) => r.status === 'completed' || r.status === 'cancelled');
    }
    return [];
  };

  const getSLATimer = (request: RoomServiceRequest) => {
    if (!request.sla_deadline) return null;
    const deadline = new Date(request.sla_deadline);
    const now = new Date();
    const diffMs = deadline.getTime() - now.getTime();
    const diffMins = Math.floor(diffMs / 60000);

    if (diffMins < 0) {
      return { text: 'OVERDUE', color: 'text-red-600 bg-red-100' };
    }
    if (diffMins < 10) {
      return { text: `${diffMins}m left`, color: 'text-red-600 bg-red-100' };
    }
    if (diffMins < 30) {
      return { text: `${diffMins}m left`, color: 'text-amber-600 bg-amber-100' };
    }
    return { text: `${diffMins}m left`, color: 'text-green-600 bg-green-100' };
  };

  if (loading) {
    return (
      <div className="p-6 flex items-center justify-center h-64">
        <div className="w-10 h-10 border-4 border-blue-600 border-t-transparent rounded-full animate-spin" />
      </div>
    );
  }

  return (
    <div className="p-6">
      {/* Header */}
      <div className="flex flex-col lg:flex-row lg:items-center lg:justify-between gap-4 mb-6">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Service Requests</h1>
          <p className="text-gray-500 mt-1">Manage and track all guest requests</p>
        </div>

        {/* Filters */}
        <div className="flex flex-wrap gap-3">
          <select
            value={filterType}
            onChange={(e) => setFilterType(e.target.value)}
            className="px-3 py-2 border border-gray-200 rounded-lg text-sm focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
          >
            <option value="all">All Types</option>
            {SERVICE_TYPES.map((type) => (
              <option key={type.value} value={type.value}>
                {type.icon} {type.label}
              </option>
            ))}
          </select>

          <select
            value={filterPriority}
            onChange={(e) => setFilterPriority(e.target.value)}
            className="px-3 py-2 border border-gray-200 rounded-lg text-sm focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
          >
            <option value="all">All Priorities</option>
            {PRIORITIES.map((p) => (
              <option key={p.value} value={p.value}>
                {p.label}
              </option>
            ))}
          </select>

          <input
            type="text"
            placeholder="Room number..."
            value={filterRoom}
            onChange={(e) => setFilterRoom(e.target.value)}
            className="px-3 py-2 border border-gray-200 rounded-lg text-sm focus:ring-2 focus:ring-blue-500 focus:border-blue-500 w-32"
          />
        </div>
      </div>

      {/* Kanban Board */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
        {COLUMNS.map((column) => (
          <div key={column.id} className={`rounded-xl border-2 ${column.color}`}>
            {/* Column Header */}
            <div className="px-4 py-3 border-b border-gray-200/50">
              <div className="flex items-center justify-between">
                <h3 className="font-semibold text-gray-900">{column.title}</h3>
                <span className="bg-white px-2 py-0.5 rounded-full text-sm font-medium text-gray-600">
                  {getColumnRequests(column.id).length}
                </span>
              </div>
            </div>

            {/* Column Content */}
            <div className="p-3 space-y-3 max-h-[calc(100vh-300px)] overflow-y-auto">
              {getColumnRequests(column.id).length === 0 ? (
                <div className="text-center py-8 text-gray-400 text-sm">
                  No requests
                </div>
              ) : (
                getColumnRequests(column.id).map((request) => (
                  <RequestCard
                    key={request.id}
                    request={request}
                    slaTimer={getSLATimer(request)}
                    onStatusChange={handleStatusChange}
                    onAssign={() => {
                      setSelectedRequest(request);
                      setShowAssignModal(true);
                    }}
                    onAutoAssign={handleAutoAssign}
                    autoAssigning={autoAssigning}
                  />
                ))
              )}
            </div>
          </div>
        ))}
      </div>

      {/* Assign Modal */}
      {showAssignModal && selectedRequest && (
        <AssignModal
          request={selectedRequest}
          staff={staff}
          onAssign={handleAssign}
          onClose={() => {
            setShowAssignModal(false);
            setSelectedRequest(null);
          }}
        />
      )}
    </div>
  );
}

// Request Card Component
function RequestCard({
  request,
  slaTimer,
  onStatusChange,
  onAssign,
  onAutoAssign,
  autoAssigning,
}: {
  request: RoomServiceRequest;
  slaTimer: { text: string; color: string } | null;
  onStatusChange: (id: string, status: string) => void;
  onAssign: () => void;
  onAutoAssign: (id: string) => void;
  autoAssigning: boolean;
}) {
  const priorityColors = {
    low: 'border-gray-200',
    medium: 'border-blue-200',
    high: 'border-amber-300',
    urgent: 'border-red-400',
  };

  const serviceType = SERVICE_TYPES.find((t) => t.value === request.service_type);

  return (
    <div
      className={`bg-white rounded-lg border-l-4 ${priorityColors[request.priority]} shadow-sm p-4 hover:shadow-md transition-shadow`}
    >
      {/* Header */}
      <div className="flex items-start justify-between mb-2">
        <div>
          <p className="font-semibold text-gray-900">Room {request.room_number}</p>
          <p className="text-sm text-gray-500">{request.guest_name}</p>
        </div>
        <span className="text-xl">{serviceType?.icon || '📋'}</span>
      </div>

      {/* Service Type */}
      <p className="text-sm font-medium text-gray-700 mb-2">
        {serviceType?.label || request.service_type}
      </p>

      {/* Description */}
      <p className="text-sm text-gray-600 mb-3 line-clamp-2">{request.description}</p>

      {/* SLA Timer */}
      {slaTimer && (
        <div className={`inline-flex items-center px-2 py-1 rounded text-xs font-medium ${slaTimer.color} mb-3`}>
          {slaTimer.text === 'OVERDUE' ? '⚠️ OVERDUE' : `⏱️ ${slaTimer.text}`}
        </div>
      )}

      {/* Assigned To */}
      {request.assigned_to_name && (
        <p className="text-xs text-gray-500 mb-3">
          Assigned to: <span className="font-medium">{request.assigned_to_name}</span>
        </p>
      )}

      {/* Time */}
      <p className="text-xs text-gray-400 mb-3">
        {new Date(request.created_at).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
      </p>

      {/* Actions */}
      <div className="flex gap-2">
        {request.status === 'pending' && (
          <>
            <button
              onClick={() => onAutoAssign(request.id)}
              disabled={autoAssigning}
              className="flex-1 px-2 py-1.5 bg-purple-600 text-white text-xs font-medium rounded hover:bg-purple-700 disabled:opacity-50"
            >
              {autoAssigning ? 'Assigning...' : 'Auto-Assign'}
            </button>
            <button
              onClick={onAssign}
              className="flex-1 px-2 py-1.5 bg-blue-600 text-white text-xs font-medium rounded hover:bg-blue-700"
            >
              Assign
            </button>
          </>
        )}
        {request.status === 'assigned' && (
          <button
            onClick={() => onStatusChange(request.id, 'in_progress')}
            className="flex-1 px-2 py-1.5 bg-amber-600 text-white text-xs font-medium rounded hover:bg-amber-700"
          >
            Start Work
          </button>
        )}
        {request.status === 'in_progress' && (
          <button
            onClick={() => onStatusChange(request.id, 'completed')}
            className="flex-1 px-2 py-1.5 bg-green-600 text-white text-xs font-medium rounded hover:bg-green-700"
          >
            Complete
          </button>
        )}
        {request.status === 'completed' && (
          <span className="flex-1 px-2 py-1.5 bg-green-100 text-green-700 text-xs font-medium rounded text-center">
            Completed
          </span>
        )}
      </div>
    </div>
  );
}

// Assign Modal Component
function AssignModal({
  request,
  staff,
  onAssign,
  onClose,
}: {
  request: RoomServiceRequest;
  staff: Staff[];
  onAssign: (requestId: string, staffId: string) => void;
  onClose: () => void;
}) {
  const [selectedStaff, setSelectedStaff] = useState<string>('');

  return (
    <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
      <div className="bg-white rounded-xl shadow-xl max-w-md w-full">
        <div className="px-6 py-4 border-b border-gray-200">
          <h2 className="text-lg font-semibold text-gray-900">Assign Request</h2>
          <p className="text-sm text-gray-500 mt-1">
            Room {request.room_number} - {request.service_type}
          </p>
        </div>

        <div className="p-6">
          <label className="block text-sm font-medium text-gray-700 mb-2">
            Select Staff Member
          </label>
          <div className="space-y-2 max-h-60 overflow-y-auto">
            {staff.map((s) => (
              <label
                key={s.id}
                className={`flex items-center p-3 rounded-lg border cursor-pointer transition-colors ${
                  selectedStaff === s.id
                    ? 'border-blue-500 bg-blue-50'
                    : 'border-gray-200 hover:border-gray-300'
                }`}
              >
                <input
                  type="radio"
                  name="staff"
                  value={s.id}
                  checked={selectedStaff === s.id}
                  onChange={(e) => setSelectedStaff(e.target.value)}
                  className="mr-3"
                />
                <div className="flex-1">
                  <p className="font-medium text-gray-900">{s.name}</p>
                  <p className="text-sm text-gray-500 capitalize">{s.department.replace('_', ' ')}</p>
                </div>
                <span className="text-sm text-gray-500">
                  {s.current_load || 0} tasks
                </span>
              </label>
            ))}
          </div>
        </div>

        <div className="px-6 py-4 border-t border-gray-200 flex gap-3">
          <button
            onClick={onClose}
            className="flex-1 px-4 py-2 border border-gray-300 text-gray-700 rounded-lg hover:bg-gray-50"
          >
            Cancel
          </button>
          <button
            onClick={() => selectedStaff && onAssign(request.id, selectedStaff)}
            disabled={!selectedStaff}
            className="flex-1 px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 disabled:opacity-50"
          >
            Assign
          </button>
        </div>
      </div>
    </div>
  );
}
