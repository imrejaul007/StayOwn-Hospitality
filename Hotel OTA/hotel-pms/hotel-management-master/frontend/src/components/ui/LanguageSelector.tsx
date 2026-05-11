import React, { useState } from 'react';
import { Check, ChevronDown, Globe, Loader2 } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { Command, CommandEmpty, CommandGroup, CommandInput, CommandItem } from '@/components/ui/command';
import { Badge } from '@/components/ui/badge';
import { useLanguageSwitch, useTranslation } from '@/context/LocalizationContext';
import { cn } from '@/utils/cn';

export interface LanguageSelectorProps {
  /**
   * Display mode
   */
  variant?: 'button' | 'dropdown' | 'inline' | 'compact';
  
  /**
   * Size variant
   */
  size?: 'sm' | 'md' | 'lg';
  
  /**
   * Show language names in native script
   */
  showNativeNames?: boolean;
  
  /**
   * Show language completion status
   */
  showCompleteness?: boolean;
  
  /**
   * Filter languages by context
   */
  context?: string;
  
  /**
   * Maximum number of languages to display
   */
  maxLanguages?: number;
  
  /**
   * Custom CSS classes
   */
  className?: string;
  
  /**
   * Callback when language changes
   */
  onLanguageChange?: (languageCode: string) => void;
  
  /**
   * Custom trigger content
   */
  trigger?: React.ReactNode;
  
  /**
   * Show search input
   */
  searchable?: boolean;
}

/**
 * LanguageSelector Component
 * 
 * Provides UI for language selection with various display options
 */
export const LanguageSelector: React.FC<LanguageSelectorProps> = ({
  variant = 'dropdown',
  size = 'md',
  showNativeNames = true,
  showCompleteness = false,
  context,
  maxLanguages,
  className,
  onLanguageChange,
  trigger,
  searchable = true
}) => {
  const { currentLanguage, availableLanguages, changeLanguage, isLoading, error } = useLanguageSwitch();
  const { t } = useTranslation('common');
  const [open, setOpen] = useState(false);
  const [searchValue, setSearchValue] = useState('');

  // Filter and limit languages
  let displayLanguages = availableLanguages;
  
  if (context) {
    displayLanguages = displayLanguages.filter(lang => 
      lang.contexts.some(ctx => ctx.name === context && ctx.isEnabled)
    );
  }
  
  if (maxLanguages) {
    displayLanguages = displayLanguages.slice(0, maxLanguages);
  }

  // Filter by search
  const filteredLanguages = searchValue
    ? displayLanguages.filter(lang =>
        lang.name.toLowerCase().includes(searchValue.toLowerCase()) ||
        lang.nativeName.toLowerCase().includes(searchValue.toLowerCase()) ||
        lang.code.toLowerCase().includes(searchValue.toLowerCase())
      )
    : displayLanguages;

  const handleLanguageSelect = async (languageCode: string) => {
    try {
      await changeLanguage(languageCode);
      setOpen(false);
      onLanguageChange?.(languageCode);
    } catch {
      // Error handled silently
    }
  };

  const getLanguageDisplayName = (lang: typeof availableLanguages[0]) => {
    if (showNativeNames && lang.nativeName !== lang.name) {
      return `${lang.name} (${lang.nativeName})`;
    }
    return lang.name;
  };

  const getSizeClasses = () => {
    const sizeClasses = {
      sm: 'text-sm px-2 py-1',
      md: 'text-sm px-3 py-2', 
      lg: 'text-base px-4 py-2'
    };
    return sizeClasses[size];
  };

  if (variant === 'inline') {
    return (
      <div className={cn('flex flex-wrap gap-2', className)}>
        {displayLanguages.map((lang) => (
          <Button
            key={lang.code}
            variant={currentLanguage?.code === lang.code ? 'default' : 'outline'}
            size="sm"
            onClick={() => handleLanguageSelect(lang.code)}
            disabled={isLoading}
            className="relative"
          >
            <Globe className="w-3 h-3 mr-1" />
            {showNativeNames ? lang.nativeName : lang.name}
            {showCompleteness && (
              <Badge variant="secondary" className="ml-1 text-xs">
                {Math.round(lang.overallCompleteness)}%
              </Badge>
            )}
          </Button>
        ))}
      </div>
    );
  }

  if (variant === 'compact') {
    return (
      <Button
        variant="outline"
        size="sm"
        onClick={() => {
          const currentIndex = displayLanguages.findIndex(l => l.code === currentLanguage?.code);
          const nextIndex = (currentIndex + 1) % displayLanguages.length;
          handleLanguageSelect(displayLanguages[nextIndex].code);
        }}
        disabled={isLoading || displayLanguages.length <= 1}
        className={cn('min-w-16', className)}
      >
        {isLoading ? (
          <Loader2 className="w-3 h-3 animate-spin" />
        ) : (
          <>
            <Globe className="w-3 h-3 mr-1" />
            {currentLanguage?.code || 'EN'}
          </>
        )}
      </Button>
    );
  }

  const triggerContent = trigger || (
    <Button
      variant="outline"
      role="combobox"
      aria-expanded={open}
      className={cn('justify-between', getSizeClasses(), className)}
      disabled={isLoading}
    >
      {isLoading ? (
        <Loader2 className="w-4 h-4 animate-spin mr-2" />
      ) : (
        <Globe className="w-4 h-4 mr-2" />
      )}
      {currentLanguage ? getLanguageDisplayName(currentLanguage) : t('language.select')}
      <ChevronDown className="ml-2 h-4 w-4 shrink-0 opacity-50" />
    </Button>
  );

  if (variant === 'button') {
    return (
      <div className={className}>
        {triggerContent}
        {error && (
          <div className="text-sm text-red-600 mt-1">
            {t('language.error', { defaultValue: 'Language selection failed' })}
          </div>
        )}
      </div>
    );
  }

  return (
    <div className={className}>
      <Popover open={open} onOpenChange={setOpen}>
        <PopoverTrigger asChild>
          {triggerContent}
        </PopoverTrigger>
        <PopoverContent className="w-64 p-0" align="start">
          <Command>
            {searchable && (
              <CommandInput
                placeholder={t('language.search', { defaultValue: 'Search languages...' })}
                value={searchValue}
                onValueChange={setSearchValue}
              />
            )}
            <CommandEmpty>
              {t('language.notFound', { defaultValue: 'No languages found.' })}
            </CommandEmpty>
            <CommandGroup>
              {filteredLanguages.map((lang) => (
                <CommandItem
                  key={lang.code}
                  value={lang.code}
                  onSelect={handleLanguageSelect}
                  className="flex items-center justify-between"
                >
                  <div className="flex items-center">
                    <Globe className="w-4 h-4 mr-2 opacity-60" />
                    <div>
                      <div className="font-medium">
                        {getLanguageDisplayName(lang)}
                      </div>
                      {lang.direction === 'rtl' && (
                        <Badge variant="secondary" className="text-xs mt-1">
                          RTL
                        </Badge>
                      )}
                    </div>
                  </div>
                  <div className="flex items-center">
                    {showCompleteness && (
                      <Badge 
                        variant={lang.overallCompleteness > 80 ? 'default' : 'secondary'}
                        className="text-xs mr-2"
                      >
                        {Math.round(lang.overallCompleteness)}%
                      </Badge>
                    )}
                    {currentLanguage?.code === lang.code && (
                      <Check className="h-4 w-4 text-green-600" />
                    )}
                  </div>
                </CommandItem>
              ))}
            </CommandGroup>
          </Command>
        </PopoverContent>
      </Popover>
      
      {error && (
        <div className="text-sm text-red-600 mt-1">
          {t('language.error', { defaultValue: 'Language selection failed' })}
        </div>
      )}
    </div>
  );
};

export interface LanguageStatusProps {
  /**
   * Show detailed breakdown
   */
  detailed?: boolean;
  
  /**
   * Custom CSS classes
   */
  className?: string;
}

/**
 * LanguageStatus Component
 * 
 * Displays current language status and translation completeness
 */
export const LanguageStatus: React.FC<LanguageStatusProps> = ({
  detailed = false,
  className
}) => {
  const { currentLanguage } = useLanguageSwitch();
  const { t } = useTranslation('common');

  if (!currentLanguage) {
    return (
      <div className={cn('text-sm text-gray-500', className)}>
        {t('language.loading', { defaultValue: 'Loading language...' })}
      </div>
    );
  }

  return (
    <div className={cn('space-y-2', className)}>
      <div className="flex items-center gap-2">
        <Globe className="w-4 h-4" />
        <span className="font-medium">{currentLanguage.displayName}</span>
        <Badge variant="outline" className="text-xs">
          {currentLanguage.code}
        </Badge>
        {currentLanguage.direction === 'rtl' && (
          <Badge variant="secondary" className="text-xs">
            RTL
          </Badge>
        )}
      </div>
      
      {detailed && (
        <div className="grid grid-cols-2 gap-2 text-sm">
          <div>
            <span className="text-gray-600">{t('language.locale')}:</span>
            <span className="ml-1 font-mono">{currentLanguage.locale}</span>
          </div>
          <div>
            <span className="text-gray-600">{t('language.completeness')}:</span>
            <span className="ml-1">{Math.round(currentLanguage.overallCompleteness)}%</span>
          </div>
          {currentLanguage.metadata.regions && currentLanguage.metadata.regions.length > 0 && (
            <div className="col-span-2">
              <span className="text-gray-600">{t('language.regions')}:</span>
              <span className="ml-1">{currentLanguage.metadata.regions.join(', ')}</span>
            </div>
          )}
        </div>
      )}
    </div>
  );
};

export default LanguageSelector;