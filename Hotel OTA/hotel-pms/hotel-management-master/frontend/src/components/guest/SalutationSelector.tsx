import React, { useState, useEffect } from 'react';
import { api } from '../../services/api';
import { ChevronDownIcon } from '@heroicons/react/24/outline';

interface Salutation {
  _id: string;
  title: string;
  fullForm?: string;
  category: string;
  gender: string;
}

interface SalutationSelectorProps {
  value?: string;
  onChange: (salutationId: string | null) => void;
  gender?: 'male' | 'female' | 'any';
  category?: string;
  placeholder?: string;
  className?: string;
  required?: boolean;
}

const SalutationSelector: React.FC<SalutationSelectorProps> = ({
  value,
  onChange,
  gender,
  category,
  placeholder = "Select salutation",
  className = "",
  required = false
}) => {
  const [salutations, setSalutations] = useState<Salutation[]>([]);
  const [loading, setLoading] = useState(true);
  const [isOpen, setIsOpen] = useState(false);
  const [searchTerm, setSearchTerm] = useState('');

  useEffect(() => {
    fetchSalutations();
  }, [gender, category]);

  const fetchSalutations = async () => {
    try {
      setLoading(true);
      const queryParams = new URLSearchParams();
      
      queryParams.append('isActive', 'true');
      if (gender) queryParams.append('gender', gender);
      if (category) queryParams.append('category', category);

      const { data } = await api.get(`/salutations/public?${queryParams}`);
      setSalutations(data.data.salutations);
    } catch (error) {
      setSalutations([]);
    } finally {
      setLoading(false);
    }
  };

  const filteredSalutations = salutations.filter(salutation =>
    salutation.title.toLowerCase().includes(searchTerm.toLowerCase()) ||
    (salutation.fullForm && salutation.fullForm.toLowerCase().includes(searchTerm.toLowerCase()))
  );

  const selectedSalutation = salutations.find(sal => sal._id === value);

  const handleSelect = (salutationId: string) => {
    onChange(salutationId);
    setIsOpen(false);
    setSearchTerm('');
  };

  const handleClear = () => {
    onChange(null);
    setIsOpen(false);
    setSearchTerm('');
  };

  const getCategoryColor = (category: string) => {
    const colors = {
      personal: 'text-blue-600',
      professional: 'text-green-600',
      religious: 'text-purple-600',
      cultural: 'text-orange-600',
      academic: 'text-indigo-600'
    };
    return colors[category as keyof typeof colors] || 'text-gray-600';
  };

  return (
    <div className={`relative ${className}`}>
      <div className="relative">
        <button
          type="button"
          onClick={() => setIsOpen(!isOpen)}
          className={`relative w-full cursor-default rounded-md bg-white py-2 pl-3 pr-10 text-left shadow-sm ring-1 ring-inset ring-gray-300 focus:outline-none focus:ring-2 focus:ring-blue-500 sm:text-sm ${
            !selectedSalutation ? 'text-gray-500' : 'text-gray-900'
          }`}
        >
          <span className="block truncate">
            {selectedSalutation ? (
              <span className="flex items-center">
                <span className="font-medium">{selectedSalutation.title}</span>
                {selectedSalutation.fullForm && (
                  <span className="ml-2 text-gray-500">({selectedSalutation.fullForm})</span>
                )}
              </span>
            ) : (
              placeholder
            )}
          </span>
          <span className="pointer-events-none absolute inset-y-0 right-0 flex items-center pr-2">
            <ChevronDownIcon className="h-5 w-5 text-gray-400" />
          </span>
        </button>

        {isOpen && (
          <div className="absolute z-10 mt-1 max-h-60 w-full overflow-auto rounded-md bg-white py-1 text-base shadow-lg ring-1 ring-black ring-opacity-5 focus:outline-none sm:text-sm">
            {/* Search Input */}
            <div className="px-3 py-2 border-b border-gray-200">
              <input
                type="text"
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                placeholder="Search salutations..."
                className="w-full px-2 py-1 text-sm border border-gray-300 rounded focus:outline-none focus:ring-1 focus:ring-blue-500"
              />
            </div>

            {/* Clear Option */}
            <div role="button" tabIndex={0}
              className="relative cursor-pointer select-none py-2 pl-3 pr-9 hover:bg-gray-100"
              onClick={handleClear}
             onKeyDown={(e: React.KeyboardEvent) => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); handleClear(e as any); } }}>
              <span className="text-gray-500 italic">No salutation</span>
            </div>

            {loading ? (
              <div className="px-3 py-2 text-center text-gray-500">
                Loading salutations...
              </div>
            ) : filteredSalutations.length === 0 ? (
              <div className="px-3 py-2 text-center text-gray-500">
                No salutations found
              </div>
            ) : (
              filteredSalutations.map((salutation) => (
                <div role="button" tabIndex={0}
                  key={salutation._id}
                  className="relative cursor-pointer select-none py-2 pl-3 pr-9 hover:bg-gray-100"
                  onClick={() => handleSelect(salutation._id)}
                 onKeyDown={(e: React.KeyboardEvent) => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); const clickHandler = () => handleSelect(salutation._id); if (typeof clickHandler === 'function') { clickHandler(e as any); } } }}>
                  <div className="flex items-center justify-between">
                    <div className="flex items-center">
                      <span className="font-medium text-gray-900">
                        {salutation.title}
                      </span>
                      {salutation.fullForm && (
                        <span className="ml-2 text-gray-500">
                          ({salutation.fullForm})
                        </span>
                      )}
                    </div>
                    <span className={`text-xs ${getCategoryColor(salutation.category)}`}>
                      {salutation.category}
                    </span>
                  </div>
                </div>
              ))
            )}
          </div>
        )}
      </div>

      {required && !value && (
        <p className="mt-1 text-sm text-red-600">Please select a salutation</p>
      )}
    </div>
  );
};

export default SalutationSelector;
