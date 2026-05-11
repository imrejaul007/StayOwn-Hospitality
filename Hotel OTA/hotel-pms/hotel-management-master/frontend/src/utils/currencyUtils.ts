/**
 * Currency formatting utilities
 */

// Service variations for guest requests
export const SERVICE_VARIATIONS = {
  housekeeping: [
    'Extra towels',
    'Extra pillows',
    'Extra blankets',
    'Room cleaning',
    'Turndown service',
    'Laundry service',
    'Iron and ironing board'
  ],
  maintenance: [
    'Air conditioning repair',
    'Plumbing issue',
    'Electrical problem',
    'TV/Cable issue',
    'WiFi connectivity',
    'Light bulb replacement',
    'Lock repair'
  ],
  room_service: [
    'Breakfast',
    'Lunch',
    'Dinner',
    'Snacks',
    'Beverages',
    'Late night dining',
    'Special dietary requirements'
  ],
  transport: [
    'Airport pickup',
    'Airport drop-off',
    'City tour',
    'Car rental',
    'Taxi service',
    'Local attractions',
    'Shopping assistance'
  ],
  spa: [
    'Full body massage',
    'Facial treatment',
    'Aromatherapy',
    'Manicure & Pedicure',
    'Steam & Sauna',
    'Couples massage',
    'Body scrub'
  ],
  laundry: [
    'Regular wash',
    'Dry cleaning',
    'Express service',
    'Ironing only',
    'Stain removal',
    'Delicate garments',
    'Bulk laundry'
  ],
  other: [
    'Wake-up call',
    'Extra key card',
    'Baby crib',
    'Wheelchair request',
    'Late checkout request',
    'Early check-in request',
    'Special occasion arrangement'
  ],
  concierge: [
    'Restaurant reservations',
    'Event tickets',
    'Local recommendations',
    'Travel arrangements',
    'Business services',
    'Shopping assistance',
    'Emergency assistance'
  ]
} as const;

interface CurrencyOptions {
  currency?: string;
  locale?: string;
  minimumFractionDigits?: number;
  maximumFractionDigits?: number;
}

const DEFAULT_CURRENCY = 'INR';
const DEFAULT_LOCALE = 'en-IN';

/**
 * Format number as currency
 */
export const formatCurrency = (
  amount: number | string,
  options: CurrencyOptions = {}
): string => {
  const {
    currency = DEFAULT_CURRENCY,
    locale = DEFAULT_LOCALE,
    minimumFractionDigits = 2,
    maximumFractionDigits = 2,
  } = options;

  const numAmount = typeof amount === 'string' ? parseFloat(amount) : amount;
  
  if (isNaN(numAmount)) {
    return `${getCurrencySymbol(currency)} 0.00`;
  }

  try {
    return new Intl.NumberFormat(locale, {
      style: 'currency',
      currency,
      minimumFractionDigits,
      maximumFractionDigits,
    }).format(numAmount);
  } catch (error) {
    // Fallback if locale/currency not supported
    return `${getCurrencySymbol(currency)} ${numAmount.toLocaleString(undefined, {
      minimumFractionDigits,
      maximumFractionDigits,
    })}`;
  }
};

/**
 * Get currency symbol for a currency code
 */
export const getCurrencySymbol = (currency: string = DEFAULT_CURRENCY): string => {
  const symbols: { [key: string]: string } = {
    INR: '₹',
    USD: '$',
    EUR: '€',
    GBP: '£',
    JPY: '¥',
    AUD: 'A$',
    CAD: 'C$',
    CHF: 'CHF',
    CNY: '¥',
    SEK: 'kr',
    NZD: 'NZ$',
    MXN: '$',
    SGD: 'S$',
    HKD: 'HK$',
    NOK: 'kr',
    TRY: '₺',
    ZAR: 'R',
    BRL: 'R$',
    KRW: '₩',
    RUB: '₽',
    AED: 'د.إ',
    SAR: '﷼',
    QAR: '﷼',
    KWD: 'د.ك',
    BHD: '.د.ب',
    OMR: '﷼',
    JOD: 'د.أ',
    LBP: '£',
    EGP: '£'
  };

  return symbols[currency.toUpperCase()] || currency;
};

/**
 * Parse currency string to number
 */
export const parseCurrency = (currencyString: string): number => {
  if (typeof currencyString === 'number') {
    return currencyString;
  }
  
  // Remove currency symbols, spaces, and commas
  const cleaned = currencyString
    .replace(/[₹$€£¥₺R₩₽]/g, '') // Remove common currency symbols
    .replace(/[A-Za-z]/g, '') // Remove letters
    .replace(/\s/g, '') // Remove spaces
    .replace(/,/g, ''); // Remove commas

  const parsed = parseFloat(cleaned);
  return isNaN(parsed) ? 0 : parsed;
};

/**
 * Format percentage
 */
export const formatPercentage = (
  value: number,
  decimals: number = 1
): string => {
  if (isNaN(value)) {
    return '0.0%';
  }
  
  return `${value.toFixed(decimals)}%`;
};

/**
 * Format compact currency (K, M, B suffixes)
 */
export const formatCompactCurrency = (
  amount: number | string,
  currency: string = DEFAULT_CURRENCY
): string => {
  const numAmount = typeof amount === 'string' ? parseFloat(amount) : amount;
  
  if (isNaN(numAmount)) {
    return `${getCurrencySymbol(currency)} 0`;
  }

  const absAmount = Math.abs(numAmount);
  const isNegative = numAmount < 0;
  const symbol = getCurrencySymbol(currency);
  
  let formattedAmount: string;
  
  if (absAmount >= 1000000000) { // Billion
    formattedAmount = `${symbol} ${(absAmount / 1000000000).toFixed(1)}B`;
  } else if (absAmount >= 1000000) { // Million
    formattedAmount = `${symbol} ${(absAmount / 1000000).toFixed(1)}M`;
  } else if (absAmount >= 1000) { // Thousand
    formattedAmount = `${symbol} ${(absAmount / 1000).toFixed(1)}K`;
  } else {
    formattedAmount = `${symbol} ${absAmount.toFixed(2)}`;
  }
  
  return isNegative ? `-${formattedAmount}` : formattedAmount;
};

export default {
  formatCurrency,
  getCurrencySymbol,
  parseCurrency,
  formatPercentage,
  formatCompactCurrency
};