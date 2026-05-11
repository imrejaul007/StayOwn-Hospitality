import React, { useState, useEffect, forwardRef } from 'react';
import { useAutoTranslation } from '../../hooks/useAutoTranslation';
import { useLocalization } from '../../context/LocalizationContext';
import { cn } from '../../utils/cn';
import { Languages, Loader2 } from 'lucide-react';

interface TranslatedInputProps extends React.InputHTMLAttributes<HTMLInputElement> {
  value?: string;
  onTranslationChange?: (originalValue: string, translatedValue: string) => void;
  debounceMs?: number;
  showTranslationIndicator?: boolean;
  enableRealTimeTranslation?: boolean;
  translationKey?: string;
}

export const TranslatedInput = forwardRef<HTMLInputElement, TranslatedInputProps>(({
  value = '',
  onChange,
  onTranslationChange,
  debounceMs = 500,
  showTranslationIndicator = true,
  enableRealTimeTranslation = true,
  translationKey,
  className,
  placeholder,
  disabled,
  ...props
}, ref) => {
  const { currentLanguage } = useLocalization();
  const { translateWithDebounce, isTranslating } = useAutoTranslation({
    enableRealTime: enableRealTimeTranslation,
    debounceMs
  });

  const [displayValue, setDisplayValue] = useState(value);
  const [isTranslationActive, setIsTranslationActive] = useState(false);

  // Update display value when prop changes
  useEffect(() => {
    setDisplayValue(value);
  }, [value]);

  // Handle translation when value changes
  useEffect(() => {
    if (
      !enableRealTimeTranslation || 
      !value || 
      value.trim().length === 0 ||
      currentLanguage === 'EN' // Skip if already in English
    ) {
      setIsTranslationActive(false);
      return;
    }

    const performTranslation = async () => {
      setIsTranslationActive(true);
      
      try {
        const key = translationKey || `input-${Date.now()}`;
        const translatedValue = await translateWithDebounce(
          value,
          key,
          currentLanguage
        );

        setDisplayValue(translatedValue);
        onTranslationChange?.(value, translatedValue);
      } catch (error) {
        setDisplayValue(value); // Fallback to original value
        onTranslationChange?.(value, value);
      } finally {
        setIsTranslationActive(false);
      }
    };

    performTranslation();
  }, [
    value,
    currentLanguage,
    enableRealTimeTranslation,
    translateWithDebounce,
    translationKey,
    onTranslationChange
  ]);

  const handleInputChange = (event: React.ChangeEvent<HTMLInputElement>) => {
    const newValue = event.target.value;
    setDisplayValue(newValue);
    onChange?.(event);
  };

  const renderTranslationIndicator = () => {
    if (!showTranslationIndicator || (!isTranslating && !isTranslationActive)) {
      return null;
    }

    return (
      <div className="absolute right-2 top-1/2 transform -translate-y-1/2 pointer-events-none">
        {isTranslating || isTranslationActive ? (
          <Loader2 className="w-4 h-4 animate-spin text-blue-500" />
        ) : (
          <Languages className="w-4 h-4 text-green-500" />
        )}
      </div>
    );
  };

  return (
    <div className="relative">
      <input
        ref={ref}
        value={displayValue}
        onChange={handleInputChange}
        placeholder={placeholder}
        disabled={disabled || isTranslating || isTranslationActive}
        className={cn(
          "w-full px-3 py-2 border border-gray-300 rounded-md shadow-sm",
          "placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500",
          (isTranslating || isTranslationActive) && "pr-10 bg-gray-50",
          disabled && "opacity-50 cursor-not-allowed",
          className
        )}
        {...props}
      />
      {renderTranslationIndicator()}
    </div>
  );
});

TranslatedInput.displayName = 'TranslatedInput';

export default TranslatedInput;