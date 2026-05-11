import React, { useState } from 'react';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '../ui/dialog';
import { Button } from '../ui/button';
import { Input } from '../ui/Input';
import { Select } from '../ui/Select';
import { Checkbox } from '../ui/checkbox';
import { Calendar } from '../ui/calendar';
import { Popover, PopoverContent, PopoverTrigger } from '../ui/popover';
import { CalendarIcon, Download, FileText, Table, FileSpreadsheet } from 'lucide-react';
import { format } from 'date-fns';
import { exportService, ExportData, ExportOptions } from '../../services/exportService';
import { useToast } from '@/components/ui/use-toast';
import { useCurrentUser } from '../../hooks/useCurrentUser';

interface ExportModalProps {
  isOpen: boolean;
  onClose: () => void;
  properties: unknown[];
  groups: unknown[];
}

const EXPORT_FORMATS = [
  { value: 'csv', label: 'CSV', icon: Table, description: 'Comma-separated values (best for Excel)' },
  { value: 'excel', label: 'Excel', icon: FileSpreadsheet, description: 'Multi-sheet Excel workbook' },
  { value: 'pdf', label: 'PDF Report', icon: FileText, description: 'Formatted PDF report' }
];

export const ExportModal: React.FC<ExportModalProps> = ({
  isOpen,
  onClose,
  properties,
  groups
}) => {
  const { toast } = useToast();
  const { data: currentUser } = useCurrentUser();
  const [exportOptions, setExportOptions] = useState<ExportOptions>({
    format: 'excel',
    filename: `property_export_${format(new Date(), 'yyyy-MM-dd')}`,
    includeAnalytics: true
  });
  const [isExporting, setIsExporting] = useState(false);
  const [dateRange, setDateRange] = useState<{
    start: Date | undefined;
    end: Date | undefined;
  }>({
    start: undefined,
    end: undefined
  });
  const [includeGroups, setIncludeGroups] = useState(true);
  const [includeProperties, setIncludeProperties] = useState(true);

  const handleExport = async () => {
    if (!includeProperties && !includeGroups) {
      toast({ variant: "destructive", title: "Validation Error", description: "Please select at least one data type to export." });
      return;
    }

    setIsExporting(true);

    try {
      const exportData: ExportData = {
        properties: includeProperties ? properties : undefined,
        groups: includeGroups ? groups : undefined,
        analytics: exportOptions.includeAnalytics
          ? exportService.generateAnalyticsSummary(properties, groups)
          : undefined,
        metadata: {
          exportDate: new Date().toISOString(),
          exportedBy: currentUser?.name || currentUser?.email || 'Admin User',
          totalRecords: (includeProperties ? properties.length : 0) + (includeGroups ? groups.length : 0),
          filters: {
            includeProperties,
            includeGroups,
            dateRange: dateRange.start && dateRange.end ? {
              start: format(dateRange.start, 'yyyy-MM-dd'),
              end: format(dateRange.end, 'yyyy-MM-dd')
            } : undefined
          }
        }
      };

      const finalOptions: ExportOptions = {
        ...exportOptions,
        dateRange: dateRange.start && dateRange.end ? {
          start: format(dateRange.start, 'yyyy-MM-dd'),
          end: format(dateRange.end, 'yyyy-MM-dd')
        } : undefined
      };

      await exportService.exportData(exportData, finalOptions);

      toast({ title: "Success", description: `Export completed! File saved as ${exportOptions.filename}.${exportOptions.format}` });
      onClose();
    } catch {
      toast({ variant: "destructive", title: "Export Failed", description: "Something went wrong. Please try again." });
    } finally {
      setIsExporting(false);
    }
  };

  const handleFormatChange = (format: 'csv' | 'excel' | 'pdf') => {
    setExportOptions(prev => ({
      ...prev,
      format,
      filename: `property_export_${format(new Date(), 'yyyy-MM-dd')}`
    }));
  };

  const selectedFormat = EXPORT_FORMATS.find(f => f.value === exportOptions.format);

  return (
    <Dialog open={isOpen} onOpenChange={onClose}>
      <DialogContent className="max-w-2xl">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Download className="h-5 w-5" />
            Export Property Data
          </DialogTitle>
        </DialogHeader>

        <div className="space-y-6">
          {/* Export Format Selection */}
          <div className="space-y-3">
            <label className="text-sm font-medium">Export Format</label>
            <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
              {EXPORT_FORMATS.map((format) => {
                const Icon = format.icon;
                return (
                  <button aria-label="Close"
                    key={format.value}
                    type="button"
                    onClick={() => handleFormatChange(format.value as unknown)}
                    className={`p-4 border rounded-lg text-left transition-colors ${
                      exportOptions.format === format.value
                        ? 'border-blue-500 bg-blue-50 text-blue-700'
                        : 'border-gray-200 hover:border-gray-300 hover:bg-gray-50'
                    }`}
                  >
                    <div className="flex items-center gap-3 mb-2">
                      <Icon className="h-5 w-5" />
                      <span className="font-medium">{format.label}</span>
                    </div>
                    <p className="text-sm text-gray-600">{format.description}</p>
                  </button>
                );
              })}
            </div>
          </div>

          {/* Data Selection */}
          <div className="space-y-3">
            <label className="text-sm font-medium">Data to Include</label>
            <div className="space-y-2">
              <div className="flex items-center space-x-2">
                <Checkbox
                  id="include-properties"
                  checked={includeProperties}
                  onCheckedChange={setIncludeProperties}
                />
                <label htmlFor="include-properties" className="text-sm">
                  Properties ({properties.length} records)
                </label>
              </div>
              <div className="flex items-center space-x-2">
                <Checkbox
                  id="include-groups"
                  checked={includeGroups}
                  onCheckedChange={setIncludeGroups}
                />
                <label htmlFor="include-groups" className="text-sm">
                  Property Groups ({groups.length} records)
                </label>
              </div>
              <div className="flex items-center space-x-2">
                <Checkbox
                  id="include-analytics"
                  checked={exportOptions.includeAnalytics}
                  onCheckedChange={(checked) =>
                    setExportOptions(prev => ({ ...prev, includeAnalytics: checked as boolean }))
                  }
                />
                <label htmlFor="include-analytics" className="text-sm">
                  Include Analytics Summary
                </label>
              </div>
            </div>
          </div>

          {/* Date Range Filter (Optional) */}
          <div className="space-y-3">
            <label className="text-sm font-medium">Date Range Filter (Optional)</label>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
              <div>
                <label className="text-xs text-gray-500 mb-1 block">Start Date</label>
                <Popover>
                  <PopoverTrigger asChild>
                    <Button
                      variant="outline"
                      className="w-full justify-start text-left font-normal"
                    >
                      <CalendarIcon className="mr-2 h-4 w-4" />
                      {dateRange.start ? format(dateRange.start, 'PPP') : 'Select start date'}
                    </Button>
                  </PopoverTrigger>
                  <PopoverContent className="w-auto p-0">
                    <Calendar
                      mode="single"
                      selected={dateRange.start}
                      onSelect={(date) => setDateRange(prev => ({ ...prev, start: date }))}
                      initialFocus
                    />
                  </PopoverContent>
                </Popover>
              </div>
              <div>
                <label className="text-xs text-gray-500 mb-1 block">End Date</label>
                <Popover>
                  <PopoverTrigger asChild>
                    <Button
                      variant="outline"
                      className="w-full justify-start text-left font-normal"
                    >
                      <CalendarIcon className="mr-2 h-4 w-4" />
                      {dateRange.end ? format(dateRange.end, 'PPP') : 'Select end date'}
                    </Button>
                  </PopoverTrigger>
                  <PopoverContent className="w-auto p-0">
                    <Calendar
                      mode="single"
                      selected={dateRange.end}
                      onSelect={(date) => setDateRange(prev => ({ ...prev, end: date }))}
                      initialFocus
                    />
                  </PopoverContent>
                </Popover>
              </div>
            </div>
          </div>

          {/* Filename */}
          <div className="space-y-2">
            <label className="text-sm font-medium">Filename</label>
            <Input
              value={exportOptions.filename}
              onChange={(e) =>
                setExportOptions(prev => ({ ...prev, filename: e.target.value }))
              }
              placeholder="Enter filename (without extension)"
            />
            <p className="text-xs text-gray-500">
              File will be saved as: {exportOptions.filename}.{exportOptions.format}
            </p>
          </div>

          {/* Export Summary */}
          <div className="bg-gray-50 p-4 rounded-lg">
            <h4 className="font-medium mb-2">Export Summary</h4>
            <div className="space-y-1 text-sm text-gray-600">
              <div>Format: {selectedFormat?.label}</div>
              <div>
                Records: {(includeProperties ? properties.length : 0) + (includeGroups ? groups.length : 0)} total
              </div>
              {dateRange.start && dateRange.end && (
                <div>
                  Date Range: {format(dateRange.start, 'MMM dd, yyyy')} - {format(dateRange.end, 'MMM dd, yyyy')}
                </div>
              )}
              <div>Analytics: {exportOptions.includeAnalytics ? 'Included' : 'Not included'}</div>
            </div>
          </div>

          {/* Action Buttons */}
          <div className="flex justify-end gap-3 pt-4 border-t">
            <Button
              type="button"
              variant="outline"
              onClick={onClose}
              disabled={isExporting}
            >
              Cancel
            </Button>
            <Button
              onClick={handleExport}
              disabled={isExporting || (!includeProperties && !includeGroups)}
              className="min-w-[120px]"
            >
              {isExporting ? (
                <>
                  <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-white mr-2" />
                  Exporting...
                </>
              ) : (
                <>
                  <Download className="h-4 w-4 mr-2" />
                  Export
                </>
              )}
            </Button>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
};