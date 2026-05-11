import React, { useState } from 'react';
import toast from 'react-hot-toast';
import { cn } from '../../utils/cn';
import { Button } from '@/components/ui/button';
import { Modal } from '@/components/ui/Modal';
import { useExportData } from '../../hooks/useDashboard';
import { downloadBlob, generateExportFilename } from '../../utils/dashboardUtils';

interface ExportButtonProps {
  endpoint: string;
  data?: unknown;
  filename?: string;
  formats?: ('csv' | 'excel' | 'pdf')[];
  params?: Record<string, string>;
  size?: 'sm' | 'md' | 'lg';
  variant?: 'primary' | 'secondary' | 'ghost';
  className?: string;
}

export function ExportButton({
  endpoint,
  data,
  filename,
  formats = ['csv', 'excel', 'pdf'],
  params = {},
  size = 'sm',
  variant = 'ghost',
  className,
}: ExportButtonProps) {
  const [showModal, setShowModal] = useState(false);
  const exportMutation = useExportData();

  const handleExport = async (format: 'csv' | 'excel' | 'pdf') => {
    try {
      const blob = await exportMutation.mutateAsync({
        endpoint,
        format,
        params,
      });

      const exportFilename = filename || generateExportFilename(
        endpoint,
        params.hotelId,
        params.startDate && params.endDate 
          ? { start: params.startDate, end: params.endDate }
          : undefined
      );

      downloadBlob(blob, `${exportFilename}.${format}`);
      setShowModal(false);
    } catch {
      toast.error('Export failed. Please try again.');
    }
  };

  const getFormatIcon = (format: string) => {
    switch (format) {
      case 'csv':
        return (
          <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} 
              d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
          </svg>
        );
      case 'excel':
        return (
          <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} 
              d="M3 7v10a2 2 0 002 2h14a2 2 0 002-2V9a2 2 0 00-2-2H5a2 2 0 00-2-2z" />
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 21v-4a2 2 0 012-2h2a2 2 0 012 2v4" />
          </svg>
        );
      case 'pdf':
        return (
          <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} 
              d="M12 10v6m0 0l-3-3m3 3l3-3m2 8H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
          </svg>
        );
      default:
        return null;
    }
  };

  const getFormatDescription = (format: string) => {
    switch (format) {
      case 'csv':
        return 'Comma-separated values, perfect for spreadsheet applications';
      case 'excel':
        return 'Microsoft Excel format with formatting and multiple sheets';
      case 'pdf':
        return 'Portable document format, ready for printing and sharing';
      default:
        return '';
    }
  };

  if (formats.length === 1) {
    // Single format - direct export
    return (
      <Button
        variant={variant}
        size={size}
        onClick={() => handleExport(formats[0])}
        loading={exportMutation.isPending}
        className={cn('flex items-center space-x-1', className)}
        title={`Export as ${formats[0].toUpperCase()}`}
      >
        <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} 
            d="M12 10v6m0 0l-3-3m3 3l3-3m2 8H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
        </svg>
        <span className="hidden sm:inline">Export</span>
      </Button>
    );
  }

  return (
    <>
      <Button
        variant={variant}
        size={size}
        onClick={() => setShowModal(true)}
        className={cn('flex items-center space-x-1', className)}
        title="Export data"
      >
        <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} 
            d="M12 10v6m0 0l-3-3m3 3l3-3m2 8H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
        </svg>
        <span className="hidden sm:inline">Export</span>
      </Button>

      <Modal
        isOpen={showModal}
        onClose={() => setShowModal(false)}
        title="Export Data"
      >
        <div className="space-y-4">
          <p className="text-sm text-gray-600">
            Choose your preferred format to export the data:
          </p>

          <div className="grid grid-cols-1 gap-3">
            {formats.map((format) => (
              <button aria-label="View"
                key={format}
                onClick={() => handleExport(format)}
                disabled={exportMutation.isPending}
                className={cn(
                  'flex items-start space-x-3 p-4 border border-gray-200 rounded-lg hover:border-blue-300 hover:bg-blue-50 transition-colors',
                  exportMutation.isPending && 'opacity-50 cursor-not-allowed'
                )}
              >
                <div className="flex-shrink-0 text-blue-600">
                  {getFormatIcon(format)}
                </div>
                <div className="flex-1 text-left">
                  <h4 className="text-sm font-medium text-gray-900 uppercase">
                    {format}
                  </h4>
                  <p className="text-xs text-gray-600 mt-1">
                    {getFormatDescription(format)}
                  </p>
                </div>
                <div className="flex-shrink-0">
                  <svg className="w-5 h-5 text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
                  </svg>
                </div>
              </button>
            ))}
          </div>

          {exportMutation.isPending && (
            <div className="flex items-center justify-center py-4">
              <div className="animate-spin rounded-full h-6 w-6 border-b-2 border-blue-600"></div>
              <span className="ml-2 text-sm text-gray-600">Preparing export...</span>
            </div>
          )}

          <div className="flex justify-end space-x-3 pt-4 border-t border-gray-200">
            <Button
              variant="secondary"
              onClick={() => setShowModal(false)}
              disabled={exportMutation.isPending}
            >
              Cancel
            </Button>
          </div>
        </div>
      </Modal>
    </>
  );
}