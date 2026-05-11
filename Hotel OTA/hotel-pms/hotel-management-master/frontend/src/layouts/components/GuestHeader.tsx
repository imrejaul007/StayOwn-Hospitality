import React, { useState } from 'react';
import { User, Menu } from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../../context/AuthContext';
import { Button } from '../../components/ui/button';
import { useNotificationStream } from '../../hooks/useNotifications';
import NotificationDropdown from '../../components/notifications/NotificationDropdown';
import SettingsDropdown from '../../components/settings/SettingsDropdown';

interface GuestHeaderProps {
  onMenuToggle?: () => void;
}

export default function GuestHeader({ onMenuToggle }: GuestHeaderProps) {
  const { user, logout } = useAuth();
  const navigate = useNavigate();
  const [isNotificationOpen, setIsNotificationOpen] = useState(false);
  const [isSettingsOpen, setIsSettingsOpen] = useState(false);

  // Connect to notification stream
  useNotificationStream();

  const handleLogout = async () => {
    await logout();
    navigate('/', { replace: true });
  };


  return (
    <header className="bg-white shadow-sm border-b border-gray-200 px-4 sm:px-6 lg:px-8 py-4">
      <div className="flex justify-between items-center">
        <div className="flex items-center">
          {/* Mobile menu button */}
          <button 
            onClick={onMenuToggle}
            className="lg:hidden p-2 rounded-md text-gray-500 hover:bg-gray-100 mr-3"
            aria-label="Open menu"
          >
            <Menu className="h-6 w-6" />
          </button>
          
          <h1 className="text-lg sm:text-xl lg:text-2xl font-bold text-gray-900">
            <span className="hidden sm:inline">
              {user?.role === 'travel_agent' ? 'THE PENTOUZ Travel Agent Portal' : 'THE PENTOUZ Portal'}
            </span>
            <span className="sm:hidden">
              {user?.role === 'travel_agent' ? 'TA Portal' : 'PENTOUZ'}
            </span>
          </h1>
        </div>
        
        <div className="flex items-center space-x-2 sm:space-x-4">
          {/* Notification Dropdown */}
          <div className="relative">
            <NotificationDropdown
              isOpen={isNotificationOpen}
              onToggle={() => {
                setIsNotificationOpen(prev => !prev);
                setIsSettingsOpen(false);
              }}
            />
          </div>

          {/* Settings Dropdown */}
          <div className="relative">
            <SettingsDropdown
              isOpen={isSettingsOpen}
              onToggle={() => {
                setIsSettingsOpen(prev => !prev);
                setIsNotificationOpen(false);
              }}
            />
          </div>

          <div className="hidden sm:flex items-center space-x-3">
            <div className="text-right">
              <p className="text-sm font-medium text-gray-900">{user?.name}</p>
              <p className="text-xs text-gray-500">
                {user?.role === 'travel_agent' ? 'Travel Agent' : `${user?.loyalty?.tier || 'Guest'} Member`}
              </p>
            </div>
          </div>
          
          <div className="h-8 w-8 bg-blue-600 rounded-full flex items-center justify-center">
            <User className="h-4 w-4 text-white" />
          </div>
          
          <Button
            variant="ghost"
            size="sm"
            onClick={handleLogout}
            className="hidden sm:block"
          >
            Logout
          </Button>
        </div>
      </div>
    </header>
  );
}