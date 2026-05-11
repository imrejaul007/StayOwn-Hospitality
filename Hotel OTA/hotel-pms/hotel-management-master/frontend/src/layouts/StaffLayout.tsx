import React, { useState } from 'react';
import { Outlet, useNavigate, useLocation } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import { useNotificationStream } from '../hooks/useNotifications';
import NotificationDropdown from '../components/notifications/NotificationDropdown';
import SettingsDropdown from '../components/settings/SettingsDropdown';
import {
  ClipboardCheck,
  Users,
  Users2,
  Wrench,
  Package,
  BarChart3,
  Settings,
  LogOut,
  Menu,
  X,
  Home,
  Bell,
  MessageSquare,
  CreditCard,
  CheckSquare,
  ShoppingBag,
  AlertTriangle,
  FileText,
  CalendarDays,
  Key
} from 'lucide-react';

const navigation = [
  { name: 'Dashboard', href: '/staff', icon: Home },
  { name: 'Upcoming Arrivals', href: '/staff/upcoming-bookings', icon: CalendarDays },
  { name: 'Alert Center', href: '/staff/alerts', icon: Bell },
  { name: 'Daily Routine Check', href: '/staff/daily-routine-check', icon: CheckSquare },
  { name: 'Meet-Up Supervision', href: '/staff/meetup-supervision', icon: Users2 },
  { name: 'Housekeeping', href: '/staff/housekeeping', icon: ClipboardCheck },
  { name: 'Maintenance', href: '/staff/maintenance', icon: Wrench },
  { name: 'Guest Services', href: '/staff/guest-services', icon: Users },
  { name: 'Guest Management', href: '/staff/guest-management', icon: Users },
  { name: 'Digital Keys', href: '/staff/digital-keys', icon: Key },
  { name: 'Billing & Payments', href: '/staff/billing', icon: CreditCard },
  { name: 'Service Requests', href: '/staff/service-requests', icon: MessageSquare },
  { name: 'Supply Requests', href: '/staff/supply-requests', icon: Package },
  { name: 'Inventory Requests', href: '/staff/inventory-requests', icon: ShoppingBag },
  { name: 'Room Status', href: '/staff/rooms', icon: Users },
  { name: 'Inventory', href: '/staff/inventory', icon: Package },
  { name: 'Checkout Inventory', href: '/staff/checkout-inventory', icon: CreditCard },
  { name: 'Documents', href: '/staff/documents', icon: FileText },
  { name: 'Reports', href: '/staff/reports', icon: BarChart3 },
];

export default function StaffLayout() {
  const { user, logout } = useAuth();
  const navigate = useNavigate();
  const location = useLocation();
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const [isNotificationOpen, setIsNotificationOpen] = useState(false);
  const [isSettingsOpen, setIsSettingsOpen] = useState(false);

  // Connect to notification stream
  useNotificationStream();

  const handleLogout = () => {
    logout();
    navigate('/');
  };

  const isActivePath = (path: string) => {
    if (path === '/staff') {
      return location.pathname === '/staff';
    }
    return location.pathname.startsWith(path);
  };

  return (
    <div className="h-screen flex overflow-hidden bg-gray-100">
      {/* Mobile sidebar overlay */}
      {sidebarOpen && (
        <div className="fixed inset-0 flex z-40 md:hidden">
          <div aria-hidden="true" className="fixed inset-0 bg-gray-600 bg-opacity-75" onClick={() => setSidebarOpen(false)} />
          <div className="relative flex-1 flex flex-col max-w-xs w-full bg-white">
            <div className="absolute top-0 right-0 -mr-12 pt-2">
              <button aria-label="Close"
                className="ml-1 flex items-center justify-center h-10 w-10 rounded-full focus:outline-none focus:ring-2 focus:ring-inset focus:ring-white"
                onClick={() => setSidebarOpen(false)}
              >
                <X className="h-6 w-6 text-white" />
              </button>
            </div>
            <div className="flex-1 h-0 pt-5 pb-4 overflow-y-auto">
              <div className="flex-shrink-0 flex items-center px-4">
                <h1 className="text-xl font-bold text-gray-900">Staff Panel</h1>
              </div>
              <nav className="mt-5 px-2 space-y-1">
                {navigation.map((item) => (
                  <button
                    key={item.name}
                    aria-label={`Navigate to ${item.name}`}
                    onClick={() => {
                      navigate(item.href);
                      setSidebarOpen(false);
                    }}
                    className={`
                      w-full group flex items-center px-2 py-2 text-base font-medium rounded-md text-left
                      ${isActivePath(item.href)
                        ? 'bg-blue-100 text-blue-900'
                        : 'text-gray-600 hover:bg-gray-50 hover:text-gray-900'
                      }
                    `}
                  >
                    <item.icon className="mr-4 h-6 w-6" />
                    {item.name}
                  </button>
                ))}
              </nav>
            </div>
          </div>
        </div>
      )}

      {/* Desktop sidebar */}
      <div className="hidden md:flex md:flex-shrink-0">
        <div className="flex flex-col w-64">
          <div className="flex flex-col h-0 flex-1 border-r border-gray-200 bg-white">
            <div className="flex-1 flex flex-col pt-5 pb-4 overflow-y-auto">
              <div className="flex items-center flex-shrink-0 px-4">
                <h1 className="text-xl font-bold text-gray-900">Staff Panel</h1>
              </div>
              <nav className="mt-5 flex-1 px-2 space-y-1">
                {navigation.map((item) => (
                  <button
                    key={item.name}
                    aria-label={`Navigate to ${item.name}`}
                    onClick={() => navigate(item.href)}
                    className={`
                      w-full group flex items-center px-2 py-2 text-sm font-medium rounded-md text-left
                      ${isActivePath(item.href)
                        ? 'bg-blue-100 text-blue-900'
                        : 'text-gray-600 hover:bg-gray-50 hover:text-gray-900'
                      }
                    `}
                  >
                    <item.icon className="mr-3 h-5 w-5" />
                    {item.name}
                  </button>
                ))}
              </nav>
            </div>
          </div>
        </div>
      </div>

      {/* Main content */}
      <div className="flex flex-col w-0 flex-1 overflow-hidden">
        {/* Top navigation */}
        <div className="relative z-10 flex-shrink-0 flex h-16 bg-white shadow">
          <button aria-label="Open navigation menu"
            className="px-4 border-r border-gray-200 text-gray-500 focus:outline-none focus:ring-2 focus:ring-inset focus:ring-blue-500 md:hidden"
            onClick={() => setSidebarOpen(true)}
          >
            <Menu className="h-6 w-6" />
          </button>
          <div className="flex-1 px-4 flex justify-between">
            <div className="flex-1 flex">
              <div className="w-full flex md:ml-0">
                <div className="flex items-center space-x-4">
                  <h2 className="text-lg font-medium text-gray-900">
                    {navigation.find(item => isActivePath(item.href))?.name || 'Dashboard'}
                  </h2>
                  
                </div>
              </div>
            </div>
            <div className="ml-4 flex items-center md:ml-6 space-x-3">

              {/* Notification Dropdown */}
              <div className="relative">
                <NotificationDropdown
                  isOpen={isNotificationOpen}
                  onToggle={() => setIsNotificationOpen(!isNotificationOpen)}
                />
              </div>

              {/* Settings Dropdown */}
              <div className="relative">
                <SettingsDropdown
                  isOpen={isSettingsOpen}
                  onToggle={() => setIsSettingsOpen(!isSettingsOpen)}
                />
              </div>

              {/* User menu */}
              <div className="flex items-center space-x-3">
                <div className="flex flex-col items-end">
                  <span className="text-sm font-medium text-gray-900">{user?.name}</span>
                  <span className="text-xs text-gray-500 capitalize">{user?.role}</span>
                </div>
                <div className="relative">
                  <button
                    aria-label="Logout"
                    onClick={handleLogout}
                    className="flex items-center space-x-2 text-gray-500 hover:text-gray-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-blue-500"
                    title="Logout"
                  >
                    <LogOut className="h-5 w-5" />
                  </button>
                </div>
              </div>
            </div>
          </div>
        </div>

        {/* Main content area */}
        <main id="main-content" aria-label="Main content" className="flex-1 relative overflow-y-auto focus:outline-none">
          <div className="py-6">
            <Outlet />
          </div>
        </main>
      </div>
    </div>
  );
}