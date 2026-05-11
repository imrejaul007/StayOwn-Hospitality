import React, { useState } from 'react';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Card, CardContent } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import {
  BarChart3,
  Bed,
  Building2,
  Calendar,
  Settings,
  Users,
  AlertCircle,
  Activity,
  TrendingUp,
  ChevronUp,
  ChevronDown,
  Menu
} from 'lucide-react';
import { useProperty } from '../../context/PropertyContext';
import { PropertyBreadcrumb } from '../../components/common/PropertyBreadcrumb';
import TapeChartView from '../../components/tapechart/TapeChartView';
import RoomBlocks from '../../components/tapechart/RoomBlocks';
import AdvancedReservations from '../../components/tapechart/AdvancedReservations';
import AssignmentRules from '../../components/tapechart/AssignmentRules';
import TapeChartDashboard from '../../components/tapechart/TapeChartDashboard';
import { WaitingListManager } from '../../components/reservations/WaitingListManager';
import { withErrorBoundary } from '../../components/ErrorBoundary';

const AdminTapeChart: React.FC = () => {
  const [activeTab, setActiveTab] = useState('tapechart');
  const [isNavigationCollapsed, setIsNavigationCollapsed] = useState(true);
  const { selectedPropertyId } = useProperty();

  const tabConfig = [
    {
      value: 'dashboard',
      label: 'Dashboard',
      icon: BarChart3,
      description: 'Real-time overview',
      color: 'bg-blue-500',
      activeColor: 'bg-blue-600 text-white border-blue-600 shadow-lg',
      notifications: 0
    },
    {
      value: 'tapechart',
      label: 'Tape Chart',
      icon: Bed,
      description: 'Room assignments',
      color: 'bg-green-500',
      activeColor: 'bg-green-600 text-white border-green-600 shadow-lg',
      notifications: 0
    },
    {
      value: 'blocks',
      label: 'Room Blocks',
      icon: Building2,
      description: 'Group bookings',
      color: 'bg-purple-500',
      activeColor: 'bg-purple-600 text-white border-purple-600 shadow-lg',
      notifications: 0
    },
    {
      value: 'reservations',
      label: 'Reservations',
      icon: Calendar,
      description: 'Advanced management',
      color: 'bg-orange-500',
      activeColor: 'bg-orange-600 text-white border-orange-600 shadow-lg',
      notifications: 0
    },
    {
      value: 'rules',
      label: 'Assignment Rules',
      icon: Settings,
      description: 'Auto assignment',
      color: 'bg-gray-500',
      activeColor: 'bg-gray-600 text-white border-gray-600 shadow-lg',
      notifications: 0
    },
    {
      value: 'waitlist',
      label: 'Waitlist',
      icon: Users,
      description: 'Guest queue',
      color: 'bg-red-500',
      activeColor: 'bg-red-600 text-white border-red-600 shadow-lg',
      notifications: 0
    }
  ];

  // Show message if no property is selected
  if (!selectedPropertyId) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-gray-50 to-gray-100">
        <div className="p-6 max-w-7xl mx-auto">
          <PropertyBreadcrumb items={['Tape Chart']} />
          <div className="text-center py-12">
            <div className="text-gray-500 mb-4">
              <svg className="w-16 h-16 mx-auto" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 17V7m0 10a2 2 0 01-2 2H5a2 2 0 01-2-2V7a2 2 0 012-2h2a2 2 0 012 2m0 10a2 2 0 002 2h2a2 2 0 002-2M9 7a2 2 0 012-2h2a2 2 0 012 2m0 10V7m0 10a2 2 0 002 2h2a2 2 0 002-2V7a2 2 0 00-2-2h-2a2 2 0 00-2 2" />
              </svg>
            </div>
            <h3 className="text-lg font-medium text-gray-900 mb-2">No Property Selected</h3>
            <p className="text-gray-500">Please select a property to view the tape chart.</p>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-gray-50 to-gray-100">
      {/* Breadcrumb - placed at the top */}
      <div className="bg-white border-b">
        <div className="px-4 lg:px-6 py-2">
          <PropertyBreadcrumb items={['Tape Chart']} />
        </div>
      </div>

      {/* Compact Header */}
      <div className="bg-white border-b shadow-sm">
        <div className="px-4 lg:px-6 py-2">
          <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-2">
            <div className="flex items-center gap-4">
              <div>
                <h1 className="text-lg lg:text-xl font-bold text-gray-900">Tape Chart Management</h1>
              </div>

              {/* Navigation Toggle Button */}
              <Button
                variant="outline"
                size="sm"
                onClick={() => setIsNavigationCollapsed(!isNavigationCollapsed)}
                className="flex items-center gap-2 text-xs"
                title={isNavigationCollapsed ? 'Show navigation tabs' : 'Hide navigation tabs'}
              >
                <Menu className="w-4 h-4" />
                {isNavigationCollapsed ? (
                  <>
                    <ChevronDown className="w-3 h-3" />
                    <span>Show Tabs</span>
                  </>
                ) : (
                  <>
                    <ChevronUp className="w-3 h-3" />
                    <span>Hide Tabs</span>
                  </>
                )}
              </Button>
            </div>

            <div className="flex items-center gap-4">
              {/* Compact current tab indicator when collapsed */}
              {isNavigationCollapsed && (
                <div className="flex items-center gap-2 px-3 py-1 bg-blue-50 rounded-md border border-blue-200">
                  {(() => {
                    const currentTab = tabConfig.find(tab => tab.value === activeTab);
                    const Icon = currentTab?.icon || Bed;
                    return (
                      <>
                        <Icon className="w-4 h-4 text-blue-600" />
                        <span className="text-sm font-medium text-blue-800">{currentTab?.label}</span>
                      </>
                    );
                  })()}
                </div>
              )}

              <div className="flex items-center gap-2 text-sm text-gray-500">
                <Activity className="w-4 h-4" />
                <span>Live Updates</span>
                <div className="w-2 h-2 bg-green-500 rounded-full animate-pulse"></div>
              </div>
            </div>
          </div>
        </div>
      </div>

      <Tabs value={activeTab} onValueChange={setActiveTab} className="w-full">
        {/* Collapsible Tab Navigation */}
        <div
          className={`
            bg-white border-b shadow-sm transition-all duration-300 ease-in-out overflow-hidden
            ${isNavigationCollapsed ? 'max-h-0 border-b-0' : 'max-h-[200px]'}
          `}
        >
          <div className="px-4 lg:px-6 py-2">
            {/* Mobile responsive tabs with horizontal scroll */}
            <div className="flex overflow-x-auto scrollbar-hide gap-2 md:grid md:grid-cols-6 md:gap-0">
              {tabConfig.map((tab) => {
                const Icon = tab.icon;
                const isActive = activeTab === tab.value;

                return (
                  <TabsTrigger
                    key={tab.value}
                    value={tab.value}
                    className={`
                      relative flex flex-col items-center justify-center p-3 sm:p-4 text-xs sm:text-sm
                      transition-all duration-300 ease-in-out rounded-md border-2 border-transparent
                      min-w-[120px] md:min-w-0 whitespace-nowrap
                      hover:bg-gray-100 hover:shadow-md
                      ${isActive
                        ? '!bg-blue-100 !text-blue-800 border-blue-200 shadow-lg transform scale-105 font-semibold'
                        : '!text-gray-800 hover:!text-gray-900 !bg-white hover:!bg-gray-50 border-gray-200'
                      }
                    `}
                  >
                    <div className="flex items-center justify-center mb-1 relative">
                      <Icon className={`w-4 h-4 sm:w-5 sm:h-5 ${isActive ? '!text-blue-800' : '!text-gray-600'}`} />
                      {tab.notifications > 0 && (
                        <Badge
                          variant="destructive"
                          className="absolute -top-2 -right-2 h-5 w-5 text-xs p-0 flex items-center justify-center animate-pulse"
                        >
                          {tab.notifications}
                        </Badge>
                      )}
                    </div>
                    <span className={`font-medium text-center leading-tight ${isActive ? '!text-blue-800' : '!text-gray-800'}`}>{tab.label}</span>
                    <span className={`text-xs mt-1 ${isActive ? '!text-blue-700' : '!text-gray-500'}`}>
                      {tab.description}
                    </span>
                  </TabsTrigger>
                );
              })}
            </div>
          </div>
        </div>

        {/* Quick Tab Switcher (when navigation is collapsed) */}
        {isNavigationCollapsed && (
          <div className="bg-gray-50 border-b border-gray-200 px-4 py-2">
            <div className="flex items-center gap-2 overflow-x-auto scrollbar-hide">
              <span className="text-xs text-gray-500 whitespace-nowrap mr-2">Quick switch:</span>
              {tabConfig.map((tab) => {
                const Icon = tab.icon;
                const isActive = activeTab === tab.value;

                return (
                  <button aria-label="Notifications"
                    key={tab.value}
                    onClick={() => setActiveTab(tab.value)}
                    className={`
                      flex items-center gap-1 px-2 py-1 text-xs rounded-md transition-all duration-200
                      whitespace-nowrap min-w-fit
                      ${isActive
                        ? 'bg-blue-100 text-blue-800 border border-blue-200'
                        : 'bg-white text-gray-600 border border-gray-200 hover:bg-gray-100'
                      }
                    `}
                    title={tab.label}
                  >
                    <Icon className="w-3 h-3" />
                    <span>{tab.label}</span>
                    {tab.notifications > 0 && (
                      <Badge variant="destructive" className="h-4 w-4 text-xs p-0 flex items-center justify-center">
                        {tab.notifications}
                      </Badge>
                    )}
                  </button>
                );
              })}
            </div>
          </div>
        )}

        {/* Enhanced Tab Content with smooth transitions */}
        <div className="flex-1 overflow-hidden">
          <TabsContent value="dashboard" className="m-0 h-full">
            <div className="animate-in fade-in-50 duration-300">
              <TapeChartDashboard />
            </div>
          </TabsContent>

          <TabsContent value="tapechart" className="m-0 h-full">
            <div className="animate-in fade-in-50 duration-300">
              <Card className="m-1 border-0 shadow-lg">
                <CardContent className="p-0">
                  <TapeChartView />
                </CardContent>
              </Card>
            </div>
          </TabsContent>

          <TabsContent value="blocks" className="m-0 h-full">
            <div className="animate-in fade-in-50 duration-300">
              <Card className="m-4 lg:m-6 border-0 shadow-lg">
                <CardContent className="p-6">
                  <div className="flex items-center gap-3 mb-6">
                    <div className="w-3 h-3 bg-purple-500 rounded-full"></div>
                    <h2 className="text-xl font-semibold text-gray-900">Room Block Management</h2>
                    <Badge variant="secondary" className="ml-auto">
                      <TrendingUp className="w-3 h-3 mr-1" />
                      Active
                    </Badge>
                  </div>
                  <RoomBlocks />
                </CardContent>
              </Card>
            </div>
          </TabsContent>

          <TabsContent value="reservations" className="m-0 h-full">
            <div className="animate-in fade-in-50 duration-300">
              <Card className="m-4 lg:m-6 border-0 shadow-lg">
                <CardContent className="p-6">
                  <div className="flex items-center gap-3 mb-6">
                    <div className="w-3 h-3 bg-orange-500 rounded-full"></div>
                    <h2 className="text-xl font-semibold text-gray-900">Advanced Reservations</h2>
                    <Badge variant="default" className="ml-auto bg-orange-500">
                      <Calendar className="w-3 h-3 mr-1" />
                      Pending
                    </Badge>
                  </div>
                  <AdvancedReservations />
                </CardContent>
              </Card>
            </div>
          </TabsContent>

          <TabsContent value="rules" className="m-0 h-full">
            <div className="animate-in fade-in-50 duration-300">
              <Card className="m-4 lg:m-6 border-0 shadow-lg">
                <CardContent className="p-6">
                  <div className="flex items-center gap-3 mb-6">
                    <div className="w-3 h-3 bg-gray-500 rounded-full"></div>
                    <h2 className="text-xl font-semibold text-gray-900">Assignment Rules & Automation</h2>
                    <Badge variant="outline" className="ml-auto">
                      <Settings className="w-3 h-3 mr-1" />
                      Auto-Assign
                    </Badge>
                  </div>
                  <AssignmentRules />
                </CardContent>
              </Card>
            </div>
          </TabsContent>

          <TabsContent value="waitlist" className="m-0 h-full">
            <div className="animate-in fade-in-50 duration-300">
              <Card className="m-4 lg:m-6 border-0 shadow-lg">
                <CardContent className="p-6">
                  <div className="flex items-center gap-3 mb-6">
                    <div className="w-3 h-3 bg-red-500 rounded-full"></div>
                    <h2 className="text-xl font-semibold text-gray-900">Guest Waitlist Management</h2>
                    <Badge variant="destructive" className="ml-auto">
                      <AlertCircle className="w-3 h-3 mr-1" />
                      Waitlist
                    </Badge>
                  </div>
                  <WaitingListManager />
                </CardContent>
              </Card>
            </div>
          </TabsContent>
        </div>
      </Tabs>
    </div>
  );
};

export default withErrorBoundary(AdminTapeChart);