import logger from './utils/logger';

/**
 * Internationalization Service
 * Supports: English, Hindi, Tamil, Telugu, Bengali, Marathi
 */

import i18n from 'i18next';
import { initReactI18next } from 'react-i18next';

// English translations
const en = {
  translation: {
    booking: {
      search: 'Search Hotels',
      book: 'Book Now',
      checkin: 'Check-in',
      checkout: 'Check-out',
      guests: 'Guests',
      room: 'Room',
      rooms: 'Rooms',
      nights: 'nights',
    },
    services: {
      order: 'Order Food',
      housekeeping: 'Housekeeping',
      laundry: 'Laundry',
      spa: 'Spa & Wellness',
      transport: 'Transport',
      checkout: 'Request Checkout',
    },
    status: {
      pending: 'Pending',
      confirmed: 'Confirmed',
      inProgress: 'In Progress',
      completed: 'Completed',
    },
    messages: {
      welcome: 'Welcome',
      hello: 'Hello',
      thankYou: 'Thank you',
    }
  }
};

// Hindi translations
const hi = {
  translation: {
    booking: {
      search: 'होटल खोजें',
      book: 'अभी बुक करें',
      checkin: 'चेक-इन',
      checkout: 'चेक-आउट',
      guests: 'मेहमान',
      room: 'कमरा',
      rooms: 'कमरे',
      nights: 'रातें',
    },
    services: {
      order: 'खाना ऑर्डर करें',
      housekeeping: 'हाउसकीपिंग',
      laundry: 'लॉन्ड्री',
      spa: 'स्पा और वेलनेस',
      transport: 'परिवहन',
      checkout: 'चेकआउट का अनुरोध',
    },
    status: {
      pending: 'लंबित',
      confirmed: 'पुष्टि',
      inProgress: 'प्रगति में',
      completed: 'पूर्ण',
    },
    messages: {
      welcome: 'स्वागत है',
      hello: 'नमस्ते',
      thankYou: 'धन्यवाद',
    }
  }
};

// Tamil translations
const ta = {
  translation: {
    booking: {
      search: 'ஹோட்டல்களைத் தேடு',
      book: 'இப்போது முன்பதிவு செய்',
      checkin: 'செக்-இன்',
      checkout: 'செக்-அவுட்',
      guests: 'விருந்தினர்',
      room: 'அறை',
      rooms: 'அறைகள்',
      nights: 'இரவுகள்',
    },
    services: {
      order: 'உணவு ஆணை',
      housekeeping: 'வீட்டு வேலை',
      laundry: 'துணி',
      spa: 'ஸ்பா',
      transport: 'போக்குவரத்து',
      checkout: 'செக் அவுட் கோரிக்கை',
    },
    status: {
      pending: 'நிலுவையில்',
      confirmed: 'உறுதி',
      inProgress: 'செயல்பாட்டில்',
      completed: 'முடிந்த',
    },
    messages: {
      welcome: 'வரவேற்பு',
      hello: 'வணக்கம்',
      thankYou: 'நன்றி',
    }
  }
};

// Telugu translations
const te = {
  translation: {
    booking: {
      search: 'హోటళ్ళను వెతుకు',
      book: 'ఇప్పుడే బుక్ చేయండి',
      checkin: 'చెక్-ఇన్',
      checkout: 'చెక్-అవుట్',
      guests: 'అతిథులు',
      room: 'అనురూపణ',
      rooms: 'అనురూపణలు',
      nights: 'రాత్రులు',
    },
    services: {
      order: 'ఆహారం ఆదేశం',
      housekeeping: 'హౌస్ కీపింగ్',
      laundry: 'ఉత్నలు',
      spa: 'స్పా & వెల్‌నెస్',
      transport: 'ప్రయాణ సౌకర్యం',
      checkout: 'చెక్ అవుట్ అభ్యర్థన',
    },
    status: {
      pending: 'అనారోపిత',
      confirmed: 'నిర్ధారించబడింది',
      inProgress: 'పురోగతిలో',
      completed: 'పూర్తయింది',
    },
    messages: {
      welcome: 'స్వాగతం',
      hello: 'నమస్తే',
      thankYou: 'ధన్యవాదాలు',
    }
  }
};

// Bengali translations
const bn = {
  translation: {
    booking: {
      search: 'হোটেল খুঁজুন',
      book: 'এখনই বুক করুন',
      checkin: 'চেক-ইন',
      checkout: 'চেক-আউট',
      guests: 'অতিথি',
      room: 'রুম',
      rooms: 'রুমগুলি',
      nights: 'রাত',
    },
    services: {
      order: 'খাবার অর্ডার',
      housekeeping: 'হাউসকিপিং',
      laundry: 'লন্ড্রি',
      spa: 'স্পা ও ওয়েলনেস',
      transport: 'পরিবহন',
      checkout: 'চেকআউট অনুরোধ',
    },
    status: {
      pending: 'বিচারাধীন',
      confirmed: 'নিশ্চিত',
      inProgress: 'চলমান',
      completed: 'সম্পন্ন',
    },
    messages: {
      welcome: 'স্বাগতম',
      hello: 'নমস্কার',
      thankYou: 'ধন্যবাদ',
    }
  }
};

// Marathi translations
const mr = {
  translation: {
    booking: {
      search: 'हॉटेल शोधा',
      book: 'आत्ताच बुक करा',
      checkin: 'चेक-इन',
      checkout: 'चेक-आउट',
      guests: 'पाहुणे',
      room: 'खोली',
      rooms: 'खोल्या',
      nights: 'रात्री',
    },
    services: {
      order: 'जेवण ऑर्डर',
      housekeeping: 'हाऊसकीपिंग',
      laundry: 'लॉन्ड्री',
      spa: 'स्पा आणि वेलनेस',
      transport: 'वाहतूक',
      checkout: 'चेकआउट विनंती',
    },
    status: {
      pending: 'प्रलंबित',
      confirmed: 'पुष्टी',
      inProgress: 'प्रगतीत',
      completed: 'पूर्ण',
    },
    messages: {
      welcome: 'स्वागत आहे',
      hello: 'नमस्कार',
      thankYou: 'धन्यवाद',
    }
  }
};

// Initialize i18next
i18n
  .use(initReactI18next)
  .init({
    resources: { en, hi, ta, te, bn, mr },
    lng: 'en',
    fallbackLng: 'en',
    interpolation: { escapeValue: false },
    react: {
      useSuspense: false
    }
  });

export interface SupportedLanguage {
  code: string;
  name: string;
  nativeName: string;
}

export const SUPPORTED_LANGUAGES: SupportedLanguage[] = [
  { code: 'en', name: 'English', nativeName: 'English' },
  { code: 'hi', name: 'Hindi', nativeName: 'हिन्दी' },
  { code: 'ta', name: 'Tamil', nativeName: 'தமிழ்' },
  { code: 'te', name: 'Telugu', nativeName: 'తెలుగు' },
  { code: 'bn', name: 'Bengali', nativeName: 'বাংলা' },
  { code: 'mr', name: 'Marathi', nativeName: 'मराठी' },
];

export const DEFAULT_LANGUAGE = 'en';

export const isValidLanguageCode = (code: string): boolean => {
  return SUPPORTED_LANGUAGES.some(lang => lang.code === code);
};

export const i18nService = {
  changeLanguage: (lang: string) => {
    if (!isValidLanguageCode(lang)) {
      logger.warn(`Invalid language code: ${lang}. Falling back to ${DEFAULT_LANGUAGE}`);
      return i18n.changeLanguage(DEFAULT_LANGUAGE);
    }
    return i18n.changeLanguage(lang);
  },
  getCurrentLanguage: (): string => i18n.language,
  getSupportedLanguages: (): SupportedLanguage[] => SUPPORTED_LANGUAGES,
  t: (key: string, options?: Record<string, unknown>): string => {
    return i18n.t(key, options);
  },
  isInitialized: (): boolean => i18n.isInitialized
};

export default i18n;
