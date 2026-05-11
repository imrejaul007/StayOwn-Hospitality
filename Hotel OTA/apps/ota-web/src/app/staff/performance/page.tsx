'use client';

import { useState, useEffect } from 'react';

interface StaffPerformance {
  id: string;
  name: string;
  department: string;
  requests_completed: number;
  avg_response_time: number;
  sla_compliance: number;
  rating: number;
  requests_today: number;
}

interface DailyStats {
  date: string;
  requests: number;
  completed: number;
  avg_time: number;
  sla_compliance: number;
}

interface TeamStats {
  total_requests: number;
  completed_today: number;
  avg_response_time: number;
  overall_sla_compliance: number;
  top_performer: StaffPerformance | null;
}

export default function PerformancePage() {
  const [teamStats, setTeamStats] = useState<TeamStats | null>(null);
  const [staffPerformance, setStaffPerformance] = useState<StaffPerformance[]>([]);
  const [dailyStats, setDailyStats] = useState<DailyStats[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [timeRange, setTimeRange] = useState<'today' | 'week' | 'month'>('week');
  const [sortBy, setSortBy] = useState<'requests_completed' | 'avg_response_time' | 'sla_compliance'>('requests_completed');

  useEffect(() => {
    fetchPerformanceData();
  }, [timeRange]);

  const fetchPerformanceData = async () => {
    setLoading(true);
    try {
      // Simulated data - would come from API
      const mockTeamStats: TeamStats = {
        total_requests: 156,
        completed_today: 23,
        avg_response_time: 18,
        overall_sla_compliance: 94,
        top_performer: null,
      };

      const mockStaffPerformance: StaffPerformance[] = [
        { id: '1', name: 'Sarah Johnson', department: 'housekeeping', requests_completed: 45, avg_response_time: 12, sla_compliance: 98, rating: 4.9, requests_today: 8 },
        { id: '2', name: 'Mike Chen', department: 'room_service', requests_completed: 38, avg_response_time: 15, sla_compliance: 96, rating: 4.8, requests_today: 6 },
        { id: '3', name: 'Lisa Patel', department: 'maintenance', requests_completed: 32, avg_response_time: 22, sla_compliance: 92, rating: 4.7, requests_today: 5 },
        { id: '4', name: 'Tom Wilson', department: 'concierge', requests_completed: 28, avg_response_time: 18, sla_compliance: 95, rating: 4.6, requests_today: 4 },
        { id: '5', name: 'Amy Rodriguez', department: 'housekeeping', requests_completed: 25, avg_response_time: 20, sla_compliance: 91, rating: 4.5, requests_today: 5 },
        { id: '6', name: 'David Kim', department: 'room_service', requests_completed: 22, avg_response_time: 25, sla_compliance: 88, rating: 4.4, requests_today: 3 },
      ];

      const mockDailyStats: DailyStats[] = [
        { date: '2024-01-17', requests: 45, completed: 42, avg_time: 18, sla_compliance: 93 },
        { date: '2024-01-16', requests: 52, completed: 48, avg_time: 16, sla_compliance: 95 },
        { date: '2024-01-15', requests: 38, completed: 36, avg_time: 20, sla_compliance: 91 },
        { date: '2024-01-14', requests: 41, completed: 39, avg_time: 17, sla_compliance: 94 },
        { date: '2024-01-13', requests: 48, completed: 44, avg_time: 19, sla_compliance: 92 },
        { date: '2024-01-12', requests: 55, completed: 52, avg_time: 15, sla_compliance: 96 },
        { date: '2024-01-11', requests: 43, completed: 40, avg_time: 21, sla_compliance: 90 },
      ];

      setTeamStats(mockTeamStats);
      setStaffPerformance(mockStaffPerformance);
      setDailyStats(mockDailyStats);

      // Find top performer
      const topPerformer = mockStaffPerformance.reduce((best, current) =>
        current.sla_compliance > best.sla_compliance ? current : best
      );
      setTeamStats((prev) => prev ? { ...prev, top_performer: topPerformer } : null);
    } catch (err: any) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };

  const sortedStaff = [...staffPerformance].sort((a, b) => {
    if (sortBy === 'avg_response_time') {
      return a.avg_response_time - b.avg_response_time;
    }
    return b[sortBy] - a[sortBy];
  });

  const getDepartmentColor = (department: string) => {
    switch (department) {
      case 'housekeeping':
        return 'bg-pink-100 text-pink-700';
      case 'room_service':
        return 'bg-orange-100 text-orange-700';
      case 'maintenance':
        return 'bg-blue-100 text-blue-700';
      case 'concierge':
        return 'bg-purple-100 text-purple-700';
      default:
        return 'bg-gray-100 text-gray-700';
    }
  };

  const getSLAColor = (compliance: number) => {
    if (compliance >= 95) return 'text-green-600';
    if (compliance >= 85) return 'text-amber-600';
    return 'text-red-600';
  };

  const getRatingStars = (rating: number) => {
    const fullStars = Math.floor(rating);
    const hasHalf = rating % 1 >= 0.5;
    let stars = '';
    for (let i = 0; i < fullStars; i++) stars += '★';
    if (hasHalf) stars += '☆';
    return stars;
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
          <h1 className="text-2xl font-bold text-gray-900">Staff Performance</h1>
          <p className="text-gray-500 mt-1">Monitor team metrics and productivity</p>
        </div>

        <div className="flex gap-2">
          {(['today', 'week', 'month'] as const).map((range) => (
            <button
              key={range}
              onClick={() => setTimeRange(range)}
              className={`px-4 py-2 rounded-lg text-sm font-medium transition-colors ${
                timeRange === range
                  ? 'bg-blue-100 text-blue-700'
                  : 'bg-gray-100 text-gray-600 hover:bg-gray-200'
              }`}
            >
              {range.charAt(0).toUpperCase() + range.slice(1)}
            </button>
          ))}
        </div>
      </div>

      {/* Team Overview */}
      {teamStats && (
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-6">
          <StatCard
            label="Total Requests"
            value={teamStats.total_requests}
            trend="+12%"
            trendUp
            color="bg-blue-100 text-blue-700"
          />
          <StatCard
            label="Completed Today"
            value={teamStats.completed_today}
            color="bg-green-100 text-green-700"
          />
          <StatCard
            label="Avg Response Time"
            value={`${teamStats.avg_response_time}m`}
            color="bg-amber-100 text-amber-700"
          />
          <StatCard
            label="SLA Compliance"
            value={`${teamStats.overall_sla_compliance}%`}
            color="bg-purple-100 text-purple-700"
          />
        </div>
      )}

      {/* Top Performer */}
      {teamStats?.top_performer && (
        <div className="bg-gradient-to-r from-yellow-50 to-amber-50 rounded-xl border border-yellow-200 p-6 mb-6">
          <div className="flex items-center gap-4">
            <div className="w-16 h-16 bg-yellow-400 rounded-full flex items-center justify-center text-2xl">
              🏆
            </div>
            <div>
              <p className="text-sm font-medium text-amber-700">Top Performer</p>
              <p className="text-xl font-bold text-gray-900">{teamStats.top_performer.name}</p>
              <p className="text-sm text-gray-600 capitalize">{teamStats.top_performer.department.replace('_', ' ')}</p>
            </div>
            <div className="ml-auto text-right">
              <p className="text-3xl font-bold text-yellow-600">{teamStats.top_performer.sla_compliance}%</p>
              <p className="text-sm text-gray-500">SLA Compliance</p>
            </div>
          </div>
        </div>
      )}

      {/* Daily Trend Chart */}
      <div className="bg-white rounded-xl border border-gray-200 p-6 mb-6">
        <h2 className="text-lg font-semibold text-gray-900 mb-4">Daily Performance Trend</h2>
        <div className="h-48 flex items-end gap-2">
          {dailyStats.map((day, index) => {
            const maxRequests = Math.max(...dailyStats.map((d) => d.requests));
            const height = (day.requests / maxRequests) * 100;
            const isLast = index === dailyStats.length - 1;

            return (
              <div key={day.date} className="flex-1 flex flex-col items-center gap-2">
                <div className="w-full relative" style={{ height: '160px' }}>
                  {/* Completed bar */}
                  <div
                    className="absolute bottom-0 w-8 bg-green-400 rounded-t transition-all"
                    style={{
                      height: `${(day.completed / maxRequests) * 100}%`,
                      left: '50%',
                      transform: 'translateX(-50%)',
                    }}
                  />
                  {/* Total bar (shows as border) */}
                  <div
                    className={`absolute bottom-0 w-8 border-2 border-blue-400 rounded-t bg-blue-100/50 transition-all ${isLast ? 'border-blue-600 bg-blue-200/50' : ''}`}
                    style={{
                      height: `${height}%`,
                      left: '50%',
                      transform: 'translateX(-50%)',
                    }}
                  />
                </div>
                <span className="text-xs text-gray-500">
                  {new Date(day.date).toLocaleDateString('en-US', { weekday: 'short' })}
                </span>
              </div>
            );
          })}
        </div>
        <div className="flex justify-center gap-6 mt-4">
          <div className="flex items-center gap-2">
            <div className="w-4 h-4 bg-blue-400 rounded" />
            <span className="text-sm text-gray-600">Completed</span>
          </div>
          <div className="flex items-center gap-2">
            <div className="w-4 h-4 border-2 border-blue-400 rounded bg-blue-100" />
            <span className="text-sm text-gray-600">Total</span>
          </div>
        </div>
      </div>

      {/* Staff Rankings */}
      <div className="bg-white rounded-xl border border-gray-200 overflow-hidden">
        <div className="px-6 py-4 border-b border-gray-200 flex items-center justify-between">
          <h2 className="text-lg font-semibold text-gray-900">Staff Rankings</h2>
          <div className="flex gap-2">
            {(['requests_completed', 'avg_response_time', 'sla_compliance'] as const).map((sort) => (
              <button
                key={sort}
                onClick={() => setSortBy(sort)}
                className={`px-3 py-1 rounded text-xs font-medium transition-colors ${
                  sortBy === sort
                    ? 'bg-blue-100 text-blue-700'
                    : 'bg-gray-100 text-gray-600 hover:bg-gray-200'
                }`}
              >
                {sort === 'requests_completed'
                  ? 'Most Requests'
                  : sort === 'avg_response_time'
                  ? 'Fastest Response'
                  : 'Best SLA'}
              </button>
            ))}
          </div>
        </div>

        <div className="divide-y divide-gray-100">
          {sortedStaff.map((staff, index) => (
            <div
              key={staff.id}
              className={`px-6 py-4 flex items-center gap-4 ${index === 0 ? 'bg-yellow-50' : ''}`}
            >
              {/* Rank */}
              <div className="w-10 h-10 flex items-center justify-center">
                {index === 0 && <span className="text-2xl">🥇</span>}
                {index === 1 && <span className="text-2xl">🥈</span>}
                {index === 2 && <span className="text-2xl">🥉</span>}
                {index > 2 && <span className="text-gray-400 font-semibold">#{index + 1}</span>}
              </div>

              {/* Avatar */}
              <div className="w-12 h-12 bg-gray-200 rounded-full flex items-center justify-center text-gray-600 font-semibold">
                {staff.name.split(' ').map((n) => n[0]).join('')}
              </div>

              {/* Info */}
              <div className="flex-1">
                <p className="font-semibold text-gray-900">{staff.name}</p>
                <div className="flex items-center gap-2 mt-1">
                  <span className={`px-2 py-0.5 rounded text-xs font-medium ${getDepartmentColor(staff.department)}`}>
                    {staff.department.replace('_', ' ')}
                  </span>
                  <span className="text-sm text-gray-400">
                    {getRatingStars(staff.rating)} {staff.rating}
                  </span>
                </div>
              </div>

              {/* Stats */}
              <div className="flex items-center gap-8">
                <div className="text-center">
                  <p className="text-lg font-bold text-gray-900">{staff.requests_completed}</p>
                  <p className="text-xs text-gray-500">Completed</p>
                </div>
                <div className="text-center">
                  <p className="text-lg font-bold text-gray-900">{staff.avg_response_time}m</p>
                  <p className="text-xs text-gray-500">Avg Time</p>
                </div>
                <div className="text-center">
                  <p className={`text-lg font-bold ${getSLAColor(staff.sla_compliance)}`}>
                    {staff.sla_compliance}%
                  </p>
                  <p className="text-xs text-gray-500">SLA</p>
                </div>
                <div className="text-center">
                  <p className="text-lg font-bold text-blue-600">{staff.requests_today}</p>
                  <p className="text-xs text-gray-500">Today</p>
                </div>
              </div>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}

// Stat Card Component
function StatCard({
  label,
  value,
  trend,
  trendUp,
  color,
}: {
  label: string;
  value: string | number;
  trend?: string;
  trendUp?: boolean;
  color: string;
}) {
  return (
    <div className={`${color} rounded-xl p-4`}>
      <p className="text-sm font-medium opacity-80">{label}</p>
      <div className="flex items-end gap-2 mt-1">
        <p className="text-2xl font-bold">{value}</p>
        {trend && (
          <span className={`text-sm font-medium ${trendUp ? 'text-green-700' : 'text-red-700'}`}>
            {trend}
          </span>
        )}
      </div>
    </div>
  );
}
