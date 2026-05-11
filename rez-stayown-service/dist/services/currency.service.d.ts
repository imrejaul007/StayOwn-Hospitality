/**
 * Multi-Currency Service
 */
interface PriceConversion {
    amount: number;
    currency: string;
    converted: {
        amount: number;
        currency: string;
        symbol: string;
    };
}
declare class CurrencyService {
    /**
     * Convert price from INR to target currency
     */
    convertFromINR(amountPaise: number, targetCurrency: string): PriceConversion;
    /**
     * Get supported currencies
     */
    getSupportedCurrencies(): ({
        rate: number;
        symbol: string;
        name: string;
        code: string;
    } | {
        rate: number;
        symbol: string;
        name: string;
        code: string;
    } | {
        rate: number;
        symbol: string;
        name: string;
        code: string;
    } | {
        rate: number;
        symbol: string;
        name: string;
        code: string;
    } | {
        rate: number;
        symbol: string;
        name: string;
        code: string;
    } | {
        rate: number;
        symbol: string;
        name: string;
        code: string;
    })[];
    /**
     * Format price for display
     */
    format(amount: number, currency: string): string;
}
export declare const currencyService: CurrencyService;
export {};
//# sourceMappingURL=currency.service.d.ts.map