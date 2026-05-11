import React, { useState, useEffect } from 'react';
import { Filter, X, Plus, Search, ChevronDown } from 'lucide-react';

export interface FilterCriteria {
  field: string;
  operator: 'equals' | 'contains' | 'greater_than' | 'less_than' | 'between' | 'in' | 'not_in';
  value: unknown;
  label?: string;
}

export interface FilterField {
  key: string;
  label: string;
  type: 'text' | 'number' | 'date' | 'select' | 'multiselect' | 'boolean';
  options?: { value: unknown; label: string }[];
  operators?: FilterCriteria['operator'][];
}

export interface MultiCriteriaFilterProps {
  fields: FilterField[];
  criteria: FilterCriteria[];
  onChange: (criteria: FilterCriteria[]) => void;
  onApply?: () => void;
  onClear?: () => void;
  className?: string;
  maxCriteria?: number;
}

const defaultOperators: Record<string, FilterCriteria['operator'][]> = {
  text: ['equals', 'contains'],
  number: ['equals', 'greater_than', 'less_than', 'between'],
  date: ['equals', 'greater_than', 'less_than', 'between'],
  select: ['equals', 'in', 'not_in'],
  multiselect: ['in', 'not_in'],
  boolean: ['equals']
};

const operatorLabels: Record<FilterCriteria['operator'], string> = {
  equals: 'Equals',
  contains: 'Contains',
  greater_than: 'Greater than',
  less_than: 'Less than',
  between: 'Between',
  in: 'In',
  not_in: 'Not in'
};

const MultiCriteriaFilter: React.FC<MultiCriteriaFilterProps> = ({
  fields,
  criteria,
  onChange,
  onApply,
  onClear,
  className = '',
  maxCriteria = 10
}) => {
  const [isOpen, setIsOpen] = useState(false);
  const [searchTerm, setSearchTerm] = useState('');

  const addCriteria = () => {
    if (criteria.length >= maxCriteria) return;

    const newCriteria: FilterCriteria = {
      field: fields[0]?.key || '',
      operator: 'equals',
      value: '',
      label: `${fields[0]?.label || 'Field'} equals ""`
    };

    onChange([...criteria, newCriteria]);
  };

  const updateCriteria = (index: number, updates: Partial<FilterCriteria>) => {
    const updatedCriteria = [...criteria];
    updatedCriteria[index] = { ...updatedCriteria[index], ...updates };

    // Update label when field, operator, or value changes
    const field = fields.find(f => f.key === updatedCriteria[index].field);
    if (field) {
      updatedCriteria[index].label = generateCriteriaLabel(updatedCriteria[index], field);
    }

    onChange(updatedCriteria);
  };

  const removeCriteria = (index: number) => {
    const updatedCriteria = criteria.filter((_, i) => i !== index);
    onChange(updatedCriteria);
  };

  const generateCriteriaLabel = (criteria: FilterCriteria, field: FilterField): string => {
    const operatorLabel = operatorLabels[criteria.operator];
    let valueLabel = '';

    if (criteria.operator === 'between') {
      const [start, end] = Array.isArray(criteria.value) ? criteria.value : [criteria.value, ''];
      valueLabel = `"${start}" and "${end}"`;
    } else if (criteria.operator === 'in' || criteria.operator === 'not_in') {
      const values = Array.isArray(criteria.value) ? criteria.value : [criteria.value];
      valueLabel = `[${values.join(', ')}]`;
    } else {
      valueLabel = `"${criteria.value}"`;
    }

    return `${field.label} ${operatorLabel.toLowerCase()} ${valueLabel}`;
  };

  const getFieldOperators = (fieldType: string, customOperators?: FilterCriteria['operator'][]): FilterCriteria['operator'][] => {
    return customOperators || defaultOperators[fieldType] || ['equals'];
  };

  const renderValueInput = (criteria: FilterCriteria, index: number) => {
    const field = fields.find(f => f.key === criteria.field);
    if (!field) return null;

    const commonProps = {
      className: "flex-1 px-3 py-2 text-sm border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:border-transparent"
    };

    switch (field.type) {
      case 'text':
        return (
          <input
            type="text"
            value={criteria.value || ''}
            onChange={(e) => updateCriteria(index, { value: e.target.value })}
            placeholder="Enter value"
            {...commonProps}
          />
        );

      case 'number':
        if (criteria.operator === 'between') {
          const [start, end] = Array.isArray(criteria.value) ? criteria.value : ['', ''];
          return (
            <div className="flex gap-2 flex-1">
              <input
                type="number"
                value={start}
                onChange={(e) => updateCriteria(index, { value: [e.target.value, end] })}
                placeholder="Min"
                className="flex-1 px-3 py-2 text-sm border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:border-transparent"
              />
              <span className="flex items-center text-gray-500">to</span>
              <input
                type="number"
                value={end}
                onChange={(e) => updateCriteria(index, { value: [start, e.target.value] })}
                placeholder="Max"
                className="flex-1 px-3 py-2 text-sm border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:border-transparent"
              />
            </div>
          );
        }
        return (
          <input
            type="number"
            value={criteria.value || ''}
            onChange={(e) => updateCriteria(index, { value: e.target.value })}
            placeholder="Enter number"
            {...commonProps}
          />
        );

      case 'date':
        if (criteria.operator === 'between') {
          const [start, end] = Array.isArray(criteria.value) ? criteria.value : ['', ''];
          return (
            <div className="flex gap-2 flex-1">
              <input
                type="date"
                value={start}
                onChange={(e) => updateCriteria(index, { value: [e.target.value, end] })}
                className="flex-1 px-3 py-2 text-sm border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:border-transparent"
              />
              <span className="flex items-center text-gray-500">to</span>
              <input
                type="date"
                value={end}
                onChange={(e) => updateCriteria(index, { value: [start, e.target.value] })}
                className="flex-1 px-3 py-2 text-sm border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:border-transparent"
              />
            </div>
          );
        }
        return (
          <input
            type="date"
            value={criteria.value || ''}
            onChange={(e) => updateCriteria(index, { value: e.target.value })}
            {...commonProps}
          />
        );

      case 'select':
        if (criteria.operator === 'in' || criteria.operator === 'not_in') {
          return (
            <select
              multiple
              value={Array.isArray(criteria.value) ? criteria.value : [criteria.value]}
              onChange={(e) => {
                const values = Array.from(e.target.selectedOptions, option => option.value);
                updateCriteria(index, { value: values });
              }}
              className="flex-1 px-3 py-2 text-sm border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:border-transparent"
              size={Math.min(field.options?.length || 3, 4)}
            >
              {field.options?.map(option => (
                <option key={option.value} value={option.value}>
                  {option.label}
                </option>
              ))}
            </select>
          );
        }
        return (
          <select
            value={criteria.value || ''}
            onChange={(e) => updateCriteria(index, { value: e.target.value })}
            {...commonProps}
          >
            <option value="">Select option</option>
            {field.options?.map(option => (
              <option key={option.value} value={option.value}>
                {option.label}
              </option>
            ))}
          </select>
        );

      case 'boolean':
        return (
          <select
            value={criteria.value || ''}
            onChange={(e) => updateCriteria(index, { value: e.target.value === 'true' })}
            {...commonProps}
          >
            <option value="">Select option</option>
            <option value="true">Yes</option>
            <option value="false">No</option>
          </select>
        );

      default:
        return (
          <input
            type="text"
            value={criteria.value || ''}
            onChange={(e) => updateCriteria(index, { value: e.target.value })}
            placeholder="Enter value"
            {...commonProps}
          />
        );
    }
  };

  const filteredFields = fields.filter(field =>
    field.label.toLowerCase().includes(searchTerm.toLowerCase()) ||
    field.key.toLowerCase().includes(searchTerm.toLowerCase())
  );

  const activeFiltersCount = criteria.filter(c => c.value !== '' && c.value != null).length;

  return (
    <div className={`relative ${className}`}>
      <button
        onClick={() => setIsOpen(!isOpen)}
        className={`flex items-center gap-2 px-3 py-2 text-sm font-medium border rounded-lg transition-colors ${
          activeFiltersCount > 0
            ? 'bg-indigo-50 border-indigo-200 text-indigo-700'
            : 'bg-white border-gray-300 text-gray-700 hover:bg-gray-50'
        }`}
      >
        <Filter className="h-4 w-4" />
        Advanced Filters
        {activeFiltersCount > 0 && (
          <span className="bg-indigo-600 text-white text-xs px-2 py-0.5 rounded-full min-w-[1.25rem] text-center">
            {activeFiltersCount}
          </span>
        )}
        <ChevronDown className={`h-4 w-4 transition-transform ${isOpen ? 'rotate-180' : ''}`} />
      </button>

      {isOpen && (
        <div className="absolute top-full left-0 mt-1 w-96 bg-white border border-gray-200 rounded-lg shadow-lg z-50">
          <div className="p-4">
            <div className="flex items-center justify-between mb-4">
              <h3 className="font-medium text-gray-900">Filter Criteria</h3>
              <div className="flex gap-2">
                {onClear && (
                  <button
                    onClick={() => {
                      onClear();
                      setIsOpen(false);
                    }}
                    className="text-sm text-gray-500 hover:text-gray-700"
                  >
                    Clear All
                  </button>
                )}
                <button aria-label="Close"
                  onClick={() => setIsOpen(false)}
                  className="text-gray-400 hover:text-gray-600"
                >
                  <X className="h-4 w-4" />
                </button>
              </div>
            </div>

            {/* Search Fields */}
            <div className="relative mb-4">
              <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-gray-400" />
              <input
                type="text"
                placeholder="Search fields..."
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                className="w-full pl-10 pr-4 py-2 text-sm border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:border-transparent"
              />
            </div>

            {/* Criteria List */}
            <div className="space-y-3 max-h-80 overflow-y-auto">
              {criteria.map((criteria, index) => {
                const field = fields.find(f => f.key === criteria.field);
                const availableOperators = field ? getFieldOperators(field.type, field.operators) : ['equals'];

                return (
                  <div key={`criteria-${criteria.field}`} className="p-3 border border-gray-200 rounded-lg space-y-2">
                    <div className="flex gap-2">
                      <select
                        value={criteria.field}
                        onChange={(e) => {
                          const newField = fields.find(f => f.key === e.target.value);
                          const newOperators = newField ? getFieldOperators(newField.type, newField.operators) : ['equals'];
                          updateCriteria(index, {
                            field: e.target.value,
                            operator: newOperators[0],
                            value: ''
                          });
                        }}
                        className="flex-1 px-3 py-2 text-sm border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:border-transparent"
                      >
                        {filteredFields.map(field => (
                          <option key={field.key} value={field.key}>
                            {field.label}
                          </option>
                        ))}
                      </select>

                      <select
                        value={criteria.operator}
                        onChange={(e) => updateCriteria(index, {
                          operator: e.target.value as FilterCriteria['operator'],
                          value: e.target.value === 'between' ? ['', ''] : ''
                        })}
                        className="px-3 py-2 text-sm border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:border-transparent"
                      >
                        {availableOperators.map(operator => (
                          <option key={operator} value={operator}>
                            {operatorLabels[operator]}
                          </option>
                        ))}
                      </select>

                      <button aria-label="Delete"
                        onClick={() => removeCriteria(index)}
                        className="p-2 text-gray-400 hover:text-red-600 transition-colors"
                      >
                        <X className="h-4 w-4" />
                      </button>
                    </div>

                    <div className="flex gap-2">
                      {renderValueInput(criteria, index)}
                    </div>
                  </div>
                );
              })}
            </div>

            {/* Add Criteria Button */}
            {criteria.length < maxCriteria && (
              <button
                onClick={addCriteria}
                className="w-full mt-3 flex items-center justify-center gap-2 px-3 py-2 text-sm text-indigo-600 border border-indigo-200 rounded-lg hover:bg-indigo-50 transition-colors"
              >
                <Plus className="h-4 w-4" />
                Add Filter
              </button>
            )}

            {/* Actions */}
            <div className="flex justify-between items-center mt-4 pt-4 border-t border-gray-200">
              <span className="text-sm text-gray-500">
                {activeFiltersCount} of {criteria.length} filters active
              </span>
              <div className="flex gap-2">
                {onApply && (
                  <button
                    onClick={() => {
                      onApply();
                      setIsOpen(false);
                    }}
                    className="px-4 py-2 text-sm font-medium text-white bg-indigo-600 rounded-md hover:bg-indigo-700 focus:outline-none focus:ring-2 focus:ring-indigo-500"
                  >
                    Apply Filters
                  </button>
                )}
              </div>
            </div>
          </div>
        </div>
      )}

      {isOpen && (
        <div aria-hidden="true"
          className="fixed inset-0 z-40"
          onClick={() => setIsOpen(false)}
        />
      )}
    </div>
  );
};

export default MultiCriteriaFilter;