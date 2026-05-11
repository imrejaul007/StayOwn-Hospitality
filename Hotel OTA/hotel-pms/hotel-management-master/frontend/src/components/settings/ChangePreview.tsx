import React, { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
  CardDescription
} from '../ui/card';
import { Button } from '../ui/button';
import { Badge } from '../ui/badge';
import { Alert, AlertDescription } from '../ui/alert';
import { api } from '../../services/api';
import {
  Download,
  ChevronDown,
  ChevronRight,
  ArrowRight,
  CheckCircle,
  AlertCircle,
  MinusCircle,
  PlusCircle,
  Building2,
  Loader2
} from 'lucide-react';

interface ChangePreviewProps {
  /**
   * Scope of the change preview
   */
  scope: 'single' | 'group' | 'all';

  /**
   * Property ID (required for single scope)
   */
  propertyId?: string;

  /**
   * Group ID (required for group scope)
   */
  groupId?: string;

  /**
   * Setting type being changed
   */
  settingType: string;

  /**
   * The actual settings updates to preview
   */
  settingUpdates: Record<string, unknown>;

  /**
   * Callback when user confirms the changes
   */
  onApply?: () => void;

  /**
   * Callback when user cancels
   */
  onCancel?: () => void;

  /**
   * Whether to show action buttons
   */
  showActions?: boolean;

  /**
   * Additional CSS classes
   */
  className?: string;
}

interface PropertyPreview {
  propertyId: string;
  propertyName: string;
  currentValues: Record<string, unknown>;
  newValues: Record<string, unknown>;
  changes: Array<{
    field: string;
    currentValue: unknown;
    newValue: unknown;
    status: 'added' | 'modified' | 'deleted';
  }>;
  hasChanges: boolean;
}

interface PreviewData {
  propertiesAffected: number;
  propertiesWithChanges: number;
  totalFieldsChanged: number;
  previews: PropertyPreview[];
  summary: {
    addedFields: number;
    modifiedFields: number;
    deletedFields: number;
  };
}

export function ChangePreview({
  scope,
  propertyId,
  groupId,
  settingType,
  settingUpdates,
  onApply,
  onCancel,
  showActions = true,
  className = ''
}: ChangePreviewProps) {
  const [expandedProperties, setExpandedProperties] = useState<Set<string>>(new Set());

  // Fetch preview data
  const {
    data: previewData,
    isLoading,
    error
  } = useQuery({
    queryKey: ['change-preview', scope, propertyId, groupId, settingType, settingUpdates],
    queryFn: async () => {
      const response = await api.post('/settings/preview-changes', {
        scope,
        propertyId,
        groupId,
        settingType,
        settingUpdates
      });
      return response.data.data as PreviewData;
    },
    enabled: !!settingType && !!settingUpdates
  });

  // Toggle property expansion
  const togglePropertyExpansion = (propId: string) => {
    const newExpanded = new Set(expandedProperties);
    if (newExpanded.has(propId)) {
      newExpanded.delete(propId);
    } else {
      newExpanded.add(propId);
    }
    setExpandedProperties(newExpanded);
  };

  // Export to CSV
  const handleExport = () => {
    if (!previewData) return;

    const rows: string[][] = [
      ['Property Name', 'Field', 'Current Value', 'New Value', 'Status']
    ];

    previewData.previews.forEach((preview) => {
      preview.changes.forEach((change) => {
        rows.push([
          preview.propertyName,
          change.field,
          JSON.stringify(change.currentValue),
          JSON.stringify(change.newValue),
          change.status
        ]);
      });
    });

    const csvContent = rows.map(row => row.join(',')).join('\n');
    const blob = new Blob([csvContent], { type: 'text/csv' });
    const url = window.URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = `change-preview-${Date.now()}.csv`;
    document.body.appendChild(link);
    link.click();
    link.remove();
  };

  // Get status icon and color
  const getStatusIndicator = (status: 'added' | 'modified' | 'deleted') => {
    switch (status) {
      case 'added':
        return {
          icon: <PlusCircle className="h-4 w-4" />,
          color: 'text-green-600',
          bgColor: 'bg-green-50',
          borderColor: 'border-green-200'
        };
      case 'modified':
        return {
          icon: <AlertCircle className="h-4 w-4" />,
          color: 'text-yellow-600',
          bgColor: 'bg-yellow-50',
          borderColor: 'border-yellow-200'
        };
      case 'deleted':
        return {
          icon: <MinusCircle className="h-4 w-4" />,
          color: 'text-red-600',
          bgColor: 'bg-red-50',
          borderColor: 'border-red-200'
        };
    }
  };

  // Format value for display
  const formatValue = (value: Record<string, unknown>): string => {
    if (value === null || value === undefined) return '-';
    if (typeof value === 'boolean') return value ? 'Yes' : 'No';
    if (typeof value === 'object') return JSON.stringify(value, null, 2);
    return String(value);
  };

  if (isLoading) {
    return (
      <Card className={className}>
        <CardContent className="py-12">
          <div className="flex flex-col items-center justify-center">
            <Loader2 className="h-12 w-12 text-blue-600 animate-spin mb-4" />
            <p className="text-gray-600">Generating preview...</p>
          </div>
        </CardContent>
      </Card>
    );
  }

  if (error) {
    return (
      <Alert variant="destructive" className={className}>
        <AlertCircle className="h-4 w-4" />
        <AlertDescription>
          Failed to generate preview: {(error as Error).message}
        </AlertDescription>
      </Alert>
    );
  }

  if (!previewData) {
    return null;
  }

  return (
    <Card className={className}>
      <CardHeader>
        <div className="flex items-center justify-between">
          <div>
            <CardTitle>Change Preview</CardTitle>
            <CardDescription className="mt-1">
              Review changes before applying to {previewData.propertiesAffected} {previewData.propertiesAffected === 1 ? 'property' : 'properties'}
            </CardDescription>
          </div>
          <Button
            variant="outline"
            size="sm"
            onClick={handleExport}
          >
            <Download className="h-4 w-4 mr-2" />
            Export CSV
          </Button>
        </div>
      </CardHeader>

      <CardContent>
        {/* Summary Section */}
        <div className="grid grid-cols-1 sm:grid-cols-4 gap-4 mb-6">
          <div className="bg-blue-50 rounded-lg p-4">
            <div className="text-sm text-blue-600 font-medium mb-1">Properties</div>
            <div className="text-2xl font-bold text-blue-900">
              {previewData.propertiesAffected}
            </div>
            <div className="text-xs text-blue-600 mt-1">
              {previewData.propertiesWithChanges} with changes
            </div>
          </div>

          <div className="bg-green-50 rounded-lg p-4">
            <div className="flex items-center gap-2 mb-1">
              <PlusCircle className="h-4 w-4 text-green-600" />
              <div className="text-sm text-green-600 font-medium">Added</div>
            </div>
            <div className="text-2xl font-bold text-green-900">
              {previewData.summary.addedFields}
            </div>
          </div>

          <div className="bg-yellow-50 rounded-lg p-4">
            <div className="flex items-center gap-2 mb-1">
              <AlertCircle className="h-4 w-4 text-yellow-600" />
              <div className="text-sm text-yellow-600 font-medium">Modified</div>
            </div>
            <div className="text-2xl font-bold text-yellow-900">
              {previewData.summary.modifiedFields}
            </div>
          </div>

          <div className="bg-red-50 rounded-lg p-4">
            <div className="flex items-center gap-2 mb-1">
              <MinusCircle className="h-4 w-4 text-red-600" />
              <div className="text-sm text-red-600 font-medium">Deleted</div>
            </div>
            <div className="text-2xl font-bold text-red-900">
              {previewData.summary.deletedFields}
            </div>
          </div>
        </div>

        {/* Property-by-Property Changes */}
        <div className="space-y-3">
          <h4 className="text-sm font-semibold text-gray-900">Property Changes</h4>

          {previewData.previews.length === 0 ? (
            <Alert>
              <AlertCircle className="h-4 w-4" />
              <AlertDescription>
                No changes detected. All selected properties already have these settings.
              </AlertDescription>
            </Alert>
          ) : (
            <div className="space-y-2">
              {previewData.previews.map((preview) => (
                <div
                  key={preview.propertyId}
                  className="border border-gray-200 rounded-lg overflow-hidden"
                >
                  {/* Property Header */}
                  <div role="button" tabIndex={0}
                    className={`p-4 cursor-pointer hover:bg-gray-50 transition-colors ${
                      preview.hasChanges ? 'bg-white' : 'bg-gray-50'
                    }`}
                    onClick={() => togglePropertyExpansion(preview.propertyId)}
                   onKeyDown={(e: React.KeyboardEvent) => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); const clickHandler = () => togglePropertyExpansion(preview.propertyId); if (typeof clickHandler === 'function') { clickHandler(e as any); } } }}>
                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-3">
                        <Button
                          variant="ghost"
                          size="sm"
                          className="p-0 h-6 w-6"
                        >
                          {expandedProperties.has(preview.propertyId) ? (
                            <ChevronDown className="h-4 w-4" />
                          ) : (
                            <ChevronRight className="h-4 w-4" />
                          )}
                        </Button>
                        <Building2 className="h-5 w-5 text-gray-400" />
                        <div>
                          <div className="font-medium text-gray-900">
                            {preview.propertyName}
                          </div>
                          <div className="text-sm text-gray-500">
                            {preview.changes.length} {preview.changes.length === 1 ? 'change' : 'changes'}
                          </div>
                        </div>
                      </div>
                      <div className="flex items-center gap-2">
                        {preview.hasChanges ? (
                          <Badge className="bg-blue-100 text-blue-800">
                            <CheckCircle className="h-3 w-3 mr-1" />
                            Has Changes
                          </Badge>
                        ) : (
                          <Badge variant="outline" className="text-gray-600">
                            No Changes
                          </Badge>
                        )}
                      </div>
                    </div>
                  </div>

                  {/* Expanded Changes */}
                  {expandedProperties.has(preview.propertyId) && preview.hasChanges && (
                    <div className="border-t border-gray-200 bg-gray-50 p-4">
                      <div className="space-y-3">
                        {preview.changes.map((change, index) => {
                          const indicator = getStatusIndicator(change.status);
                          return (
                            <div
                              key={`preview-changes-${change.field}`}
                              className={`p-3 rounded-lg border ${indicator.bgColor} ${indicator.borderColor}`}
                            >
                              <div className="flex items-start justify-between mb-2">
                                <div className="flex items-center gap-2">
                                  <div className={indicator.color}>
                                    {indicator.icon}
                                  </div>
                                  <span className="font-medium text-gray-900 capitalize">
                                    {change.field.replace(/_/g, ' ')}
                                  </span>
                                </div>
                                <Badge variant="outline" className={`text-xs ${indicator.color}`}>
                                  {change.status}
                                </Badge>
                              </div>
                              <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                                <div>
                                  <div className="text-xs text-gray-600 uppercase mb-1">
                                    Current Value
                                  </div>
                                  <div className="bg-white rounded p-2 text-sm font-mono">
                                    {formatValue(change.currentValue)}
                                  </div>
                                </div>
                                <div className="flex items-center gap-2">
                                  <ArrowRight className="h-5 w-5 text-gray-400 hidden md:block" />
                                  <div className="flex-1">
                                    <div className="text-xs text-gray-600 uppercase mb-1">
                                      New Value
                                    </div>
                                    <div className="bg-white rounded p-2 text-sm font-mono">
                                      {formatValue(change.newValue)}
                                    </div>
                                  </div>
                                </div>
                              </div>
                            </div>
                          );
                        })}
                      </div>
                    </div>
                  )}
                </div>
              ))}
            </div>
          )}
        </div>

        {/* Action Buttons */}
        {showActions && previewData.propertiesWithChanges > 0 && (
          <div className="flex items-center justify-end gap-3 mt-6 pt-6 border-t">
            <Button
              variant="outline"
              onClick={onCancel}
            >
              Cancel
            </Button>
            <Button
              onClick={onApply}
              className="bg-blue-600 hover:bg-blue-700"
            >
              <CheckCircle className="h-4 w-4 mr-2" />
              Apply Changes to {previewData.propertiesWithChanges} {previewData.propertiesWithChanges === 1 ? 'Property' : 'Properties'}
            </Button>
          </div>
        )}
      </CardContent>
    </Card>
  );
}

export default ChangePreview;
