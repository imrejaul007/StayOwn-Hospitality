import React, { useState, useEffect, useRef, useCallback } from 'react';
import {
  Calendar,
  Clock,
  TrendingUp,
  Plus,
  Edit,
  Trash2,
  AlertTriangle,
  Settings
} from 'lucide-react';
import SeasonCalendar from '../../components/pricing/SeasonCalendar';
import SpecialPeriodManager from '../../components/pricing/SpecialPeriodManager';
import { seasonalPricingService, type SeasonalAnalytics } from '../../services/seasonalPricingService';
import { useToast } from '../../hooks/useToast';
import { ApplyToSelector, ApplyToConfirmation, ApplyToScope } from '../../components/settings/ApplyToSelector';
import { useSettingsInheritance, useAffectedPropertiesCount } from '../../hooks/useSettingsInheritance';
import { useProperty } from '../../context/PropertyContext';
import { withErrorBoundary } from '../../components/ErrorBoundary';

const getErrorMessage = (error: unknown): string => {
  if (error instanceof Error) return error.message;
  if (typeof error === 'object' && error !== null && 'message' in error) return String((error as Record<string, unknown>).message);
  return 'An unexpected error occurred';
};

interface Season {
  _id: string;
  seasonId: string;
  name: string;
  description: string;
  type: 'peak' | 'high' | 'shoulder' | 'low' | 'off' | 'custom';
  startDate: string;
  endDate: string;
  isRecurring: boolean;
  rateAdjustments: Array<{
    roomType: string;
    adjustmentType: 'percentage' | 'fixed' | 'absolute';
    adjustmentValue: number;
    currency: string;
  }>;
  priority: number;
  color: string;
  isActive: boolean;
}

interface SpecialPeriod {
  _id: string;
  periodId: string;
  name: string;
  description: string;
  type: string;
  startDate: string;
  endDate: string;
  isRecurring: boolean;
  rateOverrides: Array<{
    roomType: string;
    overrideType: 'percentage' | 'fixed' | 'absolute' | 'block';
    overrideValue: number;
    currency: string;
  }>;
  restrictions: {
    bookingRestriction: string;
    minLength: number;
    maxLength: number;
  };
  priority: number;
  color: string;
  isActive: boolean;
}

type TabKey = 'calendar' | 'seasons' | 'special-periods' | 'analytics';

const AdminSeasonalPricing: React.FC = () => {
  const [activeTab, setActiveTab] = useState<TabKey>('calendar');
  const [seasons, setSeasons] = useState<Season[]>([]);
  const [specialPeriods, setSpecialPeriods] = useState<SpecialPeriod[]>([]);
  const [loading, setLoading] = useState(true);
  const [selectedYear, setSelectedYear] = useState(new Date().getFullYear());
  const [showCreateSeason, setShowCreateSeason] = useState(false);
  const [showCreateSpecialPeriod, setShowCreateSpecialPeriod] = useState(false);
  const [editingItem, setEditingItem] = useState<Season | SpecialPeriod | null>(null);
  const [analytics, setAnalytics] = useState<SeasonalAnalytics | null>(null);
  const { showToast } = useToast();

  // Multi-property support
  const { selectedPropertyId } = useProperty();
  const [applyToScope, setApplyToScope] = useState<ApplyToScope>('single');
  const [showSuccess, setShowSuccess] = useState(false);

  const {
    useInheritanceStatus,
    applySettings,
    isUpdating,
    updateError,
    showConfirmation,
    pendingUpdate,
    confirmBulkUpdate,
    cancelBulkUpdate,
  } = useSettingsInheritance();

  const { data: inheritanceStatus } = useInheritanceStatus(selectedPropertyId);
  const affectedCount = useAffectedPropertiesCount(
    applyToScope,
    inheritanceStatus?.groupPropertyCount || 0
  );

  const successTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  // Cleanup timers on unmount
  useEffect(() => {
    return () => {
      if (successTimerRef.current) clearTimeout(successTimerRef.current);
    };
  }, []);

  const loadData = useCallback(async () => {
    try {
      setLoading(true);

      const [seasonsRes, periodsRes, analyticsRes] = await Promise.all([
        seasonalPricingService.getSeasons({ year: selectedYear }),
        seasonalPricingService.getSpecialPeriods({ year: selectedYear }),
        seasonalPricingService.getSeasonalAnalytics(
          `${selectedYear}-01-01`,
          `${selectedYear}-12-31`
        )
      ]);

      setSeasons(seasonsRes.data ?? []);
      setSpecialPeriods(periodsRes.data ?? []);
      setAnalytics(analyticsRes.data ?? null);
    } catch (error: unknown) {
      showToast('Error loading seasonal pricing data', 'error');
    } finally {
      setLoading(false);
    }
  }, [selectedYear, selectedPropertyId, showToast]);

  useEffect(() => {
    loadData();
  }, [loadData]);

  const handleCreateSeason = async (seasonData: Partial<Season>) => {
    try {
      // Multi-property update
      if (applyToScope !== 'single') {
        const result = await applySettings({
          scope: applyToScope,
          propertyId: selectedPropertyId,
          settingUpdates: seasonData,
          settingType: 'seasonal_pricing_season',
        });

        if (!result) return; // Confirmation dialog shown

        setShowSuccess(true);
        if (successTimerRef.current) clearTimeout(successTimerRef.current);
        successTimerRef.current = setTimeout(() => setShowSuccess(false), 3000);
        showToast(`Season created successfully for ${result.propertiesUpdated} properties`, 'success');
        setApplyToScope('single');
      } else {
        await seasonalPricingService.createSeason(seasonData);
        showToast('Season created successfully', 'success');
      }
      setShowCreateSeason(false);
      loadData();
    } catch (error: unknown) {
      showToast(getErrorMessage(error), 'error');
    }
  };

  const handleCreateSpecialPeriod = async (periodData: Partial<SpecialPeriod>) => {
    try {
      // Multi-property update
      if (applyToScope !== 'single') {
        const result = await applySettings({
          scope: applyToScope,
          propertyId: selectedPropertyId,
          settingUpdates: periodData,
          settingType: 'seasonal_pricing_period',
        });

        if (!result) return; // Confirmation dialog shown

        setShowSuccess(true);
        if (successTimerRef.current) clearTimeout(successTimerRef.current);
        successTimerRef.current = setTimeout(() => setShowSuccess(false), 3000);
        showToast(`Special period created successfully for ${result.propertiesUpdated} properties`, 'success');
        setApplyToScope('single');
      } else {
        await seasonalPricingService.createSpecialPeriod(periodData);
        showToast('Special period created successfully', 'success');
      }
      setShowCreateSpecialPeriod(false);
      loadData();
    } catch (error: unknown) {
      showToast(getErrorMessage(error), 'error');
    }
  };

  const handleUpdateItem = async (id: string, data: Partial<Season | SpecialPeriod>, type: 'season' | 'period') => {
    try {
      // Multi-property update
      if (applyToScope !== 'single') {
        const result = await applySettings({
          scope: applyToScope,
          propertyId: selectedPropertyId,
          settingUpdates: { id, data },
          settingType: type === 'season' ? 'seasonal_pricing_season' : 'seasonal_pricing_period',
        });

        if (!result) return; // Confirmation dialog shown

        setShowSuccess(true);
        if (successTimerRef.current) clearTimeout(successTimerRef.current);
        successTimerRef.current = setTimeout(() => setShowSuccess(false), 3000);
        showToast(`${type === 'season' ? 'Season' : 'Special period'} updated successfully for ${result.propertiesUpdated} properties`, 'success');
        setApplyToScope('single');
      } else {
        if (type === 'season') {
          await seasonalPricingService.updateSeason(id, data);
          showToast('Season updated successfully', 'success');
        } else {
          await seasonalPricingService.updateSpecialPeriod(id, data);
          showToast('Special period updated successfully', 'success');
        }
      }
      setEditingItem(null);
      loadData();
    } catch (error: unknown) {
      showToast(getErrorMessage(error), 'error');
    }
  };

  const handleConfirm = async () => {
    if (pendingUpdate) {
      const result = await confirmBulkUpdate();
      if (result) {
        setShowSuccess(true);
        if (successTimerRef.current) clearTimeout(successTimerRef.current);
        successTimerRef.current = setTimeout(() => setShowSuccess(false), 3000);
        showToast(`Settings updated for ${result.propertiesUpdated} properties`, 'success');
        setApplyToScope('single');
        loadData();
      }
    }
  };

  const handleDeleteItem = async (id: string, type: 'season' | 'period') => {
    if (!confirm(`Are you sure you want to delete this ${type}?`)) return;

    try {
      if (type === 'season') {
        await seasonalPricingService.deleteSeason(id);
        showToast('Season deleted successfully', 'success');
      } else {
        await seasonalPricingService.deleteSpecialPeriod(id);
        showToast('Special period deleted successfully', 'success');
      }
      loadData();
    } catch (error: unknown) {
      showToast(getErrorMessage(error), 'error');
    }
  };

  const getSeasonTypeColor = (type: string) => {
    const colors: Record<string, string> = {
      peak: '#DC2626',
      high: '#EA580C',
      shoulder: '#D97706',
      low: '#16A34A',
      off: '#059669',
      custom: '#6366F1'
    };
    return colors[type] ?? '#6B7280';
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <div className="animate-spin rounded-full h-32 w-32 border-b-2 border-indigo-600"></div>
      </div>
    );
  }

  const tabs: Array<{ key: TabKey; label: string; icon: React.ElementType }> = [
    { key: 'calendar', label: 'Calendar View', icon: Calendar },
    { key: 'seasons', label: 'Seasons', icon: TrendingUp },
    { key: 'special-periods', label: 'Special Periods', icon: Clock },
    { key: 'analytics', label: 'Analytics', icon: Settings }
  ];

  return (
    <div className="p-6 space-y-6">
      {/* Success Message */}
      {showSuccess && (
        <div className="bg-green-50 border border-green-200 text-green-800 px-4 py-3 rounded-lg">
          <p className="font-medium">Settings updated successfully!</p>
          {applyToScope !== 'single' && affectedCount > 1 && (
            <p className="text-sm mt-1">Changes applied to {affectedCount} properties</p>
          )}
        </div>
      )}

      {/* Error Message */}
      {updateError && (
        <div className="bg-red-50 border border-red-200 text-red-800 px-4 py-3 rounded-lg">
          <p className="font-medium">Error: {updateError}</p>
        </div>
      )}

      {/* Inheritance Status Card */}
      {inheritanceStatus?.isInheriting && inheritanceStatus?.hasGroup && (
        <div className="bg-blue-50 border border-blue-200 rounded-lg p-4">
          <div className="flex items-start">
            <AlertTriangle className="w-5 h-5 text-blue-600 mr-3 mt-0.5" />
            <div>
              <p className="text-sm font-medium text-blue-900">
                This property is part of: {inheritanceStatus.groupName}
              </p>
              <p className="text-xs text-blue-700 mt-1">
                Seasonal pricing settings can be managed centrally for all properties in this group.
                {inheritanceStatus.lastSyncedAt && (
                  <span className="ml-1">
                    Last synced: {new Date(inheritanceStatus.lastSyncedAt).toLocaleString()}
                  </span>
                )}
              </p>
            </div>
          </div>
        </div>
      )}

      {/* Header */}
      <div className="flex justify-between items-center">
        <div>
          <h1 className="text-3xl font-bold text-gray-900">Seasonal Pricing Management</h1>
          <p className="text-gray-600 mt-2">Manage seasons, special periods, and holiday pricing</p>
        </div>

        <div className="flex space-x-3">
          <select
            value={selectedYear}
            onChange={(e) => setSelectedYear(parseInt(e.target.value))}
            className="px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-indigo-500"
          >
            {Array.from({ length: 5 }, (_, i) => new Date().getFullYear() + i - 2).map(year => (
              <option key={year} value={year}>{year}</option>
            ))}
          </select>

          <button
            onClick={() => setShowCreateSeason(true)}
            className="flex items-center space-x-2 bg-indigo-600 text-white px-4 py-2 rounded-lg hover:bg-indigo-700"
          >
            <Plus className="h-4 w-4" />
            <span>Add Season</span>
          </button>

          <button
            onClick={() => setShowCreateSpecialPeriod(true)}
            className="flex items-center space-x-2 bg-green-600 text-white px-4 py-2 rounded-lg hover:bg-green-700"
          >
            <Plus className="h-4 w-4" />
            <span>Add Special Period</span>
          </button>
        </div>
      </div>

      {/* Stats Cards */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-6">
        <div className="bg-white rounded-lg shadow p-6">
          <div className="flex items-center">
            <Calendar className="h-8 w-8 text-indigo-600" />
            <div className="ml-4">
              <p className="text-sm font-medium text-gray-600">Active Seasons</p>
              <p className="text-2xl font-bold text-gray-900">{seasons.filter(s => s.isActive).length}</p>
            </div>
          </div>
        </div>

        <div className="bg-white rounded-lg shadow p-6">
          <div className="flex items-center">
            <Clock className="h-8 w-8 text-green-600" />
            <div className="ml-4">
              <p className="text-sm font-medium text-gray-600">Special Periods</p>
              <p className="text-2xl font-bold text-gray-900">{specialPeriods.filter(p => p.isActive).length}</p>
            </div>
          </div>
        </div>

        <div className="bg-white rounded-lg shadow p-6">
          <div className="flex items-center">
            <AlertTriangle className="h-8 w-8 text-red-600" />
            <div className="ml-4">
              <p className="text-sm font-medium text-gray-600">Blackout Dates</p>
              <p className="text-2xl font-bold text-gray-900">
                {analytics?.blackoutDates?.length ?? 0}
              </p>
            </div>
          </div>
        </div>

        <div className="bg-white rounded-lg shadow p-6">
          <div className="flex items-center">
            <TrendingUp className="h-8 w-8 text-blue-600" />
            <div className="ml-4">
              <p className="text-sm font-medium text-gray-600">Peak Periods</p>
              <p className="text-2xl font-bold text-gray-900">
                {analytics?.seasonsByType?.peak ?? 0}
              </p>
            </div>
          </div>
        </div>
      </div>

      {/* Tabs */}
      <div className="bg-white rounded-lg shadow">
        <div className="border-b border-gray-200">
          <nav className="-mb-px flex space-x-8">
            {tabs.map(({ key, label, icon: Icon }) => (
              <button
                aria-label={label}
                key={key}
                onClick={() => setActiveTab(key)}
                className={`flex items-center space-x-2 py-4 px-1 border-b-2 font-medium text-sm ${
                  activeTab === key
                    ? 'border-indigo-500 text-indigo-600'
                    : 'border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300'
                }`}
              >
                <Icon className="h-4 w-4" />
                <span>{label}</span>
              </button>
            ))}
          </nav>
        </div>

        <div className="p-6">
          {activeTab === 'calendar' && (
            <SeasonCalendar
              seasons={seasons}
              specialPeriods={specialPeriods}
              year={selectedYear}
              onSeasonClick={(season) => setEditingItem(season)}
              onSpecialPeriodClick={(period) => setEditingItem(period)}
            />
          )}

          {activeTab === 'seasons' && (
            <div className="space-y-4">
              <div className="flex justify-between items-center">
                <h3 className="text-lg font-semibold">Seasons ({selectedYear})</h3>
              </div>

              {/* Multi-property selector */}
              <div className="border-t border-gray-200 pt-4 mt-4">
                <ApplyToSelector
                  value={applyToScope}
                  onChange={setApplyToScope}
                  isInGroup={inheritanceStatus?.hasGroup || false}
                  groupName={inheritanceStatus?.groupName}
                  totalProperties={inheritanceStatus?.groupPropertyCount || 0}
                  showWarning={true}
                  warningMessage="Changes to seasonal pricing will affect rate calculations across all properties in the selected scope."
                />
              </div>

              <div className="grid gap-4">
                {seasons.length === 0 ? (
                  <div className="text-center py-12">
                    <Calendar className="h-12 w-12 text-gray-400 mx-auto mb-4" />
                    <h3 className="text-lg font-medium text-gray-900 mb-2">No seasons found</h3>
                    <p className="text-gray-600">No seasons have been configured for {selectedYear}. Click "Add Season" to create one.</p>
                  </div>
                ) : (
                  seasons.map((season) => (
                    <div key={season._id} className="border border-gray-200 rounded-lg p-4">
                      <div className="flex justify-between items-start">
                        <div className="flex-1">
                          <div className="flex items-center space-x-3">
                            <div
                              className="w-4 h-4 rounded-full"
                              style={{ backgroundColor: season.color || getSeasonTypeColor(season.type) }}
                            />
                            <h4 className="text-lg font-semibold">{season.name}</h4>
                            <span className={`px-2 py-1 text-xs rounded-full ${
                              season.type === 'peak' ? 'bg-red-100 text-red-800' :
                              season.type === 'high' ? 'bg-orange-100 text-orange-800' :
                              season.type === 'shoulder' ? 'bg-yellow-100 text-yellow-800' :
                              season.type === 'low' ? 'bg-green-100 text-green-800' :
                              'bg-gray-100 text-gray-800'
                            }`}>
                              {season.type.toUpperCase()}
                            </span>
                          </div>

                          <p className="text-gray-600 mt-1">{season.description}</p>

                          <div className="flex items-center space-x-4 mt-2 text-sm text-gray-500">
                            <span>
                              {new Date(season.startDate).toLocaleDateString()} - {new Date(season.endDate).toLocaleDateString()}
                            </span>
                            <span>Priority: {season.priority}</span>
                            {season.isRecurring && <span className="text-blue-600">Recurring</span>}
                          </div>

                          <div className="mt-3">
                            <p className="text-sm font-medium text-gray-700">Rate Adjustments:</p>
                            <div className="flex flex-wrap gap-2 mt-1">
                              {season.rateAdjustments.map((adj, index) => (
                                <span
                                  key={`season-rateAdjustments-${index}`}
                                  className="px-2 py-1 bg-blue-100 text-blue-800 text-xs rounded"
                                >
                                  {adj.roomType}: {adj.adjustmentType === 'percentage' ? `${adj.adjustmentValue}%` : `${adj.adjustmentValue} ${adj.currency}`}
                                </span>
                              ))}
                            </div>
                          </div>
                        </div>

                        <div className="flex items-center space-x-2">
                          <button aria-label="Edit"
                            onClick={() => setEditingItem(season)}
                            className="p-2 text-gray-400 hover:text-gray-600"
                          >
                            <Edit className="h-4 w-4" />
                          </button>
                          <button aria-label="Delete"
                            onClick={() => handleDeleteItem(season._id, 'season')}
                            className="p-2 text-gray-400 hover:text-red-600"
                          >
                            <Trash2 className="h-4 w-4" />
                          </button>
                        </div>
                      </div>
                    </div>
                  ))
                )}
              </div>
            </div>
          )}

          {activeTab === 'special-periods' && (
            <SpecialPeriodManager
              specialPeriods={specialPeriods}
              onUpdate={() => loadData()}
              onEdit={setEditingItem}
              onDelete={(id) => handleDeleteItem(id, 'period')}
            />
          )}

          {activeTab === 'analytics' && (
            <div className="space-y-6">
              <h3 className="text-lg font-semibold">Seasonal Analytics ({selectedYear})</h3>

              {!analytics ? (
                <div className="text-center py-12">
                  <Settings className="h-12 w-12 text-gray-400 mx-auto mb-4" />
                  <h3 className="text-lg font-medium text-gray-900 mb-2">No analytics data available</h3>
                  <p className="text-gray-600">Analytics will appear once seasons or special periods are created.</p>
                </div>
              ) : (
                <>
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                    <div className="bg-gray-50 rounded-lg p-4">
                      <h4 className="font-semibold mb-3">Seasons by Type</h4>
                      <div className="space-y-2">
                        {Object.keys(analytics.seasonsByType ?? {}).length === 0 ? (
                          <p className="text-sm text-gray-500">No seasons configured for this period.</p>
                        ) : (
                          Object.entries(analytics.seasonsByType).map(([type, count]) => (
                            <div key={type} className="flex justify-between">
                              <span className="capitalize">{type}</span>
                              <span className="font-semibold">{count}</span>
                            </div>
                          ))
                        )}
                      </div>
                    </div>

                    <div className="bg-gray-50 rounded-lg p-4">
                      <h4 className="font-semibold mb-3">Special Periods by Type</h4>
                      <div className="space-y-2">
                        {Object.keys(analytics.specialPeriodsByType ?? {}).length === 0 ? (
                          <p className="text-sm text-gray-500">No special periods configured for this period.</p>
                        ) : (
                          Object.entries(analytics.specialPeriodsByType).map(([type, count]) => (
                            <div key={type} className="flex justify-between">
                              <span className="capitalize">{type.replace(/_/g, ' ')}</span>
                              <span className="font-semibold">{count}</span>
                            </div>
                          ))
                        )}
                      </div>
                    </div>
                  </div>

                  {analytics.blackoutDates && analytics.blackoutDates.length > 0 && (
                    <div className="bg-red-50 rounded-lg p-4">
                      <h4 className="font-semibold mb-3 text-red-800">Blackout Dates</h4>
                      <div className="space-y-2">
                        {analytics.blackoutDates.map((blackout, index) => (
                          <div key={`blackout-${blackout.name || index}`} className="flex justify-between text-sm">
                            <span>{blackout.name}</span>
                            <span>
                              {new Date(blackout.startDate).toLocaleDateString()} - {new Date(blackout.endDate).toLocaleDateString()}
                            </span>
                          </div>
                        ))}
                      </div>
                    </div>
                  )}
                </>
              )}
            </div>
          )}
        </div>
      </div>

      {/* Confirmation Dialog */}
      <ApplyToConfirmation
        isOpen={showConfirmation}
        scope={applyToScope}
        affectedCount={affectedCount}
        settingName="Seasonal Pricing Settings"
        groupName={inheritanceStatus?.groupName}
        onConfirm={handleConfirm}
        onCancel={cancelBulkUpdate}
      />
    </div>
  );
};

export default withErrorBoundary(AdminSeasonalPricing);
