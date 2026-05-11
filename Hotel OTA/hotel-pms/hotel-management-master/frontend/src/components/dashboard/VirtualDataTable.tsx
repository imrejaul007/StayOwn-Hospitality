import React, { useState, useCallback, useMemo } from 'react';
import { cn } from '../../utils/cn';
import { Card, CardHeader, CardTitle, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { useVirtualization } from '../../hooks/useVirtualization';
import { useDebounce, usePerformanceMonitoring } from '../../hooks/usePerformanceOptimization';

interface Column<T> {
  key: keyof T | string;
  header: string;
  render?: (value: unknown, row: T) => React.ReactNode;
  sortable?: boolean;
  width?: string;
  align?: 'left' | 'center' | 'right';
}

interface VirtualDataTableProps<T> {
  title?: string;
  data: T[];
  columns: Column<T>[];
  loading?: boolean;
  searchable?: boolean;
  searchPlaceholder?: string;
  sortable?: boolean;
  itemHeight?: number;
  containerHeight?: number;
  emptyMessage?: string;
  onRowClick?: (row: T) => void;
  actions?: React.ReactNode;
  className?: string;
  overscan?: number;
}

export function VirtualDataTable<T extends Record<string, unknown>>({
  title,
  data,
  columns,
  loading = false,
  searchable = false,
  searchPlaceholder = 'Search...',
  sortable = true,
  itemHeight = 60,
  containerHeight = 400,
  emptyMessage = 'No data available',
  onRowClick,
  actions,
  className,
  overscan = 5,
}: VirtualDataTableProps<T>) {
  const { getMetrics } = usePerformanceMonitoring('VirtualDataTable');
  
  const [searchTerm, setSearchTerm] = useState('');
  const [sortConfig, setSortConfig] = useState<{
    key: keyof T | string;
    direction: 'asc' | 'desc';
  } | null>(null);

  const debouncedSearchTerm = useDebounce(searchTerm, 300);

  // Memoized filtered and sorted data
  const processedData = useMemo(() => {
    let result = [...data];

    // Filter data based on search term
    if (searchable && debouncedSearchTerm) {
      result = result.filter((row) =>
        Object.values(row).some((value) =>
          String(value).toLowerCase().includes(debouncedSearchTerm.toLowerCase())
        )
      );
    }

    // Sort data
    if (sortable && sortConfig) {
      result.sort((a, b) => {
        const aValue = a[sortConfig.key];
        const bValue = b[sortConfig.key];
        
        if (aValue < bValue) {
          return sortConfig.direction === 'asc' ? -1 : 1;
        }
        if (aValue > bValue) {
          return sortConfig.direction === 'asc' ? 1 : -1;
        }
        return 0;
      });
    }

    return result;
  }, [data, debouncedSearchTerm, sortConfig, searchable, sortable]);

  const {
    totalHeight,
    visibleItems,
    scrollElementRef,
    handleScroll,
    offsetY,
  } = useVirtualization(processedData, {
    itemHeight,
    containerHeight,
    overscan,
  });

  const handleSort = useCallback((columnKey: keyof T | string) => {
    const column = columns.find(col => col.key === columnKey);
    if (!column?.sortable && !sortable) return;

    setSortConfig(current => {
      if (current?.key === columnKey) {
        return current.direction === 'asc'
          ? { key: columnKey, direction: 'desc' }
          : null;
      }
      return { key: columnKey, direction: 'asc' };
    });
  }, [columns, sortable]);

  const getSortIcon = useCallback((columnKey: keyof T | string) => {
    if (!sortConfig || sortConfig.key !== columnKey) {
      return (
        <svg className="w-4 h-4 opacity-50" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M7 16V4m0 0L3 8m4-4l4 4m6 0v12m0 0l4-4m-4 4l-4-4" />
        </svg>
      );
    }

    return sortConfig.direction === 'asc' ? (
      <svg className="w-4 h-4 text-blue-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M7 11l5-5m0 0l5 5m-5-5v12" />
      </svg>
    ) : (
      <svg className="w-4 h-4 text-blue-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17 13l-5 5m0 0l-5-5m5 5V6" />
      </svg>
    );
  }, [sortConfig]);

  const renderRow = useCallback((item: T, index: number) => (
    <tr role="button" tabIndex={0}
      key={`item-${index}`}
      className={cn(
        'hover:bg-gray-50 border-b border-gray-200',
        onRowClick && 'cursor-pointer'
      )}
      style={{ height: itemHeight }}
      onClick={() => onRowClick && onRowClick(item)}
     onKeyDown={(e: React.KeyboardEvent) => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); const clickHandler = () => onRowClick && onRowClick(item); if (typeof clickHandler === 'function') { clickHandler(e as any); } } }}>
      {columns.map((column, colIndex) => {
        const value = item[column.key];
        return (
          <td
            key={colIndex}
            className={cn(
              'px-6 py-3 whitespace-nowrap text-sm text-gray-900',
              column.align === 'center' && 'text-center',
              column.align === 'right' && 'text-right'
            )}
            style={{ width: column.width }}
          >
            {column.render ? column.render(value, item) : value}
          </td>
        );
      })}
    </tr>
  ), [columns, itemHeight, onRowClick]);

  const handleSearchChange = useCallback((e: React.ChangeEvent<HTMLInputElement>) => {
    setSearchTerm(e.target.value);
  }, []);

  if (loading) {
    return (
      <Card className={cn('overflow-hidden', className)}>
        {(title || searchable || actions) && (
          <CardHeader className="pb-4">
            <div className="flex items-center justify-between">
              <div>
                {title && <CardTitle>{title}</CardTitle>}
              </div>
              <div className="flex items-center space-x-4">
                {searchable && (
                  <div className="animate-pulse">
                    <div className="h-8 bg-gray-200 rounded w-64"></div>
                  </div>
                )}
                {actions}
              </div>
            </div>
          </CardHeader>
        )}
        <CardContent className="p-0">
          <div className="animate-pulse">
            <div className="bg-gray-50 h-12 border-b border-gray-200"></div>
            <div style={{ height: containerHeight }} className="p-6 space-y-3">
              {Array.from({ length: Math.floor(containerHeight / itemHeight) }, (_, i) => (
                <div key={i} className="h-12 bg-gray-200 rounded"></div>
              ))}
            </div>
          </div>
        </CardContent>
      </Card>
    );
  }

  return (
    <Card className={cn('overflow-hidden', className)}>
      {(title || searchable || actions) && (
        <CardHeader className="pb-4">
          <div className="flex items-center justify-between">
            <div>
              {title && <CardTitle>{title}</CardTitle>}
            </div>
            <div className="flex items-center space-x-4">
              {searchable && (
                <Input
                  placeholder={searchPlaceholder}
                  value={searchTerm}
                  onChange={handleSearchChange}
                  className="w-64"
                />
              )}
              {actions}
            </div>
          </div>
        </CardHeader>
      )}

      <CardContent className="p-0">
        <div className="overflow-hidden">
          {/* Table Header */}
          <div className="bg-gray-50 border-b border-gray-200 sticky top-0 z-10">
            <div className="overflow-x-auto">
              <table className="min-w-full">
                <thead>
                  <tr>
                    {columns.map((column, index) => (
                      <th role="button" tabIndex={0}
                        key={column.key}
                        className={cn(
                          'px-6 py-3 text-xs font-medium text-gray-500 uppercase tracking-wider',
                          column.align === 'center' && 'text-center',
                          column.align === 'right' && 'text-right',
                          (column.sortable || sortable) && 'cursor-pointer hover:text-gray-700',
                        )}
                        style={{ width: column.width }}
                        onClick={() => (column.sortable || sortable) && handleSort(column.key)}
                       onKeyDown={(e: React.KeyboardEvent) => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); const clickHandler = () => (column.sortable || sortable) && handleSort(column.key); if (typeof clickHandler === 'function') { clickHandler(e as any); } } }}>
                        <div className="flex items-center space-x-1">
                          <span>{column.header}</span>
                          {(column.sortable || sortable) && getSortIcon(column.key)}
                        </div>
                      </th>
                    ))}
                  </tr>
                </thead>
              </table>
            </div>
          </div>

          {/* Virtualized Table Body */}
          <div
            ref={scrollElementRef}
            className="overflow-auto"
            style={{ height: containerHeight }}
            onScroll={handleScroll}
          >
            {processedData.length === 0 ? (
              <div className="flex items-center justify-center" style={{ height: containerHeight }}>
                <div className="text-center">
                  <svg className="w-12 h-12 text-gray-400 mx-auto mb-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} 
                      d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
                  </svg>
                  <p className="text-gray-500">{emptyMessage}</p>
                </div>
              </div>
            ) : (
              <div style={{ height: totalHeight, position: 'relative' }}>
                <div style={{ transform: `translateY(${offsetY}px)` }}>
                  <table className="min-w-full">
                    <tbody>
                      {visibleItems.map(({ index }) => 
                        renderRow(processedData[index], index)
                      )}
                    </tbody>
                  </table>
                </div>
              </div>
            )}
          </div>

          {/* Footer with results count */}
          {processedData.length > 0 && (
            <div className="px-6 py-3 border-t border-gray-200 bg-gray-50 text-sm text-gray-700">
              Showing {visibleItems.length} of {processedData.length} results
              {searchable && debouncedSearchTerm && (
                <span> (filtered from {data.length} total)</span>
              )}
            </div>
          )}
        </div>
      </CardContent>
    </Card>
  );
}