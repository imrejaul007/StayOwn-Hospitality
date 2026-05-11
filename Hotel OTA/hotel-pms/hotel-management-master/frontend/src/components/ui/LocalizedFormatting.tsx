import React from 'react';
import { useFormatting, useTranslation } from '@/context/LocalizationContext';
import { cn } from '@/utils/cn';

export interface LocalizedDateProps {
  /**
   * Date to format
   */
  date: Date | string;
  
  /**
   * Format type
   */
  format?: 'short' | 'medium' | 'long' | 'full';
  
  /**
   * Show relative time (e.g., "2 hours ago")
   */
  relative?: boolean;
  
  /**
   * HTML element to render
   */
  as?: keyof JSX.IntrinsicElements;
  
  /**
   * Custom CSS classes
   */
  className?: string;
  
  /**
   * Additional props
   */
  [key: string]: unknown;
}

/**
 * LocalizedDate Component
 * 
 * Formats dates according to current language preferences
 */
export const LocalizedDate: React.FC<LocalizedDateProps> = ({
  date,
  format = 'medium',
  relative = false,
  as: Element = 'span',
  className,
  ...props
}) => {
  const { formatDate, currentLanguage } = useFormatting();
  const { t } = useTranslation('common');

  const dateObj = typeof date === 'string' ? new Date(date) : date;
  
  let formattedDate: string;
  
  if (relative) {
    const now = new Date();
    const diffMs = now.getTime() - dateObj.getTime();
    const diffMinutes = Math.floor(diffMs / 60000);
    const diffHours = Math.floor(diffMinutes / 60);
    const diffDays = Math.floor(diffHours / 24);
    
    if (diffMinutes < 1) {
      formattedDate = t('time.now', { defaultValue: 'now' });
    } else if (diffMinutes < 60) {
      formattedDate = t('time.minutesAgo', { 
        defaultValue: '{{count}} minute|{{count}} minutes',
        count: diffMinutes,
        variables: { count: diffMinutes }
      });
    } else if (diffHours < 24) {
      formattedDate = t('time.hoursAgo', {
        defaultValue: '{{count}} hour|{{count}} hours ago',
        count: diffHours,
        variables: { count: diffHours }
      });
    } else if (diffDays < 7) {
      formattedDate = t('time.daysAgo', {
        defaultValue: '{{count}} day|{{count}} days ago',
        count: diffDays,
        variables: { count: diffDays }
      });
    } else {
      formattedDate = formatDate(dateObj, format);
    }
  } else {
    formattedDate = formatDate(dateObj, format);
  }

  return (
    <Element 
      className={cn(className, currentLanguage?.direction === 'rtl' && 'text-right')}
      title={dateObj.toISOString()}
      {...props}
    >
      {formattedDate}
    </Element>
  );
};

export interface LocalizedTimeProps {
  /**
   * Time to format
   */
  time: Date | string;
  
  /**
   * Format type
   */
  format?: 'short' | 'medium' | 'long';
  
  /**
   * Show seconds
   */
  showSeconds?: boolean;
  
  /**
   * HTML element to render
   */
  as?: keyof JSX.IntrinsicElements;
  
  /**
   * Custom CSS classes
   */
  className?: string;
  
  /**
   * Additional props
   */
  [key: string]: unknown;
}

/**
 * LocalizedTime Component
 * 
 * Formats time according to current language preferences
 */
export const LocalizedTime: React.FC<LocalizedTimeProps> = ({
  time,
  format = 'short',
  showSeconds = false,
  as: Element = 'span',
  className,
  ...props
}) => {
  const { formatTime, currentLanguage } = useFormatting();

  const timeObj = typeof time === 'string' ? new Date(time) : time;
  const timeFormat = showSeconds && format === 'short' ? 'medium' : format;
  const formattedTime = formatTime(timeObj, timeFormat);

  return (
    <Element 
      className={cn(className, currentLanguage?.direction === 'rtl' && 'text-right')}
      title={timeObj.toISOString()}
      {...props}
    >
      {formattedTime}
    </Element>
  );
};

export interface LocalizedDateTimeProps {
  /**
   * DateTime to format
   */
  dateTime: Date | string;
  
  /**
   * Date format type
   */
  dateFormat?: 'short' | 'medium' | 'long' | 'full';
  
  /**
   * Time format type
   */
  timeFormat?: 'short' | 'medium' | 'long';
  
  /**
   * Show relative time
   */
  relative?: boolean;
  
  /**
   * Separator between date and time
   */
  separator?: string;
  
  /**
   * HTML element to render
   */
  as?: keyof JSX.IntrinsicElements;
  
  /**
   * Custom CSS classes
   */
  className?: string;
  
  /**
   * Additional props
   */
  [key: string]: unknown;
}

/**
 * LocalizedDateTime Component
 * 
 * Formats date and time together according to current language preferences
 */
export const LocalizedDateTime: React.FC<LocalizedDateTimeProps> = ({
  dateTime,
  dateFormat = 'medium',
  timeFormat = 'short',
  relative = false,
  separator = ' ',
  as: Element = 'span',
  className,
  ...props
}) => {
  const { formatDate, formatTime, currentLanguage } = useFormatting();

  const dateTimeObj = typeof dateTime === 'string' ? new Date(dateTime) : dateTime;
  
  const formattedDate = relative ? 
    <LocalizedDate date={dateTimeObj} format={dateFormat} relative={relative} as="span" /> :
    formatDate(dateTimeObj, dateFormat);
  
  const formattedTime = formatTime(dateTimeObj, timeFormat);

  return (
    <Element 
      className={cn(className, currentLanguage?.direction === 'rtl' && 'text-right')}
      title={dateTimeObj.toISOString()}
      {...props}
    >
      {relative ? formattedDate : formattedDate}{separator}{formattedTime}
    </Element>
  );
};

export interface LocalizedNumberProps {
  /**
   * Number to format
   */
  value: number;
  
  /**
   * Number style
   */
  style?: 'decimal' | 'currency' | 'percent';
  
  /**
   * Currency code (when style is currency)
   */
  currency?: string;
  
  /**
   * Minimum fraction digits
   */
  minimumFractionDigits?: number;
  
  /**
   * Maximum fraction digits
   */
  maximumFractionDigits?: number;
  
  /**
   * Show currency code instead of symbol
   */
  showCurrencyCode?: boolean;
  
  /**
   * HTML element to render
   */
  as?: keyof JSX.IntrinsicElements;
  
  /**
   * Custom CSS classes
   */
  className?: string;
  
  /**
   * Additional props
   */
  [key: string]: unknown;
}

/**
 * LocalizedNumber Component
 * 
 * Formats numbers according to current language preferences
 */
export const LocalizedNumber: React.FC<LocalizedNumberProps> = ({
  value,
  style = 'decimal',
  currency,
  minimumFractionDigits,
  maximumFractionDigits,
  showCurrencyCode = false,
  as: Element = 'span',
  className,
  ...props
}) => {
  const { formatNumber, formatCurrency, currentLanguage } = useFormatting();

  let formattedValue: string;
  
  if (style === 'currency' && currency) {
    formattedValue = formatCurrency(value, currency, {
      showCurrencyCode,
      minimumFractionDigits,
      maximumFractionDigits
    });
  } else {
    formattedValue = formatNumber(value, {
      style,
      currency: style === 'currency' ? currency : undefined,
      minimumFractionDigits,
      maximumFractionDigits
    });
  }

  return (
    <Element 
      className={cn(className, currentLanguage?.direction === 'rtl' && 'text-right')}
      title={value.toString()}
      {...props}
    >
      {formattedValue}
    </Element>
  );
};

export interface LocalizedCurrencyProps {
  /**
   * Amount to format
   */
  amount: number;
  
  /**
   * Currency code
   */
  currency: string;
  
  /**
   * Show currency code instead of symbol
   */
  showCurrencyCode?: boolean;
  
  /**
   * Minimum fraction digits
   */
  minimumFractionDigits?: number;
  
  /**
   * Maximum fraction digits
   */
  maximumFractionDigits?: number;
  
  /**
   * Show compact format for large numbers (e.g., $1.2K, $2.5M)
   */
  compact?: boolean;
  
  /**
   * HTML element to render
   */
  as?: keyof JSX.IntrinsicElements;
  
  /**
   * Custom CSS classes
   */
  className?: string;
  
  /**
   * Additional props
   */
  [key: string]: unknown;
}

/**
 * LocalizedCurrency Component
 * 
 * Specialized component for formatting currency amounts
 */
export const LocalizedCurrency: React.FC<LocalizedCurrencyProps> = ({
  amount,
  currency,
  showCurrencyCode = false,
  minimumFractionDigits = 2,
  maximumFractionDigits = 2,
  compact = false,
  as: Element = 'span',
  className,
  ...props
}) => {
  const { formatCurrency, currentLanguage } = useFormatting();

  let displayAmount = amount;
  let suffix = '';
  
  if (compact) {
    if (Math.abs(amount) >= 1e9) {
      displayAmount = amount / 1e9;
      suffix = 'B';
      maximumFractionDigits = Math.min(maximumFractionDigits, 1);
    } else if (Math.abs(amount) >= 1e6) {
      displayAmount = amount / 1e6;
      suffix = 'M';
      maximumFractionDigits = Math.min(maximumFractionDigits, 1);
    } else if (Math.abs(amount) >= 1e3) {
      displayAmount = amount / 1e3;
      suffix = 'K';
      maximumFractionDigits = Math.min(maximumFractionDigits, 1);
    }
  }

  const formattedAmount = formatCurrency(displayAmount, currency, {
    showCurrencyCode,
    minimumFractionDigits,
    maximumFractionDigits
  });

  return (
    <Element 
      className={cn(className, currentLanguage?.direction === 'rtl' && 'text-right')}
      title={`${currency} ${amount.toLocaleString()}`}
      {...props}
    >
      {formattedAmount}{suffix}
    </Element>
  );
};

export interface LocalizedPercentProps {
  /**
   * Value to format as percentage (0.85 = 85%)
   */
  value: number;
  
  /**
   * Minimum fraction digits
   */
  minimumFractionDigits?: number;
  
  /**
   * Maximum fraction digits
   */
  maximumFractionDigits?: number;
  
  /**
   * HTML element to render
   */
  as?: keyof JSX.IntrinsicElements;
  
  /**
   * Custom CSS classes
   */
  className?: string;
  
  /**
   * Additional props
   */
  [key: string]: unknown;
}

/**
 * LocalizedPercent Component
 * 
 * Formats percentage values according to current language preferences
 */
export const LocalizedPercent: React.FC<LocalizedPercentProps> = ({
  value,
  minimumFractionDigits = 0,
  maximumFractionDigits = 2,
  as: Element = 'span',
  className,
  ...props
}) => {
  const { formatNumber, currentLanguage } = useFormatting();

  const formattedValue = formatNumber(value, {
    style: 'percent',
    minimumFractionDigits,
    maximumFractionDigits
  });

  return (
    <Element 
      className={cn(className, currentLanguage?.direction === 'rtl' && 'text-right')}
      title={`${(value * 100).toFixed(2)}%`}
      {...props}
    >
      {formattedValue}
    </Element>
  );
};

export { 
  LocalizedDate, 
  LocalizedTime, 
  LocalizedDateTime, 
  LocalizedNumber, 
  LocalizedCurrency, 
  LocalizedPercent 
};