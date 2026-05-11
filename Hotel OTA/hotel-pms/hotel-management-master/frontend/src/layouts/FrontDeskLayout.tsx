import React, { useState } from 'react';
import { Outlet } from 'react-router-dom';
import FrontDeskHeader from './components/FrontDeskHeader';
import FrontDeskSidebar from './components/FrontDeskSidebar';
import { PropertyProvider } from '../context/PropertyContext';

export default function FrontDeskLayout() {
  // Mobile sidebar state
  const [mobileSidebarOpen, setMobileSidebarOpen] = useState(false);

  // Desktop sidebar state - collapsed by default for more space
  const [desktopSidebarCollapsed, setDesktopSidebarCollapsed] = useState(true);

  return (
    <PropertyProvider>
      <div className="min-h-screen bg-gray-50 flex flex-col">
        <FrontDeskHeader
          onMenuClick={() => setMobileSidebarOpen(true)}
          onSidebarToggle={() => setDesktopSidebarCollapsed(!desktopSidebarCollapsed)}
          isSidebarCollapsed={desktopSidebarCollapsed}
        />
        <div className="flex flex-1 relative">
          <FrontDeskSidebar
            isOpen={mobileSidebarOpen}
            isCollapsed={desktopSidebarCollapsed}
            onClose={() => setMobileSidebarOpen(false)}
            onToggle={() => setDesktopSidebarCollapsed(!desktopSidebarCollapsed)}
          />
          <main className="flex-1 min-w-0 transition-all duration-300 ease-in-out p-4 sm:p-6">
            <Outlet />
          </main>
        </div>
      </div>
    </PropertyProvider>
  );
}
