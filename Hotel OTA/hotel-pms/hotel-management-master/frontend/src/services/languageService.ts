import { api } from './api';

// Core language interfaces
export interface Language {
  _id: string;
  code: string;
  name: string;
  nativeName: string;
  locale: string;
  direction: 'ltr' | 'rtl';
  formatting: {
    dateFormat: {
      short: string;
      medium: string;
      long: string;
      full: string;
    };
    timeFormat: {
      short: string;
      medium: string;
      long: string;
    };
    numberFormat: {
      decimalSeparator: string;
      thousandsSeparator: string;
      currencyPosition: 'before' | 'after';
    };
    addressFormat: string;
  };
  translation: {
    providers: Array<{
      name: 'google' | 'deepl' | 'azure' | 'aws' | 'manual';
      priority: number;
      isActive: boolean;
    }>;
    autoTranslate: {
      enabled: boolean;
      threshold: number;
      excludeFields: string[];
    };
    quality: {
      requireHumanReview: boolean;
      minimumConfidence: number;
      fallbackToEnglish: boolean;
    };
  };
  otaChannels: Array<{
    channel: string;
    channelLanguageCode: string;
    isSupported: boolean;
    isDefault: boolean;
    formatting?: {
      dateFormat?: string;
      timeFormat?: string;
      addressFormat?: string;
    };
  }>;
  content: {
    sourceLanguage: string;
    completeness: {
      roomTypes: number;
      amenities: number;
      policies: number;
      descriptions: number;
      emailTemplates: number;
      uiTexts: number;
    };
    lastUpdated: string;
  };
  contexts: Array<{
    name: 'website' | 'booking_engine' | 'guest_portal' | 'staff_interface' | 'email' | 'sms';
    isEnabled: boolean;
    priority: number;
    overrides?: {
      dateFormat?: string;
      timeFormat?: string;
      numberFormat?: {
        decimalSeparator?: string;
        thousandsSeparator?: string;
      };
    };
  }>;
  isActive: boolean;
  isDefault: boolean;
  usage: {
    totalTranslations: number;
    totalRequests: number;
    lastUsed?: string;
    popularityScore: number;
  };
  metadata: {
    script?: string;
    family?: string;
    speakers?: number;
    regions?: string[];
    complexity?: 'low' | 'medium' | 'high';
  };
  displayName: string;
  overallCompleteness: number;
  createdAt: string;
  updatedAt: string;
}

export interface Translation {
  _id: string;
  key: string;
  namespace: string;
  context: string;
  sourceLanguage: string;
  sourceText: string;
  translations: Array<{
    language: string;
    text: string;
    status: 'pending' | 'translated' | 'approved' | 'published';
    confidence: number;
    provider?: string;
    translator?: string;
    reviewedBy?: string;
    translatedAt: string;
    reviewedAt?: string;
    metadata?: Record<string, unknown>;
  }>;
  tags: string[];
  pluralizations?: Record<string, Array<{
    language: string;
    forms: Record<string, string>; // zero, one, two, few, many, other
  }>>;
  interpolation?: {
    hasVariables: boolean;
    variables: string[];
  };
  usage: {
    frequency: number;
    contexts: string[];
    lastUsed?: string;
  };
  priority: 'low' | 'medium' | 'high' | 'critical';
  isActive: boolean;
  createdAt: string;
  updatedAt: string;
}

export interface TranslationNamespace {
  name: string;
  description?: string;
  keyCount: number;
  languages: string[];
  completeness: Record<string, number>;
  lastUpdated: string;
}

export interface LanguageDetectionResult {
  language: string;
  confidence: number;
  alternatives?: Array<{
    language: string;
    confidence: number;
  }>;
}

export interface TranslationRequest {
  text: string;
  fromLanguage?: string;
  toLanguage: string;
  context?: string;
  namespace?: string;
  key?: string;
  options?: {
    provider?: string;
    priority?: 'low' | 'medium' | 'high' | 'critical';
    requireHumanReview?: boolean;
  };
}

export interface BatchTranslationRequest {
  items: Array<{
    key: string;
    text: string;
    context?: string;
    namespace?: string;
  }>;
  fromLanguage: string;
  toLanguages: string[];
  options?: {
    provider?: string;
    batchSize?: number;
    autoApprove?: boolean;
  };
}

export interface LanguagePreferences {
  primaryLanguage: string;
  fallbackLanguages: string[];
  autoDetect: boolean;
  region?: string;
  timezone?: string;
  dateFormat?: string;
  timeFormat?: string;
  numberFormat?: {
    currency?: string;
    decimalPlaces?: number;
  };
}

class LanguageService {
  private readonly baseUrl = '/languages';
  private readonly translationsUrl = '/translations';
  private cache: Map<string, { data: unknown; timestamp: number; ttl: number }> = new Map();
  private cacheTTL = 300000; // 5 minutes

  /**
   * Get all active languages
   */
  async getActiveLanguages(context?: string): Promise<{ data: Language[]; meta: { total: number } }> {
    try {
      const cacheKey = `languages_${context || 'all'}`;
      const cached = this.getCachedData(cacheKey);
      if (cached) return cached;

      const params = new URLSearchParams();
      if (context) params.append('context', context);

      const response = await api.get(`${this.baseUrl}/active?${params.toString()}`);
      
      this.setCachedData(cacheKey, response.data);
      return response.data;
    } catch (error: unknown) {
      const axiosErr = error as { response?: { data?: { message?: string }; status?: number }; config?: unknown };
      throw new Error(axiosErr.response?.data?.message || 'Failed to fetch active languages');
    }
  }

  /**
   * Get default language
   */
  async getDefaultLanguage(): Promise<{ data: Language }> {
    try {
      const cacheKey = 'default_language';
      const cached = this.getCachedData(cacheKey);
      if (cached) return cached;

      const response = await api.get(`${this.baseUrl}/default`);
      
      this.setCachedData(cacheKey, response.data);
      return response.data;
    } catch (error: unknown) {
      const axiosErr = error as { response?: { data?: { message?: string }; status?: number }; config?: unknown };
      throw new Error(axiosErr.response?.data?.message || 'Failed to fetch default language');
    }
  }

  /**
   * Get language by code
   */
  async getLanguageByCode(code: string): Promise<{ data: Language }> {
    try {
      const cacheKey = `language_${code}`;
      const cached = this.getCachedData(cacheKey);
      if (cached) return cached;

      const response = await api.get(`${this.baseUrl}/${code}`);
      
      this.setCachedData(cacheKey, response.data);
      return response.data;
    } catch (error: unknown) {
      const axiosErr = error as { response?: { data?: { message?: string }; status?: number }; config?: unknown };
      throw new Error(axiosErr.response?.data?.message || 'Failed to fetch language');
    }
  }

  /**
   * Get languages supported by OTA channel
   */
  async getLanguagesByChannel(channel: string): Promise<{ data: Language[]; meta: { channel: string; total: number } }> {
    try {
      const cacheKey = `languages_channel_${channel}`;
      const cached = this.getCachedData(cacheKey);
      if (cached) return cached;

      const response = await api.get(`${this.baseUrl}/channel/${channel}`);
      
      this.setCachedData(cacheKey, response.data);
      return response.data;
    } catch (error: unknown) {
      const axiosErr = error as { response?: { data?: { message?: string }; status?: number }; config?: unknown };
      throw new Error(axiosErr.response?.data?.message || 'Failed to fetch channel languages');
    }
  }

  /**
   * Detect language of text
   */
  async detectLanguage(text: string): Promise<{ data: LanguageDetectionResult }> {
    try {
      const response = await api.post(`${this.baseUrl}/detect`, { text });
      return response.data;
    } catch (error: unknown) {
      const axiosErr = error as { response?: { data?: { message?: string }; status?: number }; config?: unknown };
      throw new Error(axiosErr.response?.data?.message || 'Failed to detect language');
    }
  }

  /**
   * Get translation namespaces
   */
  async getTranslationNamespaces(): Promise<{ data: TranslationNamespace[]; meta: { total: number } }> {
    try {
      const cacheKey = 'translation_namespaces';
      const cached = this.getCachedData(cacheKey);
      if (cached) return cached;

      const response = await api.get(`${this.translationsUrl}/namespaces`);
      
      this.setCachedData(cacheKey, response.data, 600000); // 10 minutes cache
      return response.data;
    } catch (error: unknown) {
      const axiosErr = error as { response?: { data?: { message?: string }; status?: number }; config?: unknown };
      throw new Error(axiosErr.response?.data?.message || 'Failed to fetch namespaces');
    }
  }

  /**
   * Get translations for a namespace and language
   */
  async getTranslations(
    namespace: string, 
    language: string,
    options: {
      includeStatus?: boolean;
      includeMeta?: boolean;
      context?: string;
    } = {}
  ): Promise<{ 
    data: Record<string, string | Translation>; 
    meta: { 
      namespace: string; 
      language: string; 
      keyCount: number; 
      completeness: number;
    } 
  }> {
    try {
      const cacheKey = `translations_${namespace}_${language}_${JSON.stringify(options)}`;
      const cached = this.getCachedData(cacheKey);
      if (cached) return cached;

      const params = new URLSearchParams();
      if (options.includeStatus) params.append('includeStatus', 'true');
      if (options.includeMeta) params.append('includeMeta', 'true');
      if (options.context) params.append('context', options.context);

      const response = await api.get(`${this.translationsUrl}/${namespace}/${language}?${params.toString()}`);
      
      this.setCachedData(cacheKey, response.data);
      return response.data;
    } catch (error: unknown) {
      const axiosErr = error as { response?: { data?: { message?: string }; status?: number }; config?: unknown };
      throw new Error(axiosErr.response?.data?.message || 'Failed to fetch translations');
    }
  }

  /**
   * Get multiple translations at once
   */
  async getBatchTranslations(
    keys: string[],
    language: string,
    namespace = 'common'
  ): Promise<{ data: Record<string, string>; meta: { found: number; missing: string[] } }> {
    try {
      const response = await api.post(`${this.translationsUrl}/batch`, {
        keys,
        language,
        namespace
      });
      return response.data;
    } catch (error: unknown) {
      const axiosErr = error as { response?: { data?: { message?: string }; status?: number }; config?: unknown };
      throw new Error(axiosErr.response?.data?.message || 'Failed to fetch batch translations');
    }
  }

  /**
   * Translate text
   */
  async translateText(request: TranslationRequest): Promise<{
    data: {
      originalText: string;
      translatedText: string;
      fromLanguage: string;
      toLanguage: string;
      confidence: number;
      provider: string;
      cached: boolean;
    };
  }> {
    try {
      const response = await api.post(`${this.translationsUrl}/translate`, request);
      return response.data;
    } catch (error: unknown) {
      const axiosErr = error as { response?: { data?: { message?: string }; status?: number }; config?: unknown };
      throw new Error(axiosErr.response?.data?.message || 'Failed to translate text');
    }
  }

  /**
   * Batch translate multiple texts
   */
  async batchTranslate(request: BatchTranslationRequest): Promise<{
    data: {
      results: Array<{
        key: string;
        originalText: string;
        translations: Record<string, {
          text: string;
          confidence: number;
          provider: string;
        }>;
      }>;
      summary: {
        total: number;
        successful: number;
        failed: number;
      };
    };
  }> {
    try {
      const response = await api.post(`${this.translationsUrl}/batch-translate`, request);
      return response.data;
    } catch (error: unknown) {
      const axiosErr = error as { response?: { data?: { message?: string }; status?: number }; config?: unknown };
      throw new Error(axiosErr.response?.data?.message || 'Failed to batch translate');
    }
  }

  /**
   * Create or update translation
   */
  async saveTranslation(
    key: string,
    namespace: string,
    sourceText: string,
    translations: Record<string, string>,
    options: {
      context?: string;
      tags?: string[];
      priority?: 'low' | 'medium' | 'high' | 'critical';
      autoApprove?: boolean;
    } = {}
  ): Promise<{ data: Translation; message: string }> {
    try {
      const response = await api.post(`${this.translationsUrl}`, {
        key,
        namespace,
        sourceText,
        translations,
        ...options
      });
      
      // Clear relevant caches
      this.clearNamespaceCache(namespace);
      
      return response.data;
    } catch (error: unknown) {
      const axiosErr = error as { response?: { data?: { message?: string }; status?: number }; config?: unknown };
      throw new Error(axiosErr.response?.data?.message || 'Failed to save translation');
    }
  }

  /**
   * Delete translation
   */
  async deleteTranslation(key: string, namespace: string): Promise<{ message: string }> {
    try {
      const response = await api.delete(`${this.translationsUrl}/${namespace}/${key}`);
      
      // Clear relevant caches
      this.clearNamespaceCache(namespace);
      
      return response.data;
    } catch (error: unknown) {
      const axiosErr = error as { response?: { data?: { message?: string }; status?: number }; config?: unknown };
      throw new Error(axiosErr.response?.data?.message || 'Failed to delete translation');
    }
  }

  /**
   * Approve translation
   */
  async approveTranslation(
    key: string,
    namespace: string,
    language: string,
    reviewerId?: string
  ): Promise<{ message: string }> {
    try {
      const response = await api.put(`${this.translationsUrl}/${namespace}/${key}/approve`, {
        language,
        reviewerId
      });
      
      // Clear relevant caches
      this.clearNamespaceCache(namespace);
      
      return response.data;
    } catch (error: unknown) {
      const axiosErr = error as { response?: { data?: { message?: string }; status?: number }; config?: unknown };
      throw new Error(axiosErr.response?.data?.message || 'Failed to approve translation');
    }
  }

  /**
   * Get translation statistics
   */
  async getTranslationStats(
    options: {
      namespace?: string;
      language?: string;
      dateRange?: {
        startDate: string;
        endDate: string;
      };
    } = {}
  ): Promise<{
    data: {
      overview: {
        totalKeys: number;
        totalTranslations: number;
        completeness: number;
        lastUpdated: string;
      };
      byLanguage: Record<string, {
        keyCount: number;
        completeness: number;
        pendingCount: number;
        approvedCount: number;
      }>;
      byNamespace: Record<string, {
        keyCount: number;
        completeness: number;
        lastUpdated: string;
      }>;
    };
  }> {
    try {
      const params = new URLSearchParams();
      if (options.namespace) params.append('namespace', options.namespace);
      if (options.language) params.append('language', options.language);
      if (options.dateRange) {
        params.append('startDate', options.dateRange.startDate);
        params.append('endDate', options.dateRange.endDate);
      }

      const response = await api.get(`${this.translationsUrl}/stats?${params.toString()}`);
      return response.data;
    } catch (error: unknown) {
      const axiosErr = error as { response?: { data?: { message?: string }; status?: number }; config?: unknown };
      throw new Error(axiosErr.response?.data?.message || 'Failed to fetch translation stats');
    }
  }

  /**
   * Format date according to language preferences
   */
  formatDate(date: Date | string, language: Language, format: 'short' | 'medium' | 'long' | 'full' = 'medium'): string {
    try {
      const dateObj = typeof date === 'string' ? new Date(date) : date;
      const formatPattern = language.formatting.dateFormat[format];
      
      // Use Intl.DateTimeFormat with language locale
      return new Intl.DateTimeFormat(language.locale, {
        year: formatPattern.includes('YYYY') ? 'numeric' : undefined,
        month: formatPattern.includes('MMM') ? (formatPattern.includes('MMMM') ? 'long' : 'short') : 
               formatPattern.includes('MM') ? '2-digit' : 'numeric',
        day: formatPattern.includes('DD') ? '2-digit' : 'numeric',
        weekday: formatPattern.includes('dddd') ? 'long' : formatPattern.includes('dd') ? 'short' : undefined
      }).format(dateObj);
    } catch (error) {
      return date.toString();
    }
  }

  /**
   * Format time according to language preferences
   */
  formatTime(time: Date | string, language: Language, format: 'short' | 'medium' | 'long' = 'short'): string {
    try {
      const timeObj = typeof time === 'string' ? new Date(time) : time;
      const formatPattern = language.formatting.timeFormat[format];
      
      return new Intl.DateTimeFormat(language.locale, {
        hour: formatPattern.includes('HH') ? '2-digit' : 'numeric',
        minute: formatPattern.includes('mm') ? '2-digit' : 'numeric',
        second: formatPattern.includes('ss') ? '2-digit' : undefined,
        timeZoneName: formatPattern.includes('z') ? 'short' : undefined,
        hour12: !formatPattern.includes('HH')
      }).format(timeObj);
    } catch (error) {
      return time.toString();
    }
  }

  /**
   * Format number according to language preferences
   */
  formatNumber(
    number: number, 
    language: Language, 
    options: {
      style?: 'decimal' | 'currency' | 'percent';
      currency?: string;
      minimumFractionDigits?: number;
      maximumFractionDigits?: number;
    } = {}
  ): string {
    try {
      const formatOptions: Intl.NumberFormatOptions = {
        style: options.style || 'decimal',
        currency: options.currency,
        minimumFractionDigits: options.minimumFractionDigits,
        maximumFractionDigits: options.maximumFractionDigits
      };

      return new Intl.NumberFormat(language.locale, formatOptions).format(number);
    } catch (error) {
      return number.toString();
    }
  }

  /**
   * Format currency amount
   */
  formatCurrency(
    amount: number, 
    currency: string, 
    language: Language,
    options: {
      showCurrencyCode?: boolean;
      minimumFractionDigits?: number;
      maximumFractionDigits?: number;
    } = {}
  ): string {
    try {
      const formatOptions: Intl.NumberFormatOptions = {
        style: 'currency',
        currency: currency.toUpperCase(),
        currencyDisplay: options.showCurrencyCode ? 'code' : 'symbol',
        minimumFractionDigits: options.minimumFractionDigits ?? 2,
        maximumFractionDigits: options.maximumFractionDigits ?? 2
      };

      return new Intl.NumberFormat(language.locale, formatOptions).format(amount);
    } catch (error) {
      const symbol = this.getCurrencySymbol(currency);
      const formattedAmount = amount.toFixed(2);
      
      return language.formatting.numberFormat.currencyPosition === 'before'
        ? `${symbol}${formattedAmount}`
        : `${formattedAmount} ${symbol}`;
    }
  }

  /**
   * Get currency symbol for a currency code
   */
  private getCurrencySymbol(currency: string): string {
    const symbols: Record<string, string> = {
      USD: '$', EUR: '€', GBP: '£', JPY: '¥', 
      AUD: 'A$', CAD: 'C$', INR: '₹', CNY: '¥'
    };
    return symbols[currency.toUpperCase()] || currency;
  }

  /**
   * Cache management
   */
  private getCachedData(key: string): unknown {
    const cached = this.cache.get(key);
    if (cached && Date.now() - cached.timestamp < this.cacheTTL) {
      return cached.data;
    }
    return null;
  }

  private setCachedData(key: string, data: unknown, ttl?: number): void {
    this.cache.set(key, {
      data,
      timestamp: Date.now(),
      ttl: ttl || this.cacheTTL
    });
  }

  private clearCache(): void {
    this.cache.clear();
  }

  private clearNamespaceCache(namespace: string): void {
    const keysToDelete = Array.from(this.cache.keys()).filter(key => 
      key.includes(`translations_${namespace}`) || key === 'translation_namespaces'
    );
    keysToDelete.forEach(key => this.cache.delete(key));
  }

  /**
   * Get browser language preferences
   */
  getBrowserLanguages(): string[] {
    if (typeof window === 'undefined') return ['en'];
    
    const languages: string[] = [];
    
    if (navigator.languages) {
      languages.push(...navigator.languages);
    } else if (navigator.language) {
      languages.push(navigator.language);
    }
    
    // Convert to language codes (en-US -> en)
    return languages
      .map(lang => lang.split('-')[0].toUpperCase())
      .filter((lang, index, arr) => arr.indexOf(lang) === index);
  }

  /**
   * Save user language preferences
   */
  saveLanguagePreferences(preferences: LanguagePreferences): void {
    if (typeof window === 'undefined') return;
    
    try {
      localStorage.setItem('language_preferences', JSON.stringify(preferences));
    } catch {
      // Error handled silently
    }
  }

  /**
   * Load user language preferences
   */
  loadLanguagePreferences(): LanguagePreferences | null {
    if (typeof window === 'undefined') return null;
    
    try {
      const saved = localStorage.getItem('language_preferences');
      return saved ? JSON.parse(saved) : null;
    } catch (error) {
      return null;
    }
  }

  /**
   * Clear all caches and preferences
   */
  reset(): void {
    this.clearCache();
    if (typeof window !== 'undefined') {
      try {
        localStorage.removeItem('language_preferences');
      } catch {
        // Error handled silently
      }
    }
  }
}

// Create and export singleton instance
export const languageService = new LanguageService();
export default languageService;