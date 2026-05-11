import React from 'react';
import DOMPurify from 'dompurify';
import { useTranslation, type TranslationOptions } from '@/context/LocalizationContext';

export interface LocalizedTextProps {
  /**
   * Translation key
   */
  tKey: string;
  
  /**
   * Translation options
   */
  options?: TranslationOptions;
  
  /**
   * HTML element to render (default: span)
   */
  as?: keyof JSX.IntrinsicElements;
  
  /**
   * Additional props to pass to the rendered element
   */
  [key: string]: unknown;
}

/**
 * LocalizedText Component
 * 
 * Renders translated text with proper formatting and variable interpolation
 */
export const LocalizedText: React.FC<LocalizedTextProps> = ({ 
  tKey, 
  options,
  as: Element = 'span',
  ...props 
}) => {
  const { t } = useTranslation(options?.namespace);
  
  const translatedText = t(tKey, options);
  
  return <Element {...props}>{translatedText}</Element>;
};

export interface LocalizedHTMLProps {
  /**
   * Translation key
   */
  tKey: string;
  
  /**
   * Translation options
   */
  options?: TranslationOptions;
  
  /**
   * HTML element to render (default: div)
   */
  as?: keyof JSX.IntrinsicElements;
  
  /**
   * Additional props to pass to the rendered element
   */
  [key: string]: unknown;
}

/**
 * LocalizedHTML Component
 * 
 * Renders translated text with HTML content (dangerous - use with caution)
 */
export const LocalizedHTML: React.FC<LocalizedHTMLProps> = ({
  tKey,
  options,
  as: Element = 'div',
  ...props
}) => {
  const { t } = useTranslation(options?.namespace);
  
  const translatedText = t(tKey, options);
  
  return (
    <Element 
      {...props}
      dangerouslySetInnerHTML={{ __html: DOMPurify.sanitize(translatedText) }}
    />
  );
};

export interface LocalizedPlaceholderProps {
  /**
   * Translation key for placeholder
   */
  tKey: string;
  
  /**
   * Translation options
   */
  options?: TranslationOptions;
  
  /**
   * Input props
   */
  [key: string]: unknown;
}

/**
 * LocalizedPlaceholder Component
 * 
 * Input component with localized placeholder
 */
export const LocalizedPlaceholder: React.FC<LocalizedPlaceholderProps> = ({
  tKey,
  options,
  ...props
}) => {
  const { t } = useTranslation(options?.namespace);
  
  const placeholder = t(tKey, options);
  
  return <input {...props} placeholder={placeholder} />;
};

export default LocalizedText;