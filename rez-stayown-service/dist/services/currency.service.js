"use strict";
/**
 * Multi-Currency Service
 */
Object.defineProperty(exports, "__esModule", { value: true });
exports.currencyService = void 0;
const EXCHANGE_RATES = {
    'INR': { rate: 1, symbol: '₹', name: 'Indian Rupee' },
    'USD': { rate: 0.012, symbol: '$', name: 'US Dollar' },
    'EUR': { rate: 0.011, symbol: '€', name: 'Euro' },
    'GBP': { rate: 0.0095, symbol: '£', name: 'British Pound' },
    'SGD': { rate: 0.016, symbol: 'S$', name: 'Singapore Dollar' },
    'AED': { rate: 0.044, symbol: 'د.إ', name: 'UAE Dirham' },
};
class CurrencyService {
    /**
     * Convert price from INR to target currency
     */
    convertFromINR(amountPaise, targetCurrency) {
        const target = EXCHANGE_RATES[targetCurrency];
        if (!target) {
            return { amount: amountPaise, currency: 'INR', converted: { amount: amountPaise, currency: 'INR', symbol: '₹' } };
        }
        const amount = amountPaise / 100; // Convert from paise
        const converted = amount * target.rate;
        return {
            amount: amountPaise,
            currency: 'INR',
            converted: {
                amount: Math.round(converted * 100) / 100,
                currency: targetCurrency,
                symbol: target.symbol
            }
        };
    }
    /**
     * Get supported currencies
     */
    getSupportedCurrencies() {
        return Object.entries(EXCHANGE_RATES).map(([code, data]) => ({
            code,
            ...data
        }));
    }
    /**
     * Format price for display
     */
    format(amount, currency) {
        const info = EXCHANGE_RATES[currency];
        if (!info)
            return `₹${amount}`;
        return `${info.symbol}${amount.toLocaleString()}`;
    }
}
exports.currencyService = new CurrencyService();
//# sourceMappingURL=currency.service.js.map