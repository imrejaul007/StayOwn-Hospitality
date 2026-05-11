import { useState, useEffect, useCallback, useRef } from 'react';
import { useLocalization } from '../context/LocalizationContext';
import languageDetectionService from '../services/languageDetectionService';

interface UseLanguageDetectionOptions {
  autoDetect?: boolean;
  enableGeolocation?: boolean;
  enableTextDetection?: boolean;
  debounceMs?: number;
}

interface DetectionState {
  detectedLanguage: string | null;
  confidence: number;
  source: 'browser' | 'location' | 'text' | 'user' | 'default' | null;
  isDetecting: boolean;
  error: string | null;
  supportedLanguages: string[];
}

interface UseLanguageDetectionReturn extends DetectionState {
  detectLanguage: () => Promise<void>;
  detectTextLanguage: (text: string) => Promise<string | null>;
  setUserLanguagePreference: (language: string) => void;
  clearDetectionCache: () => void;
  isLanguageSupported: (language: string) => boolean;
  getBestFallback: (language: string) => string;
}

export const useLanguageDetection = (
  options: UseLanguageDetectionOptions = {}
): UseLanguageDetectionReturn => {
  const {
    autoDetect = true,
    enableGeolocation = true,
    enableTextDetection = true,
    debounceMs = 500
  } = options;

  const { currentLanguage, setLanguage } = useLocalization();

  const [state, setState] = useState<DetectionState>({
    detectedLanguage: null,
    confidence: 0,
    source: null,
    isDetecting: false,
    error: null,
    supportedLanguages: []
  });

  const detectionTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  // Cleanup detection timeout on unmount
  useEffect(() => {
    return () => {
      if (detectionTimeoutRef.current) clearTimeout(detectionTimeoutRef.current);
    };
  }, []);

  // Load supported languages on mount
  useEffect(() => {
    const loadSupportedLanguages = async () => {
      try {
        const languages = await languageDetectionService.getSupportedLanguages();
        setState(prev => ({ ...prev, supportedLanguages: languages }));
      } catch (error) {
        setState(prev => ({ 
          ...prev, 
          supportedLanguages: ['EN', 'ES', 'FR', 'DE', 'ZH'],
          error: 'Failed to load supported languages'
        }));
      }
    };

    loadSupportedLanguages();
  }, []);

  // Auto-detect language on mount if enabled
  useEffect(() => {
    if (autoDetect && !currentLanguage) {
      detectLanguage();
    }
  }, [autoDetect, currentLanguage]);

  const detectLanguage = useCallback(async (): Promise<void> => {
    setState(prev => ({ ...prev, isDetecting: true, error: null }));

    try {
      const result = await languageDetectionService.detectPreferredLanguage();
      
      setState(prev => ({
        ...prev,
        detectedLanguage: result.language,
        confidence: result.confidence,
        source: result.source,
        isDetecting: false,
        error: null
      }));

      // Auto-set language if confidence is high enough and it's supported
      if (result.confidence > 0.7 && state.supportedLanguages.includes(result.language)) {
        setLanguage(result.language);
      }

    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : 'Language detection failed';
      setState(prev => ({
        ...prev,
        isDetecting: false,
        error: errorMessage,
        detectedLanguage: 'EN', // Fallback
        confidence: 0.1,
        source: 'default'
      }));
    }
  }, [setLanguage, state.supportedLanguages]);

  const detectTextLanguage = useCallback(async (text: string): Promise<string | null> => {
    if (!enableTextDetection || !text || text.trim().length < 10) {
      return null;
    }

    // Clear existing timeout
    if (detectionTimeoutRef.current) {
      clearTimeout(detectionTimeoutRef.current);
    }

    return new Promise((resolve) => {
      detectionTimeoutRef.current = setTimeout(async () => {
        try {
          setState(prev => ({ ...prev, isDetecting: true }));

          const result = await languageDetectionService.detectTextLanguage(text);

          if (result && result.confidence > 0.6) {
            setState(prev => ({
              ...prev,
              detectedLanguage: result.language,
              confidence: result.confidence,
              source: result.source,
              isDetecting: false
            }));
            resolve(result.language);
          } else {
            setState(prev => ({ ...prev, isDetecting: false }));
            resolve(null);
          }
        } catch (error) {
          setState(prev => ({
            ...prev,
            isDetecting: false,
            error: 'Text detection failed'
          }));
          resolve(null);
        }
      }, debounceMs);
    });
  }, [enableTextDetection, debounceMs]);

  const setUserLanguagePreference = useCallback((language: string): void => {
    try {
      languageDetectionService.setUserLanguagePreference(language);
      setState(prev => ({
        ...prev,
        detectedLanguage: language.toUpperCase(),
        confidence: 0.95,
        source: 'user',
        error: null
      }));
      setLanguage(language.toUpperCase());
    } catch (error) {
      setState(prev => ({ 
        ...prev, 
        error: 'Failed to save language preference'
      }));
    }
  }, [setLanguage]);

  const clearDetectionCache = useCallback((): void => {
    try {
      languageDetectionService.clearDetectionCache();
      setState(prev => ({
        ...prev,
        detectedLanguage: null,
        confidence: 0,
        source: null,
        error: null
      }));
    } catch {
      // Error handled silently
    }
  }, []);

  const isLanguageSupported = useCallback((language: string): boolean => {
    return state.supportedLanguages.includes(language.toUpperCase());
  }, [state.supportedLanguages]);

  const getBestFallback = useCallback((language: string): string => {
    return languageDetectionService.getBestFallbackLanguage(language);
  }, []);

  // Cleanup timeout on unmount
  useEffect(() => {
    return () => {
      if (detectionTimeout) {
        clearTimeout(detectionTimeout);
      }
    };
  }, [detectionTimeout]);

  return {
    ...state,
    detectLanguage,
    detectTextLanguage,
    setUserLanguagePreference,
    clearDetectionCache,
    isLanguageSupported,
    getBestFallback
  };
};