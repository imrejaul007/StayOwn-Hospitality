import React from 'react';
import { cn } from '../../utils/cn';
import { Button } from '@/components/ui/button';

interface FilterOption {
  key: string;
  label: string;
  type: 'select' | 'date' | 'daterange' | 'search' | 'toggle';
  options?: { value: string; label: string }[];
  placeholder?: string;
  defaultValue?: unknown;
}

interface FilterBarProps {
  filters: FilterOption[];
  values: Record<string, unknown>;
  onChange: (key: string, value: unknown) => void;
  onReset?: () => void;
  onApply?: () => void;
  showApplyButton?: boolean;
  className?: string;
}

export function FilterBar({
  filters,
  values,
  onChange,
  onReset,
  onApply,
  showApplyButton = false,
  className,
}: FilterBarProps) {
  const handleReset = () => {
    filters.forEach(filter => {
      onChange(filter.key, filter.defaultValue || '');
    });
    onReset && onReset();
  };

  const renderFilter = (filter: FilterOption) => {
    const value = values[filter.key] || filter.defaultValue || '';

    switch (filter.type) {
      case 'select':
        return (
          <select
            key={filter.key}
            value={value}
            aria-label={filter.label}
            onChange={(e) => onChange(filter.key, e.target.value)}
            className="block w-full min-w-0 px-2 sm:px-3 py-2 border border-gray-300 rounded-md shadow-sm focus:ring-blue-500 focus:border-blue-500 text-xs sm:text-sm"
          >
            <option value="">{filter.placeholder || `Select ${filter.label}`}</option>
            {filter.options?.map((option) => (
              <option key={option.value} value={option.value}>
                {option.label}
              </option>
            ))}
          </select>
        );

      case 'date':
        return (
          <input
            key={filter.key}
            type="date"
            value={value}
            aria-label={filter.label}
            onChange={(e) => onChange(filter.key, e.target.value)}
            className="block w-full min-w-0 px-2 sm:px-3 py-2 border border-gray-300 rounded-md shadow-sm focus:ring-blue-500 focus:border-blue-500 text-xs sm:text-sm"
          />
        );

      case 'daterange':
        return (
          <div key={filter.key} className="flex flex-col sm:flex-row gap-2">
            <input
              type="date"
              aria-label={`${filter.label} start date`}
              value={value?.start || ''}
              onChange={(e) => onChange(filter.key, { ...value, start: e.target.value })}
              className="block w-full min-w-0 px-2 sm:px-3 py-2 border border-gray-300 rounded-md shadow-sm focus:ring-blue-500 focus:border-blue-500 text-xs sm:text-sm"
              placeholder="Start date"
            />
            <input
              type="date"
              aria-label={`${filter.label} end date`}
              value={value?.end || ''}
              onChange={(e) => onChange(filter.key, { ...value, end: e.target.value })}
              className="block w-full min-w-0 px-2 sm:px-3 py-2 border border-gray-300 rounded-md shadow-sm focus:ring-blue-500 focus:border-blue-500 text-xs sm:text-sm"
              placeholder="End date"
            />
          </div>
        );

      case 'search':
        return (
          <div key={filter.key} className="relative">
            <input
              type="text"
              value={value}
              aria-label={filter.label}
              onChange={(e) => onChange(filter.key, e.target.value)}
              placeholder={filter.placeholder || `Search ${filter.label}`}
              className="block w-full min-w-0 pl-8 sm:pl-10 pr-2 sm:pr-3 py-2 border border-gray-300 rounded-md shadow-sm focus:ring-blue-500 focus:border-blue-500 text-xs sm:text-sm"
            />
            <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
              <svg className="w-4 h-4 text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
              </svg>
            </div>
          </div>
        );

      case 'toggle':
        return (
          <label key={filter.key} className="flex items-center">
            <input
              type="checkbox"
              checked={value}
              onChange={(e) => onChange(filter.key, e.target.checked)}
              className="h-4 w-4 text-blue-600 focus:ring-blue-500 border-gray-300 rounded"
            />
            <span className="ml-2 text-sm text-gray-700">{filter.label}</span>
          </label>
        );

      default:
        return null;
    }
  };

  return (
    <div className={cn('bg-white p-3 sm:p-4 rounded-lg border border-gray-200 shadow-sm', className)}>
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-2 sm:gap-4 mb-4">
        <h3 className="text-base sm:text-lg font-medium text-gray-900">Filters</h3>
        <div className="flex items-center gap-2">
          {showApplyButton && onApply && (
            <Button variant="primary" size="sm" onClick={onApply} className="text-xs sm:text-sm">
              Apply
            </Button>
          )}
          <Button variant="secondary" size="sm" onClick={handleReset} className="text-xs sm:text-sm">
            Reset
          </Button>
        </div>
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-3 sm:gap-4">
        {filters.map((filter) => (
          <div key={filter.key} className="space-y-1">
            <label className="block text-sm font-medium text-gray-700">
              {filter.label}
            </label>
            {renderFilter(filter)}
          </div>
        ))}
      </div>
    </div>
  );
}

interface QuickFiltersProps {
  options: {
    key: string;
    label: string;
    icon?: React.ReactNode;
  }[];
  activeFilter: string;
  onChange: (key: string) => void;
  className?: string;
}

export function QuickFilters({
  options,
  activeFilter,
  onChange,
  className,
}: QuickFiltersProps) {
  return (
    <div className={cn('flex flex-wrap gap-2', className)}>
      {options.map((option) => (
        <Button
          key={option.key}
          variant={activeFilter === option.key ? 'primary' : 'secondary'}
          size="sm"
          onClick={() => onChange(option.key)}
          className="flex items-center space-x-2"
        >
          {option.icon && <span className="w-4 h-4">{option.icon}</span>}
          <span>{option.label}</span>
        </Button>
      ))}
    </div>
  );
}