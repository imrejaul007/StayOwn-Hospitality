import React, { useState } from 'react';
import { cn } from '../../utils/cn';
import { Card, CardHeader, CardTitle, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';

interface Column<T> {
  key: keyof T | string;
  header: string;
  render?: (value: unknown, row: T) => React.ReactNode;
  sortable?: boolean;
  width?: string;
  align?: 'left' | 'center' | 'right';
}

const DataTableRow = React.memo(function DataTableRow<T extends Record<string, unknown>>({
  row,
  columns,
  onRowClick,
}: {
  row: T;
  columns: Column<T>[];
  onRowClick?: (row: T) => void;
}) {
  return (
    <tr role="button" tabIndex={0}
      className={cn(
        'hover:bg-gradient-to-r hover:from-blue-50/50 hover:to-indigo-50/50 transition-all duration-200 hover:shadow-sm border-l-2 border-transparent hover:border-blue-400',
        onRowClick && 'cursor-pointer transform hover:scale-[1.001]'
      )}
      onClick={() => onRowClick && onRowClick(row)}
     onKeyDown={(e: React.KeyboardEvent) => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); const clickHandler = () => onRowClick && onRowClick(row); if (typeof clickHandler === 'function') { clickHandler(e as any); } } }}>
      {columns.map((column, colIndex) => {
        const value = row[column.key];
        return (
          <td
            key={colIndex}
            className={cn(
              'px-3 sm:px-6 py-3 sm:py-4 text-xs sm:text-sm text-gray-900',
              column.key === 'actions' ? '' : 'max-w-0 truncate',
              column.align === 'center' && 'text-center',
              column.align === 'right' && 'text-right'
            )}
            style={{
              maxWidth: column.key === 'actions' ? '300px' : '200px',
              minWidth: column.key === 'actions' ? '250px' : 'auto'
            }}
          >
            <div className={column.key === 'actions' ? '' : 'truncate'} title={String(column.render ? column.render(value, row) : value)}>
              {column.render ? column.render(value, row) : value}
            </div>
          </td>
        );
      })}
    </tr>
  );
}) as <T extends Record<string, unknown>>(props: {
  row: T;
  columns: Column<T>[];
  onRowClick?: (row: T) => void;
}) => React.ReactElement;

interface DataTableProps<T> {
  title?: string;
  data: T[];
  columns: Column<T>[];
  loading?: boolean;
  searchable?: boolean;
  searchPlaceholder?: string;
  sortable?: boolean;
  pagination?: boolean;
  pageSize?: number;
  emptyMessage?: string;
  onRowClick?: (row: T) => void;
  actions?: React.ReactNode;
  className?: string;
}

export function DataTable<T extends Record<string, unknown>>({
  title,
  data,
  columns,
  loading = false,
  searchable = false,
  searchPlaceholder = 'Search...',
  sortable = true,
  pagination = true,
  pageSize = 10,
  emptyMessage = 'No data available',
  onRowClick,
  actions,
  className,
}: DataTableProps<T>) {
  const [searchTerm, setSearchTerm] = useState('');
  const [sortConfig, setSortConfig] = useState<{
    key: keyof T | string;
    direction: 'asc' | 'desc';
  } | null>(null);
  const [currentPage, setCurrentPage] = useState(1);

  // Filter data based on search term
  const filteredData = searchable && Array.isArray(data)
    ? data.filter((row) =>
        Object.values(row).some((value) =>
          String(value).toLowerCase().includes(searchTerm.toLowerCase())
        )
      )
    : Array.isArray(data) ? data : [];

  // Sort data
  const sortedData = sortable && sortConfig
    ? [...filteredData].sort((a, b) => {
        const aValue = a[sortConfig.key];
        const bValue = b[sortConfig.key];
        
        if (aValue < bValue) {
          return sortConfig.direction === 'asc' ? -1 : 1;
        }
        if (aValue > bValue) {
          return sortConfig.direction === 'asc' ? 1 : -1;
        }
        return 0;
      })
    : filteredData;

  // Paginate data
  const totalPages = Math.ceil(sortedData.length / pageSize);
  const startIndex = (currentPage - 1) * pageSize;
  const paginatedData = pagination
    ? sortedData.slice(startIndex, startIndex + pageSize)
    : sortedData;

  const handleSort = (columnKey: keyof T | string) => {
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
  };

  const getSortIcon = (columnKey: keyof T | string) => {
    if (!sortConfig || sortConfig.key !== columnKey) {
      return (
        <svg className="w-3 h-3 sm:w-4 sm:h-4 opacity-50" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M7 16V4m0 0L3 8m4-4l4 4m6 0v12m0 0l4-4m-4 4l-4-4" />
        </svg>
      );
    }

    return sortConfig.direction === 'asc' ? (
      <svg className="w-3 h-3 sm:w-4 sm:h-4 text-blue-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M7 11l5-5m0 0l5 5m-5-5v12" />
      </svg>
    ) : (
      <svg className="w-3 h-3 sm:w-4 sm:h-4 text-blue-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17 13l-5 5m0 0l-5-5m5 5V6" />
      </svg>
    );
  };

  return (
    <Card className={cn('overflow-hidden bg-white/95 backdrop-blur-sm border-0 shadow-xl rounded-2xl', className)}>
      {(title || searchable || actions) && (
        <CardHeader className="pb-3 sm:pb-4 px-4 sm:px-6 bg-gradient-to-r from-slate-50 to-gray-50 border-b border-gray-200/50">
          <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
            <div className="min-w-0">
              {title && <CardTitle className="text-base sm:text-lg truncate text-gray-800 font-bold">{title}</CardTitle>}
            </div>
            <div className="flex flex-col sm:flex-row items-stretch sm:items-center gap-2 sm:gap-4">
              {searchable && (
                <div className="relative">
                  <Input
                    placeholder={searchPlaceholder}
                    value={searchTerm}
                    onChange={(e) => {
                      setSearchTerm(e.target.value);
                      setCurrentPage(1);
                    }}
                    className="w-full sm:w-64 text-sm border-2 border-gray-200 rounded-xl px-4 py-2 bg-white/80 backdrop-blur-sm focus:border-blue-500 focus:ring-2 focus:ring-blue-200 transition-all duration-200 font-medium pl-10"
                  />
                  <svg className="absolute left-3 top-1/2 transform -translate-y-1/2 w-4 h-4 text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
                  </svg>
                </div>
              )}
              {actions && <div className="flex-shrink-0">{actions}</div>}
            </div>
          </div>
        </CardHeader>
      )}

      <CardContent className="p-0 flex-1 flex flex-col min-h-0">
        <div className="overflow-x-auto scrollbar-thin flex-1">
          <table className="w-full min-w-full">
            <thead className="bg-gradient-to-r from-gray-50 to-slate-50 border-b border-gray-200/50 sticky top-0 backdrop-blur-sm">
              <tr>
                {columns.map((column, index) => (
                  <th role="button" tabIndex={0}
                    key={column.key}
                    className={cn(
                      'px-3 sm:px-6 py-2 sm:py-3 text-xs font-medium text-gray-500 uppercase tracking-wider whitespace-nowrap',
                      column.align === 'center' && 'text-center',
                      column.align === 'right' && 'text-right',
                      (column.sortable || sortable) && 'cursor-pointer hover:text-gray-700',
                    )}
                    style={{ width: column.width, minWidth: '100px' }}
                    onClick={() => (column.sortable || sortable) && handleSort(column.key)}
                   onKeyDown={(e: React.KeyboardEvent) => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); const clickHandler = () => (column.sortable || sortable) && handleSort(column.key); if (typeof clickHandler === 'function') { clickHandler(e as any); } } }}>
                    <div className="flex items-center space-x-1">
                      <span className="truncate">{column.header}</span>
                      {(column.sortable || sortable) && getSortIcon(column.key)}
                    </div>
                  </th>
                ))}
              </tr>
            </thead>
            <tbody className="bg-white/90 backdrop-blur-sm divide-y divide-gray-100">
              {loading ? (
                Array.from({ length: pageSize }, (_, index) => (
                  <tr key={`item-${index}`} className="animate-pulse">
                    {columns.map((_, colIndex) => (
                      <td key={colIndex} className="px-3 sm:px-6 py-3 sm:py-4">
                        <div className="bg-gradient-to-r from-gray-200 via-gray-300 to-gray-200 h-3 sm:h-4 rounded-lg animate-shimmer bg-[length:400px_100%]"></div>
                      </td>
                    ))}
                  </tr>
                ))
              ) : paginatedData.length === 0 ? (
                <tr>
                  <td
                    colSpan={columns.length}
                    className="px-3 sm:px-6 py-8 sm:py-12 text-center text-gray-500 text-sm"
                  >
                    {emptyMessage}
                  </td>
                </tr>
              ) : (
                paginatedData.map((row, rowIndex) => (
                  <DataTableRow
                    key={rowIndex}
                    row={row}
                    columns={columns}
                    onRowClick={onRowClick}
                  />
                ))
              )}
            </tbody>
          </table>
        </div>

        {pagination && totalPages > 1 && (
          <div className="px-3 sm:px-6 py-3 sm:py-4 border-t border-gray-200 flex flex-col sm:flex-row items-center justify-between gap-3">
            <div className="text-xs sm:text-sm text-gray-700 text-center sm:text-left">
              Showing {startIndex + 1} to {Math.min(startIndex + pageSize, sortedData.length)} of {sortedData.length} results
            </div>
            <div className="flex items-center space-x-1 sm:space-x-2">
              <Button
                variant="secondary"
                size="sm"
                onClick={() => setCurrentPage(Math.max(1, currentPage - 1))}
                disabled={currentPage === 1}
                className="text-xs px-2 sm:px-3"
              >
                Prev
              </Button>
              <div className="hidden sm:flex items-center space-x-1">
                {(() => {
                  const maxVisible = 5;
                  let startPage = Math.max(1, currentPage - Math.floor(maxVisible / 2));
                  let endPage = Math.min(totalPages, startPage + maxVisible - 1);
                  if (endPage - startPage + 1 < maxVisible) {
                    startPage = Math.max(1, endPage - maxVisible + 1);
                  }
                  const pages: React.ReactNode[] = [];
                  if (startPage > 1) {
                    pages.push(
                      <Button key={1} variant="ghost" size="sm" onClick={() => setCurrentPage(1)} className="text-xs min-w-[32px]">1</Button>
                    );
                    if (startPage > 2) {
                      pages.push(<span key="start-ellipsis" className="text-xs text-gray-400 px-1">...</span>);
                    }
                  }
                  for (let i = startPage; i <= endPage; i++) {
                    pages.push(
                      <Button key={i} variant={currentPage === i ? 'primary' : 'ghost'} size="sm" onClick={() => setCurrentPage(i)} className="text-xs min-w-[32px]">{i}</Button>
                    );
                  }
                  if (endPage < totalPages) {
                    if (endPage < totalPages - 1) {
                      pages.push(<span key="end-ellipsis" className="text-xs text-gray-400 px-1">...</span>);
                    }
                    pages.push(
                      <Button key={totalPages} variant="ghost" size="sm" onClick={() => setCurrentPage(totalPages)} className="text-xs min-w-[32px]">{totalPages}</Button>
                    );
                  }
                  return pages;
                })()}
              </div>
              <div className="sm:hidden text-xs text-gray-500">
                {currentPage} / {totalPages}
              </div>
              <Button
                variant="secondary"
                size="sm"
                onClick={() => setCurrentPage(Math.min(totalPages, currentPage + 1))}
                disabled={currentPage === totalPages}
                className="text-xs px-2 sm:px-3"
              >
                Next
              </Button>
            </div>
          </div>
        )}
      </CardContent>
    </Card>
  );
}