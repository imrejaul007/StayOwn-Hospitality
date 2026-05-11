import React from 'react';
import { LocalizationProvider, type LocalizationProviderProps } from '@/context/LocalizationContext';

interface LocalizedAppProps extends Omit<LocalizationProviderProps, 'children'> {
  children: React.ReactNode;
}

/**
 * LocalizedApp Component
 * 
 * Wrapper that provides localization context to the entire application
 */
export const LocalizedApp: React.FC<LocalizedAppProps> = ({
  children,
  defaultLanguage = 'EN',
  fallbackLanguage = 'EN',
  autoDetectLanguage = true,
  criticalNamespaces = ['common', 'errors', 'navigation', 'booking'],
  preloadNamespaces = ['forms', 'validation', 'admin'],
  onLanguageChange,
  onTranslationError,
  onMissingTranslation
}) => {
  const handleLanguageChange = (language: { code: string; displayName: string; direction?: string }) => {
    
    // Update document language and direction
    if (typeof document !== 'undefined') {
      document.documentElement.lang = language.code.toLowerCase();
      document.documentElement.dir = language.direction;
      
      // Update page title if needed
      const title = document.title;
      if (title && !title.includes(`[${language.code}]`)) {
        document.title = `${title} [${language.code}]`;
      }
    }
    
    onLanguageChange?.(language);
  };

  const handleTranslationError = (error: Error) => {
    
    // In production, you might want to send this to an error tracking service
    if (import.meta.env.MODE === 'production') {
      // Example: Send to error tracking service
      // errorTrackingService.captureException(error);
    }
    
    onTranslationError?.(error);
  };

  const handleMissingTranslation = (missing: { key: string; namespace?: string }) => {
    if (import.meta.env.MODE === 'development') {
    }
    
    // In production, you might want to collect these for improvement
    if (import.meta.env.MODE === 'production') {
      // Example: Send to analytics service
      // analyticsService.track('missing_translation', missing);
    }
    
    onMissingTranslation?.(missing);
  };

  return (
    <LocalizationProvider
      defaultLanguage={defaultLanguage}
      fallbackLanguage={fallbackLanguage}
      autoDetectLanguage={autoDetectLanguage}
      criticalNamespaces={criticalNamespaces}
      preloadNamespaces={preloadNamespaces}
      onLanguageChange={handleLanguageChange}
      onTranslationError={handleTranslationError}
      onMissingTranslation={handleMissingTranslation}
    >
      {children}
    </LocalizationProvider>
  );
};

export default LocalizedApp;