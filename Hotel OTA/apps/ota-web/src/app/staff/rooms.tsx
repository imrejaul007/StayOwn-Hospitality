'use client';

import { useState, useEffect } from 'react';

type RoomStatus = 'occupied' | 'vacant' | 'cleaning' | 'maintenance';

interface Room {
  id: string;
  number: string;
  floor: number;
  type: string;
  status: RoomStatus;
  guest_name?: string;
  check_in?: string;
  check_out?: string;
  pending_requests: number;
  last_cleaned?: string;
  notes?: string;
}

interface RoomStats {
  total: number;
  occupied: number;
  vacant: number;
  cleaning: number;
  maintenance: number;
  occupancy_rate: number;
}

export default function RoomsPage() {
  const [rooms, setRooms] = useState<Room[]>([]);
  const [stats, setStats] = useState<RoomStats | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [viewMode, setViewMode] = useState<'grid' | 'list'>('grid');
  const [filterStatus, setFilterStatus] = useState<RoomStatus | 'all'>('all');
  const [selectedRoom, setSelectedRoom] = useState<Room | null>(null);

  useEffect(() => {
    fetchRooms();
  }, []);

  const fetchRooms = async () => {
    try {
      const res = await fetch('/api/staff/rooms', { credentials: 'include' });
      if (!res.ok) throw new Error('Failed to fetch rooms');
      const data = await res.json();
      setRooms(data.rooms || []);
      setStats(data.stats);
    } catch (err: any) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };

  const updateRoomStatus = async (roomId: string, status: RoomStatus, notes?: string) => {
    try {
      const res = await fetch(`/api/staff/rooms/${roomId}/status`, {
        method: 'PUT',
        credentials: 'include',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ status, notes }),
      });
      if (!res.ok) throw new Error('Failed to update room status');
      await fetchRooms();
      setSelectedRoom(null);
    } catch (err: any) {
      setError(err.message);
    }
  };

  const filteredRooms = rooms.filter((r) => {
    if (filterStatus === 'all') return true;
    return r.status === filterStatus;
  });

  const getStatusColor = (status: RoomStatus) => {
    switch (status) {
      case 'occupied':
        return 'bg-blue-500';
      case 'vacant':
        return 'bg-green-500';
      case 'cleaning':
        return 'bg-yellow-500';
      case 'maintenance':
        return 'bg-red-500';
    }
  };

  const getStatusTextColor = (status: RoomStatus) => {
    switch (status) {
      case 'occupied':
        return 'text-blue-700 bg-blue-50';
      case 'vacant':
        return 'text-green-700 bg-green-50';
      case 'cleaning':
        return 'text-yellow-700 bg-yellow-50';
      case 'maintenance':
        return 'text-red-700 bg-red-50';
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
            <h1 className="text-2xl font-bold text-gray-900">Room Management</h1>
            <p className="text-gray-500 text-sm mt-1">
              {stats?.occupied || 0} occupied, {stats?.vacant || 0} vacant, {stats?.occupancy_rate || 0}% occupancy
            </p>
          </div>

          <div className="flex flex-wrap gap-3">
            {/* Filter buttons */}
            <div className="flex rounded-lg border border-gray-200 overflow-hidden">
              {(['all', 'occupied', 'vacant', 'cleaning', 'maintenance'] as const).map((status) => (
                <button
                  key={status}
                  onClick={() => setFilterStatus(status)}
                  className={`px-3 py-2 text-sm font-medium transition-colors ${
                    filterStatus === status
                      ? 'bg-blue-600 text-white'
                      : 'bg-white text-gray-600 hover:bg-gray-50'
                  }`}
                >
                  {status === 'all' ? 'All' : status.charAt(0).toUpperCase() + status.slice(1)}
                </button>
              ))}
            </div>

            {/* View toggle */}
            <div className="flex rounded-lg border border-gray-200 overflow-hidden">
              <button
                onClick={() => setViewMode('grid')}
                className={`p-2 ${viewMode === 'grid' ? 'bg-gray-100 text-gray-900' : 'bg-white text-gray-400'}`}
              >
                <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 6a2 2 0 012-2h2a2 2 0 012 2v2a2 2 0 01-2 2H6a2 2 0 01-2-2V6zM14 6a2 2 0 012-2h2a2 2 0 012 2v2a2 2 0 01-2 2h-2a2 2 0 01-2-2V6zM4 16a2 2 0 012-2h2a2 2 0 012 2v2a2 2 0 01-2 2H6a2 2 0 01-2-2v-2zM14 16a2 2 0 012-2h2a2 2 0 012 2v2a2 2 0 01-2 2h-2a2 2 0 01-2-2v-2z" />
                </svg>
              </button>
              <button
                onClick={() => setViewMode('list')}
                className={`p-2 ${viewMode === 'list' ? 'bg-gray-100 text-gray-900' : 'bg-white text-gray-400'}`}
              >
                <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 6h16M4 10h16M4 14h16M4 18h16" />
                </svg>
              </button>
            </div>
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

      {/* Content */}
      <div className="flex-1 p-6 overflow-auto">
        {viewMode === 'grid' ? (
          <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5 gap-4">
            {filteredRooms.map((room) => (
              <div
                key={room.id}
                onClick={() => setSelectedRoom(room)}
                className={`bg-white rounded-xl border-2 p-4 cursor-pointer hover:shadow-lg transition-all ${
                  room.pending_requests > 0
                    ? 'border-orange-300 hover:border-orange-400'
                    : 'border-gray-100 hover:border-blue-300'
                }`}
              >
                <div className="flex items-start justify-between mb-3">
                  <div>
                    <p className="text-xl font-bold text-gray-900">{room.number}</p>
                    <p className="text-xs text-gray-400">Floor {room.floor}</p>
                  </div>
                  <div className={`w-3 h-3 ${getStatusColor(room.status)} rounded-full`}></div>
                </div>

                <span className={`inline-block text-xs px-2 py-1 rounded-full font-medium ${getStatusTextColor(room.status)}`}>
                  {room.status.charAt(0).toUpperCase() + room.status.slice(1)}
                </span>

                <p className="text-sm text-gray-500 mt-2 truncate">{room.type}</p>

                {room.guest_name && (
                  <p className="text-xs text-gray-600 mt-2 truncate">
                    <span className="font-medium">{room.guest_name}</span>
                  </p>
                )}

                {room.pending_requests > 0 && (
                  <div className="mt-3 pt-3 border-t border-gray-100">
                    <span className="inline-flex items-center gap-1 text-xs text-orange-600 font-medium">
                      <span className="w-2 h-2 bg-orange-500 rounded-full animate-pulse"></span>
                      {room.pending_requests} pending request{room.pending_requests > 1 ? 's' : ''}
                    </span>
                  </div>
                )}
              </div>
            ))}
          </div>
        ) : (
          <div className="bg-white rounded-xl border border-gray-200 overflow-hidden">
            <table className="w-full">
              <thead className="bg-gray-50">
                <tr>
                  <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">Room</th>
                  <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">Type</th>
                  <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">Status</th>
                  <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">Guest</th>
                  <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">Check-out</th>
                  <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">Requests</th>
                  <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-100">
                {filteredRooms.map((room) => (
                  <tr key={room.id} className="hover:bg-gray-50">
                    <td className="px-4 py-3">
                      <span className="font-semibold text-gray-900">{room.number}</span>
                      <span className="text-xs text-gray-400 block">Floor {room.floor}</span>
                    </td>
                    <td className="px-4 py-3 text-sm text-gray-600">{room.type}</td>
                    <td className="px-4 py-3">
                      <span className={`text-xs px-2 py-1 rounded-full font-medium ${getStatusTextColor(room.status)}`}>
                        {room.status.charAt(0).toUpperCase() + room.status.slice(1)}
                      </span>
                    </td>
                    <td className="px-4 py-3 text-sm text-gray-600">{room.guest_name || '-'}</td>
                    <td className="px-4 py-3 text-sm text-gray-600">
                      {room.check_out ? new Date(room.check_out).toLocaleDateString() : '-'}
                    </td>
                    <td className="px-4 py-3">
                      {room.pending_requests > 0 ? (
                        <span className="bg-orange-100 text-orange-700 text-xs font-medium px-2 py-1 rounded-full">
                          {room.pending_requests}
                        </span>
                      ) : (
                        <span className="text-gray-400 text-sm">None</span>
                      )}
                    </td>
                    <td className="px-4 py-3">
                      <button
                        onClick={() => setSelectedRoom(room)}
                        className="text-blue-600 hover:text-blue-800 text-sm font-medium"
                      >
                        Manage
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {/* Room Detail Modal */}
      {selectedRoom && (
        <RoomDetailModal
          room={selectedRoom}
          onClose={() => setSelectedRoom(null)}
          onStatusChange={(status, notes) => updateRoomStatus(selectedRoom.id, status, notes)}
          getStatusColor={getStatusColor}
          getStatusTextColor={getStatusTextColor}
        />
      )}
    </div>
  );
}

// Room Detail Modal
function RoomDetailModal({
  room,
  onClose,
  onStatusChange,
  getStatusColor,
  getStatusTextColor,
}: {
  room: Room;
  onClose: () => void;
  onStatusChange: (status: RoomStatus, notes?: string) => void;
  getStatusColor: (s: RoomStatus) => string;
  getStatusTextColor: (s: RoomStatus) => string;
}) {
  const [notes, setNotes] = useState(room.notes || '');

  const formatDate = (dateStr?: string) => {
    if (!dateStr) return 'N/A';
    return new Date(dateStr).toLocaleString();
  };

  return (
    <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
      <div className="bg-white rounded-xl max-w-lg w-full max-h-[90vh] overflow-y-auto">
        <div className="p-6 border-b border-gray-200">
          <div className="flex items-start justify-between">
            <div>
              <h2 className="text-2xl font-bold text-gray-900">Room {room.number}</h2>
              <p className="text-sm text-gray-500">Floor {room.floor} - {room.type}</p>
            </div>
            <div className={`w-4 h-4 ${getStatusColor(room.status)} rounded-full mt-2`}></div>
          </div>
        </div>

        <div className="p-6 space-y-6">
          {/* Status */}
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">Current Status</label>
            <span className={`inline-block text-sm px-3 py-1.5 rounded-lg font-medium ${getStatusTextColor(room.status)}`}>
              {room.status.charAt(0).toUpperCase() + room.status.slice(1)}
            </span>
          </div>

          {/* Guest Info */}
          {room.guest_name && (
            <div className="bg-blue-50 rounded-lg p-4">
              <h4 className="text-sm font-medium text-blue-900 mb-2">Current Guest</h4>
              <p className="text-blue-800 font-medium">{room.guest_name}</p>
              <div className="mt-2 grid grid-cols-2 gap-2 text-xs text-blue-700">
                <div>
                  <span className="opacity-70">Check-in:</span>
                  <span className="ml-1">{formatDate(room.check_in)}</span>
                </div>
                <div>
                  <span className="opacity-70">Check-out:</span>
                  <span className="ml-1">{formatDate(room.check_out)}</span>
                </div>
              </div>
            </div>
          )}

          {/* Pending Requests */}
          {room.pending_requests > 0 && (
            <div className="bg-orange-50 rounded-lg p-4">
              <div className="flex items-center gap-2 text-orange-900">
                <span className="w-2 h-2 bg-orange-500 rounded-full animate-pulse"></span>
                <span className="font-medium">{room.pending_requests} Pending Request{room.pending_requests > 1 ? 's' : ''}</span>
              </div>
              <a href="/staff/requests" className="text-sm text-orange-700 hover:underline mt-1 inline-block">
                View in Requests
              </a>
            </div>
          )}

          {/* Quick Actions */}
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-3">Quick Actions</label>
            <div className="grid grid-cols-2 gap-2">
              {room.status !== 'vacant' && (
                <button
                  onClick={() => onStatusChange('vacant')}
                  className="px-4 py-2 bg-green-600 text-white rounded-lg text-sm font-medium hover:bg-green-700"
                >
                  Mark Vacant
                </button>
              )}
              {room.status !== 'cleaning' && (
                <button
                  onClick={() => onStatusChange('cleaning')}
                  className="px-4 py-2 bg-yellow-600 text-white rounded-lg text-sm font-medium hover:bg-yellow-700"
                >
                  Mark Cleaning
                </button>
              )}
              {room.status !== 'maintenance' && (
                <button
                  onClick={() => onStatusChange('maintenance')}
                  className="px-4 py-2 bg-red-600 text-white rounded-lg text-sm font-medium hover:bg-red-700"
                >
                  Mark Maintenance
                </button>
              )}
              {room.status !== 'occupied' && (
                <button
                  onClick={() => onStatusChange('occupied')}
                  className="px-4 py-2 bg-blue-600 text-white rounded-lg text-sm font-medium hover:bg-blue-700"
                >
                  Mark Occupied
                </button>
              )}
            </div>
          </div>

          {/* Notes */}
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">Room Notes</label>
            <textarea
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
              placeholder="Add notes about this room..."
              rows={3}
              className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent resize-none"
            />
            <button
              onClick={() => onStatusChange(room.status, notes)}
              className="mt-2 px-4 py-2 bg-gray-100 text-gray-700 rounded-lg text-sm font-medium hover:bg-gray-200"
            >
              Save Notes
            </button>
          </div>

          {/* Last Cleaned */}
          {room.last_cleaned && (
            <p className="text-xs text-gray-400">
              Last cleaned: {formatDate(room.last_cleaned)}
            </p>
          )}
        </div>

        <div className="p-6 border-t border-gray-200 bg-gray-50">
          <button
            onClick={onClose}
            className="w-full px-4 py-2 border border-gray-300 text-gray-700 rounded-lg font-medium hover:bg-gray-100"
          >
            Close
          </button>
        </div>
      </div>
    </div>
  );
}
