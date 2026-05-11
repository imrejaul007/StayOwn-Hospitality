"use strict";
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
Object.defineProperty(exports, "__esModule", { value: true });
exports.languageDetector = languageDetector;
exports.getLanguage = getLanguage;
exports.validateLanguage = validateLanguage;
exports.requireLanguage = requireLanguage;
exports.translationHelper = translationHelper;
exports.getLanguageSettings = getLanguageSettings;
exports.getLanguagePreference = getLanguagePreference;
exports.switchLanguage = switchLanguage;
const i18n_service_1 = require("../services/i18n.service");
// Header name for language override
const LANG_HEADER = 'x-lang';
const ACCEPT_LANGUAGE_HEADER = 'accept-language';
// Language priority order (highest to lowest)
const LANGUAGE_PRIORITY = ['en', 'hi', 'ta', 'te', 'bn', 'mr'];
/**
 * Parse Accept-Language header and return preferred language
 */
function parseAcceptLanguage(header) {
    if (!header)
        return i18n_service_1.DEFAULT_LANGUAGE;
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
        if ((0, i18n_service_1.isValidLanguageCode)(code)) {
            return code;
        }
    }
    return i18n_service_1.DEFAULT_LANGUAGE;
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
function detectLanguage(req) {
    // 1. Check x-lang header (API clients)
    const headerLang = req.headers[LANG_HEADER];
    if (headerLang && (0, i18n_service_1.isValidLanguageCode)(headerLang)) {
        return headerLang;
    }
    // 2. Check query parameter (URL overrides)
    const queryLang = req.query.lang;
    if (queryLang && (0, i18n_service_1.isValidLanguageCode)(queryLang)) {
        return queryLang;
    }
    // 3. Check user's saved preference from JWT
    if (req.user && req.user.preferredLanguage) {
        const userLang = req.user.preferredLanguage;
        if ((0, i18n_service_1.isValidLanguageCode)(userLang)) {
            return userLang;
        }
    }
    // 4. Check Accept-Language header (browser)
    const acceptLanguage = req.headers[ACCEPT_LANGUAGE_HEADER];
    if (acceptLanguage) {
        return parseAcceptLanguage(acceptLanguage);
    }
    // 5. Default fallback
    return i18n_service_1.DEFAULT_LANGUAGE;
}
/**
 * Language detection middleware
 * Detects and sets the language for the request
 */
function languageDetector(req, res, next) {
    const detectedLang = detectLanguage(req);
    // Set i18n language
    i18n_service_1.i18nService.changeLanguage(detectedLang);
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
function getLanguage(req) {
    return req.language || i18n_service_1.DEFAULT_LANGUAGE;
}
/**
 * Language validation middleware
 * Validates that the requested language is supported
 */
function validateLanguage(req, res, next) {
    const lang = req.query.lang || req.headers[LANG_HEADER];
    if (lang && !(0, i18n_service_1.isValidLanguageCode)(lang)) {
        res.status(400).json({
            success: false,
            error: 'Unsupported language',
            message: `Language '${lang}' is not supported`,
            supportedLanguages: i18n_service_1.SUPPORTED_LANGUAGES.map(l => ({
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
function requireLanguage(languageCode) {
    return (req, res, next) => {
        if (!(0, i18n_service_1.isValidLanguageCode)(languageCode)) {
            res.status(500).json({
                success: false,
                error: 'Invalid language configuration'
            });
            return;
        }
        i18n_service_1.i18nService.changeLanguage(languageCode);
        req.language = languageCode;
        next();
    };
}
/**
 * Get translation helper middleware
 * Adds a translate function to the request
 */
function translationHelper(req, _res, next) {
    const lang = req.language || i18n_service_1.DEFAULT_LANGUAGE;
    req.t = (key, options) => {
        // Temporarily change language if different from current
        const currentLang = i18n_service_1.i18nService.getCurrentLanguage();
        if (currentLang !== lang) {
            i18n_service_1.i18nService.changeLanguage(lang);
        }
        return i18n_service_1.i18nService.t(key, options);
    };
    next();
}
/**
 * CORS-friendly language settings helper
 * Returns language settings for frontend
 */
function getLanguageSettings() {
    return {
        defaultLanguage: i18n_service_1.DEFAULT_LANGUAGE,
        supportedLanguages: i18n_service_1.SUPPORTED_LANGUAGES,
        fallbackLanguage: i18n_service_1.DEFAULT_LANGUAGE,
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
function getLanguagePreference(req) {
    // Check various sources in priority order
    const lang = req.headers[LANG_HEADER] ||
        req.query.lang ||
        req.language ||
        i18n_service_1.DEFAULT_LANGUAGE;
    return (0, i18n_service_1.isValidLanguageCode)(lang) ? lang : i18n_service_1.DEFAULT_LANGUAGE;
}
/**
 * Language switcher endpoint handler
 * Can be used to change language and return appropriate response
 */
function switchLanguage(req, res) {
    const newLang = req.query.lang;
    if (!newLang) {
        res.status(400).json({
            success: false,
            error: 'Missing language parameter',
            usage: 'GET /language?lang=en'
        });
        return;
    }
    if (!(0, i18n_service_1.isValidLanguageCode)(newLang)) {
        res.status(400).json({
            success: false,
            error: 'Unsupported language',
            supportedLanguages: i18n_service_1.SUPPORTED_LANGUAGES.map(l => l.code)
        });
        return;
    }
    // Change language
    i18n_service_1.i18nService.changeLanguage(newLang);
    req.language = newLang;
    res.json({
        success: true,
        language: newLang,
        languageName: i18n_service_1.SUPPORTED_LANGUAGES.find(l => l.code === newLang)?.nativeName,
        message: i18n_service_1.i18nService.t('messages.thankYou', { lng: newLang })
    });
}
//# sourceMappingURL=languageDetector.js.map