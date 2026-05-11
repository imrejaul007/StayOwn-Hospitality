import React from 'react';
import { useProperty } from '../../context/PropertyContext';
import { Building2, ChevronRight } from 'lucide-react';

/**
 * PropertyBreadcrumb Component
 *
 * Displays breadcrumb navigation with property context for THE PENTOUZ Hotel Management System.
 * Shows the current property name (or "All Properties" in portfolio view) followed by navigation items.
 *
 * Features:
 * - Shows property name with Building2 icon
 * - Displays "All Properties" when in portfolio view
 * - ChevronRight icons as separators
 * - Dark mode support
 * - Mobile responsive
 * - ARIA labels for accessibility
 * - Last item highlighted with darker/bolder text
 *
 * @component
 * @example
 * // Single level breadcrumb
 * <PropertyBreadcrumb items={['Bookings']} />
 * // Output: "Hotel Mumbai > Bookings"
 *
 * @example
 * // Multi-level breadcrumb
 * <PropertyBreadcrumb items={['Bookings', 'Upcoming']} />
 * // Output: "Hotel Mumbai > Bookings > Upcoming"
 *
 * @example
 * // Settings breadcrumb
 * <PropertyBreadcrumb items={['Settings', 'Room Types']} />
 * // Output: "Hotel Mumbai > Settings > Room Types"
 *
 * @example
 * // Portfolio view
 * <PropertyBreadcrumb items={['Dashboard']} />
 * // Output: "All Properties > Dashboard"
 */

interface PropertyBreadcrumbProps {
  /** Array of breadcrumb items to display after the property name */
  items: string[];
}

export function PropertyBreadcrumb({ items }: PropertyBreadcrumbProps) {
  const { selectedProperty, viewMode } = useProperty();

  return (
    <nav
      className="flex items-center space-x-2 text-sm text-gray-600 dark:text-gray-400 mb-4"
      aria-label="Breadcrumb"
    >
      {/* Property Name or "All Properties" */}
      {viewMode === 'all' ? (
        <div className="flex items-center space-x-1 font-medium text-blue-600 dark:text-blue-400">
          <Building2 className="h-4 w-4" aria-hidden="true" />
          <span>All Properties</span>
        </div>
      ) : selectedProperty ? (
        <div className="flex items-center space-x-1 font-medium text-blue-600 dark:text-blue-400">
          <Building2 className="h-4 w-4" aria-hidden="true" />
          <span>{selectedProperty.name}</span>
        </div>
      ) : null}

      {/* Breadcrumb Items */}
      {items.map((item, index) => (
        <div key={`items-${index}-${item}`} className="flex items-center space-x-2">
          <ChevronRight className="h-4 w-4" aria-hidden="true" />
          <span
            className={`${
              index === items.length - 1
                ? 'font-medium text-gray-900 dark:text-gray-100'
                : 'text-gray-600 dark:text-gray-400'
            }`}
            aria-current={index === items.length - 1 ? 'page' : undefined}
          >
            {item}
          </span>
        </div>
      ))}
    </nav>
  );
}

export default PropertyBreadcrumb;
