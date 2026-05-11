import React, { useState, useRef, useEffect } from 'react';
import { Building2, ChevronDown, Search, Check } from 'lucide-react';
import { useProperty } from '../../context/PropertyContext';

/**
 * PropertySelector Component
 *
 * Dropdown selector for switching between properties in THE PENTOUZ Hotel Management System.
 *
 * Features:
 * - Shows current selected property name
 * - "All Properties" option for portfolio view
 * - Search/filter capability for users with many properties
 * - Shows property count
 * - Only visible if user has multiple properties (isMultiProperty)
 * - Dark mode support
 * - Mobile responsive
 * - Matches existing AdminHeader styling (Tailwind CSS + Lucide icons)
 */
export function PropertySelector() {
  const {
    selectedProperty,
    properties,
    viewMode,
    isMultiProperty,
    isLoading,
    setSelectedPropertyId,
    setViewMode,
    isSwitchingProperty,
  } = useProperty();

  const [isOpen, setIsOpen] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');
  const dropdownRef = useRef<HTMLDivElement>(null);

  // Close dropdown when clicking outside
  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (dropdownRef.current && !dropdownRef.current.contains(event.target as Node)) {
        setIsOpen(false);
      }
    };

    if (isOpen) {
      document.addEventListener('mousedown', handleClickOutside);
    }

    return () => {
      document.removeEventListener('mousedown', handleClickOutside);
    };
  }, [isOpen]);

  // Don't show if still loading
  if (isLoading) {
    return null;
  }

  // Show single property name (non-clickable) if user has only one property
  if (!isMultiProperty) {
    return (
      <div className="flex items-center space-x-2 px-3 py-2 text-sm font-medium text-gray-700 bg-gray-50 border border-gray-300 rounded-lg dark:bg-gray-800 dark:border-gray-600 dark:text-gray-200">
        <Building2 className="h-4 w-4 text-gray-500 dark:text-gray-400" />
        <span className="max-w-[150px] truncate">{selectedProperty?.name || 'No Property'}</span>
      </div>
    );
  }

  // Filter properties based on search
  const filteredProperties = properties.filter(property =>
    property.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
    property.address?.city?.toLowerCase().includes(searchQuery.toLowerCase())
  );

  // Handle property selection
  const handleSelectProperty = (propertyId: string) => {
    setSelectedPropertyId(propertyId);
    setIsOpen(false);
    setSearchQuery('');
  };

  // Handle "All Properties" selection
  const handleSelectAllProperties = () => {
    setViewMode('all');
    setIsOpen(false);
    setSearchQuery('');
  };

  // Get display text
  const displayText = viewMode === 'all'
    ? 'All Properties'
    : selectedProperty?.name || 'Select Property';

  return (
    <div className="flex flex-col items-end gap-1">
      {isSwitchingProperty && (
        <p
          className="max-w-[min(100vw-2rem,20rem)] rounded-md border border-blue-200 bg-blue-50 px-2 py-1.5 text-left text-xs text-blue-950 dark:border-blue-800 dark:bg-blue-950/40 dark:text-blue-100"
          role="status"
        >
          Switching property…
        </p>
      )}
      <div className="relative" ref={dropdownRef}>
      {/* Trigger Button */}
      <button
        onClick={() => setIsOpen(!isOpen)}
        className="flex items-center space-x-2 px-3 py-2 text-sm font-medium text-gray-700 bg-white border border-gray-300 rounded-lg hover:bg-gray-50 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500 transition-colors dark:bg-gray-800 dark:border-gray-600 dark:text-gray-200 dark:hover:bg-gray-700"
        aria-label="Select property"
        aria-expanded={isOpen}
      >
        <Building2 className="h-4 w-4 text-gray-500 dark:text-gray-400" />
        <span className="max-w-[150px] truncate">{displayText}</span>
        <ChevronDown className={`h-4 w-4 text-gray-500 dark:text-gray-400 transition-transform ${isOpen ? 'rotate-180' : ''}`} />
      </button>

      {/* Dropdown Menu */}
      {isOpen && (
        <div className="absolute left-0 mt-2 w-80 bg-white border border-gray-200 rounded-lg shadow-lg z-50 max-h-96 overflow-hidden dark:bg-gray-800 dark:border-gray-700">
          {/* Search Box */}
          {properties.length > 5 && (
            <div className="p-3 border-b border-gray-200 dark:border-gray-700">
              <div className="relative">
                <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-gray-400 dark:text-gray-500" />
                <input
                  type="text"
                  placeholder="Search properties..."
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  className="w-full pl-10 pr-3 py-2 text-sm border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500 dark:bg-gray-700 dark:border-gray-600 dark:text-gray-200 dark:placeholder-gray-400"
                  autoFocus
                />
              </div>
            </div>
          )}

          {/* Properties List */}
          <div className="max-h-64 overflow-y-auto">
            {/* All Properties Option */}
            <button
              onClick={handleSelectAllProperties}
              className={`w-full text-left px-4 py-3 hover:bg-gray-50 dark:hover:bg-gray-700 transition-colors flex items-center justify-between ${
                viewMode === 'all' ? 'bg-blue-50 dark:bg-blue-900/20' : ''
              }`}
            >
              <div className="flex items-center space-x-3">
                <Building2 className={`h-5 w-5 ${viewMode === 'all' ? 'text-blue-600 dark:text-blue-400' : 'text-gray-400 dark:text-gray-500'}`} />
                <div>
                  <div className={`text-sm font-medium ${viewMode === 'all' ? 'text-blue-900 dark:text-blue-300' : 'text-gray-900 dark:text-gray-200'}`}>
                    All Properties
                  </div>
                  <div className="text-xs text-gray-500 dark:text-gray-400">
                    Portfolio view ({properties.length} properties)
                  </div>
                </div>
              </div>
              {viewMode === 'all' && (
                <Check className="h-5 w-5 text-blue-600 dark:text-blue-400" />
              )}
            </button>

            <div className="border-t border-gray-200 dark:border-gray-700" />

            {/* Individual Properties */}
            {filteredProperties.length > 0 ? (
              filteredProperties.map((property) => (
                <button
                  key={property._id}
                  onClick={() => handleSelectProperty(property._id)}
                  className={`w-full text-left px-4 py-3 hover:bg-gray-50 dark:hover:bg-gray-700 transition-colors flex items-center justify-between ${
                    selectedProperty?._id === property._id && viewMode === 'single' ? 'bg-blue-50 dark:bg-blue-900/20' : ''
                  }`}
                >
                  <div className="flex items-center space-x-3">
                    <Building2 className={`h-5 w-5 ${
                      selectedProperty?._id === property._id && viewMode === 'single'
                        ? 'text-blue-600 dark:text-blue-400'
                        : 'text-gray-400 dark:text-gray-500'
                    }`} />
                    <div>
                      <div className={`text-sm font-medium ${
                        selectedProperty?._id === property._id && viewMode === 'single'
                          ? 'text-blue-900 dark:text-blue-300'
                          : 'text-gray-900 dark:text-gray-200'
                      }`}>
                        {property.name}
                      </div>
                      <div className="text-xs text-gray-500 dark:text-gray-400">
                        {property.address?.city}, {property.address?.state}
                      </div>
                    </div>
                  </div>
                  {selectedProperty?._id === property._id && viewMode === 'single' && (
                    <Check className="h-5 w-5 text-blue-600 dark:text-blue-400" />
                  )}
                </button>
              ))
            ) : (
              <div className="px-4 py-6 text-center text-sm text-gray-500 dark:text-gray-400">
                No properties found
              </div>
            )}
          </div>

          {/* Footer */}
          <div className="p-3 border-t border-gray-200 dark:border-gray-700 bg-gray-50 dark:bg-gray-900">
            <p className="text-xs text-gray-600 dark:text-gray-400 text-center">
              Showing {filteredProperties.length} of {properties.length} properties
            </p>
          </div>
        </div>
      )}
      </div>
    </div>
  );
}

export default PropertySelector;
