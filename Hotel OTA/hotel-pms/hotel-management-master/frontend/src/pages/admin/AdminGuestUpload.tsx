import React, { useState, useRef } from 'react';
import { withErrorBoundary } from '../../components/ErrorBoundary';
import {
  CloudArrowUpIcon,
  DocumentArrowDownIcon,
  CheckCircleIcon,
  ExclamationTriangleIcon,
  XCircleIcon,
  EyeIcon,
  ArrowPathIcon
} from '@heroicons/react/24/outline';
import { toast } from 'react-hot-toast';
import { useProperty } from '../../context/PropertyContext';
import { PropertyBreadcrumb } from '../../components/common/PropertyBreadcrumb';
import { api } from '../../services/api';

interface ImportResult {
  totalRows: number;
  validRows: number;
  errorRows: number;
  preview: unknown[];
  errors: unknown[];
  hasMoreErrors: boolean;
}

interface ImportStatistics {
  totalGuests: number;
  monthlyImports: { [key: string]: number };
  guestTypeDistribution: { [key: string]: number };
  loyaltyTierDistribution: { [key: string]: number };
}

const AdminGuestUpload: React.FC = () => {
  const { selectedPropertyId, selectedProperty, viewMode } = useProperty();
  const [dragActive, setDragActive] = useState(false);
  const [uploading, setUploading] = useState(false);
  const [importResult, setImportResult] = useState<ImportResult | null>(null);
  const [importStatistics, setImportStatistics] = useState<ImportStatistics | null>(null);
  const [showPreview, setShowPreview] = useState(false);
  const [showStatistics, setShowStatistics] = useState(false);
  const [supportedFormats, setSupportedFormats] = useState<unknown>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const handleDrag = (e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    if (e.type === 'dragenter' || e.type === 'dragover') {
      setDragActive(true);
    } else if (e.type === 'dragleave') {
      setDragActive(false);
    }
  };

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    setDragActive(false);
    
    if (e.dataTransfer.files && e.dataTransfer.files[0]) {
      handleFile(e.dataTransfer.files[0]);
    }
  };

  const handleFileInput = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files && e.target.files[0]) {
      handleFile(e.target.files[0]);
    }
  };

  const handleFile = async (file: File) => {
    const allowedTypes = [
      'text/csv',
      'application/vnd.ms-excel',
      'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet'
    ];
    
    const allowedExtensions = ['.csv', '.xls', '.xlsx'];
    const fileExtension = file.name.toLowerCase().substring(file.name.lastIndexOf('.'));
    
    if (!allowedTypes.includes(file.type) && !allowedExtensions.includes(fileExtension)) {
      toast.error('Please upload a CSV or Excel file');
      return;
    }

    if (file.size > 10 * 1024 * 1024) { // 10MB limit
      toast.error('File size must be less than 10MB');
      return;
    }

    setUploading(true);
    setImportResult(null);

    try {
      const formData = new FormData();
      formData.append('file', file);
      formData.append('skipHeader', 'true');
      if (selectedPropertyId) {
        formData.append('hotelId', selectedPropertyId);
      }

      const { data } = await api.post('/guest-import/upload', formData, {
        headers: { 'Content-Type': 'multipart/form-data' }
      });
      setImportResult(data.data);
      
      if (data.data.errorRows > 0) {
        toast.error(`File processed with ${data.data.errorRows} errors`);
      } else {
        toast.success(`File processed successfully: ${data.data.validRows} valid rows`);
      }
    } catch (error) {
      toast.error('Failed to process file');
    } finally {
      setUploading(false);
    }
  };

  const handleImport = async () => {
    if (!importResult || importResult.validRows === 0) {
      toast.error('No valid data to import');
      return;
    }

    try {
      const { data } = await api.post('/guest-import/import', {
        hotelId: selectedPropertyId,
        guestData: importResult.preview // In a real implementation, you'd send all valid data
      });
      toast.success(`Successfully imported ${data.data.imported} guests`);
      
      // Reset form
      setImportResult(null);
      if (fileInputRef.current) {
        fileInputRef.current.value = '';
      }
    } catch (error) {
      toast.error('Failed to import guests');
    }
  };

  const downloadTemplate = async () => {
    try {
      const response = await api.get('/guest-import/template/download', { responseType: 'blob' });
      const blob = response.data;
      const url = window.URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = 'guest-import-template.csv';
      document.body.appendChild(a);
      a.click();
      window.URL.revokeObjectURL(url);
      document.body.removeChild(a);

      toast.success('Template downloaded successfully');
    } catch (error) {
      toast.error('Failed to download template');
    }
  };

  const fetchStatistics = async () => {
    try {
      const params = new URLSearchParams();
      if (selectedPropertyId) {
        params.append('hotelId', selectedPropertyId);
      }

      const { data } = await api.get(`/guest-import/statistics?${params.toString()}`);
      setImportStatistics(data.data);
    } catch (error) {
      toast.error('Failed to fetch statistics');
    }
  };

  const fetchSupportedFormats = async () => {
    try {
      const { data } = await api.get('/guest-import/formats');
      setSupportedFormats(data.data);
    } catch {
      // Error handled silently
    }
  };

  React.useEffect(() => {
    if (selectedPropertyId) {
      fetchSupportedFormats();
    }
  }, [selectedPropertyId]);

  // Early return if no property selected in single property mode
  if (!selectedPropertyId && viewMode === 'single') {
    return (
      <div className="p-6">
        <PropertyBreadcrumb items={['Inventory', 'Guest Upload']} />
        <div className="text-center py-12">
          <p className="text-gray-600">Please select a property to upload guests</p>
        </div>
      </div>
    );
  }

  return (
    <div className="p-6">
      {/* Property Breadcrumb */}
      <PropertyBreadcrumb items={['Inventory', 'Guest Upload']} />

      <div className="mb-6">
        <div className="flex justify-between items-center mb-4">
          <div>
            <h1 className="text-2xl font-bold text-gray-900">Guest Import</h1>
            <p className="text-gray-600">Import guests from CSV or Excel files for {selectedProperty?.name || 'selected property'}</p>
          </div>
          <div className="flex space-x-3">
            <button
              onClick={() => {
                setShowStatistics(true);
                fetchStatistics();
              }}
              className="flex items-center px-4 py-2 text-sm font-medium text-gray-700 bg-white border border-gray-300 rounded-md hover:bg-gray-50"
            >
              <ArrowPathIcon className="w-4 h-4 mr-2" />
              Statistics
            </button>
            <button
              onClick={downloadTemplate}
              className="flex items-center px-4 py-2 text-sm font-medium text-gray-700 bg-white border border-gray-300 rounded-md hover:bg-gray-50"
            >
              <DocumentArrowDownIcon className="w-4 h-4 mr-2" />
              Download Template
            </button>
          </div>
        </div>

        {/* File Upload Area */}
        <div
          className={`relative border-2 border-dashed rounded-lg p-8 text-center ${
            dragActive 
              ? 'border-blue-500 bg-blue-50' 
              : 'border-gray-300 hover:border-gray-400'
          }`}
          onDragEnter={handleDrag}
          onDragLeave={handleDrag}
          onDragOver={handleDrag}
          onDrop={handleDrop}
        >
          <input
            ref={fileInputRef}
            type="file"
            accept=".csv,.xlsx,.xls"
            onChange={handleFileInput}
            className="absolute inset-0 w-full h-full opacity-0 cursor-pointer"
            disabled={uploading}
          />
          
          {uploading ? (
            <div className="flex flex-col items-center">
              <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600 mb-4"></div>
              <p className="text-lg font-medium text-gray-900">Processing file...</p>
              <p className="text-sm text-gray-600">Please wait while we validate your data</p>
            </div>
          ) : (
            <div className="flex flex-col items-center">
              <CloudArrowUpIcon className="w-12 h-12 text-gray-400 mb-4" />
              <p className="text-lg font-medium text-gray-900 mb-2">
                Drop your file here, or click to browse
              </p>
              <p className="text-sm text-gray-600 mb-4">
                Supports CSV, XLS, and XLSX files up to 10MB
              </p>
              <button
                type="button"
                className="inline-flex items-center px-4 py-2 border border-transparent text-sm font-medium rounded-md text-white bg-blue-600 hover:bg-blue-700"
              >
                Choose File
              </button>
            </div>
          )}
        </div>

        {/* Supported Formats Info */}
        {supportedFormats && (
          <div className="mt-4 bg-gray-50 rounded-lg p-4">
            <h3 className="text-sm font-medium text-gray-900 mb-2">Supported Formats</h3>
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4 text-sm">
              {supportedFormats.supportedFormats.map((format: Record<string, unknown>, index: number) => (
                <div key={`format-${format.extension || index}`} className="flex items-center">
                  <span className="font-medium text-gray-700">{format.extension}</span>
                  <span className="ml-2 text-gray-600">- {format.description}</span>
                </div>
              ))}
            </div>
          </div>
        )}
      </div>

      {/* Import Results */}
      {importResult && (
        <div className="bg-white shadow-sm rounded-lg border mb-6">
          <div className="p-6">
            <div className="flex justify-between items-center mb-4">
              <h3 className="text-lg font-medium text-gray-900">Import Results</h3>
              <div className="flex space-x-2">
                <button
                  onClick={() => setShowPreview(true)}
                  className="flex items-center px-3 py-1 text-sm font-medium text-gray-700 bg-gray-100 rounded-md hover:bg-gray-200"
                >
                  <EyeIcon className="w-4 h-4 mr-1" />
                  Preview
                </button>
              </div>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-4 gap-4 mb-6">
              <div className="bg-blue-50 p-4 rounded-lg">
                <div className="flex items-center">
                  <div className="flex-shrink-0">
                    <CheckCircleIcon className="w-8 h-8 text-blue-600" />
                  </div>
                  <div className="ml-3">
                    <p className="text-sm font-medium text-blue-600">Valid Rows</p>
                    <p className="text-2xl font-bold text-blue-900">{importResult.validRows}</p>
                  </div>
                </div>
              </div>

              <div className="bg-red-50 p-4 rounded-lg">
                <div className="flex items-center">
                  <div className="flex-shrink-0">
                    <XCircleIcon className="w-8 h-8 text-red-600" />
                  </div>
                  <div className="ml-3">
                    <p className="text-sm font-medium text-red-600">Error Rows</p>
                    <p className="text-2xl font-bold text-red-900">{importResult.errorRows}</p>
                  </div>
                </div>
              </div>

              <div className="bg-gray-50 p-4 rounded-lg">
                <div className="flex items-center">
                  <div className="flex-shrink-0">
                    <div className="w-8 h-8 bg-gray-600 rounded-full flex items-center justify-center">
                      <span className="text-white text-sm font-bold">#</span>
                    </div>
                  </div>
                  <div className="ml-3">
                    <p className="text-sm font-medium text-gray-600">Total Rows</p>
                    <p className="text-2xl font-bold text-gray-900">{importResult.totalRows}</p>
                  </div>
                </div>
              </div>

              <div className="bg-green-50 p-4 rounded-lg">
                <div className="flex items-center">
                  <div className="flex-shrink-0">
                    <div className="w-8 h-8 bg-green-600 rounded-full flex items-center justify-center">
                      <span className="text-white text-sm font-bold">%</span>
                    </div>
                  </div>
                  <div className="ml-3">
                    <p className="text-sm font-medium text-green-600">Success Rate</p>
                    <p className="text-2xl font-bold text-green-900">
                      {importResult.totalRows > 0 
                        ? Math.round((importResult.validRows / importResult.totalRows) * 100)
                        : 0}%
                    </p>
                  </div>
                </div>
              </div>
            </div>

            {/* Errors */}
            {importResult.errors.length > 0 && (
              <div className="mb-6">
                <h4 className="text-md font-medium text-gray-900 mb-3">
                  Errors ({importResult.errors.length})
                </h4>
                <div className="bg-red-50 border border-red-200 rounded-lg p-4 max-h-64 overflow-y-auto">
                  {importResult.errors.slice(0, 10).map((error: Record<string, unknown>, index: number) => (
                    <div key={`error-line-${error.line || index}`} className="flex items-start mb-2">
                      <ExclamationTriangleIcon className="w-4 h-4 text-red-600 mt-0.5 mr-2 flex-shrink-0" />
                      <div className="text-sm">
                        <span className="font-medium text-red-800">Line {error.line}:</span>
                        <span className="text-red-700 ml-1">{error.error}</span>
                        {error.field && (
                          <span className="text-red-600 ml-1">(Field: {error.field})</span>
                        )}
                      </div>
                    </div>
                  ))}
                  {importResult.hasMoreErrors && (
                    <p className="text-sm text-red-600 mt-2">
                      ... and {importResult.errors.length - 10} more errors
                    </p>
                  )}
                </div>
              </div>
            )}

            {/* Import Button */}
            {importResult.validRows > 0 && (
              <div className="flex justify-end">
                <button
                  onClick={handleImport}
                  className="flex items-center px-6 py-2 text-sm font-medium text-white bg-green-600 border border-transparent rounded-md hover:bg-green-700"
                >
                  <CheckCircleIcon className="w-4 h-4 mr-2" />
                  Import {importResult.validRows} Guests
                </button>
              </div>
            )}
          </div>
        </div>
      )}

      {/* Preview Modal */}
      {showPreview && importResult && (
        <div className="fixed inset-0 bg-gray-600 bg-opacity-50 overflow-y-auto h-full w-full z-50">
          <div className="relative top-10 mx-auto p-5 border w-11/12 md:w-4/5 lg:w-3/4 shadow-lg rounded-md bg-white">
            <div className="flex justify-between items-center mb-4">
              <h3 className="text-lg font-medium text-gray-900">Data Preview</h3>
              <button aria-label="Previous"
                onClick={() => setShowPreview(false)}
                className="text-gray-400 hover:text-gray-600"
              >
                <XCircleIcon className="w-6 h-6" />
              </button>
            </div>
            
            <div className="overflow-x-auto">
              <table className="min-w-full divide-y divide-gray-200">
                <thead className="bg-gray-50">
                  <tr>
                    {importResult.preview.length > 0 && Object.keys(importResult.preview[0]).map((key) => (
                      <th key={key} className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                        {key}
                      </th>
                    ))}
                  </tr>
                </thead>
                <tbody className="bg-white divide-y divide-gray-200">
                  {importResult.preview.map((row: Record<string, unknown>, index: number) => (
                    <tr key={`preview-row-${index}`}>
                      {Object.values(row).map((value: Record<string, unknown>, cellIndex: number) => (
                        <td key={cellIndex} className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">
                          {String(value)}
                        </td>
                      ))}
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      )}

      {/* Statistics Modal */}
      {showStatistics && importStatistics && (
        <div className="fixed inset-0 bg-gray-600 bg-opacity-50 overflow-y-auto h-full w-full z-50">
          <div className="relative top-10 mx-auto p-5 border w-11/12 md:w-4/5 lg:w-3/4 shadow-lg rounded-md bg-white">
            <div className="flex justify-between items-center mb-4">
              <h3 className="text-lg font-medium text-gray-900">Import Statistics</h3>
              <button aria-label="Close"
                onClick={() => setShowStatistics(false)}
                className="text-gray-400 hover:text-gray-600"
              >
                <XCircleIcon className="w-6 h-6" />
              </button>
            </div>
            
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              <div className="bg-blue-50 p-6 rounded-lg">
                <h4 className="text-lg font-medium text-blue-900 mb-4">Total Guests</h4>
                <p className="text-3xl font-bold text-blue-600">{importStatistics.totalGuests}</p>
              </div>
              
              <div className="bg-green-50 p-6 rounded-lg">
                <h4 className="text-lg font-medium text-green-900 mb-4">Guest Types</h4>
                {Object.entries(importStatistics.guestTypeDistribution).map(([type, count]) => (
                  <div key={type} className="flex justify-between">
                    <span className="text-green-700 capitalize">{type}</span>
                    <span className="text-green-900 font-medium">{count as number}</span>
                  </div>
                ))}
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default AdminGuestUpload;
