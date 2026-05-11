/**
 * Language Detection Middleware for StayOwn Service
 *
 * Handles:
 * - Language detection from Accept-Language header
 * - Language override via query param (lang)
 * - Language override via header (x-lang)
 * - Persisting language preference (user-based)
 * - Setting response headers for client awareness
 */

import { Request, Response, NextFunction } from 'express';
import {
  i18nService,
  SUPPORTED_LANGUAGES,
  DEFAULT_LANGUAGE,
  isValidLanguageCode
} from '../services/i18n.service';

// Extend Express Request type
declare global {
  namespace Express {
    interface Request {
      language?: string;
      detectedLanguage?: string;
    }
  }
}

// Header name for language override
const LANG_HEADER = 'x-lang';
const ACCEPT_LANGUAGE_HEADER = 'accept-language';

// Language priority order (highest to lowest)
const LANGUAGE_PRIORITY = ['en', 'hi', 'ta', 'te', 'bn', 'mr'];

/**
 * Parse Accept-Language header and return preferred language
 */
function parseAcceptLanguage(header: string): string {
  if (!header) return DEFAULT_LANGUAGE;

  // Parse Accept-Language header
  // Format: "en-US,en;q=0.9,hi;q=0.8"
  const languages = header
    .split(',')
    .map(part => {
      const [lang, quality] = part.trim().split(';q=');
      return {
        code: lang.split('-')[0].toLowerCase(), // Get base language code
        quality: quality ? parseFloat(quality) : 1.0
      };
    })
    .sort((a, b) => b.quality - a.quality);

  // Find first supported language
  for (const { code } of languages) {
    if (isValidLanguageCode(code)) {
      return code;
    }
  }

  return DEFAULT_LANGUAGE;
}

/**
 * Detect language from various sources
 * Priority order:
 * 1. x-lang header (highest priority)
 * 2. lang query parameter
 * 3. User's saved preference (from JWT or session)
 * 4. Accept-Language header
 * 5. Default language
 */
function detectLanguage(req: Request): string {
  // 1. Check x-lang header (API clients)
  const headerLang = req.headers[LANG_HEADER] as string;
  if (headerLang && isValidLanguageCode(headerLang)) {
    return headerLang;
  }

  // 2. Check query parameter (URL overrides)
  const queryLang = req.query.lang as string;
  if (queryLang && isValidLanguageCode(queryLang)) {
    return queryLang;
  }

  // 3. Check user's saved preference from JWT
  if (req.user && (req.user as Record<string, unknown>).preferredLanguage) {
    const userLang = (req.user as Record<string, unknown>).preferredLanguage as string;
    if (isValidLanguageCode(userLang)) {
      return userLang;
    }
  }

  // 4. Check Accept-Language header (browser)
  const acceptLanguage = req.headers[ACCEPT_LANGUAGE_HEADER] as string;
  if (acceptLanguage) {
    return parseAcceptLanguage(acceptLanguage);
  }

  // 5. Default fallback
  return DEFAULT_LANGUAGE;
}

/**
 * Language detection middleware
 * Detects and sets the language for the request
 */
export function languageDetector(req: Request, res: Response, next: NextFunction): void {
  const detectedLang = detectLanguage(req);

  // Set i18n language
  i18nService.changeLanguage(detectedLang);

  // Attach to request for use in route handlers
  req.language = detectedLang;
  req.detectedLanguage = detectedLang;

  // Set response header for client awareness
  res.setHeader('Content-Language', detectedLang);
  res.setHeader('X-Detected-Language', detectedLang);

  next();
}

/**
 * Get language from request (safe getter)
 */
export function getLanguage(req: Request): string {
  return req.language || DEFAULT_LANGUAGE;
}

/**
 * Language validation middleware
 * Validates that the requested language is supported
 */
export function validateLanguage(req: Request, res: Response, next: NextFunction): void {
  const lang = req.query.lang as string || req.headers[LANG_HEADER] as string;

  if (lang && !isValidLanguageCode(lang)) {
    res.status(400).json({
      success: false,
      error: 'Unsupported language',
      message: `Language '${lang}' is not supported`,
      supportedLanguages: SUPPORTED_LANGUAGES.map(l => ({
        code: l.code,
        name: l.nativeName
      }))
    });
    return;
  }

  next();
}

/**
 * Require specific language middleware
 * Forces a specific language for certain routes
 */
export function requireLanguage(languageCode: string) {
  return (req: Request, res: Response, next: NextFunction): void => {
    if (!isValidLanguageCode(languageCode)) {
      res.status(500).json({
        success: false,
        error: 'Invalid language configuration'
      });
      return;
    }

    i18nService.changeLanguage(languageCode);
    req.language = languageCode;

    next();
  };
}

/**
 * Get translation helper middleware
 * Adds a translate function to the request
 */
export function translationHelper(req: Request, _res: Response, next: NextFunction): void {
  const lang = req.language || DEFAULT_LANGUAGE;

  (req as Request & { t: (key: string, options?: Record<string, unknown>) => string }).t = (
    key: string,
    options?: Record<string, unknown>
  ) => {
    // Temporarily change language if different from current
    const currentLang = i18nService.getCurrentLanguage();
    if (currentLang !== lang) {
      i18nService.changeLanguage(lang);
    }
    return i18nService.t(key, options);
  };

  next();
}

/**
 * CORS-friendly language settings helper
 * Returns language settings for frontend
 */
export function getLanguageSettings() {
  return {
    defaultLanguage: DEFAULT_LANGUAGE,
    supportedLanguages: SUPPORTED_LANGUAGES,
    fallbackLanguage: DEFAULT_LANGUAGE,
    detectionOrder: [
      'x-lang header',
      'lang query parameter',
      'user preference',
      'Accept-Language header',
      'default (English)'
    ]
  };
}

/**
 * Save language preference (for user profile updates)
 * Returns the language code to be saved
 */
export function getLanguagePreference(req: Request): string {
  // Check various sources in priority order
  const lang =
    (req.headers[LANG_HEADER] as string) ||
    (req.query.lang as string) ||
    req.language ||
    DEFAULT_LANGUAGE;

  return isValidLanguageCode(lang) ? lang : DEFAULT_LANGUAGE;
}

/**
 * Language switcher endpoint handler
 * Can be used to change language and return appropriate response
 */
export function switchLanguage(req: Request, res: Response): void {
  const newLang = req.query.lang as string;

  if (!newLang) {
    res.status(400).json({
      success: false,
      error: 'Missing language parameter',
      usage: 'GET /language?lang=en'
    });
    return;
  }

  if (!isValidLanguageCode(newLang)) {
    res.status(400).json({
      success: false,
      error: 'Unsupported language',
      supportedLanguages: SUPPORTED_LANGUAGES.map(l => l.code)
    });
    return;
  }

  // Change language
  i18nService.changeLanguage(newLang);
  req.language = newLang;

  res.json({
    success: true,
    language: newLang,
    languageName: SUPPORTED_LANGUAGES.find(l => l.code === newLang)?.nativeName,
    message: i18nService.t('messages.thankYou', { lng: newLang })
  });
}
