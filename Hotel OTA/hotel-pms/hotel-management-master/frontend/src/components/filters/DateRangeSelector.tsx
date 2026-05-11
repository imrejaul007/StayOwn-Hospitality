import React, { useState, useEffect } from 'react';
import { Calendar, Clock, ChevronDown } from 'lucide-react';
import { format, subDays, subWeeks, subMonths, startOfWeek, startOfMonth, startOfYear, endOfWeek, endOfMonth, endOfYear } from 'date-fns';

export interface DateRange {
  start: string;
  end: string;
  label?: string;
}

export interface DateRangeSelectorProps {
  value: DateRange;
  onChange: (range: DateRange) => void;
  presets?: boolean;
  customRanges?: { label: string; range: DateRange }[];
  placeholder?: string;
  className?: string;
}

const DateRangeSelector: React.FC<DateRangeSelectorProps> = ({
  value,
  onChange,
  presets = true,
  customRanges = [],
  placeholder = "Select date range",
  className = ''
}) => {
  const [isOpen, setIsOpen] = useState(false);
  const [selectedPreset, setSelectedPreset] = useState<string>('');

  const defaultPresets = [
    {
      label: 'Today',
      getValue: () => {
        const today = new Date();
        return {
          start: format(today, 'yyyy-MM-dd'),
          end: format(today, 'yyyy-MM-dd'),
          label: 'Today'
        };
      }
    },
    {
      label: 'Yesterday',
      getValue: () => {
        const yesterday = subDays(new Date(), 1);
        return {
          start: format(yesterday, 'yyyy-MM-dd'),
          end: format(yesterday, 'yyyy-MM-dd'),
          label: 'Yesterday'
        };
      }
    },
    {
      label: 'Last 7 days',
      getValue: () => {
        const end = new Date();
        const start = subDays(end, 6);
        return {
          start: format(start, 'yyyy-MM-dd'),
          end: format(end, 'yyyy-MM-dd'),
          label: 'Last 7 days'
        };
      }
    },
    {
      label: 'Last 30 days',
      getValue: () => {
        const end = new Date();
        const start = subDays(end, 29);
        return {
          start: format(start, 'yyyy-MM-dd'),
          end: format(end, 'yyyy-MM-dd'),
          label: 'Last 30 days'
        };
      }
    },
    {
      label: 'This week',
      getValue: () => {
        const today = new Date();
        const start = startOfWeek(today, { weekStartsOn: 1 });
        const end = endOfWeek(today, { weekStartsOn: 1 });
        return {
          start: format(start, 'yyyy-MM-dd'),
          end: format(end, 'yyyy-MM-dd'),
          label: 'This week'
        };
      }
    },
    {
      label: 'Last week',
      getValue: () => {
        const today = new Date();
        const lastWeek = subWeeks(today, 1);
        const start = startOfWeek(lastWeek, { weekStartsOn: 1 });
        const end = endOfWeek(lastWeek, { weekStartsOn: 1 });
        return {
          start: format(start, 'yyyy-MM-dd'),
          end: format(end, 'yyyy-MM-dd'),
          label: 'Last week'
        };
      }
    },
    {
      label: 'This month',
      getValue: () => {
        const today = new Date();
        const start = startOfMonth(today);
        const end = endOfMonth(today);
        return {
          start: format(start, 'yyyy-MM-dd'),
          end: format(end, 'yyyy-MM-dd'),
          label: 'This month'
        };
      }
    },
    {
      label: 'Last month',
      getValue: () => {
        const today = new Date();
        const lastMonth = subMonths(today, 1);
        const start = startOfMonth(lastMonth);
        const end = endOfMonth(lastMonth);
        return {
          start: format(start, 'yyyy-MM-dd'),
          end: format(end, 'yyyy-MM-dd'),
          label: 'Last month'
        };
      }
    },
    {
      label: 'This year',
      getValue: () => {
        const today = new Date();
        const start = startOfYear(today);
        const end = endOfYear(today);
        return {
          start: format(start, 'yyyy-MM-dd'),
          end: format(end, 'yyyy-MM-dd'),
          label: 'This year'
        };
      }
    }
  ];

  const allPresets = [...defaultPresets, ...customRanges.map(range => ({
    label: range.label,
    getValue: () => range.range
  }))];

  const handlePresetSelect = (preset: Record<string, unknown>) => {
    const range = preset.getValue();
    onChange(range);
    setSelectedPreset(preset.label);
    setIsOpen(false);
  };

  const handleCustomDateChange = (field: 'start' | 'end', value: string) => {
    const newRange = {
      ...value,
      [field]: value,
      label: 'Custom range'
    };
    onChange(newRange);
    setSelectedPreset('Custom range');
  };

  const formatDisplayValue = () => {
    if (value.label) {
      return value.label;
    }

    if (value.start && value.end) {
      if (value.start === value.end) {
        return format(new Date(value.start), 'MMM dd, yyyy');
      }
      return `${format(new Date(value.start), 'MMM dd')} - ${format(new Date(value.end), 'MMM dd, yyyy')}`;
    }

    return placeholder;
  };

  useEffect(() => {
    // Check if current value matches any preset
    const matchingPreset = allPresets.find(preset => {
      const presetRange = preset.getValue();
      return presetRange.start === value.start && presetRange.end === value.end;
    });

    if (matchingPreset) {
      setSelectedPreset(matchingPreset.label);
    } else if (value.start && value.end) {
      setSelectedPreset('Custom range');
    } else {
      setSelectedPreset('');
    }
  }, [value]);

  return (
    <div className={`relative ${className}`}>
      <button aria-label="Expand"
        onClick={() => setIsOpen(!isOpen)}
        className="flex items-center justify-between w-full px-3 py-2 text-sm border border-gray-300 rounded-lg bg-white hover:border-gray-400 focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:border-transparent"
      >
        <div className="flex items-center gap-2">
          <Calendar className="h-4 w-4 text-gray-500" />
          <span className={value.start ? 'text-gray-900' : 'text-gray-500'}>
            {formatDisplayValue()}
          </span>
        </div>
        <ChevronDown className={`h-4 w-4 text-gray-500 transition-transform ${isOpen ? 'rotate-180' : ''}`} />
      </button>

      {isOpen && (
        <div className="absolute top-full left-0 mt-1 w-80 bg-white border border-gray-200 rounded-lg shadow-lg z-50">
          <div className="p-4">
            {presets && (
              <div className="mb-4">
                <h4 className="text-sm font-medium text-gray-900 mb-2">Quick Select</h4>
                <div className="grid grid-cols-2 gap-2">
                  {allPresets.map((preset) => (
                    <button aria-label="Close"
                      key={preset.label}
                      onClick={() => handlePresetSelect(preset)}
                      className={`px-3 py-2 text-sm text-left rounded-md transition-colors ${
                        selectedPreset === preset.label
                          ? 'bg-indigo-100 text-indigo-700 border border-indigo-200'
                          : 'hover:bg-gray-50 border border-transparent'
                      }`}
                    >
                      {preset.label}
                    </button>
                  ))}
                </div>
              </div>
            )}

            <div className="border-t border-gray-200 pt-4">
              <h4 className="text-sm font-medium text-gray-900 mb-3">Custom Range</h4>
              <div className="space-y-3">
                <div>
                  <label className="block text-xs font-medium text-gray-700 mb-1">
                    Start Date
                  </label>
                  <input
                    type="date"
                    value={value.start}
                    onChange={(e) => handleCustomDateChange('start', e.target.value)}
                    className="w-full px-3 py-2 text-sm border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:border-transparent"
                  />
                </div>
                <div>
                  <label className="block text-xs font-medium text-gray-700 mb-1">
                    End Date
                  </label>
                  <input
                    type="date"
                    value={value.end}
                    onChange={(e) => handleCustomDateChange('end', e.target.value)}
                    min={value.start}
                    className="w-full px-3 py-2 text-sm border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:border-transparent"
                  />
                </div>
              </div>
            </div>

            <div className="flex justify-between items-center mt-4 pt-4 border-t border-gray-200">
              <button
                onClick={() => {
                  onChange({ start: '', end: '', label: '' });
                  setSelectedPreset('');
                }}
                className="text-sm text-gray-500 hover:text-gray-700"
              >
                Clear
              </button>
              <button
                onClick={() => setIsOpen(false)}
                className="px-4 py-2 text-sm font-medium text-white bg-indigo-600 rounded-md hover:bg-indigo-700 focus:outline-none focus:ring-2 focus:ring-indigo-500"
              >
                Apply
              </button>
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

export default DateRangeSelector;