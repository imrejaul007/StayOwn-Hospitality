import React, { useState } from 'react';
import { Outlet } from 'react-router-dom';
import GuestHeader from './components/GuestHeader';
import GuestSidebar from './components/GuestSidebar';

export default function GuestLayout() {
  const [isMobileMenuOpen, setIsMobileMenuOpen] = useState(false);

  const toggleMobileMenu = () => {
    setIsMobileMenuOpen(!isMobileMenuOpen);
  };

  const closeMobileMenu = () => {
    setIsMobileMenuOpen(false);
  };

  return (
    <div className="h-screen bg-gray-50 overflow-hidden flex flex-col">
      <GuestHeader onMenuToggle={toggleMobileMenu} />
      <div className="flex flex-1 overflow-hidden">
        <GuestSidebar isOpen={isMobileMenuOpen} onClose={closeMobileMenu} />
        <main className="flex-1 overflow-y-auto overflow-x-hidden">
          <div className="p-4 sm:p-6 lg:p-8 max-w-full">
            <Outlet />
          </div>
        </main>
      </div>
    </div>
  );
}