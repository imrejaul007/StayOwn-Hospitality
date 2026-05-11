import React, { useState } from 'react';
import { ChevronDown, ChevronUp, MoreVertical, Eye, Edit, Trash2 } from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';

export interface TableColumn {
  key: string;
  label: string;
  sortable?: boolean;
  hidden?: boolean;
  mobileHidden?: boolean;
  render?: (value: unknown, row: Record<string, unknown>) => React.ReactNode;
}

export interface TableAction {
  key: string;
  label: string;
  icon?: React.ComponentType<{ className?: string }>;
  onClick: (row: Record<string, unknown>) => void;
  variant?: 'primary' | 'secondary' | 'danger';
}

export interface ResponsiveTableProps {
  data: unknown[];
  columns: TableColumn[];
  actions?: TableAction[];
  onSort?: (column: string, direction: 'asc' | 'desc') => void;
  loading?: boolean;
  emptyMessage?: string;
  selectable?: boolean;
  selectedRows?: string[];
  onSelectionChange?: (selectedIds: string[]) => void;
  rowKey?: string;
  className?: string;
}

const ResponsiveTable: React.FC<ResponsiveTableProps> = ({
  data,
  columns,
  actions = [],
  onSort,
  loading = false,
  emptyMessage = 'No data available',
  selectable = false,
  selectedRows = [],
  onSelectionChange,
  rowKey = 'id',
  className = ''
}) => {
  const [sortColumn, setSortColumn] = useState<string>('');
  const [sortDirection, setSortDirection] = useState<'asc' | 'desc'>('asc');
  const [expandedRows, setExpandedRows] = useState<Set<string>>(new Set());
  const [isMobile, setIsMobile] = useState(false);

  React.useEffect(() => {
    const checkMobile = () => {
      setIsMobile(window.innerWidth < 768);
    };

    checkMobile();
    window.addEventListener('resize', checkMobile);
    return () => window.removeEventListener('resize', checkMobile);
  }, []);

  const handleSort = (column: string) => {
    if (!onSort) return;

    const newDirection = sortColumn === column && sortDirection === 'asc' ? 'desc' : 'asc';
    setSortColumn(column);
    setSortDirection(newDirection);
    onSort(column, newDirection);
  };

  const toggleRowExpansion = (rowId: string) => {
    const newExpanded = new Set(expandedRows);
    if (newExpanded.has(rowId)) {
      newExpanded.delete(rowId);
    } else {
      newExpanded.add(rowId);
    }
    setExpandedRows(newExpanded);
  };

  const handleSelectAll = () => {
    if (!onSelectionChange) return;

    if (selectedRows.length === data.length) {
      onSelectionChange([]);
    } else {
      onSelectionChange(data.map(row => row[rowKey]));
    }
  };

  const handleSelectRow = (rowId: string) => {
    if (!onSelectionChange) return;

    if (selectedRows.includes(rowId)) {
      onSelectionChange(selectedRows.filter(id => id !== rowId));
    } else {
      onSelectionChange([...selectedRows, rowId]);
    }
  };

  const getActionIcon = (actionKey: string) => {
    switch (actionKey) {
      case 'view':
        return Eye;
      case 'edit':
        return Edit;
      case 'delete':
        return Trash2;
      default:
        return MoreVertical;
    }
  };

  const getActionVariant = (variant: string = 'secondary') => {
    switch (variant) {
      case 'primary':
        return 'text-indigo-600 hover:text-indigo-800';
      case 'danger':
        return 'text-red-600 hover:text-red-800';
      default:
        return 'text-gray-600 hover:text-gray-800';
    }
  };

  const visibleColumns = columns.filter(col =>
    !col.hidden && (!isMobile || !col.mobileHidden)
  );

  if (loading) {
    return (
      <div className={`bg-white rounded-lg shadow-sm ${className}`}>
        <div className="p-8 text-center">
          <div className="animate-spin rounded-full h-8 w-8 border-2 border-indigo-600 border-t-transparent mx-auto mb-4"></div>
          <p className="text-gray-500">Loading...</p>
        </div>
      </div>
    );
  }

  if (data.length === 0) {
    return (
      <div className={`bg-white rounded-lg shadow-sm ${className}`}>
        <div className="p-8 text-center">
          <p className="text-gray-500">{emptyMessage}</p>
        </div>
      </div>
    );
  }

  // Mobile Card View
  if (isMobile) {
    return (
      <div className={`space-y-4 ${className}`}>
        {data.map((row, index) => (
          <motion.div
            key={row[rowKey]}
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: index * 0.05 }}
            className="bg-white rounded-lg shadow-sm border border-gray-200 p-4"
          >
            <div className="flex justify-between items-start mb-3">
              {selectable && (
                <input
                  type="checkbox"
                  checked={selectedRows.includes(row[rowKey])}
                  onChange={() => handleSelectRow(row[rowKey])}
                  className="h-4 w-4 text-indigo-600 border-gray-300 rounded focus:ring-indigo-500"
                />
              )}

              {actions.length > 0 && (
                <div className="flex gap-2">
                  {actions.map((action) => {
                    const Icon = action.icon || getActionIcon(action.key);
                    return (
                      <button aria-label="Close"
                        key={action.key}
                        onClick={() => action.onClick(row)}
                        className={`p-2 rounded-full transition-colors ${getActionVariant(action.variant)}`}
                        title={action.label}
                      >
                        <Icon className="h-4 w-4" />
                      </button>
                    );
                  })}
                </div>
              )}
            </div>

            <div className="space-y-2">
              {visibleColumns.map((column) => (
                <div key={column.key} className="flex justify-between items-center">
                  <span className="text-sm font-medium text-gray-600">
                    {column.label}:
                  </span>
                  <span className="text-sm text-gray-900 text-right">
                    {column.render
                      ? column.render(row[column.key], row)
                      : row[column.key]
                    }
                  </span>
                </div>
              ))}
            </div>

            {/* Expandable content for hidden columns */}
            {columns.some(col => col.mobileHidden) && (
              <div className="mt-3 pt-3 border-t border-gray-200">
                <button aria-label="Toggle"
                  onClick={() => toggleRowExpansion(row[rowKey])}
                  className="flex items-center gap-2 text-sm text-indigo-600 hover:text-indigo-800"
                >
                  {expandedRows.has(row[rowKey]) ? (
                    <>
                      <ChevronUp className="h-4 w-4" />
                      Show Less
                    </>
                  ) : (
                    <>
                      <ChevronDown className="h-4 w-4" />
                      Show More
                    </>
                  )}
                </button>

                <AnimatePresence>
                  {expandedRows.has(row[rowKey]) && (
                    <motion.div
                      initial={{ opacity: 0, height: 0 }}
                      animate={{ opacity: 1, height: 'auto' }}
                      exit={{ opacity: 0, height: 0 }}
                      className="mt-3 space-y-2"
                    >
                      {columns
                        .filter(col => col.mobileHidden && !col.hidden)
                        .map((column) => (
                          <div key={column.key} className="flex justify-between items-center">
                            <span className="text-sm font-medium text-gray-600">
                              {column.label}:
                            </span>
                            <span className="text-sm text-gray-900 text-right">
                              {column.render
                                ? column.render(row[column.key], row)
                                : row[column.key]
                              }
                            </span>
                          </div>
                        ))}
                    </motion.div>
                  )}
                </AnimatePresence>
              </div>
            )}
          </motion.div>
        ))}
      </div>
    );
  }

  // Desktop Table View
  return (
    <div className={`bg-white rounded-lg shadow-sm overflow-hidden ${className}`}>
      <div className="overflow-x-auto">
        <table className="min-w-full divide-y divide-gray-200">
          <thead className="bg-gray-50">
            <tr>
              {selectable && (
                <th className="px-6 py-3 text-left">
                  <input
                    type="checkbox"
                    checked={selectedRows.length === data.length && data.length > 0}
                    onChange={handleSelectAll}
                    className="h-4 w-4 text-indigo-600 border-gray-300 rounded focus:ring-indigo-500"
                  />
                </th>
              )}

              {visibleColumns.map((column) => (
                <th
                  key={column.key}
                  className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider"
                >
                  {column.sortable ? (
                    <button aria-label="Sort"
                      onClick={() => handleSort(column.key)}
                      className="flex items-center gap-1 hover:text-gray-700"
                    >
                      {column.label}
                      {sortColumn === column.key && (
                        sortDirection === 'asc' ?
                          <ChevronUp className="h-4 w-4" /> :
                          <ChevronDown className="h-4 w-4" />
                      )}
                    </button>
                  ) : (
                    column.label
                  )}
                </th>
              ))}

              {actions.length > 0 && (
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                  Actions
                </th>
              )}
            </tr>
          </thead>

          <tbody className="bg-white divide-y divide-gray-200">
            {data.map((row, index) => (
              <motion.tr
                key={row[rowKey]}
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                transition={{ delay: index * 0.02 }}
                className={`hover:bg-gray-50 ${
                  selectedRows.includes(row[rowKey]) ? 'bg-indigo-50' : ''
                }`}
              >
                {selectable && (
                  <td className="px-6 py-4 whitespace-nowrap">
                    <input
                      type="checkbox"
                      checked={selectedRows.includes(row[rowKey])}
                      onChange={() => handleSelectRow(row[rowKey])}
                      className="h-4 w-4 text-indigo-600 border-gray-300 rounded focus:ring-indigo-500"
                    />
                  </td>
                )}

                {visibleColumns.map((column) => (
                  <td key={column.key} className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">
                    {column.render
                      ? column.render(row[column.key], row)
                      : row[column.key]
                    }
                  </td>
                ))}

                {actions.length > 0 && (
                  <td className="px-6 py-4 whitespace-nowrap text-sm font-medium">
                    <div className="flex items-center gap-2">
                      {actions.map((action) => {
                        const Icon = action.icon || getActionIcon(action.key);
                        return (
                          <button aria-label="Close"
                            key={action.key}
                            onClick={() => action.onClick(row)}
                            className={`p-1 rounded transition-colors ${getActionVariant(action.variant)}`}
                            title={action.label}
                          >
                            <Icon className="h-4 w-4" />
                          </button>
                        );
                      })}
                    </div>
                  </td>
                )}
              </motion.tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
};

export default ResponsiveTable;