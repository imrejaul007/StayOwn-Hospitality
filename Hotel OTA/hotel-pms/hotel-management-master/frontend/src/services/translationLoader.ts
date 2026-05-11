import { languageService, type Language } from './languageService';

export interface TranslationResource {
  namespace: string;
  language: string;
  translations: Record<string, string>;
  metadata: {
    loadedAt: number;
    completeness: number;
    keyCount: number;
    version?: string;
  };
}

export interface LoadingState {
  isLoading: boolean;
  progress: number;
  error?: string;
  loadedNamespaces: string[];
  failedNamespaces: string[];
}

export interface TranslationOptions {
  variables?: Record<string, string | number>;
  count?: number;
  defaultValue?: string;
  fallbackLanguage?: string;
  namespace?: string;
}

export interface MissingTranslation {
  key: string;
  namespace: string;
  language: string;
  context?: string;
  detectedAt: number;
  fallbackUsed?: string;
}

class TranslationLoader {
  private resources: Map<string, TranslationResource> = new Map();
  private loadingPromises: Map<string, Promise<void>> = new Map();
  private listeners: Set<(state: LoadingState) => void> = new Set();
  private missingTranslations: Map<string, MissingTranslation> = new Map();
  private currentLanguage: string = 'EN';
  private fallbackLanguage: string = 'EN';
  private preloadTimer: ReturnType<typeof setTimeout> | null = null;
  private loadingState: LoadingState = {
    isLoading: false,
    progress: 0,
    loadedNamespaces: [],
    failedNamespaces: []
  };

  /**
   * Initialize the translation loader
   */
  async initialize(language: string, fallback = 'EN'): Promise<void> {
    this.currentLanguage = language.toUpperCase();
    this.fallbackLanguage = fallback.toUpperCase();
    
    // Load critical namespaces immediately
    const criticalNamespaces = ['common', 'errors', 'navigation'];
    await this.loadNamespaces(criticalNamespaces, language);
    
    // Preload frequently used namespaces in background
    this.preloadNamespaces(['booking', 'forms', 'validation'], language);
  }

  /**
   * Load translations for specific namespaces
   */
  async loadNamespaces(namespaces: string[], language?: string): Promise<void> {
    const targetLanguage = (language || this.currentLanguage).toUpperCase();
    const promises: Promise<void>[] = [];

    this.updateLoadingState({
      isLoading: true,
      progress: 0
    });

    for (const namespace of namespaces) {
      promises.push(this.loadNamespace(namespace, targetLanguage));
    }

    try {
      await Promise.allSettled(promises);
      
      this.updateLoadingState({
        isLoading: false,
        progress: 100
      });
    } catch (error) {
      this.updateLoadingState({
        isLoading: false,
        progress: 100,
        error: error instanceof Error ? error.message : 'Unknown error'
      });
    }
  }

  /**
   * Load translations for a single namespace
   */
  private async loadNamespace(namespace: string, language: string): Promise<void> {
    const resourceKey = `${namespace}:${language}`;
    
    // Check if already loaded or loading
    if (this.resources.has(resourceKey)) {
      return;
    }
    
    if (this.loadingPromises.has(resourceKey)) {
      return this.loadingPromises.get(resourceKey);
    }

    const promise = this.doLoadNamespace(namespace, language, resourceKey);
    this.loadingPromises.set(resourceKey, promise);
    
    try {
      await promise;
    } finally {
      this.loadingPromises.delete(resourceKey);
    }
  }

  private async doLoadNamespace(namespace: string, language: string, resourceKey: string): Promise<void> {
    try {
      const response = await languageService.getTranslations(namespace, language, {
        includeStatus: false,
        includeMeta: true
      });

      const resource: TranslationResource = {
        namespace,
        language,
        translations: response.data as Record<string, string>,
        metadata: {
          loadedAt: Date.now(),
          completeness: response.meta.completeness,
          keyCount: response.meta.keyCount,
          version: '1.0.0'
        }
      };

      this.resources.set(resourceKey, resource);
      
      this.updateLoadingState({
        loadedNamespaces: [...this.loadingState.loadedNamespaces, namespace]
      });


    } catch (error) {
      
      this.updateLoadingState({
        failedNamespaces: [...this.loadingState.failedNamespaces, namespace],
        error: error instanceof Error ? error.message : 'Failed to load translations'
      });

      // If main language fails, try fallback
      if (language !== this.fallbackLanguage) {
        try {
          await this.doLoadNamespace(namespace, this.fallbackLanguage, `${namespace}:${this.fallbackLanguage}`);
        } catch {
          // Error handled silently
        }
      }
    }
  }

  /**
   * Preload namespaces in background (non-blocking)
   */
  private preloadNamespaces(namespaces: string[], language: string): void {
    // Use setTimeout to make it non-blocking
    if (this.preloadTimer) clearTimeout(this.preloadTimer);
    this.preloadTimer = setTimeout(async () => {
      this.preloadTimer = null;
      for (const namespace of namespaces) {
        try {
          await this.loadNamespace(namespace, language);
        } catch {
          // Error handled silently
        }
      }
    }, 100);
  }

  /**
   * Get translation by key
   */
  translate(
    key: string, 
    options: TranslationOptions = {}
  ): string {
    const {
      variables = {},
      count,
      defaultValue,
      fallbackLanguage = this.fallbackLanguage,
      namespace = 'common'
    } = options;

    // Try main language first
    let translation = this.getTranslationFromResource(key, namespace, this.currentLanguage);
    
    // Try fallback language if main language failed
    if (!translation && this.currentLanguage !== fallbackLanguage) {
      translation = this.getTranslationFromResource(key, namespace, fallbackLanguage);
    }

    // Use default value if provided
    if (!translation && defaultValue) {
      translation = defaultValue;
    }

    // Fall back to key itself
    if (!translation) {
      translation = key;
      this.recordMissingTranslation(key, namespace, this.currentLanguage);
    }

    // Handle pluralization
    if (count !== undefined && typeof count === 'number') {
      translation = this.handlePluralization(translation, count, this.currentLanguage);
    }

    // Handle variable interpolation
    if (Object.keys(variables).length > 0) {
      translation = this.interpolateVariables(translation, variables);
    }

    return translation;
  }

  /**
   * Get translation from loaded resources
   */
  private getTranslationFromResource(key: string, namespace: string, language: string): string | null {
    const resourceKey = `${namespace}:${language}`;
    const resource = this.resources.get(resourceKey);
    
    if (!resource) {
      // Try to load namespace if not loaded
      this.loadNamespace(namespace, language).catch(error => {
      });
      return null;
    }

    return resource.translations[key] || null;
  }

  /**
   * Handle pluralization based on count
   */
  private handlePluralization(translation: string, count: number, language: string): string {
    // Simple English pluralization for now
    // In production, this should use proper pluralization rules for each language
    if (language === 'EN') {
      if (translation.includes('{{count}}')) {
        let pluralizedTranslation = translation;
        
        // Simple plural handling - look for patterns like "item|items"
        const pluralPattern = /([^|]+)\|([^|]+)/g;
        pluralizedTranslation = pluralizedTranslation.replace(pluralPattern, (match, singular, plural) => {
          return count === 1 ? singular : plural;
        });
        
        return pluralizedTranslation.replace(/\{\{count\}\}/g, count.toString());
      }
    }
    
    return translation.replace(/\{\{count\}\}/g, count.toString());
  }

  /**
   * Interpolate variables in translation
   */
  private interpolateVariables(translation: string, variables: Record<string, string | number>): string {
    let result = translation;
    
    Object.entries(variables).forEach(([key, value]) => {
      const pattern = new RegExp(`\\{\\{${key}\\}\\}`, 'g');
      result = result.replace(pattern, String(value));
    });
    
    return result;
  }

  /**
   * Record missing translation for analysis
   */
  private recordMissingTranslation(key: string, namespace: string, language: string): void {
    const missingKey = `${namespace}:${key}:${language}`;
    
    if (!this.missingTranslations.has(missingKey)) {
      this.missingTranslations.set(missingKey, {
        key,
        namespace,
        language,
        detectedAt: Date.now()
      });
    }
  }

  /**
   * Batch translate multiple keys
   */
  translateBatch(
    keys: string[],
    options: Omit<TranslationOptions, 'defaultValue'> & { 
      defaultValues?: Record<string, string>;
      namespace?: string;
    } = {}
  ): Record<string, string> {
    const { defaultValues = {}, namespace = 'common', ...restOptions } = options;
    const result: Record<string, string> = {};
    
    keys.forEach(key => {
      result[key] = this.translate(key, {
        ...restOptions,
        namespace,
        defaultValue: defaultValues[key]
      });
    });
    
    return result;
  }

  /**
   * Check if namespace is loaded
   */
  isNamespaceLoaded(namespace: string, language?: string): boolean {
    const targetLanguage = (language || this.currentLanguage).toUpperCase();
    const resourceKey = `${namespace}:${targetLanguage}`;
    return this.resources.has(resourceKey);
  }

  /**
   * Get loaded namespaces
   */
  getLoadedNamespaces(language?: string): string[] {
    const targetLanguage = (language || this.currentLanguage).toUpperCase();
    const namespaces = Array.from(this.resources.keys())
      .filter(key => key.endsWith(`:${targetLanguage}`))
      .map(key => key.split(':')[0]);
    
    return Array.from(new Set(namespaces));
  }

  /**
   * Get missing translations for debugging/analytics
   */
  getMissingTranslations(): MissingTranslation[] {
    return Array.from(this.missingTranslations.values());
  }

  /**
   * Clear missing translations log
   */
  clearMissingTranslations(): void {
    this.missingTranslations.clear();
  }

  /**
   * Change current language
   */
  async changeLanguage(language: string): Promise<void> {
    const newLanguage = language.toUpperCase();
    
    if (newLanguage === this.currentLanguage) {
      return;
    }

    this.currentLanguage = newLanguage;
    
    // Load critical namespaces for new language
    const loadedNamespaces = this.getLoadedNamespaces(this.fallbackLanguage);
    if (loadedNamespaces.length > 0) {
      await this.loadNamespaces(loadedNamespaces, newLanguage);
    }
  }

  /**
   * Reload namespace (force refresh)
   */
  async reloadNamespace(namespace: string, language?: string): Promise<void> {
    const targetLanguage = (language || this.currentLanguage).toUpperCase();
    const resourceKey = `${namespace}:${targetLanguage}`;
    
    // Remove from cache
    this.resources.delete(resourceKey);
    
    // Reload
    await this.loadNamespace(namespace, targetLanguage);
  }

  /**
   * Add translation change listener
   */
  addListener(listener: (state: LoadingState) => void): () => void {
    this.listeners.add(listener);
    
    // Return unsubscribe function
    return () => {
      this.listeners.delete(listener);
    };
  }

  /**
   * Update loading state and notify listeners
   */
  private updateLoadingState(update: Partial<LoadingState>): void {
    this.loadingState = { ...this.loadingState, ...update };
    
    this.listeners.forEach(listener => {
      try {
        listener(this.loadingState);
      } catch {
        // Error handled silently
      }
    });
  }

  /**
   * Get current loading state
   */
  getLoadingState(): LoadingState {
    return { ...this.loadingState };
  }

  /**
   * Get resource statistics
   */
  getStats(): {
    totalResources: number;
    totalKeys: number;
    byNamespace: Record<string, { languages: string[]; keyCount: number; }>;
    byLanguage: Record<string, { namespaces: string[]; keyCount: number; }>;
    memoryUsage: number;
  } {
    const byNamespace: Record<string, { languages: string[]; keyCount: number; }> = {};
    const byLanguage: Record<string, { languages: string[]; keyCount: number; }> = {};
    let totalKeys = 0;
    let memoryUsage = 0;

    this.resources.forEach((resource, key) => {
      const [namespace, language] = key.split(':');
      totalKeys += resource.metadata.keyCount;
      
      // Rough memory calculation
      memoryUsage += JSON.stringify(resource).length;

      if (!byNamespace[namespace]) {
        byNamespace[namespace] = { languages: [], keyCount: 0 };
      }
      byNamespace[namespace].languages.push(language);
      byNamespace[namespace].keyCount += resource.metadata.keyCount;

      if (!byLanguage[language]) {
        byLanguage[language] = { namespaces: [], keyCount: 0 };
      }
      byLanguage[language].namespaces.push(namespace);
      byLanguage[language].keyCount += resource.metadata.keyCount;
    });

    return {
      totalResources: this.resources.size,
      totalKeys,
      byNamespace,
      byLanguage,
      memoryUsage
    };
  }

  /**
   * Clear all loaded resources
   */
  clear(): void {
    this.resources.clear();
    this.loadingPromises.clear();
    this.missingTranslations.clear();
    this.updateLoadingState({
      isLoading: false,
      progress: 0,
      error: undefined,
      loadedNamespaces: [],
      failedNamespaces: []
    });
  }
}

// Create and export singleton instance
export const translationLoader = new TranslationLoader();
export default translationLoader;