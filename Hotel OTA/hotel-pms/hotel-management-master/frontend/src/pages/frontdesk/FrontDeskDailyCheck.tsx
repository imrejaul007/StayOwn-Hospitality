import React, { useState, useEffect, useCallback } from 'react';
import { Card, CardHeader, CardTitle, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { LoadingSpinner } from '../../components/LoadingSpinner';
import {
  ClipboardList,
  Clock,
  CheckCircle,
  AlertTriangle,
  RefreshCw,
  Calendar,
  Home,
  ChevronLeft,
  ChevronRight,
  Filter,
  UserPlus,
  Wifi,
  WifiOff
} from 'lucide-react';
import { useAuth } from '../../context/AuthContext';
import {
  dailyRoutineCheckService,
  DailyCheckData
} from '../../services/dailyRoutineCheckService';
import { useRealTime } from '../../services/realTimeService';
import { api } from '../../services/api';
import { toast } from 'react-hot-toast';
import { withErrorBoundary } from '../../components/ErrorBoundary';

const PAGE_LIMIT = 50;

interface StaffMember {
  _id: string;
  name: string;
  role: string;
}

interface DailySummary {
  totalRooms: number;
  pendingChecks: number;
  completedToday: number;
  overdueChecks: number;
  estimatedTimeRemaining: number;
}

function FrontDeskDailyCheck() {
  const { user } = useAuth();
  const [rooms, setRooms] = useState<DailyCheckData[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [page, setPage] = useState(1);
  const [totalPages, setTotalPages] = useState(1);
  const [totalCount, setTotalCount] = useState(0);

  // Filters
  const [filterStatus, setFilterStatus] = useState<string>('all');
  const [floorFilter, setFloorFilter] = useState<string>('');
  const [typeFilter, setTypeFilter] = useState<string>('');

  // Summary
  const [summary, setSummary] = useState<DailySummary | null>(null);

  // Assignment
  const [showAssignModal, setShowAssignModal] = useState(false);
  const [staffList, setStaffList] = useState<StaffMember[]>([]);
  const [selectedRooms, setSelectedRooms] = useState<Set<string>>(new Set());
  const [assignToStaff, setAssignToStaff] = useState('');
  const [assigning, setAssigning] = useState(false);

  const { connect, on, off, isConnected } = useRealTime();

  const fetchRooms = useCallback(async () => {
    try {
      setLoading(true);
      setError(null);
      const response = await dailyRoutineCheckService.getRoomsForDailyCheck({
        filter: filterStatus !== 'all' ? filterStatus as 'pending' | 'completed' | 'overdue' : undefined,
        floor: floorFilter || undefined,
        type: typeFilter || undefined,
        page,
        limit: PAGE_LIMIT
      });
      const data = response.data;
      setRooms(data.rooms || []);
      const pagination = (response as unknown as { data: { pagination?: { pages?: number; total?: number } } }).data.pagination;
      setTotalPages(pagination?.pages ?? 1);
      setTotalCount(pagination?.total ?? data.rooms?.length ?? 0);
    } catch {
      setError('Unable to load daily check rooms.');
      setRooms([]);
    } finally {
      setLoading(false);
    }
  }, [page, filterStatus, floorFilter, typeFilter]);

  const fetchSummary = useCallback(async () => {
    try {
      const res = await dailyRoutineCheckService.getDailyCheckSummary();
      setSummary(res.data || null);
    } catch {
      // Non-critical
    }
  }, []);

  const fetchStaff = useCallback(async () => {
    try {
      const res = await api.get('/maintenance/available-staff');
      setStaffList(res.data?.data || []);
    } catch {
      // Non-critical
    }
  }, []);

  useEffect(() => { fetchRooms(); }, [fetchRooms]);
  useEffect(() => { fetchSummary(); }, [fetchSummary]);

  // Real-time
  useEffect(() => { connect().catch(() => {}); }, [connect]);
  useEffect(() => {
    if (!isConnected) return;
    const refresh = () => { fetchRooms(); fetchSummary(); };
    on('daily-routine-check:completed', refresh);
    on('daily-routine-check:assigned', refresh);
    on('daily-routine-check:status_updated', refresh);
    return () => {
      off('daily-routine-check:completed', refresh);
      off('daily-routine-check:assigned', refresh);
      off('daily-routine-check:status_updated', refresh);
    };
  }, [isConnected, on, off, fetchRooms, fetchSummary]);

  // Reset page on filter change
  useEffect(() => { setPage(1); }, [filterStatus, floorFilter, typeFilter]);

  const toggleRoomSelection = (roomId: string) => {
    setSelectedRooms(prev => {
      const next = new Set(prev);
      if (next.has(roomId)) next.delete(roomId);
      else next.add(roomId);
      return next;
    });
  };

  const handleAssign = async () => {
    if (!assignToStaff || selectedRooms.size === 0) {
      toast.error('Select rooms and a staff member.');
      return;
    }
    try {
      setAssigning(true);
      const assignments = Array.from(selectedRooms).map(roomId => ({
        roomId,
        staffId: assignToStaff
      }));
      await dailyRoutineCheckService.assignDailyChecks(assignments);
      toast.success(`${assignments.length} room(s) assigned successfully!`);
      setShowAssignModal(false);
      setSelectedRooms(new Set());
      setAssignToStaff('');
      fetchRooms();
      fetchSummary();
    } catch {
      toast.error('Failed to assign rooms.');
    } finally {
      setAssigning(false);
    }
  };

  const handleMarkChecked = async (roomId: string) => {
    try {
      await dailyRoutineCheckService.markRoomAsChecked(roomId, 'Checked by front desk');
      toast.success('Room marked as checked!');
      fetchRooms();
      fetchSummary();
    } catch {
      toast.error('Failed to mark room as checked.');
    }
  };

  const getStatusBadge = (status: string) => {
    switch (status) {
      case 'pending': return <Badge className="bg-orange-100 text-orange-800">Pending</Badge>;
      case 'in_progress': return <Badge className="bg-blue-100 text-blue-800">In Progress</Badge>;
      case 'completed': return <Badge className="bg-green-100 text-green-800">Completed</Badge>;
      case 'overdue': return <Badge className="bg-red-100 text-red-800">Overdue</Badge>;
      default: return <Badge>{status}</Badge>;
    }
  };

  const handlePageChange = (newPage: number) => {
    if (newPage < 1 || newPage > totalPages) return;
    setPage(newPage);
  };

  // Extract unique floors/types for filter dropdowns
  const uniqueFloors = Array.from(new Set(rooms.map(r => r.floor).filter(Boolean))).sort();
  const uniqueTypes = Array.from(new Set(rooms.map(r => r.type).filter(Boolean))).sort();

  if (loading && rooms.length === 0) {
    return (
      <div className="flex items-center justify-center h-64">
        <LoadingSpinner />
      </div>
    );
  }

  if (error && rooms.length === 0) {
    return (
      <div className="p-6 max-w-7xl mx-auto text-center py-12">
        <AlertTriangle className="mx-auto h-8 w-8 text-red-500 mb-3" />
        <h3 className="text-lg font-semibold text-gray-900 mb-2">Unable to Load Data</h3>
        <p className="text-gray-600 mb-4">{error}</p>
        <Button onClick={fetchRooms}><RefreshCw className="h-4 w-4 mr-2" />Try Again</Button>
      </div>
    );
  }

  return (
    <div className="p-6 max-w-7xl mx-auto">
      {/* Header */}
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-3xl font-bold text-gray-900 mb-1">Daily Room Checks</h1>
          <p className="text-gray-600">Monitor daily routine inspections and assign rooms to staff</p>
        </div>
        <div className="flex items-center space-x-3">
          <div className={`flex items-center px-2 py-1 rounded-full text-xs font-medium ${
            isConnected ? 'bg-green-100 text-green-800' : 'bg-red-100 text-red-800'
          }`}>
            {isConnected ? <><Wifi className="w-3 h-3 mr-1" /> Live</> : <><WifiOff className="w-3 h-3 mr-1" /> Offline</>}
          </div>
          {selectedRooms.size > 0 && (
            <Button
              size="sm"
              onClick={() => { fetchStaff(); setShowAssignModal(true); }}
            >
              <UserPlus className="w-4 h-4 mr-2" />
              Assign {selectedRooms.size} Room(s)
            </Button>
          )}
          <Button onClick={() => { fetchRooms(); fetchSummary(); }} variant="secondary" size="sm">
            <RefreshCw className="w-4 h-4 mr-2" />
            Refresh
          </Button>
        </div>
      </div>

      {/* Summary Cards */}
      {summary && (
        <div className="grid grid-cols-2 md:grid-cols-5 gap-4 mb-6">
          <Card className="p-4">
            <div className="flex items-center">
              <div className="p-2 bg-blue-100 rounded-lg"><Home className="w-5 h-5 text-blue-600" /></div>
              <div className="ml-3">
                <p className="text-sm font-medium text-gray-600">Total Rooms</p>
                <p className="text-lg font-semibold text-gray-900">{summary.totalRooms}</p>
              </div>
            </div>
          </Card>
          <Card className="p-4">
            <div className="flex items-center">
              <div className="p-2 bg-orange-100 rounded-lg"><Clock className="w-5 h-5 text-orange-600" /></div>
              <div className="ml-3">
                <p className="text-sm font-medium text-gray-600">Pending</p>
                <p className="text-lg font-semibold text-gray-900">{summary.pendingChecks}</p>
              </div>
            </div>
          </Card>
          <Card className="p-4">
            <div className="flex items-center">
              <div className="p-2 bg-green-100 rounded-lg"><CheckCircle className="w-5 h-5 text-green-600" /></div>
              <div className="ml-3">
                <p className="text-sm font-medium text-gray-600">Completed Today</p>
                <p className="text-lg font-semibold text-gray-900">{summary.completedToday}</p>
              </div>
            </div>
          </Card>
          <Card className="p-4">
            <div className="flex items-center">
              <div className="p-2 bg-red-100 rounded-lg"><AlertTriangle className="w-5 h-5 text-red-600" /></div>
              <div className="ml-3">
                <p className="text-sm font-medium text-gray-600">Overdue</p>
                <p className="text-lg font-semibold text-gray-900">{summary.overdueChecks}</p>
              </div>
            </div>
          </Card>
          <Card className="p-4">
            <div className="flex items-center">
              <div className="p-2 bg-purple-100 rounded-lg"><Calendar className="w-5 h-5 text-purple-600" /></div>
              <div className="ml-3">
                <p className="text-sm font-medium text-gray-600">Est. Time Left</p>
                <p className="text-lg font-semibold text-gray-900">{summary.estimatedTimeRemaining} min</p>
              </div>
            </div>
          </Card>
        </div>
      )}

      {/* Filters */}
      <Card className="mb-6">
        <CardContent className="pt-4">
          <div className="flex flex-wrap items-center gap-3">
            <div className="flex items-center gap-1">
              <Filter className="w-4 h-4 text-gray-500" />
              <span className="text-sm font-medium text-gray-700">Filters:</span>
            </div>
            <select value={filterStatus} onChange={(e) => setFilterStatus(e.target.value)} className="h-9 px-3 rounded-md border border-gray-200 text-sm">
              <option value="all">All Statuses</option>
              <option value="pending">Pending</option>
              <option value="completed">Completed</option>
              <option value="overdue">Overdue</option>
            </select>
            {uniqueFloors.length > 0 && (
              <select value={floorFilter} onChange={(e) => setFloorFilter(e.target.value)} className="h-9 px-3 rounded-md border border-gray-200 text-sm">
                <option value="">All Floors</option>
                {uniqueFloors.map(f => <option key={f} value={f}>Floor {f}</option>)}
              </select>
            )}
            {uniqueTypes.length > 0 && (
              <select value={typeFilter} onChange={(e) => setTypeFilter(e.target.value)} className="h-9 px-3 rounded-md border border-gray-200 text-sm">
                <option value="">All Types</option>
                {uniqueTypes.map(t => <option key={t} value={t}>{t}</option>)}
              </select>
            )}
            {selectedRooms.size > 0 && (
              <Button variant="outline" size="sm" onClick={() => setSelectedRooms(new Set())}>
                Clear Selection ({selectedRooms.size})
              </Button>
            )}
          </div>
        </CardContent>
      </Card>

      {/* Room Grid */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center">
            <ClipboardList className="h-5 w-5 mr-2 text-blue-600" />
            Rooms ({totalCount})
            {loading && <RefreshCw className="w-4 h-4 ml-2 animate-spin text-gray-400" />}
          </CardTitle>
        </CardHeader>
        <CardContent>
          {rooms.length === 0 ? (
            <p className="text-gray-500 text-center py-8">No rooms found for the current filters.</p>
          ) : (
            <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-6 gap-3">
              {rooms.map(room => {
                const isSelected = selectedRooms.has(room._id);
                return (
                  <div
                    key={room._id}
                    className={`p-3 rounded-lg border-2 cursor-pointer transition-colors ${
                      isSelected
                        ? 'border-blue-500 bg-blue-50'
                        : room.checkStatus === 'completed'
                        ? 'border-green-200 bg-green-50'
                        : room.checkStatus === 'overdue'
                        ? 'border-red-200 bg-red-50'
                        : 'border-gray-200 bg-white hover:border-gray-300'
                    }`}
                    onClick={() => toggleRoomSelection(room._id)}
                  >
                    <div className="flex items-center justify-between mb-2">
                      <span className="font-bold text-sm">{room.roomNumber}</span>
                      {getStatusBadge(room.checkStatus)}
                    </div>
                    <div className="text-xs text-gray-500 mb-1">{room.type} | Floor {room.floor}</div>
                    {room.lastChecked && (
                      <div className="text-xs text-gray-400">
                        Last: {new Date(room.lastChecked).toLocaleTimeString()}
                      </div>
                    )}
                    {room.checkStatus === 'pending' && (
                      <Button
                        size="sm"
                        variant="outline"
                        className="w-full mt-2 text-xs"
                        onClick={(e) => {
                          e.stopPropagation();
                          handleMarkChecked(room._id);
                        }}
                      >
                        <CheckCircle className="w-3 h-3 mr-1" />
                        Quick Check
                      </Button>
                    )}
                  </div>
                );
              })}
            </div>
          )}

          {/* Pagination */}
          {totalPages > 1 && (
            <div className="flex items-center justify-center gap-4 mt-6 pt-4 border-t">
              <Button variant="outline" size="sm" onClick={() => handlePageChange(page - 1)} disabled={page <= 1 || loading}>
                <ChevronLeft className="w-4 h-4 mr-1" />Previous
              </Button>
              <span className="text-sm text-gray-600">Page {page} of {totalPages}</span>
              <Button variant="outline" size="sm" onClick={() => handlePageChange(page + 1)} disabled={page >= totalPages || loading}>
                Next<ChevronRight className="w-4 h-4 ml-1" />
              </Button>
            </div>
          )}
        </CardContent>
      </Card>

      {/* Assignment Modal */}
      {showAssignModal && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center p-4 z-50">
          <div className="bg-white rounded-lg max-w-md w-full p-6">
            <h2 className="text-xl font-semibold mb-4">Assign Daily Checks</h2>
            <p className="text-sm text-gray-600 mb-3">
              Assigning <strong>{selectedRooms.size}</strong> room(s) for today's daily check.
            </p>
            <div className="mb-4">
              <label className="block text-sm font-medium text-gray-700 mb-1">Assign To</label>
              <select
                value={assignToStaff}
                onChange={(e) => setAssignToStaff(e.target.value)}
                className="w-full h-9 px-3 rounded-md border border-gray-200 text-sm"
              >
                <option value="">Select staff member...</option>
                {staffList.map(s => (
                  <option key={s._id} value={s._id}>{s.name} ({s.role})</option>
                ))}
              </select>
            </div>
            <div className="flex justify-end gap-3">
              <Button variant="outline" onClick={() => setShowAssignModal(false)} disabled={assigning}>Cancel</Button>
              <Button onClick={handleAssign} disabled={assigning || !assignToStaff}>
                {assigning ? 'Assigning...' : 'Assign'}
              </Button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

export default withErrorBoundary(FrontDeskDailyCheck);
