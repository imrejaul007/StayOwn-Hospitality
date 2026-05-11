import React, { useState } from 'react';
import { Bell, User, Settings, Menu, PanelLeftClose, PanelLeftOpen } from 'lucide-react';
import { useAuth } from '../../context/AuthContext';
import { Button } from '../../components/ui/button';
import { useNotifications, useNotificationStream } from '../../hooks/useNotifications';
import NotificationDropdown from '../../components/notifications/NotificationDropdown';
import SettingsDropdown from '../../components/settings/SettingsDropdown';
import { WebSocketStatus } from '../../components/debug/WebSocketStatus';
import { PropertySelector } from '../../components/common/PropertySelector';

interface AdminHeaderProps {
  onMenuClick?: () => void;
  onSidebarToggle?: () => void;
  isSidebarCollapsed?: boolean;
}

export default function AdminHeader({ onMenuClick, onSidebarToggle, isSidebarCollapsed }: AdminHeaderProps) {
  const { user, logout } = useAuth();
  const [isNotificationOpen, setIsNotificationOpen] = useState(false);
  const [isSettingsOpen, setIsSettingsOpen] = useState(false);
  const { unreadCount } = useNotifications();

  // Connect to notification stream
  useNotificationStream();

  return (
    <header className="bg-white shadow-sm border-b border-gray-200 px-4 sm:px-6 lg:px-8 py-4">
      <div className="flex justify-between items-center">
        <div className="flex items-center space-x-3">
          {/* Mobile menu button */}
          <button aria-label="More options"
            onClick={onMenuClick}
            className="lg:hidden p-2 rounded-md text-gray-500 hover:bg-gray-100 focus:outline-none focus:ring-2 focus:ring-blue-500"
          >
            <Menu className="h-5 w-5" />
          </button>

          {/* Desktop sidebar toggle button */}
          <button aria-label="Close"
            onClick={onSidebarToggle}
            className="hidden lg:block p-2 rounded-md text-gray-500 hover:bg-gray-100 focus:outline-none focus:ring-2 focus:ring-blue-500 transition-colors"
            title={isSidebarCollapsed ? 'Expand sidebar' : 'Collapse sidebar'}
          >
            {isSidebarCollapsed ? (
              <PanelLeftOpen className="h-5 w-5" />
            ) : (
              <PanelLeftClose className="h-5 w-5" />
            )}
          </button>

          <h1 className="text-xl sm:text-2xl font-bold text-gray-900">
            {user?.role === 'admin' ? 'Admin Dashboard' : 'Staff Dashboard'}
          </h1>

          {/* Property Selector */}
          <PropertySelector />
        </div>

        <div className="flex items-center space-x-2 sm:space-x-4">
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
          
          <div className="flex items-center space-x-3">
            <div className="text-right hidden sm:block">
              <p className="text-sm font-medium text-gray-900">{user?.name}</p>
              <p className="text-xs text-gray-500 capitalize">{user?.role}</p>
            </div>
            <div className="h-8 w-8 bg-gray-600 rounded-full flex items-center justify-center">
              <User className="h-4 w-4 text-white" />
            </div>
          </div>
          
          <Button variant="ghost" size="sm" onClick={logout} className="hidden sm:inline-flex">
            Logout
          </Button>
          
          {/* Mobile logout button */}
          <Button variant="ghost" size="sm" onClick={logout} className="sm:hidden px-2">
            <User className="h-4 w-4" />
          </Button>
        </div>
      </div>

    </header>
  );
}