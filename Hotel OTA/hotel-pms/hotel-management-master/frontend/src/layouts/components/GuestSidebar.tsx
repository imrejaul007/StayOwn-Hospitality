import React, { useEffect } from 'react';
import { NavLink, useNavigate } from 'react-router-dom';
import { Home, Calendar, User, MessageSquare, Globe, Star, ConciergeBell, Bell, Key, Users, CreditCard, LogOut, Package, MessageCircle, X, BookOpen, FileText } from 'lucide-react';
import { useAuth } from '../../context/AuthContext';

const navigation = [
  { name: 'Dashboard', href: '/app', icon: Home },
  { name: 'My Bookings', href: '/app/bookings', icon: Calendar },
  { name: 'Billing & Payments', href: '/app/billing', icon: CreditCard },
  { name: 'Loyalty', href: '/app/loyalty', icon: Star },
  { name: 'Hotel Services', href: '/app/services', icon: ConciergeBell },
  { name: 'Service Bookings', href: '/app/services/bookings', icon: BookOpen },
  { name: 'Notifications', href: '/app/notifications', icon: Bell },
  { name: 'Digital Keys', href: '/app/keys', icon: Key },
  { name: 'Meet-Ups', href: '/app/meet-ups', icon: Users },
  { name: 'Profile', href: '/app/profile', icon: User },
  { name: 'Documents', href: '/app/documents', icon: FileText },
  { name: 'Requests', href: '/app/requests', icon: MessageSquare },
  { name: 'Inventory Requests', href: '/app/inventory-requests', icon: Package },
  { name: 'Feedback', href: '/app/feedback', icon: MessageCircle },
];

interface GuestSidebarProps {
  isOpen?: boolean;
  onClose?: () => void;
}

export default function GuestSidebar({ isOpen = false, onClose }: GuestSidebarProps) {
  const { logout, user } = useAuth();
  const navigate = useNavigate();


  const handlePublicWebsiteClick = () => {
    navigate('/', { replace: true });
    onClose?.();
  };

  const handleLogout = () => {
    logout();
    navigate('/', { replace: true });
  };

  const handleNavClick = () => {
    onClose?.();
  };

  // Prevent body scroll when mobile menu is open
  useEffect(() => {
    if (isOpen) {
      document.body.style.overflow = 'hidden';
    } else {
      document.body.style.overflow = 'unset';
    }

    return () => {
      document.body.style.overflow = 'unset';
    };
  }, [isOpen]);

  return (
    <>
      {/* Mobile overlay */}
      {isOpen && (
        <div aria-hidden="true" 
          className="fixed inset-0 bg-black bg-opacity-50 z-40 lg:hidden"
          onClick={onClose}
        />
      )}

      {/* Sidebar */}
      <aside className={`
        fixed lg:static top-0 left-0 z-50 lg:z-auto
        w-64 bg-white shadow-sm border-r border-gray-200 h-screen lg:h-full
        transform ${isOpen ? 'translate-x-0' : '-translate-x-full'} 
        lg:translate-x-0 transition-transform duration-300 ease-in-out
        flex flex-col overflow-hidden
      `}>
        {/* Mobile header with close button */}
        <div className="lg:hidden flex items-center justify-between p-4 border-b border-gray-200">
          <div className="flex items-center space-x-2">
            <div className="h-8 w-8 bg-blue-600 rounded-full flex items-center justify-center">
              <User className="h-4 w-4 text-white" />
            </div>
            <div>
              <p className="text-sm font-medium text-gray-900">{user?.name}</p>
              <p className="text-xs text-gray-500">{user?.loyalty?.tier || 'Guest'} Member</p>
            </div>
          </div>
          <button 
            onClick={onClose}
            className="p-2 rounded-md text-gray-500 hover:bg-gray-100"
            aria-label="Close menu"
          >
            <X className="h-5 w-5" />
          </button>
        </div>

        <nav className="p-4 lg:p-6 flex-1 overflow-y-auto scrollbar-hide">
          {/* Dashboard Navigation */}
          <div className="mb-6">
            <h3 className="text-xs font-semibold text-gray-500 uppercase tracking-wider mb-3">
              Dashboard
            </h3>
            <ul className="space-y-1 lg:space-y-2">
              {navigation.map((item) => (
                <li key={item.name}>
                  <NavLink
                    to={item.href}
                    end={item.href === '/app' || item.href === '/app/services'}
                    onClick={handleNavClick}
                    className={({ isActive }) =>
                      `flex items-center space-x-3 px-3 lg:px-4 py-2 lg:py-3 rounded-lg text-sm font-medium transition-colors ${
                        isActive
                          ? 'bg-blue-50 text-blue-700'
                          : 'text-gray-700 hover:bg-gray-100'
                      }`
                    }
                  >
                    <item.icon className="h-5 w-5" />
                    <span>{item.name}</span>
                  </NavLink>
                </li>
              ))}
            </ul>
          </div>

          {/* Public Website Navigation */}
          <div className="pt-4 border-t border-gray-200">
            <h3 className="text-xs font-semibold text-gray-500 uppercase tracking-wider mb-3">
              Actions
            </h3>
            <ul className="space-y-1 lg:space-y-2">
              <li>
                <button
                  onClick={handlePublicWebsiteClick}
                  className="flex items-center space-x-3 px-3 lg:px-4 py-2 lg:py-3 rounded-lg text-sm font-medium text-gray-700 hover:bg-gray-100 transition-colors w-full text-left"
                >
                  <Globe className="h-5 w-5" />
                  <span>Public Website</span>
                </button>
              </li>
              <li>
                <button
                  onClick={handleLogout}
                  className="flex items-center space-x-3 px-3 lg:px-4 py-2 lg:py-3 rounded-lg text-sm font-medium text-gray-700 hover:bg-gray-100 transition-colors w-full text-left"
                >
                  <LogOut className="h-5 w-5" />
                  <span>Logout</span>
                </button>
              </li>
            </ul>
          </div>
        </nav>
      </aside>
    </>
  );
}