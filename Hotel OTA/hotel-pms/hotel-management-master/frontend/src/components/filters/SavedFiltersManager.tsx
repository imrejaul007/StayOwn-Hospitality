import React, { useState, useEffect } from 'react';
import { Bookmark, Star, Trash2, Edit, Save, X, Plus } from 'lucide-react';
import { FilterCriteria } from './MultiCriteriaFilter';
import { DateRange } from './DateRangeSelector';

export interface SavedFilter {
  id: string;
  name: string;
  description?: string;
  criteria: FilterCriteria[];
  dateRange?: DateRange;
  isStarred: boolean;
  createdAt: string;
  lastUsed?: string;
  useCount: number;
}

export interface SavedFiltersManagerProps {
  savedFilters: SavedFilter[];
  onLoad: (filter: SavedFilter) => void;
  onSave: (filter: Omit<SavedFilter, 'id' | 'createdAt' | 'useCount'>) => void;
  onUpdate: (id: string, filter: Partial<SavedFilter>) => void;
  onDelete: (id: string) => void;
  currentCriteria: FilterCriteria[];
  currentDateRange?: DateRange;
  className?: string;
}

const SavedFiltersManager: React.FC<SavedFiltersManagerProps> = ({
  savedFilters,
  onLoad,
  onSave,
  onUpdate,
  onDelete,
  currentCriteria,
  currentDateRange,
  className = ''
}) => {
  const [isOpen, setIsOpen] = useState(false);
  const [showSaveDialog, setShowSaveDialog] = useState(false);
  const [editingFilter, setEditingFilter] = useState<string | null>(null);
  const [saveForm, setSaveForm] = useState({
    name: '',
    description: '',
    isStarred: false
  });

  const handleSaveFilter = () => {
    if (!saveForm.name.trim()) return;

    const newFilter: Omit<SavedFilter, 'id' | 'createdAt' | 'useCount'> = {
      name: saveForm.name.trim(),
      description: saveForm.description.trim(),
      criteria: [...currentCriteria],
      dateRange: currentDateRange ? { ...currentDateRange } : undefined,
      isStarred: saveForm.isStarred,
      lastUsed: new Date().toISOString()
    };

    onSave(newFilter);
    setSaveForm({ name: '', description: '', isStarred: false });
    setShowSaveDialog(false);
  };

  const handleLoadFilter = (filter: SavedFilter) => {
    onLoad(filter);
    onUpdate(filter.id, {
      lastUsed: new Date().toISOString(),
      useCount: filter.useCount + 1
    });
    setIsOpen(false);
  };

  const handleToggleStar = (filter: SavedFilter) => {
    onUpdate(filter.id, { isStarred: !filter.isStarred });
  };

  const handleEditFilter = (filter: SavedFilter) => {
    setSaveForm({
      name: filter.name,
      description: filter.description || '',
      isStarred: filter.isStarred
    });
    setEditingFilter(filter.id);
    setShowSaveDialog(true);
  };

  const handleUpdateFilter = () => {
    if (!editingFilter || !saveForm.name.trim()) return;

    onUpdate(editingFilter, {
      name: saveForm.name.trim(),
      description: saveForm.description.trim(),
      isStarred: saveForm.isStarred
    });

    setSaveForm({ name: '', description: '', isStarred: false });
    setEditingFilter(null);
    setShowSaveDialog(false);
  };

  const sortedFilters = [...savedFilters].sort((a, b) => {
    // Starred filters first
    if (a.isStarred && !b.isStarred) return -1;
    if (!a.isStarred && b.isStarred) return 1;

    // Then by use count (most used first)
    if (b.useCount !== a.useCount) return b.useCount - a.useCount;

    // Finally by last used (most recent first)
    return new Date(b.lastUsed || b.createdAt).getTime() - new Date(a.lastUsed || a.createdAt).getTime();
  });

  const starredFilters = sortedFilters.filter(f => f.isStarred);
  const recentFilters = sortedFilters.filter(f => !f.isStarred).slice(0, 5);

  const hasActiveFilters = currentCriteria.some(c => c.value !== '' && c.value != null) ||
                          (currentDateRange && currentDateRange.start && currentDateRange.end);

  return (
    <div className={`relative ${className}`}>
      <div className="flex gap-2">
        <button
          onClick={() => setIsOpen(!isOpen)}
          className="flex items-center gap-2 px-3 py-2 text-sm font-medium text-gray-700 border border-gray-300 rounded-lg hover:bg-gray-50 transition-colors"
        >
          <Bookmark className="h-4 w-4" />
          Saved Filters
          {savedFilters.length > 0 && (
            <span className="bg-gray-200 text-gray-700 text-xs px-2 py-0.5 rounded-full">
              {savedFilters.length}
            </span>
          )}
        </button>

        {hasActiveFilters && (
          <button
            onClick={() => setShowSaveDialog(true)}
            className="flex items-center gap-2 px-3 py-2 text-sm font-medium text-indigo-600 border border-indigo-200 rounded-lg hover:bg-indigo-50 transition-colors"
          >
            <Save className="h-4 w-4" />
            Save Current
          </button>
        )}
      </div>

      {/* Saved Filters Dropdown */}
      {isOpen && (
        <div className="absolute top-full left-0 mt-1 w-80 bg-white border border-gray-200 rounded-lg shadow-lg z-50">
          <div className="p-4">
            <div className="flex items-center justify-between mb-4">
              <h3 className="font-medium text-gray-900">Saved Filters</h3>
              <button aria-label="Close"
                onClick={() => setIsOpen(false)}
                className="text-gray-400 hover:text-gray-600"
              >
                <X className="h-4 w-4" />
              </button>
            </div>

            {savedFilters.length === 0 ? (
              <div className="text-center py-8">
                <Bookmark className="h-12 w-12 text-gray-300 mx-auto mb-4" />
                <p className="text-gray-500 text-sm">No saved filters yet</p>
                <p className="text-gray-400 text-xs mt-1">
                  Create some filters and save them for quick access
                </p>
              </div>
            ) : (
              <div className="space-y-4 max-h-80 overflow-y-auto">
                {/* Starred Filters */}
                {starredFilters.length > 0 && (
                  <div>
                    <h4 className="text-sm font-medium text-gray-700 mb-2 flex items-center gap-1">
                      <Star className="h-3 w-3 text-yellow-500 fill-current" />
                      Starred
                    </h4>
                    <div className="space-y-2">
                      {starredFilters.map((filter) => (
                        <FilterCard
                          key={filter.id}
                          filter={filter}
                          onLoad={handleLoadFilter}
                          onEdit={handleEditFilter}
                          onDelete={onDelete}
                          onToggleStar={handleToggleStar}
                        />
                      ))}
                    </div>
                  </div>
                )}

                {/* Recent Filters */}
                {recentFilters.length > 0 && (
                  <div>
                    <h4 className="text-sm font-medium text-gray-700 mb-2">
                      {starredFilters.length > 0 ? 'Recent' : 'All Filters'}
                    </h4>
                    <div className="space-y-2">
                      {recentFilters.map((filter) => (
                        <FilterCard
                          key={filter.id}
                          filter={filter}
                          onLoad={handleLoadFilter}
                          onEdit={handleEditFilter}
                          onDelete={onDelete}
                          onToggleStar={handleToggleStar}
                        />
                      ))}
                    </div>
                  </div>
                )}
              </div>
            )}
          </div>
        </div>
      )}

      {/* Save Filter Dialog */}
      {showSaveDialog && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
          <div className="bg-white rounded-lg shadow-xl p-6 w-96">
            <div className="flex items-center justify-between mb-4">
              <h3 className="text-lg font-medium text-gray-900">
                {editingFilter ? 'Edit Filter' : 'Save Filter'}
              </h3>
              <button aria-label="Edit"
                onClick={() => {
                  setShowSaveDialog(false);
                  setEditingFilter(null);
                  setSaveForm({ name: '', description: '', isStarred: false });
                }}
                className="text-gray-400 hover:text-gray-600"
              >
                <X className="h-5 w-5" />
              </button>
            </div>

            <div className="space-y-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Filter Name *
                </label>
                <input
                  type="text"
                  value={saveForm.name}
                  onChange={(e) => setSaveForm({ ...saveForm, name: e.target.value })}
                  placeholder="Enter filter name"
                  className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:border-transparent"
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Description
                </label>
                <textarea
                  value={saveForm.description}
                  onChange={(e) => setSaveForm({ ...saveForm, description: e.target.value })}
                  placeholder="Optional description"
                  rows={3}
                  className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:border-transparent"
                />
              </div>

              <div className="flex items-center gap-2">
                <input
                  type="checkbox"
                  id="starred"
                  checked={saveForm.isStarred}
                  onChange={(e) => setSaveForm({ ...saveForm, isStarred: e.target.checked })}
                  className="h-4 w-4 text-indigo-600 border-gray-300 rounded focus:ring-indigo-500"
                />
                <label htmlFor="starred" className="text-sm text-gray-700 flex items-center gap-1">
                  <Star className="h-4 w-4 text-yellow-500" />
                  Add to starred filters
                </label>
              </div>
            </div>

            <div className="flex justify-end gap-3 mt-6">
              <button
                onClick={() => {
                  setShowSaveDialog(false);
                  setEditingFilter(null);
                  setSaveForm({ name: '', description: '', isStarred: false });
                }}
                className="px-4 py-2 text-sm font-medium text-gray-700 border border-gray-300 rounded-md hover:bg-gray-50"
              >
                Cancel
              </button>
              <button
                onClick={editingFilter ? handleUpdateFilter : handleSaveFilter}
                disabled={!saveForm.name.trim()}
                className="px-4 py-2 text-sm font-medium text-white bg-indigo-600 rounded-md hover:bg-indigo-700 disabled:opacity-50 disabled:cursor-not-allowed"
              >
                {editingFilter ? 'Update' : 'Save'} Filter
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Backdrop */}
      {(isOpen || showSaveDialog) && (
        <div aria-hidden="true"
          className="fixed inset-0 z-40"
          onClick={() => {
            setIsOpen(false);
            if (!showSaveDialog) {
              setShowSaveDialog(false);
              setEditingFilter(null);
            }
          }}
        />
      )}
    </div>
  );
};

interface FilterCardProps {
  filter: SavedFilter;
  onLoad: (filter: SavedFilter) => void;
  onEdit: (filter: SavedFilter) => void;
  onDelete: (id: string) => void;
  onToggleStar: (filter: SavedFilter) => void;
}

const FilterCard: React.FC<FilterCardProps> = ({
  filter,
  onLoad,
  onEdit,
  onDelete,
  onToggleStar
}) => {
  const [showActions, setShowActions] = useState(false);

  return (
    <div
      className="p-3 border border-gray-200 rounded-lg hover:bg-gray-50 transition-colors"
      onMouseEnter={() => setShowActions(true)}
      onMouseLeave={() => setShowActions(false)}
    >
      <div className="flex items-start justify-between">
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2">
            <h5 className="font-medium text-gray-900 truncate">{filter.name}</h5>
            <button aria-label="Toggle"
              onClick={(e) => {
                e.stopPropagation();
                onToggleStar(filter);
              }}
              className={`p-1 rounded transition-colors ${
                filter.isStarred
                  ? 'text-yellow-500 hover:text-yellow-600'
                  : 'text-gray-300 hover:text-yellow-500'
              }`}
            >
              <Star className={`h-3 w-3 ${filter.isStarred ? 'fill-current' : ''}`} />
            </button>
          </div>

          {filter.description && (
            <p className="text-sm text-gray-600 mt-1 truncate">{filter.description}</p>
          )}

          <div className="flex items-center gap-3 mt-2 text-xs text-gray-500">
            <span>{filter.criteria.length} criteria</span>
            <span>Used {filter.useCount} times</span>
            {filter.lastUsed && (
              <span>Last: {new Date(filter.lastUsed).toLocaleDateString()}</span>
            )}
          </div>
        </div>

        <div className={`flex items-center gap-1 transition-opacity ${
          showActions ? 'opacity-100' : 'opacity-0'
        }`}>
          <button aria-label="Add"
            onClick={(e) => {
              e.stopPropagation();
              onLoad(filter);
            }}
            className="p-1 text-indigo-600 hover:text-indigo-800 transition-colors"
            title="Load filter"
          >
            <Plus className="h-4 w-4" />
          </button>
          <button aria-label="Edit"
            onClick={(e) => {
              e.stopPropagation();
              onEdit(filter);
            }}
            className="p-1 text-gray-600 hover:text-gray-800 transition-colors"
            title="Edit filter"
          >
            <Edit className="h-4 w-4" />
          </button>
          <button aria-label="Delete"
            onClick={(e) => {
              e.stopPropagation();
              if (confirm('Are you sure you want to delete this filter?')) {
                onDelete(filter.id);
              }
            }}
            className="p-1 text-red-600 hover:text-red-800 transition-colors"
            title="Delete filter"
          >
            <Trash2 className="h-4 w-4" />
          </button>
        </div>
      </div>
    </div>
  );
};

export default SavedFiltersManager;