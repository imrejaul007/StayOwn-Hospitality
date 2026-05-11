import React, { useState } from 'react';
import { Download, X, FileText, Image, Table, Calendar, Filter, Settings } from 'lucide-react';
import { FilterCriteria } from './MultiCriteriaFilter';
import { DateRange } from './DateRangeSelector';

export interface ExportOptions {
  format: 'excel' | 'csv' | 'pdf' | 'json';
  includeCharts: boolean;
  includeRawData: boolean;
  includeSummary: boolean;
  dateRange?: DateRange;
  filters?: FilterCriteria[];
  customFields?: string[];
  fileName?: string;
  orientation?: 'portrait' | 'landscape';
  pageSize?: 'A4' | 'Letter' | 'Legal';
}

export interface ExportOptionsModalProps {
  isOpen: boolean;
  onClose: () => void;
  onExport: (options: ExportOptions) => void;
  availableFields?: { key: string; label: string }[];
  currentFilters?: FilterCriteria[];
  currentDateRange?: DateRange;
  loading?: boolean;
  className?: string;
}

const formatOptions = [
  {
    value: 'excel',
    label: 'Excel Spreadsheet',
    description: 'Excel file (.xlsx) with multiple sheets and formatting',
    icon: Table,
    supportsCharts: true,
    supportsMultipleSheets: true
  },
  {
    value: 'csv',
    label: 'CSV File',
    description: 'Comma-separated values file for data analysis',
    icon: FileText,
    supportsCharts: false,
    supportsMultipleSheets: false
  },
  {
    value: 'pdf',
    label: 'PDF Report',
    description: 'Formatted PDF document with charts and summaries',
    icon: Image,
    supportsCharts: true,
    supportsMultipleSheets: false
  },
  {
    value: 'json',
    label: 'JSON Data',
    description: 'Raw data in JSON format for API integration',
    icon: Settings,
    supportsCharts: false,
    supportsMultipleSheets: false
  }
];

const ExportOptionsModal: React.FC<ExportOptionsModalProps> = ({
  isOpen,
  onClose,
  onExport,
  availableFields = [],
  currentFilters = [],
  currentDateRange,
  loading = false,
  className = ''
}) => {
  const [options, setOptions] = useState<ExportOptions>({
    format: 'excel',
    includeCharts: true,
    includeRawData: true,
    includeSummary: true,
    dateRange: currentDateRange,
    filters: currentFilters,
    customFields: availableFields.map(f => f.key),
    fileName: `travel-agent-export-${new Date().toISOString().split('T')[0]}`,
    orientation: 'landscape',
    pageSize: 'A4'
  });

  const selectedFormat = formatOptions.find(f => f.value === options.format);

  const handleExport = () => {
    onExport(options);
  };

  const updateOptions = (updates: Partial<ExportOptions>) => {
    setOptions(prev => ({ ...prev, ...updates }));
  };

  const toggleField = (fieldKey: string) => {
    const currentFields = options.customFields || [];
    const newFields = currentFields.includes(fieldKey)
      ? currentFields.filter(f => f !== fieldKey)
      : [...currentFields, fieldKey];
    updateOptions({ customFields: newFields });
  };

  const selectAllFields = () => {
    updateOptions({ customFields: availableFields.map(f => f.key) });
  };

  const deselectAllFields = () => {
    updateOptions({ customFields: [] });
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
      <div className={`bg-white rounded-lg shadow-xl max-w-2xl w-full mx-4 max-h-[90vh] overflow-y-auto ${className}`}>
        <div className="sticky top-0 bg-white border-b border-gray-200 px-6 py-4">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <Download className="h-5 w-5 text-indigo-600" />
              <h2 className="text-lg font-semibold text-gray-900">Export Options</h2>
            </div>
            <button aria-label="Close"
              onClick={onClose}
              className="text-gray-400 hover:text-gray-600 transition-colors"
            >
              <X className="h-5 w-5" />
            </button>
          </div>
        </div>

        <div className="p-6 space-y-6">
          {/* Format Selection */}
          <div>
            <h3 className="text-sm font-medium text-gray-900 mb-3">Export Format</h3>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
              {formatOptions.map((format) => {
                const Icon = format.icon;
                return (
                  <button aria-label="Favorite"
                    key={format.value}
                    onClick={() => updateOptions({ format: format.value as ExportOptions['format'] })}
                    className={`p-4 text-left border rounded-lg transition-colors ${
                      options.format === format.value
                        ? 'border-indigo-500 bg-indigo-50 text-indigo-700'
                        : 'border-gray-200 hover:border-gray-300'
                    }`}
                  >
                    <div className="flex items-start gap-3">
                      <Icon className={`h-5 w-5 mt-0.5 ${
                        options.format === format.value ? 'text-indigo-600' : 'text-gray-500'
                      }`} />
                      <div>
                        <p className="font-medium">{format.label}</p>
                        <p className="text-sm text-gray-600 mt-1">{format.description}</p>
                      </div>
                    </div>
                  </button>
                );
              })}
            </div>
          </div>

          {/* Content Options */}
          <div>
            <h3 className="text-sm font-medium text-gray-900 mb-3">Content Options</h3>
            <div className="space-y-3">
              <label className="flex items-center gap-3">
                <input
                  type="checkbox"
                  checked={options.includeRawData}
                  onChange={(e) => updateOptions({ includeRawData: e.target.checked })}
                  className="h-4 w-4 text-indigo-600 border-gray-300 rounded focus:ring-indigo-500"
                />
                <div>
                  <span className="text-sm font-medium text-gray-900">Include Raw Data</span>
                  <p className="text-xs text-gray-600">Export detailed booking and commission data</p>
                </div>
              </label>

              <label className="flex items-center gap-3">
                <input
                  type="checkbox"
                  checked={options.includeSummary}
                  onChange={(e) => updateOptions({ includeSummary: e.target.checked })}
                  className="h-4 w-4 text-indigo-600 border-gray-300 rounded focus:ring-indigo-500"
                />
                <div>
                  <span className="text-sm font-medium text-gray-900">Include Summary</span>
                  <p className="text-xs text-gray-600">Add summary statistics and totals</p>
                </div>
              </label>

              {selectedFormat?.supportsCharts && (
                <label className="flex items-center gap-3">
                  <input
                    type="checkbox"
                    checked={options.includeCharts}
                    onChange={(e) => updateOptions({ includeCharts: e.target.checked })}
                    className="h-4 w-4 text-indigo-600 border-gray-300 rounded focus:ring-indigo-500"
                  />
                  <div>
                    <span className="text-sm font-medium text-gray-900">Include Charts</span>
                    <p className="text-xs text-gray-600">Export visual charts and graphs</p>
                  </div>
                </label>
              )}
            </div>
          </div>

          {/* Field Selection */}
          {availableFields.length > 0 && (
            <div>
              <div className="flex items-center justify-between mb-3">
                <h3 className="text-sm font-medium text-gray-900">Fields to Export</h3>
                <div className="flex gap-2">
                  <button
                    onClick={selectAllFields}
                    className="text-xs text-indigo-600 hover:text-indigo-800"
                  >
                    Select All
                  </button>
                  <button
                    onClick={deselectAllFields}
                    className="text-xs text-gray-600 hover:text-gray-800"
                  >
                    Deselect All
                  </button>
                </div>
              </div>
              <div className="max-h-40 overflow-y-auto border border-gray-200 rounded-lg p-3">
                <div className="grid grid-cols-2 gap-2">
                  {availableFields.map((field) => (
                    <label key={field.key} className="flex items-center gap-2">
                      <input
                        type="checkbox"
                        checked={options.customFields?.includes(field.key) || false}
                        onChange={() => toggleField(field.key)}
                        className="h-4 w-4 text-indigo-600 border-gray-300 rounded focus:ring-indigo-500"
                      />
                      <span className="text-sm text-gray-700">{field.label}</span>
                    </label>
                  ))}
                </div>
              </div>
            </div>
          )}

          {/* PDF Options */}
          {options.format === 'pdf' && (
            <div>
              <h3 className="text-sm font-medium text-gray-900 mb-3">PDF Options</h3>
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-xs font-medium text-gray-700 mb-1">
                    Orientation
                  </label>
                  <select
                    value={options.orientation}
                    onChange={(e) => updateOptions({ orientation: e.target.value as 'portrait' | 'landscape' })}
                    className="w-full px-3 py-2 text-sm border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:border-transparent"
                  >
                    <option value="portrait">Portrait</option>
                    <option value="landscape">Landscape</option>
                  </select>
                </div>
                <div>
                  <label className="block text-xs font-medium text-gray-700 mb-1">
                    Page Size
                  </label>
                  <select
                    value={options.pageSize}
                    onChange={(e) => updateOptions({ pageSize: e.target.value as 'A4' | 'Letter' | 'Legal' })}
                    className="w-full px-3 py-2 text-sm border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:border-transparent"
                  >
                    <option value="A4">A4</option>
                    <option value="Letter">Letter</option>
                    <option value="Legal">Legal</option>
                  </select>
                </div>
              </div>
            </div>
          )}

          {/* File Name */}
          <div>
            <label className="block text-sm font-medium text-gray-900 mb-1">
              File Name
            </label>
            <input
              type="text"
              value={options.fileName}
              onChange={(e) => updateOptions({ fileName: e.target.value })}
              placeholder="Enter file name"
              className="w-full px-3 py-2 text-sm border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:border-transparent"
            />
          </div>

          {/* Current Filters Info */}
          {(currentFilters.length > 0 || currentDateRange) && (
            <div className="bg-gray-50 rounded-lg p-4">
              <div className="flex items-center gap-2 mb-2">
                <Filter className="h-4 w-4 text-gray-600" />
                <span className="text-sm font-medium text-gray-900">Current Filters</span>
              </div>
              <div className="space-y-1 text-sm text-gray-600">
                {currentDateRange && currentDateRange.start && currentDateRange.end && (
                  <div className="flex items-center gap-2">
                    <Calendar className="h-3 w-3" />
                    <span>
                      Date: {currentDateRange.start} to {currentDateRange.end}
                    </span>
                  </div>
                )}
                {currentFilters.map((filter, index) => (
                  <div key={`currentFilters-${index}-${filter.label}`} className="flex items-center gap-2">
                    <Filter className="h-3 w-3" />
                    <span>{filter.label || `${filter.field} ${filter.operator} ${filter.value}`}</span>
                  </div>
                ))}
              </div>
              <p className="text-xs text-gray-500 mt-2">
                These filters will be applied to the exported data
              </p>
            </div>
          )}
        </div>

        {/* Footer */}
        <div className="sticky bottom-0 bg-gray-50 border-t border-gray-200 px-6 py-4">
          <div className="flex justify-between items-center">
            <p className="text-sm text-gray-600">
              {selectedFormat?.label} • {options.customFields?.length || 0} fields selected
            </p>
            <div className="flex gap-3">
              <button
                onClick={onClose}
                className="px-4 py-2 text-sm font-medium text-gray-700 border border-gray-300 rounded-md hover:bg-gray-50 transition-colors"
              >
                Cancel
              </button>
              <button aria-label="Download"
                onClick={handleExport}
                disabled={loading || !options.fileName?.trim()}
                className="flex items-center gap-2 px-4 py-2 text-sm font-medium text-white bg-indigo-600 rounded-md hover:bg-indigo-700 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
              >
                {loading ? (
                  <>
                    <div className="animate-spin rounded-full h-4 w-4 border-2 border-white border-t-transparent"></div>
                    Exporting...
                  </>
                ) : (
                  <>
                    <Download className="h-4 w-4" />
                    Export Data
                  </>
                )}
              </button>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};

export default ExportOptionsModal;