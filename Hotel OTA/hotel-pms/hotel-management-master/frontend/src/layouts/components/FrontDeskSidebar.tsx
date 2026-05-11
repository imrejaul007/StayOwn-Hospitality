import React from 'react';
import { NavLink } from 'react-router-dom';
import {
  Home,
  Bell,
  Bed,
  Calendar,
  Users,
  Package,
  Wifi,
  ClipboardList,
  CreditCard,
  Wrench,
  Headphones,
  FileText,
  UserCheck,
  Grid3X3,
  Zap,
  CheckSquare,
  Receipt,
  Plane,
  ChevronLeft,
  ChevronRight,
  X,
  ConciergeBell,
  Coffee,
  ShoppingBag,
  MessageSquare,
  CalendarDays,
  Layers,
  CheckCircle,
  Key,
  Moon,
  Search,
  Settings,
  BarChart3,
} from 'lucide-react';

const navigation = [
  { name: 'Dashboard', href: '/frontdesk', icon: Home },
  { name: 'Alert Center', href: '/frontdesk/alerts', icon: Bell },
  { name: 'Tape Chart', href: '/frontdesk/tape-chart', icon: Grid3X3 },
  { name: 'Rooms', href: '/frontdesk/rooms', icon: Bed },
  { name: 'Room Types', href: '/frontdesk/room-types', icon: Layers },
  { name: 'Bookings', href: '/frontdesk/bookings', icon: Calendar },
  { name: 'Digital Keys', href: '/frontdesk/digital-keys', icon: Key },
  { name: 'Upcoming Arrivals', href: '/frontdesk/upcoming-bookings', icon: CalendarDays },
  { name: 'Corporate', href: '/frontdesk/corporate', icon: Users },
  { name: 'Travel Agents', href: '/frontdesk/travel-agents', icon: Plane },
  { name: 'Staff Management', href: '/frontdesk/staff', icon: UserCheck },
  { name: 'Billing & Payment', href: '/frontdesk/billing', icon: CreditCard },
  { name: 'Booking Engine', href: '/frontdesk/booking-engine', icon: Zap },
  { name: 'Housekeeping', href: '/frontdesk/housekeeping', icon: ClipboardList },
  { name: 'Daily Check Management', href: '/frontdesk/daily-check-management', icon: CheckSquare },
  { name: 'Maintenance', href: '/frontdesk/maintenance', icon: Wrench },
  { name: 'Guest Service', href: '/frontdesk/guest-services', icon: Headphones },
  { name: 'Service Request', href: '/frontdesk/service-requests', icon: MessageSquare },
  { name: 'Inventory Request', href: '/frontdesk/inventory-requests', icon: ShoppingBag },
  { name: 'Hotel Service', href: '/frontdesk/hotel-services', icon: ConciergeBell },
  { name: 'Meet Up Management', href: '/frontdesk/meet-up-management', icon: Coffee },
  { name: 'Supply', href: '/frontdesk/supply-requests', icon: FileText },
  { name: 'Inventory', href: '/frontdesk/inventory', icon: Package },
  { name: 'Checkout', href: '/frontdesk/checkout', icon: Receipt },
  { name: 'Inventory Automation', href: '/frontdesk/inventory-automation', icon: Zap },
  { name: 'My Approval Requests', href: '/frontdesk/my-approvals', icon: CheckCircle },
  { name: 'Night Audit', href: '/frontdesk/night-audit', icon: Moon },
  { name: 'Lost & Found', href: '/frontdesk/lost-found', icon: Search },
  { name: 'Hotel Settings', href: '/frontdesk/settings', icon: Settings },
  { name: 'Reports', href: '/frontdesk/reports', icon: BarChart3 },
  { name: 'Notifications', href: '/frontdesk/notifications', icon: Bell },
];

interface FrontDeskSidebarProps {
  isOpen?: boolean;
  isCollapsed?: boolean;
  onClose?: () => void;
  onToggle?: () => void;
}

export default function FrontDeskSidebar({ isOpen = true, isCollapsed = false, onClose, onToggle }: FrontDeskSidebarProps) {
  return (
    <>
      {/* Mobile overlay */}
      {isOpen && (
        <div aria-hidden="true"
          className="lg:hidden fixed inset-0 z-40 bg-black bg-opacity-50 transition-opacity"
          onClick={onClose}
        />
      )}

      {/* Sidebar */}
      <aside className={`
        fixed lg:relative inset-y-0 left-0 z-50
        bg-white shadow-lg lg:shadow-sm border-r border-gray-200
        transform transition-all duration-300 ease-in-out
        lg:translate-x-0 lg:min-h-full
        ${isOpen ? 'translate-x-0' : '-translate-x-full'}
        ${isCollapsed ? 'lg:w-16' : 'lg:w-64'}
        w-64
      `}>
        {/* Mobile close button */}
        <div className="lg:hidden flex items-center justify-between p-4 border-b">
          <h2 className="text-lg font-semibold text-gray-900">Menu</h2>
          <button aria-label="Close"
            onClick={onClose}
            className="p-2 rounded-md text-gray-400 hover:text-gray-500 hover:bg-gray-100"
          >
            <X className="h-5 w-5" />
          </button>
        </div>

        {/* Desktop toggle button */}
        <div className="hidden lg:block sticky top-0 bg-white border-b border-gray-200 z-10">
          <button aria-label="Toggle"
            onClick={onToggle}
            className={`w-full p-3 text-gray-400 hover:text-gray-600 hover:bg-gray-50 transition-colors ${
              isCollapsed ? 'flex justify-center' : 'flex justify-end'
            }`}
            title={isCollapsed ? 'Expand sidebar' : 'Collapse sidebar'}
          >
            {isCollapsed ? (
              <ChevronRight className="h-5 w-5" />
            ) : (
              <ChevronLeft className="h-5 w-5" />
            )}
          </button>
        </div>

        {/* Navigation */}
        <nav className="flex-1 overflow-y-auto px-2 py-4 space-y-1">
          {navigation.map((item) => (
            <NavLink
              key={item.name}
              to={item.href}
              onClick={() => onClose?.()}
              className={({ isActive }) =>
                `flex items-center px-3 py-2 rounded-lg text-sm font-medium transition-all duration-200 ${
                  isActive
                    ? 'bg-blue-50 text-blue-700 border-l-4 border-blue-700'
                    : 'text-gray-700 hover:bg-gray-100 hover:text-gray-900 border-l-4 border-transparent'
                } ${isCollapsed ? 'justify-center' : ''}`
              }
              title={isCollapsed ? item.name : undefined}
            >
              <item.icon className={`h-5 w-5 flex-shrink-0 ${isCollapsed ? '' : 'mr-3'}`} />
              {!isCollapsed && <span className="truncate">{item.name}</span>}
            </NavLink>
          ))}
        </nav>

        {/* Footer info when expanded */}
        {!isCollapsed && (
          <div className="border-t border-gray-200 p-4">
            <div className="flex items-center space-x-3">
              <div className="h-10 w-10 rounded-full bg-gradient-to-br from-blue-400 to-blue-600 flex items-center justify-center">
                <Headphones className="h-5 w-5 text-white" />
              </div>
              <div className="flex-1 min-w-0">
                <p className="text-sm font-semibold text-gray-900 truncate">
                  Front Desk
                </p>
                <p className="text-xs text-gray-500 truncate">
                  Service Dashboard
                </p>
              </div>
            </div>
          </div>
        )}
      </aside>
    </>
  );
}
