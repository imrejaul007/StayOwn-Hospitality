import React, { useState } from 'react';
import { Card } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { useDashboardCounts } from '@/hooks/useDashboardCounts';
import {
  ChevronLeft,
  ChevronRight,
  Home,
  Calendar,
  Users,
  Bed,
  Settings,
  BarChart3,
  FileText,
  IndianRupee,
  UserCheck,
  AlertTriangle,
  Clock,
  CheckCircle,
  Star,
  Crown,
  Coffee
} from 'lucide-react';

interface MenuItem {
  id: string;
  label: string;
  icon: React.ReactNode;
  badge?: string;
  badgeVariant?: 'default' | 'secondary' | 'destructive' | 'outline';
  submenu?: MenuItem[];
  onClick?: () => void;
}

interface CollapsibleSidebarProps {
  isCollapsed: boolean;
  onToggle: () => void;
  className?: string;
  children?: React.ReactNode;
}

const CollapsibleSidebar: React.FC<CollapsibleSidebarProps> = ({
  isCollapsed,
  onToggle,
  className = '',
  children
}) => {
  const [expandedMenus, setExpandedMenus] = useState<Set<string>>(new Set());
  const { counts, loading, error } = useDashboardCounts();

  const toggleSubmenu = (menuId: string) => {
    const newExpanded = new Set(expandedMenus);
    if (newExpanded.has(menuId)) {
      newExpanded.delete(menuId);
    } else {
      newExpanded.add(menuId);
    }
    setExpandedMenus(newExpanded);
  };

  const menuItems: MenuItem[] = [
    {
      id: 'dashboard',
      label: 'Dashboard',
      icon: <Home className="w-4 h-4" />,
      onClick: () => {}
    },
    {
      id: 'frontdesk',
      label: 'Front Desk',
      icon: <UserCheck className="w-4 h-4" />,
      badge: counts?.frontDesk.total.toString() || '0',
      badgeVariant: (counts?.frontDesk.total || 0) > 0 ? 'destructive' : 'secondary',
      submenu: [
        {
          id: 'checkin',
          label: 'Check-in',
          icon: <UserCheck className="w-3 h-3" />,
          badge: counts?.frontDesk.checkIn.toString() || '0',
          onClick: () => {}
        },
        {
          id: 'checkout',
          label: 'Check-out',
          icon: <UserCheck className="w-3 h-3" />,
          badge: counts?.frontDesk.checkOut.toString() || '0',
          onClick: () => {}
        }
      ]
    },
    {
      id: 'reservations',
      label: 'Reservations',
      icon: <Calendar className="w-4 h-4" />,
      badge: counts?.reservations.total.toString() || '0',
      submenu: [
        {
          id: 'confirmed',
          label: 'Confirmed',
          icon: <CheckCircle className="w-3 h-3" />,
          badge: counts?.reservations.confirmed.toString() || '0',
          onClick: () => {}
        },
        {
          id: 'pending',
          label: 'Pending',
          icon: <Clock className="w-3 h-3" />,
          badge: counts?.reservations.pending.toString() || '0',
          onClick: () => {}
        }
      ]
    },
    {
      id: 'housekeeping',
      label: 'Housekeeping',
      icon: <Bed className="w-4 h-4" />,
      badge: counts?.housekeeping.total.toString() || '0',
      badgeVariant: 'secondary',
      submenu: [
        {
          id: 'dirty-rooms',
          label: 'Dirty Rooms',
          icon: <AlertTriangle className="w-3 h-3" />,
          badge: counts?.housekeeping.dirty.toString() || '0',
          badgeVariant: (counts?.housekeeping.dirty || 0) > 0 ? 'destructive' : 'secondary',
          onClick: () => {}
        },
        {
          id: 'maintenance',
          label: 'Maintenance',
          icon: <AlertTriangle className="w-3 h-3" />,
          badge: counts?.housekeeping.maintenance.toString() || '0',
          badgeVariant: (counts?.housekeeping.maintenance || 0) > 0 ? 'destructive' : 'secondary',
          onClick: () => {}
        }
      ]
    },
    {
      id: 'guests',
      label: 'Guest Services',
      icon: <Users className="w-4 h-4" />,
      badge: counts?.guestServices.total.toString() || '0',
      submenu: [
        {
          id: 'vip-guests',
          label: 'VIP Guests',
          icon: <Star className="w-3 h-3" />,
          badge: counts?.guestServices.vipGuests.toString() || '0',
          onClick: () => {}
        },
        {
          id: 'corporate',
          label: 'Corporate',
          icon: <Coffee className="w-3 h-3" />,
          badge: counts?.guestServices.corporate.toString() || '0',
          onClick: () => {}
        }
      ]
    },
    {
      id: 'reports',
      label: 'Reports',
      icon: <BarChart3 className="w-4 h-4" />,
      submenu: [
        {
          id: 'occupancy',
          label: 'Occupancy',
          icon: <BarChart3 className="w-3 h-3" />,
          onClick: () => {}
        },
        {
          id: 'revenue',
          label: 'Revenue',
          icon: <IndianRupee className="w-3 h-3" />,
          onClick: () => {}
        },
        {
          id: 'guest-history',
          label: 'Guest History',
          icon: <FileText className="w-3 h-3" />,
          onClick: () => {}
        }
      ]
    },
    {
      id: 'settings',
      label: 'Settings',
      icon: <Settings className="w-4 h-4" />,
      onClick: () => {}
    }
  ];

  const renderMenuItem = (item: MenuItem, level = 0) => {
    const hasSubmenu = item.submenu && item.submenu.length > 0;
    const isExpanded = expandedMenus.has(item.id);
    const paddingLeft = level === 0 ? 'pl-3' : 'pl-8';

    return (
      <div key={item.id} className="w-full">
        <Button
          variant="ghost"
          className={`
            w-full justify-start ${paddingLeft} py-2 h-auto
            hover:bg-gray-100 transition-colors
            ${isCollapsed && level === 0 ? 'px-2' : ''}
          `}
          onClick={() => {
            if (hasSubmenu) {
              toggleSubmenu(item.id);
            } else if (item.onClick) {
              item.onClick();
            }
          }}
        >
          <div className="flex items-center justify-between w-full">
            <div className="flex items-center gap-2">
              {item.icon}
              {!isCollapsed && (
                <span className="text-sm font-medium">{item.label}</span>
              )}
            </div>
            
            {!isCollapsed && (
              <div className="flex items-center gap-1">
                {item.badge && (
                  <Badge 
                    variant={item.badgeVariant || 'default'} 
                    className="text-xs px-1.5 py-0.5"
                  >
                    {item.badge}
                  </Badge>
                )}
                {hasSubmenu && (
                  <ChevronRight 
                    className={`w-3 h-3 transition-transform ${
                      isExpanded ? 'rotate-90' : ''
                    }`} 
                  />
                )}
              </div>
            )}
          </div>
        </Button>
        
        {hasSubmenu && isExpanded && !isCollapsed && (
          <div className="ml-2 border-l border-gray-200">
            {item.submenu?.map(subItem => renderMenuItem(subItem, level + 1))}
          </div>
        )}
      </div>
    );
  };

  return (
    <Card className={`
      relative transition-all duration-300 ease-in-out
      ${isCollapsed ? 'w-16' : 'w-64'} 
      ${className}
    `}>
      <div className="p-2">
        {/* Toggle button */}
        <div className="flex justify-end mb-3">
          <Button
            variant="ghost"
            size="sm"
            onClick={onToggle}
            className="p-1"
          >
            {isCollapsed ? <ChevronRight className="w-4 h-4" /> : <ChevronLeft className="w-4 h-4" />}
          </Button>
        </div>
        
        {/* Menu items */}
        <div className="space-y-1">
          {menuItems.map(item => renderMenuItem(item))}
        </div>
        
        {/* Custom content */}
        {children && !isCollapsed && (
          <div className="mt-4 pt-4 border-t border-gray-200">
            {children}
          </div>
        )}
      </div>
    </Card>
  );
};

export default CollapsibleSidebar;