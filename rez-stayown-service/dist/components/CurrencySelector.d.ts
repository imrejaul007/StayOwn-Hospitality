/**
 * Currency Selector Component for StayOwn Booking UI
 *
 * Features:
 * - Dropdown to select preferred currency
 * - Display converted prices alongside original INR
 * - Persist currency preference in localStorage
 */
import React, { ReactNode } from 'react';
export declare const SUPPORTED_CURRENCIES: readonly [{
    readonly code: "INR";
    readonly rate: 1;
    readonly symbol: "₹";
    readonly name: "Indian Rupee";
    readonly flag: "🇮🇳";
}, {
    readonly code: "USD";
    readonly rate: 0.012;
    readonly symbol: "$";
    readonly name: "US Dollar";
    readonly flag: "🇺🇸";
}, {
    readonly code: "EUR";
    readonly rate: 0.011;
    readonly symbol: "€";
    readonly name: "Euro";
    readonly flag: "🇪🇺";
}, {
    readonly code: "GBP";
    readonly rate: 0.0095;
    readonly symbol: "£";
    readonly name: "British Pound";
    readonly flag: "🇬🇧";
}, {
    readonly code: "SGD";
    readonly rate: 0.016;
    readonly symbol: "S$";
    readonly name: "Singapore Dollar";
    readonly flag: "🇸🇬";
}, {
    readonly code: "AED";
    readonly rate: 0.044;
    readonly symbol: "د.إ";
    readonly name: "UAE Dirham";
    readonly flag: "🇦🇪";
}];
export type CurrencyCode = typeof SUPPORTED_CURRENCIES[number]['code'];
interface CurrencyContextType {
    currency: CurrencyCode;
    setCurrency: (currency: CurrencyCode) => void;
    convertFromINR: (amountPaise: number) => {
        amount: number;
        symbol: string;
        formatted: string;
    };
    format: (amount: number) => string;
    isLoading: boolean;
}
interface CurrencyProviderProps {
    children: ReactNode;
    defaultCurrency?: CurrencyCode;
}
export declare function CurrencyProvider({ children, defaultCurrency }: CurrencyProviderProps): React.JSX.Element;
export declare function useCurrency(): CurrencyContextType;
interface CurrencySelectorProps {
    className?: string;
    compact?: boolean;
}
export declare function CurrencySelector({ className, compact }: CurrencySelectorProps): React.JSX.Element;
interface PriceDisplayProps {
    /** Amount in paise (INR) */
    amountPaise: number;
    /** Optional custom class */
    className?: string;
    /** Show original INR price */
    showOriginal?: boolean;
    /** Size variant */
    size?: 'sm' | 'md' | 'lg';
}
export declare function PriceDisplay({ amountPaise, className, showOriginal, size }: PriceDisplayProps): React.JSX.Element;
interface BookingPriceSummaryProps {
    /** Room price per night in paise */
    roomPricePaise: number;
    /** Number of nights */
    nights: number;
    /** Tax amount in paise */
    taxPaise: number;
    /** Total discount in paise */
    discountPaise?: number;
    className?: string;
}
export declare function BookingPriceSummary({ roomPricePaise, nights, taxPaise, discountPaise, className, }: BookingPriceSummaryProps): React.JSX.Element;
export declare const currencyStyles = "\n.currency-selector-wrapper {\n  display: flex;\n  flex-direction: column;\n  gap: 0.25rem;\n}\n\n.currency-selector-label {\n  font-size: 0.75rem;\n  font-weight: 500;\n  color: #6b7280;\n  text-transform: uppercase;\n  letter-spacing: 0.05em;\n}\n\n.currency-selector {\n  padding: 0.5rem 1rem;\n  border: 1px solid #e5e7eb;\n  border-radius: 0.375rem;\n  font-size: 0.875rem;\n  background-color: white;\n  cursor: pointer;\n  transition: border-color 0.15s ease;\n}\n\n.currency-selector:hover {\n  border-color: #d1d5db;\n}\n\n.currency-selector:focus {\n  outline: none;\n  border-color: #3b82f6;\n  box-shadow: 0 0 0 2px rgba(59, 130, 246, 0.2);\n}\n\n.currency-selector--compact {\n  padding: 0.25rem 0.5rem;\n  font-size: 0.75rem;\n}\n\n.price-display {\n  display: flex;\n  flex-direction: column;\n  gap: 0.125rem;\n}\n\n.price-display__converted {\n  display: flex;\n  align-items: baseline;\n  gap: 0.25rem;\n}\n\n.price-display__amount {\n  font-weight: 600;\n}\n\n.price-display__currency-code {\n  font-size: 0.75rem;\n  color: #6b7280;\n}\n\n.price-display__original {\n  display: flex;\n  align-items: center;\n  gap: 0.25rem;\n  font-size: 0.75rem;\n  color: #9ca3af;\n}\n\n.price-display--sm .price-display__amount {\n  font-size: 0.875rem;\n}\n\n.price-display--md .price-display__amount {\n  font-size: 1rem;\n}\n\n.price-display--lg .price-display__amount {\n  font-size: 1.5rem;\n}\n\n.booking-price-summary {\n  background-color: #f9fafb;\n  border-radius: 0.5rem;\n  padding: 1rem;\n}\n\n.booking-price-summary__title {\n  font-size: 1rem;\n  font-weight: 600;\n  margin-bottom: 0.75rem;\n}\n\n.booking-price-summary__row {\n  display: flex;\n  justify-content: space-between;\n  padding: 0.5rem 0;\n  font-size: 0.875rem;\n}\n\n.booking-price-summary__row--discount {\n  color: #059669;\n}\n\n.booking-price-summary__row--total {\n  font-weight: 600;\n  font-size: 1rem;\n}\n\n.booking-price-summary__divider {\n  height: 1px;\n  background-color: #e5e7eb;\n  margin: 0.5rem 0;\n}\n";
export default CurrencySelector;
//# sourceMappingURL=CurrencySelector.d.ts.map