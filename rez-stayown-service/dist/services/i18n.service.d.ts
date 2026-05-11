/**
 * Internationalization Service
 * Supports: English, Hindi, Tamil, Telugu, Bengali, Marathi
 */
import i18n from 'i18next';
export interface SupportedLanguage {
    code: string;
    name: string;
    nativeName: string;
}
export declare const SUPPORTED_LANGUAGES: SupportedLanguage[];
export declare const DEFAULT_LANGUAGE = "en";
export declare const isValidLanguageCode: (code: string) => boolean;
export declare const i18nService: {
    changeLanguage: (lang: string) => any;
    getCurrentLanguage: () => string;
    getSupportedLanguages: () => SupportedLanguage[];
    t: (key: string, options?: Record<string, unknown>) => string;
    isInitialized: () => boolean;
};
export default i18n;
//# sourceMappingURL=i18n.service.d.ts.map