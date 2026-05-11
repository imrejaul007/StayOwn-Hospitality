'use client';

import { useState, useEffect, createContext, useContext, ReactNode } from 'react';
import Link from 'next/link';
import { usePathname } from 'next/navigation';

interface StaffUser {
  id: string;
  name: string;
  role: 'manager' | 'front_desk' | 'housekeeping' | 'room_service' | 'maintenance';
  department: string;
  avatar?: string;
}

interface Notification {
  id: string;
  type: 'request' | 'message' | 'checkout' | 'alert';
  title: string;
  message: string;
  read: boolean;
  createdAt: string;
}

interface StaffContextType {
  user: StaffUser | null;
  notifications: Notification[];
  unreadCount: number;
  markAsRead: (id: string) => void;
  logout: () => void;
}

const StaffContext = createContext<StaffContextType>({
  user: null,
  notifications: [],
  unreadCount: 0,
  markAsRead: () => {},
  logout: () => {},
});

export function useStaff() {
  return useContext(StaffContext);
}

interface StaffLayoutProps {
  children: ReactNode;
}

export default function StaffLayout({ children }: StaffLayoutProps) {
  const [user, setUser] = useState<StaffUser | null>(null);
  const [notifications, setNotifications] = useState<Notification[]>([]);
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const [loading, setLoading] = useState(true);
  const pathname = usePathname();

  useEffect(() => {
    fetchUserAndNotifications();
  }, []);

  const fetchUserAndNotifications = async () => {
    try {
      const [userRes, notifRes] = await Promise.all([
        fetch('/api/staff/me', { credentials: 'include' }),
        fetch('/api/staff/notifications', { credentials: 'include' }),
      ]);

      if (userRes.ok) {
        const userData = await userRes.json();
        setUser(userData.user);
      }

      if (notifRes.ok) {
        const notifData = await notifRes.json();
        setNotifications(notifData.notifications || []);
      }
    } catch (err) {
      console.error('Failed to fetch user data:', err);
    } finally {
      setLoading(false);
    }
  };

  const unreadCount = notifications.filter((n) => !n.read).length;

  const markAsRead = async (id: string) => {
    setNotifications((prev) =>
      prev.map((n) => (n.id === id ? { ...n, read: true } : n))
    );
    try {
      await fetch(`/api/staff/notifications/${id}/read`, {
        method: 'POST',
        credentials: 'include',
      });
    } catch (err) {
      console.error('Failed to mark notification as read');
    }
  };

  const logout = async () => {
    try {
      await fetch('/api/staff/logout', { method: 'POST', credentials: 'include' });
    } finally {
      if (typeof window !== 'undefined') {
        window.location.href = '/';
      }
    }
  };

  const navItems = [
    { href: '/staff', label: 'Dashboard', icon: '📊' },
    { href: '/staff/requests', label: 'Requests', icon: '📋' },
    { href: '/staff/rooms', label: 'Rooms', icon: '🏨' },
    { href: '/staff/messages', label: 'Messages', icon: '💬', badge: unreadCount > 0 ? unreadCount : undefined },
    { href: '/staff/checkout', label: 'Checkout', icon: '🚪' },
    { href: '/staff/notifications', label: 'Notifications', icon: '🔔', badge: unreadCount },
  ];

  const canAccess = (itemLabel: string) => {
    if (!user) return false;
    if (user.role === 'manager') return true;

    const roleAccess: Record<string, string[]> = {
      front_desk: ['Dashboard', 'Requests', 'Rooms', 'Messages', 'Checkout', 'Notifications'],
      housekeeping: ['Dashboard', 'Requests', 'Rooms', 'Notifications'],
      room_service: ['Dashboard', 'Requests', 'Notifications'],
      maintenance: ['Dashboard', 'Requests', 'Notifications'],
    };

    return roleAccess[user.role]?.includes(itemLabel) || false;
  };

  return (
    <StaffContext.Provider value={{ user, notifications, unreadCount, markAsRead, logout }}>
      <div className="min-h-screen bg-gray-50 flex">
        {/* Mobile sidebar backdrop */}
        {sidebarOpen && (
          <div
            className="fixed inset-0 bg-black/50 z-40 lg:hidden"
            onClick={() => setSidebarOpen(false)}
          />
        )}

        {/* Sidebar */}
        <aside
          className={`fixed lg:static inset-y-0 left-0 z-50 w-64 bg-white border-r border-gray-200 transform transition-transform duration-200 ease-in-out ${
            sidebarOpen ? 'translate-x-0' : '-translate-x-full lg:translate-x-0'
          }`}
        >
          {/* Logo */}
          <div className="h-16 flex items-center justify-between px-4 border-b border-gray-200">
            <Link href="/staff" className="flex items-center gap-2">
              <span className="text-2xl">🏨</span>
              <span className="font-bold text-gray-900">Staff Panel</span>
            </Link>
            <button
              onClick={() => setSidebarOpen(false)}
              className="lg:hidden p-2 text-gray-400 hover:text-gray-600"
            >
              ✕
            </button>
          </div>

          {/* Navigation */}
          <nav className="p-4 space-y-1">
            {navItems.map((item) =>
              canAccess(item.label) ? (
                <Link
                  key={item.href}
                  href={item.href}
                  className={`flex items-center justify-between px-4 py-3 rounded-lg transition-colors ${
                    pathname === item.href
                      ? 'bg-blue-50 text-blue-700'
                      : 'text-gray-700 hover:bg-gray-100'
                  }`}
                  onClick={() => setSidebarOpen(false)}
                >
                  <span className="flex items-center gap-3">
                    <span>{item.icon}</span>
                    <span className="font-medium">{item.label}</span>
                  </span>
                  {item.badge && item.badge > 0 && (
                    <span className="bg-red-500 text-white text-xs px-2 py-0.5 rounded-full">
                      {item.badge}
                    </span>
                  )}
                </Link>
              ) : null
            )}
          </nav>

          {/* User section */}
          <div className="absolute bottom-0 left-0 right-0 p-4 border-t border-gray-200">
            <div className="flex items-center gap-3 mb-3">
              <div className="w-10 h-10 bg-blue-100 rounded-full flex items-center justify-center text-blue-700 font-semibold">
                {user?.name?.[0]?.toUpperCase() || 'S'}
              </div>
              <div className="flex-1 min-w-0">
                <p className="text-sm font-medium text-gray-900 truncate">
                  {user?.name || 'Staff'}
                </p>
                <p className="text-xs text-gray-500 capitalize">
                  {user?.role?.replace('_', ' ') || 'Loading...'}
                </p>
              </div>
            </div>
            <button
              onClick={logout}
              className="w-full px-4 py-2 text-sm text-red-600 hover:bg-red-50 rounded-lg transition-colors"
            >
              Logout
            </button>
          </div>
        </aside>

        {/* Main content */}
        <div className="flex-1 flex flex-col min-w-0">
          {/* Mobile header */}
          <header className="lg:hidden h-16 bg-white border-b border-gray-200 flex items-center px-4 gap-4">
            <button
              onClick={() => setSidebarOpen(true)}
              className="p-2 text-gray-600 hover:text-gray-900"
            >
              <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 6h16M4 12h16M4 18h16" />
              </svg>
            </button>
            <span className="font-semibold text-gray-900">Staff Panel</span>
          </header>

          {/* Page content */}
          <main className="flex-1 overflow-auto">
            {loading ? (
              <div className="flex items-center justify-center h-64">
                <div className="w-8 h-8 border-4 border-blue-600 border-t-transparent rounded-full animate-spin"></div>
              </div>
            ) : (
              children
            )}
          </main>
        </div>
      </div>
    </StaffContext.Provider>
  );
}
