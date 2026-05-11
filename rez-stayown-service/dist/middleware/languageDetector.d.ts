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
declare global {
    namespace Express {
        interface Request {
            language?: string;
            detectedLanguage?: string;
        }
    }
}
/**
 * Language detection middleware
 * Detects and sets the language for the request
 */
export declare function languageDetector(req: Request, res: Response, next: NextFunction): void;
/**
 * Get language from request (safe getter)
 */
export declare function getLanguage(req: Request): string;
/**
 * Language validation middleware
 * Validates that the requested language is supported
 */
export declare function validateLanguage(req: Request, res: Response, next: NextFunction): void;
/**
 * Require specific language middleware
 * Forces a specific language for certain routes
 */
export declare function requireLanguage(languageCode: string): (req: Request, res: Response, next: NextFunction) => void;
/**
 * Get translation helper middleware
 * Adds a translate function to the request
 */
export declare function translationHelper(req: Request, _res: Response, next: NextFunction): void;
/**
 * CORS-friendly language settings helper
 * Returns language settings for frontend
 */
export declare function getLanguageSettings(): {
    defaultLanguage: string;
    supportedLanguages: import("../services/i18n.service").SupportedLanguage[];
    fallbackLanguage: string;
    detectionOrder: string[];
};
/**
 * Save language preference (for user profile updates)
 * Returns the language code to be saved
 */
export declare function getLanguagePreference(req: Request): string;
/**
 * Language switcher endpoint handler
 * Can be used to change language and return appropriate response
 */
export declare function switchLanguage(req: Request, res: Response): void;
//# sourceMappingURL=languageDetector.d.ts.map