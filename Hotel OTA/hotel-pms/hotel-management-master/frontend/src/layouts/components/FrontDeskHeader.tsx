import React, { useState } from 'react';
import { Link } from 'react-router-dom';
import { Bell, AlertTriangle, User, Settings, Menu, PanelLeftClose, PanelLeftOpen, CheckCircle, Loader2 } from 'lucide-react';
import { useAuth } from '../../context/AuthContext';
import { Button } from '../../components/ui/button';
import { useNotifications, useNotificationStream } from '../../hooks/useNotifications';
import NotificationDropdown from '../../components/notifications/NotificationDropdown';
import StaffAlertDropdown from '../../components/staff/StaffAlertDropdown';
import SettingsDropdown from '../../components/settings/SettingsDropdown';
import { useStaffAlerts } from '../../hooks/useStaffAlerts';
import { PropertySelector } from '../../components/common/PropertySelector';
import { useQuery } from '@tanstack/react-query';
import { api } from '../../services/api';

interface FrontDeskHeaderProps {
  onMenuClick?: () => void;
  onSidebarToggle?: () => void;
  isSidebarCollapsed?: boolean;
}

export default function FrontDeskHeader({ onMenuClick, onSidebarToggle, isSidebarCollapsed }: FrontDeskHeaderProps) {
  const { user, logout } = useAuth();
  const [isNotificationOpen, setIsNotificationOpen] = useState(false);
  const [isAlertOpen, setIsAlertOpen] = useState(false);
  const [isSettingsOpen, setIsSettingsOpen] = useState(false);
  const { unreadCount } = useNotifications();
  const { unacknowledgedCount, criticalCount } = useStaffAlerts();

  // Connect to notification stream
  useNotificationStream();

  // Fetch pending approval count from the approvals API (matches MyApprovalRequests page)
  const { data: pendingApprovalsData, isLoading: isLoadingApprovals } = useQuery({
    queryKey: ['pending-approvals-count'],
    queryFn: async () => {
      try {
        const response = await api.get('/approvals/pending-count');
        return response.data;
      } catch {
        return { count: 0 };
      }
    },
    refetchInterval: 60000, // Refetch every minute
    enabled: !!user, // Only fetch if user is logged in
  });

  const pendingApprovalCount = pendingApprovalsData?.count || 0;

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
            Front Desk Dashboard
          </h1>

          {/* Property Selector */}
          <PropertySelector />
        </div>

        <div className="flex items-center space-x-2 sm:space-x-4">
          {/* Approval Requests Badge */}
          {isLoadingApprovals ? (
            <div className="p-2">
              <Loader2 className="h-5 w-5 animate-spin text-gray-400" />
            </div>
          ) : pendingApprovalCount > 0 ? (
            <Link
              to="/frontdesk/my-approvals"
              className="relative p-2 rounded-md text-gray-500 hover:bg-gray-100 focus:outline-none focus:ring-2 focus:ring-blue-500 transition-colors"
              title={`${pendingApprovalCount} pending approval${pendingApprovalCount > 1 ? 's' : ''}`}
            >
              <CheckCircle className="h-5 w-5" />
              {pendingApprovalCount > 0 && (
                <span className="absolute -top-1 -right-1 h-5 w-5 bg-orange-500 text-white text-xs font-bold rounded-full flex items-center justify-center animate-pulse">
                  {pendingApprovalCount > 9 ? '9+' : pendingApprovalCount}
                </span>
              )}
            </Link>
          ) : null}

          {/* Staff Alert Dropdown */}
          <div className="relative">
            <button
              onClick={() => setIsAlertOpen(!isAlertOpen)}
              className="relative p-2 rounded-md text-gray-500 hover:bg-gray-100 focus:outline-none focus:ring-2 focus:ring-blue-500 transition-colors"
              title={`${unacknowledgedCount} unacknowledged alert${unacknowledgedCount !== 1 ? 's' : ''}`}
            >
              <AlertTriangle className={`h-5 w-5 ${criticalCount > 0 ? 'text-red-500' : ''}`} />
              {unacknowledgedCount > 0 && (
                <span className="absolute -top-1 -right-1 h-5 w-5 bg-red-500 text-white text-xs font-bold rounded-full flex items-center justify-center animate-pulse">
                  {unacknowledgedCount > 9 ? '9+' : unacknowledgedCount}
                </span>
              )}
            </button>
            <StaffAlertDropdown
              isOpen={isAlertOpen}
              onToggle={() => setIsAlertOpen(!isAlertOpen)}
              alertCenterPath="/frontdesk/alerts"
            />
          </div>

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
            <div className="h-8 w-8 bg-blue-600 rounded-full flex items-center justify-center">
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
