import { api } from './api';
import languageDetectionService from './languageDetectionService';

interface TranslationRequest {
  text: string;
  fromLanguage?: string;
  toLanguage: string;
  namespace?: string;
  key?: string;
  priority?: 'low' | 'medium' | 'high' | 'critical';
}

interface TranslationResponse {
  originalText: string;
  translatedText: string;
  fromLanguage: string;
  toLanguage: string;
  confidence: number;
  cached: boolean;
  timestamp: number;
}

interface TranslationCache {
  [key: string]: {
    translation: string;
    confidence: number;
    timestamp: number;
    hits: number;
  };
}

interface AutoTranslationOptions {
  enableCache: boolean;
  cacheMaxAge: number;
  maxCacheSize: number;
  retryAttempts: number;
  batchSize: number;
  debounceMs: number;
}

class AutoTranslationService {
  private translationCache: TranslationCache = {};
  private readonly CACHE_STORAGE_KEY = 'auto_translation_cache';
  private readonly CACHE_MAX_AGE = 7 * 24 * 60 * 60 * 1000; // 7 days
  private readonly CACHE_MAX_SIZE = 1000;
  private pendingTranslations = new Map<string, Promise<TranslationResponse>>();
  private translationQueue: TranslationRequest[] = [];
  private isProcessingQueue = false;
  private debounceTimers = new Map<string, NodeJS.Timeout>();

  private readonly defaultOptions: AutoTranslationOptions = {
    enableCache: true,
    cacheMaxAge: this.CACHE_MAX_AGE,
    maxCacheSize: this.CACHE_MAX_SIZE,
    retryAttempts: 3,
    batchSize: 10,
    debounceMs: 300
  };

  constructor() {
    this.loadCacheFromStorage();
    this.startPeriodicCacheCleanup();
  }

  /**
   * Auto-translate text with caching and optimization
   */
  async translateText(
    text: string,
    toLanguage: string,
    fromLanguage?: string,
    options?: Partial<AutoTranslationOptions>
  ): Promise<TranslationResponse> {
    const opts = { ...this.defaultOptions, ...options };
    
    if (!text || text.trim().length === 0) {
      throw new Error('Text is required for translation');
    }

    // Normalize language codes
    const targetLang = toLanguage.toUpperCase();
    const sourceLang = fromLanguage?.toUpperCase() || await this.detectSourceLanguage(text);

    // Skip translation if same language
    if (sourceLang === targetLang) {
      return {
        originalText: text,
        translatedText: text,
        fromLanguage: sourceLang,
        toLanguage: targetLang,
        confidence: 1.0,
        cached: false,
        timestamp: Date.now()
      };
    }

    const cacheKey = this.generateCacheKey(text, sourceLang, targetLang);

    // Check cache first
    if (opts.enableCache) {
      const cached = this.getCachedTranslation(cacheKey);
      if (cached) {
        return {
          originalText: text,
          translatedText: cached.translation,
          fromLanguage: sourceLang,
          toLanguage: targetLang,
          confidence: cached.confidence,
          cached: true,
          timestamp: cached.timestamp
        };
      }
    }

    // Check if translation is already pending
    if (this.pendingTranslations.has(cacheKey)) {
      return await this.pendingTranslations.get(cacheKey)!;
    }

    // Create translation promise
    const translationPromise = this.performTranslation({
      text,
      fromLanguage: sourceLang,
      toLanguage: targetLang
    }, opts);

    this.pendingTranslations.set(cacheKey, translationPromise);

    try {
      const result = await translationPromise;
      
      // Cache successful translation
      if (opts.enableCache && result.confidence > 0.6) {
        this.cacheTranslation(cacheKey, {
          translation: result.translatedText,
          confidence: result.confidence,
          timestamp: Date.now(),
          hits: 1
        });
      }

      return result;
    } finally {
      this.pendingTranslations.delete(cacheKey);
    }
  }

  /**
   * Batch translate multiple texts
   */
  async batchTranslate(
    texts: string[],
    toLanguage: string,
    fromLanguage?: string,
    options?: Partial<AutoTranslationOptions>
  ): Promise<TranslationResponse[]> {
    const opts = { ...this.defaultOptions, ...options };
    
    if (!texts || texts.length === 0) {
      return [];
    }

    const targetLang = toLanguage.toUpperCase();
    const results: TranslationResponse[] = [];

    // Process in batches
    for (let i = 0; i < texts.length; i += opts.batchSize) {
      const batch = texts.slice(i, i + opts.batchSize);
      const batchPromises = batch.map(text => 
        this.translateText(text, targetLang, fromLanguage, options)
      );

      try {
        const batchResults = await Promise.all(batchPromises);
        results.push(...batchResults);
      } catch (error) {
        // Add fallback results for failed batch
        const fallbackResults = batch.map(text => ({
          originalText: text,
          translatedText: text,
          fromLanguage: fromLanguage?.toUpperCase() || 'EN',
          toLanguage: targetLang,
          confidence: 0,
          cached: false,
          timestamp: Date.now()
        }));
        results.push(...fallbackResults);
      }
    }

    return results;
  }

  /**
   * Translate with debouncing for real-time inputs
   */
  async translateWithDebounce(
    text: string,
    toLanguage: string,
    fromLanguage?: string,
    debounceKey?: string,
    options?: Partial<AutoTranslationOptions>
  ): Promise<Promise<TranslationResponse>> {
    const opts = { ...this.defaultOptions, ...options };
    const key = debounceKey || `${text.substring(0, 50)}-${toLanguage}`;

    return new Promise((resolve, reject) => {
      // Clear existing timer
      const existingTimer = this.debounceTimers.get(key);
      if (existingTimer) {
        clearTimeout(existingTimer);
      }

      // Set new timer
      const timer = setTimeout(async () => {
        try {
          const result = await this.translateText(text, toLanguage, fromLanguage, options);
          resolve(result);
        } catch (error) {
          reject(error);
        } finally {
          this.debounceTimers.delete(key);
        }
      }, opts.debounceMs);

      this.debounceTimers.set(key, timer);
    });
  }

  /**
   * Auto-translate content when language changes
   */
  async autoTranslateOnLanguageChange(
    content: { [key: string]: string },
    newLanguage: string,
    currentLanguage?: string
  ): Promise<{ [key: string]: string }> {
    try {
      const targetLang = newLanguage.toUpperCase();
      
      // Check if target language is supported
      const isSupported = await languageDetectionService.isLanguageSupported(targetLang);
      if (!isSupported) {
        const fallbackLang = languageDetectionService.getBestFallbackLanguage(targetLang);
        return await this.autoTranslateOnLanguageChange(content, fallbackLang, currentLanguage);
      }

      const translatedContent: { [key: string]: string } = {};
      const texts = Object.values(content);
      const keys = Object.keys(content);

      if (texts.length === 0) {
        return content;
      }

      // Batch translate all content
      const translations = await this.batchTranslate(
        texts,
        targetLang,
        currentLanguage
      );

      // Map results back to keys
      keys.forEach((key, index) => {
        translatedContent[key] = translations[index]?.translatedText || content[key];
      });

      return translatedContent;
    } catch (error) {
      return content; // Return original content on failure
    }
  }

  /**
   * Translate form fields in real-time
   */
  async translateFormFields(
    formData: { [fieldName: string]: string },
    toLanguage: string,
    fromLanguage?: string
  ): Promise<{ [fieldName: string]: string }> {
    try {
      const translatedFields: { [fieldName: string]: string } = {};
      
      const translationPromises = Object.entries(formData).map(async ([fieldName, value]) => {
        if (!value || value.trim().length === 0) {
          return [fieldName, value];
        }

        try {
          const result = await this.translateWithDebounce(
            value,
            toLanguage,
            fromLanguage,
            `form-${fieldName}`
          );
          const translation = await result;
          return [fieldName, translation.translatedText];
        } catch (error) {
          return [fieldName, value];
        }
      });

      const results = await Promise.all(translationPromises);
      results.forEach(([fieldName, translatedValue]) => {
        translatedFields[fieldName] = translatedValue;
      });

      return translatedFields;
    } catch (error) {
      return formData;
    }
  }

  /**
   * Get translation statistics
   */
  getTranslationStats(): {
    cacheSize: number;
    cacheHitRate: number;
    pendingTranslations: number;
    queueLength: number;
  } {
    const totalTranslations = Object.values(this.translationCache).reduce(
      (sum, item) => sum + item.hits, 0
    );
    const cacheHits = Object.values(this.translationCache).filter(
      item => item.hits > 1
    ).length;

    return {
      cacheSize: Object.keys(this.translationCache).length,
      cacheHitRate: totalTranslations > 0 ? (cacheHits / totalTranslations) * 100 : 0,
      pendingTranslations: this.pendingTranslations.size,
      queueLength: this.translationQueue.length
    };
  }

  /**
   * Clear translation cache
   */
  clearCache(): void {
    this.translationCache = {};
    this.saveCacheToStorage();
  }

  /**
   * Preload translations for common content
   */
  async preloadTranslations(
    commonTexts: string[],
    targetLanguages: string[],
    sourceLanguage?: string
  ): Promise<void> {
    try {
      const preloadPromises = targetLanguages.flatMap(targetLang =>
        commonTexts.map(text =>
          this.translateText(text, targetLang, sourceLanguage, {
            enableCache: true,
            retryAttempts: 1
          }).catch(error => {
            return null;
          })
        )
      );

      await Promise.allSettled(preloadPromises);
    } catch {
      // Error handled silently
    }
  }

  // Private methods

  private async performTranslation(
    request: TranslationRequest,
    options: AutoTranslationOptions
  ): Promise<TranslationResponse> {
    let lastError: Error | null = null;

    for (let attempt = 1; attempt <= options.retryAttempts; attempt++) {
      try {
        const response = await api.post('/translations/translate', {
          text: request.text,
          fromLanguage: request.fromLanguage,
          toLanguage: request.toLanguage
        });

        const data = response.data.data;
        return {
          originalText: request.text,
          translatedText: data.translatedText || request.text,
          fromLanguage: request.fromLanguage || 'EN',
          toLanguage: request.toLanguage,
          confidence: data.confidence || 0.8,
          cached: false,
          timestamp: Date.now()
        };
      } catch (error) {
        lastError = error as Error;
        
        if (attempt < options.retryAttempts) {
          // Exponential backoff
          await new Promise(resolve => setTimeout(resolve, Math.pow(2, attempt) * 1000));
        }
      }
    }

    throw lastError || new Error('Translation failed after all retry attempts');
  }

  private async detectSourceLanguage(text: string): Promise<string> {
    try {
      const detection = await languageDetectionService.detectTextLanguage(text);
      return detection?.language || 'EN';
    } catch (error) {
      return 'EN';
    }
  }

  private generateCacheKey(text: string, fromLang: string, toLang: string): string {
    const textHash = this.simpleHash(text);
    return `${fromLang}-${toLang}-${textHash}`;
  }

  private simpleHash(str: string): string {
    let hash = 0;
    if (str.length === 0) return hash.toString();
    
    for (let i = 0; i < str.length; i++) {
      const char = str.charCodeAt(i);
      hash = ((hash << 5) - hash) + char;
      hash = hash & hash; // Convert to 32bit integer
    }
    
    return Math.abs(hash).toString(16);
  }

  private getCachedTranslation(cacheKey: string) {
    const cached = this.translationCache[cacheKey];
    if (!cached) return null;

    // Check if cache is expired
    if (Date.now() - cached.timestamp > this.CACHE_MAX_AGE) {
      delete this.translationCache[cacheKey];
      return null;
    }

    // Increment hit count
    cached.hits += 1;
    return cached;
  }

  private cacheTranslation(cacheKey: string, cacheItem: Omit<TranslationCache[string], 'hits'> & { hits?: number }) {
    // Manage cache size
    if (Object.keys(this.translationCache).length >= this.CACHE_MAX_SIZE) {
      this.evictOldestCacheEntries();
    }

    this.translationCache[cacheKey] = {
      ...cacheItem,
      hits: cacheItem.hits || 1
    };

    this.saveCacheToStorage();
  }

  private evictOldestCacheEntries(): void {
    const entries = Object.entries(this.translationCache);
    
    // Sort by timestamp (oldest first) and hits (least used first)
    entries.sort((a, b) => {
      const timeDiff = a[1].timestamp - b[1].timestamp;
      if (timeDiff !== 0) return timeDiff;
      return a[1].hits - b[1].hits;
    });

    // Remove oldest 10% of entries
    const toRemove = Math.max(1, Math.floor(entries.length * 0.1));
    entries.slice(0, toRemove).forEach(([key]) => {
      delete this.translationCache[key];
    });
  }

  private loadCacheFromStorage(): void {
    try {
      const cached = localStorage.getItem(this.CACHE_STORAGE_KEY);
      if (cached) {
        const parsedCache = JSON.parse(cached);
        // Validate and filter expired entries
        Object.entries(parsedCache).forEach(([key, value]: [string, unknown]) => {
          if (value.timestamp && Date.now() - value.timestamp < this.CACHE_MAX_AGE) {
            this.translationCache[key] = value;
          }
        });
      }
    } catch {
      // Error handled silently
    }
  }

  private saveCacheToStorage(): void {
    try {
      localStorage.setItem(this.CACHE_STORAGE_KEY, JSON.stringify(this.translationCache));
    } catch {
      // Error handled silently
    }
  }

  private cacheCleanupInterval: ReturnType<typeof setInterval> | null = null;

  private startPeriodicCacheCleanup(): void {
    // Clean up cache every 30 minutes
    if (this.cacheCleanupInterval) clearInterval(this.cacheCleanupInterval);
    this.cacheCleanupInterval = setInterval(() => {
      const now = Date.now();
      Object.keys(this.translationCache).forEach(key => {
        const item = this.translationCache[key];
        if (now - item.timestamp > this.CACHE_MAX_AGE) {
          delete this.translationCache[key];
        }
      });
      this.saveCacheToStorage();
    }, 30 * 60 * 1000);
  }

  public destroy(): void {
    if (this.cacheCleanupInterval) {
      clearInterval(this.cacheCleanupInterval);
      this.cacheCleanupInterval = null;
    }
    this.debounceTimers.forEach(timer => clearTimeout(timer));
    this.debounceTimers.clear();
  }
}

export default new AutoTranslationService();