import React, { useState, useEffect, useRef } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  Settings,
  User,
  Bell,
  Palette,
  Shield,
  Globe,
  Building,
  X,
  ChevronRight
} from 'lucide-react';
import { useAuth } from '../../context/AuthContext';
import { Button } from '../ui/button';

interface SettingsDropdownProps {
  isOpen: boolean;
  onToggle: () => void;
}

export default function SettingsDropdown({ isOpen, onToggle }: SettingsDropdownProps) {
  const dropdownRef = useRef<HTMLDivElement>(null);
  const navigate = useNavigate();
  const { user } = useAuth();

  // Close dropdown when clicking outside
  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (dropdownRef.current && !dropdownRef.current.contains(event.target as Node)) {
        onToggle();
      }
    };

    if (isOpen) {
      document.addEventListener('mousedown', handleClickOutside);
    }

    return () => {
      document.removeEventListener('mousedown', handleClickOutside);
    };
  }, [isOpen, onToggle]);

  const getSettingsMenuItems = () => {
    const baseUrl = user?.role === 'admin' || user?.role === 'manager' ? '/admin' :
                   user?.role === 'staff' ? '/staff' :
                   user?.role === 'frontdesk' ? '/frontdesk' :
                   user?.role === 'travel_agent' ? '/travel-agent' : '/app';

    const commonItems = [
      {
        icon: User,
        label: 'Profile Settings',
        description: 'Update your personal information',
        href: `${baseUrl}/settings/profile`
      },
      {
        icon: Bell,
        label: 'Notifications',
        description: 'Manage notification preferences',
        href: `${baseUrl}/settings/notifications`
      },
      {
        icon: Palette,
        label: 'Display',
        description: 'Theme, language, and display options',
        href: `${baseUrl}/settings/display`
      }
    ];

    // Role-specific items
    if (user?.role === 'admin' || user?.role === 'manager') {
      return [
        ...commonItems,
        {
          icon: Building,
          label: 'Hotel Settings',
          description: 'Configure hotel policies and details',
          href: '/admin/settings/hotel'
        },
        {
          icon: Shield,
          label: 'System Settings',
          description: 'Security, integrations, and system config',
          href: '/admin/settings/system'
        },
        {
          icon: Globe,
          label: 'Integrations',
          description: 'Payment gateways and third-party services',
          href: '/admin/settings/integrations'
        }
      ];
    }

    if (user?.role === 'staff') {
      return [
        ...commonItems,
        {
          icon: Shield,
          label: 'Availability',
          description: 'Set your work status and availability',
          href: '/staff/settings/availability'
        }
      ];
    }

    if (user?.role === 'guest') {
      return [
        {
          icon: User,
          label: 'Profile Settings',
          description: 'Update your personal information',
          href: '/app/settings/profile'
        },
        {
          icon: Bell,
          label: 'Preferences',
          description: 'Manage your stay preferences',
          href: '/app/settings/preferences'
        },
        {
          icon: Shield,
          label: 'Privacy',
          description: 'Privacy and data settings',
          href: '/app/settings/privacy'
        }
      ];
    }

    if (user?.role === 'travel_agent') {
      return [
        {
          icon: User,
          label: 'Profile Settings',
          description: 'Update your personal information',
          href: '/travel-agent/profile/edit'
        },
        {
          icon: Palette,
          label: 'Settings',
          description: 'Manage your account settings',
          href: '/travel-agent/settings'
        }
      ];
    }

    // Fallback for other roles
    return commonItems;
  };

  const handleMenuItemClick = (href: string) => {
    navigate(href);
    onToggle();
  };

  const menuItems = getSettingsMenuItems();

  return (
    <div className="relative">
      {/* Settings Icon Trigger */}
      <button aria-label="Settings"
        onClick={onToggle}
        className="p-2 rounded-md text-gray-500 hover:bg-gray-100 focus:outline-none focus:ring-2 focus:ring-blue-500 relative"
        title="Settings"
      >
        <Settings className="h-5 w-5" />
      </button>

      {/* Dropdown Panel */}
      {isOpen && (
        <div
          ref={dropdownRef}
          className="absolute right-0 top-2 z-50 w-80 bg-white rounded-lg shadow-xl border border-gray-200 overflow-hidden"
        >
          {/* Header */}
          <div className="px-4 py-3 border-b border-gray-200 flex items-center justify-between">
            <div className="flex items-center space-x-2">
              <Settings className="h-5 w-5 text-gray-600" />
              <h3 className="text-sm font-semibold text-gray-900">Settings</h3>
            </div>
            <Button variant="ghost" size="sm" onClick={onToggle}>
              <X className="h-4 w-4" />
            </Button>
          </div>

          {/* Menu Items */}
          <div className="py-2">
            {menuItems.map((item, index) => (
              <button aria-label={item.label}
                key={`menuItems-${index}-${item.label}`}
                onClick={() => handleMenuItemClick(item.href)}
                className="w-full px-4 py-3 text-left hover:bg-gray-50 transition-colors flex items-center space-x-3"
              >
                <div className="flex-shrink-0">
                  <item.icon className="h-5 w-5 text-gray-600" />
                </div>
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-medium text-gray-900">
                    {item.label}
                  </p>
                  <p className="text-xs text-gray-500 line-clamp-1">
                    {item.description}
                  </p>
                </div>
                <div className="flex-shrink-0">
                  <ChevronRight className="h-4 w-4 text-gray-400" />
                </div>
              </button>
            ))}
          </div>

          {/* Footer */}
          <div className="px-4 py-3 bg-gray-50 border-t border-gray-200">
            <div className="flex items-center space-x-2 text-xs text-gray-500">
              <User className="h-3 w-3" />
              <span>Logged in as {user?.name}</span>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}