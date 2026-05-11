'use client';

import { useState, useEffect } from 'react';

interface Room {
  id: string;
  number: string;
  floor: number;
  type: string;
  status: 'occupied' | 'vacant' | 'cleaning' | 'maintenance';
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

const ROOM_TYPES = ['all', 'Standard', 'Deluxe', 'Suite', 'Executive'];
const FLOORS = ['all', '1', '2', '3', '4'];
const STATUSES = [
  { value: 'all', label: 'All', color: 'bg-gray-100 text-gray-700' },
  { value: 'occupied', label: 'Occupied', color: 'bg-blue-100 text-blue-700' },
  { value: 'vacant', label: 'Vacant', color: 'bg-green-100 text-green-700' },
  { value: 'cleaning', label: 'Cleaning', color: 'bg-yellow-100 text-yellow-700' },
  { value: 'maintenance', label: 'Maintenance', color: 'bg-red-100 text-red-700' },
];

export default function RoomsPage() {
  const [rooms, setRooms] = useState<Room[]>([]);
  const [stats, setStats] = useState<RoomStats | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [filterType, setFilterType] = useState('all');
  const [filterFloor, setFilterFloor] = useState('all');
  const [filterStatus, setFilterStatus] = useState('all');
  const [searchRoom, setSearchRoom] = useState('');
  const [selectedRoom, setSelectedRoom] = useState<Room | null>(null);
  const [showStatusModal, setShowStatusModal] = useState(false);

  useEffect(() => {
    fetchRooms();
  }, []);

  const fetchRooms = async () => {
    try {
      const res = await fetch('/api/staff/rooms', { credentials: 'include' });
      if (!res.ok) throw new Error('Failed to fetch rooms');
      const data = await res.json();
      setRooms(data.rooms || []);
      setStats(data.stats || null);
    } catch (err: any) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };

  const updateRoomStatus = async (roomId: string, status: string, notes?: string) => {
    try {
      const res = await fetch(`/api/staff/rooms/${roomId}/status`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ status, notes }),
        credentials: 'include',
      });
      if (res.ok) {
        setRooms((prev) =>
          prev.map((r) => (r.id === roomId ? { ...r, status: status as Room['status'], notes } : r))
        );
        setShowStatusModal(false);
        setSelectedRoom(null);
      }
    } catch (err) {
      console.error('Failed to update room status');
    }
  };

  const filteredRooms = rooms.filter((room) => {
    if (filterType !== 'all' && room.type !== filterType) return false;
    if (filterFloor !== 'all' && room.floor.toString() !== filterFloor) return false;
    if (filterStatus !== 'all' && room.status !== filterStatus) return false;
    if (searchRoom && !room.number.includes(searchRoom)) return false;
    return true;
  });

  const getStatusColor = (status: Room['status']) => {
    switch (status) {
      case 'occupied':
        return 'bg-blue-500';
      case 'vacant':
        return 'bg-green-500';
      case 'cleaning':
        return 'bg-yellow-500';
      case 'maintenance':
        return 'bg-red-500';
      default:
        return 'bg-gray-500';
    }
  };

  const getStatusBgColor = (status: Room['status']) => {
    switch (status) {
      case 'occupied':
        return 'bg-blue-50 border-blue-200';
      case 'vacant':
        return 'bg-green-50 border-green-200';
      case 'cleaning':
        return 'bg-yellow-50 border-yellow-200';
      case 'maintenance':
        return 'bg-red-50 border-red-200';
      default:
        return 'bg-gray-50 border-gray-200';
    }
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
          <h1 className="text-2xl font-bold text-gray-900">Room Management</h1>
          <p className="text-gray-500 mt-1">
            {stats && `${stats.occupancy_rate}% occupancy rate`}
          </p>
        </div>
      </div>

      {/* Stats Cards */}
      {stats && (
        <div className="grid grid-cols-2 md:grid-cols-5 gap-4 mb-6">
          <StatCard label="Total" value={stats.total} color="bg-gray-100 text-gray-700" />
          <StatCard label="Occupied" value={stats.occupied} color="bg-blue-100 text-blue-700" />
          <StatCard label="Vacant" value={stats.vacant} color="bg-green-100 text-green-700" />
          <StatCard label="Cleaning" value={stats.cleaning} color="bg-yellow-100 text-yellow-700" />
          <StatCard label="Maintenance" value={stats.maintenance} color="bg-red-100 text-red-700" />
        </div>
      )}

      {/* Filters */}
      <div className="bg-white rounded-xl border border-gray-200 p-4 mb-6">
        <div className="flex flex-wrap gap-4">
          <div className="flex items-center gap-2">
            <input
              type="text"
              placeholder="Search room..."
              value={searchRoom}
              onChange={(e) => setSearchRoom(e.target.value)}
              className="px-3 py-2 border border-gray-200 rounded-lg text-sm focus:ring-2 focus:ring-blue-500 focus:border-blue-500 w-32"
            />
          </div>

          <select
            value={filterType}
            onChange={(e) => setFilterType(e.target.value)}
            className="px-3 py-2 border border-gray-200 rounded-lg text-sm focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
          >
            {ROOM_TYPES.map((type) => (
              <option key={type} value={type}>
                {type === 'all' ? 'All Types' : type}
              </option>
            ))}
          </select>

          <select
            value={filterFloor}
            onChange={(e) => setFilterFloor(e.target.value)}
            className="px-3 py-2 border border-gray-200 rounded-lg text-sm focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
          >
            <option value="all">All Floors</option>
            {FLOORS.filter((f) => f !== 'all').map((floor) => (
              <option key={floor} value={floor}>
                Floor {floor}
              </option>
            ))}
          </select>

          <div className="flex flex-wrap gap-2">
            {STATUSES.map((status) => (
              <button
                key={status.value}
                onClick={() => setFilterStatus(status.value)}
                className={`px-3 py-1.5 rounded-lg text-sm font-medium transition-colors ${
                  filterStatus === status.value
                    ? status.color
                    : 'bg-gray-100 text-gray-600 hover:bg-gray-200'
                }`}
              >
                {status.label}
              </button>
            ))}
          </div>
        </div>
      </div>

      {/* Room Grid */}
      <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5 gap-4">
        {filteredRooms.length === 0 ? (
          <div className="col-span-full text-center py-12 text-gray-400">
            No rooms found
          </div>
        ) : (
          filteredRooms.map((room) => (
            <div
              key={room.id}
              onClick={() => {
                setSelectedRoom(room);
                setShowStatusModal(true);
              }}
              className={`relative rounded-xl border-2 p-4 cursor-pointer hover:shadow-lg transition-all ${getStatusBgColor(
                room.status
              )}`}
            >
              {/* Status Indicator */}
              <div className={`absolute top-3 right-3 w-3 h-3 rounded-full ${getStatusColor(room.status)}`} />

              {/* Room Number */}
              <div className="text-center mb-3">
                <p className="text-2xl font-bold text-gray-900">{room.number}</p>
                <p className="text-xs text-gray-500">{room.type}</p>
              </div>

              {/* Guest Name (if occupied) */}
              {room.guest_name && (
                <p className="text-sm font-medium text-gray-700 text-center truncate mb-2">
                  {room.guest_name}
                </p>
              )}

              {/* Pending Requests Badge */}
              {room.pending_requests > 0 && (
                <div className="absolute bottom-3 left-3 bg-red-500 text-white text-xs font-bold px-2 py-0.5 rounded-full">
                  {room.pending_requests} pending
                </div>
              )}

              {/* Status Label */}
              <div className="text-center mt-2">
                <span className={`inline-block px-2 py-1 rounded text-xs font-medium ${
                  room.status === 'occupied' ? 'bg-blue-200 text-blue-800' :
                  room.status === 'vacant' ? 'bg-green-200 text-green-800' :
                  room.status === 'cleaning' ? 'bg-yellow-200 text-yellow-800' :
                  'bg-red-200 text-red-800'
                }`}>
                  {room.status.charAt(0).toUpperCase() + room.status.slice(1)}
                </span>
              </div>

              {/* Quick Actions */}
              <div className="flex gap-1 mt-3">
                {room.status === 'occupied' && (
                  <button
                    onClick={(e) => {
                      e.stopPropagation();
                      window.location.href = `/staff/messages?room=${room.number}`;
                    }}
                    className="flex-1 px-2 py-1 bg-white/80 text-xs font-medium rounded hover:bg-white"
                  >
                    Message
                  </button>
                )}
                {room.status === 'vacant' && (
                  <button
                    onClick={(e) => {
                      e.stopPropagation();
                      updateRoomStatus(room.id, 'cleaning');
                    }}
                    className="flex-1 px-2 py-1 bg-white/80 text-xs font-medium rounded hover:bg-white"
                  >
                    Clean
                  </button>
                )}
                {room.status === 'cleaning' && (
                  <button
                    onClick={(e) => {
                      e.stopPropagation();
                      updateRoomStatus(room.id, 'vacant');
                    }}
                    className="flex-1 px-2 py-1 bg-white/80 text-xs font-medium rounded hover:bg-white"
                  >
                    Done
                  </button>
                )}
              </div>
            </div>
          ))
        )}
      </div>

      {/* Room Detail Modal */}
      {showStatusModal && selectedRoom && (
        <RoomDetailModal
          room={selectedRoom}
          onUpdateStatus={updateRoomStatus}
          onClose={() => {
            setShowStatusModal(false);
            setSelectedRoom(null);
          }}
        />
      )}
    </div>
  );
}

// Stat Card Component
function StatCard({ label, value, color }: { label: string; value: number; color: string }) {
  return (
    <div className={`${color} rounded-xl p-4 text-center`}>
      <p className="text-3xl font-bold">{value}</p>
      <p className="text-sm font-medium opacity-80">{label}</p>
    </div>
  );
}

// Room Detail Modal
function RoomDetailModal({
  room,
  onUpdateStatus,
  onClose,
}: {
  room: Room;
  onUpdateStatus: (roomId: string, status: string, notes?: string) => void;
  onClose: () => void;
}) {
  const [newStatus, setNewStatus] = useState(room.status);
  const [notes, setNotes] = useState(room.notes || '');

  return (
    <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
      <div className="bg-white rounded-xl shadow-xl max-w-md w-full">
        <div className="px-6 py-4 border-b border-gray-200">
          <div className="flex items-center justify-between">
            <div>
              <h2 className="text-lg font-semibold text-gray-900">Room {room.number}</h2>
              <p className="text-sm text-gray-500">{room.type} - Floor {room.floor}</p>
            </div>
            <button
              onClick={onClose}
              className="p-2 text-gray-400 hover:text-gray-600 rounded-lg hover:bg-gray-100"
            >
              ✕
            </button>
          </div>
        </div>

        <div className="p-6 space-y-4">
          {/* Guest Info */}
          {room.guest_name && (
            <div className="bg-blue-50 rounded-lg p-4">
              <p className="text-sm font-medium text-gray-700">Current Guest</p>
              <p className="text-lg font-semibold text-gray-900">{room.guest_name}</p>
              {room.check_in && room.check_out && (
                <p className="text-sm text-gray-500 mt-1">
                  {new Date(room.check_in).toLocaleDateString()} - {new Date(room.check_out).toLocaleDateString()}
                </p>
              )}
            </div>
          )}

          {/* Pending Requests */}
          {room.pending_requests > 0 && (
            <div className="bg-red-50 rounded-lg p-4">
              <p className="text-sm font-medium text-gray-700">Pending Requests</p>
              <p className="text-2xl font-bold text-red-600">{room.pending_requests}</p>
              <button
                onClick={() => window.location.href = `/staff/requests?room=${room.number}`}
                className="mt-2 text-sm text-blue-600 hover:underline"
              >
                View Requests →
              </button>
            </div>
          )}

          {/* Status Selection */}
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">
              Update Status
            </label>
            <div className="grid grid-cols-2 gap-2">
              {(['occupied', 'vacant', 'cleaning', 'maintenance'] as const).map((status) => (
                <button
                  key={status}
                  onClick={() => setNewStatus(status)}
                  className={`px-4 py-2 rounded-lg text-sm font-medium border-2 transition-colors ${
                    newStatus === status
                      ? status === 'occupied'
                        ? 'bg-blue-500 text-white border-blue-500'
                        : status === 'vacant'
                        ? 'bg-green-500 text-white border-green-500'
                        : status === 'cleaning'
                        ? 'bg-yellow-500 text-white border-yellow-500'
                        : 'bg-red-500 text-white border-red-500'
                      : 'border-gray-200 text-gray-700 hover:border-gray-300'
                  }`}
                >
                  {status.charAt(0).toUpperCase() + status.slice(1)}
                </button>
              ))}
            </div>
          </div>

          {/* Notes */}
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">
              Notes (optional)
            </label>
            <textarea
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
              placeholder="Add notes about this room..."
              rows={3}
              className="w-full px-3 py-2 border border-gray-200 rounded-lg text-sm focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
            />
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
            onClick={() => onUpdateStatus(room.id, newStatus, notes)}
            className="flex-1 px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700"
          >
            Update
          </button>
        </div>
      </div>
    </div>
  );
}
