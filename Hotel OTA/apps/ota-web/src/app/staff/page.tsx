'use client';

import { useState, useEffect } from 'react';
import Link from 'next/link';
import { usePathname } from 'next/navigation';

interface DashboardStats {
  total_requests: number;
  pending_requests: number;
  in_progress_requests: number;
  completed_today: number;
  occupied_rooms: number;
  vacant_rooms: number;
  cleaning_rooms: number;
  maintenance_rooms: number;
  unread_messages: number;
  pending_checkouts: number;
  urgent_requests: number;
}

interface RecentActivity {
  id: string;
  type: 'request' | 'message' | 'checkout' | 'alert';
  title: string;
  description: string;
  time: string;
  priority?: 'low' | 'medium' | 'high' | 'urgent';
  room_number?: string;
}

export default function StaffDashboardPage() {
  const [stats, setStats] = useState<DashboardStats | null>(null);
  const [activities, setActivities] = useState<RecentActivity[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  useEffect(() => {
    fetchDashboardData();
  }, []);

  const fetchDashboardData = async () => {
    try {
      const res = await fetch('/api/staff/dashboard', {
        credentials: 'include',
      });
      if (!res.ok) throw new Error('Failed to fetch dashboard data');
      const data = await res.json();
      setStats(data.stats);
      setActivities(data.recentActivity || []);
    } catch (err: any) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center">
        <div className="text-center">
          <div className="w-12 h-12 border-4 border-blue-600 border-t-transparent rounded-full animate-spin mx-auto mb-4"></div>
          <p className="text-gray-500">Loading dashboard...</p>
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center">
        <div className="bg-red-50 border border-red-200 text-red-700 px-6 py-4 rounded-lg">
          <p className="font-medium">Error loading dashboard</p>
          <p className="text-sm">{error}</p>
          <button
            onClick={fetchDashboardData}
            className="mt-3 px-4 py-2 bg-red-600 text-white rounded-lg text-sm hover:bg-red-700"
          >
            Retry
          </button>
        </div>
      </div>
    );
  }

  const quickActions = [
    { label: 'New Request', href: '/staff/requests', icon: '+', color: 'bg-blue-500 hover:bg-blue-600' },
    { label: 'Rooms', href: '/staff/rooms', icon: '🏨', color: 'bg-green-500 hover:bg-green-600' },
    { label: 'Messages', href: '/staff/messages', icon: '💬', color: 'bg-purple-500 hover:bg-purple-600' },
    { label: 'Checkout', href: '/staff/checkout', icon: '🚪', color: 'bg-amber-500 hover:bg-amber-600' },
  ];

  return (
    <div className="p-6 max-w-7xl mx-auto">
      {/* Header */}
      <div className="mb-8">
        <h1 className="text-3xl font-bold text-gray-900">Staff Dashboard</h1>
        <p className="text-gray-500 mt-1">Welcome back! Here&apos;s what&apos;s happening today.</p>
      </div>

      {/* Stats Grid */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4 mb-8">
        <StatCard
          title="Pending Requests"
          value={stats?.pending_requests || 0}
          subtitle="awaiting action"
          icon="📋"
          color="bg-amber-500"
          link="/staff/requests?status=pending"
        />
        <StatCard
          title="In Progress"
          value={stats?.in_progress_requests || 0}
          subtitle="being handled"
          icon="⚙️"
          color="bg-blue-500"
          link="/staff/requests?status=in_progress"
        />
        <StatCard
          title="Completed Today"
          value={stats?.completed_today || 0}
          subtitle="resolved"
          icon="✅"
          color="bg-green-500"
          link="/staff/requests?status=completed"
        />
        <StatCard
          title="Urgent"
          value={stats?.urgent_requests || 0}
          subtitle="priority items"
          icon="🚨"
          color="bg-red-500"
          link="/staff/requests?priority=urgent"
        />
      </div>

      {/* Room Status */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-8">
        <RoomStatusCard title="Occupied" count={stats?.occupied_rooms || 0} color="bg-blue-100 text-blue-700" />
        <RoomStatusCard title="Vacant" count={stats?.vacant_rooms || 0} color="bg-green-100 text-green-700" />
        <RoomStatusCard title="Cleaning" count={stats?.cleaning_rooms || 0} color="bg-yellow-100 text-yellow-700" />
        <RoomStatusCard title="Maintenance" count={stats?.maintenance_rooms || 0} color="bg-red-100 text-red-700" />
      </div>

      {/* Quick Actions */}
      <div className="bg-white rounded-xl border border-gray-100 shadow-sm p-6 mb-8">
        <h2 className="text-lg font-semibold text-gray-900 mb-4">Quick Actions</h2>
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
          {quickActions.map((action) => (
            <Link
              key={action.label}
              href={action.href}
              className={`${action.color} text-white rounded-lg p-4 flex flex-col items-center justify-center transition-colors`}
            >
              <span className="text-2xl mb-2">{action.icon}</span>
              <span className="font-medium text-sm">{action.label}</span>
            </Link>
          ))}
        </div>
      </div>

      {/* Two Column Layout */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Recent Activity */}
        <div className="bg-white rounded-xl border border-gray-100 shadow-sm">
          <div className="px-6 py-4 border-b border-gray-100 flex items-center justify-between">
            <h2 className="text-lg font-semibold text-gray-900">Recent Activity</h2>
            <Link href="/staff/requests" className="text-sm text-blue-600 hover:underline">
              View all
            </Link>
          </div>
          <div className="divide-y divide-gray-50">
            {activities.length === 0 ? (
              <p className="px-6 py-8 text-sm text-gray-400 text-center">No recent activity</p>
            ) : (
              activities.slice(0, 5).map((activity) => (
                <ActivityItem key={activity.id} activity={activity} />
              ))
            )}
          </div>
        </div>

        {/* Notifications & Alerts */}
        <div className="bg-white rounded-xl border border-gray-100 shadow-sm">
          <div className="px-6 py-4 border-b border-gray-100 flex items-center justify-between">
            <h2 className="text-lg font-semibold text-gray-900">Notifications</h2>
            <span className="bg-red-500 text-white text-xs px-2 py-1 rounded-full">
              {(stats?.unread_messages || 0) + (stats?.pending_checkouts || 0)}
            </span>
          </div>
          <div className="divide-y divide-gray-50">
            <NotificationItem
              icon="💬"
              title="New Guest Messages"
              count={stats?.unread_messages || 0}
              href="/staff/messages"
            />
            <NotificationItem
              icon="🚪"
              title="Pending Checkouts"
              count={stats?.pending_checkouts || 0}
              href="/staff/checkout"
            />
            <NotificationItem
              icon="🧹"
              title="Rooms Need Cleaning"
              count={stats?.cleaning_rooms || 0}
              href="/staff/rooms"
            />
          </div>
        </div>
      </div>
    </div>
  );
}

// Stat Card Component
function StatCard({
  title,
  value,
  subtitle,
  icon,
  color,
  link,
}: {
  title: string;
  value: number;
  subtitle: string;
  icon: string;
  color: string;
  link: string;
}) {
  return (
    <Link href={link} className="bg-white rounded-xl border border-gray-100 shadow-sm p-5 hover:shadow-md transition-shadow">
      <div className="flex items-start justify-between">
        <div>
          <p className="text-sm text-gray-500">{title}</p>
          <p className="text-3xl font-bold text-gray-900 mt-1">{value}</p>
          <p className="text-xs text-gray-400 mt-0.5">{subtitle}</p>
        </div>
        <div className={`${color} w-10 h-10 rounded-lg flex items-center justify-center text-lg`}>
          {icon}
        </div>
      </div>
    </Link>
  );
}

// Room Status Card Component
function RoomStatusCard({
  title,
  count,
  color,
}: {
  title: string;
  count: number;
  color: string;
}) {
  return (
    <div className={`${color} rounded-lg p-4 text-center`}>
      <p className="text-2xl font-bold">{count}</p>
      <p className="text-sm font-medium opacity-80">{title}</p>
    </div>
  );
}

// Activity Item Component
function ActivityItem({ activity }: { activity: RecentActivity }) {
  const priorityColors = {
    low: 'text-gray-400',
    medium: 'text-blue-500',
    high: 'text-amber-500',
    urgent: 'text-red-500',
  };

  return (
    <div className="px-6 py-4 hover:bg-gray-50 transition-colors">
      <div className="flex items-start gap-3">
        <div className="w-8 h-8 bg-gray-100 rounded-full flex items-center justify-center text-sm">
          {activity.type === 'request' && '📋'}
          {activity.type === 'message' && '💬'}
          {activity.type === 'checkout' && '🚪'}
          {activity.type === 'alert' && '🚨'}
        </div>
        <div className="flex-1 min-w-0">
          <p className="text-sm font-medium text-gray-900">
            {activity.title}
            {activity.room_number && (
              <span className="text-gray-500 ml-2">Room {activity.room_number}</span>
            )}
          </p>
          <p className="text-xs text-gray-400 mt-0.5 truncate">{activity.description}</p>
        </div>
        <div className="text-right">
          <p className="text-xs text-gray-400">{activity.time}</p>
          {activity.priority && (
            <span className={`text-xs font-medium ${priorityColors[activity.priority]}`}>
              {activity.priority}
            </span>
          )}
        </div>
      </div>
    </div>
  );
}

// Notification Item Component
function NotificationItem({
  icon,
  title,
  count,
  href,
}: {
  icon: string;
  title: string;
  count: number;
  href: string;
}) {
  return (
    <Link href={href} className="px-6 py-4 flex items-center justify-between hover:bg-gray-50 transition-colors">
      <div className="flex items-center gap-3">
        <span className="text-xl">{icon}</span>
        <span className="text-sm font-medium text-gray-900">{title}</span>
      </div>
      {count > 0 && (
        <span className="bg-blue-100 text-blue-700 text-xs font-medium px-2 py-1 rounded-full">
          {count}
        </span>
      )}
    </Link>
  );
}
