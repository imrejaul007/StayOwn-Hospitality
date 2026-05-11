/**
 * Format amount in Indian Rupees with proper formatting
 */
export const formatIndianCurrency = (amount: number): string => {
  if (amount == null || isNaN(amount)) return '\u20B90';
  return new Intl.NumberFormat('en-IN', {
    style: 'currency',
    currency: 'INR',
    minimumFractionDigits: 0,
    maximumFractionDigits: 0,
  }).format(amount);
};

/**
 * Format amount with Indian number system (lakhs, crores)
 */
export const formatIndianAmount = (amount: number): string => {
  if (amount == null || isNaN(amount)) return '0';
  return new Intl.NumberFormat('en-IN').format(amount);
};

/**
 * Convert USD to INR (approximate rate - in production, use real-time rates)
 */
export const convertToINR = (usdAmount: number, exchangeRate = 83): number => {
  return Math.round(usdAmount * exchangeRate);
};

/**
 * Format percentage in Indian style
 */
export const formatIndianPercentage = (percentage: number): string => {
  return new Intl.NumberFormat('en-IN', {
    style: 'percent',
    minimumFractionDigits: 1,
    maximumFractionDigits: 1,
  }).format(percentage / 100);
};