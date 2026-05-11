import React, { useState, useEffect } from 'react';
import { Input } from './input';
import { Button } from './button';
import { Badge } from './badge';
import { Search, X, Loader2 } from 'lucide-react';
import { useDebouncedSearch } from '../../hooks/useDebounce';

interface OptimizedSearchProps {
  placeholder?: string;
  onSearch: (searchTerm: string) => void;
  onClear?: () => void;
  initialValue?: string;
  debounceMs?: number;
  showClearButton?: boolean;
  showSearchIcon?: boolean;
  disabled?: boolean;
  className?: string;
}

export const OptimizedSearch: React.FC<OptimizedSearchProps> = ({
  placeholder = "Search...",
  onSearch,
  onClear,
  initialValue = "",
  debounceMs = 300,
  showClearButton = true,
  showSearchIcon = true,
  disabled = false,
  className = ""
}) => {
  const [searchTerm, setSearchTerm] = useState(initialValue);
  const { debouncedSearchTerm, isDebouncing } = useDebouncedSearch(searchTerm, debounceMs);

  // Call onSearch when debounced search term changes
  useEffect(() => {
    onSearch(debouncedSearchTerm);
  }, [debouncedSearchTerm, onSearch]);

  const handleInputChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    setSearchTerm(e.target.value);
  };

  const handleClear = () => {
    setSearchTerm("");
    if (onClear) {
      onClear();
    }
  };

  const handleKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key === 'Enter') {
      // Trigger immediate search on Enter
      onSearch(searchTerm);
    } else if (e.key === 'Escape') {
      handleClear();
    }
  };

  return (
    <div className={`relative flex items-center ${className}`}>
      {showSearchIcon && (
        <Search className="absolute left-3 top-3 h-4 w-4 text-muted-foreground pointer-events-none" />
      )}

      <Input
        type="text"
        placeholder={placeholder}
        value={searchTerm}
        onChange={handleInputChange}
        onKeyDown={handleKeyDown}
        disabled={disabled}
        className={`${showSearchIcon ? 'pl-10' : ''} ${
          showClearButton && searchTerm ? 'pr-20' : isDebouncing ? 'pr-10' : ''
        }`}
      />

      {/* Loading indicator */}
      {isDebouncing && (
        <div className="absolute right-3 top-3">
          <Loader2 className="h-4 w-4 animate-spin text-muted-foreground" />
        </div>
      )}

      {/* Clear button */}
      {showClearButton && searchTerm && !isDebouncing && (
        <div className="absolute right-3 top-2">
          <Button
            variant="ghost"
            size="sm"
            onClick={handleClear}
            className="h-6 w-6 p-0 hover:bg-muted"
            disabled={disabled}
          >
            <X className="h-3 w-3" />
          </Button>
        </div>
      )}

      {/* Search results count indicator */}
      {debouncedSearchTerm && !isDebouncing && (
        <div className="absolute -bottom-6 left-0">
          <Badge variant="secondary" className="text-xs">
            Searching for: "{debouncedSearchTerm}"
          </Badge>
        </div>
      )}
    </div>
  );
};

export default OptimizedSearch;