import { useState, useEffect, useCallback, useRef } from 'react';
import { useLocalization } from '../context/LocalizationContext';
import autoTranslationService from '../services/autoTranslationService';

interface UseAutoTranslationOptions {
  enableRealTime?: boolean;
  enableCache?: boolean;
  debounceMs?: number;
  batchSize?: number;
  retryAttempts?: number;
  autoTranslateOnLanguageChange?: boolean;
}

interface TranslationState {
  isTranslating: boolean;
  error: string | null;
  translations: { [key: string]: string };
  translationStats: {
    cacheSize: number;
    cacheHitRate: number;
    pendingTranslations: number;
    queueLength: number;
  };
}

interface UseAutoTranslationReturn extends TranslationState {
  translateText: (
    text: string,
    toLanguage?: string,
    fromLanguage?: string
  ) => Promise<string>;
  batchTranslate: (
    texts: string[],
    toLanguage?: string,
    fromLanguage?: string
  ) => Promise<string[]>;
  translateWithDebounce: (
    text: string,
    key: string,
    toLanguage?: string,
    fromLanguage?: string
  ) => Promise<string>;
  autoTranslateContent: (
    content: { [key: string]: string },
    toLanguage?: string
  ) => Promise<{ [key: string]: string }>;
  translateFormFields: (
    formData: { [fieldName: string]: string },
    toLanguage?: string
  ) => Promise<{ [fieldName: string]: string }>;
  clearCache: () => void;
  preloadTranslations: (
    texts: string[],
    languages: string[]
  ) => Promise<void>;
  refreshStats: () => void;
}

export const useAutoTranslation = (
  options: UseAutoTranslationOptions = {}
): UseAutoTranslationReturn => {
  const {
    enableRealTime = true,
    enableCache = true,
    debounceMs = 300,
    batchSize = 10,
    retryAttempts = 3,
    autoTranslateOnLanguageChange = true
  } = options;

  const { currentLanguage, previousLanguage } = useLocalization();

  const [state, setState] = useState<TranslationState>({
    isTranslating: false,
    error: null,
    translations: {},
    translationStats: {
      cacheSize: 0,
      cacheHitRate: 0,
      pendingTranslations: 0,
      queueLength: 0
    }
  });

  const debounceRefs = useRef<{ [key: string]: NodeJS.Timeout }>({});
  const currentContent = useRef<{ [key: string]: string }>({});

  // Cleanup all debounce timers on unmount
  useEffect(() => {
    const refs = debounceRefs;
    return () => {
      Object.values(refs.current).forEach(timer => clearTimeout(timer));
    };
  }, []);

  // Update translation stats periodically
  useEffect(() => {
    const updateStats = () => {
      const stats = autoTranslationService.getTranslationStats();
      setState(prev => ({ ...prev, translationStats: stats }));
    };

    updateStats();
    const interval = setInterval(updateStats, 5000); // Update every 5 seconds

    return () => clearInterval(interval);
  }, []);

  // Auto-translate content when language changes
  useEffect(() => {
    if (
      autoTranslateOnLanguageChange &&
      currentLanguage &&
      previousLanguage &&
      currentLanguage !== previousLanguage &&
      Object.keys(currentContent.current).length > 0
    ) {
      autoTranslateContent(currentContent.current, currentLanguage);
    }
  }, [currentLanguage, previousLanguage, autoTranslateOnLanguageChange]);

  const translateText = useCallback(async (
    text: string,
    toLanguage?: string,
    fromLanguage?: string
  ): Promise<string> => {
    if (!text || text.trim().length === 0) {
      return text;
    }

    const targetLang = toLanguage || currentLanguage || 'EN';

    setState(prev => ({ ...prev, isTranslating: true, error: null }));

    try {
      const result = await autoTranslationService.translateText(
        text,
        targetLang,
        fromLanguage,
        {
          enableCache,
          retryAttempts,
          batchSize,
          debounceMs
        }
      );

      setState(prev => ({
        ...prev,
        isTranslating: false,
        translations: {
          ...prev.translations,
          [text]: result.translatedText
        }
      }));

      return result.translatedText;
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : 'Translation failed';
      setState(prev => ({
        ...prev,
        isTranslating: false,
        error: errorMessage
      }));
      return text; // Return original text on error
    }
  }, [currentLanguage, enableCache, retryAttempts, batchSize, debounceMs]);

  const batchTranslate = useCallback(async (
    texts: string[],
    toLanguage?: string,
    fromLanguage?: string
  ): Promise<string[]> => {
    if (!texts || texts.length === 0) {
      return [];
    }

    const targetLang = toLanguage || currentLanguage || 'EN';

    setState(prev => ({ ...prev, isTranslating: true, error: null }));

    try {
      const results = await autoTranslationService.batchTranslate(
        texts,
        targetLang,
        fromLanguage,
        {
          enableCache,
          retryAttempts,
          batchSize,
          debounceMs
        }
      );

      const translationMap: { [key: string]: string } = {};
      texts.forEach((text, index) => {
        translationMap[text] = results[index]?.translatedText || text;
      });

      setState(prev => ({
        ...prev,
        isTranslating: false,
        translations: {
          ...prev.translations,
          ...translationMap
        }
      }));

      return results.map(result => result.translatedText);
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : 'Batch translation failed';
      setState(prev => ({
        ...prev,
        isTranslating: false,
        error: errorMessage
      }));
      return texts; // Return original texts on error
    }
  }, [currentLanguage, enableCache, retryAttempts, batchSize, debounceMs]);

  const translateWithDebounce = useCallback(async (
    text: string,
    key: string,
    toLanguage?: string,
    fromLanguage?: string
  ): Promise<string> => {
    if (!enableRealTime || !text || text.trim().length === 0) {
      return text;
    }

    const targetLang = toLanguage || currentLanguage || 'EN';

    return new Promise((resolve, reject) => {
      // Clear existing debounce timer for this key
      if (debounceRefs.current[key]) {
        clearTimeout(debounceRefs.current[key]);
      }

      setState(prev => ({ ...prev, isTranslating: true, error: null }));

      debounceRefs.current[key] = setTimeout(async () => {
        try {
          const translationPromise = autoTranslationService.translateWithDebounce(
            text,
            targetLang,
            fromLanguage,
            key,
            {
              enableCache,
              retryAttempts,
              batchSize,
              debounceMs
            }
          );

          const result = await translationPromise;
          const finalResult = await result;

          setState(prev => ({
            ...prev,
            isTranslating: false,
            translations: {
              ...prev.translations,
              [text]: finalResult.translatedText
            }
          }));

          resolve(finalResult.translatedText);
        } catch (error) {
          const errorMessage = error instanceof Error ? error.message : 'Debounced translation failed';
          setState(prev => ({
            ...prev,
            isTranslating: false,
            error: errorMessage
          }));
          resolve(text); // Return original text on error
        } finally {
          delete debounceRefs.current[key];
        }
      }, debounceMs);
    });
  }, [enableRealTime, currentLanguage, enableCache, retryAttempts, batchSize, debounceMs]);

  const autoTranslateContent = useCallback(async (
    content: { [key: string]: string },
    toLanguage?: string
  ): Promise<{ [key: string]: string }> => {
    const targetLang = toLanguage || currentLanguage || 'EN';
    
    // Store content for potential re-translation on language change
    currentContent.current = { ...content };

    setState(prev => ({ ...prev, isTranslating: true, error: null }));

    try {
      const translatedContent = await autoTranslationService.autoTranslateOnLanguageChange(
        content,
        targetLang,
        previousLanguage
      );

      setState(prev => ({
        ...prev,
        isTranslating: false,
        translations: {
          ...prev.translations,
          ...translatedContent
        }
      }));

      return translatedContent;
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : 'Content auto-translation failed';
      setState(prev => ({
        ...prev,
        isTranslating: false,
        error: errorMessage
      }));
      return content; // Return original content on error
    }
  }, [currentLanguage, previousLanguage]);

  const translateFormFields = useCallback(async (
    formData: { [fieldName: string]: string },
    toLanguage?: string
  ): Promise<{ [fieldName: string]: string }> => {
    const targetLang = toLanguage || currentLanguage || 'EN';

    setState(prev => ({ ...prev, isTranslating: true, error: null }));

    try {
      const translatedFields = await autoTranslationService.translateFormFields(
        formData,
        targetLang,
        previousLanguage
      );

      setState(prev => ({
        ...prev,
        isTranslating: false,
        translations: {
          ...prev.translations,
          ...translatedFields
        }
      }));

      return translatedFields;
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : 'Form field translation failed';
      setState(prev => ({
        ...prev,
        isTranslating: false,
        error: errorMessage
      }));
      return formData; // Return original form data on error
    }
  }, [currentLanguage, previousLanguage]);

  const clearCache = useCallback((): void => {
    try {
      autoTranslationService.clearCache();
      setState(prev => ({
        ...prev,
        translations: {},
        error: null,
        translationStats: {
          cacheSize: 0,
          cacheHitRate: 0,
          pendingTranslations: 0,
          queueLength: 0
        }
      }));
    } catch (error) {
      setState(prev => ({ 
        ...prev, 
        error: 'Failed to clear cache'
      }));
    }
  }, []);

  const preloadTranslations = useCallback(async (
    texts: string[],
    languages: string[]
  ): Promise<void> => {
    setState(prev => ({ ...prev, isTranslating: true, error: null }));

    try {
      await autoTranslationService.preloadTranslations(
        texts,
        languages,
        currentLanguage
      );

      setState(prev => ({ ...prev, isTranslating: false }));
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : 'Translation preloading failed';
      setState(prev => ({
        ...prev,
        isTranslating: false,
        error: errorMessage
      }));
    }
  }, [currentLanguage]);

  const refreshStats = useCallback((): void => {
    const stats = autoTranslationService.getTranslationStats();
    setState(prev => ({ ...prev, translationStats: stats }));
  }, []);

  // Cleanup debounce timers on unmount
  useEffect(() => {
    return () => {
      Object.values(debounceRefs.current).forEach(timer => {
        if (timer) clearTimeout(timer);
      });
    };
  }, []);

  return {
    ...state,
    translateText,
    batchTranslate,
    translateWithDebounce,
    autoTranslateContent,
    translateFormFields,
    clearCache,
    preloadTranslations,
    refreshStats
  };
};