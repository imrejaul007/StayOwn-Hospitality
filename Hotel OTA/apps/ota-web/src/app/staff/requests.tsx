'use client';

import { useState, useEffect, useCallback } from 'react';

interface ServiceRequest {
  id: string;
  booking_id: string;
  room_id: string;
  room_number: string;
  guest_name: string;
  service_type: string;
  description?: string;
  status: 'pending' | 'assigned' | 'in_progress' | 'completed' | 'cancelled';
  priority: 'low' | 'medium' | 'high' | 'now';
  created_at: string;
  assigned_to?: string;
  assigned_to_name?: string;
  notes?: string;
  sla_status?: 'on_track' | 'warning' | 'alert' | 'breached' | 'completed';
  sla_elapsed_minutes?: number;
  sla_target_minutes?: number;
  auto_assigned?: boolean;
}

interface StaffMember {
  id: string;
  name: string;
  department: string;
  active_requests?: number;
  performance_score?: number;
}

type FilterType = 'all' | 'housekeeping' | 'room_service' | 'laundry' | 'maintenance' | 'concierge' | 'spa' | 'transport' | 'fitness';
type SortOption = 'time' | 'priority' | 'room' | 'sla';

// SLA Configuration
const SLA_TARGETS: Record<string, number> = {
  housekeeping: 30,
  room_service: 20,
  spa: 60,
  laundry: 120,
  maintenance: 45,
  concierge: 15,
  transport: 30,
  fitness: 30,
};

// SLA Status colors
const SLA_STATUS_COLORS = {
  on_track: { bg: 'bg-green-100', text: 'text-green-700', border: 'border-green-300' },
  warning: { bg: 'bg-yellow-100', text: 'text-yellow-700', border: 'border-yellow-300' },
  alert: { bg: 'bg-orange-100', text: 'text-orange-700', border: 'border-orange-300' },
  breached: { bg: 'bg-red-100', text: 'text-red-700', border: 'border-red-300' },
  completed: { bg: 'bg-blue-100', text: 'text-blue-700', border: 'border-blue-300' },
};

export default function RequestsPage() {
  const [requests, setRequests] = useState<ServiceRequest[]>([]);
  const [staff, setStaff] = useState<StaffMember[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [filterType, setFilterType] = useState<FilterType>('all');
  const [sortBy, setSortBy] = useState<SortOption>('time');
  const [selectedRequest, setSelectedRequest] = useState<ServiceRequest | null>(null);
  const [showAssignModal, setShowAssignModal] = useState(false);
  const [showNotesModal, setShowNotesModal] = useState(false);
  const [notes, setNotes] = useState('');

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

  const updateRequestStatus = async (requestId: string, status: string) => {
    try {
      const res = await fetch(`/api/staff/requests/${requestId}/status`, {
        method: 'PUT',
        credentials: 'include',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ status }),
      });
      if (!res.ok) throw new Error('Failed to update status');
      await fetchRequests();
      setSelectedRequest(null);
    } catch (err: any) {
      setError(err.message);
    }
  };

  const assignRequest = async (requestId: string, staffId: string) => {
    try {
      const res = await fetch(`/api/staff/requests/${requestId}/assign`, {
        method: 'PUT',
        credentials: 'include',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ staffId }),
      });
      if (!res.ok) throw new Error('Failed to assign request');
      await fetchRequests();
      setShowAssignModal(false);
      setSelectedRequest(null);
    } catch (err: any) {
      setError(err.message);
    }
  };

  const updateNotes = async (requestId: string) => {
    try {
      const res = await fetch(`/api/staff/requests/${requestId}/notes`, {
        method: 'PUT',
        credentials: 'include',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ notes }),
      });
      if (!res.ok) throw new Error('Failed to update notes');
      await fetchRequests();
      setShowNotesModal(false);
      setNotes('');
      setSelectedRequest(null);
    } catch (err: any) {
      setError(err.message);
    }
  };

  const filteredRequests = requests.filter((r) => {
    if (filterType === 'all') return true;
    return r.service_type === filterType;
  });

  const sortedRequests = [...filteredRequests].sort((a, b) => {
    switch (sortBy) {
      case 'priority': {
        const priorityOrder = { now: 0, high: 1, medium: 2, low: 3 };
        return priorityOrder[a.priority] - priorityOrder[b.priority];
      }
      case 'room':
        return a.room_number.localeCompare(b.room_number);
      case 'sla': {
        const slaOrder = { breached: 0, alert: 1, warning: 2, on_track: 3, completed: 4 };
        const slaA = getSLAStatus(a);
        const slaB = getSLAStatus(b);
        return (slaOrder[slaA] || 0) - (slaOrder[slaB] || 0);
      }
      case 'time':
      default:
        return new Date(b.created_at).getTime() - new Date(a.created_at).getTime();
    }
  });

  const pendingRequests = sortedRequests.filter((r) => r.status === 'pending');
  const inProgressRequests = sortedRequests.filter((r) => r.status === 'in_progress' || r.status === 'assigned');
  const completedRequests = sortedRequests.filter((r) => r.status === 'completed' || r.status === 'cancelled');

  // SLA Statistics
  const slaStats = {
    onTrack: sortedRequests.filter(r => getSLAStatus(r) === 'on_track').length,
    warning: sortedRequests.filter(r => getSLAStatus(r) === 'warning').length,
    alert: sortedRequests.filter(r => getSLAStatus(r) === 'alert').length,
    breached: sortedRequests.filter(r => getSLAStatus(r) === 'breached').length,
  };

  const getPriorityColor = (priority: string) => {
    switch (priority) {
      case 'now': return 'bg-red-100 text-red-700 border-red-200';
      case 'high': return 'bg-orange-100 text-orange-700 border-orange-200';
      case 'medium': return 'bg-yellow-100 text-yellow-700 border-yellow-200';
      case 'low': return 'bg-gray-100 text-gray-600 border-gray-200';
      default: return 'bg-gray-100 text-gray-600';
    }
  };

  const getStatusColor = (status: string) => {
    switch (status) {
      case 'pending': return 'bg-amber-100 text-amber-700';
      case 'assigned': return 'bg-blue-100 text-blue-700';
      case 'in_progress': return 'bg-purple-100 text-purple-700';
      case 'completed': return 'bg-green-100 text-green-700';
      case 'cancelled': return 'bg-gray-100 text-gray-500';
      default: return 'bg-gray-100 text-gray-600';
    }
  };

  const getServiceIcon = (type: string) => {
    const icons: Record<string, string> = {
      housekeeping: '🧹',
      room_service: '🍽️',
      laundry: '👕',
      maintenance: '🔧',
      concierge: '🛎️',
      spa: '💆',
      transport: '🚗',
      fitness: '💪',
    };
    return icons[type] || '📋';
  };

  const formatTime = (dateStr: string) => {
    const date = new Date(dateStr);
    const now = new Date();
    const diffMs = now.getTime() - date.getTime();
    const diffMins = Math.floor(diffMs / 60000);

    if (diffMins < 1) return 'Just now';
    if (diffMins < 60) return `${diffMins}m ago`;
    if (diffMins < 1440) return `${Math.floor(diffMins / 60)}h ago`;
    return date.toLocaleDateString();
  };

  // Calculate SLA status for a request
  const getSLAStatus = useCallback((request: ServiceRequest) => {
    if (request.status === 'completed' || request.status === 'cancelled') {
      return 'completed';
    }
    if (request.sla_status) {
      return request.sla_status;
    }
    const targetMinutes = SLA_TARGETS[request.service_type] || 30;
    const createdAt = new Date(request.created_at);
    const elapsedMs = new Date().getTime() - createdAt.getTime();
    const elapsedMinutes = Math.floor(elapsedMs / 60000);
    const percentElapsed = (elapsedMinutes / targetMinutes) * 100;

    if (percentElapsed >= 100) return 'breached';
    if (percentElapsed >= 75) return 'alert';
    if (percentElapsed >= 50) return 'warning';
    return 'on_track';
  }, []);

  // Get SLA remaining time
  const getSLARemaining = useCallback((request: ServiceRequest) => {
    if (request.status === 'completed' || request.status === 'cancelled') return null;
    const targetMinutes = SLA_TARGETS[request.service_type] || 30;
    const createdAt = new Date(request.created_at);
    const elapsedMs = new Date().getTime() - createdAt.getTime();
    const elapsedMinutes = Math.floor(elapsedMs / 60000);
    const remaining = targetMinutes - elapsedMinutes;
    return { remaining, elapsed: elapsedMinutes, target: targetMinutes };
  }, []);

  // Get SLA progress color
  const getSLAProgressColor = (status: string) => {
    switch (status) {
      case 'breached': return 'bg-red-500';
      case 'alert': return 'bg-orange-500';
      case 'warning': return 'bg-yellow-500';
      case 'on_track': return 'bg-green-500';
      default: return 'bg-blue-500';
    }
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="w-8 h-8 border-4 border-blue-600 border-t-transparent rounded-full animate-spin"></div>
      </div>
    );
  }

  return (
    <div className="h-full flex flex-col">
      {/* Header */}
      <div className="p-6 border-b border-gray-200 bg-white">
        <div className="flex flex-col lg:flex-row lg:items-center lg:justify-between gap-4">
          <div>
            <h1 className="text-2xl font-bold text-gray-900">Service Requests</h1>
            <p className="text-gray-500 text-sm mt-1">
              {pendingRequests.length} pending, {inProgressRequests.length} in progress
            </p>
            {/* SLA Status Indicators */}
            <div className="flex gap-2 mt-2">
              {slaStats.breached > 0 && (
                <span className="flex items-center gap-1 text-xs px-2 py-1 bg-red-100 text-red-700 rounded-full">
                  <span className="w-2 h-2 bg-red-500 rounded-full"></span>
                  {slaStats.breached} breached
                </span>
              )}
              {slaStats.alert > 0 && (
                <span className="flex items-center gap-1 text-xs px-2 py-1 bg-orange-100 text-orange-700 rounded-full">
                  <span className="w-2 h-2 bg-orange-500 rounded-full"></span>
                  {slaStats.alert} at risk
                </span>
              )}
              {slaStats.warning > 0 && (
                <span className="flex items-center gap-1 text-xs px-2 py-1 bg-yellow-100 text-yellow-700 rounded-full">
                  <span className="w-2 h-2 bg-yellow-500 rounded-full"></span>
                  {slaStats.warning} warning
                </span>
              )}
              <span className="flex items-center gap-1 text-xs px-2 py-1 bg-green-100 text-green-700 rounded-full">
                <span className="w-2 h-2 bg-green-500 rounded-full"></span>
                {slaStats.onTrack} on track
              </span>
            </div>
          </div>

          {/* Filters */}
          <div className="flex flex-wrap gap-3">
            <select
              value={filterType}
              onChange={(e) => setFilterType(e.target.value as FilterType)}
              className="px-3 py-2 border border-gray-300 rounded-lg text-sm focus:ring-2 focus:ring-blue-500 focus:border-transparent"
            >
              <option value="all">All Types</option>
              <option value="housekeeping">Housekeeping</option>
              <option value="room_service">Room Service</option>
              <option value="laundry">Laundry</option>
              <option value="maintenance">Maintenance</option>
              <option value="concierge">Concierge</option>
              <option value="spa">Spa</option>
              <option value="transport">Transport</option>
              <option value="fitness">Fitness</option>
            </select>

            <select
              value={sortBy}
              onChange={(e) => setSortBy(e.target.value as SortOption)}
              className="px-3 py-2 border border-gray-300 rounded-lg text-sm focus:ring-2 focus:ring-blue-500 focus:border-transparent"
            >
              <option value="time">Sort by Time</option>
              <option value="priority">Sort by Priority</option>
              <option value="room">Sort by Room</option>
              <option value="sla">Sort by SLA</option>
            </select>
          </div>
        </div>
      </div>

      {/* Error banner */}
      {error && (
        <div className="mx-6 mt-4 bg-red-50 border border-red-200 text-red-700 px-4 py-3 rounded-lg text-sm">
          {error}
          <button onClick={() => setError('')} className="ml-2 underline">Dismiss</button>
        </div>
      )}

      {/* Kanban Board */}
      <div className="flex-1 p-6 overflow-x-auto">
        <div className="grid grid-cols-1 md:grid-cols-3 gap-6 min-w-[900px]">
          {/* Pending Column */}
          <KanbanColumn
            title="Pending"
            count={pendingRequests.length}
            color="bg-amber-500"
            requests={pendingRequests}
            onRequestClick={(r) => setSelectedRequest(r)}
            getPriorityColor={getPriorityColor}
            getServiceIcon={getServiceIcon}
            formatTime={formatTime}
            getSLAStatus={getSLAStatus}
            getSLARemaining={getSLARemaining}
            getSLAProgressColor={getSLAProgressColor}
          />

          {/* In Progress Column */}
          <KanbanColumn
            title="In Progress"
            count={inProgressRequests.length}
            color="bg-blue-500"
            requests={inProgressRequests}
            onRequestClick={(r) => setSelectedRequest(r)}
            getPriorityColor={getPriorityColor}
            getServiceIcon={getServiceIcon}
            formatTime={formatTime}
            getSLAStatus={getSLAStatus}
            getSLARemaining={getSLARemaining}
            getSLAProgressColor={getSLAProgressColor}
          />

          {/* Completed Column */}
          <KanbanColumn
            title="Completed"
            count={completedRequests.length}
            color="bg-green-500"
            requests={completedRequests}
            onRequestClick={(r) => setSelectedRequest(r)}
            getPriorityColor={getPriorityColor}
            getServiceIcon={getServiceIcon}
            formatTime={formatTime}
            getSLAStatus={getSLAStatus}
            getSLARemaining={getSLARemaining}
            getSLAProgressColor={getSLAProgressColor}
          />
        </div>
      </div>

      {/* Request Detail Modal */}
      {selectedRequest && !showAssignModal && !showNotesModal && (
        <RequestDetailModal
          request={selectedRequest}
          onClose={() => setSelectedRequest(null)}
          onAssign={() => setShowAssignModal(true)}
          onAddNotes={() => {
            setNotes(selectedRequest.notes || '');
            setShowNotesModal(true);
          }}
          onStatusChange={(status) => updateRequestStatus(selectedRequest.id, status)}
          getPriorityColor={getPriorityColor}
          getStatusColor={getStatusColor}
          getServiceIcon={getServiceIcon}
        />
      )}

      {/* Assign Modal */}
      {showAssignModal && selectedRequest && (
        <AssignModal
          request={selectedRequest}
          staff={staff}
          onClose={() => setShowAssignModal(false)}
          onAssign={(staffId) => assignRequest(selectedRequest.id, staffId)}
        />
      )}

      {/* Notes Modal */}
      {showNotesModal && selectedRequest && (
        <NotesModal
          notes={notes}
          onChange={setNotes}
          onClose={() => setShowNotesModal(false)}
          onSave={() => updateNotes(selectedRequest.id)}
        />
      )}
    </div>
  );
}

// Kanban Column Component
function KanbanColumn({
  title,
  count,
  color,
  requests,
  onRequestClick,
  getPriorityColor,
  getServiceIcon,
  formatTime,
  getSLAStatus,
  getSLARemaining,
  getSLAProgressColor,
}: {
  title: string;
  count: number;
  color: string;
  requests: ServiceRequest[];
  onRequestClick: (r: ServiceRequest) => void;
  getPriorityColor: (p: string) => string;
  getServiceIcon: (t: string) => string;
  formatTime: (d: string) => string;
  getSLAStatus: (r: ServiceRequest) => string;
  getSLARemaining: (r: ServiceRequest) => { remaining: number; elapsed: number; target: number } | null;
  getSLAProgressColor: (s: string) => string;
}) {
  return (
    <div className="bg-gray-50 rounded-xl">
      <div className="px-4 py-3 flex items-center gap-2">
        <div className={`w-2 h-2 ${color} rounded-full`}></div>
        <h3 className="font-semibold text-gray-900">{title}</h3>
        <span className="ml-auto bg-gray-200 text-gray-600 text-xs font-medium px-2 py-0.5 rounded-full">
          {count}
        </span>
      </div>
      <div className="p-3 space-y-3 max-h-[calc(100vh-280px)] overflow-y-auto">
        {requests.length === 0 ? (
          <p className="text-center text-gray-400 text-sm py-8">No requests</p>
        ) : (
          requests.map((request) => {
            const slaStatus = getSLAStatus(request);
            const slaRemaining = getSLARemaining(request);
            const slaColors = SLA_STATUS_COLORS[slaStatus as keyof typeof SLA_STATUS_COLORS] || SLA_STATUS_COLORS.completed;
            return (
              <div
                key={request.id}
                onClick={() => onRequestClick(request)}
                className={`bg-white rounded-lg border p-4 cursor-pointer hover:shadow-md transition-all ${
                  slaStatus === 'breached' ? 'border-red-300' :
                  slaStatus === 'alert' ? 'border-orange-300' :
                  slaStatus === 'warning' ? 'border-yellow-300' :
                  'border-gray-200'
                }`}
              >
                <div className="flex items-start justify-between mb-2">
                  <div className="flex items-center gap-2">
                    <span className="text-lg">{getServiceIcon(request.service_type)}</span>
                    <span className="text-sm font-medium text-gray-900">
                      Room {request.room_number}
                    </span>
                    {request.auto_assigned && (
                      <span className="text-xs px-1.5 py-0.5 bg-purple-100 text-purple-700 rounded-full">
                        Auto
                      </span>
                    )}
                  </div>
                  <span className={`text-xs px-2 py-0.5 rounded-full border ${getPriorityColor(request.priority)}`}>
                    {request.priority}
                  </span>
                </div>
                <p className="text-sm text-gray-600 mb-2 line-clamp-2">
                  {request.description || `${request.service_type.replace('_', ' ')} request`}
                </p>

                {/* SLA Timer */}
                {slaRemaining && (
                  <div className="mb-2">
                    <div className="flex items-center justify-between text-xs mb-1">
                      <span className={`${slaColors.text} font-medium`}>
                        {slaRemaining.remaining >= 0
                          ? `${slaRemaining.remaining}m remaining`
                          : `${Math.abs(slaRemaining.remaining)}m overdue`}
                      </span>
                      <span className="text-gray-400">
                        {slaRemaining.elapsed}/{slaRemaining.target}m
                      </span>
                    </div>
                    <div className="h-1.5 bg-gray-200 rounded-full overflow-hidden">
                      <div
                        className={`h-full ${getSLAProgressColor(slaStatus)} transition-all`}
                        style={{
                          width: `${Math.min(100, (slaRemaining.elapsed / slaRemaining.target) * 100)}%`,
                        }}
                      />
                    </div>
                  </div>
                )}

                <div className="flex items-center justify-between text-xs text-gray-400">
                  <span>{request.guest_name}</span>
                  <span>{formatTime(request.created_at)}</span>
                </div>
                {request.assigned_to_name && (
                  <div className="mt-2 pt-2 border-t border-gray-100">
                    <span className="text-xs text-blue-600">Assigned to {request.assigned_to_name}</span>
                  </div>
                )}
              </div>
            );
          })
        )}
      </div>
    </div>
  );
}

// Request Detail Modal
function RequestDetailModal({
  request,
  onClose,
  onAssign,
  onAddNotes,
  onStatusChange,
  getPriorityColor,
  getStatusColor,
  getServiceIcon,
}: {
  request: ServiceRequest;
  onClose: () => void;
  onAssign: () => void;
  onAddNotes: () => void;
  onStatusChange: (status: string) => void;
  getPriorityColor: (p: string) => string;
  getStatusColor: (s: string) => string;
  getServiceIcon: (t: string) => string;
}) {
  return (
    <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
      <div className="bg-white rounded-xl max-w-lg w-full max-h-[90vh] overflow-y-auto">
        <div className="p-6 border-b border-gray-200">
          <div className="flex items-start justify-between">
            <div>
              <h2 className="text-xl font-bold text-gray-900">
                {getServiceIcon(request.service_type)} {request.service_type.replace('_', ' ').toUpperCase()}
              </h2>
              <p className="text-sm text-gray-500 mt-1">Request #{request.id.slice(0, 8)}</p>
            </div>
            <button onClick={onClose} className="text-gray-400 hover:text-gray-600 text-xl">×</button>
          </div>
        </div>

        <div className="p-6 space-y-4">
          <div className="grid grid-cols-2 gap-4">
            <div>
              <p className="text-xs text-gray-500">Room</p>
              <p className="font-semibold text-gray-900">{request.room_number}</p>
            </div>
            <div>
              <p className="text-xs text-gray-500">Guest</p>
              <p className="font-semibold text-gray-900">{request.guest_name}</p>
            </div>
            <div>
              <p className="text-xs text-gray-500">Priority</p>
              <span className={`inline-block text-xs px-2 py-0.5 rounded-full border ${getPriorityColor(request.priority)}`}>
                {request.priority}
              </span>
            </div>
            <div>
              <p className="text-xs text-gray-500">Status</p>
              <span className={`inline-block text-xs px-2 py-0.5 rounded-full ${getStatusColor(request.status)}`}>
                {request.status.replace('_', ' ')}
              </span>
            </div>
          </div>

          {request.description && (
            <div>
              <p className="text-xs text-gray-500 mb-1">Description</p>
              <p className="text-sm text-gray-700 bg-gray-50 rounded-lg p-3">{request.description}</p>
            </div>
          )}

          {request.assigned_to_name && (
            <div>
              <p className="text-xs text-gray-500 mb-1">Assigned To</p>
              <p className="text-sm text-gray-700">{request.assigned_to_name}</p>
            </div>
          )}

          {request.notes && (
            <div>
              <p className="text-xs text-gray-500 mb-1">Notes</p>
              <p className="text-sm text-gray-700 bg-blue-50 rounded-lg p-3">{request.notes}</p>
            </div>
          )}
        </div>

        <div className="p-6 border-t border-gray-200 bg-gray-50">
          <div className="flex flex-wrap gap-2">
            {request.status === 'pending' && (
              <>
                <button
                  onClick={onAssign}
                  className="px-4 py-2 bg-blue-600 text-white rounded-lg text-sm font-medium hover:bg-blue-700"
                >
                  Assign Staff
                </button>
                <button
                  onClick={() => onStatusChange('in_progress')}
                  className="px-4 py-2 bg-purple-600 text-white rounded-lg text-sm font-medium hover:bg-purple-700"
                >
                  Start Working
                </button>
              </>
            )}
            {request.status === 'in_progress' || request.status === 'assigned' ? (
              <button
                onClick={() => onStatusChange('completed')}
                className="px-4 py-2 bg-green-600 text-white rounded-lg text-sm font-medium hover:bg-green-700"
              >
                Mark Complete
              </button>
            ) : null}
            <button
              onClick={onAddNotes}
              className="px-4 py-2 border border-gray-300 text-gray-700 rounded-lg text-sm font-medium hover:bg-gray-100"
            >
              Add Notes
            </button>
            {request.status !== 'completed' && request.status !== 'cancelled' && (
              <button
                onClick={() => onStatusChange('cancelled')}
                className="px-4 py-2 text-red-600 border border-red-200 rounded-lg text-sm font-medium hover:bg-red-50"
              >
                Cancel
              </button>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}

// Assign Modal
function AssignModal({
  request,
  staff,
  onClose,
  onAssign,
}: {
  request: ServiceRequest;
  staff: StaffMember[];
  onClose: () => void;
  onAssign: (staffId: string) => void;
}) {
  const [selectedStaff, setSelectedStaff] = useState('');

  return (
    <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
      <div className="bg-white rounded-xl max-w-md w-full">
        <div className="p-6 border-b border-gray-200">
          <h3 className="text-lg font-bold text-gray-900">Assign Request</h3>
          <p className="text-sm text-gray-500 mt-1">Room {request.room_number} - {request.service_type}</p>
        </div>
        <div className="p-6">
          <label className="block text-sm font-medium text-gray-700 mb-2">Select Staff Member</label>
          <select
            value={selectedStaff}
            onChange={(e) => setSelectedStaff(e.target.value)}
            className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
          >
            <option value="">Choose staff...</option>
            {staff.map((s) => (
              <option key={s.id} value={s.id}>
                {s.name} ({s.department})
              </option>
            ))}
          </select>
        </div>
        <div className="p-6 border-t border-gray-200 flex gap-3 justify-end">
          <button
            onClick={onClose}
            className="px-4 py-2 border border-gray-300 text-gray-700 rounded-lg text-sm font-medium hover:bg-gray-100"
          >
            Cancel
          </button>
          <button
            onClick={() => onAssign(selectedStaff)}
            disabled={!selectedStaff}
            className="px-4 py-2 bg-blue-600 text-white rounded-lg text-sm font-medium hover:bg-blue-700 disabled:opacity-50"
          >
            Assign
          </button>
        </div>
      </div>
    </div>
  );
}

// Notes Modal
function NotesModal({
  notes,
  onChange,
  onClose,
  onSave,
}: {
  notes: string;
  onChange: (v: string) => void;
  onClose: () => void;
  onSave: () => void;
}) {
  return (
    <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
      <div className="bg-white rounded-xl max-w-md w-full">
        <div className="p-6 border-b border-gray-200">
          <h3 className="text-lg font-bold text-gray-900">Add Notes</h3>
        </div>
        <div className="p-6">
          <textarea
            value={notes}
            onChange={(e) => onChange(e.target.value)}
            placeholder="Enter notes about this request..."
            rows={4}
            className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent resize-none"
          />
        </div>
        <div className="p-6 border-t border-gray-200 flex gap-3 justify-end">
          <button
            onClick={onClose}
            className="px-4 py-2 border border-gray-300 text-gray-700 rounded-lg text-sm font-medium hover:bg-gray-100"
          >
            Cancel
          </button>
          <button
            onClick={onSave}
            className="px-4 py-2 bg-blue-600 text-white rounded-lg text-sm font-medium hover:bg-blue-700"
          >
            Save Notes
          </button>
        </div>
      </div>
    </div>
  );
}
