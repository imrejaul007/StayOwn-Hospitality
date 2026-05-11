"use strict";
/**
 * Currency Selector Component for StayOwn Booking UI
 *
 * Features:
 * - Dropdown to select preferred currency
 * - Display converted prices alongside original INR
 * - Persist currency preference in localStorage
 */
var __createBinding = (this && this.__createBinding) || (Object.create ? (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    var desc = Object.getOwnPropertyDescriptor(m, k);
    if (!desc || ("get" in desc ? !m.__esModule : desc.writable || desc.configurable)) {
      desc = { enumerable: true, get: function() { return m[k]; } };
    }
    Object.defineProperty(o, k2, desc);
}) : (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    o[k2] = m[k];
}));
var __setModuleDefault = (this && this.__setModuleDefault) || (Object.create ? (function(o, v) {
    Object.defineProperty(o, "default", { enumerable: true, value: v });
}) : function(o, v) {
    o["default"] = v;
});
var __importStar = (this && this.__importStar) || (function () {
    var ownKeys = function(o) {
        ownKeys = Object.getOwnPropertyNames || function (o) {
            var ar = [];
            for (var k in o) if (Object.prototype.hasOwnProperty.call(o, k)) ar[ar.length] = k;
            return ar;
        };
        return ownKeys(o);
    };
    return function (mod) {
        if (mod && mod.__esModule) return mod;
        var result = {};
        if (mod != null) for (var k = ownKeys(mod), i = 0; i < k.length; i++) if (k[i] !== "default") __createBinding(result, mod, k[i]);
        __setModuleDefault(result, mod);
        return result;
    };
})();
Object.defineProperty(exports, "__esModule", { value: true });
exports.currencyStyles = exports.SUPPORTED_CURRENCIES = void 0;
exports.CurrencyProvider = CurrencyProvider;
exports.useCurrency = useCurrency;
exports.CurrencySelector = CurrencySelector;
exports.PriceDisplay = PriceDisplay;
exports.BookingPriceSummary = BookingPriceSummary;
const react_1 = __importStar(require("react"));
// Supported currencies with exchange rates (from INR)
exports.SUPPORTED_CURRENCIES = [
    { code: 'INR', rate: 1, symbol: '₹', name: 'Indian Rupee', flag: '🇮🇳' },
    { code: 'USD', rate: 0.012, symbol: '$', name: 'US Dollar', flag: '🇺🇸' },
    { code: 'EUR', rate: 0.011, symbol: '€', name: 'Euro', flag: '🇪🇺' },
    { code: 'GBP', rate: 0.0095, symbol: '£', name: 'British Pound', flag: '🇬🇧' },
    { code: 'SGD', rate: 0.016, symbol: 'S$', name: 'Singapore Dollar', flag: '🇸🇬' },
    { code: 'AED', rate: 0.044, symbol: 'د.إ', name: 'UAE Dirham', flag: '🇦🇪' },
];
const CurrencyContext = (0, react_1.createContext)(undefined);
const STORAGE_KEY = 'stayown_preferred_currency';
// Currency Provider Component
function CurrencyProvider({ children, defaultCurrency = 'INR' }) {
    const [currency, setCurrencyState] = (0, react_1.useState)('INR');
    const [isLoading, setIsLoading] = (0, react_1.useState)(true);
    // Load saved currency preference on mount
    (0, react_1.useEffect)(() => {
        const saved = localStorage.getItem(STORAGE_KEY);
        if (saved && exports.SUPPORTED_CURRENCIES.some(c => c.code === saved)) {
            setCurrencyState(saved);
        }
        else {
            // Try to detect browser locale
            const locale = navigator.language || 'en-IN';
            if (locale.startsWith('en-US'))
                setCurrencyState('USD');
            else if (locale.startsWith('de'))
                setCurrencyState('EUR');
            else if (locale.startsWith('en-GB'))
                setCurrencyState('GBP');
            else if (locale.startsWith('ar'))
                setCurrencyState('AED');
            else if (locale.startsWith('zh'))
                setCurrencyState('SGD');
        }
        setIsLoading(false);
    }, []);
    // Persist currency preference
    const setCurrency = (newCurrency) => {
        setCurrencyState(newCurrency);
        localStorage.setItem(STORAGE_KEY, newCurrency);
    };
    // Convert from paise (INR) to selected currency
    const convertFromINR = (amountPaise) => {
        const currencyInfo = exports.SUPPORTED_CURRENCIES.find(c => c.code === currency);
        if (!currencyInfo) {
            return { amount: amountPaise / 100, symbol: '₹', formatted: `₹${(amountPaise / 100).toLocaleString()}` };
        }
        const amountInCurrency = (amountPaise / 100) * currencyInfo.rate;
        return {
            amount: Math.round(amountInCurrency * 100) / 100,
            symbol: currencyInfo.symbol,
            formatted: `${currencyInfo.symbol}${amountInCurrency.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`,
        };
    };
    // Format amount in selected currency
    const format = (amount) => {
        const currencyInfo = exports.SUPPORTED_CURRENCIES.find(c => c.code === currency);
        if (!currencyInfo)
            return `₹${amount.toLocaleString()}`;
        return `${currencyInfo.symbol}${amount.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
    };
    return (<CurrencyContext.Provider value={{ currency, setCurrency, convertFromINR, format, isLoading }}>
      {children}
    </CurrencyContext.Provider>);
}
// Hook to use currency context
function useCurrency() {
    const context = (0, react_1.useContext)(CurrencyContext);
    if (!context) {
        throw new Error('useCurrency must be used within a CurrencyProvider');
    }
    return context;
}
function CurrencySelector({ className = '', compact = false }) {
    const { currency, setCurrency, isLoading } = useCurrency();
    if (isLoading) {
        return (<select className={`currency-selector ${className}`} disabled>
        <option>Loading...</option>
      </select>);
    }
    if (compact) {
        return (<select className={`currency-selector currency-selector--compact ${className}`} value={currency} onChange={(e) => setCurrency(e.target.value)} aria-label="Select currency">
        {exports.SUPPORTED_CURRENCIES.map((c) => (<option key={c.code} value={c.code}>
            {c.code}
          </option>))}
      </select>);
    }
    return (<div className={`currency-selector-wrapper ${className}`}>
      <label htmlFor="currency-select" className="currency-selector-label">
        Currency
      </label>
      <select id="currency-select" className="currency-selector" value={currency} onChange={(e) => setCurrency(e.target.value)} aria-label="Select currency">
        {exports.SUPPORTED_CURRENCIES.map((c) => (<option key={c.code} value={c.code}>
            {c.flag} {c.code} - {c.name}
          </option>))}
      </select>
    </div>);
}
function PriceDisplay({ amountPaise, className = '', showOriginal = true, size = 'md' }) {
    const { currency, convertFromINR, format } = useCurrency();
    const converted = convertFromINR(amountPaise);
    const originalInr = (amountPaise / 100).toLocaleString();
    const sizeClass = `price-display price-display--${size}`;
    if (currency === 'INR') {
        return (<div className={`${sizeClass} ${className}`}>
        <span className="price-display__amount">{format(amountPaise / 100)}</span>
      </div>);
    }
    return (<div className={`${sizeClass} ${className}`}>
      <div className="price-display__converted">
        <span className="price-display__amount">{converted.formatted}</span>
        <span className="price-display__currency-code">{currency}</span>
      </div>
      {showOriginal && (<div className="price-display__original">
          <span className="price-display__original-label">INR</span>
          <span className="price-display__original-amount">₹{originalInr}</span>
        </div>)}
    </div>);
}
function BookingPriceSummary({ roomPricePaise, nights, taxPaise, discountPaise = 0, className = '', }) {
    const { format } = useCurrency();
    const subtotal = roomPricePaise * nights;
    const total = subtotal + taxPaise - discountPaise;
    return (<div className={`booking-price-summary ${className}`}>
      <h3 className="booking-price-summary__title">Price Summary</h3>

      <div className="booking-price-summary__row">
        <span>₹{(roomPricePaise / 100).toLocaleString()} x {nights} night{nights > 1 ? 's' : ''}</span>
        <span>₹{(subtotal / 100).toLocaleString()}</span>
      </div>

      {discountPaise > 0 && (<div className="booking-price-summary__row booking-price-summary__row--discount">
          <span>Discount</span>
          <span>-₹{(discountPaise / 100).toLocaleString()}</span>
        </div>)}

      <div className="booking-price-summary__row">
        <span>Taxes & fees</span>
        <span>₹{(taxPaise / 100).toLocaleString()}</span>
      </div>

      <div className="booking-price-summary__divider"/>

      <div className="booking-price-summary__row booking-price-summary__row--total">
        <span>Total</span>
        <span>₹{(total / 100).toLocaleString()}</span>
      </div>
    </div>);
}
// CSS Styles (to be added to your global styles or CSS module)
exports.currencyStyles = `
.currency-selector-wrapper {
  display: flex;
  flex-direction: column;
  gap: 0.25rem;
}

.currency-selector-label {
  font-size: 0.75rem;
  font-weight: 500;
  color: #6b7280;
  text-transform: uppercase;
  letter-spacing: 0.05em;
}

.currency-selector {
  padding: 0.5rem 1rem;
  border: 1px solid #e5e7eb;
  border-radius: 0.375rem;
  font-size: 0.875rem;
  background-color: white;
  cursor: pointer;
  transition: border-color 0.15s ease;
}

.currency-selector:hover {
  border-color: #d1d5db;
}

.currency-selector:focus {
  outline: none;
  border-color: #3b82f6;
  box-shadow: 0 0 0 2px rgba(59, 130, 246, 0.2);
}

.currency-selector--compact {
  padding: 0.25rem 0.5rem;
  font-size: 0.75rem;
}

.price-display {
  display: flex;
  flex-direction: column;
  gap: 0.125rem;
}

.price-display__converted {
  display: flex;
  align-items: baseline;
  gap: 0.25rem;
}

.price-display__amount {
  font-weight: 600;
}

.price-display__currency-code {
  font-size: 0.75rem;
  color: #6b7280;
}

.price-display__original {
  display: flex;
  align-items: center;
  gap: 0.25rem;
  font-size: 0.75rem;
  color: #9ca3af;
}

.price-display--sm .price-display__amount {
  font-size: 0.875rem;
}

.price-display--md .price-display__amount {
  font-size: 1rem;
}

.price-display--lg .price-display__amount {
  font-size: 1.5rem;
}

.booking-price-summary {
  background-color: #f9fafb;
  border-radius: 0.5rem;
  padding: 1rem;
}

.booking-price-summary__title {
  font-size: 1rem;
  font-weight: 600;
  margin-bottom: 0.75rem;
}

.booking-price-summary__row {
  display: flex;
  justify-content: space-between;
  padding: 0.5rem 0;
  font-size: 0.875rem;
}

.booking-price-summary__row--discount {
  color: #059669;
}

.booking-price-summary__row--total {
  font-weight: 600;
  font-size: 1rem;
}

.booking-price-summary__divider {
  height: 1px;
  background-color: #e5e7eb;
  margin: 0.5rem 0;
}
`;
exports.default = CurrencySelector;
//# sourceMappingURL=CurrencySelector.js.map