import { api } from './api';

interface DetectionResult {
  language: string;
  confidence: number;
  source: 'browser' | 'location' | 'text' | 'user' | 'default';
}

interface GeolocationLanguageMap {
  [countryCode: string]: string[];
}

class LanguageDetectionService {
  private readonly DETECTION_CACHE_KEY = 'language_detection_cache';
  private readonly DETECTION_CACHE_TTL = 24 * 60 * 60 * 1000; // 24 hours
  
  // Map of country codes to preferred languages
  private readonly geolocationLanguageMap: GeolocationLanguageMap = {
    'US': ['EN', 'ES'],
    'CA': ['EN', 'FR'],
    'MX': ['ES', 'EN'],
    'GB': ['EN'],
    'FR': ['FR', 'EN'],
    'DE': ['DE', 'EN'],
    'ES': ['ES', 'EN'],
    'IT': ['IT', 'EN'],
    'PT': ['PT', 'EN'],
    'BR': ['PT', 'EN'],
    'RU': ['RU', 'EN'],
    'CN': ['ZH', 'EN'],
    'JP': ['JA', 'EN'],
    'KR': ['KO', 'EN'],
    'IN': ['HI', 'EN'],
    'AR': ['AR', 'EN'],
    'TR': ['TR', 'EN'],
    'NL': ['NL', 'EN'],
    'SE': ['SV', 'EN'],
    'NO': ['NO', 'EN'],
    'DK': ['DA', 'EN'],
    'FI': ['FI', 'EN'],
    'PL': ['PL', 'EN'],
    'CZ': ['CS', 'EN'],
    'HU': ['HU', 'EN'],
    'RO': ['RO', 'EN'],
    'BG': ['BG', 'EN'],
    'HR': ['HR', 'EN'],
    'SK': ['SK', 'EN'],
    'SI': ['SL', 'EN'],
    'EE': ['ET', 'EN'],
    'LV': ['LV', 'EN'],
    'LT': ['LT', 'EN'],
    'GR': ['EL', 'EN'],
    'IL': ['HE', 'EN'],
    'TH': ['TH', 'EN'],
    'VN': ['VI', 'EN'],
    'ID': ['ID', 'EN'],
    'MY': ['MS', 'EN'],
    'PH': ['TL', 'EN'],
    'SG': ['EN', 'ZH'],
    'AU': ['EN'],
    'NZ': ['EN'],
    'ZA': ['EN', 'AF']
  };

  private readonly fallbackLanguages = ['EN', 'ES', 'FR', 'DE', 'ZH'];
  
  /**
   * Detect user's preferred language using multiple methods
   */
  async detectPreferredLanguage(): Promise<DetectionResult> {
    try {
      // Check cache first
      const cached = this.getCachedDetection();
      if (cached) {
        return cached;
      }

      // Try multiple detection methods
      const detectionMethods = [
        this.detectFromUserPreference.bind(this),
        this.detectFromBrowser.bind(this),
        this.detectFromGeolocation.bind(this),
        this.detectFromPreviousSession.bind(this)
      ];

      for (const method of detectionMethods) {
        try {
          const result = await method();
          if (result && result.confidence > 0.6) {
            this.cacheDetectionResult(result);
            return result;
          }
        } catch {
          // Error handled silently
        }
      }

      // Fallback to default
      const defaultResult: DetectionResult = {
        language: 'EN',
        confidence: 0.5,
        source: 'default'
      };

      this.cacheDetectionResult(defaultResult);
      return defaultResult;
    } catch (error) {
      return {
        language: 'EN',
        confidence: 0.1,
        source: 'default'
      };
    }
  }

  /**
   * Detect language from user's explicit preference
   */
  private async detectFromUserPreference(): Promise<DetectionResult | null> {
    try {
      const userLang = localStorage.getItem('user_preferred_language');
      if (userLang) {
        return {
          language: userLang.toUpperCase(),
          confidence: 0.95,
          source: 'user'
        };
      }
    } catch {
      // Error handled silently
    }
    return null;
  }

  /**
   * Detect language from browser settings
   */
  private async detectFromBrowser(): Promise<DetectionResult | null> {
    try {
      const browserLang = navigator.language || navigator.languages?.[0];
      if (browserLang) {
        const langCode = this.normalizeLangCode(browserLang);
        if (langCode) {
          return {
            language: langCode,
            confidence: 0.8,
            source: 'browser'
          };
        }
      }
    } catch {
      // Error handled silently
    }
    return null;
  }

  /**
   * Detect language from geolocation
   */
  private async detectFromGeolocation(): Promise<DetectionResult | null> {
    try {
      if (!navigator.geolocation) {
        return null;
      }

      const position = await new Promise<GeolocationPosition>((resolve, reject) => {
        navigator.geolocation.getCurrentPosition(resolve, reject, {
          timeout: 5000,
          enableHighAccuracy: false
        });
      });

      // Get country from coordinates using a reverse geocoding service
      const countryCode = await this.getCountryFromCoordinates(
        position.coords.latitude,
        position.coords.longitude
      );

      if (countryCode && this.geolocationLanguageMap[countryCode]) {
        const preferredLang = this.geolocationLanguageMap[countryCode][0];
        return {
          language: preferredLang,
          confidence: 0.7,
          source: 'location'
        };
      }
    } catch {
      // Error handled silently
    }
    return null;
  }

  /**
   * Detect language from previous session
   */
  private async detectFromPreviousSession(): Promise<DetectionResult | null> {
    try {
      const sessionLang = sessionStorage.getItem('session_language') || 
                          localStorage.getItem('last_detected_language');
      if (sessionLang) {
        return {
          language: sessionLang.toUpperCase(),
          confidence: 0.6,
          source: 'user'
        };
      }
    } catch {
      // Error handled silently
    }
    return null;
  }

  /**
   * Detect language of given text using backend service
   */
  async detectTextLanguage(text: string): Promise<DetectionResult | null> {
    try {
      if (!text || text.trim().length < 10) {
        return null;
      }

      try {
        const response = await api.post('/languages/detect', { text });
        const { language, confidence } = response.data.data;

        return {
          language: language?.toUpperCase(),
          confidence: confidence || 0.5,
          source: 'text'
        };
      } catch (error) {
        return null;
      }
    } catch (error: unknown) {
      throw error instanceof Error ? error : new Error('Request failed');
    }
  }

  /**
   * Get available languages for translation
   */
  async getSupportedLanguages(): Promise<string[]> {
    try {
      const response = await api.get('/languages/translation/supported');
      return response.data.data.map((lang: Record<string, unknown>) => lang.code?.toUpperCase()).filter(Boolean);
    } catch (error) {
      return this.fallbackLanguages;
    }
  }

  /**
   * Check if language is supported for translation
   */
  async isLanguageSupported(languageCode: string): Promise<boolean> {
    try {
      const supported = await this.getSupportedLanguages();
      return supported.includes(languageCode.toUpperCase());
    } catch (error) {
      return this.fallbackLanguages.includes(languageCode.toUpperCase());
    }
  }

  /**
   * Get the best fallback language for unsupported language
   */
  getBestFallbackLanguage(unsupportedLang: string): string {
    // Language family mappings for better fallbacks
    const languageFamilies: { [key: string]: string[] } = {
      'ES': ['PT', 'IT', 'FR'], // Romance languages
      'PT': ['ES', 'IT', 'FR'],
      'IT': ['ES', 'PT', 'FR'],
      'FR': ['ES', 'IT', 'PT'],
      'DE': ['NL', 'EN'], // Germanic languages
      'NL': ['DE', 'EN'],
      'ZH': ['JA', 'KO'], // East Asian languages
      'JA': ['ZH', 'KO'],
      'KO': ['ZH', 'JA'],
      'AR': ['HE', 'TR'], // Semitic/Middle Eastern languages
      'HE': ['AR', 'TR'],
      'HI': ['UR', 'BN'], // Indo-Aryan languages
      'RU': ['UK', 'PL'], // Slavic languages
      'PL': ['RU', 'CS'],
      'CS': ['SK', 'PL']
    };

    const upperLang = unsupportedLang.toUpperCase();
    
    if (languageFamilies[upperLang]) {
      for (const fallback of languageFamilies[upperLang]) {
        if (this.fallbackLanguages.includes(fallback)) {
          return fallback;
        }
      }
    }

    return 'EN'; // Default fallback
  }

  /**
   * Save user's language preference
   */
  setUserLanguagePreference(languageCode: string): void {
    try {
      const normalizedCode = languageCode.toUpperCase();
      localStorage.setItem('user_preferred_language', normalizedCode);
      sessionStorage.setItem('session_language', normalizedCode);
      localStorage.setItem('last_detected_language', normalizedCode);
    } catch {
      // Error handled silently
    }
  }

  /**
   * Clear language detection cache
   */
  clearDetectionCache(): void {
    try {
      localStorage.removeItem(this.DETECTION_CACHE_KEY);
    } catch {
      // Error handled silently
    }
  }

  // Private helper methods

  private getCachedDetection(): DetectionResult | null {
    try {
      const cached = localStorage.getItem(this.DETECTION_CACHE_KEY);
      if (!cached) return null;

      const { result, timestamp } = JSON.parse(cached);
      if (Date.now() - timestamp > this.DETECTION_CACHE_TTL) {
        localStorage.removeItem(this.DETECTION_CACHE_KEY);
        return null;
      }

      return result;
    } catch (error) {
      return null;
    }
  }

  private cacheDetectionResult(result: DetectionResult): void {
    try {
      const cacheData = {
        result,
        timestamp: Date.now()
      };
      localStorage.setItem(this.DETECTION_CACHE_KEY, JSON.stringify(cacheData));
    } catch {
      // Error handled silently
    }
  }

  private normalizeLangCode(browserLang: string): string | null {
    try {
      // Extract language code (e.g., "en-US" -> "EN")
      const langCode = browserLang.split('-')[0].toUpperCase();
      
      // Map some common variations
      const langMappings: { [key: string]: string } = {
        'EN': 'EN',
        'ES': 'ES',
        'FR': 'FR',
        'DE': 'DE',
        'IT': 'IT',
        'PT': 'PT',
        'RU': 'RU',
        'ZH': 'ZH',
        'JA': 'JA',
        'KO': 'KO',
        'AR': 'AR',
        'HI': 'HI',
        'NL': 'NL',
        'SV': 'SV',
        'DA': 'DA',
        'NO': 'NO',
        'FI': 'FI',
        'PL': 'PL',
        'TR': 'TR',
        'HE': 'HE',
        'TH': 'TH',
        'VI': 'VI',
        'ID': 'ID'
      };

      return langMappings[langCode] || null;
    } catch (error) {
      return null;
    }
  }

  private async getCountryFromCoordinates(lat: number, lng: number): Promise<string | null> {
    try {
      // Using a simple reverse geocoding approach
      // In production, you'd use a proper geocoding service
      const response = await fetch(
        `https://api.bigdatacloud.net/data/reverse-geocode-client?latitude=${lat}&longitude=${lng}&localityLanguage=en`
      );
      
      if (!response.ok) {
        throw new Error('Geocoding service unavailable');
      }

      const data = await response.json();
      return data.countryCode?.toUpperCase() || null;
    } catch (error) {
      return null;
    }
  }
}

export default new LanguageDetectionService();