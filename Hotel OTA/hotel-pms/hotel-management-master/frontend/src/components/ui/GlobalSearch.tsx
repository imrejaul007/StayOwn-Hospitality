import React, { useState, useEffect, useRef } from 'react';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Card, CardContent } from '@/components/ui/card';
import { Search, X, User, Calendar, Receipt, Building, Filter } from 'lucide-react';
import { api } from '@/services/api';

interface SearchResult {
  id: string;
  type: 'reservation' | 'guest' | 'invoice' | 'room';
  title: string;
  subtitle: string;
  details?: string;
  status?: string;
  priority?: 'high' | 'medium' | 'low';
}

interface GlobalSearchProps {
  onResultSelect?: (result: SearchResult) => void;
  placeholder?: string;
  className?: string;
}

const GlobalSearch: React.FC<GlobalSearchProps> = ({
  onResultSelect,
  placeholder = "Search reservations, guests, invoices...",
  className = ""
}) => {
  const [query, setQuery] = useState('');
  const [results, setResults] = useState<SearchResult[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [showResults, setShowResults] = useState(false);
  const [selectedIndex, setSelectedIndex] = useState(-1);
  const [activeFilters, setActiveFilters] = useState<string[]>([]);
  
  const searchRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);

  const searchTypes = [
    { id: 'reservation', label: 'Reservations', icon: Calendar },
    { id: 'guest', label: 'Guests', icon: User },
    { id: 'invoice', label: 'Invoices', icon: Receipt },
    { id: 'room', label: 'Rooms', icon: Building }
  ];

  useEffect(() => {
    if (query.length > 2) {
      setIsLoading(true);
      const timer = setTimeout(async () => {
        try {
          const response = await api.get('/guest-lookup/search', {
            params: {
              query,
              limit: 20,
              ...(activeFilters.length > 0 ? { types: activeFilters.join(',') } : {})
            }
          });
          const data = response.data?.data;
          if (Array.isArray(data)) {
            const mapped: SearchResult[] = data.map((item: Record<string, unknown>) => ({
              id: String(item._id || item.id || ''),
              type: (item.type as SearchResult['type']) || 'guest',
              title: String(item.name || item.title || ''),
              subtitle: String(item.email || item.subtitle || ''),
              details: item.phone ? String(item.phone) : undefined,
              status: item.status ? String(item.status) : undefined,
            }));
            setResults(mapped);
          } else {
            setResults([]);
          }
        } catch {
          setResults([]);
        }
        setIsLoading(false);
        setShowResults(true);
      }, 300);

      return () => clearTimeout(timer);
    } else {
      setResults([]);
      setShowResults(false);
    }
  }, [query, activeFilters]);

  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (searchRef.current && !searchRef.current.contains(event.target as Node)) {
        setShowResults(false);
        setSelectedIndex(-1);
      }
    };

    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (!showResults) return;

    switch (e.key) {
      case 'ArrowDown':
        e.preventDefault();
        setSelectedIndex(prev => Math.min(prev + 1, results.length - 1));
        break;
      case 'ArrowUp':
        e.preventDefault();
        setSelectedIndex(prev => Math.max(prev - 1, -1));
        break;
      case 'Enter':
        e.preventDefault();
        if (selectedIndex >= 0 && results[selectedIndex]) {
          handleResultClick(results[selectedIndex]);
        }
        break;
      case 'Escape':
        setShowResults(false);
        setSelectedIndex(-1);
        inputRef.current?.blur();
        break;
    }
  };

  const handleResultClick = (result: SearchResult) => {
    setQuery(result.title);
    setShowResults(false);
    setSelectedIndex(-1);
    onResultSelect?.(result);
  };

  const toggleFilter = (filterId: string) => {
    setActiveFilters(prev => 
      prev.includes(filterId) 
        ? prev.filter(id => id !== filterId)
        : [...prev, filterId]
    );
  };

  const clearFilters = () => {
    setActiveFilters([]);
  };

  const getResultIcon = (type: string) => {
    const searchType = searchTypes.find(t => t.id === type);
    if (!searchType) return <Search className="w-4 h-4" />;
    
    const Icon = searchType.icon;
    return <Icon className="w-4 h-4" />;
  };

  const getStatusColor = (status: string, type: string) => {
    const colors: Record<string, string> = {
      confirmed: 'text-green-600',
      pending: 'text-yellow-600',
      cancelled: 'text-red-600',
      paid: 'text-green-600',
      unpaid: 'text-red-600',
      available: 'text-green-600',
      occupied: 'text-red-600',
      maintenance: 'text-purple-600'
    };
    return colors[status] || 'text-gray-600';
  };

  return (
    <div ref={searchRef} className={`relative ${className}`}>
      {/* Search Input */}
      <div className="relative">
        <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 w-4 h-4 text-gray-400" />
        <Input
          ref={inputRef}
          type="text"
          placeholder={placeholder}
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          onKeyDown={handleKeyDown}
          onFocus={() => query.length > 2 && setShowResults(true)}
          className="pl-10 pr-10"
        />
        {query && (
          <Button
            variant="ghost"
            size="sm"
            className="absolute right-1 top-1/2 transform -translate-y-1/2 p-1 h-auto"
            onClick={() => {
              setQuery('');
              setShowResults(false);
              setSelectedIndex(-1);
            }}
          >
            <X className="w-4 h-4" />
          </Button>
        )}
      </div>

      {/* Filter Pills */}
      {(showResults || activeFilters.length > 0) && (
        <div className="flex flex-wrap gap-1 mt-2">
          {searchTypes.map(type => {
            const Icon = type.icon;
            const isActive = activeFilters.includes(type.id);
            return (
              <Button
                key={type.id}
                variant={isActive ? "default" : "outline"}
                size="sm"
                onClick={() => toggleFilter(type.id)}
                className="h-6 px-2 text-xs"
              >
                <Icon className="w-3 h-3 mr-1" />
                {type.label}
              </Button>
            );
          })}
          {activeFilters.length > 0 && (
            <Button
              variant="ghost"
              size="sm"
              onClick={clearFilters}
              className="h-6 px-2 text-xs text-red-600"
            >
              <X className="w-3 h-3 mr-1" />
              Clear
            </Button>
          )}
        </div>
      )}

      {/* Results Dropdown */}
      {showResults && (
        <Card className="absolute top-full left-0 right-0 mt-1 z-50 shadow-lg border">
          <CardContent className="p-0 max-h-80 overflow-y-auto">
            {isLoading ? (
              <div className="p-4 text-center text-gray-500">
                <div className="animate-spin w-4 h-4 border-2 border-blue-500 border-t-transparent rounded-full mx-auto mb-2"></div>
                Searching...
              </div>
            ) : results.length > 0 ? (
              <div className="divide-y divide-gray-100">
                {results.map((result, index) => (
                  <div role="button" tabIndex={0}
                    key={result.id}
                    className={`p-3 cursor-pointer transition-colors ${
                      index === selectedIndex ? 'bg-blue-50 border-l-4 border-l-blue-500' : 'hover:bg-gray-50'
                    }`}
                    onClick={() => handleResultClick(result)}
                   onKeyDown={(e: React.KeyboardEvent) => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); const clickHandler = () => handleResultClick(result); if (typeof clickHandler === 'function') { clickHandler(e as any); } } }}>
                    <div className="flex items-start gap-3">
                      <div className="mt-1 text-gray-400">
                        {getResultIcon(result.type)}
                      </div>
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-2 mb-1">
                          <span className="font-medium text-gray-900 truncate">
                            {result.title}
                          </span>
                          {result.status && (
                            <Badge 
                              variant="outline" 
                              className={`text-xs ${getStatusColor(result.status, result.type)}`}
                            >
                              {result.status}
                            </Badge>
                          )}
                          {result.priority === 'high' && (
                            <div className="w-2 h-2 rounded-full bg-red-500"></div>
                          )}
                        </div>
                        <div className="text-sm text-gray-600 truncate mb-1">
                          {result.subtitle}
                        </div>
                        {result.details && (
                          <div className="text-xs text-gray-500 truncate">
                            {result.details}
                          </div>
                        )}
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            ) : query.length > 2 ? (
              <div className="p-4 text-center text-gray-500">
                No results found for "{query}"
              </div>
            ) : (
              <div className="p-4 text-center text-gray-500">
                Type at least 3 characters to search
              </div>
            )}
          </CardContent>
        </Card>
      )}
    </div>
  );
};

export default GlobalSearch;