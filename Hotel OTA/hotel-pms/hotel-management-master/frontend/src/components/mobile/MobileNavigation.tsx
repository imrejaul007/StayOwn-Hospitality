import React, { useState } from 'react';
import { Button } from '../ui/button';
import { Badge } from '../ui/badge';
import {
  BarChart3,
  Building2,
  Users,
  Settings,
  Menu,
  X,
  Search,
  Filter,
  Plus,
  RefreshCw
} from 'lucide-react';
import {
  Sheet,
  SheetContent,
  SheetDescription,
  SheetHeader,
  SheetTitle,
  SheetTrigger,
} from '../ui/sheet';
import OptimizedSearch from '../ui/OptimizedSearch';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '../ui/select';

interface Tab {
  id: string;
  label: string;
  icon: React.ComponentType<{ className?: string }>;
  count?: number;
}

interface MobileNavigationProps {
  activeTab: string;
  onTabChange: (tabId: string) => void;
  tabs: Tab[];
  searchTerm: string;
  onSearchChange: (term: string) => void;
  statusFilter: string;
  onStatusFilterChange: (status: string) => void;
  typeFilter?: string;
  onTypeFilterChange?: (type: string) => void;
  onAddNew?: () => void;
  onRefresh?: () => void;
  isLoading?: boolean;
  showFilters?: boolean;
  title?: string;
}

export const MobileNavigation: React.FC<MobileNavigationProps> = ({
  activeTab,
  onTabChange,
  tabs,
  searchTerm,
  onSearchChange,
  statusFilter,
  onStatusFilterChange,
  typeFilter,
  onTypeFilterChange,
  onAddNew,
  onRefresh,
  isLoading = false,
  showFilters = true,
  title = "Multi-Property Manager"
}) => {
  const [showMobileMenu, setShowMobileMenu] = useState(false);
  const [showMobileFilters, setShowMobileFilters] = useState(false);

  const activeTabData = tabs.find(tab => tab.id === activeTab);

  return (
    <div className="lg:hidden">
      {/* Mobile Header */}
      <div className="sticky top-0 z-40 bg-background border-b">
        <div className="flex items-center justify-between p-4">
          <div className="flex items-center gap-3">
            <Sheet open={showMobileMenu} onOpenChange={setShowMobileMenu}>
              <SheetTrigger asChild>
                <Button variant="ghost" size="sm" className="p-0 h-8 w-8">
                  <Menu className="h-5 w-5" />
                </Button>
              </SheetTrigger>
              <SheetContent side="left" className="w-80">
                <SheetHeader>
                  <SheetTitle>{title}</SheetTitle>
                  <SheetDescription>
                    Manage your properties and groups
                  </SheetDescription>
                </SheetHeader>

                {/* Mobile Menu Content */}
                <div className="mt-6 space-y-4">
                  {tabs.map((tab) => {
                    const Icon = tab.icon;
                    const isActive = tab.id === activeTab;

                    return (
                      <Button
                        key={tab.id}
                        variant={isActive ? "default" : "ghost"}
                        className="w-full justify-start h-12"
                        onClick={() => {
                          onTabChange(tab.id);
                          setShowMobileMenu(false);
                        }}
                      >
                        <Icon className="mr-3 h-5 w-5" />
                        <span className="flex-1 text-left">{tab.label}</span>
                        {tab.count !== undefined && (
                          <Badge variant={isActive ? "secondary" : "outline"} className="ml-2">
                            {tab.count}
                          </Badge>
                        )}
                      </Button>
                    );
                  })}

                  {/* Mobile Menu Actions */}
                  <div className="pt-4 border-t space-y-2">
                    {onAddNew && (
                      <Button
                        variant="outline"
                        className="w-full justify-start"
                        onClick={() => {
                          onAddNew();
                          setShowMobileMenu(false);
                        }}
                      >
                        <Plus className="mr-3 h-4 w-4" />
                        Add New
                      </Button>
                    )}

                    {onRefresh && (
                      <Button
                        variant="outline"
                        className="w-full justify-start"
                        onClick={() => {
                          onRefresh();
                          setShowMobileMenu(false);
                        }}
                        disabled={isLoading}
                      >
                        <RefreshCw className={`mr-3 h-4 w-4 ${isLoading ? 'animate-spin' : ''}`} />
                        Refresh Data
                      </Button>
                    )}
                  </div>
                </div>
              </SheetContent>
            </Sheet>

            {/* Active Tab Info */}
            <div className="flex items-center gap-2">
              {activeTabData && (
                <>
                  <activeTabData.icon className="h-5 w-5 text-primary" />
                  <span className="font-medium">{activeTabData.label}</span>
                  {activeTabData.count !== undefined && (
                    <Badge variant="secondary">{activeTabData.count}</Badge>
                  )}
                </>
              )}
            </div>
          </div>

          {/* Header Actions */}
          <div className="flex items-center gap-2">
            {showFilters && (
              <Sheet open={showMobileFilters} onOpenChange={setShowMobileFilters}>
                <SheetTrigger asChild>
                  <Button variant="outline" size="sm" className="h-8 w-8 p-0">
                    <Filter className="h-4 w-4" />
                  </Button>
                </SheetTrigger>
                <SheetContent side="right">
                  <SheetHeader>
                    <SheetTitle>Filters & Search</SheetTitle>
                  </SheetHeader>

                  <div className="mt-6 space-y-6">
                    {/* Search */}
                    <div>
                      <label className="text-sm font-medium mb-2 block">Search</label>
                      <OptimizedSearch
                        placeholder="Search properties..."
                        onSearch={onSearchChange}
                        initialValue={searchTerm}
                        className="w-full"
                      />
                    </div>

                    {/* Status Filter */}
                    <div>
                      <label className="text-sm font-medium mb-2 block">Status</label>
                      <Select value={statusFilter} onValueChange={onStatusFilterChange}>
                        <SelectTrigger>
                          <SelectValue placeholder="Select status" />
                        </SelectTrigger>
                        <SelectContent>
                          <SelectItem value="all">All Status</SelectItem>
                          <SelectItem value="active">Active</SelectItem>
                          <SelectItem value="inactive">Inactive</SelectItem>
                          <SelectItem value="maintenance">Maintenance</SelectItem>
                        </SelectContent>
                      </Select>
                    </div>

                    {/* Type Filter */}
                    {typeFilter !== undefined && onTypeFilterChange && (
                      <div>
                        <label className="text-sm font-medium mb-2 block">Type</label>
                        <Select value={typeFilter} onValueChange={onTypeFilterChange}>
                          <SelectTrigger>
                            <SelectValue placeholder="Select type" />
                          </SelectTrigger>
                          <SelectContent>
                            <SelectItem value="all">All Types</SelectItem>
                            <SelectItem value="hotel">Hotel</SelectItem>
                            <SelectItem value="resort">Resort</SelectItem>
                            <SelectItem value="aparthotel">Aparthotel</SelectItem>
                            <SelectItem value="hostel">Hostel</SelectItem>
                            <SelectItem value="boutique">Boutique</SelectItem>
                          </SelectContent>
                        </Select>
                      </div>
                    )}

                    {/* Apply Filters Button */}
                    <Button
                      className="w-full"
                      onClick={() => setShowMobileFilters(false)}
                    >
                      Apply Filters
                    </Button>
                  </div>
                </SheetContent>
              </Sheet>
            )}

            {onRefresh && (
              <Button
                variant="outline"
                size="sm"
                className="h-8 w-8 p-0"
                onClick={onRefresh}
                disabled={isLoading}
              >
                <RefreshCw className={`h-4 w-4 ${isLoading ? 'animate-spin' : ''}`} />
              </Button>
            )}
          </div>
        </div>

        {/* Mobile Search Bar (always visible) */}
        <div className="px-4 pb-4">
          <OptimizedSearch
            placeholder="Quick search..."
            onSearch={onSearchChange}
            initialValue={searchTerm}
            className="w-full"
            showClearButton={true}
            debounceMs={200}
          />
        </div>
      </div>

      {/* Mobile Tab Bar (bottom navigation for key tabs) */}
      <div className="fixed bottom-0 left-0 right-0 z-30 bg-background border-t lg:hidden">
        <div className="grid grid-cols-4 gap-1 p-2">
          {tabs.slice(0, 4).map((tab) => {
            const Icon = tab.icon;
            const isActive = tab.id === activeTab;

            return (
              <Button
                key={tab.id}
                variant={isActive ? "default" : "ghost"}
                size="sm"
                className="flex-col h-12 p-1"
                onClick={() => onTabChange(tab.id)}
              >
                <Icon className="h-4 w-4 mb-1" />
                <span className="text-xs truncate">{tab.label}</span>
                {tab.count !== undefined && tab.count > 0 && (
                  <Badge
                    variant={isActive ? "secondary" : "outline"}
                    className="absolute -top-1 -right-1 h-5 w-5 rounded-full p-0 text-xs"
                  >
                    {tab.count > 99 ? '99+' : tab.count}
                  </Badge>
                )}
              </Button>
            );
          })}
        </div>
      </div>
    </div>
  );
};