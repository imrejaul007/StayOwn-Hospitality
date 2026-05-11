import React, { createContext, useContext, useEffect, useState, useCallback, ReactNode } from 'react';
import { languageService, type Language, type LanguagePreferences } from '@/services/languageService';
import { translationLoader, type TranslationOptions, type LoadingState, type MissingTranslation } from '@/services/translationLoader';

export interface LocalizationContextValue {
  // Current language state
  currentLanguage: Language | null;
  previousLanguage: string | null;
  availableLanguages: Language[];
  isLoading: boolean;
  error: string | null;

  // Translation functions
  t: (key: string, options?: TranslationOptions) => string;
  tBatch: (keys: string[], options?: Omit<TranslationOptions, 'defaultValue'> & { defaultValues?: Record<string, string> }) => Record<string, string>;
  
  // Language management
  setLanguage: (languageCode: string) => void;
  changeLanguage: (languageCode: string) => Promise<void>;
  getLanguageNames: () => Record<string, string>;
  loadNamespaces: (namespaces: string[]) => Promise<void>;
  isNamespaceLoaded: (namespace: string) => boolean;
  getLoadedNamespaces: () => string[];
  
  // Formatting functions
  formatDate: (date: Date | string, format?: 'short' | 'medium' | 'long' | 'full') => string;
  formatTime: (time: Date | string, format?: 'short' | 'medium' | 'long') => string;
  formatNumber: (number: number, options?: {
    style?: 'decimal' | 'currency' | 'percent';
    currency?: string;
    minimumFractionDigits?: number;
    maximumFractionDigits?: number;
  }) => string;
  formatCurrency: (amount: number, currency: string, options?: {
    showCurrencyCode?: boolean;
    minimumFractionDigits?: number;
    maximumFractionDigits?: number;
  }) => string;

  // Language preferences
  preferences: LanguagePreferences | null;
  updatePreferences: (preferences: Partial<LanguagePreferences>) => void;
  
  // Debug and analytics
  getMissingTranslations: () => MissingTranslation[];
  clearMissingTranslations: () => void;
  getTranslationStats: () => ReturnType<typeof translationLoader.getStats>;
  
  // Loading state
  loadingState: LoadingState;
  reloadNamespace: (namespace: string) => Promise<void>;
}

const LocalizationContext = createContext<LocalizationContextValue | null>(null);

export interface LocalizationProviderProps {
  children: ReactNode;
  defaultLanguage?: string;
  fallbackLanguage?: string;
  autoDetectLanguage?: boolean;
  criticalNamespaces?: string[];
  preloadNamespaces?: string[];
  onLanguageChange?: (language: Language) => void;
  onTranslationError?: (error: Error) => void;
  onMissingTranslation?: (missing: MissingTranslation) => void;
}

export const LocalizationProvider: React.FC<LocalizationProviderProps> = ({
  children,
  defaultLanguage = 'EN',
  fallbackLanguage = 'EN',
  autoDetectLanguage = true,
  criticalNamespaces = ['common', 'errors', 'navigation'],
  preloadNamespaces = ['booking', 'forms', 'validation'],
  onLanguageChange,
  onTranslationError,
  onMissingTranslation
}) => {
  // State
  const [currentLanguage, setCurrentLanguage] = useState<Language | null>(null);
  const [previousLanguage, setPreviousLanguage] = useState<string | null>(null);
  const [availableLanguages, setAvailableLanguages] = useState<Language[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [preferences, setPreferences] = useState<LanguagePreferences | null>(null);
  const [loadingState, setLoadingState] = useState<LoadingState>(translationLoader.getLoadingState());

  // Initialize localization
  useEffect(() => {
    initializeLocalization();
  }, []);

  // Subscribe to loading state changes
  useEffect(() => {
    const unsubscribe = translationLoader.addListener(setLoadingState);
    return unsubscribe;
  }, []);

  // Monitor missing translations for debugging
  useEffect(() => {
    if (onMissingTranslation) {
      const interval = setInterval(() => {
        const missing = translationLoader.getMissingTranslations();
        missing.forEach(onMissingTranslation);
        if (missing.length > 0) {
          translationLoader.clearMissingTranslations();
        }
      }, 10000); // Check every 10 seconds

      return () => clearInterval(interval);
    }
  }, [onMissingTranslation]);

  const initializeLocalization = async () => {
    try {
      setIsLoading(true);
      setError(null);

      // Load available languages
      const { data: languages } = await languageService.getActiveLanguages('booking_engine');
      setAvailableLanguages(languages);

      // Load user preferences
      const savedPreferences = languageService.loadLanguagePreferences();
      setPreferences(savedPreferences);

      // Determine initial language
      let targetLanguage = defaultLanguage;
      
      if (savedPreferences?.primaryLanguage) {
        targetLanguage = savedPreferences.primaryLanguage;
      } else if (autoDetectLanguage) {
        const browserLanguages = languageService.getBrowserLanguages();
        const supportedLanguage = browserLanguages.find(lang => 
          languages.some(l => l.code === lang)
        );
        if (supportedLanguage) {
          targetLanguage = supportedLanguage;
        }
      }

      // Load language details
      const { data: language } = await languageService.getLanguageByCode(targetLanguage);
      setCurrentLanguage(language);

      // Initialize translation loader
      await translationLoader.initialize(targetLanguage, fallbackLanguage);

      // Load critical namespaces
      await translationLoader.loadNamespaces(criticalNamespaces, targetLanguage);

      if (onLanguageChange) {
        onLanguageChange(language);
      }

    } catch (err) {
      const errorMessage = err instanceof Error ? err.message : 'Failed to initialize localization';
      setError(errorMessage);
      
      if (onTranslationError) {
        onTranslationError(err instanceof Error ? err : new Error(errorMessage));
      }

      // Fallback to default language
      try {
        const { data: fallbackLang } = await languageService.getDefaultLanguage();
        setCurrentLanguage(fallbackLang);
        await translationLoader.initialize(fallbackLang.code, fallbackLanguage);
      } catch {
        // Error handled silently
      }
    } finally {
      setIsLoading(false);
    }
  };

  // Translation function
  const t = useCallback((key: string, options: TranslationOptions = {}): string => {
    return translationLoader.translate(key, options);
  }, []);

  // Batch translation function
  const tBatch = useCallback((
    keys: string[], 
    options: Omit<TranslationOptions, 'defaultValue'> & { defaultValues?: Record<string, string> } = {}
  ): Record<string, string> => {
    return translationLoader.translateBatch(keys, options);
  }, []);

  // Simple language setter for real-time features
  const setLanguage = useCallback((languageCode: string): void => {
    if (currentLanguage?.code) {
      setPreviousLanguage(currentLanguage.code);
    }
    // Note: This is a simplified setter for real-time features
    // For full language changes, use changeLanguage instead
    const language = availableLanguages.find(lang => lang.code === languageCode);
    if (language) {
      setCurrentLanguage(language);
    }
  }, [currentLanguage, availableLanguages]);

  // Change language
  const changeLanguage = useCallback(async (languageCode: string): Promise<void> => {
    try {
      setIsLoading(true);
      setError(null);

      // Store previous language
      if (currentLanguage?.code) {
        setPreviousLanguage(currentLanguage.code);
      }

      // Load language details
      const { data: language } = await languageService.getLanguageByCode(languageCode);
      
      // Change translation loader language
      await translationLoader.changeLanguage(languageCode);
      
      // Load critical namespaces for new language
      await translationLoader.loadNamespaces(criticalNamespaces, languageCode);
      
      setCurrentLanguage(language);

      // Update preferences
      const newPreferences: LanguagePreferences = {
        ...preferences,
        primaryLanguage: languageCode,
        fallbackLanguages: preferences?.fallbackLanguages || [fallbackLanguage]
      };
      setPreferences(newPreferences);
      languageService.saveLanguagePreferences(newPreferences);

      if (onLanguageChange) {
        onLanguageChange(language);
      }

    } catch (err) {
      const errorMessage = err instanceof Error ? err.message : 'Failed to change language';
      setError(errorMessage);
      
      if (onTranslationError) {
        onTranslationError(err instanceof Error ? err : new Error(errorMessage));
      }
    } finally {
      setIsLoading(false);
    }
  }, [preferences, criticalNamespaces, fallbackLanguage, onLanguageChange, onTranslationError]);

  // Get language names mapping
  const getLanguageNames = useCallback((): Record<string, string> => {
    const names: Record<string, string> = {};
    availableLanguages.forEach(lang => {
      names[lang.code] = lang.name;
    });
    return names;
  }, [availableLanguages]);

  // Load namespaces
  const loadNamespaces = useCallback(async (namespaces: string[]): Promise<void> => {
    if (!currentLanguage) return;
    
    try {
      await translationLoader.loadNamespaces(namespaces, currentLanguage.code);
    } catch (err) {
      if (onTranslationError) {
        onTranslationError(err instanceof Error ? err : new Error('Failed to load namespaces'));
      }
    }
  }, [currentLanguage, onTranslationError]);

  // Check if namespace is loaded
  const isNamespaceLoaded = useCallback((namespace: string): boolean => {
    return translationLoader.isNamespaceLoaded(namespace);
  }, []);

  // Get loaded namespaces
  const getLoadedNamespaces = useCallback((): string[] => {
    return translationLoader.getLoadedNamespaces();
  }, []);

  // Formatting functions
  const formatDate = useCallback((date: Date | string, format: 'short' | 'medium' | 'long' | 'full' = 'medium'): string => {
    if (!currentLanguage) return date.toString();
    return languageService.formatDate(date, currentLanguage, format);
  }, [currentLanguage]);

  const formatTime = useCallback((time: Date | string, format: 'short' | 'medium' | 'long' = 'short'): string => {
    if (!currentLanguage) return time.toString();
    return languageService.formatTime(time, currentLanguage, format);
  }, [currentLanguage]);

  const formatNumber = useCallback((number: number, options: {
    style?: 'decimal' | 'currency' | 'percent';
    currency?: string;
    minimumFractionDigits?: number;
    maximumFractionDigits?: number;
  } = {}): string => {
    if (!currentLanguage) return number.toString();
    return languageService.formatNumber(number, currentLanguage, options);
  }, [currentLanguage]);

  const formatCurrency = useCallback((amount: number, currency: string, options: {
    showCurrencyCode?: boolean;
    minimumFractionDigits?: number;
    maximumFractionDigits?: number;
  } = {}): string => {
    if (!currentLanguage) return `${currency} ${amount}`;
    return languageService.formatCurrency(amount, currency, currentLanguage, options);
  }, [currentLanguage]);

  // Update preferences
  const updatePreferences = useCallback((update: Partial<LanguagePreferences>): void => {
    const newPreferences: LanguagePreferences = {
      ...preferences,
      ...update,
      primaryLanguage: update.primaryLanguage || preferences?.primaryLanguage || defaultLanguage,
      fallbackLanguages: update.fallbackLanguages || preferences?.fallbackLanguages || [fallbackLanguage],
      autoDetect: update.autoDetect ?? preferences?.autoDetect ?? true
    };
    
    setPreferences(newPreferences);
    languageService.saveLanguagePreferences(newPreferences);
  }, [preferences, defaultLanguage, fallbackLanguage]);

  // Debug functions
  const getMissingTranslations = useCallback((): MissingTranslation[] => {
    return translationLoader.getMissingTranslations();
  }, []);

  const clearMissingTranslations = useCallback((): void => {
    translationLoader.clearMissingTranslations();
  }, []);

  const getTranslationStats = useCallback(() => {
    return translationLoader.getStats();
  }, []);

  const reloadNamespace = useCallback(async (namespace: string): Promise<void> => {
    if (!currentLanguage) return;
    
    try {
      await translationLoader.reloadNamespace(namespace, currentLanguage.code);
    } catch (err) {
      if (onTranslationError) {
        onTranslationError(err instanceof Error ? err : new Error('Failed to reload namespace'));
      }
    }
  }, [currentLanguage, onTranslationError]);

  const contextValue: LocalizationContextValue = {
    currentLanguage,
    previousLanguage,
    availableLanguages,
    isLoading,
    error,
    t,
    tBatch,
    setLanguage,
    changeLanguage,
    getLanguageNames,
    loadNamespaces,
    isNamespaceLoaded,
    getLoadedNamespaces,
    formatDate,
    formatTime,
    formatNumber,
    formatCurrency,
    preferences,
    updatePreferences,
    getMissingTranslations,
    clearMissingTranslations,
    getTranslationStats,
    loadingState,
    reloadNamespace
  };

  return (
    <LocalizationContext.Provider value={contextValue}>
      {children}
    </LocalizationContext.Provider>
  );
};

// Hook to use localization
export const useLocalization = (): LocalizationContextValue => {
  const context = useContext(LocalizationContext);
  if (!context) {
    throw new Error('useLocalization must be used within a LocalizationProvider');
  }
  return context;
};

// Convenience hooks for specific functionality
export const useTranslation = (namespace?: string) => {
  const { t, tBatch, loadNamespaces, isNamespaceLoaded } = useLocalization();
  
  // Auto-load namespace if provided and not loaded
  useEffect(() => {
    if (namespace && !isNamespaceLoaded(namespace)) {
      loadNamespaces([namespace]).catch(error => {
      });
    }
  }, [namespace, isNamespaceLoaded, loadNamespaces]);

  const tNamespaced = useCallback((key: string, options?: TranslationOptions) => {
    return t(key, { ...options, namespace: namespace || options?.namespace });
  }, [t, namespace]);

  return { t: tNamespaced, tBatch };
};

export const useFormatting = () => {
  const { formatDate, formatTime, formatNumber, formatCurrency, currentLanguage } = useLocalization();
  return { formatDate, formatTime, formatNumber, formatCurrency, currentLanguage };
};

export const useLanguageSwitch = () => {
  const { currentLanguage, availableLanguages, changeLanguage, isLoading, error } = useLocalization();
  return { currentLanguage, availableLanguages, changeLanguage, isLoading, error };
};

export default LocalizationContext;